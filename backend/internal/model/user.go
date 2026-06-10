package model

import "time"

type UserRole string

const (
	RoleUser     UserRole = "USER"
	RoleMerchant UserRole = "MERCHANT"
)

type UserStatus string

const (
	UserActive UserStatus = "ACTIVE"
	UserBanned UserStatus = "BANNED"
)

type User struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	Phone        *string    `gorm:"type:varchar(20);uniqueIndex" json:"phone"`
	Email        *string    `gorm:"type:varchar(100);uniqueIndex" json:"email"`
	Nickname     string     `gorm:"type:varchar(50);not null" json:"nickname"`
	AvatarURL    string     `gorm:"type:varchar(500)" json:"avatarUrl"`
	PasswordHash string     `gorm:"type:varchar(255);not null" json:"-"`
	Role         UserRole   `gorm:"type:enum('USER','MERCHANT');default:'USER';not null" json:"role"`
	Status       UserStatus `gorm:"type:enum('ACTIVE','BANNED');default:'ACTIVE';not null" json:"status"`
	CreatedAt    time.Time  `gorm:"autoCreateTime:milli" json:"createdAt"`
	UpdatedAt    time.Time  `gorm:"autoUpdateTime:milli" json:"updatedAt"`
}

func (User) TableName() string { return "users" }
