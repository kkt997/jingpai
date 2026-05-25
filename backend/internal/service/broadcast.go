package service

import (
	"jingpai/internal/model"
	"jingpai/internal/ws"
	"time"
)

type BroadcastService struct {
	hub          *ws.Hub
	aliasService *AliasService
}

func NewBroadcastService(hub *ws.Hub, aliasService *AliasService) *BroadcastService {
	return &BroadcastService{hub: hub, aliasService: aliasService}
}

// BroadcastNewBid sends bid update to all users in the room
func (s *BroadcastService) BroadcastNewBid(
	room *ws.Room,
	mode model.AuctionMode,
	bidderAlias string,
	amount float64,
	currentPrice float64,
	bidCount uint,
	ranking []RankItem,
) {
	now := time.Now().UnixMilli()

	if mode == model.ModeOpen {
		room.Broadcast(ws.ServerMessage{
			Type: ws.MsgNewBid,
			Code: 0,
			Data: map[string]any{
				"alias":        bidderAlias,
				"amount":       amount,
				"currentPrice": currentPrice,
				"bidCount":     bidCount,
				"ranking":      filterRankingOpen(ranking),
			},
			Ts: now,
		})
		return
	}

	// Blind mode: each user sees personalized data
	room.BroadcastFiltered(func(viewerUserID uint) ws.ServerMessage {
		return ws.ServerMessage{
			Type: ws.MsgNewBid,
			Code: 0,
			Data: map[string]any{
				"alias":    bidderAlias,
				"bidCount": bidCount,
				"ranking":  filterRankingBlind(ranking, viewerUserID),
			},
			Ts: now,
		}
	})
}

// BroadcastAuctionExtend notifies room about auction extension
func (s *BroadcastService) BroadcastAuctionExtend(room *ws.Room, newEndTime int64, extendSeconds, extendCount, maxExtendCount int) {
	room.Broadcast(ws.ServerMessage{
		Type: ws.MsgAuctionExtend,
		Code: 0,
		Data: map[string]any{
			"newEndTime":     newEndTime,
			"extendSeconds":  extendSeconds,
			"extendCount":    extendCount,
			"maxExtendCount": maxExtendCount,
		},
		Ts: time.Now().UnixMilli(),
	})
}

// BroadcastAuctionEnd notifies room about auction completion
func (s *BroadcastService) BroadcastAuctionEnd(room *ws.Room, result string, winnerAlias string, finalPrice float64, totalBids, totalBidders int) {
	room.Broadcast(ws.ServerMessage{
		Type: ws.MsgAuctionEnd,
		Code: 0,
		Data: map[string]any{
			"result":       result,
			"winnerAlias":  winnerAlias,
			"finalPrice":   finalPrice,
			"totalBids":    totalBids,
			"totalBidders": totalBidders,
		},
		Ts: time.Now().UnixMilli(),
	})
}

func filterRankingOpen(ranking []RankItem) []RankItemDTO {
	result := make([]RankItemDTO, len(ranking))
	for i, item := range ranking {
		amount := item.Amount
		result[i] = RankItemDTO{
			Rank:   item.Rank,
			Alias:  item.Alias,
			Amount: &amount,
			IsMe:   item.IsMe,
		}
	}
	return result
}

func filterRankingBlind(ranking []RankItem, viewerUserID uint) []RankItemDTO {
	result := make([]RankItemDTO, len(ranking))
	for i, item := range ranking {
		dto := RankItemDTO{
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
