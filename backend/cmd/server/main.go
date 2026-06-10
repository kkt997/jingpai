package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"jingpai/internal/config"
	"jingpai/internal/handler"
	"jingpai/internal/metrics"
	"jingpai/internal/middleware"
	"jingpai/internal/model"
	"jingpai/internal/service"
	"jingpai/internal/ws"
)

func main() {
	// Load config
	cfg, err := config.Load("config.yaml")
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// Init logger
	zapLogger, _ := zap.NewDevelopment()
	if cfg.Server.Mode == "release" {
		zapLogger, _ = zap.NewProduction()
	}
	zap.ReplaceGlobals(zapLogger)
	defer zapLogger.Sync()

	// Connect MySQL
	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Info),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		zap.L().Fatal("failed to connect database", zap.Error(err))
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Auto migrate
	if err := db.AutoMigrate(
		&model.User{},
		&model.Product{},
		&model.LiveRoom{},
		&model.Auction{},
		&model.Bid{},
		&model.Order{},
		&model.Deposit{},
		&model.Follow{},
		&model.Conversation{},
		&model.Message{},
		&model.ConversationParticipant{},
	); err != nil {
		zap.L().Fatal("failed to migrate database", zap.Error(err))
	}
	zap.L().Info("database migrated successfully")

	// Connect Redis
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
		PoolSize: cfg.Redis.PoolSize,
	})
	rdb.AddHook(metrics.NewRedisHook())
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		zap.L().Fatal("failed to connect redis", zap.Error(err))
	}
	zap.L().Info("redis connected")

	// Init WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// Init services
	aliasService := service.NewAliasService(rdb)
	broadcastService := service.NewBroadcastService(hub, aliasService)
	bidService := service.NewBidService(rdb, db, aliasService, &cfg.Auction)
	orderService := service.NewOrderService(db, rdb)
	orderService.Start()
	depositService := service.NewDepositService(db, rdb)
	auctionFSM := service.NewAuctionFSM()
	auctionTimer := service.NewAuctionTimer(hub, db, bidService, broadcastService, aliasService, orderService, depositService, auctionFSM, &cfg.Auction)
	auctionTimer.Start()

	// Wire WS message handler
	wsHandler := handler.NewWsMessageHandler(hub, db, bidService, broadcastService, aliasService, depositService, auctionTimer)
	hub.SetMessageHandler(wsHandler)

	// Setup Gin
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.Default()

	// Prometheus metrics middleware + endpoint
	r.Use(middleware.PrometheusMiddleware())
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Register routes
	h := handler.NewHandler(db, rdb, hub, bidService, orderService, depositService, auctionTimer, auctionFSM)
	h.RegisterRoutes(r)

	// Start server
	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
		zap.L().Info("server starting", zap.String("addr", addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zap.L().Fatal("server failed", zap.Error(err))
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	zap.L().Info("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		zap.L().Fatal("server forced to shutdown", zap.Error(err))
	}

	sqlDB.Close()
	rdb.Close()
	zap.L().Info("server exited")
}
