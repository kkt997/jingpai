package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// ─── HTTP Metrics ────────────────────────────────────────────────────────────

var HttpRequestsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "jingpai",
		Name:      "http_requests_total",
		Help:      "Total HTTP requests processed",
	},
	[]string{"method", "path", "status"},
)

var HttpRequestDuration = promauto.NewHistogramVec(
	prometheus.HistogramOpts{
		Namespace: "jingpai",
		Name:      "http_request_duration_seconds",
		Help:      "HTTP request duration in seconds",
		Buckets:   []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5},
	},
	[]string{"method", "path"},
)

// ─── WebSocket Metrics ───────────────────────────────────────────────────────

var WsConnectionsActive = promauto.NewGauge(
	prometheus.GaugeOpts{
		Namespace: "jingpai",
		Name:      "ws_connections_active",
		Help:      "Currently active WebSocket connections",
	},
)

var WsMessagesTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "jingpai",
		Name:      "ws_messages_total",
		Help:      "Total WebSocket messages processed",
	},
	[]string{"type", "direction"},
)

// ─── Bid Metrics ─────────────────────────────────────────────────────────────

var BidsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "jingpai",
		Name:      "bids_total",
		Help:      "Total bids processed",
	},
	[]string{"result"},
)

var BidDuration = promauto.NewHistogram(
	prometheus.HistogramOpts{
		Namespace: "jingpai",
		Name:      "bid_duration_seconds",
		Help:      "Bid processing time (full pipeline)",
		Buckets:   []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25},
	},
)

var BidCacheHits = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "jingpai",
		Name:      "bid_cache_operations_total",
		Help:      "Bid pipeline cache operations (L1 memory pre-check, L2 dedup)",
	},
	[]string{"layer", "result"},
)

// ─── Auction Metrics ─────────────────────────────────────────────────────────

var AuctionsActive = promauto.NewGauge(
	prometheus.GaugeOpts{
		Namespace: "jingpai",
		Name:      "auctions_active",
		Help:      "Currently active auctions",
	},
)

var AuctionCompletions = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "jingpai",
		Name:      "auction_completions_total",
		Help:      "Auction completions by result type",
	},
	[]string{"result"},
)

// ─── Redis Metrics ───────────────────────────────────────────────────────────

var RedisCommandDuration = promauto.NewHistogramVec(
	prometheus.HistogramOpts{
		Namespace: "jingpai",
		Name:      "redis_command_duration_seconds",
		Help:      "Redis command latency",
		Buckets:   []float64{0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1},
	},
	[]string{"cmd"},
)

var RedisCommandsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "jingpai",
		Name:      "redis_commands_total",
		Help:      "Total Redis commands executed",
	},
	[]string{"cmd", "status"},
)

// ─── Deposit Metrics ─────────────────────────────────────────────────────────

var DepositsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "jingpai",
		Name:      "deposits_total",
		Help:      "Total deposit operations",
	},
	[]string{"action"},
)
