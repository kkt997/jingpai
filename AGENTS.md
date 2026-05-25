# 竞拍大师 — 技术设计文档

## 1. 项目概述

「实时竞拍大师」是一个抖音电商直播竞拍全栈系统，支持商家在直播间内对高价值商品（珠宝、艺术品、二手奢侈品）发起实时竞拍，用户通过 H5 页面参与出价。系统核心目标：**高并发、实时同步、零数据差错**。

## 2. 技术选型

| 层级 | 技术 | 选型理由 |
|------|------|---------|
| 前端框架 | React 19 + TypeScript | 组件化开发，类型安全，生态成熟 |
| 前端构建 | Vite 6 | 毫秒级 HMR，开发体验极佳 |
| 前端样式 | TailwindCSS 3 | 原子化 CSS，快速搭建 UI |
| 前端动画 | Framer Motion | 竞拍氛围动画（领先/被超越/延时提示） |
| 状态管理 | Zustand 5 | 轻量级，天然支持 WebSocket 外部更新 Store |
| 前端 Monorepo | pnpm workspace | shared/mobile/merchant 三包架构，共享类型和 WS 客户端 |
| 后端语言 | Go 1.22+ | Goroutine 天然适配万级 WebSocket 长连接场景 |
| Web 框架 | Gin | 高性能 HTTP 路由，中间件生态丰富 |
| ORM | GORM | AutoMigrate 开发期自动建表，关联查询便捷 |
| 关系数据库 | MySQL 8.0 | 核心业务数据持久化，事务保障 |
| 缓存/热数据 | Redis 7 | 竞拍出价引擎、排行榜、分布式锁、限流计数 |
| WebSocket | gorilla/websocket | Go 生态最成熟的 WS 库，自封装 Hub/Room 实现房间级隔离 |
| 鉴权 | JWT (golang-jwt) | 无状态认证，HTTP + WebSocket 统一 token |
| 容器化 | Docker Compose | MySQL + Redis 一键启动，开发环境标准化 |

### 为什么选 Go 而不是 Node.js

1. **并发模型**：Goroutine 栈仅 ~2KB，单机轻松维持数万 WebSocket 长连接；Node.js 事件循环在 CPU 密集型出价校验场景下易成瓶颈
2. **性能**：编译型语言，出价校验/排行榜计算比 Node.js 快 5-10x
3. **内存效率**：10000 个 WebSocket 连接约 20MB（Goroutine），Node.js 约 200MB+
4. **技术答辩加分**：需求文档明确"优先 Node/Go"，Go 在高并发场景下更具说服力

## 3. 系统架构

```
用户 H5 / 商家 PC
       │
       ├── HTTP (RESTful API) ────→ Gin Router ──→ Handler ──→ GORM ──→ MySQL
       │                                │
       └── WebSocket ────────────────→ Hub
                                        │
                                   ┌────┴────┐
                                   │  Room 1 │  Room 2  │ ...
                                   │ clients │ clients  │
                                   └────┬────┘
                                        │
                              Redis (出价引擎/排行榜/限流)
                                        │
                                   异步持久化
                                        │
                                      MySQL
```

### 核心原则

- **竞拍热路径走 Redis**：出价校验、当前价更新、排行榜排序全部在 Redis 内原子完成
- **MySQL 负责持久化**：出价记录、订单、用户数据异步写入 MySQL
- **WebSocket 房间级隔离**：每个直播间一个 Room，广播互不干扰

## 4. 数据库设计

### 4.1 MySQL 表结构

共 6 张核心表：

**users** — 用户/商家统一表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 自增主键 |
| phone | VARCHAR(20) UNIQUE | 手机号 |
| nickname | VARCHAR(50) | 昵称 |
| password_hash | VARCHAR(255) | bcrypt 哈希 |
| role | ENUM(USER, MERCHANT) | 角色 |
| status | ENUM(ACTIVE, BANNED) | 状态 |

**products** — 商品表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| merchant_id | BIGINT FK | 所属商家 |
| title | VARCHAR(200) | 商品名 |
| description | TEXT | 商品描述 |
| images | JSON | 图片 URL 数组 |
| category | VARCHAR(50) | 分类 |
| status | ENUM(DRAFT, LISTED, SOLD, REMOVED) | |

**live_rooms** — 直播间表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| merchant_id | BIGINT FK | |
| title | VARCHAR(200) | 直播间标题 |
| stream_url | VARCHAR(500) | 模拟直播流地址 |
| status | ENUM(PREPARING, LIVE, ENDED) | |
| online_count | INT | 在线人数 |

**auctions** — 竞拍场次表（核心）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| product_id | BIGINT FK | 竞拍商品 |
| room_id | BIGINT FK | 所属直播间 |
| merchant_id | BIGINT FK | 商家 |
| mode | ENUM(OPEN, BLIND) | 明拍/盲拍 |
| starting_price | DECIMAL(12,2) | 起拍价（支持0元） |
| increment_amount | DECIMAL(12,2) | 加价幅度 |
| ceiling_price | DECIMAL(12,2) NULL | 封顶价 |
| duration_seconds | INT | 竞拍时长 |
| auto_extend_seconds | INT | 延时秒数（10-30） |
| status | ENUM(DRAFT, PENDING, ACTIVE, EXTENDED, COMPLETED, FAILED, CANCELLED) | 状态机 |
| current_price | DECIMAL(12,2) | 当前最高价 |
| winner_id | BIGINT FK NULL | 赢家 |
| bid_count | INT | 出价次数 |
| extend_count | INT | 已延时次数 |

**bids** — 出价记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| auction_id | BIGINT FK | |
| user_id | BIGINT FK | |
| amount | DECIMAL(12,2) | 出价金额 |
| bid_time | DATETIME(3) | 精确到毫秒 |

**orders** — 订单表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| order_no | VARCHAR(32) UNIQUE | 订单号 |
| auction_id | BIGINT FK | |
| buyer_id / seller_id | BIGINT FK | 买卖双方 |
| final_price | DECIMAL(12,2) | 成交价 |
| status | ENUM(PENDING_PAYMENT, PAID, SHIPPED, COMPLETED, CANCELLED) | |
| expire_time | DATETIME(3) | 支付截止时间 |

### 4.2 Redis 数据结构

```
# 竞拍实时状态 (Hash)
auction:{id}:state
  → current_price, winner_id, bid_count, status, end_time

# 出价排行榜 (Sorted Set, score=金额)
auction:{id}:ranking
  → member=userId, score=bidAmount

# 虚拟昵称映射 (Hash)
auction:{id}:aliases
  → field=userId, value="巅峰竞拍者1"

# 用户级限流 (String + TTL)
rate:bid:u:{userId}:{auctionId}
  → TTL=1s
```

## 5. 竞拍状态机

6 个状态，3 个终态，由事件驱动转移：

```
DRAFT ──[configure]──→ PENDING ──[start]──→ ACTIVE ──[bid_near_end]──→ EXTENDED
                          │                   │  │                      ↑  │  │
                       [cancel]            [bid] │      [bid再次触发]──┘  │  │
                          ↓                   │  │                       │  │
                      CANCELLED            [timeout]  [reach_ceiling]    │  │
                                            ↓    ↓        ↓             │  │
                                         FAILED  COMPLETED ←────────────┘  │
                                                  ↑                        │
                                               [timeout] ──────────────────┘
```

### 状态转移规则

| 当前状态 | 事件 | 目标状态 | 条件 |
|---------|------|---------|------|
| DRAFT | configure | PENDING | 规则配置完整 |
| PENDING | start | ACTIVE | 主播手动开启 |
| PENDING | cancel | CANCELLED | — |
| ACTIVE | bid | ACTIVE | 普通出价（非结束前） |
| ACTIVE | bid_near_end | EXTENDED | 结束前 N 秒内有新出价 |
| ACTIVE | reach_ceiling | COMPLETED | 出价达到封顶价 |
| ACTIVE | timeout | COMPLETED | 倒计时结束，有出价 |
| ACTIVE | timeout | FAILED | 倒计时结束，无人出价 |
| ACTIVE | cancel | CANCELLED | 主播取消 |
| EXTENDED | bid | EXTENDED | 延时期再次出价（重置倒计时） |
| EXTENDED | reach_ceiling | COMPLETED | — |
| EXTENDED | timeout | COMPLETED | 延时结束 |
| EXTENDED | cancel | CANCELLED | — |

### 副作用

- **→ ACTIVE**：启动倒计时 Timer，初始化 Redis 状态，广播"竞拍开始"
- **→ EXTENDED**：重置倒计时，广播"竞拍延时 N 秒"
- **→ COMPLETED**：从 Redis 获取赢家，生成订单，广播"竞拍成交"
- **→ FAILED**：广播"竞拍流拍"，释放商品
- **→ CANCELLED**：广播"竞拍取消"，清理 Redis

## 6. 高并发出价架构

### 6.1 出价链路（五层漏斗）

```
用户点击出价
     │
     ▼
 连接数检查 (内存)          ← 同用户同房间最多3连接，全局最多10连接
     │
     ▼
 L1 内存预校验              ← 本地缓存当前价/状态，过滤明显无效出价（0成本）
     │
     ▼
 L2 去重 (内存)             ← 同用户同金额500ms内去重（防手抖连击）
     │
     ▼
 限流 (Redis Pipeline)     ← 用户1次/秒 | 单场5000/秒 | 全局50000/秒
     │
     ▼
 Redis Lua 原子出价         ← 校验+更新+延时判断，一次调用完成
     │
     ▼
 广播 + 异步持久化
```

### 6.2 Redis Lua 原子出价脚本

一次 Redis 调用完成全部逻辑，保证原子性：

1. 校验竞拍状态（ACTIVE/EXTENDED）
2. 校验是否已过期
3. 校验出价 >= 当前价 + 加价幅度
4. 检查封顶价
5. 原子更新 current_price / winner_id / bid_count
6. 更新排行榜 (ZADD)
7. 判断是否触发延时（距结束 < N 秒）
8. 返回结果（成功/失败/是否延时/新结束时间/排名）

### 6.3 延时机制

**延时衰减策略** — 防止机器人利用延时无限拖延：

| 延时次数 | 延时秒数 | 效果 |
|---------|---------|------|
| 第1次 | +30s | 充分竞价 |
| 第2次 | +25s | |
| 第3次 | +20s | |
| 第4次 | +15s | |
| 第5次 | +10s | 越来越紧张 |
| 第6-10次 | +5s | 最短延时 |
| 第11次+ | 不再延时 | 强制结束 |

额外保护：总时长不超过原定时长的 3 倍。

### 6.4 防恶意机器人

| 层级 | 手段 | 说明 |
|------|------|------|
| 连接层 | 连接数限制 | 同用户同房间 ≤3，全局 ≤10 |
| 内存层 | 预校验 + 去重 | 过滤 60-80% 无效请求 |
| Redis 层 | 用户级限流 | 每人每场每秒 1 次 |
| 业务层 | 行为检测 | 出价间隔方差、最后一秒出价比例、最小加价比例 |
| 业务层 | 保证金机制 | 首次出价需冻结保证金 |
| 业务层 | 延时衰减 | 最多 10 次延时 + 总时长上限 |

## 7. WebSocket 协议设计

### 7.1 消息格式

```json
// 客户端 → 服务端
{ "type": "bid", "seq": 5, "payload": { "auctionId": 1, "amount": 8700 } }

// 服务端 → 客户端
{ "type": "bid_result", "seq": 5, "code": 0, "data": {...}, "ts": 1716624005300 }
```

- `seq`：请求-响应配对（WebSocket 异步环境下必须）
- `ts`：每条消息带服务端时间戳，用于客户端倒计时校准

### 7.2 消息类型

**C2S（客户端→服务端）**：`ping` / `join_room` / `leave_room` / `bid` / `sync_time`

**S2C（服务端→客户端）**：

| type | 说明 | 发送范围 |
|------|------|---------|
| pong | 心跳回复 | 仅发送者 |
| room_state | 房间全量状态 | 仅加入者 |
| bid_result | 出价结果 | 仅出价者 |
| new_bid | 新出价通知 | 房间全员 |
| ranking_update | 排行榜更新 | 房间全员 |
| auction_start | 竞拍开始 | 房间全员 |
| auction_extend | 竞拍延时 | 房间全员 |
| auction_end | 竞拍结束 | 房间全员 |
| countdown_sync | 倒计时校准 | 房间全员（每5秒） |
| user_count | 在线人数 | 房间全员 |

### 7.3 连接管理

- 心跳间隔：15 秒
- 超时断连：45 秒无 pong
- 自动重连：指数退避（1s → 2s → 4s → ... → 30s），最多 10 次
- 断线恢复：重连后发送 `join_room`，服务端返回 `room_state` 全量同步

## 8. 竞拍模式：明拍与盲拍

### 8.1 模式差异

| 维度 | 明拍 (OPEN) | 盲拍 (BLIND) |
|------|-------------|-------------|
| 排行榜昵称 | 虚拟昵称（巅峰竞拍者1） | 虚拟昵称（巅峰竞拍者1） |
| 他人出价金额 | 可见 | 不可见（显示 ¥ • • • •） |
| 自己出价金额 | 可见 | 可见 |
| 当前最高价 | 公开 | 隐藏，只显示"已有N人出价" |
| 被超越提醒 | "你被超越了！当前价 ¥9,200" | "你的排名从第2名降至第4名"（无金额） |

### 8.2 虚拟昵称系统

- 每个用户进入一场竞拍时分配固定虚拟昵称，整场不变
- 跨竞拍重新分配，保护隐私
- Redis Hash 存储映射：`auction:{id}:aliases`
- 昵称池交替使用前缀：巅峰竞拍者/神秘买家/竞拍达人/无名高手/黑马选手/实力玩家

### 8.3 盲拍数据隔离

服务端广播时根据模式过滤：
- **明拍**：所有人收到相同消息（单次 JSON 序列化，效率高）
- **盲拍**：逐用户定制消息（只有 `isMe: true` 的行带金额，其余 `amount: null`）
- HTTP 接口也做相同脱敏，防止通过 API 绕过
- 竞拍结束后揭晓全部出价（"开奖"体验）

## 9. 前端架构

### 9.1 Monorepo 结构

```
frontend/
├── packages/
│   ├── shared/          # 共享层：TS 类型、WebSocket 客户端、API、时间校准
│   ├── mobile/          # 用户端 H5（:3000）
│   └── merchant/        # 商家端 PC（:3001）
└── pnpm-workspace.yaml
```

### 9.2 状态管理（Zustand）

5 个独立 Store，按职责隔离：

| Store | 职责 | 数据来源 |
|-------|------|---------|
| authStore | 用户身份、token、登录/登出 | HTTP |
| auctionStore | 竞拍状态、当前价、倒计时 | WebSocket |
| bidStore | 排行榜、我的排名、出价操作 | WebSocket |
| notificationStore | 情绪反馈通知队列 | 内部派发 |
| roomStore | 房间信息、在线人数、连接状态 | WebSocket |

### 9.3 数据流

```
WebSocket 消息 → WsDispatcher（纯逻辑层） → 更新对应 Store → React 组件自动重渲染
```

组件完全不感知 WebSocket 的存在，只从 Store 读数据、调方法。

### 9.4 倒计时精确同步

- 服务端每 5 秒推送 `countdown_sync`（权威结束时间）
- 客户端使用 NTP 风格算法校准本地时钟偏差（取多次采样中位数）
- 倒计时渲染使用 `requestAnimationFrame` 而非 `setInterval`（60fps 流畅）
- 最后 10 秒变红 + 脉冲动画，营造紧张感

### 9.5 核心组件（用户端 H5）

| 组件 | 功能 |
|------|------|
| CountdownTimer | 毫秒级倒计时，最后10秒变红脉冲 |
| RankingList | 实时排行榜，高亮自己，盲拍显示 ¥ • • • • |
| BidController | 出价金额输入 + 快捷加价按钮 + 出价按钮（loading态） |
| NotificationLayer | 全屏通知：领先/被超越/延时/成交，Framer Motion 动画 |
| PriceDisplay | 当前价大字展示，明拍/盲拍差异化 |

## 10. 后端分层架构

```
cmd/server/main.go          ← 入口：连接初始化、路由注册、优雅关闭

internal/
├── config/                  ← 配置加载（Viper）
├── model/                   ← GORM 模型定义（6张表）
├── handler/                 ← HTTP Handler + WebSocket 升级
│   ├── router.go            ← 三层路由：public / auth / merchant
│   ├── auth.go              ← 注册、登录
│   ├── product.go           ← 商品 CRUD
│   ├── auction.go           ← 竞拍管理（创建/开始/取消）
│   ├── room.go              ← 直播间管理
│   ├── order.go             ← 订单查看/模拟支付
│   └── websocket.go         ← WS 连接升级 + 连接数守卫
├── service/                 ← 业务逻辑
│   ├── auction_fsm.go       ← 竞拍状态机（Guard + Action）
│   ├── alias.go             ← 虚拟昵称分配
│   ├── broadcast.go         ← 明拍/盲拍广播过滤
│   └── context.go           ← 竞拍上下文、DTO 定义
├── middleware/               ← 中间件
│   ├── auth.go              ← JWT 鉴权 + token 生成
│   ├── cors.go              ← 跨域
│   └── ratelimit.go         ← Redis 限流
├── ws/                      ← WebSocket 核心
│   ├── hub.go               ← 中枢（注册/注销/消息分发）
│   ├── room.go              ← 房间（广播/定向发送/盲拍过滤）
│   ├── client.go            ← 客户端（读写泵、心跳）
│   └── message.go           ← 消息类型 + Payload 定义
├── pkg/
│   ├── response/            ← 统一 JSON 响应
│   └── errcode/             ← 错误码定义
└── scripts/lua/
    └── bid.lua              ← Redis Lua 原子出价脚本

```

## 11. API 路由设计

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 登录 |

### 认证接口（需 JWT）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/user/profile | 个人信息 |
| GET | /api/rooms | 直播间列表 |
| GET | /api/rooms/:id | 直播间详情 |
| GET | /api/auctions | 竞拍列表 |
| GET | /api/auctions/:id | 竞拍详情 |
| GET | /api/orders | 我的订单 |
| POST | /api/orders/:id/pay | 模拟支付 |
| GET | /ws | WebSocket 连接 |

### 商家接口（需 JWT + MERCHANT 角色）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/merchant/products | 创建商品 |
| GET | /api/merchant/products | 我的商品列表 |
| PUT | /api/merchant/products/:id | 更新商品 |
| DELETE | /api/merchant/products/:id | 删除商品 |
| POST | /api/merchant/rooms | 创建直播间 |
| PUT | /api/merchant/rooms/:id/start | 开播 |
| PUT | /api/merchant/rooms/:id/end | 结束直播 |
| POST | /api/merchant/auctions | 创建竞拍 |
| PUT | /api/merchant/auctions/:id | 修改竞拍规则 |
| PUT | /api/merchant/auctions/:id/start | 开始竞拍 |
| PUT | /api/merchant/auctions/:id/cancel | 取消竞拍 |
| GET | /api/merchant/orders | 商家订单列表 |

## 12. 错误码规范

| 码 | 说明 |
|----|------|
| 0 | 成功 |
| 4001 | 出价太低 |
| 4002 | 竞拍未在进行中 |
| 4003 | 出价太频繁 |
| 4004 | 未加入房间 |
| 4005 | 未缴纳保证金 |
| 4010 | 消息格式错误 |
| 4011 | 未登录 |
| 5000 | 服务器内部错误 |
| 5001 | 系统繁忙 |

## 13. 启动方式

```bash
# 1. 启动基础设施
docker compose up -d

# 2. 启动后端（:8080）
cd backend && go run cmd/server/main.go

# 3. 启动用户端（:3000）
cd frontend && pnpm dev:mobile

# 4. 启动商家端（:3001）
cd frontend && pnpm dev:merchant
```
