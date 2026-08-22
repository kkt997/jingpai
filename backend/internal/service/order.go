package service

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"jingpai/internal/model"
)

// OrderService manages the order lifecycle: creation, payment timeout, status transitions.
type OrderService struct {
	db  *gorm.DB
	rdb *redis.Client

	paymentTimeout time.Duration
	stopCh         chan struct{}
}

func NewOrderService(db *gorm.DB, rdb *redis.Client) *OrderService {
	return &OrderService{
		db:             db,
		rdb:            rdb,
		paymentTimeout: 30 * time.Minute,
		stopCh:         make(chan struct{}),
	}
}

// Start launches the background expired-order cleanup worker.
func (s *OrderService) Start() {
	go s.expireWorker()
}

// Stop gracefully stops the background workers.
func (s *OrderService) Stop() {
	close(s.stopCh)
}

// CreateFromAuction generates an order after a successful auction completion.
// Returns the created order or an error.
func (s *OrderService) CreateFromAuction(ctx context.Context, auction *model.Auction, winnerID uint) (*model.Order, error) {
	// Prevent duplicate orders for the same auction
	var existing model.Order
	if err := s.db.Where("auction_id = ?", auction.ID).First(&existing).Error; err == nil {
		zap.L().Warn("order already exists for auction", zap.Uint("auctionId", auction.ID))
		return &existing, nil
	}

	order := &model.Order{
		OrderNo:    s.generateOrderNo(auction.ID),
		AuctionID:  auction.ID,
		BuyerID:    winnerID,
		SellerID:   auction.MerchantID,
		ProductID:  auction.ProductID,
		FinalPrice: auction.CurrentPrice,
		Status:     model.OrderPendingPayment,
		ExpireTime: time.Now().Add(s.paymentTimeout),
	}

	result := s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "auction_id"}},
		DoNothing: true,
	}).Create(order)
	if result.Error != nil {
		var existingAfterConflict model.Order
		if err := s.db.Where("auction_id = ?", auction.ID).First(&existingAfterConflict).Error; err == nil {
			return &existingAfterConflict, nil
		}
		return nil, fmt.Errorf("create order failed: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		var existingAfterConflict model.Order
		if err := s.db.Where("auction_id = ?", auction.ID).First(&existingAfterConflict).Error; err == nil {
			return &existingAfterConflict, nil
		}
		return nil, fmt.Errorf("create order skipped but existing order not found")
	}

	// Update product status to SOLD
	s.db.Model(&model.Product{}).Where("id = ?", auction.ProductID).
		Update("status", "SOLD")

	zap.L().Info("order created",
		zap.String("orderNo", order.OrderNo),
		zap.Uint("auctionId", auction.ID),
		zap.Uint("buyerId", winnerID),
		zap.String("finalPrice", order.FinalPrice.String()),
	)

	return order, nil
}

// PayOrder processes a simulated payment for an order.
func (s *OrderService) PayOrder(ctx context.Context, orderID, userID uint) (*model.Order, error) {
	var order model.Order
	if err := s.db.First(&order, orderID).Error; err != nil {
		return nil, fmt.Errorf("订单不存在")
	}

	if order.BuyerID != userID {
		return nil, fmt.Errorf("无权操作")
	}

	if order.Status != model.OrderPendingPayment {
		return nil, fmt.Errorf("订单状态不可支付")
	}

	if time.Now().After(order.ExpireTime) {
		order.Status = model.OrderCancelled
		s.db.Save(&order)
		return nil, fmt.Errorf("订单已过期")
	}

	now := time.Now()
	order.Status = model.OrderPaid
	order.PaymentTime = &now
	s.db.Save(&order)

	return &order, nil
}

// ShipOrder marks an order as shipped (merchant operation).
func (s *OrderService) ShipOrder(ctx context.Context, orderID, merchantID uint) (*model.Order, error) {
	var order model.Order
	if err := s.db.First(&order, orderID).Error; err != nil {
		return nil, fmt.Errorf("订单不存在")
	}

	if order.SellerID != merchantID {
		return nil, fmt.Errorf("无权操作")
	}

	if order.Status != model.OrderPaid {
		return nil, fmt.Errorf("订单状态不可发货，当前: %s", order.Status)
	}

	order.Status = model.OrderShipped
	s.db.Save(&order)

	return &order, nil
}

// ConfirmReceive marks an order as completed (buyer confirms receipt).
func (s *OrderService) ConfirmReceive(ctx context.Context, orderID, userID uint) (*model.Order, error) {
	var order model.Order
	if err := s.db.First(&order, orderID).Error; err != nil {
		return nil, fmt.Errorf("订单不存在")
	}

	if order.BuyerID != userID {
		return nil, fmt.Errorf("无权操作")
	}

	if order.Status != model.OrderShipped {
		return nil, fmt.Errorf("订单状态不可确认收货，当前: %s", order.Status)
	}

	order.Status = model.OrderCompleted
	s.db.Save(&order)

	return &order, nil
}

// CancelOrder cancels an unpaid order (buyer or system).
func (s *OrderService) CancelOrder(ctx context.Context, orderID, userID uint) (*model.Order, error) {
	var order model.Order
	if err := s.db.First(&order, orderID).Error; err != nil {
		return nil, fmt.Errorf("订单不存在")
	}

	if order.BuyerID != userID && order.SellerID != userID {
		return nil, fmt.Errorf("无权操作")
	}

	if order.Status != model.OrderPendingPayment {
		return nil, fmt.Errorf("仅待支付订单可取消")
	}

	order.Status = model.OrderCancelled
	s.db.Save(&order)

	// Release product back to listed
	s.db.Model(&model.Product{}).Where("id = ?", order.ProductID).
		Update("status", "LISTED")

	return &order, nil
}

// GetOrderByAuction finds the order for a specific auction.
func (s *OrderService) GetOrderByAuction(ctx context.Context, auctionID uint) (*model.Order, error) {
	var order model.Order
	if err := s.db.Where("auction_id = ?", auctionID).First(&order).Error; err != nil {
		return nil, err
	}
	return &order, nil
}

// GetOrderStats returns order statistics for a merchant.
func (s *OrderService) GetOrderStats(ctx context.Context, merchantID uint) map[string]interface{} {
	var totalRevenue decimal.Decimal
	var paidCount, pendingCount int64

	s.db.Model(&model.Order{}).
		Where("seller_id = ? AND status = ?", merchantID, model.OrderPaid).
		Count(&paidCount)
	s.db.Model(&model.Order{}).
		Where("seller_id = ? AND status = ?", merchantID, model.OrderPendingPayment).
		Count(&pendingCount)

	rows, err := s.db.Model(&model.Order{}).
		Select("COALESCE(SUM(final_price), 0) as total").
		Where("seller_id = ? AND status IN ?", merchantID,
			[]string{string(model.OrderPaid), string(model.OrderShipped), string(model.OrderCompleted)}).
		Rows()
	if err == nil {
		defer rows.Close()
		if rows.Next() {
			rows.Scan(&totalRevenue)
		}
	}

	return map[string]interface{}{
		"totalRevenue": totalRevenue,
		"paidCount":    paidCount,
		"pendingCount": pendingCount,
	}
}

// expireWorker periodically checks and cancels expired orders.
func (s *OrderService) expireWorker() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.cancelExpiredOrders()
		}
	}
}

func (s *OrderService) cancelExpiredOrders() {
	result := s.db.Model(&model.Order{}).
		Where("status = ? AND expire_time < ?", model.OrderPendingPayment, time.Now()).
		Update("status", model.OrderCancelled)

	if result.RowsAffected > 0 {
		zap.L().Info("expired orders cancelled", zap.Int64("count", result.RowsAffected))

		// Release products back to LISTED status
		var expiredOrders []model.Order
		s.db.Where("status = ? AND expire_time < ? AND updated_at > ?",
			model.OrderCancelled, time.Now(), time.Now().Add(-2*time.Minute)).
			Find(&expiredOrders)
		for _, order := range expiredOrders {
			s.db.Model(&model.Product{}).Where("id = ? AND status = ?", order.ProductID, "SOLD").
				Update("status", "LISTED")
		}
	}
}

func (s *OrderService) generateOrderNo(auctionID uint) string {
	return fmt.Sprintf("ORD%d%04d", time.Now().UnixMilli(), auctionID%10000)
}
