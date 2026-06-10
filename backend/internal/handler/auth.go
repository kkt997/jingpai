package handler

import (
	"errors"
	"html"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"jingpai/internal/middleware"
	"jingpai/internal/model"
	"jingpai/internal/pkg/errcode"
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

	req.Nickname = sanitize(req.Nickname)
	if req.Nickname == "" {
		response.BadRequest(c, "昵称不能为空")
		return
	}
	if len([]rune(req.Nickname)) < 2 || len([]rune(req.Nickname)) > 20 {
		response.BadRequest(c, "昵称长度需为 2-20 个字符")
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

	var phone *string
	if req.Phone != "" {
		phone = &req.Phone
	}
	var email *string
	if req.Email != "" {
		email = &req.Email
	}

	user := model.User{
		Phone:        phone,
		Email:        email,
		Nickname:     req.Nickname,
		PasswordHash: string(hash),
		Role:         model.UserRole(req.Role),
	}

	if err := h.db.Create(&user).Error; err != nil {
		var msg string
		switch {
		case req.Phone != "" && isDuplicateEntry(err, "phone"):
			msg = "手机号已注册"
		case req.Email != "" && isDuplicateEntry(err, "email"):
			msg = "邮箱已注册"
		case isDuplicateEntry(err, "nickname"):
			msg = "昵称已被使用"
		case errors.Is(err, gorm.ErrDuplicatedKey):
			msg = "账号信息已存在，请更换后重试"
		default:
			msg = "创建用户失败，请稍后重试"
		}
		response.BadRequest(c, msg)
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

func isDuplicateEntry(err error, field string) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	field = strings.ToLower(field)
	return strings.Contains(msg, "duplicate") && strings.Contains(msg, field) ||
		strings.Contains(msg, "duplicated") && strings.Contains(msg, field) ||
		strings.Contains(msg, "unique") && strings.Contains(msg, field)
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

type SetBalanceRequest struct {
	Balance float64 `json:"balance"`
}

func (h *Handler) SetBalance(c *gin.Context) {
	userID, _ := c.Get("userID")

	var req SetBalanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if req.Balance < 0 {
		response.BadRequest(c, errcode.ErrInvalidBalance.Error())
		return
	}

	balance := decimal.NewFromFloat(req.Balance)
	var user model.User
	if err := h.db.First(&user, userID).Error; err != nil {
		response.NotFound(c, "用户不存在")
		return
	}
	if err := h.db.Model(&user).Update("balance", balance).Error; err != nil {
		response.ServerError(c, "更新余额失败")
		return
	}
	user.Balance = balance

	response.OK(c, user)
}
