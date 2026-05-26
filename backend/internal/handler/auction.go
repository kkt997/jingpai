package handler

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

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

	// Blind mode desensitization for non-merchant viewers
	userID, _ := c.Get("userID")
	uid := userID.(uint)
	for i := range auctions {
		if auctions[i].Mode == model.ModeBlind && !auctions[i].IsTerminal() && auctions[i].MerchantID != uid {
			auctions[i].CurrentPrice = decimal.Zero
			auctions[i].WinnerID = nil
		}
	}

	response.OK(c, auctions)
}

func (h *Handler) GetAuction(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var auction model.Auction
	if err := h.db.Preload("Product").Preload("Room").First(&auction, id).Error; err != nil {
		response.NotFound(c, "竞拍不存在")
		return
	}

	// Blind mode: hide current price and winner from non-owners while active
	if auction.Mode == model.ModeBlind && !auction.IsTerminal() {
		userID, _ := c.Get("userID")
		if userID.(uint) != auction.MerchantID {
			auction.CurrentPrice = decimal.Zero
			auction.WinnerID = nil
		}
	}

	response.OK(c, auction)
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

	var auction model.Auction
	if err := h.db.First(&auction, id).Error; err != nil {
		response.NotFound(c, "竞拍不存在")
		return
	}
	if auction.MerchantID != merchantID.(uint) {
		response.Forbidden(c, "无权操作")
		return
	}
	if auction.Status != model.StatusPending {
		response.BadRequest(c, "竞拍状态不允许开始")
		return
	}

	// Trigger FSM transition
	ctx := c.Request.Context()
	auctionCtx := &service.AuctionContext{Auction: &auction}
	newStatus, err := h.auctionFSM.Trigger(auctionCtx, service.EventStart)
	if err != nil {
		response.ServerError(c, "状态转换失败: "+err.Error())
		return
	}

	// Update DB status + actual start time
	now := time.Now()
	h.db.Model(&auction).Updates(map[string]interface{}{
		"status":       newStatus,
		"actual_start": now,
	})

	// Initialize Redis auction state
	if err := h.bidService.InitAuctionState(ctx, &auction); err != nil {
		response.ServerError(c, "初始化竞拍状态失败")
		return
	}
	h.bidService.SetAuctionParams(ctx, &auction)

	// Start countdown timer
	h.auctionTimer.StartAuction(&auction)

	// Broadcast auction_start to room
	if room := h.hub.GetRoom(auction.RoomID); room != nil {
		room.Broadcast(ws.ServerMessage{
			Type: ws.MsgAuctionStart,
			Code: 0,
			Data: map[string]any{
				"auctionId":       auction.ID,
				"productId":       auction.ProductID,
				"mode":            auction.Mode,
				"startingPrice":   auction.StartingPrice.InexactFloat64(),
				"incrementAmount": auction.IncrementAmount.InexactFloat64(),
				"durationSeconds": auction.DurationSeconds,
				"endTime":         h.auctionTimer.GetEndTime(auction.ID),
				"serverTime":      time.Now().UnixMilli(),
				"depositRequired": auction.DepositAmount.IsPositive(),
				"depositAmount":   auction.DepositAmount.InexactFloat64(),
			},
			Ts: time.Now().UnixMilli(),
		})
	}

	response.OK(c, map[string]any{
		"status":  newStatus,
		"endTime": h.auctionTimer.GetEndTime(auction.ID),
	})
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
	go h.depositService.RefundByAuction(ctx, auction.ID, 0)

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
