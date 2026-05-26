package handler

import (
	"context"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"jingpai/internal/model"
	"jingpai/internal/pkg/errcode"
	"jingpai/internal/service"
	"jingpai/internal/ws"
)

// WsMessageHandler implements ws.MessageHandler, coordinating
// BidService, BroadcastService, and AliasService for real-time interactions.
type WsMessageHandler struct {
	hub              *ws.Hub
	db               *gorm.DB
	bidService       *service.BidService
	broadcastService *service.BroadcastService
	aliasService     *service.AliasService
	depositService   *service.DepositService
	auctionTimer     *service.AuctionTimer
}

func NewWsMessageHandler(
	hub *ws.Hub,
	db *gorm.DB,
	bidService *service.BidService,
	broadcastService *service.BroadcastService,
	aliasService *service.AliasService,
	depositService *service.DepositService,
	auctionTimer *service.AuctionTimer,
) *WsMessageHandler {
	return &WsMessageHandler{
		hub:              hub,
		db:               db,
		bidService:       bidService,
		broadcastService: broadcastService,
		aliasService:     aliasService,
		depositService:   depositService,
		auctionTimer:     auctionTimer,
	}
}

// OnJoinRoom handles a client joining a live room.
// Steps: validate room → add to room → assign alias → send full room state.
func (h *WsMessageHandler) OnJoinRoom(client *ws.Client, payload *ws.JoinRoomPayload) error {
	ctx := context.Background()
	roomID := payload.RoomID

	// Validate room exists
	var liveRoom model.LiveRoom
	if err := h.db.First(&liveRoom, roomID).Error; err != nil {
		client.SendMessage(ws.ServerMessage{
			Type: ws.MsgError,
			Code: errcode.CodeInvalidPayload,
			Msg:  "直播间不存在",
			Ts:   time.Now().UnixMilli(),
		})
		return err
	}

	// Connection guard: per-room limit
	room := h.hub.GetOrCreateRoom(roomID)
	if room.CountUserConnections(client.UserID) >= 3 {
		client.SendMessage(ws.ServerMessage{
			Type: ws.MsgError,
			Code: errcode.CodeSystemBusy,
			Msg:  "同一直播间最多3个连接",
			Ts:   time.Now().UnixMilli(),
		})
		return errcode.ErrTooManyConns
	}

	// Leave previous room if any
	if client.RoomID > 0 && client.RoomID != roomID {
		if prevRoom := h.hub.GetRoom(client.RoomID); prevRoom != nil {
			prevRoom.RemoveClient(client)
			go prevRoom.BroadcastUserCount()
		}
	}

	// Join room
	room.AddClient(client)
	go room.BroadcastUserCount()

	// Build and send room state
	h.sendRoomState(ctx, client, roomID)

	zap.L().Info("user joined room",
		zap.Uint("userId", client.UserID),
		zap.Uint("roomId", roomID),
	)
	return nil
}

// OnLeaveRoom handles a client leaving a room.
func (h *WsMessageHandler) OnLeaveRoom(client *ws.Client, payload *ws.LeaveRoomPayload) error {
	roomID := payload.RoomID

	room := h.hub.GetRoom(roomID)
	if room == nil {
		return nil
	}

	room.RemoveClient(client)
	client.RoomID = 0
	go room.BroadcastUserCount()

	zap.L().Info("user left room",
		zap.Uint("userId", client.UserID),
		zap.Uint("roomId", roomID),
	)
	return nil
}

// OnBid handles a bid from a client.
// Steps: validate → BidService.PlaceBid → send result → broadcast to room.
func (h *WsMessageHandler) OnBid(client *ws.Client, payload *ws.BidPayload) error {
	ctx := context.Background()
	now := time.Now().UnixMilli()

	// Must be in a room
	if client.RoomID == 0 {
		client.SendMessage(ws.ServerMessage{
			Type: ws.MsgBidResult,
			Code: errcode.CodeNotInRoom,
			Msg:  "请先加入直播间",
			Ts:   now,
		})
		return nil
	}

	// Validate auction belongs to this room
	var auction model.Auction
	if err := h.db.First(&auction, payload.AuctionID).Error; err != nil {
		client.SendMessage(ws.ServerMessage{
			Type: ws.MsgBidResult,
			Code: errcode.CodeInvalidPayload,
			Msg:  "竞拍不存在",
			Ts:   now,
		})
		return nil
	}
	if auction.RoomID != client.RoomID {
		client.SendMessage(ws.ServerMessage{
			Type: ws.MsgBidResult,
			Code: errcode.CodeInvalidPayload,
			Msg:  "竞拍不属于当前直播间",
			Ts:   now,
		})
		return nil
	}

	// Deposit check: if auction requires deposit, verify user has paid
	if required, _ := h.depositService.IsRequired(ctx, payload.AuctionID); required {
		if !h.depositService.HasDeposit(ctx, client.UserID, payload.AuctionID) {
			client.SendMessage(ws.ServerMessage{
				Type: ws.MsgBidResult,
				Code: errcode.CodeDepositRequired,
				Msg:  "请先缴纳保证金",
				Ts:   time.Now().UnixMilli(),
			})
			return nil
		}
	}

	// Place bid via BidService
	result, err := h.bidService.PlaceBid(ctx, payload.AuctionID, client.UserID, payload.Amount)
	if err != nil {
		client.SendMessage(ws.ServerMessage{
			Type: ws.MsgBidResult,
			Code: h.errToCode(err),
			Data: result,
			Ts:   time.Now().UnixMilli(),
		})
		return nil
	}

	// Send bid result to the bidder
	client.SendMessage(ws.ServerMessage{
		Type: ws.MsgBidResult,
		Code: errcode.CodeOK,
		Data: result,
		Ts:   time.Now().UnixMilli(),
	})

	// Broadcast new bid to the room
	h.broadcastBidToRoom(ctx, client, payload.AuctionID, auction.Mode, result)

	// If hit ceiling, trigger full completion side-effects
	if result.HitCeiling {
		go h.auctionTimer.CompleteByCeiling(payload.AuctionID, client.UserID, result.CurrentPrice)
		return nil
	}

	// If extended, reset timer and broadcast extension notice
	if result.NewEndTime != nil {
		h.auctionTimer.ExtendTimer(payload.AuctionID, *result.NewEndTime)

		extendCount := h.getExtendCount(ctx, payload.AuctionID)
		extendSec := h.bidService.CalcExtendSeconds(extendCount - 1)
		room := h.hub.GetRoom(client.RoomID)
		if room != nil {
			h.broadcastService.BroadcastAuctionExtend(
				room,
				*result.NewEndTime,
				extendSec,
				extendCount,
				10,
			)
		}
	}

	return nil
}

// sendRoomState sends the full auction state when a user joins
func (h *WsMessageHandler) sendRoomState(ctx context.Context, client *ws.Client, roomID uint) {
	// Find active auction in this room
	var auction model.Auction
	err := h.db.Where("room_id = ? AND status IN ?", roomID,
		[]string{string(model.StatusActive), string(model.StatusExtended)}).
		First(&auction).Error

	// Include room info (title, streamUrl) for the client
	var liveRoom model.LiveRoom
	h.db.Select("id, title, stream_url").First(&liveRoom, roomID)

	roomState := map[string]any{
		"roomId":    roomID,
		"roomTitle": liveRoom.Title,
		"streamUrl": liveRoom.StreamURL,
	}

	if err == nil {
		// Active auction exists — get real-time state from Redis
		currentPrice, endTime, status, bidCount, stateErr := h.bidService.GetAuctionState(ctx, auction.ID)
		if stateErr == nil {
			// Get ranking
			ranking, _ := h.bidService.GetRanking(ctx, auction.ID, 20)

			// Get user's own rank
			userRank, userAmount, _ := h.bidService.GetUserRank(ctx, auction.ID, client.UserID)

			// Get user's alias
			alias, _ := h.aliasService.GetOrAssign(ctx, auction.ID, client.UserID)

			// Filter ranking based on auction mode
			var rankingDTO []service.RankItemDTO
			if auction.Mode == model.ModeOpen {
				rankingDTO = h.buildOpenRanking(ranking, client.UserID)
			} else {
				rankingDTO = h.buildBlindRanking(ranking, client.UserID)
			}

			depositRequired := auction.DepositAmount.IsPositive()
			hasDeposit := !depositRequired || h.depositService.HasDeposit(ctx, auction.ID, client.UserID)

			roomState["auction"] = map[string]any{
				"id":              auction.ID,
				"productId":       auction.ProductID,
				"mode":            auction.Mode,
				"status":          status,
				"currentPrice":    currentPrice,
				"endTime":         endTime,
				"bidCount":        bidCount,
				"ranking":         rankingDTO,
				"myRank":          userRank,
				"myAmount":        userAmount,
				"myAlias":         alias,
				"serverTime":      time.Now().UnixMilli(),
				"incrementAmount": auction.IncrementAmount.InexactFloat64(),
				"depositRequired": depositRequired,
				"depositAmount":   auction.DepositAmount.InexactFloat64(),
				"hasDeposit":      hasDeposit,
			}
		}
	}

	client.SendMessage(ws.ServerMessage{
		Type: ws.MsgRoomState,
		Code: errcode.CodeOK,
		Data: roomState,
		Ts:   time.Now().UnixMilli(),
	})
}

func (h *WsMessageHandler) broadcastBidToRoom(
	ctx context.Context,
	bidder *ws.Client,
	auctionID uint,
	mode model.AuctionMode,
	result *service.BidResult,
) {
	room := h.hub.GetRoom(bidder.RoomID)
	if room == nil {
		return
	}

	// Get ranking for broadcast
	ranking, err := h.bidService.GetRanking(ctx, auctionID, 20)
	if err != nil {
		zap.L().Error("failed to get ranking for broadcast", zap.Error(err))
		return
	}

	// Get bidder's alias
	alias, _ := h.aliasService.GetOrAssign(ctx, auctionID, bidder.UserID)

	// Get bid count from result
	_, _, _, bidCount, _ := h.bidService.GetAuctionState(ctx, auctionID)

	h.broadcastService.BroadcastNewBid(
		room,
		mode,
		alias,
		result.Amount,
		result.CurrentPrice,
		uint(bidCount),
		ranking,
	)
}

func (h *WsMessageHandler) buildOpenRanking(ranking []service.RankItem, viewerUserID uint) []service.RankItemDTO {
	result := make([]service.RankItemDTO, len(ranking))
	for i, item := range ranking {
		amount := item.Amount
		result[i] = service.RankItemDTO{
			Rank:   item.Rank,
			Alias:  item.Alias,
			Amount: &amount,
			IsMe:   item.UserID == viewerUserID,
		}
	}
	return result
}

func (h *WsMessageHandler) buildBlindRanking(ranking []service.RankItem, viewerUserID uint) []service.RankItemDTO {
	result := make([]service.RankItemDTO, len(ranking))
	for i, item := range ranking {
		dto := service.RankItemDTO{
			Rank:  item.Rank,
			Alias: item.Alias,
			IsMe:  item.UserID == viewerUserID,
		}
		if item.UserID == viewerUserID {
			amount := item.Amount
			dto.Amount = &amount
		}
		result[i] = dto
	}
	return result
}

func (h *WsMessageHandler) getExtendCount(ctx context.Context, auctionID uint) int {
	return h.bidService.GetExtendCount(ctx, auctionID)
}

func (h *WsMessageHandler) errToCode(err error) int {
	switch err {
	case errcode.ErrBidTooLow:
		return errcode.CodeBidTooLow
	case errcode.ErrAuctionNotActive:
		return errcode.CodeAuctionNotActive
	case errcode.ErrBidTooFrequent:
		return errcode.CodeBidTooFrequent
	case errcode.ErrAuctionEnded:
		return errcode.CodeAuctionNotActive
	default:
		return errcode.CodeInternalError
	}
}

