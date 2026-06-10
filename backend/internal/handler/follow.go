package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"jingpai/internal/model"
	"jingpai/internal/pkg/response"
)

type followRequest struct {
	TargetUserID uint `json:"targetUserId" binding:"required"`
}

type followSummary struct {
	ID          uint            `json:"id"`
	Nickname    string          `json:"nickname"`
	AvatarURL   string          `json:"avatarUrl"`
	Role        model.UserRole  `json:"role"`
	CreatedAt   any             `json:"createdAt,omitempty"`
	FollowedAt  any             `json:"followedAt,omitempty"`
}

func (h *Handler) FollowUser(c *gin.Context) {
	userID := c.GetUint("userID")

	var req followRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if req.TargetUserID == userID {
		response.BadRequest(c, "不能关注自己")
		return
	}

	var target model.User
	if err := h.db.Select("id, role, status").First(&target, req.TargetUserID).Error; err != nil {
		response.NotFound(c, "目标用户不存在")
		return
	}
	if target.Status != model.UserActive {
		response.BadRequest(c, "目标用户不可关注")
		return
	}

	follow := model.Follow{FollowerID: userID, TargetUserID: req.TargetUserID}
	if err := h.db.Where("follower_id = ? AND target_user_id = ?", userID, req.TargetUserID).FirstOrCreate(&follow).Error; err != nil {
		response.ServerError(c, "关注失败")
		return
	}

	response.OK(c, gin.H{"targetUserId": req.TargetUserID, "isFollowing": true})
}

func (h *Handler) UnfollowUser(c *gin.Context) {
	userID := c.GetUint("userID")
	targetUserID, _ := strconv.ParseUint(c.Param("targetUserId"), 10, 64)
	if targetUserID == 0 {
		response.BadRequest(c, "目标用户无效")
		return
	}

	if err := h.db.Where("follower_id = ? AND target_user_id = ?", userID, uint(targetUserID)).Delete(&model.Follow{}).Error; err != nil {
		response.ServerError(c, "取消关注失败")
		return
	}

	response.OK(c, gin.H{"targetUserId": uint(targetUserID), "isFollowing": false})
}

func (h *Handler) GetFollowing(c *gin.Context) {
	userID := c.GetUint("userID")

	var follows []model.Follow
	if err := h.db.
		Preload("TargetUser").
		Where("follower_id = ?", userID).
		Order("created_at DESC").
		Find(&follows).Error; err != nil {
		response.ServerError(c, "获取关注列表失败")
		return
	}

	items := make([]gin.H, 0, len(follows))
	for _, follow := range follows {
		items = append(items, gin.H{
			"id":         follow.TargetUser.ID,
			"nickname":   follow.TargetUser.Nickname,
			"avatarUrl":  follow.TargetUser.AvatarURL,
			"role":       follow.TargetUser.Role,
			"followedAt": follow.CreatedAt,
		})
	}

	response.OK(c, items)
}

func (h *Handler) GetFollowers(c *gin.Context) {
	userID := c.GetUint("userID")

	var follows []model.Follow
	if err := h.db.
		Preload("Follower").
		Where("target_user_id = ?", userID).
		Order("created_at DESC").
		Find(&follows).Error; err != nil {
		response.ServerError(c, "获取粉丝列表失败")
		return
	}

	items := make([]gin.H, 0, len(follows))
	for _, follow := range follows {
		items = append(items, gin.H{
			"id":         follow.Follower.ID,
			"nickname":   follow.Follower.Nickname,
			"avatarUrl":  follow.Follower.AvatarURL,
			"role":       follow.Follower.Role,
			"followedAt": follow.CreatedAt,
		})
	}

	response.OK(c, items)
}

func (h *Handler) GetFollowStatus(c *gin.Context) {
	currentUserID := c.GetUint("userID")
	targetUserID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if targetUserID == 0 {
		response.BadRequest(c, "目标用户无效")
		return
	}

	var target model.User
	if err := h.db.Select("id").First(&target, uint(targetUserID)).Error; err != nil {
		response.NotFound(c, "目标用户不存在")
		return
	}

	var follow model.Follow
	isFollowing := h.db.Where("follower_id = ? AND target_user_id = ?", currentUserID, uint(targetUserID)).First(&follow).Error == nil

	var followerCount int64
	h.db.Model(&model.Follow{}).Where("target_user_id = ?", uint(targetUserID)).Count(&followerCount)

	var followingCount int64
	h.db.Model(&model.Follow{}).Where("follower_id = ?", uint(targetUserID)).Count(&followingCount)

	response.OK(c, gin.H{
		"targetUserId":   uint(targetUserID),
		"isFollowing":    isFollowing,
		"followerCount":  followerCount,
		"followingCount": followingCount,
	})
}

func (h *Handler) GetUserPublicProfile(c *gin.Context) {
	userID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if userID == 0 {
		response.BadRequest(c, "用户无效")
		return
	}

	target, followerCount, followingCount, isFollowing, err := h.loadPublicProfile(c, uint(userID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			response.NotFound(c, "用户不存在")
			return
		}
		response.ServerError(c, "获取用户资料失败")
		return
	}

	response.OK(c, gin.H{
		"id":             target.ID,
		"nickname":       target.Nickname,
		"avatarUrl":      target.AvatarURL,
		"role":           target.Role,
		"createdAt":      target.CreatedAt,
		"followerCount":  followerCount,
		"followingCount": followingCount,
		"isFollowing":    isFollowing,
	})
}

func (h *Handler) GetMerchantPublicProfile(c *gin.Context) {
	userID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if userID == 0 {
		response.BadRequest(c, "商家无效")
		return
	}

	target, followerCount, followingCount, isFollowing, err := h.loadPublicProfile(c, uint(userID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			response.NotFound(c, "商家不存在")
			return
		}
		response.ServerError(c, "获取商家资料失败")
		return
	}
	if target.Role != model.RoleMerchant {
		response.BadRequest(c, "目标不是商家")
		return
	}

	var productCount int64
	h.db.Model(&model.Product{}).Where("merchant_id = ? AND status != ?", target.ID, "REMOVED").Count(&productCount)

	response.OK(c, gin.H{
		"id":             target.ID,
		"nickname":       target.Nickname,
		"avatarUrl":      target.AvatarURL,
		"role":           target.Role,
		"createdAt":      target.CreatedAt,
		"followerCount":  followerCount,
		"followingCount": followingCount,
		"isFollowing":    isFollowing,
		"productCount":   productCount,
	})
}

func (h *Handler) loadPublicProfile(c *gin.Context, targetUserID uint) (model.User, int64, int64, bool, error) {
	currentUserID := c.GetUint("userID")

	var target model.User
	if err := h.db.Select("id, nickname, avatar_url, role, created_at, status").First(&target, targetUserID).Error; err != nil {
		return model.User{}, 0, 0, false, err
	}

	var followerCount int64
	h.db.Model(&model.Follow{}).Where("target_user_id = ?", targetUserID).Count(&followerCount)

	var followingCount int64
	h.db.Model(&model.Follow{}).Where("follower_id = ?", targetUserID).Count(&followingCount)

	var follow model.Follow
	isFollowing := h.db.Where("follower_id = ? AND target_user_id = ?", currentUserID, targetUserID).First(&follow).Error == nil

	return target, followerCount, followingCount, isFollowing, nil
}

func (h *Handler) GetMerchantFollowers(c *gin.Context) {
	userID := c.GetUint("userID")

	var follows []model.Follow
	if err := h.db.
		Preload("Follower").
		Where("target_user_id = ?", userID).
		Order("created_at DESC").
		Find(&follows).Error; err != nil {
		response.ServerError(c, "获取粉丝列表失败")
		return
	}

	items := make([]gin.H, 0, len(follows))
	for _, follow := range follows {
		items = append(items, gin.H{
			"id":         follow.Follower.ID,
			"nickname":   follow.Follower.Nickname,
			"avatarUrl":  follow.Follower.AvatarURL,
			"role":       follow.Follower.Role,
			"followedAt": follow.CreatedAt,
		})
	}

	response.OK(c, items)
}

func writeCreated(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, gin.H{"code": 0, "msg": "ok", "data": data})
}
