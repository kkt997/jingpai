package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"jingpai/internal/ws"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (h *Handler) HandleWebSocket(c *gin.Context) {
	userID, _ := c.Get("userID")

	// Connection guard
	totalConns := h.hub.CountUserTotal(userID.(uint))
	if totalConns >= 10 {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "连接数超限"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		zap.L().Error("websocket upgrade failed", zap.Error(err))
		return
	}

	client := ws.NewClient(h.hub, conn, userID.(uint))
	h.hub.Register <- client

	go client.WritePump()
	go client.ReadPump()
}
