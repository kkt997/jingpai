package service

import (
	"errors"

	"jingpai/internal/model"
)

var ErrInvalidTransition = errors.New("invalid state transition")

// AuctionContext holds all data needed during auction state transitions
type AuctionContext struct {
	Auction      *model.Auction
	CancelReason string
}

// RankItem represents a single entry in the auction ranking
type RankItem struct {
	Rank   int     `json:"rank"`
	UserID uint    `json:"userId"`
	Alias  string  `json:"alias"`
	Amount float64 `json:"amount"`
	IsMe   bool    `json:"isMe,omitempty"`
}

// RankItemDTO is the client-facing ranking entry (amount may be hidden in blind mode)
type RankItemDTO struct {
	Rank   int      `json:"rank"`
	UserID uint     `json:"userId"`
	Alias  string   `json:"alias"`
	Amount *float64 `json:"amount"` // nil in blind mode for other users
	IsMe   bool     `json:"isMe"`
}

// BidResult is returned to the bidder after placing a bid
type BidResult struct {
	Accepted     bool     `json:"accepted"`
	Amount       float64  `json:"amount,omitempty"`
	Rank         int      `json:"rank,omitempty"`
	CurrentPrice float64  `json:"currentPrice,omitempty"`
	MinNextBid   float64  `json:"minNextBid,omitempty"`
	NewEndTime   *int64   `json:"newEndTime,omitempty"`
	HitCeiling   bool     `json:"hitCeiling,omitempty"`
	Msg          string   `json:"msg,omitempty"`
}
