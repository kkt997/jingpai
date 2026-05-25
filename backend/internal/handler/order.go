package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"jingpai/internal/model"
	"jingpai/internal/pkg/response"
)

func (h *Handler) ListOrders(c *gin.Context) {
	userID, _ := c.Get("userID")
	var orders []model.Order
	h.db.Where("buyer_id = ?", userID).
		Preload("Product").Preload("Auction").
		Order("created_at DESC").Find(&orders)
	response.OK(c, orders)
}

func (h *Handler) ListMerchantOrders(c *gin.Context) {
	merchantID, _ := c.Get("userID")
	var orders []model.Order
	h.db.Where("seller_id = ?", merchantID).
		Preload("Product").Preload("Buyer").
		Order("created_at DESC").Find(&orders)
	response.OK(c, orders)
}

func (h *Handler) GetOrder(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	userID, _ := c.Get("userID")

	var order model.Order
	if err := h.db.Preload("Product").Preload("Auction").First(&order, id).Error; err != nil {
		response.NotFound(c, "订单不存在")
		return
	}
	if order.BuyerID != userID.(uint) && order.SellerID != userID.(uint) {
		response.Forbidden(c, "无权查看")
		return
	}
	response.OK(c, order)
}

func (h *Handler) PayOrder(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	userID, _ := c.Get("userID")

	order, err := h.orderService.PayOrder(c.Request.Context(), uint(id), userID.(uint))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, order)
}

func (h *Handler) ShipOrder(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	merchantID, _ := c.Get("userID")

	order, err := h.orderService.ShipOrder(c.Request.Context(), uint(id), merchantID.(uint))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, order)
}

func (h *Handler) ConfirmReceive(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	userID, _ := c.Get("userID")

	order, err := h.orderService.ConfirmReceive(c.Request.Context(), uint(id), userID.(uint))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, order)
}

func (h *Handler) CancelOrder(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	userID, _ := c.Get("userID")

	order, err := h.orderService.CancelOrder(c.Request.Context(), uint(id), userID.(uint))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, order)
}

// ListUserBids returns the bid history for the authenticated user
func (h *Handler) ListUserBids(c *gin.Context) {
	userID, _ := c.Get("userID")

	type BidWithAuction struct {
		model.Bid
		AuctionTitle string `json:"auctionTitle"`
		AuctionMode  string `json:"auctionMode"`
		IsWinner     bool   `json:"isWinner"`
	}

	var bids []model.Bid
	query := h.db.Where("user_id = ?", userID).
		Preload("Auction", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, product_id, mode, status, current_price, winner_id").Preload("Product", func(db *gorm.DB) *gorm.DB {
				return db.Select("id, title, images")
			})
		}).
		Order("bid_time DESC")

	if auctionID := c.Query("auctionId"); auctionID != "" {
		query = query.Where("auction_id = ?", auctionID)
	}

	query.Limit(50).Find(&bids)

	// Build response with auction context
	type BidRecord struct {
		ID           uint    `json:"id"`
		AuctionID    uint    `json:"auctionId"`
		Amount       float64 `json:"amount"`
		BidTime      string  `json:"bidTime"`
		ProductTitle string  `json:"productTitle"`
		ProductImage string  `json:"productImage"`
		AuctionMode  string  `json:"auctionMode"`
		AuctionStatus string `json:"auctionStatus"`
		IsWinner     bool    `json:"isWinner"`
	}

	records := make([]BidRecord, 0, len(bids))
	for _, b := range bids {
		record := BidRecord{
			ID:        b.ID,
			AuctionID: b.AuctionID,
			Amount:    b.Amount.InexactFloat64(),
			BidTime:   b.BidTime.Format("2006-01-02 15:04:05"),
		}
		if b.Auction.ID > 0 {
			record.AuctionMode = string(b.Auction.Mode)
			record.AuctionStatus = string(b.Auction.Status)
			record.IsWinner = b.Auction.WinnerID != nil && *b.Auction.WinnerID == b.UserID
			if b.Auction.Product.ID > 0 {
				record.ProductTitle = b.Auction.Product.Title
				if len(b.Auction.Product.Images) > 0 {
					record.ProductImage = b.Auction.Product.Images[0]
				}
			}
		}
		records = append(records, record)
	}

	response.OK(c, records)
}

// GetMerchantStats returns dashboard stats for a merchant
func (h *Handler) GetMerchantStats(c *gin.Context) {
	merchantID, _ := c.Get("userID")
	uid := merchantID.(uint)

	var productCount int64
	h.db.Model(&model.Product{}).Where("merchant_id = ? AND status != ?", uid, "REMOVED").Count(&productCount)

	var activeAuctions int64
	h.db.Model(&model.Auction{}).Where("merchant_id = ? AND status IN ?", uid, []string{"ACTIVE", "EXTENDED"}).Count(&activeAuctions)

	var completedAuctions int64
	h.db.Model(&model.Auction{}).Where("merchant_id = ? AND status = ?", uid, "COMPLETED").Count(&completedAuctions)

	var totalOrders int64
	h.db.Model(&model.Order{}).Where("seller_id = ?", uid).Count(&totalOrders)

	var paidOrders int64
	h.db.Model(&model.Order{}).Where("seller_id = ? AND status IN ?", uid, []string{"PAID", "SHIPPED", "COMPLETED"}).Count(&paidOrders)

	type revenueResult struct {
		Total float64
	}
	var rev revenueResult
	h.db.Model(&model.Order{}).
		Select("COALESCE(SUM(final_price), 0) as total").
		Where("seller_id = ? AND status IN ?", uid, []string{"PAID", "SHIPPED", "COMPLETED"}).
		Scan(&rev)

	var liveRooms int64
	h.db.Model(&model.LiveRoom{}).Where("merchant_id = ? AND status = ?", uid, "LIVE").Count(&liveRooms)

	response.OK(c, map[string]any{
		"productCount":     productCount,
		"activeAuctions":   activeAuctions,
		"completedAuctions": completedAuctions,
		"totalOrders":      totalOrders,
		"paidOrders":       paidOrders,
		"totalRevenue":     rev.Total,
		"liveRooms":        liveRooms,
	})
}
