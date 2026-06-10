package model

import (
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func SeedDatabase(db *gorm.DB) {
	usersToSeed := []struct {
		Email    string
		Password string
		Nickname string
		Role     UserRole
	}{
		{
			Email:    "shangjia@sj.com",
			Password: "shangjia1234",
			Nickname: "官方商家",
			Role:     RoleMerchant,
		},
		{
			Email:    "maijia@mj.com",
			Password: "maijia1234",
			Nickname: "极客买家",
			Role:     RoleUser,
		},
		{
			Email:    "maijia2@mj.com",
			Password: "maijia1234",
			Nickname: "淘宝大佬",
			Role:     RoleUser,
		},
	}

	for _, u := range usersToSeed {
		var count int64
		db.Model(&User{}).Where("email = ?", u.Email).Count(&count)
		if count == 0 {
			hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
			if err != nil {
				zap.L().Error("failed to hash seed password", zap.Error(err))
				continue
			}
			
			emailPtr := new(string)
			*emailPtr = u.Email
			
			user := User{
				Email:        emailPtr,
				Nickname:     u.Nickname,
				PasswordHash: string(hash),
				Role:         u.Role,
				Status:       UserActive,
				Balance:      decimal.NewFromInt(100000), // Give them 100,000 balance to test easily
			}
			if err := db.Create(&user).Error; err != nil {
				zap.L().Error("failed to seed user", zap.String("email", u.Email), zap.Error(err))
			} else {
				zap.L().Info("seeded user successfully", zap.String("email", u.Email))
			}
		}
	}
}
