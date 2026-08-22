package service

import "jingpai/internal/model"

// CanViewAuctionPrices reports whether this viewer may see price-sensitive
// auction fields. Active blind auctions only reveal prices to the owning merchant.
func CanViewAuctionPrices(auction *model.Auction, viewerUserID uint) bool {
	if auction == nil {
		return false
	}
	if auction.Mode != model.ModeBlind {
		return true
	}
	if auction.IsTerminal() {
		return true
	}
	return auction.MerchantID == viewerUserID
}

func RankingForViewer(auction *model.Auction, ranking []RankItem, viewerUserID uint) []RankItemDTO {
	return FilterRankingForViewer(ranking, viewerUserID, CanViewAuctionPrices(auction, viewerUserID))
}

func FilterRankingForViewer(ranking []RankItem, viewerUserID uint, revealAmounts bool) []RankItemDTO {
	result := make([]RankItemDTO, len(ranking))
	for i, item := range ranking {
		dto := RankItemDTO{
			Rank:   item.Rank,
			UserID: item.UserID,
			Alias:  item.Alias,
			IsMe:   item.UserID == viewerUserID,
		}
		if revealAmounts || item.UserID == viewerUserID {
			amount := item.Amount
			dto.Amount = &amount
		}
		result[i] = dto
	}
	return result
}

func FindViewerBid(ranking []RankItem, viewerUserID uint) (rank int, amount float64, ok bool) {
	for _, item := range ranking {
		if item.UserID == viewerUserID {
			return item.Rank, item.Amount, true
		}
	}
	return 0, 0, false
}

func BuildNewBidView(
	mode model.AuctionMode,
	merchantID uint,
	bidderID uint,
	viewerUserID uint,
	bidderAlias string,
	amount float64,
	currentPrice float64,
	bidCount uint,
	ranking []RankItem,
) map[string]any {
	revealAmounts := mode == model.ModeOpen || viewerUserID == merchantID
	data := map[string]any{
		"alias":    bidderAlias,
		"bidCount": bidCount,
		"ranking":  FilterRankingForViewer(ranking, viewerUserID, revealAmounts),
	}

	if revealAmounts {
		data["amount"] = amount
		data["currentPrice"] = currentPrice
		return data
	}

	if rank, myAmount, ok := FindViewerBid(ranking, viewerUserID); ok {
		data["myRank"] = rank
		data["myAmount"] = myAmount
		if viewerUserID == bidderID {
			data["rank"] = rank
			data["amount"] = myAmount
		}
	}

	return data
}

func BuildAuctionView(auction *model.Auction, viewerUserID uint) map[string]any {
	view := map[string]any{
		"id":                auction.ID,
		"productId":         auction.ProductID,
		"roomId":            auction.RoomID,
		"merchantId":        auction.MerchantID,
		"mode":              auction.Mode,
		"status":            auction.Status,
		"startingPrice":     auction.StartingPrice.InexactFloat64(),
		"incrementAmount":   auction.IncrementAmount.InexactFloat64(),
		"ceilingPrice":      nil,
		"durationSeconds":   auction.DurationSeconds,
		"autoExtendSeconds": auction.AutoExtendSeconds,
		"depositAmount":     auction.DepositAmount.InexactFloat64(),
		"bidCount":          auction.BidCount,
		"extendCount":       auction.ExtendCount,
		"scheduledStart":    auction.ScheduledStart,
		"actualStart":       auction.ActualStart,
		"scheduledEnd":      auction.ScheduledEnd,
		"actualEnd":         auction.ActualEnd,
		"createdAt":         auction.CreatedAt,
		"updatedAt":         auction.UpdatedAt,
		"product":           auction.Product,
		"room":              auction.Room,
	}

	if auction.CeilingPrice != nil {
		view["ceilingPrice"] = auction.CeilingPrice.InexactFloat64()
	}
	if auction.CancelReason != "" {
		view["cancelReason"] = auction.CancelReason
	}
	if CanViewAuctionPrices(auction, viewerUserID) {
		view["currentPrice"] = auction.CurrentPrice.InexactFloat64()
		view["winnerId"] = auction.WinnerID
		if auction.Winner != nil {
			view["winner"] = auction.Winner
		}
	}

	return view
}
