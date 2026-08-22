package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"jingpai/internal/config"
	"jingpai/internal/metrics"
	"jingpai/internal/model"
	"jingpai/internal/pkg/errcode"
)

// BidService handles the complete bid processing pipeline:
// memory pre-check → dedup → rate limit → Redis Lua atomic bid → async persist
type BidService struct {
	rdb          *redis.Client
	db           *gorm.DB
	aliasService *AliasService
	bidScript    *redis.Script

	// L1: in-memory auction state cache (reduces Redis reads)
	stateCache sync.Map // map[uint]*cachedAuctionState

	// L2: dedup map to prevent double-click bids
	dedupMap sync.Map // map[string]int64 (key → timestamp ms)

	cfg *config.AuctionConfig
}

type cachedAuctionState struct {
	CurrentPrice int64  // cents
	Status       string // "ACTIVE" or "EXTENDED"
	EndTime      int64  // unix ms
	FetchedAt    int64  // unix ms, for staleness check
}

// LuaBidResult maps the JSON returned by bid.lua
type LuaBidResult struct {
	Code       int    `json:"code"`
	Msg        string `json:"msg,omitempty"`
	Extended   bool   `json:"extended"`
	HitCeiling bool   `json:"hit_ceiling"`
	NewEndTime int64  `json:"new_end_time"`
	FinalPrice int64  `json:"final_price"`
	BidCount   int    `json:"bid_count"`
	Rank       int    `json:"rank"`
	StreamID   string `json:"stream_id,omitempty"`
	// only present on code=-1
	CurrentPrice int64 `json:"current_price,omitempty"`
}

const (
	bidLuaScript = `
-- Atomic bid script
-- KEYS[1] = auction:{id}:state
-- KEYS[2] = auction:{id}:ranking
-- KEYS[3] = auction:{id}:bid_stream
-- KEYS[4] = auction:bid_streams
-- ARGV[1] = bid amount (cents)
-- ARGV[2] = user ID
-- ARGV[3] = current timestamp (ms)
-- ARGV[4] = auto extend seconds
-- ARGV[5] = increment amount (cents)
-- ARGV[6] = ceiling price (cents), 0 = no ceiling
-- ARGV[7] = auction ID

local current_price = tonumber(redis.call('HGET', KEYS[1], 'current_price'))
local end_time = tonumber(redis.call('HGET', KEYS[1], 'end_time'))
local status = redis.call('HGET', KEYS[1], 'status')
local increment = tonumber(ARGV[5])
local new_bid = tonumber(ARGV[1])
local now = tonumber(ARGV[3])
local extend_sec = tonumber(ARGV[4])
local ceiling = tonumber(ARGV[6])

-- Check auction is active
if status ~= 'ACTIVE' and status ~= 'EXTENDED' then
    return cjson.encode({code = -2, msg = "auction_not_active"})
end

-- Check auction not expired
if now > end_time then
    return cjson.encode({code = -3, msg = "auction_ended"})
end

-- Check if already highest bidder
local winner_id = redis.call('HGET', KEYS[1], 'winner_id')
if winner_id == ARGV[2] then
    return cjson.encode({code = -4, msg = "already_highest"})
end

-- Validate bid amount
if new_bid < current_price + increment then
    return cjson.encode({code = -1, msg = "bid_too_low", current_price = current_price})
end

-- Check ceiling price
local hit_ceiling = false
if ceiling > 0 and new_bid >= ceiling then
    new_bid = ceiling
    hit_ceiling = true
end

-- Update bid state
redis.call('HSET', KEYS[1], 'current_price', new_bid)
redis.call('HSET', KEYS[1], 'winner_id', ARGV[2])
redis.call('HINCRBY', KEYS[1], 'bid_count', 1)
redis.call('ZADD', KEYS[2], new_bid, ARGV[2])
redis.call('SADD', KEYS[4], KEYS[3])
local stream_id = redis.call(
    'XADD',
    KEYS[3],
    '*',
    'auction_id', ARGV[7],
    'user_id', ARGV[2],
    'amount_cents', new_bid,
    'bid_time_ms', now
)

-- Calculate extension
local extended = false
local new_end_time = end_time
local remaining = end_time - now
local max_end_time = tonumber(redis.call('HGET', KEYS[1], 'max_end_time')) or 0

if not hit_ceiling and remaining > 0 and remaining <= extend_sec * 1000 then
    local proposed_end = now + extend_sec * 1000
    -- Enforce 3x duration cap
    if max_end_time > 0 and proposed_end > max_end_time then
        proposed_end = max_end_time
    end
    -- Only extend if proposed end is actually later than current end
    if proposed_end > end_time then
        new_end_time = proposed_end
        redis.call('HSET', KEYS[1], 'end_time', new_end_time)
        redis.call('HSET', KEYS[1], 'status', 'EXTENDED')
        extended = true
    end
end

if hit_ceiling then
    redis.call('HSET', KEYS[1], 'status', 'COMPLETED')
end

local bid_count = tonumber(redis.call('HGET', KEYS[1], 'bid_count'))
local rank = redis.call('ZREVRANK', KEYS[2], ARGV[2])
if rank then
    rank = rank + 1
end

return cjson.encode({
    code = 1,
    extended = extended,
    hit_ceiling = hit_ceiling,
    new_end_time = new_end_time,
    final_price = new_bid,
    bid_count = bid_count,
    rank = rank,
    stream_id = stream_id
})
`

	persistBufferSize = 4096
	dedupWindowMs     = 500
	stateCacheTTLMs   = 1000
	bidStreamSetKey   = "auction:bid_streams"
	bidStreamGroup    = "bid-persistors"
	bidStreamConsumer = "server"
)

func NewBidService(rdb *redis.Client, db *gorm.DB, aliasService *AliasService, cfg *config.AuctionConfig) *BidService {
	s := &BidService{
		rdb:          rdb,
		db:           db,
		aliasService: aliasService,
		bidScript:    redis.NewScript(bidLuaScript),
		cfg:          cfg,
	}
	go s.streamPersistWorker()
	go s.dedupCleaner()
	return s
}

// PlaceBid is the main entry point for processing a bid.
// Five-layer funnel: memory pre-check → dedup → rate limit → Lua atomic → async persist
func (s *BidService) PlaceBid(ctx context.Context, auctionID, userID uint, amount float64) (*BidResult, error) {
	start := time.Now()
	amountCents := decimalToCents(amount)

	// ── L1: Memory Pre-Validation ──
	if err := s.memoryPreCheck(ctx, auctionID, amountCents); err != nil {
		metrics.BidsTotal.WithLabelValues("rejected_precheck").Inc()
		metrics.BidCacheHits.WithLabelValues("L1_precheck", "rejected").Inc()
		return &BidResult{Accepted: false, Msg: err.Error()}, err
	}
	metrics.BidCacheHits.WithLabelValues("L1_precheck", "passed").Inc()

	// ── L2: Dedup (same user + same amount within 500ms) ──
	if s.isDuplicate(userID, auctionID, amountCents) {
		metrics.BidsTotal.WithLabelValues("rejected_dedup").Inc()
		metrics.BidCacheHits.WithLabelValues("L2_dedup", "rejected").Inc()
		return &BidResult{Accepted: false, Msg: "重复出价，请稍后再试"}, errcode.ErrBidTooFrequent
	}
	metrics.BidCacheHits.WithLabelValues("L2_dedup", "passed").Inc()

	// ── L3: Redis Rate Limit (1 bid/sec/user/auction) ──
	if err := s.checkRateLimit(ctx, userID, auctionID); err != nil {
		metrics.BidsTotal.WithLabelValues("rejected_ratelimit").Inc()
		return &BidResult{Accepted: false, Msg: err.Error()}, err
	}

	// ── L4: Redis Lua Atomic Bid ──
	luaResult, err := s.executeLuaBid(ctx, auctionID, userID, amountCents)
	if err != nil {
		metrics.BidsTotal.WithLabelValues("error").Inc()
		return &BidResult{Accepted: false, Msg: "系统繁忙，请重试"}, err
	}

	bidResult := s.handleLuaResult(luaResult, auctionID)
	if !bidResult.Accepted {
		metrics.BidsTotal.WithLabelValues("rejected_lua").Inc()
		return bidResult, s.luaCodeToError(luaResult.Code)
	}

	metrics.BidsTotal.WithLabelValues("accepted").Inc()
	metrics.BidDuration.Observe(time.Since(start).Seconds())

	// ── L5: Update extend count if extended ──
	if luaResult.Extended {
		s.incrementExtendCount(ctx, auctionID)
	}

	// Update memory cache with latest state
	s.updateStateCache(auctionID, luaResult)

	return bidResult, nil
}

// GetRanking returns the top N bidders for an auction from Redis ZSET
func (s *BidService) GetRanking(ctx context.Context, auctionID uint, topN int64) ([]RankItem, error) {
	key := fmt.Sprintf("auction:%d:ranking", auctionID)

	results, err := s.rdb.ZRevRangeWithScores(ctx, key, 0, topN-1).Result()
	if err != nil {
		return nil, err
	}

	items := make([]RankItem, 0, len(results))
	for i, z := range results {
		uid := parseUint(z.Member.(string))
		alias, _ := s.aliasService.GetOrAssign(ctx, auctionID, uid)
		items = append(items, RankItem{
			Rank:   i + 1,
			UserID: uid,
			Alias:  alias,
			Amount: z.Score / 100, // cents → yuan
		})
	}
	return items, nil
}

// GetUserRank returns the rank and amount for a specific user
func (s *BidService) GetUserRank(ctx context.Context, auctionID, userID uint) (rank int, amount float64, err error) {
	key := fmt.Sprintf("auction:%d:ranking", auctionID)
	userField := fmt.Sprintf("%d", userID)

	r, err := s.rdb.ZRevRank(ctx, key, userField).Result()
	if err == redis.Nil {
		return 0, 0, nil
	}
	if err != nil {
		return 0, 0, err
	}

	score, err := s.rdb.ZScore(ctx, key, userField).Result()
	if err != nil {
		return int(r + 1), 0, nil
	}
	return int(r + 1), score / 100, nil
}

// GetAuctionState reads the current auction state from Redis
func (s *BidService) GetAuctionState(ctx context.Context, auctionID uint) (currentPrice float64, endTime int64, status string, bidCount int, err error) {
	key := fmt.Sprintf("auction:%d:state", auctionID)
	result, err := s.rdb.HGetAll(ctx, key).Result()
	if err != nil || len(result) == 0 {
		return 0, 0, "", 0, fmt.Errorf("auction state not found in redis")
	}

	currentPrice = float64(parseInt64(result["current_price"])) / 100
	endTime = parseInt64(result["end_time"])
	status = result["status"]
	bidCount = int(parseInt64(result["bid_count"]))
	return
}

// InitAuctionState initializes the Redis state when an auction starts.
// Called by StartAuction handler.
func (s *BidService) InitAuctionState(ctx context.Context, auction *model.Auction) error {
	stateKey := fmt.Sprintf("auction:%d:state", auction.ID)
	rankKey := fmt.Sprintf("auction:%d:ranking", auction.ID)

	startPriceCents := decimalToCents(auction.StartingPrice.InexactFloat64())
	startTime := time.Now()
	if auction.ActualStart != nil {
		startTime = *auction.ActualStart
	}
	endTime := startTime.Add(time.Duration(auction.DurationSeconds) * time.Second).UnixMilli()
	if auction.ScheduledEnd != nil {
		endTime = auction.ScheduledEnd.UnixMilli()
	}
	// Total duration cap: max end time = start + 3× original duration
	maxEndTime := startTime.Add(time.Duration(auction.DurationSeconds*3) * time.Second).UnixMilli()

	pipe := s.rdb.Pipeline()
	pipe.HSet(ctx, stateKey, map[string]interface{}{
		"current_price": startPriceCents,
		"end_time":      endTime,
		"max_end_time":  maxEndTime,
		"status":        string(model.StatusActive),
		"winner_id":     0,
		"bid_count":     0,
		"extend_count":  0,
	})
	pipe.Del(ctx, rankKey)
	_, err := pipe.Exec(ctx)
	return err
}

// RebuildAuctionState restores Redis realtime state from DB data when Redis
// state is missing after a restart or cache loss.
func (s *BidService) RebuildAuctionState(ctx context.Context, auction *model.Auction) (int64, error) {
	stateKey := fmt.Sprintf("auction:%d:state", auction.ID)
	rankKey := fmt.Sprintf("auction:%d:ranking", auction.ID)

	endTime := time.Now().UnixMilli()
	if auction.ScheduledEnd != nil {
		endTime = auction.ScheduledEnd.UnixMilli()
	} else if auction.ActualStart != nil {
		endTime = auction.ActualStart.Add(time.Duration(auction.DurationSeconds) * time.Second).UnixMilli()
	}

	startTime := time.Now()
	if auction.ActualStart != nil {
		startTime = *auction.ActualStart
	}
	maxEndTime := startTime.Add(time.Duration(auction.DurationSeconds*3) * time.Second).UnixMilli()

	var bids []model.Bid
	if err := s.db.WithContext(ctx).
		Where("auction_id = ?", auction.ID).
		Order("bid_time ASC").
		Find(&bids).Error; err != nil {
		return 0, err
	}

	currentPriceCents := decimalToCents(auction.StartingPrice.InexactFloat64())
	var winnerID uint
	for _, bid := range bids {
		amountCents := decimalToCents(bid.Amount.InexactFloat64())
		if amountCents >= currentPriceCents {
			currentPriceCents = amountCents
			winnerID = bid.UserID
		}
	}

	pipe := s.rdb.Pipeline()
	pipe.Del(ctx, rankKey)
	for _, bid := range bids {
		pipe.ZAdd(ctx, rankKey, redis.Z{
			Score:  float64(decimalToCents(bid.Amount.InexactFloat64())),
			Member: fmt.Sprintf("%d", bid.UserID),
		})
	}
	pipe.HSet(ctx, stateKey, map[string]interface{}{
		"current_price": currentPriceCents,
		"end_time":      endTime,
		"max_end_time":  maxEndTime,
		"status":        string(auction.Status),
		"winner_id":     winnerID,
		"bid_count":     len(bids),
		"extend_count":  auction.ExtendCount,
	})
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	s.SetAuctionParams(ctx, auction)
	return endTime, nil
}

// CleanupAuctionState removes Redis state for an ended/cancelled auction
func (s *BidService) CleanupAuctionState(ctx context.Context, auctionID uint) {
	stateKey := fmt.Sprintf("auction:%d:state", auctionID)
	rankKey := fmt.Sprintf("auction:%d:ranking", auctionID)
	incrementKey := fmt.Sprintf("auction:%d:increment", auctionID)
	ceilingKey := fmt.Sprintf("auction:%d:ceiling", auctionID)
	s.rdb.Del(ctx, stateKey, rankKey, incrementKey, ceilingKey)
	s.stateCache.Delete(auctionID)
}

// CalcExtendSeconds computes the decayed extension duration based on current extend count.
// Decay formula: max(min_extend_seconds, default - extendCount * decay)
func (s *BidService) CalcExtendSeconds(extendCount int) int {
	if extendCount >= s.cfg.MaxExtendCount {
		return 0
	}
	sec := s.cfg.DefaultExtendSeconds - extendCount*s.cfg.DecayPerExtend
	if sec < s.cfg.MinExtendSeconds {
		sec = s.cfg.MinExtendSeconds
	}
	return sec
}

// ─── Internal Methods ────────────────────────────────────────────────────────

func (s *BidService) memoryPreCheck(ctx context.Context, auctionID uint, amountCents int64) error {
	state := s.getCachedState(ctx, auctionID)
	if state == nil {
		return nil // cache miss: skip pre-check, let Lua do the validation
	}

	if state.Status != "ACTIVE" && state.Status != "EXTENDED" {
		return errcode.ErrAuctionNotActive
	}

	now := time.Now().UnixMilli()
	if now > state.EndTime {
		return errcode.ErrAuctionEnded
	}

	if amountCents <= state.CurrentPrice {
		return errcode.ErrBidTooLow
	}

	return nil
}

func (s *BidService) getCachedState(ctx context.Context, auctionID uint) *cachedAuctionState {
	if v, ok := s.stateCache.Load(auctionID); ok {
		state := v.(*cachedAuctionState)
		if time.Now().UnixMilli()-state.FetchedAt < stateCacheTTLMs {
			return state
		}
	}

	// Refresh from Redis (non-blocking best-effort)
	key := fmt.Sprintf("auction:%d:state", auctionID)
	result, err := s.rdb.HGetAll(ctx, key).Result()
	if err != nil || len(result) == 0 {
		return nil
	}

	state := &cachedAuctionState{
		CurrentPrice: parseInt64(result["current_price"]),
		Status:       result["status"],
		EndTime:      parseInt64(result["end_time"]),
		FetchedAt:    time.Now().UnixMilli(),
	}
	s.stateCache.Store(auctionID, state)
	return state
}

func (s *BidService) updateStateCache(auctionID uint, result *LuaBidResult) {
	state := &cachedAuctionState{
		CurrentPrice: result.FinalPrice,
		EndTime:      result.NewEndTime,
		FetchedAt:    time.Now().UnixMilli(),
	}
	if result.Extended {
		state.Status = "EXTENDED"
	} else if result.HitCeiling {
		state.Status = "COMPLETED"
	} else {
		state.Status = "ACTIVE"
	}
	s.stateCache.Store(auctionID, state)
}

func (s *BidService) isDuplicate(userID, auctionID uint, amountCents int64) bool {
	key := fmt.Sprintf("%d:%d:%d", userID, auctionID, amountCents)
	now := time.Now().UnixMilli()

	if v, ok := s.dedupMap.Load(key); ok {
		lastTs := v.(int64)
		if now-lastTs < dedupWindowMs {
			return true
		}
	}
	s.dedupMap.Store(key, now)
	return false
}

func (s *BidService) checkRateLimit(ctx context.Context, userID, auctionID uint) error {
	key := fmt.Sprintf("rate:bid:u:%d:%d", userID, auctionID)
	ok, err := s.rdb.SetNX(ctx, key, 1, 1*time.Second).Result()
	if err != nil {
		zap.L().Warn("rate limit redis error, allowing bid", zap.Error(err))
		return nil
	}
	if !ok {
		return errcode.ErrBidTooFrequent
	}
	return nil
}

func (s *BidService) executeLuaBid(ctx context.Context, auctionID, userID uint, amountCents int64) (*LuaBidResult, error) {
	stateKey := fmt.Sprintf("auction:%d:state", auctionID)
	rankKey := fmt.Sprintf("auction:%d:ranking", auctionID)
	streamKey := s.bidStreamKey(auctionID)

	// Get current extend count to calculate decayed extend seconds
	extendCount := s.getExtendCount(ctx, auctionID)
	extendSec := s.CalcExtendSeconds(extendCount)

	// Get auction increment from DB cache or Redis
	incrementCents := s.getIncrementCents(ctx, auctionID)
	ceilingCents := s.getCeilingCents(ctx, auctionID)

	now := time.Now().UnixMilli()

	result, err := s.bidScript.Run(ctx, s.rdb,
		[]string{stateKey, rankKey, streamKey, bidStreamSetKey},
		amountCents,
		userID,
		now,
		extendSec,
		incrementCents,
		ceilingCents,
		auctionID,
	).Result()
	if err != nil {
		zap.L().Error("lua bid script failed", zap.Error(err), zap.Uint("auctionId", auctionID))
		return nil, err
	}

	var luaResult LuaBidResult
	if err := json.Unmarshal([]byte(result.(string)), &luaResult); err != nil {
		zap.L().Error("failed to parse lua bid result", zap.Error(err), zap.Any("raw", result))
		return nil, err
	}

	return &luaResult, nil
}

func (s *BidService) handleLuaResult(result *LuaBidResult, auctionID uint) *BidResult {
	switch result.Code {
	case 1: // success
		bidResult := &BidResult{
			Accepted:     true,
			Amount:       float64(result.FinalPrice) / 100,
			Rank:         result.Rank,
			CurrentPrice: float64(result.FinalPrice) / 100,
			MinNextBid:   float64(result.FinalPrice+s.getIncrementCents(context.Background(), auctionID)) / 100,
			HitCeiling:   result.HitCeiling,
		}
		if result.Extended {
			bidResult.NewEndTime = &result.NewEndTime
		}
		return bidResult
	case -1:
		return &BidResult{
			Accepted:     false,
			CurrentPrice: float64(result.CurrentPrice) / 100,
			Msg:          "出价太低",
		}
	case -2:
		return &BidResult{Accepted: false, Msg: "竞拍未在进行中"}
	case -3:
		return &BidResult{Accepted: false, Msg: "竞拍已结束"}
	case -4:
		return &BidResult{Accepted: false, Msg: "你已经是最高价了"}
	default:
		return &BidResult{Accepted: false, Msg: "出价失败"}
	}
}

func (s *BidService) luaCodeToError(code int) error {
	switch code {
	case -1:
		return errcode.ErrBidTooLow
	case -2:
		return errcode.ErrAuctionNotActive
	case -3:
		return errcode.ErrAuctionEnded
	case -4:
		return errcode.ErrAlreadyHighestBidder
	default:
		return fmt.Errorf("bid failed with code %d", code)
	}
}

func (s *BidService) getExtendCount(ctx context.Context, auctionID uint) int {
	return s.GetExtendCount(ctx, auctionID)
}

// GetExtendCount returns the current extend count for an auction from Redis.
func (s *BidService) GetExtendCount(ctx context.Context, auctionID uint) int {
	key := fmt.Sprintf("auction:%d:state", auctionID)
	val, err := s.rdb.HGet(ctx, key, "extend_count").Int()
	if err != nil {
		return 0
	}
	return val
}

func (s *BidService) incrementExtendCount(ctx context.Context, auctionID uint) {
	key := fmt.Sprintf("auction:%d:state", auctionID)
	s.rdb.HIncrBy(ctx, key, "extend_count", 1)
}

// getIncrementCents reads the auction's increment_amount from a simple Redis key.
// This is set during InitAuctionState or looked up from DB.
func (s *BidService) getIncrementCents(ctx context.Context, auctionID uint) int64 {
	key := fmt.Sprintf("auction:%d:increment", auctionID)
	val, err := s.rdb.Get(ctx, key).Int64()
	if err == nil {
		return val
	}

	// Fallback: read from DB and cache in Redis
	var auction model.Auction
	if err := s.db.Select("increment_amount").First(&auction, auctionID).Error; err != nil {
		return 100 // default 1 yuan = 100 cents
	}
	cents := decimalToCents(auction.IncrementAmount.InexactFloat64())
	s.rdb.Set(ctx, key, cents, 2*time.Hour)
	return cents
}

// getCeilingCents reads the auction's ceiling_price.
func (s *BidService) getCeilingCents(ctx context.Context, auctionID uint) int64 {
	key := fmt.Sprintf("auction:%d:ceiling", auctionID)
	val, err := s.rdb.Get(ctx, key).Int64()
	if err == nil {
		return val
	}

	var auction model.Auction
	if err := s.db.Select("ceiling_price").First(&auction, auctionID).Error; err != nil {
		return 0
	}
	if auction.CeilingPrice == nil {
		s.rdb.Set(ctx, key, 0, 2*time.Hour)
		return 0
	}
	cents := decimalToCents(auction.CeilingPrice.InexactFloat64())
	s.rdb.Set(ctx, key, cents, 2*time.Hour)
	return cents
}

// SetAuctionParams caches increment and ceiling in Redis for fast Lua access.
// Called during InitAuctionState.
func (s *BidService) SetAuctionParams(ctx context.Context, auction *model.Auction) {
	incrementKey := fmt.Sprintf("auction:%d:increment", auction.ID)
	ceilingKey := fmt.Sprintf("auction:%d:ceiling", auction.ID)

	incrementCents := decimalToCents(auction.IncrementAmount.InexactFloat64())
	s.rdb.Set(ctx, incrementKey, incrementCents, 24*time.Hour)

	var ceilingCents int64
	if auction.CeilingPrice != nil {
		ceilingCents = decimalToCents(auction.CeilingPrice.InexactFloat64())
	}
	s.rdb.Set(ctx, ceilingKey, ceilingCents, 24*time.Hour)
}

func (s *BidService) bidStreamKey(auctionID uint) string {
	return fmt.Sprintf("auction:%d:bid_stream", auctionID)
}

func (s *BidService) streamPersistWorker() {
	ctx := context.Background()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		streams, err := s.rdb.SMembers(ctx, bidStreamSetKey).Result()
		if err != nil {
			zap.L().Warn("failed to list bid streams", zap.Error(err))
			continue
		}
		for _, stream := range streams {
			s.consumeBidStream(ctx, stream)
		}
	}
}

func (s *BidService) consumeBidStream(ctx context.Context, stream string) {
	if err := s.ensureBidStreamGroup(ctx, stream); err != nil {
		zap.L().Warn("failed to ensure bid stream group", zap.String("stream", stream), zap.Error(err))
		return
	}

	// First retry messages previously delivered to this stable consumer.
	s.readBidStream(ctx, stream, "0")

	// Then claim stale pending messages that may belong to a previous worker.
	s.claimStaleBidMessages(ctx, stream)

	// Finally consume new accepted bids.
	s.readBidStream(ctx, stream, ">")
}

func (s *BidService) ensureBidStreamGroup(ctx context.Context, stream string) error {
	err := s.rdb.XGroupCreateMkStream(ctx, stream, bidStreamGroup, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return err
	}
	return nil
}

func (s *BidService) readBidStream(ctx context.Context, stream, id string) {
	streams, err := s.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    bidStreamGroup,
		Consumer: bidStreamConsumer,
		Streams:  []string{stream, id},
		Count:    64,
		Block:    -1,
	}).Result()
	if err == redis.Nil {
		return
	}
	if err != nil {
		zap.L().Warn("failed to read bid stream", zap.String("stream", stream), zap.String("id", id), zap.Error(err))
		return
	}

	for _, xs := range streams {
		for _, msg := range xs.Messages {
			s.persistBidMessage(ctx, stream, msg)
		}
	}
}

func (s *BidService) claimStaleBidMessages(ctx context.Context, stream string) {
	start := "0-0"
	for {
		messages, next, err := s.rdb.XAutoClaim(ctx, &redis.XAutoClaimArgs{
			Stream:   stream,
			Group:    bidStreamGroup,
			Consumer: bidStreamConsumer,
			MinIdle:  5 * time.Second,
			Start:    start,
			Count:    64,
		}).Result()
		if err == redis.Nil {
			return
		}
		if err != nil {
			zap.L().Warn("failed to claim stale bid stream messages", zap.String("stream", stream), zap.Error(err))
			return
		}
		for _, msg := range messages {
			s.persistBidMessage(ctx, stream, msg)
		}
		if next == "0-0" || len(messages) == 0 {
			return
		}
		start = next
	}
}

func (s *BidService) persistBidMessage(ctx context.Context, stream string, msg redis.XMessage) {
	bid, err := bidFromStreamMessage(stream, msg)
	if err != nil {
		zap.L().Error("invalid bid stream message", zap.String("stream", stream), zap.String("id", msg.ID), zap.Error(err))
		return
	}

	err = s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "persist_key"}},
		DoNothing: true,
	}).Create(bid).Error
	if err != nil {
		zap.L().Error("failed to persist bid stream message",
			zap.String("stream", stream),
			zap.String("id", msg.ID),
			zap.Error(err),
		)
		return
	}

	if err := s.rdb.XAck(ctx, stream, bidStreamGroup, msg.ID).Err(); err != nil {
		zap.L().Warn("failed to ack persisted bid message",
			zap.String("stream", stream),
			zap.String("id", msg.ID),
			zap.Error(err),
		)
	}
}

func bidFromStreamMessage(stream string, msg redis.XMessage) (*model.Bid, error) {
	auctionID, err := streamUint(msg.Values["auction_id"])
	if err != nil {
		return nil, fmt.Errorf("auction_id: %w", err)
	}
	userID, err := streamUint(msg.Values["user_id"])
	if err != nil {
		return nil, fmt.Errorf("user_id: %w", err)
	}
	amountCents, err := streamInt64(msg.Values["amount_cents"])
	if err != nil {
		return nil, fmt.Errorf("amount_cents: %w", err)
	}
	bidTimeMs, err := streamInt64(msg.Values["bid_time_ms"])
	if err != nil {
		return nil, fmt.Errorf("bid_time_ms: %w", err)
	}

	return &model.Bid{
		AuctionID:  auctionID,
		UserID:     userID,
		Amount:     decimal.NewFromInt(amountCents).Div(decimal.NewFromInt(100)),
		BidTime:    time.UnixMilli(bidTimeMs),
		IsWinning:  true,
		PersistKey: fmt.Sprintf("%s:%s", stream, msg.ID),
	}, nil
}

func streamUint(v any) (uint, error) {
	n, err := streamInt64(v)
	if err != nil {
		return 0, err
	}
	if n < 0 {
		return 0, fmt.Errorf("negative value %d", n)
	}
	return uint(n), nil
}

func streamInt64(v any) (int64, error) {
	switch value := v.(type) {
	case int64:
		return value, nil
	case int:
		return int64(value), nil
	case string:
		return strconv.ParseInt(value, 10, 64)
	case []byte:
		return strconv.ParseInt(string(value), 10, 64)
	default:
		return 0, fmt.Errorf("unsupported value type %T", v)
	}
}

func (s *BidService) dedupCleaner() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now().UnixMilli()
		s.dedupMap.Range(func(key, value any) bool {
			if now-value.(int64) > dedupWindowMs*2 {
				s.dedupMap.Delete(key)
			}
			return true
		})
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func decimalToCents(yuan float64) int64 {
	return decimal.NewFromFloat(yuan).Mul(decimal.NewFromInt(100)).IntPart()
}

func parseUint(s string) uint {
	var n uint
	fmt.Sscanf(s, "%d", &n)
	return n
}

func parseInt64(s string) int64 {
	var n int64
	fmt.Sscanf(s, "%d", &n)
	return n
}
