package service

import (
	"fmt"

	"jingpai/internal/model"
)

type AuctionEvent string

const (
	EventConfigure    AuctionEvent = "configure"
	EventStart        AuctionEvent = "start"
	EventBid          AuctionEvent = "bid"
	EventBidNearEnd   AuctionEvent = "bid_near_end"
	EventReachCeiling AuctionEvent = "reach_ceiling"
	EventTimeout      AuctionEvent = "timeout"
	EventCancel       AuctionEvent = "cancel"
)

type TransitionAction func(ctx *AuctionContext) error
type TransitionGuard func(ctx *AuctionContext) bool

type Transition struct {
	From   model.AuctionStatus
	Event  AuctionEvent
	To     model.AuctionStatus
	Guard  TransitionGuard
	Action TransitionAction
}

type AuctionFSM struct {
	transitions []Transition
}

func NewAuctionFSM() *AuctionFSM {
	fsm := &AuctionFSM{}
	fsm.transitions = []Transition{
		{From: model.StatusDraft, Event: EventConfigure, To: model.StatusPending},
		{From: model.StatusPending, Event: EventStart, To: model.StatusActive},
		{From: model.StatusPending, Event: EventCancel, To: model.StatusCancelled},

		// ACTIVE transitions
		{From: model.StatusActive, Event: EventBid, To: model.StatusActive},
		{From: model.StatusActive, Event: EventBidNearEnd, To: model.StatusExtended},
		{From: model.StatusActive, Event: EventReachCeiling, To: model.StatusCompleted},
		{
			From: model.StatusActive, Event: EventTimeout, To: model.StatusCompleted,
			Guard: func(ctx *AuctionContext) bool { return ctx.Auction.BidCount > 0 },
		},
		{
			From: model.StatusActive, Event: EventTimeout, To: model.StatusFailed,
			Guard: func(ctx *AuctionContext) bool { return ctx.Auction.BidCount == 0 },
		},
		{From: model.StatusActive, Event: EventCancel, To: model.StatusCancelled},

		// EXTENDED transitions
		{From: model.StatusExtended, Event: EventBid, To: model.StatusExtended},
		{From: model.StatusExtended, Event: EventReachCeiling, To: model.StatusCompleted},
		{From: model.StatusExtended, Event: EventTimeout, To: model.StatusCompleted},
		{From: model.StatusExtended, Event: EventCancel, To: model.StatusCancelled},
	}
	return fsm
}

func (fsm *AuctionFSM) Trigger(ctx *AuctionContext, event AuctionEvent) (model.AuctionStatus, error) {
	current := ctx.Auction.Status

	for _, t := range fsm.transitions {
		if t.From != current || t.Event != event {
			continue
		}
		if t.Guard != nil && !t.Guard(ctx) {
			continue
		}
		if t.Action != nil {
			if err := t.Action(ctx); err != nil {
				return current, fmt.Errorf("transition action failed: %w", err)
			}
		}

		ctx.Auction.Status = t.To
		return t.To, nil
	}

	return current, fmt.Errorf("%w: %s + %s", ErrInvalidTransition, current, event)
}

// CanTransition checks if a transition is valid without executing it
func (fsm *AuctionFSM) CanTransition(ctx *AuctionContext, event AuctionEvent) bool {
	current := ctx.Auction.Status
	for _, t := range fsm.transitions {
		if t.From == current && t.Event == event {
			if t.Guard == nil || t.Guard(ctx) {
				return true
			}
		}
	}
	return false
}
