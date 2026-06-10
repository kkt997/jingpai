package ws

import "encoding/json"

// ClientMessage 客户端发送的消息
type ClientMessage struct {
	Type    string          `json:"type"`
	Seq     uint64          `json:"seq"`
	Payload json.RawMessage `json:"payload"`
}

// ServerMessage 服务端发送的消息
type ServerMessage struct {
	Type string `json:"type"`
	Seq  uint64 `json:"seq,omitempty"`
	Code int    `json:"code"`
	Msg  string `json:"msg,omitempty"`
	Data any    `json:"data,omitempty"`
	Ts   int64  `json:"ts"`
}

// C2S message types
const (
	MsgPing      = "ping"
	MsgJoinRoom  = "join_room"
	MsgLeaveRoom = "leave_room"
	MsgBid       = "bid"
	MsgChat      = "chat"
	MsgSyncTime  = "sync_time"
)

// S2C message types
const (
	MsgPong                = "pong"
	MsgRoomState           = "room_state"
	MsgBidResult           = "bid_result"
	MsgNewBid              = "new_bid"
	MsgRankingUpdate       = "ranking_update"
	MsgAuctionStart        = "auction_start"
	MsgAuctionExtend       = "auction_extend"
	MsgAuctionEnd          = "auction_end"
	MsgCountdownSync       = "countdown_sync"
	MsgUserCount           = "user_count"
	MsgTimeSync            = "time_sync"
	MsgError               = "error"
	MsgRankingChange       = "ranking_change"
	MsgChatMessage         = "chat_message"
	MsgDirectMessage       = "direct_message"
	MsgConversationUpdated = "conversation_updated"
	MsgConversationRead    = "conversation_read"
)

// Payload structures
type JoinRoomPayload struct {
	RoomID uint `json:"roomId"`
}

type LeaveRoomPayload struct {
	RoomID uint `json:"roomId"`
}

type BidPayload struct {
	AuctionID uint    `json:"auctionId"`
	Amount    float64 `json:"amount"`
}

type ChatPayload struct {
	Message string `json:"message"`
}

type SyncTimePayload struct {
	ClientTs int64 `json:"clientTs"`
}
