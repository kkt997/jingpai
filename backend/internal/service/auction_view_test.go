package service

import (
	"testing"

	"github.com/shopspring/decimal"

	"jingpai/internal/model"
)

func TestBlindRankingHidesOtherAmountsForRegularViewer(t *testing.T) {
	auction := &model.Auction{
		Mode:       model.ModeBlind,
		Status:     model.StatusActive,
		MerchantID: 99,
	}
	ranking := []RankItem{
		{Rank: 1, UserID: 1, Alias: "巅峰竞拍者1", Amount: 1200},
		{Rank: 2, UserID: 2, Alias: "巅峰竞拍者2", Amount: 1100},
	}

	got := RankingForViewer(auction, ranking, 2)

	if got[0].Amount != nil {
		t.Fatalf("expected other bidder amount to be hidden, got %v", *got[0].Amount)
	}
	if got[1].Amount == nil || *got[1].Amount != 1100 {
		t.Fatalf("expected viewer amount to be visible, got %#v", got[1].Amount)
	}
	if !got[1].IsMe {
		t.Fatal("expected viewer rank item to be marked as me")
	}
}

func TestBlindRankingRevealsAmountsToMerchant(t *testing.T) {
	auction := &model.Auction{
		Mode:       model.ModeBlind,
		Status:     model.StatusActive,
		MerchantID: 99,
	}
	ranking := []RankItem{
		{Rank: 1, UserID: 1, Alias: "巅峰竞拍者1", Amount: 1200},
		{Rank: 2, UserID: 2, Alias: "巅峰竞拍者2", Amount: 1100},
	}

	got := RankingForViewer(auction, ranking, 99)

	for i, item := range got {
		if item.Amount == nil {
			t.Fatalf("expected merchant to see amount for item %d", i)
		}
	}
}

func TestBlindNewBidViewHidesCurrentPriceFromRegularViewer(t *testing.T) {
	ranking := []RankItem{
		{Rank: 1, UserID: 1, Alias: "巅峰竞拍者1", Amount: 1200},
		{Rank: 2, UserID: 2, Alias: "巅峰竞拍者2", Amount: 1100},
	}

	got := BuildNewBidView(model.ModeBlind, 99, 1, 2, "巅峰竞拍者1", 1200, 1200, 2, ranking)

	if _, ok := got["currentPrice"]; ok {
		t.Fatal("expected currentPrice to be hidden from regular blind-auction viewer")
	}
	if _, ok := got["amount"]; ok {
		t.Fatal("expected new bidder amount to be hidden from other regular viewer")
	}
	if got["myRank"] != 2 {
		t.Fatalf("expected viewer rank to remain visible, got %#v", got["myRank"])
	}
	if got["myAmount"] != 1100.0 {
		t.Fatalf("expected viewer amount to remain visible, got %#v", got["myAmount"])
	}
}

func TestAuctionViewOmitsCurrentPriceForActiveBlindRegularViewer(t *testing.T) {
	auction := &model.Auction{
		ID:              1,
		Mode:            model.ModeBlind,
		Status:          model.StatusActive,
		MerchantID:      99,
		StartingPrice:   decimal.NewFromInt(1000),
		IncrementAmount: decimal.NewFromInt(100),
		CurrentPrice:    decimal.NewFromInt(1200),
	}

	got := BuildAuctionView(auction, 2)

	if _, ok := got["currentPrice"]; ok {
		t.Fatal("expected active blind currentPrice to be omitted for regular viewer")
	}
	if _, ok := got["winnerId"]; ok {
		t.Fatal("expected active blind winnerId to be omitted for regular viewer")
	}

	merchantView := BuildAuctionView(auction, 99)
	if merchantView["currentPrice"] != 1200.0 {
		t.Fatalf("expected merchant currentPrice, got %#v", merchantView["currentPrice"])
	}
}
