package service

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

var aliasPrefixes = []string{
	"巅峰竞拍者", "神秘买家", "竞拍达人",
	"无名高手", "黑马选手", "实力玩家",
}

type AliasService struct {
	rdb *redis.Client
}

func NewAliasService(rdb *redis.Client) *AliasService {
	return &AliasService{rdb: rdb}
}

// GetOrAssign returns or assigns a virtual alias for a user in an auction
func (s *AliasService) GetOrAssign(ctx context.Context, auctionID, userID uint) (string, error) {
	key := fmt.Sprintf("auction:%d:aliases", auctionID)
	field := fmt.Sprintf("%d", userID)

	alias, err := s.rdb.HGet(ctx, key, field).Result()
	if err == nil {
		return alias, nil
	}

	counterKey := fmt.Sprintf("auction:%d:alias_counter", auctionID)
	num, err := s.rdb.Incr(ctx, counterKey).Result()
	if err != nil {
		return "", err
	}

	prefix := aliasPrefixes[num%int64(len(aliasPrefixes))]
	alias = fmt.Sprintf("%s%d", prefix, num)

	s.rdb.HSet(ctx, key, field, alias)
	return alias, nil
}

// GetAlias returns the alias for a user, empty string if not found
func (s *AliasService) GetAlias(ctx context.Context, auctionID, userID uint) string {
	key := fmt.Sprintf("auction:%d:aliases", auctionID)
	field := fmt.Sprintf("%d", userID)
	alias, _ := s.rdb.HGet(ctx, key, field).Result()
	return alias
}

// CleanupAuction removes all alias data for an auction
func (s *AliasService) CleanupAuction(ctx context.Context, auctionID uint) {
	key := fmt.Sprintf("auction:%d:aliases", auctionID)
	counterKey := fmt.Sprintf("auction:%d:alias_counter", auctionID)
	s.rdb.Del(ctx, key, counterKey)
}
