# 实时竞拍大师

抖音电商直播竞拍全栈系统 — 支持商家在直播间内对高价值商品发起实时竞拍，用户通过 H5 页面参与出价。

## 项目简介

本系统面向珠宝、艺术品、二手奢侈品等高价值商品的直播竞拍场景，实现了「商品上架 → 规则配置 → 实时出价 → 动态排名 → 竞拍成交」的完整闭环。

### 核心能力

- **高并发出价**：Redis Lua 原子脚本 + 五层漏斗（内存预校验 → 去重 → 限流 → Lua 原子出价 → 异步持久化），实测 **1,357 QPS**，万级出价零错误
- **毫秒级实时同步**：WebSocket 房间级隔离，NTP 风格时钟校准，倒计时 `requestAnimationFrame` 60fps 渲染
- **明拍 / 盲拍双模式**：明拍公开全部出价，盲拍隐藏金额仅显示排名，结束后揭晓
- **智能延时衰减**：结束前出价自动延时，衰减策略防止无限拖延（30s → 25s → ... → 5s）
- **竞拍状态机**：6 状态 3 终态，事件驱动转移，副作用自动触发（Timer / Redis / 广播）
- **全链路可观测**：Prometheus 20+ 自定义指标，覆盖 HTTP / WebSocket / Bid / Redis 全链路

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          客户端 (Client)                             │
│                                                                     │
│   ┌──────────────────────┐      ┌──────────────────────┐           │
│   │   用户端 H5 (:3000)   │      │  商家端 PC (:3001)    │           │
│   │  React 19 + TS       │      │  React 19 + TS       │           │
│   │  TailwindCSS         │      │  TailwindCSS         │           │
│   │  Framer Motion       │      │                      │           │
│   │  Zustand 状态管理     │      │  Zustand 状态管理     │           │
│   └──────┬───────┬───────┘      └──────┬───────┬───────┘           │
│          │       │                     │       │                    │
│       HTTP    WebSocket             HTTP    WebSocket               │
└──────────┼───────┼─────────────────────┼───────┼────────────────────┘
           │       │                     │       │
           ▼       ▼                     ▼       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Nginx 反向代理 (:8888)                          │
│          /api/* /uploads/* → Backend    /ws → WebSocket              │
│          /           → Mobile SPA       /merchant/ → Merchant SPA   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     后端服务 Go / Gin (:8080)                        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     中间件层 (Middleware)                      │   │
│  │   CORS │ JWT 鉴权 │ API 限流 (200/10s) │ Prometheus 指标     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────┐  ┌────────────────────────────────┐   │
│  │    HTTP Handler 层       │  │     WebSocket 层                │   │
│  │                         │  │                                │   │
│  │  auth     (注册/登录)    │  │  Hub  ── 中枢消息分发           │   │
│  │  product  (商品 CRUD)    │  │   ├── Room 1 (房间级隔离)      │   │
│  │  room     (直播间管理)   │  │   │    ├── Client A            │   │
│  │  auction  (竞拍管理)     │  │   │    ├── Client B            │   │
│  │  order    (订单/支付)    │  │   │    └── ...                  │   │
│  │  deposit  (保证金)       │  │   ├── Room 2                   │   │
│  │  follow   (关注)         │  │   │    └── ...                  │   │
│  │  conversation (私信)     │  │   └── ...                      │   │
│  │  upload   (文件上传)     │  │                                │   │
│  └────────────┬────────────┘  └───────────────┬────────────────┘   │
│               │                               │                    │
│               ▼                               ▼                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Service 业务逻辑层                          │   │
│  │                                                              │   │
│  │  BidService          五层出价漏斗 + Redis Lua 原子出价        │   │
│  │  AuctionFSM          竞拍状态机 (6状态, 事件驱动)             │   │
│  │  AuctionTimer        倒计时管理 + 到期自动结算                │   │
│  │  BroadcastService    明拍/盲拍消息过滤 + 房间广播             │   │
│  │  AliasService        虚拟昵称分配 (隐私保护)                  │   │
│  │  OrderService        订单生成 + 超时取消                      │   │
│  │  DepositService      保证金冻结/退还                          │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                      │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │                    Model 数据模型层 (GORM)                     │   │
│  │                                                              │   │
│  │  User │ Product │ LiveRoom │ Auction │ Bid │ Order           │   │
│  │  Deposit │ Follow │ Conversation │ Message                   │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                      │
└─────────────────────────────┼──────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌───────────────┐ ┌─────────────────┐
│   MySQL 8.0      │ │  Redis 7      │ │  Prometheus      │
│   (:3306)        │ │  (:6379)      │ │  (:9090)         │
│                  │ │               │ │                  │
│  核心业务数据     │ │  竞拍实时状态  │ │  性能指标采集     │
│  持久化存储       │ │  出价排行榜    │ │  HTTP/WS/Bid     │
│  事务保障         │ │  分布式限流    │ │  Redis 延迟       │
│  11 张业务表      │ │  Lua 原子出价  │ │  15s 采集间隔     │
│                  │ │  虚拟昵称映射  │ │                  │
└──────────────────┘ └───────────────┘ └─────────────────┘
```

### 出价数据流

```
用户点击出价
    │
    ▼
┌─ WebSocket Client ──────────────────────────────────────────┐
│  { type: "bid", seq: 5, payload: { auctionId, amount } }   │
└──────────────────────────┬──────────────────────────────────┘
                           │
    ┌──────────────────────▼──────────────────────┐
    │         五层出价漏斗 (BidService)             │
    │                                              │
    │  L1  内存预校验  ── 本地缓存过滤无效出价       │
    │  L2  去重 (500ms) ── 防手抖连击               │
    │  L3  Redis 限流  ── 每人每秒 1 次             │
    │  L4  Lua 原子出价 ── 校验+更新+延时 一次调用   │
    │  L5  异步持久化  ── 批量写入 MySQL             │
    └──────────────────────┬──────────────────────┘
                           │
    ┌──────────────────────▼──────────────────────┐
    │       BroadcastService 广播                   │
    │  明拍: 全员相同消息 (单次序列化)               │
    │  盲拍: 逐用户定制 (isMe 带金额, 其余隐藏)     │
    └──────────────────────┬──────────────────────┘
                           │
                           ▼
              所有房间内用户收到实时更新
```

## 技术选型

| 层级 | 技术 | 选型理由 |
|------|------|---------|
| 前端框架 | React 19 + TypeScript | 组件化开发，类型安全 |
| 前端构建 | Vite 6 | 毫秒级 HMR |
| 前端样式 | TailwindCSS 3 | 原子化 CSS |
| 前端动画 | Framer Motion | 竞拍氛围动画 |
| 状态管理 | Zustand 5 | 轻量级，天然支持 WS 外部更新 |
| Monorepo | pnpm workspace | shared / mobile / merchant 三包架构 |
| 后端语言 | Go 1.22+ | Goroutine 天然适配万级 WS 长连接 |
| Web 框架 | Gin | 高性能 HTTP 路由 |
| ORM | GORM | AutoMigrate 自动建表 |
| 数据库 | MySQL 8.0 | 核心业务数据持久化 |
| 缓存 | Redis 7 | 出价引擎 / 排行榜 / 限流 |
| WebSocket | gorilla/websocket | Go 生态最成熟的 WS 库 |
| 鉴权 | JWT (golang-jwt) | 无状态认证 |
| 监控 | Prometheus | 全链路指标采集 |
| 容器化 | Docker Compose | 一键启动全部服务 |

## 依赖环境

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| Docker & Docker Compose | 20.10+ / v2 | 容器化运行 MySQL / Redis / 后端 / 前端 |
| Go | 1.22+ | 本地开发后端时需要 |
| Node.js | 18+ | 本地开发前端时需要 |
| pnpm | 8+ | 前端包管理器 |

> 如果仅做 Docker 部署，只需安装 Docker 即可，无需本地安装 Go / Node.js。

## 快速启动

### 方式一：Docker Compose 一键部署（推荐）

```bash
# 克隆项目
git clone https://github.com/kkt997/jingpai.git
cd jingpai

# 构建并启动所有服务
docker compose up -d --build

# 查看服务状态
docker ps
```

启动后访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| 用户端 H5 | http://localhost:8888 | 移动端竞拍页面 |
| 商家端 PC | http://localhost:8888/merchant/ | 商家管理后台 |
| 后端 API | http://localhost:8080 | RESTful API + WebSocket |
| Prometheus | http://localhost:9090 | 监控面板 |

### 方式二：本地开发模式

```bash
# 1. 启动 MySQL + Redis
docker compose up -d mysql redis

# 2. 启动后端 (:8080)
cd backend
go run cmd/server/main.go

# 3. 启动用户端 (:3000)
cd frontend
pnpm install
pnpm dev:mobile

# 4. 启动商家端 (:3001)（另开终端）
cd frontend
pnpm dev:merchant
```

### 并发压测

```bash
cd backend

# 快速冒烟测试
go run cmd/loadtest/main.go -users 10 -bids 5

# 高负载压测
go run cmd/loadtest/main.go -users 1000 -bids 15 -rampup 20000

# 极限压测
go run cmd/loadtest/main.go -users 10000 -bids 5 -rampup 90000
```

详细压测结果见 [并发测压.md](并发测压.md)。

## 目录结构

```
jingpai/
├── docker-compose.yml          # 容器编排：MySQL + Redis + 后端 + 前端 + Prometheus
├── prometheus.yml              # Prometheus 采集配置
├── readme.md                   # 项目说明（本文件）
├── AGENTS.md                   # 技术设计文档
├── 并发测压.md                  # 并发压测报告（10~10000 用户）
│
├── backend/                    # Go 后端
│   ├── cmd/
│   │   ├── server/main.go      # 服务入口：初始化、路由注册、优雅关闭
│   │   └── loadtest/main.go    # 并发压测工具
│   ├── config.yaml             # 运行时配置
│   ├── Dockerfile              # 后端容器构建
│   ├── go.mod / go.sum
│   ├── scripts/lua/bid.lua     # Redis Lua 原子出价脚本
│   └── internal/
│       ├── config/             # 配置加载 (Viper)
│       ├── handler/            # HTTP Handler + WebSocket 升级
│       │   ├── router.go       #   三层路由：public / auth / merchant
│       │   ├── auth.go         #   注册、登录
│       │   ├── auction.go      #   竞拍管理（创建/开始/取消）
│       │   ├── product.go      #   商品 CRUD
│       │   ├── room.go         #   直播间管理
│       │   ├── order.go        #   订单查看/支付
│       │   ├── deposit.go      #   保证金
│       │   ├── websocket.go    #   WS 连接升级 + 连接数守卫
│       │   └── ws_handler.go   #   WS 消息分发（bid/join/leave/chat）
│       ├── service/            # 业务逻辑
│       │   ├── bid.go          #   五层出价漏斗 + Redis Lua 原子出价
│       │   ├── auction_fsm.go  #   竞拍状态机
│       │   ├── timer.go        #   倒计时管理 + 到期结算
│       │   ├── broadcast.go    #   明拍/盲拍广播过滤
│       │   ├── alias.go        #   虚拟昵称分配
│       │   ├── order.go        #   订单生成 + 超时取消
│       │   ├── deposit.go      #   保证金冻结/退还
│       │   └── context.go      #   竞拍上下文、DTO 定义
│       ├── model/              # GORM 数据模型（11 张表）
│       ├── middleware/         # 中间件：JWT鉴权 / CORS / 限流 / Prometheus
│       ├── metrics/            # Prometheus 自定义指标（20+）
│       ├── ws/                 # WebSocket 核心
│       │   ├── hub.go          #   中枢：注册/注销/消息分发
│       │   ├── room.go         #   房间：广播/定向发送
│       │   ├── client.go       #   客户端：读写泵、心跳
│       │   └── message.go      #   消息类型 + Payload 定义
│       └── pkg/                # 工具包
│           ├── errcode/        #   错误码定义
│           └── response/       #   统一 JSON 响应
│
└── frontend/                   # React 前端 (pnpm monorepo)
    ├── pnpm-workspace.yaml     # workspace 配置
    ├── Dockerfile              # 前端容器构建（Nginx）
    ├── nginx.conf              # Nginx 路由配置
    └── packages/
        ├── shared/             # 共享层
        │   └── src/
        │       ├── api/        #   Axios HTTP 客户端
        │       ├── types/      #   TypeScript 类型定义
        │       └── ws/         #   WebSocket 客户端 + 时间校准
        ├── mobile/             # 用户端 H5 (:3000)
        │   └── src/
        │       ├── pages/      #   页面：竞拍房间/订单/个人中心/...
        │       ├── components/ #   组件：倒计时/排行榜/出价控制器/...
        │       ├── stores/     #   Zustand Store（7个）
        │       └── ws/         #   WS 消息分发器
        └── merchant/           # 商家端 PC (:3001)
            └── src/
                ├── pages/      #   页面：仪表盘/商品/直播/竞拍/订单/...
                └── components/ #   布局组件
```

## 配置说明

### 后端配置 (`backend/config.yaml`)

```yaml
server:
  port: 8080                    # 服务端口
  mode: debug                   # debug（开发）/ release（生产）

database:
  host: 127.0.0.1               # MySQL 地址
  port: 3306
  user: root
  password: jingpai123
  dbname: jingpai
  max_open_conns: 100           # 最大连接数
  max_idle_conns: 20            # 最大空闲连接

redis:
  addr: 127.0.0.1:6379          # Redis 地址
  password: ""
  db: 0
  pool_size: 100                # 连接池大小（高并发建议 200-500）

jwt:
  secret: jingpai-secret-key    # JWT 签名密钥（生产环境务必修改）
  expire_hours: 72              # Token 过期时间

auction:
  default_extend_seconds: 20    # 默认延时秒数
  min_extend_seconds: 5         # 最小延时（衰减下限）
  max_extend_count: 10          # 最大延时次数
  decay_per_extend: 5           # 每次延时衰减秒数
  default_deposit_amount: 500   # 默认保证金金额

websocket:
  max_connections_per_user: 3   # 同用户最大 WS 连接数
  heartbeat_interval: 15        # 心跳间隔（秒）
  heartbeat_timeout: 45         # 超时断连（秒）
  countdown_sync_interval: 5    # 倒计时校准间隔（秒）
```

### Docker Compose 环境变量

Docker 部署时通过环境变量覆盖配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_HOST` | `mysql` | MySQL 地址 |
| `DATABASE_PORT` | `3306` | MySQL 端口 |
| `DATABASE_USER` | `root` | MySQL 用户名 |
| `DATABASE_PASSWORD` | `jingpai123` | MySQL 密码 |
| `DATABASE_DBNAME` | `jingpai` | 数据库名 |
| `REDIS_ADDR` | `redis:6379` | Redis 地址 |
| `SERVER_MODE` | `release` | 运行模式 |
| `JWT_SECRET` | — | JWT 密钥（生产必须修改） |

### Prometheus 配置 (`prometheus.yml`)

```yaml
scrape_configs:
  - job_name: "jingpai-backend"
    metrics_path: /metrics
    scrape_interval: 15s
    static_configs:
      - targets: ["backend:8080"]
```

## API 路由概览

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 登录 |

### 认证接口（需 JWT）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/profile` | 个人信息 |
| GET | `/api/rooms` | 直播间列表 |
| GET | `/api/rooms/:id` | 直播间详情 |
| GET | `/api/auctions` | 竞拍列表 |
| GET | `/api/auctions/:id` | 竞拍详情 |
| GET | `/api/orders` | 我的订单 |
| POST | `/api/orders/:id/pay` | 模拟支付 |
| POST | `/api/auctions/:id/deposit` | 缴纳保证金 |
| GET | `/ws` | WebSocket 连接 |

### 商家接口（需 JWT + MERCHANT 角色）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/merchant/products` | 创建商品 |
| GET | `/api/merchant/products` | 商品列表 |
| PUT | `/api/merchant/products/:id` | 更新商品 |
| POST | `/api/merchant/rooms` | 创建直播间 |
| PUT | `/api/merchant/rooms/:id/start` | 开播 |
| POST | `/api/merchant/auctions` | 创建竞拍 |
| PUT | `/api/merchant/auctions/:id/start` | 开始竞拍 |
| PUT | `/api/merchant/auctions/:id/cancel` | 取消竞拍 |
| GET | `/api/merchant/stats` | 数据统计 |

> 完整接口文档见 [接口.md](接口.md)。

## 性能数据

基于 Docker Compose 单机部署的并发压测结果（详见 [并发测压.md](并发测压.md)）：

| 并发用户 | QPS | P50 延迟 | P99 延迟 | 异常错误率 |
|---------|-----|---------|---------|-----------|
| 100 | 80 | 2.6ms | 19.5ms | 0% |
| 500 | 398 | 6.7ms | 138.8ms | 0% |
| 1,000 | 778 | 18.4ms | 446.2ms | 0% |
| 2,000 | **1,357** | 47.0ms | 1,180.8ms | 0% |
| 10,000 | 1,203 | 69.4ms | 3,027.2ms | 0% |

- 全部 7 轮（10~10000 用户）共 64,991 次出价，**异常错误率 0%**
- 2000+ 并发时的连接瓶颈来自 Docker 网络层，而非应用代码
