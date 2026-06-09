package model

import (
	"time"

	"github.com/shopspring/decimal"
)

type DepositStatus string

const (
	DepositFrozen   DepositStatus = "FROZEN"
	DepositDeducted DepositStatus = "DEDUCTED"
	DepositRefunded DepositStatus = "REFUNDED"
)

type Deposit struct {
	ID           uint            `gorm:"primaryKey" json:"id"`
	UserID       uint            `gorm:"not null;uniqueIndex:idx_user_auction" json:"userId"`
	AuctionID    uint            `gorm:"not null;uniqueIndex:idx_user_auction" json:"auctionId"`
	Amount       decimal.Decimal `gorm:"type:decimal(12,2);not null" json:"amount"`
	Status       DepositStatus   `gorm:"type:enum('FROZEN','DEDUCTED','REFUNDED');default:'FROZEN';not null" json:"status"`
	RefundReason string          `gorm:"type:varchar(50)" json:"refundReason,omitempty"`
	RefundedAt   *time.Time      `gorm:"type:datetime(3)" json:"refundedAt,omitempty"`
	DeductedAt   *time.Time      `gorm:"type:datetime(3)" json:"deductedAt,omitempty"`
	CreatedAt    time.Time       `gorm:"autoCreateTime:milli" json:"createdAt"`
	UpdatedAt    time.Time       `gorm:"autoUpdateTime:milli" json:"updatedAt"`

	User    User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Auction Auction `gorm:"foreignKey:AuctionID" json:"auction,omitempty"`
}

func (Deposit) TableName() string { return "deposits" }
