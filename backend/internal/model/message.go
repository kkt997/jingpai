package model

import "time"

type MessageType string

const (
	MessageTypeText MessageType = "TEXT"
)

type Message struct {
	ID             uint        `gorm:"primaryKey" json:"id"`
	ConversationID uint        `gorm:"not null;index" json:"conversationId"`
	SenderID       uint        `gorm:"not null;index" json:"senderId"`
	Type           MessageType `gorm:"type:varchar(20);not null;default:'TEXT'" json:"type"`
	Content        string      `gorm:"type:text;not null" json:"content"`
	CreatedAt      time.Time   `gorm:"autoCreateTime:milli;index" json:"createdAt"`
	UpdatedAt      time.Time   `gorm:"autoUpdateTime:milli" json:"updatedAt"`

	Conversation Conversation `gorm:"foreignKey:ConversationID" json:"conversation,omitempty"`
	Sender       User         `gorm:"foreignKey:SenderID" json:"sender,omitempty"`
}

func (Message) TableName() string { return "messages" }
