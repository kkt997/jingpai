package model

import "time"

type Follow struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	FollowerID   uint      `gorm:"not null;uniqueIndex:idx_follower_target" json:"followerId"`
	TargetUserID uint      `gorm:"not null;uniqueIndex:idx_follower_target;index" json:"targetUserId"`
	CreatedAt    time.Time `gorm:"autoCreateTime:milli" json:"createdAt"`

	Follower   User `gorm:"foreignKey:FollowerID" json:"follower,omitempty"`
	TargetUser User `gorm:"foreignKey:TargetUserID" json:"targetUser,omitempty"`
}

func (Follow) TableName() string { return "follows" }
