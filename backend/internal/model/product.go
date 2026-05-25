package model

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

type ProductStatus string

const (
	ProductDraft   ProductStatus = "DRAFT"
	ProductListed  ProductStatus = "LISTED"
	ProductSold    ProductStatus = "SOLD"
	ProductRemoved ProductStatus = "REMOVED"
)

type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	return json.Marshal(s)
}

func (s *StringSlice) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, s)
}

type Product struct {
	ID          uint          `gorm:"primaryKey" json:"id"`
	MerchantID  uint          `gorm:"not null;index" json:"merchantId"`
	Title       string        `gorm:"type:varchar(200);not null" json:"title"`
	Description string        `gorm:"type:text" json:"description"`
	Images      StringSlice   `gorm:"type:json;not null" json:"images"`
	Category    string        `gorm:"type:varchar(50)" json:"category"`
	Status      ProductStatus `gorm:"type:enum('DRAFT','LISTED','SOLD','REMOVED');default:'DRAFT';not null" json:"status"`
	CreatedAt   time.Time     `gorm:"autoCreateTime:milli" json:"createdAt"`
	UpdatedAt   time.Time     `gorm:"autoUpdateTime:milli" json:"updatedAt"`

	Merchant User `gorm:"foreignKey:MerchantID" json:"merchant,omitempty"`
}

func (Product) TableName() string { return "products" }
