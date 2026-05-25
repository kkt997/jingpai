package model

import "time"

type RoomStatus string

const (
	RoomPreparing RoomStatus = "PREPARING"
	RoomLive      RoomStatus = "LIVE"
	RoomEnded     RoomStatus = "ENDED"
)

type LiveRoom struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	MerchantID  uint       `gorm:"not null;index" json:"merchantId"`
	Title       string     `gorm:"type:varchar(200);not null" json:"title"`
	CoverURL    string     `gorm:"type:varchar(500)" json:"coverUrl"`
	StreamURL   string     `gorm:"type:varchar(500)" json:"streamUrl"`
	Status      RoomStatus `gorm:"type:enum('PREPARING','LIVE','ENDED');default:'PREPARING';not null" json:"status"`
	OnlineCount uint       `gorm:"not null;default:0" json:"onlineCount"`
	StartedAt   *time.Time `gorm:"type:datetime(3)" json:"startedAt"`
	EndedAt     *time.Time `gorm:"type:datetime(3)" json:"endedAt"`
	CreatedAt   time.Time  `gorm:"autoCreateTime:milli" json:"createdAt"`
	UpdatedAt   time.Time  `gorm:"autoUpdateTime:milli" json:"updatedAt"`

	Merchant User `gorm:"foreignKey:MerchantID" json:"merchant,omitempty"`
}

func (LiveRoom) TableName() string { return "live_rooms" }
