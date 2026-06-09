package handler

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"jingpai/internal/model"
	"jingpai/internal/pkg/response"
)

type CreateRoomRequest struct {
	Title     string `json:"title" binding:"required,max=200"`
	CoverURL  string `json:"coverUrl"`
	StreamURL string `json:"streamUrl"`
}

func (h *Handler) CreateRoom(c *gin.Context) {
	var req CreateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	merchantID, _ := c.Get("userID")
	room := model.LiveRoom{
		MerchantID: merchantID.(uint),
		Title:      req.Title,
		CoverURL:   req.CoverURL,
		StreamURL:  req.StreamURL,
		Status:     model.RoomPreparing,
	}

	if err := h.db.Create(&room).Error; err != nil {
		response.ServerError(c, "创建直播间失败")
		return
	}
	response.OK(c, room)
}

func (h *Handler) ListRooms(c *gin.Context) {
	var rooms []model.LiveRoom
	query := h.db.Order("created_at DESC")
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	query.Find(&rooms)
	response.OK(c, rooms)
}

func (h *Handler) GetRoom(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var room model.LiveRoom
	if err := h.db.First(&room, id).Error; err != nil {
		response.NotFound(c, "直播间不存在")
		return
	}
	response.OK(c, room)
}

func (h *Handler) StartRoom(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	merchantID, _ := c.Get("userID")

	var room model.LiveRoom
	if err := h.db.First(&room, id).Error; err != nil {
		response.NotFound(c, "直播间不存在")
		return
	}
	if room.MerchantID != merchantID.(uint) {
		response.Forbidden(c, "无权操作")
		return
	}

	now := time.Now()
	room.Status = model.RoomLive
	room.StartedAt = &now
	h.db.Save(&room)
	response.OK(c, room)
}

func (h *Handler) EndRoom(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	merchantID, _ := c.Get("userID")

	var room model.LiveRoom
	if err := h.db.First(&room, id).Error; err != nil {
		response.NotFound(c, "直播间不存在")
		return
	}
	if room.MerchantID != merchantID.(uint) {
		response.Forbidden(c, "无权操作")
		return
	}

	now := time.Now()
	room.Status = model.RoomEnded
	room.EndedAt = &now
	h.db.Save(&room)
	go h.depositService.RefundByRoomEnd(c.Request.Context(), room.ID)
	response.OK(c, room)
}
