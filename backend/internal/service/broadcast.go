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
	merchantID uint,
	bidderID uint,
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
			Data: BuildNewBidView(mode, merchantID, bidderID, 0, bidderAlias, amount, currentPrice, bidCount, ranking),
			Ts:   now,
		})
		return
	}

	// Blind mode: each user sees personalized data
	room.BroadcastFiltered(func(viewerUserID uint) ws.ServerMessage {
		viewerID := viewerUserID
		return ws.ServerMessage{
			Type: ws.MsgNewBid,
			Code: 0,
			Data: BuildNewBidView(mode, merchantID, bidderID, viewerID, bidderAlias, amount, currentPrice, bidCount, ranking),
			Ts:   now,
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
