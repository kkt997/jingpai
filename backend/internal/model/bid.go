package model

import (
	"time"

	"github.com/shopspring/decimal"
)

type Bid struct {
	ID         uint            `gorm:"primaryKey" json:"id"`
	AuctionID  uint            `gorm:"not null;index:idx_auction_amount" json:"auctionId"`
	UserID     uint            `gorm:"not null;index:idx_user_auction" json:"userId"`
	Amount     decimal.Decimal `gorm:"type:decimal(12,2);not null" json:"amount"`
	BidTime    time.Time       `gorm:"type:datetime(3);not null" json:"bidTime"`
	IsWinning  bool            `gorm:"not null;default:false" json:"isWinning"`
	PersistKey string          `gorm:"type:varchar(128);uniqueIndex" json:"-"`
	CreatedAt  time.Time       `gorm:"autoCreateTime:milli" json:"createdAt"`

	User    User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Auction Auction `gorm:"foreignKey:AuctionID" json:"auction,omitempty"`
}

func (Bid) TableName() string { return "bids" }
