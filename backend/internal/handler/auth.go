package handler

import (
	"html"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"jingpai/internal/middleware"
	"jingpai/internal/model"
	"jingpai/internal/pkg/response"
)

var htmlTagRegex = regexp.MustCompile(`<[^>]*>`)

// sanitize removes HTML tags and escapes special characters to prevent stored XSS
func sanitize(s string) string {
	s = htmlTagRegex.ReplaceAllString(s, "")
	s = html.EscapeString(s)
	s = strings.TrimSpace(s)
	return s
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

type RegisterRequest struct {
	Phone    string `json:"phone"`
	Email    string `json:"email"`
	Nickname string `json:"nickname" binding:"required,min=2,max=20"`
	Password string `json:"password" binding:"required,min=6"`
	Role     string `json:"role" binding:"required,oneof=USER MERCHANT"`
}

type LoginRequest struct {
	Account  string `json:"account" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	req.Phone = strings.TrimSpace(req.Phone)
	req.Email = strings.TrimSpace(req.Email)

	if req.Phone == "" && req.Email == "" {
		response.BadRequest(c, "手机号和邮箱至少填写一项")
		return
	}
	if req.Phone != "" && len(req.Phone) != 11 {
		response.BadRequest(c, "手机号格式不正确")
		return
	}
	if req.Email != "" && !emailRegex.MatchString(req.Email) {
		response.BadRequest(c, "邮箱格式不正确")
		return
	}

	if req.Phone != "" {
		var exists model.User
		if err := h.db.Where("phone = ?", req.Phone).First(&exists).Error; err == nil {
			response.BadRequest(c, "手机号已注册")
			return
		}
	}
	if req.Email != "" {
		var exists model.User
		if err := h.db.Where("email = ?", req.Email).First(&exists).Error; err == nil {
			response.BadRequest(c, "邮箱已注册")
			return
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.ServerError(c, "服务器错误")
		return
	}

	user := model.User{
		Phone:        req.Phone,
		Email:        req.Email,
		Nickname:     sanitize(req.Nickname),
		PasswordHash: string(hash),
		Role:         model.UserRole(req.Role),
	}

	if err := h.db.Create(&user).Error; err != nil {
		response.ServerError(c, "创建用户失败")
		return
	}

	token, err := middleware.GenerateToken(user.ID, string(user.Role))
	if err != nil {
		response.ServerError(c, "生成token失败")
		return
	}

	response.OK(c, gin.H{
		"user":  user,
		"token": token,
	})
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	var user model.User
	account := strings.TrimSpace(req.Account)

	if emailRegex.MatchString(account) {
		if err := h.db.Where("email = ?", account).First(&user).Error; err != nil {
			response.BadRequest(c, "用户不存在")
			return
		}
	} else {
		if err := h.db.Where("phone = ?", account).First(&user).Error; err != nil {
			response.BadRequest(c, "用户不存在")
			return
		}
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		response.BadRequest(c, "密码错误")
		return
	}

	token, err := middleware.GenerateToken(user.ID, string(user.Role))
	if err != nil {
		response.ServerError(c, "生成token失败")
		return
	}

	response.OK(c, gin.H{
		"user":  user,
		"token": token,
	})
}

func (h *Handler) GetProfile(c *gin.Context) {
	userID, _ := c.Get("userID")
	var user model.User
	if err := h.db.First(&user, userID).Error; err != nil {
		response.NotFound(c, "用户不存在")
		return
	}
	response.OK(c, user)
}
