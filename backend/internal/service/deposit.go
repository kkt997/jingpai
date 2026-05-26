package service

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"jingpai/internal/model"
	"jingpai/internal/pkg/errcode"
)

type DepositService struct {
	db  *gorm.DB
	rdb *redis.Client
}

func NewDepositService(db *gorm.DB, rdb *redis.Client) *DepositService {
	return &DepositService{db: db, rdb: rdb}
}

func (s *DepositService) cacheKey(auctionID, userID uint) string {
	return fmt.Sprintf("deposit:%d:%d", auctionID, userID)
}

// HasDeposit checks if a user has an active (FROZEN) deposit for an auction.
func (s *DepositService) HasDeposit(ctx context.Context, userID, auctionID uint) bool {
	key := s.cacheKey(auctionID, userID)
	if val, err := s.rdb.Get(ctx, key).Result(); err == nil && val == "1" {
		return true
	}

	var count int64
	s.db.Model(&model.Deposit{}).
		Where("user_id = ? AND auction_id = ? AND status = ?", userID, auctionID, model.DepositFrozen).
		Count(&count)

	if count > 0 {
		s.rdb.Set(ctx, key, "1", 24*time.Hour)
		return true
	}
	return false
}

// IsRequired returns whether the auction requires a deposit and its amount.
func (s *DepositService) IsRequired(ctx context.Context, auctionID uint) (bool, decimal.Decimal) {
	var auction model.Auction
	if err := s.db.Select("deposit_amount").First(&auction, auctionID).Error; err != nil {
		return false, decimal.Zero
	}
	return auction.DepositAmount.IsPositive(), auction.DepositAmount
}

// Freeze creates a frozen deposit for a user in an auction.
func (s *DepositService) Freeze(ctx context.Context, userID, auctionID uint) (*model.Deposit, error) {
	if s.HasDeposit(ctx, userID, auctionID) {
		return nil, errcode.ErrDepositExists
	}

	var auction model.Auction
	if err := s.db.First(&auction, auctionID).Error; err != nil {
		return nil, fmt.Errorf("竞拍不存在")
	}

	if !auction.IsActive() && auction.Status != model.StatusPending {
		return nil, errcode.ErrDepositNotAllowed
	}

	if auction.DepositAmount.IsZero() {
		return nil, fmt.Errorf("本场竞拍无需保证金")
	}

	if userID == auction.MerchantID {
		return nil, fmt.Errorf("商家不可参与自己的竞拍")
	}

	deposit := &model.Deposit{
		UserID:    userID,
		AuctionID: auctionID,
		Amount:    auction.DepositAmount,
		Status:    model.DepositFrozen,
	}

	if err := s.db.Create(deposit).Error; err != nil {
		return nil, fmt.Errorf("缴纳保证金失败: %w", err)
	}

	s.rdb.Set(ctx, s.cacheKey(auctionID, userID), "1", 24*time.Hour)

	zap.L().Info("deposit frozen",
		zap.Uint("userId", userID),
		zap.Uint("auctionId", auctionID),
		zap.String("amount", deposit.Amount.String()),
	)
	return deposit, nil
}

// RefundByAuction refunds all FROZEN deposits for an auction.
// excludeUserID > 0 means skip the winner (their deposit gets deducted instead).
func (s *DepositService) RefundByAuction(ctx context.Context, auctionID uint, excludeUserID uint) {
	var deposits []model.Deposit
	query := s.db.Where("auction_id = ? AND status = ?", auctionID, model.DepositFrozen)
	if excludeUserID > 0 {
		query = query.Where("user_id != ?", excludeUserID)
	}
	query.Find(&deposits)

	for _, d := range deposits {
		s.db.Model(&d).Update("status", model.DepositRefunded)
		s.rdb.Del(ctx, s.cacheKey(auctionID, d.UserID))
	}

	if len(deposits) > 0 {
		zap.L().Info("deposits refunded",
			zap.Uint("auctionId", auctionID),
			zap.Int("count", len(deposits)),
		)
	}
}

// DeductWinner marks the winner's deposit as DEDUCTED (applied against order payment).
func (s *DepositService) DeductWinner(ctx context.Context, auctionID, winnerID uint) {
	result := s.db.Model(&model.Deposit{}).
		Where("auction_id = ? AND user_id = ? AND status = ?", auctionID, winnerID, model.DepositFrozen).
		Update("status", model.DepositDeducted)

	if result.RowsAffected > 0 {
		s.rdb.Del(ctx, s.cacheKey(auctionID, winnerID))
		zap.L().Info("winner deposit deducted",
			zap.Uint("auctionId", auctionID),
			zap.Uint("winnerId", winnerID),
		)
	}
}

// GetUserDeposits returns all deposits for a user.
func (s *DepositService) GetUserDeposits(ctx context.Context, userID uint) []model.Deposit {
	var deposits []model.Deposit
	s.db.Where("user_id = ?", userID).
		Preload("Auction", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, product_id, mode, status").Preload("Product", func(db *gorm.DB) *gorm.DB {
				return db.Select("id, title, images")
			})
		}).
		Order("created_at DESC").
		Find(&deposits)
	return deposits
}
