package model

import "time"

type ConversationKind string

const (
	ConversationKindDirect ConversationKind = "DIRECT"
)

type Conversation struct {
	ID            uint             `gorm:"primaryKey" json:"id"`
	Kind          ConversationKind `gorm:"type:varchar(20);not null;default:'DIRECT'" json:"kind"`
	UserAID       uint             `gorm:"not null;uniqueIndex:idx_conversation_pair" json:"userAId"`
	UserBID       uint             `gorm:"not null;uniqueIndex:idx_conversation_pair" json:"userBId"`
	LastMessageID *uint            `gorm:"index" json:"lastMessageId,omitempty"`
	LastMessageAt *time.Time       `gorm:"type:datetime(3);index" json:"lastMessageAt,omitempty"`
	CreatedAt     time.Time        `gorm:"autoCreateTime:milli" json:"createdAt"`
	UpdatedAt     time.Time        `gorm:"autoUpdateTime:milli" json:"updatedAt"`

	UserA       User                      `gorm:"foreignKey:UserAID" json:"userA,omitempty"`
	UserB       User                      `gorm:"foreignKey:UserBID" json:"userB,omitempty"`
	LastMessage *Message                  `gorm:"foreignKey:LastMessageID" json:"lastMessage,omitempty"`
	Participants []ConversationParticipant `gorm:"foreignKey:ConversationID" json:"participants,omitempty"`
}

func (Conversation) TableName() string { return "conversations" }
