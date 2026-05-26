package ws

import (
	"encoding/json"
	"sync"
	"time"

	"go.uber.org/zap"

	"jingpai/internal/metrics"
)

type Hub struct {
	rooms      map[uint]*Room
	clients    map[*Client]bool
	Register   chan *Client
	Unregister chan *Client
	mu         sync.RWMutex
	msgHandler MessageHandler
}

type MessageHandler interface {
	OnJoinRoom(client *Client, payload *JoinRoomPayload) error
	OnLeaveRoom(client *Client, payload *LeaveRoomPayload) error
	OnBid(client *Client, payload *BidPayload) error
}

func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[uint]*Room),
		clients:    make(map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
}

func (h *Hub) SetMessageHandler(handler MessageHandler) {
	h.msgHandler = handler
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			metrics.WsConnectionsActive.Inc()
			zap.L().Info("client connected", zap.Uint("userId", client.UserID))

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
				metrics.WsConnectionsActive.Dec()

				if client.RoomID > 0 {
					if room, ok := h.rooms[client.RoomID]; ok {
						room.RemoveClient(client)
						go room.BroadcastUserCount()
						if room.ClientCount() == 0 {
							delete(h.rooms, client.RoomID)
						}
					}
				}
			}
			h.mu.Unlock()
			zap.L().Info("client disconnected", zap.Uint("userId", client.UserID))
		}
	}
}

func (h *Hub) GetOrCreateRoom(roomID uint) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	if room, ok := h.rooms[roomID]; ok {
		return room
	}
	room := NewRoom(roomID)
	h.rooms[roomID] = room
	return room
}

func (h *Hub) GetRoom(roomID uint) *Room {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.rooms[roomID]
}

func (h *Hub) CountUserTotal(userID uint) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	count := 0
	for client := range h.clients {
		if client.UserID == userID {
			count++
		}
	}
	return count
}

func (h *Hub) HandleMessage(client *Client, msg *ClientMessage) {
	metrics.WsMessagesTotal.WithLabelValues(msg.Type, "inbound").Inc()

	switch msg.Type {
	case MsgPing:
		client.SendMessage(ServerMessage{
			Type: MsgPong,
			Seq:  msg.Seq,
			Code: 0,
			Ts:   time.Now().UnixMilli(),
		})

	case MsgJoinRoom:
		var payload JoinRoomPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			client.SendMessage(ServerMessage{Type: MsgError, Seq: msg.Seq, Code: 4010, Msg: "invalid payload", Ts: time.Now().UnixMilli()})
			return
		}
		if h.msgHandler != nil {
			h.msgHandler.OnJoinRoom(client, &payload)
		}

	case MsgLeaveRoom:
		var payload LeaveRoomPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if h.msgHandler != nil {
			h.msgHandler.OnLeaveRoom(client, &payload)
		}

	case MsgBid:
		var payload BidPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			client.SendMessage(ServerMessage{Type: MsgError, Seq: msg.Seq, Code: 4010, Msg: "invalid payload", Ts: time.Now().UnixMilli()})
			return
		}
		if h.msgHandler != nil {
			h.msgHandler.OnBid(client, &payload)
		}

	case MsgSyncTime:
		var payload SyncTimePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		client.SendMessage(ServerMessage{
			Type: MsgTimeSync,
			Seq:  msg.Seq,
			Code: 0,
			Data: map[string]any{
				"clientTs": payload.ClientTs,
				"serverTs": time.Now().UnixMilli(),
			},
			Ts: time.Now().UnixMilli(),
		})
	}
}
