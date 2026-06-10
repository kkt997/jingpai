package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

// ─── Config ──────────────────────────────────────────────────────────────────

type Config struct {
	BaseURL       string
	RedisAddr     string
	NumUsers      int
	BidsPerUser   int
	BidIntervalMs int
	RampUpMs      int
	AuctionMode   string // OPEN or BLIND
	StartingPrice float64
	Increment     float64
	Duration      int // auction duration in seconds
}

func parseFlags() *Config {
	cfg := &Config{}
	flag.StringVar(&cfg.BaseURL, "url", "http://localhost:8080", "后端服务地址")
	flag.StringVar(&cfg.RedisAddr, "redis", "localhost:6379", "Redis 地址")
	flag.IntVar(&cfg.NumUsers, "users", 100, "模拟并发用户数")
	flag.IntVar(&cfg.BidsPerUser, "bids", 10, "每个用户出价次数")
	flag.IntVar(&cfg.BidIntervalMs, "interval", 1100, "每次出价间隔(ms)，需 >1000 以避免限流")
	flag.IntVar(&cfg.RampUpMs, "rampup", 5000, "所有用户连接的爬坡时间(ms)")
	flag.StringVar(&cfg.AuctionMode, "mode", "OPEN", "竞拍模式: OPEN / BLIND")
	flag.Float64Var(&cfg.StartingPrice, "price", 100, "起拍价(元)")
	flag.Float64Var(&cfg.Increment, "incr", 10, "加价幅度(元)")
	flag.IntVar(&cfg.Duration, "duration", 300, "竞拍时长(秒)，设长一点防止压测期间结束")
	flag.Parse()
	return cfg
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

type apiResponse struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

func httpPost(url string, body any, token string) (*apiResponse, error) {
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	var r apiResponse
	json.Unmarshal(data, &r)
	return &r, nil
}

func httpPut(url string, body any, token string) (*apiResponse, error) {
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest("PUT", url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	var r apiResponse
	json.Unmarshal(data, &r)
	return &r, nil
}

func httpGet(rawURL string, token string) (*apiResponse, error) {
	req, _ := http.NewRequest("GET", rawURL, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	var r apiResponse
	json.Unmarshal(data, &r)
	return &r, nil
}

// ─── Data structs ────────────────────────────────────────────────────────────

type userInfo struct {
	ID    uint   `json:"id"`
	Token string `json:"token"`
}

type wsMsg struct {
	Type string          `json:"type"`
	Seq  uint64          `json:"seq,omitempty"`
	Code int             `json:"code"`
	Msg  string          `json:"msg,omitempty"`
	Data json.RawMessage `json:"data,omitempty"`
	Ts   int64           `json:"ts,omitempty"`
}

type wsSend struct {
	Type    string `json:"type"`
	Seq     uint64 `json:"seq"`
	Payload any    `json:"payload"`
}

// ─── Statistics ──────────────────────────────────────────────────────────────

type Stats struct {
	mu           sync.Mutex
	totalBids    int64
	accepted     int64
	rejected     int64
	errors       int64
	latencies    []time.Duration
	errorReasons map[string]int64
	startTime    time.Time
}

func newStats() *Stats {
	return &Stats{
		errorReasons: make(map[string]int64),
		startTime:    time.Now(),
	}
}

func (s *Stats) record(latency time.Duration, accepted bool, errMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.totalBids++
	s.latencies = append(s.latencies, latency)
	if errMsg != "" {
		s.errors++
		s.errorReasons[errMsg]++
	} else if accepted {
		s.accepted++
	} else {
		s.rejected++
	}
}

func (s *Stats) report() {
	s.mu.Lock()
	defer s.mu.Unlock()

	elapsed := time.Since(s.startTime).Seconds()

	fmt.Println("\n" + strings.Repeat("═", 60))
	fmt.Println("  竞拍系统并发压测报告")
	fmt.Println(strings.Repeat("═", 60))

	fmt.Printf("\n📊 总览\n")
	fmt.Printf("  总出价请求:   %d\n", s.totalBids)
	fmt.Printf("  出价成功:     %d (%.1f%%)\n", s.accepted, pct(s.accepted, s.totalBids))
	fmt.Printf("  出价被拒:     %d (%.1f%%)\n", s.rejected, pct(s.rejected, s.totalBids))
	fmt.Printf("  出价异常:     %d (%.1f%%)\n", s.errors, pct(s.errors, s.totalBids))
	fmt.Printf("  总耗时:       %.1fs\n", elapsed)
	if elapsed > 0 {
		fmt.Printf("  吞吐量(QPS):  %.1f bids/sec\n", float64(s.totalBids)/elapsed)
	}

	if len(s.latencies) > 0 {
		sort.Slice(s.latencies, func(i, j int) bool { return s.latencies[i] < s.latencies[j] })
		fmt.Printf("\n⏱️  延迟分布 (出价→收到结果)\n")
		fmt.Printf("  Min:    %v\n", s.latencies[0])
		fmt.Printf("  P50:    %v\n", s.percentile(50))
		fmt.Printf("  P90:    %v\n", s.percentile(90))
		fmt.Printf("  P95:    %v\n", s.percentile(95))
		fmt.Printf("  P99:    %v\n", s.percentile(99))
		fmt.Printf("  Max:    %v\n", s.latencies[len(s.latencies)-1])
		fmt.Printf("  Avg:    %v\n", s.avg())
	}

	if len(s.errorReasons) > 0 {
		fmt.Printf("\n❌ 错误/拒绝分布\n")
		type kv struct {
			k string
			v int64
		}
		sorted := make([]kv, 0, len(s.errorReasons))
		for k, v := range s.errorReasons {
			sorted = append(sorted, kv{k, v})
		}
		sort.Slice(sorted, func(i, j int) bool { return sorted[i].v > sorted[j].v })
		for _, item := range sorted {
			fmt.Printf("  %-30s %d\n", item.k, item.v)
		}
	}

	fmt.Println(strings.Repeat("═", 60))
}

func (s *Stats) percentile(p float64) time.Duration {
	if len(s.latencies) == 0 {
		return 0
	}
	idx := int(math.Ceil(p/100*float64(len(s.latencies)))) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(s.latencies) {
		idx = len(s.latencies) - 1
	}
	return s.latencies[idx]
}

func (s *Stats) avg() time.Duration {
	if len(s.latencies) == 0 {
		return 0
	}
	var total time.Duration
	for _, l := range s.latencies {
		total += l
	}
	return total / time.Duration(len(s.latencies))
}

func pct(a, b int64) float64 {
	if b == 0 {
		return 0
	}
	return float64(a) / float64(b) * 100
}

// ─── Main ────────────────────────────────────────────────────────────────────

func main() {
	cfg := parseFlags()

	fmt.Println(strings.Repeat("═", 60))
	fmt.Println("  竞拍大师 — 并发压测工具")
	fmt.Println(strings.Repeat("═", 60))
	fmt.Printf("  服务地址:   %s\n", cfg.BaseURL)
	fmt.Printf("  并发用户:   %d\n", cfg.NumUsers)
	fmt.Printf("  每人出价:   %d 次\n", cfg.BidsPerUser)
	fmt.Printf("  出价间隔:   %d ms\n", cfg.BidIntervalMs)
	fmt.Printf("  竞拍模式:   %s\n", cfg.AuctionMode)
	fmt.Printf("  起拍价:     %.0f 元\n", cfg.StartingPrice)
	fmt.Printf("  加价幅度:   %.0f 元\n", cfg.Increment)
	fmt.Println(strings.Repeat("─", 60))

	// ── Phase 0: 连接 Redis，清理限流 ──
	rdb := redis.NewClient(&redis.Options{Addr: cfg.RedisAddr})
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Redis 连接失败 (%s): %v", cfg.RedisAddr, err)
	}
	fmt.Printf("  Redis 连接成功: %s\n", cfg.RedisAddr)

	// Clear all rate limit keys to allow batch registration
	clearRateLimits(rdb, ctx)
	fmt.Println("  已清理限流计数器")

	// ── Phase 1: 注册商家 + 批量注册用户 ──
	fmt.Println("\n[Phase 1] 注册测试用户...")

	// Use a run-unique prefix to avoid conflicts with previous runs or existing data
	runID := time.Now().Unix() % 100000 // 5-digit run ID

	merchantPhone := fmt.Sprintf("199%08d", runID)
	merchant := registerUser(cfg.BaseURL, fmt.Sprintf("lt_m_%d", runID), merchantPhone, "test123456", "MERCHANT")
	fmt.Printf("  商家注册成功: ID=%d\n", merchant.ID)

	users := make([]userInfo, cfg.NumUsers)
	var wg sync.WaitGroup
	var mu sync.Mutex
	var regOk int64

	// Register in small batches; rate limit = 5/min/IP, so register 4 then clear
	batchSize := 4
	for batchStart := 0; batchStart < cfg.NumUsers; batchStart += batchSize {
		batchEnd := batchStart + batchSize
		if batchEnd > cfg.NumUsers {
			batchEnd = cfg.NumUsers
		}

		clearRateLimits(rdb, ctx)

		for i := batchStart; i < batchEnd; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				// phone: 177 + 3-digit runID + 5-digit idx = 11 digits
				phone := fmt.Sprintf("177%03d%05d", runID%1000, idx)
				nickname := fmt.Sprintf("lt_%d_%d", runID%1000, idx)
				u := registerUser(cfg.BaseURL, nickname, phone, "test123456", "USER")
				mu.Lock()
				users[idx] = u
				mu.Unlock()
				atomic.AddInt64(&regOk, 1)
			}(i)
		}
		wg.Wait()

		if batchEnd < cfg.NumUsers && batchEnd%100 == 0 {
			fmt.Printf("  已注册 %d/%d 用户...\n", batchEnd, cfg.NumUsers)
		}
	}
	fmt.Printf("  用户注册完成: %d/%d\n", regOk, cfg.NumUsers)

	// ── Phase 2: 商家创建商品 → 直播间 → 竞拍 → 开播 → 开始竞拍 ──
	fmt.Println("\n[Phase 2] 创建竞拍环境...")

	productID := createProduct(cfg.BaseURL, merchant.Token)
	fmt.Printf("  商品创建成功: ID=%d\n", productID)

	listProduct(cfg.BaseURL, merchant.Token, productID)
	fmt.Println("  商品已上架")

	roomID := createRoom(cfg.BaseURL, merchant.Token)
	fmt.Printf("  直播间创建成功: ID=%d\n", roomID)

	startRoom(cfg.BaseURL, merchant.Token, roomID)
	fmt.Println("  直播间已开播")

	auctionID := createAuction(cfg.BaseURL, merchant.Token, productID, roomID, cfg)
	fmt.Printf("  竞拍创建成功: ID=%d\n", auctionID)

	startAuction(cfg.BaseURL, merchant.Token, auctionID)
	fmt.Println("  竞拍已开始！")

	time.Sleep(500 * time.Millisecond)

	// ── Phase 3: WebSocket 并发连接 + 加入房间 ──
	fmt.Println("\n[Phase 3] 建立 WebSocket 连接...")

	clearRateLimits(rdb, ctx)

	wsURL := buildWSURL(cfg.BaseURL)
	conns := make([]*websocket.Conn, cfg.NumUsers)
	var connOk int64

	// Connect in batches to avoid hitting API rate limit (200/10s/IP)
	wsBatchSize := 50
	for batchStart := 0; batchStart < cfg.NumUsers; batchStart += wsBatchSize {
		batchEnd := batchStart + wsBatchSize
		if batchEnd > cfg.NumUsers {
			batchEnd = cfg.NumUsers
		}

		clearRateLimits(rdb, ctx)

		rampDelay := time.Duration(cfg.RampUpMs/((cfg.NumUsers/wsBatchSize)+1)) * time.Millisecond / time.Duration(wsBatchSize)

		for i := batchStart; i < batchEnd; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				time.Sleep(rampDelay * time.Duration(idx-batchStart))

				conn := connectWS(wsURL, users[idx].Token)
				if conn == nil {
					return
				}
				mu.Lock()
				conns[idx] = conn
				mu.Unlock()
				atomic.AddInt64(&connOk, 1)

				joinRoom(conn, roomID, 1)
				time.Sleep(200 * time.Millisecond)
			}(i)
		}
		wg.Wait()
	}
	fmt.Printf("  WebSocket 连接成功: %d/%d\n", connOk, cfg.NumUsers)

	// ── Phase 4: 并发出价压测 ──
	clearRateLimits(rdb, ctx)
	fmt.Printf("\n[Phase 4] 开始并发出价压测 (%d 用户 × %d 次出价)...\n", cfg.NumUsers, cfg.BidsPerUser)

	stats := newStats()
	var bidSeq atomic.Uint64

	// Track global current price for realistic bidding
	var currentPrice atomic.Int64
	currentPrice.Store(int64(cfg.StartingPrice * 100))

	for i := 0; i < cfg.NumUsers; i++ {
		if conns[i] == nil {
			continue
		}
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			conn := conns[idx]

			// Start reader goroutine to collect responses
			results := make(chan *wsMsg, cfg.BidsPerUser*2)
			go func() {
				for {
					var msg wsMsg
					if err := conn.ReadJSON(&msg); err != nil {
						close(results)
						return
					}
					if msg.Type == "bid_result" {
						results <- &msg
					}
				}
			}()

			for b := 0; b < cfg.BidsPerUser; b++ {
				seq := bidSeq.Add(1)

				// Calculate bid: current price + increment + small random to spread out
				cp := float64(currentPrice.Load()) / 100
				bidAmount := cp + cfg.Increment + float64(rand.Intn(int(cfg.Increment)))

				start := time.Now()

				conn.WriteJSON(wsSend{
					Type: "bid",
					Seq:  seq,
					Payload: map[string]any{
						"auctionId": auctionID,
						"amount":    bidAmount,
					},
				})

				// Wait for result with timeout
				select {
				case msg, ok := <-results:
					latency := time.Since(start)
					if !ok {
						stats.record(latency, false, "ws_closed")
						return
					}
					if msg.Code == 0 {
						stats.record(latency, true, "")
						// Update shared current price
						var data map[string]any
						json.Unmarshal(msg.Data, &data)
						if cp, ok := data["currentPrice"].(float64); ok {
							newCents := int64(cp * 100)
							for {
								old := currentPrice.Load()
								if newCents <= old || currentPrice.CompareAndSwap(old, newCents) {
									break
								}
							}
						}
					} else {
						reason := extractReason(msg)
						stats.record(latency, false, reason)
					}
				case <-time.After(5 * time.Second):
					stats.record(5*time.Second, false, "timeout")
				}

				// Wait between bids (must > 1s to respect rate limit)
				jitter := rand.Intn(200)
				time.Sleep(time.Duration(cfg.BidIntervalMs+jitter) * time.Millisecond)
			}
		}(i)
	}

	wg.Wait()

	// ── Phase 5: 输出报告 ──
	stats.report()

	// Cleanup: close all connections
	for _, conn := range conns {
		if conn != nil {
			conn.Close()
		}
	}
}

// ─── Phase helpers ───────────────────────────────────────────────────────────

func registerUser(baseURL, nickname, phone, password, role string) userInfo {
	var lastErr string
	// Retry up to 3 times
	for attempt := 0; attempt < 3; attempt++ {
		resp, err := httpPost(baseURL+"/api/auth/register", map[string]string{
			"nickname": nickname,
			"phone":    phone,
			"password": password,
			"role":     role,
		}, "")

		if err != nil {
			lastErr = fmt.Sprintf("http error: %v", err)
			time.Sleep(200 * time.Millisecond)
			continue
		}

		if resp.Code == 0 {
			var data struct {
				User  struct{ ID uint } `json:"user"`
				Token string            `json:"token"`
			}
			json.Unmarshal(resp.Data, &data)
			return userInfo{ID: data.User.ID, Token: data.Token}
		}

		// Already registered or other error, try login
		resp, err = httpPost(baseURL+"/api/auth/login", map[string]string{
			"account":  phone,
			"password": password,
		}, "")
		if err != nil {
			lastErr = fmt.Sprintf("login http error: %v", err)
			time.Sleep(200 * time.Millisecond)
			continue
		}
		if resp.Code == 0 {
			var data struct {
				User  struct{ ID uint } `json:"user"`
				Token string            `json:"token"`
			}
			json.Unmarshal(resp.Data, &data)
			return userInfo{ID: data.User.ID, Token: data.Token}
		}
		lastErr = fmt.Sprintf("code=%d msg=%s", resp.Code, resp.Msg)
		time.Sleep(200 * time.Millisecond)
	}
	log.Fatalf("注册/登录失败 (%s): %s", nickname, lastErr)
	return userInfo{}
}

func createProduct(baseURL, token string) uint {
	resp, err := httpPost(baseURL+"/api/merchant/products", map[string]any{
		"title":       "压测商品-" + fmt.Sprint(time.Now().Unix()),
		"description": "并发压测专用商品",
		"category":    "珠宝",
		"images":      []string{"https://placeholder.co/400"},
	}, token)
	if err != nil {
		log.Fatalf("创建商品失败: %v", err)
	}
	if resp.Code != 0 {
		log.Fatalf("创建商品失败: %s", resp.Msg)
	}
	var data map[string]any
	json.Unmarshal(resp.Data, &data)
	return uint(data["id"].(float64))
}

func createRoom(baseURL, token string) uint {
	resp, err := httpPost(baseURL+"/api/merchant/rooms", map[string]any{
		"title":     "压测直播间-" + fmt.Sprint(time.Now().Unix()),
		"streamUrl": "https://example.com/stream",
	}, token)
	if err != nil {
		log.Fatalf("创建直播间失败: %v", err)
	}
	if resp.Code != 0 {
		log.Fatalf("创建直播间失败: %s", resp.Msg)
	}
	var data map[string]any
	json.Unmarshal(resp.Data, &data)
	return uint(data["id"].(float64))
}

func listProduct(baseURL, token string, productID uint) {
	resp, err := httpPut(fmt.Sprintf("%s/api/merchant/products/%d/list", baseURL, productID), nil, token)
	if err != nil {
		log.Fatalf("上架商品失败: %v", err)
	}
	if resp.Code != 0 {
		log.Fatalf("上架商品失败: %s", resp.Msg)
	}
}

func startRoom(baseURL, token string, roomID uint) {
	resp, err := httpPut(fmt.Sprintf("%s/api/merchant/rooms/%d/start", baseURL, roomID), nil, token)
	if err != nil {
		log.Fatalf("开播失败: %v", err)
	}
	if resp.Code != 0 {
		log.Fatalf("开播失败: %s", resp.Msg)
	}
}

func createAuction(baseURL, token string, productID, roomID uint, cfg *Config) uint {
	resp, err := httpPost(baseURL+"/api/merchant/auctions", map[string]any{
		"productId":        productID,
		"roomId":           roomID,
		"mode":             cfg.AuctionMode,
		"startingPrice":    cfg.StartingPrice,
		"incrementAmount":  cfg.Increment,
		"durationSeconds":  cfg.Duration,
		"autoExtendSeconds": 20,
		"depositAmount":    0,
	}, token)
	if err != nil {
		log.Fatalf("创建竞拍失败: %v", err)
	}
	if resp.Code != 0 {
		log.Fatalf("创建竞拍失败: %s", resp.Msg)
	}
	var data map[string]any
	json.Unmarshal(resp.Data, &data)
	return uint(data["id"].(float64))
}

func startAuction(baseURL, token string, auctionID uint) {
	resp, err := httpPut(fmt.Sprintf("%s/api/merchant/auctions/%d/start", baseURL, auctionID), nil, token)
	if err != nil {
		log.Fatalf("开始竞拍失败: %v", err)
	}
	if resp.Code != 0 {
		log.Fatalf("开始竞拍失败: %s", resp.Msg)
	}
}

func buildWSURL(baseURL string) string {
	u, _ := url.Parse(baseURL)
	scheme := "ws"
	if u.Scheme == "https" {
		scheme = "wss"
	}
	return fmt.Sprintf("%s://%s/ws", scheme, u.Host)
}

func connectWS(wsURL, token string) *websocket.Conn {
	fullURL := fmt.Sprintf("%s?token=%s", wsURL, token)
	conn, _, err := websocket.DefaultDialer.Dial(fullURL, nil)
	if err != nil {
		log.Printf("WebSocket 连接失败: %v", err)
		return nil
	}
	return conn
}

func joinRoom(conn *websocket.Conn, roomID uint, seq uint64) {
	conn.WriteJSON(wsSend{
		Type: "join_room",
		Seq:  seq,
		Payload: map[string]any{
			"roomId": roomID,
		},
	})
}

func extractReason(msg *wsMsg) string {
	if msg.Data != nil {
		var data map[string]any
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			if m, ok := data["msg"].(string); ok && m != "" {
				return m
			}
		}
	}
	if msg.Msg != "" {
		return msg.Msg
	}
	return fmt.Sprintf("code_%d", msg.Code)

}

func clearRateLimits(rdb *redis.Client, ctx context.Context) {
	iter := rdb.Scan(ctx, 0, "rate:*", 1000).Iterator()
	var keys []string
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if len(keys) > 0 {
		rdb.Del(ctx, keys...)
	}
}

func init() {
	http.DefaultTransport.(*http.Transport).MaxIdleConns = 1000
	http.DefaultTransport.(*http.Transport).MaxIdleConnsPerHost = 1000
	http.DefaultTransport.(*http.Transport).MaxConnsPerHost = 0

	log.SetFlags(log.Ltime)

	if os.Getenv("GOMAXPROCS") == "" {
		fmt.Println("提示: 可设置 GOMAXPROCS 调整并发性能")
	}
}
