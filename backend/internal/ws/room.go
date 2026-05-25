package ws

import (
	"encoding/json"
	"sync"
	"time"

	"go.uber.org/zap"
)

type Room struct {
	ID      uint
	clients map[*Client]bool
	mu      sync.RWMutex
}

func NewRoom(id uint) *Room {
	return &Room{
		ID:      id,
		clients: make(map[*Client]bool),
	}
}

func (r *Room) AddClient(c *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clients[c] = true
	c.RoomID = r.ID
}

func (r *Room) RemoveClient(c *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.clients, c)
}

func (r *Room) ClientCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients)
}

// Broadcast 向房间内所有人发送相同消息（明拍模式）
func (r *Room) Broadcast(msg ServerMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		zap.L().Error("marshal broadcast message failed", zap.Error(err))
		return
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	for client := range r.clients {
		select {
		case client.send <- data:
		default:
			zap.L().Warn("broadcast: client buffer full", zap.Uint("userId", client.UserID))
		}
	}
}

// BroadcastFiltered 向房间内每个人发送定制化消息（盲拍模式）
func (r *Room) BroadcastFiltered(builder func(viewerUserID uint) ServerMessage) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for client := range r.clients {
		msg := builder(client.UserID)
		data, err := json.Marshal(msg)
		if err != nil {
			continue
		}
		select {
		case client.send <- data:
		default:
		}
	}
}

// SendToUser 向特定用户发送消息
func (r *Room) SendToUser(userID uint, msg ServerMessage) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for client := range r.clients {
		if client.UserID == userID {
			client.SendMessage(msg)
		}
	}
}

// BroadcastUserCount 广播在线人数
func (r *Room) BroadcastUserCount() {
	count := r.ClientCount()
	r.Broadcast(ServerMessage{
		Type: MsgUserCount,
		Code: 0,
		Data: map[string]any{"count": count},
		Ts:   time.Now().UnixMilli(),
	})
}

// CountUserConnections 统计某个用户在该房间的连接数
func (r *Room) CountUserConnections(userID uint) int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	count := 0
	for client := range r.clients {
		if client.UserID == userID {
			count++
		}
	}
	return count
}
