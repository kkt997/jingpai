package middleware

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"jingpai/internal/pkg/response"
)

type RateLimiter struct {
	rdb *redis.Client
}

func NewRateLimiter(rdb *redis.Client) *RateLimiter {
	return &RateLimiter{rdb: rdb}
}

// APIRateLimit applies a global per-IP rate limit to HTTP API requests.
// limit: max requests per window; window: time window duration.
func (rl *RateLimiter) APIRateLimit(limit int64, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		ctx := context.Background()
		key := fmt.Sprintf("rate:api:%s", ip)

		count, err := rl.rdb.Incr(ctx, key).Result()
		if err != nil {
			c.Next()
			return
		}
		if count == 1 {
			rl.rdb.Expire(ctx, key, window)
		}
		if count > limit {
			response.Fail(c, 429, 5001, "请求过于频繁，请稍后重试")
			c.Abort()
			return
		}
		c.Next()
	}
}

// RegisterRateLimit limits registration attempts to maxAttempts per IP per window.
func (rl *RateLimiter) RegisterRateLimit(maxAttempts int64, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		ctx := context.Background()
		key := fmt.Sprintf("rate:register:%s", ip)

		count, err := rl.rdb.Incr(ctx, key).Result()
		if err != nil {
			c.Next()
			return
		}
		if count == 1 {
			rl.rdb.Expire(ctx, key, window)
		}
		if count > maxAttempts {
			response.Fail(c, 429, 5001, "注册过于频繁，请稍后再试")
			c.Abort()
			return
		}
		c.Next()
	}
}

// BidRateLimit checks bid frequency: 1 bid per user per auction per second.
// Used by BidService internally for WebSocket bids, but also available as HTTP middleware.
func (rl *RateLimiter) BidRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		auctionID := c.Param("auctionId")

		ctx := context.Background()
		key := fmt.Sprintf("rate:bid:u:%v:%s", userID, auctionID)

		ok, err := rl.rdb.SetNX(ctx, key, 1, 1*time.Second).Result()
		if err != nil {
			c.Next()
			return
		}
		if !ok {
			response.Fail(c, 429, 4003, "出价太频繁，每秒仅可出价1次")
			c.Abort()
			return
		}
		c.Next()
	}
}
