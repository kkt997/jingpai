package model

import "time"

type ConversationParticipant struct {
	ID                uint       `gorm:"primaryKey" json:"id"`
	ConversationID    uint       `gorm:"not null;uniqueIndex:idx_conversation_user" json:"conversationId"`
	UserID            uint       `gorm:"not null;uniqueIndex:idx_conversation_user;index" json:"userId"`
	LastReadMessageID *uint      `gorm:"index" json:"lastReadMessageId,omitempty"`
	LastReadAt        *time.Time `gorm:"type:datetime(3)" json:"lastReadAt,omitempty"`
	Muted             bool       `gorm:"not null;default:false" json:"muted"`
	CreatedAt         time.Time  `gorm:"autoCreateTime:milli" json:"createdAt"`
	UpdatedAt         time.Time  `gorm:"autoUpdateTime:milli" json:"updatedAt"`

	Conversation Conversation `gorm:"foreignKey:ConversationID" json:"conversation,omitempty"`
	User         User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	LastReadMessage *Message  `gorm:"foreignKey:LastReadMessageID" json:"lastReadMessage,omitempty"`
}

func (ConversationParticipant) TableName() string { return "conversation_participants" }
