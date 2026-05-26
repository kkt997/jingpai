package metrics

import (
	"context"
	"net"
	"time"

	"github.com/redis/go-redis/v9"
)

type contextKey string

const startTimeKey contextKey = "redis_start_time"

// RedisHook implements redis.Hook to track command metrics.
type RedisHook struct{}

func NewRedisHook() *RedisHook {
	return &RedisHook{}
}

func (h *RedisHook) DialHook(next redis.DialHook) redis.DialHook {
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		return next(ctx, network, addr)
	}
}

func (h *RedisHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		start := time.Now()
		err := next(ctx, cmd)
		duration := time.Since(start).Seconds()

		cmdName := cmd.Name()
		status := "ok"
		if err != nil && err != redis.Nil {
			status = "error"
		}

		RedisCommandDuration.WithLabelValues(cmdName).Observe(duration)
		RedisCommandsTotal.WithLabelValues(cmdName, status).Inc()
		return err
	}
}

func (h *RedisHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error {
		start := time.Now()
		err := next(ctx, cmds)
		duration := time.Since(start).Seconds()

		status := "ok"
		if err != nil {
			status = "error"
		}

		RedisCommandDuration.WithLabelValues("pipeline").Observe(duration)
		RedisCommandsTotal.WithLabelValues("pipeline", status).Inc()
		return err
	}
}
