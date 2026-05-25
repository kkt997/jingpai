package model

import (
	"time"

	"github.com/shopspring/decimal"
)

type AuctionStatus string

const (
	StatusDraft     AuctionStatus = "DRAFT"
	StatusPending   AuctionStatus = "PENDING"
	StatusActive    AuctionStatus = "ACTIVE"
	StatusExtended  AuctionStatus = "EXTENDED"
	StatusCompleted AuctionStatus = "COMPLETED"
	StatusFailed    AuctionStatus = "FAILED"
	StatusCancelled AuctionStatus = "CANCELLED"
)

type AuctionMode string

const (
	ModeOpen  AuctionMode = "OPEN"
	ModeBlind AuctionMode = "BLIND"
)

type Auction struct {
	ID         uint          `gorm:"primaryKey" json:"id"`
	ProductID  uint          `gorm:"not null;index" json:"productId"`
	RoomID     uint          `gorm:"not null;index" json:"roomId"`
	MerchantID uint          `gorm:"not null;index" json:"merchantId"`
	Mode       AuctionMode   `gorm:"type:enum('OPEN','BLIND');default:'OPEN';not null" json:"mode"`
	Status     AuctionStatus `gorm:"type:enum('DRAFT','PENDING','ACTIVE','EXTENDED','COMPLETED','FAILED','CANCELLED');default:'DRAFT';not null" json:"status"`

	StartingPrice    decimal.Decimal  `gorm:"type:decimal(12,2);not null;default:0" json:"startingPrice"`
	IncrementAmount  decimal.Decimal  `gorm:"type:decimal(12,2);not null" json:"incrementAmount"`
	CeilingPrice     *decimal.Decimal `gorm:"type:decimal(12,2)" json:"ceilingPrice"`
	DurationSeconds  uint             `gorm:"not null" json:"durationSeconds"`
	AutoExtendSeconds uint            `gorm:"not null;default:20" json:"autoExtendSeconds"`

	CurrentPrice decimal.Decimal `gorm:"type:decimal(12,2);not null;default:0" json:"currentPrice"`
	WinnerID     *uint           `json:"winnerId"`
	BidCount     uint            `gorm:"not null;default:0" json:"bidCount"`
	ExtendCount  uint            `gorm:"not null;default:0" json:"extendCount"`

	ScheduledStart *time.Time `gorm:"type:datetime(3)" json:"scheduledStart"`
	ActualStart    *time.Time `gorm:"type:datetime(3)" json:"actualStart"`
	ScheduledEnd   *time.Time `gorm:"type:datetime(3)" json:"scheduledEnd"`
	ActualEnd      *time.Time `gorm:"type:datetime(3)" json:"actualEnd"`
	CancelReason   string     `gorm:"type:varchar(500)" json:"cancelReason,omitempty"`

	CreatedAt time.Time `gorm:"autoCreateTime:milli" json:"createdAt"`
	UpdatedAt time.Time `gorm:"autoUpdateTime:milli" json:"updatedAt"`

	Product  Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Winner   *User    `gorm:"foreignKey:WinnerID" json:"winner,omitempty"`
	Merchant User     `gorm:"foreignKey:MerchantID" json:"merchant,omitempty"`
	Room     LiveRoom `gorm:"foreignKey:RoomID" json:"room,omitempty"`
}

func (Auction) TableName() string { return "auctions" }

func (a *Auction) IsTerminal() bool {
	return a.Status == StatusCompleted || a.Status == StatusFailed || a.Status == StatusCancelled
}

func (a *Auction) IsActive() bool {
	return a.Status == StatusActive || a.Status == StatusExtended
}
