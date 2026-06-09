package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"jingpai/internal/pkg/response"
)

func (h *Handler) PayDeposit(c *gin.Context) {
	auctionID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	userID, _ := c.Get("userID")

	deposit, err := h.depositService.Freeze(c.Request.Context(), userID.(uint), uint(auctionID))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, deposit)
}

func (h *Handler) RefundDeposit(c *gin.Context) {
	auctionID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	userID, _ := c.Get("userID")

	deposit, err := h.depositService.Refund(c.Request.Context(), userID.(uint), uint(auctionID), "USER_REQUEST")
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, deposit)
}

func (h *Handler) GetDepositStatus(c *gin.Context) {
	auctionID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	userID, _ := c.Get("userID")
	ctx := c.Request.Context()

	response.OK(c, h.depositService.GetDepositStatus(ctx, userID.(uint), uint(auctionID)))
}

func (h *Handler) ListUserDeposits(c *gin.Context) {
	userID, _ := c.Get("userID")
	deposits := h.depositService.GetUserDeposits(c.Request.Context(), userID.(uint))
	response.OK(c, deposits)
}
