package handler

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"gorm.io/gorm/clause"

	"jingpai/internal/model"
	"jingpai/internal/pkg/response"
	"jingpai/internal/service"
	"jingpai/internal/ws"
)

type CreateAuctionRequest struct {
	ProductID         uint     `json:"productId" binding:"required"`
	RoomID            uint     `json:"roomId" binding:"required"`
	Mode              string   `json:"mode" binding:"required,oneof=OPEN BLIND"`
	StartingPrice     float64  `json:"startingPrice"`
	IncrementAmount   float64  `json:"incrementAmount" binding:"required,gt=0"`
	CeilingPrice      *float64 `json:"ceilingPrice"`
	DurationSeconds   uint     `json:"durationSeconds" binding:"required,min=10"`
	AutoExtendSeconds uint     `json:"autoExtendSeconds" binding:"min=5,max=60"`
	DepositAmount     *float64 `json:"depositAmount"`
}

func (h *Handler) CreateAuction(c *gin.Context) {
	var req CreateAuctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	merchantID, _ := c.Get("userID")

	// Validate product is LISTED
	var product model.Product
	if err := h.db.First(&product, req.ProductID).Error; err != nil {
		response.BadRequest(c, "商品不存在")
		return
	}
	if product.MerchantID != merchantID.(uint) {
		response.Forbidden(c, "无权操作该商品")
		return
	}
	if product.Status != model.ProductListed {
		response.BadRequest(c, "商品未上架，请先上架商品")
		return
	}

	var room model.LiveRoom
	if err := h.db.First(&room, req.RoomID).Error; err != nil {
		response.BadRequest(c, "直播间不存在")
		return
	}
	if room.MerchantID != merchantID.(uint) {
		response.Forbidden(c, "无权使用该直播间")
		return
	}
	if room.Status == model.RoomEnded {
		response.BadRequest(c, "直播间已结束，无法创建竞拍")
		return
	}

	var productAuctionCount int64
	h.db.Model(&model.Auction{}).
		Where("product_id = ? AND status IN ?", req.ProductID, []string{
			string(model.StatusPending),
			string(model.StatusActive),
			string(model.StatusExtended),
		}).
		Count(&productAuctionCount)
	if productAuctionCount > 0 {
		response.BadRequest(c, "该商品已有待开始或进行中的竞拍")
		return
	}

	var activeRoomAuctionCount int64
	h.db.Model(&model.Auction{}).
		Where("room_id = ? AND status IN ?", req.RoomID, []string{
			string(model.StatusActive),
			string(model.StatusExtended),
		}).
		Count(&activeRoomAuctionCount)
	if activeRoomAuctionCount > 0 {
		response.BadRequest(c, "该直播间已有进行中的竞拍")
		return
	}

	auction := model.Auction{
		ProductID:         req.ProductID,
		RoomID:            req.RoomID,
		MerchantID:        merchantID.(uint),
		Mode:              model.AuctionMode(req.Mode),
		Status:            model.StatusPending,
		StartingPrice:     decimal.NewFromFloat(req.StartingPrice),
		IncrementAmount:   decimal.NewFromFloat(req.IncrementAmount),
		DurationSeconds:   req.DurationSeconds,
		AutoExtendSeconds: req.AutoExtendSeconds,
		CurrentPrice:      decimal.NewFromFloat(req.StartingPrice),
	}

	if req.CeilingPrice != nil {
		cp := decimal.NewFromFloat(*req.CeilingPrice)
		auction.CeilingPrice = &cp
	}

	if req.DepositAmount != nil {
		auction.DepositAmount = decimal.NewFromFloat(*req.DepositAmount)
	}

	if req.AutoExtendSeconds == 0 {
		auction.AutoExtendSeconds = 20
	}

	if err := h.db.Create(&auction).Error; err != nil {
		response.ServerError(c, "创建竞拍失败")
		return
	}

	h.db.Preload("Product").Preload("Room").First(&auction, auction.ID)
	response.OK(c, auction)
}

func (h *Handler) ListRoomShowcase(c *gin.Context) {
	roomID, err := strconv.ParseUint(c.Query("roomId"), 10, 64)
	if err != nil || roomID == 0 {
		response.BadRequest(c, "请选择直播间")
		return
	}
	userID, _ := c.Get("userID")
	viewerID := userID.(uint)

	var auctions []model.Auction
	if err := h.db.
		Where("room_id = ?", roomID).
		Where("status IN ?", []string{
			string(model.StatusPending),
			string(model.StatusActive),
			string(model.StatusExtended),
			string(model.StatusCompleted),
			string(model.StatusFailed),
			string(model.StatusCancelled),
		}).
		Preload("Product").
		Preload("Winner").
		Order("created_at ASC").
		Find(&auctions).Error; err != nil {
		response.ServerError(c, "获取拍品柜失败")
		return
	}

	items := make([]map[string]any, 0, len(auctions))
	for i, auction := range auctions {
		item := map[string]any{
			"id":            auction.ID,
			"productId":     auction.ProductID,
			"product":       auction.Product,
			"mode":          auction.Mode,
			"status":        auction.Status,
			"startingPrice": auction.StartingPrice.InexactFloat64(),
			"sequence":      i + 1,
		}
		if service.CanViewAuctionPrices(&auction, viewerID) {
			item["currentPrice"] = auction.CurrentPrice.InexactFloat64()
		}
		if auction.IsTerminal() {
			item["finalPrice"] = auction.CurrentPrice.InexactFloat64()
		}
		if auction.Winner != nil {
			item["winnerNickname"] = auction.Winner.Nickname
		}
		items = append(items, item)
	}

	response.OK(c, items)
}

func (h *Handler) ListMerchantAuctions(c *gin.Context) {
	merchantID, _ := c.Get("userID")
	var auctions []model.Auction
	query := h.db.Where("merchant_id = ?", merchantID).Preload("Product").Preload("Room").Order("created_at DESC")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if roomID := c.Query("roomId"); roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}

	query.Find(&auctions)
	response.OK(c, auctions)
}

func (h *Handler) ListAuctions(c *gin.Context) {
	var auctions []model.Auction
	query := h.db.Preload("Product").Preload("Room").Order("created_at DESC")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if roomID := c.Query("roomId"); roomID != "" {
		query = query.Where("room_id = ?", roomID)
	}

	query.Find(&auctions)

	userID, _ := c.Get("userID")
	uid := userID.(uint)
	items := make([]map[string]any, 0, len(auctions))
	for i := range auctions {
		items = append(items, service.BuildAuctionView(&auctions[i], uid))
	}

	response.OK(c, items)
}

func (h *Handler) GetAuction(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var auction model.Auction
	if err := h.db.Preload("Product").Preload("Room").First(&auction, id).Error; err != nil {
		response.NotFound(c, "竞拍不存在")
		return
	}

	userID, _ := c.Get("userID")
	response.OK(c, service.BuildAuctionView(&auction, userID.(uint)))
}

func (h *Handler) UpdateAuction(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	merchantID, _ := c.Get("userID")

	var auction model.Auction
	if err := h.db.First(&auction, id).Error; err != nil {
		response.NotFound(c, "竞拍不存在")
		return
	}

	if auction.MerchantID != merchantID.(uint) {
		response.Forbidden(c, "无权修改")
		return
	}

	if auction.Status != model.StatusDraft && auction.Status != model.StatusPending {
		response.BadRequest(c, "仅可修改未开始的竞拍")
		return
	}

	var req CreateAuctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	auction.Mode = model.AuctionMode(req.Mode)
	auction.StartingPrice = decimal.NewFromFloat(req.StartingPrice)
	auction.IncrementAmount = decimal.NewFromFloat(req.IncrementAmount)
	auction.DurationSeconds = req.DurationSeconds
	auction.AutoExtendSeconds = req.AutoExtendSeconds

	if req.CeilingPrice != nil {
		cp := decimal.NewFromFloat(*req.CeilingPrice)
		auction.CeilingPrice = &cp
	}
	if req.DepositAmount != nil {
		auction.DepositAmount = decimal.NewFromFloat(*req.DepositAmount)
	}

	h.db.Save(&auction)
	response.OK(c, auction)
}

func (h *Handler) StartAuction(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	merchantID, _ := c.Get("userID")
	ctx := c.Request.Context()

	var auction model.Auction
	tx := h.db.Begin()
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&auction, id).Error; err != nil {
		tx.Rollback()
		response.NotFound(c, "竞拍不存在")
		return
	}
	if auction.MerchantID != merchantID.(uint) {
		tx.Rollback()
		response.Forbidden(c, "无权操作")
		return
	}
	if auction.Status != model.StatusPending {
		tx.Rollback()
		response.BadRequest(c, "竞拍状态不允许开始")
		return
	}

	var room model.LiveRoom
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&room, auction.RoomID).Error; err != nil {
		tx.Rollback()
		response.BadRequest(c, "直播间不存在")
		return
	}
	if room.Status != model.RoomLive {
		tx.Rollback()
		response.BadRequest(c, "直播间未开播，无法开始竞拍")
		return
	}

	var activeCount int64
	if err := tx.Model(&model.Auction{}).
		Where("room_id = ? AND id <> ? AND status IN ?", auction.RoomID, auction.ID, []string{
			string(model.StatusActive),
			string(model.StatusExtended),
		}).
		Count(&activeCount).Error; err != nil {
		tx.Rollback()
		response.ServerError(c, "校验直播间竞拍状态失败")
		return
	}
	if activeCount > 0 {
		tx.Rollback()
		response.BadRequest(c, "该直播间已有进行中的竞拍")
		return
	}

	// Trigger FSM transition
	auctionCtx := &service.AuctionContext{Auction: &auction}
	newStatus, err := h.auctionFSM.Trigger(auctionCtx, service.EventStart)
	if err != nil {
		tx.Rollback()
		response.ServerError(c, "状态转换失败: "+err.Error())
		return
	}

	now := time.Now()
	scheduledEnd := now.Add(time.Duration(auction.DurationSeconds) * time.Second)
	auction.Status = newStatus
	auction.ActualStart = &now
	auction.ScheduledEnd = &scheduledEnd

	// Initialize Redis auction state
	if err := h.bidService.InitAuctionState(ctx, &auction); err != nil {
		tx.Rollback()
		h.bidService.CleanupAuctionState(ctx, auction.ID)
		response.ServerError(c, "初始化竞拍状态失败")
		return
	}
	h.bidService.SetAuctionParams(ctx, &auction)

	result := tx.Model(&model.Auction{}).
		Where("id = ? AND status = ?", auction.ID, model.StatusPending).
		Updates(map[string]interface{}{
			"status":        newStatus,
			"actual_start":  now,
			"scheduled_end": scheduledEnd,
		})
	if result.Error != nil {
		tx.Rollback()
		h.bidService.CleanupAuctionState(ctx, auction.ID)
		response.ServerError(c, "开始竞拍失败")
		return
	}
	if result.RowsAffected != 1 {
		tx.Rollback()
		h.bidService.CleanupAuctionState(ctx, auction.ID)
		response.BadRequest(c, "竞拍状态已变化，请刷新后重试")
		return
	}
	if err := tx.Commit().Error; err != nil {
		h.bidService.CleanupAuctionState(ctx, auction.ID)
		response.ServerError(c, "开始竞拍失败")
		return
	}

	h.db.Preload("Product").Preload("Room").First(&auction, auction.ID)

	// Start countdown timer
	h.auctionTimer.StartAuctionAt(&auction, scheduledEnd.UnixMilli())

	// Broadcast auction_start to room
	if room := h.hub.GetRoom(auction.RoomID); room != nil {
		endTime := scheduledEnd.UnixMilli()
		room.BroadcastFiltered(func(viewerUserID uint) ws.ServerMessage {
			return ws.ServerMessage{
				Type: ws.MsgAuctionStart,
				Code: 0,
				Data: h.buildAuctionStartPayload(&auction, viewerUserID, endTime),
				Ts:   time.Now().UnixMilli(),
			}
		})
	}

	response.OK(c, map[string]any{
		"status":  newStatus,
		"endTime": scheduledEnd.UnixMilli(),
	})
}

func (h *Handler) buildAuctionStartPayload(auction *model.Auction, viewerUserID uint, endTime int64) map[string]any {
	auctionView := service.BuildAuctionView(auction, viewerUserID)
	auctionView["status"] = auction.Status
	auctionView["endTime"] = endTime
	auctionView["bidCount"] = auction.BidCount
	auctionView["serverTime"] = time.Now().UnixMilli()
	auctionView["depositRequired"] = auction.DepositAmount.IsPositive()
	auctionView["depositAmount"] = auction.DepositAmount.InexactFloat64()

	data := map[string]any{
		"auction":         auctionView,
		"auctionId":       auction.ID,
		"id":              auction.ID,
		"productId":       auction.ProductID,
		"product":         auction.Product,
		"productTitle":    auction.Product.Title,
		"mode":            auction.Mode,
		"status":          auction.Status,
		"startingPrice":   auction.StartingPrice.InexactFloat64(),
		"incrementAmount": auction.IncrementAmount.InexactFloat64(),
		"durationSeconds": auction.DurationSeconds,
		"endTime":         endTime,
		"serverTime":      time.Now().UnixMilli(),
		"depositRequired": auction.DepositAmount.IsPositive(),
		"depositAmount":   auction.DepositAmount.InexactFloat64(),
	}
	if service.CanViewAuctionPrices(auction, viewerUserID) {
		data["currentPrice"] = auction.CurrentPrice.InexactFloat64()
	}
	return data
}

func (h *Handler) CancelAuction(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	merchantID, _ := c.Get("userID")

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	var auction model.Auction
	if err := h.db.First(&auction, id).Error; err != nil {
		response.NotFound(c, "竞拍不存在")
		return
	}
	if auction.MerchantID != merchantID.(uint) {
		response.Forbidden(c, "无权操作")
		return
	}
	if auction.IsTerminal() {
		response.BadRequest(c, "竞拍已结束")
		return
	}

	// Trigger FSM transition
	ctx := c.Request.Context()
	auctionCtx := &service.AuctionContext{Auction: &auction, CancelReason: req.Reason}
	newStatus, err := h.auctionFSM.Trigger(auctionCtx, service.EventCancel)
	if err != nil {
		response.ServerError(c, "状态转换失败: "+err.Error())
		return
	}

	// Update DB
	now := time.Now()
	h.db.Model(&auction).Updates(map[string]interface{}{
		"status":        newStatus,
		"cancel_reason": req.Reason,
		"actual_end":    now,
	})

	// Cancel timer and cleanup Redis
	h.auctionTimer.CancelTimer(auction.ID)
	h.bidService.CleanupAuctionState(ctx, auction.ID)

	// Refund all deposits
	go h.depositService.RefundByAuction(ctx, auction.ID, "AUCTION_CANCELLED")

	// Broadcast auction cancelled
	if room := h.hub.GetRoom(auction.RoomID); room != nil {
		room.Broadcast(ws.ServerMessage{
			Type: ws.MsgAuctionEnd,
			Code: 0,
			Data: map[string]any{
				"auctionId": auction.ID,
				"result":    "cancelled",
				"reason":    req.Reason,
			},
			Ts: time.Now().UnixMilli(),
		})
	}

	response.OKMsg(c, "竞拍已取消")
}
