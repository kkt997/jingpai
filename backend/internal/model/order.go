package model

import (
	"time"

	"github.com/shopspring/decimal"
)

type OrderStatus string

const (
	OrderPendingPayment OrderStatus = "PENDING_PAYMENT"
	OrderPaid           OrderStatus = "PAID"
	OrderShipped        OrderStatus = "SHIPPED"
	OrderCompleted      OrderStatus = "COMPLETED"
	OrderCancelled      OrderStatus = "CANCELLED"
)

type Order struct {
	ID         uint            `gorm:"primaryKey" json:"id"`
	OrderNo    string          `gorm:"type:varchar(32);uniqueIndex;not null" json:"orderNo"`
	AuctionID  uint            `gorm:"not null;index" json:"auctionId"`
	BuyerID    uint            `gorm:"not null;index" json:"buyerId"`
	SellerID   uint            `gorm:"not null;index" json:"sellerId"`
	ProductID  uint            `gorm:"not null" json:"productId"`
	FinalPrice decimal.Decimal `gorm:"type:decimal(12,2);not null" json:"finalPrice"`
	Status     OrderStatus     `gorm:"type:enum('PENDING_PAYMENT','PAID','SHIPPED','COMPLETED','CANCELLED');default:'PENDING_PAYMENT';not null" json:"status"`

	PaymentTime *time.Time `gorm:"type:datetime(3)" json:"paymentTime"`
	ExpireTime  time.Time  `gorm:"type:datetime(3);not null" json:"expireTime"`
	CreatedAt   time.Time  `gorm:"autoCreateTime:milli" json:"createdAt"`
	UpdatedAt   time.Time  `gorm:"autoUpdateTime:milli" json:"updatedAt"`

	Auction Auction `gorm:"foreignKey:AuctionID" json:"auction,omitempty"`
	Buyer   User    `gorm:"foreignKey:BuyerID" json:"buyer,omitempty"`
	Seller  User    `gorm:"foreignKey:SellerID" json:"seller,omitempty"`
	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

func (Order) TableName() string { return "orders" }
