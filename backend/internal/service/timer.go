package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"jingpai/internal/config"
	"jingpai/internal/metrics"
	"jingpai/internal/model"
	"jingpai/internal/ws"
)

// AuctionTimer manages server-side countdown for active auctions.
// Responsibilities:
//   - Start a timer when an auction begins
//   - Reset the timer when an extension occurs
//   - Fire FSM EventTimeout when time expires
//   - Periodically broadcast countdown_sync to rooms
type AuctionTimer struct {
	mu     sync.RWMutex
	timers map[uint]*auctionTimerEntry // auctionID → timer

	hub              *ws.Hub
	db               *gorm.DB
	bidService       *BidService
	broadcastService *BroadcastService
	aliasService     *AliasService
	orderService     *OrderService
	depositService   *DepositService
	fsm              *AuctionFSM
	cfg              *config.AuctionConfig

	stopSync chan struct{}
}

type auctionTimerEntry struct {
	auctionID uint
	roomID    uint
	endTime   int64 // unix ms
	timer     *time.Timer
}

func NewAuctionTimer(
	hub *ws.Hub,
	db *gorm.DB,
	bidService *BidService,
	broadcastService *BroadcastService,
	aliasService *AliasService,
	orderService *OrderService,
	depositService *DepositService,
	fsm *AuctionFSM,
	cfg *config.AuctionConfig,
) *AuctionTimer {
	return &AuctionTimer{
		timers:           make(map[uint]*auctionTimerEntry),
		hub:              hub,
		db:               db,
		bidService:       bidService,
		broadcastService: broadcastService,
		aliasService:     aliasService,
		orderService:     orderService,
		depositService:   depositService,
		fsm:              fsm,
		cfg:              cfg,
		stopSync:         make(chan struct{}),
	}
}

// Start begins the periodic countdown_sync broadcaster.
func (t *AuctionTimer) Start() {
	go t.countdownSyncLoop()
}

// Stop gracefully stops all timers and the sync loop.
func (t *AuctionTimer) Stop() {
	close(t.stopSync)
	t.mu.Lock()
	defer t.mu.Unlock()
	for _, entry := range t.timers {
		entry.timer.Stop()
	}
	t.timers = make(map[uint]*auctionTimerEntry)
}

// StartAuction registers a new auction timer. Called when a merchant starts an auction.
func (t *AuctionTimer) StartAuction(auction *model.Auction) {
	endTime := time.Now().Add(time.Duration(auction.DurationSeconds) * time.Second)
	endTimeMs := endTime.UnixMilli()
	duration := time.Until(endTime)

	t.mu.Lock()
	defer t.mu.Unlock()

	// Cancel existing timer if any
	if existing, ok := t.timers[auction.ID]; ok {
		existing.timer.Stop()
	}

	entry := &auctionTimerEntry{
		auctionID: auction.ID,
		roomID:    auction.RoomID,
		endTime:   endTimeMs,
	}
	entry.timer = time.AfterFunc(duration, func() {
		t.onTimeout(auction.ID)
	})
	t.timers[auction.ID] = entry

	metrics.AuctionsActive.Inc()
	zap.L().Info("auction timer started",
		zap.Uint("auctionId", auction.ID),
		zap.Duration("duration", duration),
		zap.Int64("endTime", endTimeMs),
	)
}

// ExtendTimer resets the timer to a new end time. Called when a bid triggers extension.
func (t *AuctionTimer) ExtendTimer(auctionID uint, newEndTimeMs int64) {
	t.mu.Lock()
	defer t.mu.Unlock()

	entry, ok := t.timers[auctionID]
	if !ok {
		zap.L().Warn("extend timer for unknown auction", zap.Uint("auctionId", auctionID))
		return
	}

	entry.timer.Stop()
	entry.endTime = newEndTimeMs

	remaining := time.Until(time.UnixMilli(newEndTimeMs))
	if remaining <= 0 {
		go t.onTimeout(auctionID)
		return
	}

	entry.timer = time.AfterFunc(remaining, func() {
		t.onTimeout(auctionID)
	})

	zap.L().Info("auction timer extended",
		zap.Uint("auctionId", auctionID),
		zap.Duration("remaining", remaining),
	)
}

// CancelTimer stops and removes the timer for an auction.
func (t *AuctionTimer) CancelTimer(auctionID uint) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if entry, ok := t.timers[auctionID]; ok {
		entry.timer.Stop()
		delete(t.timers, auctionID)
	}
}

// GetEndTime returns the end time for an auction, 0 if not found.
func (t *AuctionTimer) GetEndTime(auctionID uint) int64 {
	t.mu.RLock()
	defer t.mu.RUnlock()
	if entry, ok := t.timers[auctionID]; ok {
		return entry.endTime
	}
	return 0
}

// onTimeout is called when an auction timer expires.
func (t *AuctionTimer) onTimeout(auctionID uint) {
	ctx := context.Background()

	t.mu.Lock()
	entry, ok := t.timers[auctionID]
	if ok {
		delete(t.timers, auctionID)
	}
	t.mu.Unlock()

	if !ok {
		return
	}

	zap.L().Info("auction timeout", zap.Uint("auctionId", auctionID))

	// Double-check from Redis — another bid may have extended it
	_, redisEndTime, redisStatus, _, err := t.bidService.GetAuctionState(ctx, auctionID)
	if err != nil {
		zap.L().Error("failed to get auction state on timeout", zap.Error(err))
		return
	}

	// If Redis shows it's already completed/extended with a new end time, abort
	now := time.Now().UnixMilli()
	if redisEndTime > now && (redisStatus == "ACTIVE" || redisStatus == "EXTENDED") {
		// Timer is stale — someone extended it but we missed the ExtendTimer call.
		// Re-register a timer for the correct end time.
		t.mu.Lock()
		remaining := time.Until(time.UnixMilli(redisEndTime))
		newEntry := &auctionTimerEntry{
			auctionID: auctionID,
			roomID:    entry.roomID,
			endTime:   redisEndTime,
		}
		newEntry.timer = time.AfterFunc(remaining, func() {
			t.onTimeout(auctionID)
		})
		t.timers[auctionID] = newEntry
		t.mu.Unlock()
		return
	}

	if redisStatus != "ACTIVE" && redisStatus != "EXTENDED" {
		// Already ended (e.g. ceiling hit), nothing to do
		return
	}

	// Load auction from DB
	var auction model.Auction
	if err := t.db.First(&auction, auctionID).Error; err != nil {
		zap.L().Error("failed to load auction on timeout", zap.Error(err))
		return
	}

	// Read final state from Redis
	currentPrice, _, _, bidCount, _ := t.bidService.GetAuctionState(ctx, auctionID)

	// Update auction with Redis data before FSM trigger
	auction.CurrentPrice = decimalFromFloat(currentPrice)
	auction.BidCount = uint(bidCount)

	// Trigger FSM
	auctionCtx := &AuctionContext{Auction: &auction}
	newStatus, err := t.fsm.Trigger(auctionCtx, EventTimeout)
	if err != nil {
		zap.L().Error("FSM timeout transition failed", zap.Error(err))
		return
	}

	// Update DB
	now2 := time.Now()
	updates := map[string]interface{}{
		"status":        newStatus,
		"current_price": auction.CurrentPrice,
		"bid_count":     auction.BidCount,
		"actual_end":    now2,
	}

	if newStatus == model.StatusCompleted {
		winnerID := t.getWinnerID(ctx, auctionID)
		if winnerID > 0 {
			updates["winner_id"] = winnerID
		}
	}

	t.db.Model(&model.Auction{}).Where("id = ?", auctionID).Updates(updates)

	// Update Redis state
	stateKey := fmt.Sprintf("auction:%d:state", auctionID)
	t.bidService.rdb.HSet(ctx, stateKey, "status", string(newStatus))

	// Broadcast auction end
	t.broadcastAuctionEnd(ctx, entry.roomID, auctionID, &auction, newStatus)

	metrics.AuctionsActive.Dec()
	metrics.AuctionCompletions.WithLabelValues(string(newStatus)).Inc()

	if newStatus == model.StatusCompleted {
		go t.generateOrder(ctx, &auction)
	} else if newStatus == model.StatusFailed {
		go t.refundAllDeposits(ctx, auctionID)
	}

	zap.L().Info("auction ended",
		zap.Uint("auctionId", auctionID),
		zap.String("status", string(newStatus)),
	)
}

func (t *AuctionTimer) broadcastAuctionEnd(ctx context.Context, roomID, auctionID uint, auction *model.Auction, status model.AuctionStatus) {
	room := t.hub.GetRoom(roomID)
	if room == nil {
		return
	}

	var result string
	var winnerAlias string
	var finalPrice float64

	switch status {
	case model.StatusCompleted:
		result = "completed"
		finalPrice = auction.CurrentPrice.InexactFloat64()
		winnerID := t.getWinnerID(ctx, auctionID)
		if winnerID > 0 {
			winnerAlias, _ = t.aliasService.GetOrAssign(ctx, auctionID, winnerID)
		}
	case model.StatusFailed:
		result = "failed"
	default:
		result = "cancelled"
	}

	// Count unique bidders
	rankKey := fmt.Sprintf("auction:%d:ranking", auctionID)
	totalBidders, _ := t.bidService.rdb.ZCard(ctx, rankKey).Result()

	t.broadcastService.BroadcastAuctionEnd(
		room,
		result,
		winnerAlias,
		finalPrice,
		int(auction.BidCount),
		int(totalBidders),
	)
}

func (t *AuctionTimer) getWinnerID(ctx context.Context, auctionID uint) uint {
	key := fmt.Sprintf("auction:%d:state", auctionID)
	val, err := t.bidService.rdb.HGet(ctx, key, "winner_id").Result()
	if err != nil {
		return 0
	}
	return parseUint(val)
}

// generateOrder creates an order when auction completes.
func (t *AuctionTimer) generateOrder(ctx context.Context, auction *model.Auction) {
	winnerID := t.getWinnerID(ctx, auction.ID)
	if winnerID == 0 {
		return
	}

	_, err := t.orderService.CreateFromAuction(ctx, auction, winnerID)
	if err != nil {
		zap.L().Error("failed to create order via OrderService",
			zap.Error(err), zap.Uint("auctionId", auction.ID))
	}
}

// refundAllDeposits refunds all deposits when auction fails, is cancelled, or auto-refund is triggered.
func (t *AuctionTimer) refundAllDeposits(ctx context.Context, auctionID uint) {
	t.depositService.RefundByAuction(ctx, auctionID, "AUCTION_END")
}

// countdownSyncLoop broadcasts countdown_sync every N seconds to all active rooms.
func (t *AuctionTimer) countdownSyncLoop() {
	interval := 5 * time.Second
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-t.stopSync:
			return
		case <-ticker.C:
			t.broadcastCountdownSync()
		}
	}
}

func (t *AuctionTimer) broadcastCountdownSync() {
	t.mu.RLock()
	entries := make([]auctionTimerEntry, 0, len(t.timers))
	for _, entry := range t.timers {
		entries = append(entries, *entry)
	}
	t.mu.RUnlock()

	now := time.Now().UnixMilli()
	for _, entry := range entries {
		room := t.hub.GetRoom(entry.roomID)
		if room == nil || room.ClientCount() == 0 {
			continue
		}

		remaining := entry.endTime - now
		if remaining < 0 {
			remaining = 0
		}

		room.Broadcast(ws.ServerMessage{
			Type: ws.MsgCountdownSync,
			Code: 0,
			Data: map[string]any{
				"auctionId":  entry.auctionID,
				"endTime":    entry.endTime,
				"remaining":  remaining,
				"serverTime": now,
			},
			Ts: now,
		})
	}
}

// CompleteByCeiling handles full side-effects when a bid hits the ceiling price:
// stop timer → FSM transition → DB update → broadcast auction_end → generate order
func (t *AuctionTimer) CompleteByCeiling(auctionID uint, winnerID uint, finalPrice float64) {
	ctx := context.Background()

	// Stop the existing timer
	t.mu.Lock()
	entry, ok := t.timers[auctionID]
	if ok {
		entry.timer.Stop()
		delete(t.timers, auctionID)
	}
	t.mu.Unlock()

	var roomID uint
	if ok {
		roomID = entry.roomID
	}

	// Load auction from DB
	var auction model.Auction
	if err := t.db.First(&auction, auctionID).Error; err != nil {
		zap.L().Error("CompleteByCeiling: failed to load auction", zap.Error(err))
		return
	}
	if roomID == 0 {
		roomID = auction.RoomID
	}

	// Update auction fields
	auction.CurrentPrice = decimalFromFloat(finalPrice)
	_, _, _, bidCount, _ := t.bidService.GetAuctionState(ctx, auctionID)
	auction.BidCount = uint(bidCount)

	// FSM transition
	auctionCtx := &AuctionContext{Auction: &auction}
	newStatus, err := t.fsm.Trigger(auctionCtx, EventReachCeiling)
	if err != nil {
		zap.L().Error("CompleteByCeiling: FSM transition failed", zap.Error(err))
		newStatus = model.StatusCompleted
	}

	// Update DB
	now := time.Now()
	updates := map[string]interface{}{
		"status":        newStatus,
		"current_price": auction.CurrentPrice,
		"bid_count":     auction.BidCount,
		"winner_id":     winnerID,
		"actual_end":    now,
	}
	t.db.Model(&model.Auction{}).Where("id = ?", auctionID).Updates(updates)

	// Update Redis state
	stateKey := fmt.Sprintf("auction:%d:state", auctionID)
	t.bidService.rdb.HSet(ctx, stateKey, "status", string(newStatus))

	// Broadcast auction end
	auction.WinnerID = &winnerID
	t.broadcastAuctionEnd(ctx, roomID, auctionID, &auction, newStatus)

	// Generate order
	go t.generateOrder(ctx, &auction)

	// Refund all deposits after auction end; guarantee fund is platform-managed
	go t.refundAllDeposits(ctx, auctionID)

	metrics.AuctionsActive.Dec()
	metrics.AuctionCompletions.WithLabelValues("COMPLETED_CEILING").Inc()

	zap.L().Info("auction completed by ceiling price",
		zap.Uint("auctionId", auctionID),
		zap.Float64("finalPrice", finalPrice),
		zap.Uint("winnerId", winnerID),
	)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func decimalFromFloat(f float64) decimal.Decimal {
	return decimal.NewFromFloat(f)
}
