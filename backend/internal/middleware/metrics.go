package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"

	"jingpai/internal/metrics"
)

// PrometheusMiddleware records HTTP request metrics.
func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.FullPath()
		if path == "" {
			path = "unmatched"
		}

		c.Next()

		duration := time.Since(start).Seconds()
		status := fmt.Sprintf("%d", c.Writer.Status())

		metrics.HttpRequestsTotal.WithLabelValues(c.Request.Method, path, status).Inc()
		metrics.HttpRequestDuration.WithLabelValues(c.Request.Method, path).Observe(duration)
	}
}
