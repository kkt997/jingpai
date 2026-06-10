package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"jingpai/internal/model"
	"jingpai/internal/pkg/response"
)

type CreateProductRequest struct {
	Title       string   `json:"title" binding:"required,max=200"`
	Description string   `json:"description"`
	Images      []string `json:"images" binding:"required,min=1"`
	Category    string   `json:"category"`
}

func (h *Handler) CreateProduct(c *gin.Context) {
	var req CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	merchantID, _ := c.Get("userID")
	product := model.Product{
		MerchantID:  merchantID.(uint),
		Title:       sanitize(req.Title),
		Description: sanitize(req.Description),
		Images:      model.StringSlice(req.Images),
		Category:    sanitize(req.Category),
		Status:      model.ProductDraft,
	}

	if err := h.db.Create(&product).Error; err != nil {
		response.ServerError(c, "创建商品失败")
		return
	}
	response.OK(c, product)
}

func (h *Handler) ListMerchantProducts(c *gin.Context) {
	merchantID, _ := c.Get("userID")
	var products []model.Product
	h.db.Where("merchant_id = ?", merchantID).Order("created_at DESC").Find(&products)
	response.OK(c, products)
}

func (h *Handler) GetProduct(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)

	var product model.Product
	if err := h.db.First(&product, id).Error; err != nil {
		response.NotFound(c, "商品不存在")
		return
	}
	if product.Status == model.ProductRemoved {
		response.NotFound(c, "商品不存在")
		return
	}

	response.OK(c, product)
}

func (h *Handler) UpdateProduct(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	merchantID, _ := c.Get("userID")

	var product model.Product
	if err := h.db.First(&product, id).Error; err != nil {
		response.NotFound(c, "商品不存在")
		return
	}
	if product.MerchantID != merchantID.(uint) {
		response.Forbidden(c, "无权修改")
		return
	}

	var req CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	product.Title = sanitize(req.Title)
	product.Description = sanitize(req.Description)
	product.Images = model.StringSlice(req.Images)
	product.Category = sanitize(req.Category)
	h.db.Save(&product)

	response.OK(c, product)
}

func (h *Handler) DeleteProduct(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	merchantID, _ := c.Get("userID")

	var product model.Product
	if err := h.db.First(&product, id).Error; err != nil {
		response.NotFound(c, "商品不存在")
		return
	}
	if product.MerchantID != merchantID.(uint) {
		response.Forbidden(c, "无权删除")
		return
	}

	product.Status = model.ProductRemoved
	h.db.Save(&product)
	response.OKMsg(c, "已删除")
}

func (h *Handler) ListProduct(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	merchantID, _ := c.Get("userID")

	var product model.Product
	if err := h.db.First(&product, id).Error; err != nil {
		response.NotFound(c, "商品不存在")
		return
	}
	if product.MerchantID != merchantID.(uint) {
		response.Forbidden(c, "无权操作")
		return
	}
	if product.Status != model.ProductDraft {
		response.BadRequest(c, "仅草稿状态可上架")
		return
	}

	product.Status = model.ProductListed
	h.db.Save(&product)
	response.OK(c, product)
}

func (h *Handler) UnlistProduct(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	merchantID, _ := c.Get("userID")

	var product model.Product
	if err := h.db.First(&product, id).Error; err != nil {
		response.NotFound(c, "商品不存在")
		return
	}
	if product.MerchantID != merchantID.(uint) {
		response.Forbidden(c, "无权操作")
		return
	}
	if product.Status != model.ProductListed {
		response.BadRequest(c, "仅上架中可下架")
		return
	}

	// Prevent unlisting if product has active auction
	var activeCount int64
	h.db.Model(&model.Auction{}).
		Where("product_id = ? AND status IN ?", product.ID, []string{"PENDING", "ACTIVE", "EXTENDED"}).
		Count(&activeCount)
	if activeCount > 0 {
		response.BadRequest(c, "商品有进行中的竞拍，无法下架")
		return
	}

	product.Status = model.ProductDraft
	h.db.Save(&product)
	response.OK(c, product)
}
