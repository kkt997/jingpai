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

func (s *DepositService) GetDepositByUserAuction(ctx context.Context, userID, auctionID uint) (*model.Deposit, error) {
	var deposit model.Deposit
	if err := s.db.Where("user_id = ? AND auction_id = ?", userID, auctionID).First(&deposit).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errcode.ErrDepositNotFound
		}
		return nil, err
	}
	return &deposit, nil
}

// IsRequired returns whether the auction requires a deposit and its amount.
func (s *DepositService) IsRequired(ctx context.Context, auctionID uint) (bool, decimal.Decimal) {
	var auction model.Auction
	if err := s.db.Select("deposit_amount").First(&auction, auctionID).Error; err != nil {
		return false, decimal.Zero
	}
	return auction.DepositAmount.IsPositive(), auction.DepositAmount
}

func (s *DepositService) GetDepositStatus(ctx context.Context, userID, auctionID uint) map[string]any {
	required, amount := s.IsRequired(ctx, auctionID)
	status := any(nil)
	canRefund := false
	refundHint := ""

	if deposit, err := s.GetDepositByUserAuction(ctx, userID, auctionID); err == nil {
		status = deposit.Status
		canRefund = deposit.Status == model.DepositFrozen
		switch deposit.Status {
		case model.DepositFrozen:
			refundHint = "参拍保证金由平台托管，可随时申请退还；直播结束后自动退回"
		case model.DepositRefunded:
			refundHint = "保证金已退回平台钱包"
		case model.DepositDeducted:
			refundHint = "历史记录：该保证金已完成抵扣"
		}
	}

	return map[string]any{
		"required":   required,
		"amount":     amount.InexactFloat64(),
		"hasPaid":    s.HasDeposit(ctx, userID, auctionID),
		"status":     status,
		"canRefund":  canRefund,
		"refundHint": refundHint,
	}
}

// Freeze creates a frozen deposit for a user in an auction.
func (s *DepositService) Freeze(ctx context.Context, userID, auctionID uint) (*model.Deposit, error) {
	if s.HasDeposit(ctx, userID, auctionID) {
		return nil, errcode.ErrDepositExists
	}

	var deposit *model.Deposit
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var auction model.Auction
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&auction, auctionID).Error; err != nil {
			return fmt.Errorf("竞拍不存在")
		}

		if !auction.IsActive() && auction.Status != model.StatusPending {
			return errcode.ErrDepositNotAllowed
		}

		if auction.DepositAmount.IsZero() {
			return fmt.Errorf("本场竞拍无需保证金")
		}

		if userID == auction.MerchantID {
			return fmt.Errorf("商家不可参与自己的竞拍")
		}

		var user model.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, userID).Error; err != nil {
			return errcode.ErrUserNotFound
		}
		if user.Balance.LessThan(auction.DepositAmount) {
			return errcode.ErrBalanceInsufficient
		}

		var existing model.Deposit
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ? AND auction_id = ?", userID, auctionID).
			First(&existing).Error
		if err == nil {
			if existing.Status != model.DepositRefunded {
				return errcode.ErrDepositExists
			}

			now := time.Now()
			updates := map[string]any{
				"status":        model.DepositFrozen,
				"amount":        auction.DepositAmount,
				"refund_reason": "",
				"refunded_at":   nil,
				"deducted_at":   nil,
				"updated_at":    now,
			}
			if err := tx.Model(&existing).Updates(updates).Error; err != nil {
				return fmt.Errorf("重新参与竞拍失败: %w", err)
			}
			if err := tx.Model(&user).Update("balance", user.Balance.Sub(auction.DepositAmount)).Error; err != nil {
				return fmt.Errorf("扣减余额失败: %w", err)
			}

			existing.Status = model.DepositFrozen
			existing.Amount = auction.DepositAmount
			existing.RefundReason = ""
			existing.RefundedAt = nil
			existing.DeductedAt = nil
			deposit = &existing
			return nil
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}

		newDeposit := &model.Deposit{
			UserID:    userID,
			AuctionID: auctionID,
			Amount:    auction.DepositAmount,
			Status:    model.DepositFrozen,
		}
		if err := tx.Create(newDeposit).Error; err != nil {
			return fmt.Errorf("缴纳保证金失败: %w", err)
		}
		if err := tx.Model(&user).Update("balance", user.Balance.Sub(auction.DepositAmount)).Error; err != nil {
			return fmt.Errorf("扣减余额失败: %w", err)
		}

		deposit = newDeposit
		return nil
	})
	if err != nil {
		return nil, err
	}

	s.rdb.Set(ctx, s.cacheKey(auctionID, userID), "1", 24*time.Hour)

	zap.L().Info("deposit frozen",
		zap.Uint("userId", userID),
		zap.Uint("auctionId", auctionID),
		zap.String("amount", deposit.Amount.String()),
	)
	return deposit, nil
}

func (s *DepositService) Refund(ctx context.Context, userID, auctionID uint, reason string) (*model.Deposit, error) {
	var deposit model.Deposit
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ? AND auction_id = ?", userID, auctionID).
			First(&deposit).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return errcode.ErrDepositNotFound
			}
			return err
		}
		if deposit.Status != model.DepositFrozen {
			return errcode.ErrDepositNotRefundable
		}

		var user model.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, userID).Error; err != nil {
			return errcode.ErrUserNotFound
		}
		if err := tx.Model(&user).Update("balance", user.Balance.Add(deposit.Amount)).Error; err != nil {
			return fmt.Errorf("退回余额失败: %w", err)
		}

		now := time.Now()
		updates := map[string]any{
			"status":        model.DepositRefunded,
			"refund_reason": reason,
			"refunded_at":   &now,
			"updated_at":    now,
		}
		if err := tx.Model(&deposit).Updates(updates).Error; err != nil {
			return fmt.Errorf("退还保证金失败: %w", err)
		}
		deposit.Status = model.DepositRefunded
		deposit.RefundReason = reason
		deposit.RefundedAt = &now
		return nil
	})
	if err != nil {
		return nil, err
	}

	s.rdb.Del(ctx, s.cacheKey(auctionID, userID))
	return &deposit, nil
}

// RefundByAuction refunds all FROZEN deposits for an auction.
func (s *DepositService) RefundByAuction(ctx context.Context, auctionID uint, reason string) {
	var deposits []model.Deposit
	s.db.Where("auction_id = ? AND status = ?", auctionID, model.DepositFrozen).Find(&deposits)

	for i := range deposits {
		if _, err := s.Refund(ctx, deposits[i].UserID, auctionID, reason); err != nil {
			zap.L().Warn("refund by auction skipped",
				zap.Uint("auctionId", auctionID),
				zap.Uint("userId", deposits[i].UserID),
				zap.Error(err),
			)
		}
	}

	if len(deposits) > 0 {
		zap.L().Info("deposits refunded",
			zap.Uint("auctionId", auctionID),
			zap.Int("count", len(deposits)),
			zap.String("reason", reason),
		)
	}
}

func (s *DepositService) RefundByRoomEnd(ctx context.Context, roomID uint) {
	var auctionIDs []uint
	s.db.Model(&model.Auction{}).Where("room_id = ?", roomID).Pluck("id", &auctionIDs)
	for _, auctionID := range auctionIDs {
		s.RefundByAuction(ctx, auctionID, "ROOM_END")
	}
}

// DeductWinner marks the winner's deposit as DEDUCTED (legacy compatibility only).
func (s *DepositService) DeductWinner(ctx context.Context, auctionID, winnerID uint) {
	result := s.db.Model(&model.Deposit{}).
		Where("auction_id = ? AND user_id = ? AND status = ?", auctionID, winnerID, model.DepositFrozen).
		Updates(map[string]any{
			"status":      model.DepositDeducted,
			"deducted_at": time.Now(),
		})

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
