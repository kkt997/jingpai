package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"jingpai/internal/middleware"
	"jingpai/internal/service"
	"jingpai/internal/ws"
)

type Handler struct {
	db             *gorm.DB
	rdb            *redis.Client
	hub            *ws.Hub
	bidService     *service.BidService
	orderService   *service.OrderService
	depositService *service.DepositService
	auctionTimer   *service.AuctionTimer
	auctionFSM     *service.AuctionFSM
}

func NewHandler(db *gorm.DB, rdb *redis.Client, hub *ws.Hub, bidService *service.BidService, orderService *service.OrderService, depositService *service.DepositService, auctionTimer *service.AuctionTimer, auctionFSM *service.AuctionFSM) *Handler {
	return &Handler{db: db, rdb: rdb, hub: hub, bidService: bidService, orderService: orderService, depositService: depositService, auctionTimer: auctionTimer, auctionFSM: auctionFSM}
}

func (h *Handler) RegisterRoutes(r *gin.Engine) {
	r.Use(middleware.CORS())

	// Global API rate limit: 200 requests per IP per 10 seconds
	limiter := middleware.NewRateLimiter(h.rdb)
	r.Use(limiter.APIRateLimit(200, 10*time.Second))

	// Public routes
	public := r.Group("/api")
	{
		public.POST("/auth/register", limiter.RegisterRateLimit(5, 1*time.Minute), h.Register)
		public.POST("/auth/login", h.Login)
	}

	// Authenticated routes
	auth := r.Group("/api")
	auth.Use(middleware.AuthRequired())
	{
		auth.GET("/user/profile", h.GetProfile)
		auth.GET("/user/bids", h.ListUserBids)

		// Rooms
		auth.GET("/rooms", h.ListRooms)
		auth.GET("/rooms/:id", h.GetRoom)

		// Auctions
		auth.GET("/auctions", h.ListAuctions)
		auth.GET("/auctions/:id", h.GetAuction)

		// Orders
		auth.GET("/orders", h.ListOrders)
		auth.GET("/orders/:id", h.GetOrder)
		auth.POST("/orders/:id/pay", h.PayOrder)
		auth.POST("/orders/:id/confirm", h.ConfirmReceive)
		auth.POST("/orders/:id/cancel", h.CancelOrder)

		// Deposits
		auth.POST("/auctions/:id/deposit", h.PayDeposit)
		auth.GET("/auctions/:id/deposit", h.GetDepositStatus)
		auth.GET("/user/deposits", h.ListUserDeposits)
	}

	// Static file serving for uploads
	r.Static("/uploads", "./uploads")

	// Merchant routes
	merchant := r.Group("/api/merchant")
	merchant.Use(middleware.AuthRequired(), middleware.MerchantRequired())
	{
		// Upload
		merchant.POST("/upload", h.UploadFile)
		// Products
		merchant.POST("/products", h.CreateProduct)
		merchant.GET("/products", h.ListMerchantProducts)
		merchant.PUT("/products/:id", h.UpdateProduct)
		merchant.DELETE("/products/:id", h.DeleteProduct)
		merchant.PUT("/products/:id/list", h.ListProduct)
		merchant.PUT("/products/:id/unlist", h.UnlistProduct)

		// Rooms
		merchant.POST("/rooms", h.CreateRoom)
		merchant.PUT("/rooms/:id/start", h.StartRoom)
		merchant.PUT("/rooms/:id/end", h.EndRoom)

		// Auctions
		merchant.POST("/auctions", h.CreateAuction)
		merchant.PUT("/auctions/:id", h.UpdateAuction)
		merchant.PUT("/auctions/:id/start", h.StartAuction)
		merchant.PUT("/auctions/:id/cancel", h.CancelAuction)

		// Orders
		merchant.GET("/orders", h.ListMerchantOrders)
		merchant.POST("/orders/:id/ship", h.ShipOrder)

		// Stats
		merchant.GET("/stats", h.GetMerchantStats)
	}

	// WebSocket
	r.GET("/ws", middleware.AuthRequired(), h.HandleWebSocket)
}
