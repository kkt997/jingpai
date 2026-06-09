# 竞拍大师 — 已完成功能清单

## 一、核心业务闭环（端到端可运行）

以下流程已完整打通，从前端到后端到数据库均有真实逻辑：

1. **用户注册/登录**（手机号/邮箱） → JWT 鉴权 → Token 持久化
2. **商家创建商品** → 上架（DRAFT → LISTED）→ 创建直播间（支持上传视频/填写链接）→ 开播
3. **商家发布竞拍** → 选择已上架商品 → 配置规则（明拍/盲拍、起拍价、加价幅度、封顶价、保证金、时长、延时秒数）→ 开始竞拍
4. **用户进入直播间** → WebSocket 连接 → 接收全量房间状态 → 观看直播流
5. **用户缴纳保证金** → HTTP 冻结 → Redis 缓存状态 → 允许出价
6. **用户出价** → 保证金校验 → 五层漏斗校验（内存预检 → 去重 → Redis限流 → Lua原子出价 → 异步持久化）
7. **实时广播** → 明拍全额可见 / 盲拍金额隐藏（¥ • • • •）
8. **延时机制** → 结束前出价自动延时（衰减策略 + 3倍总时长上限）
9. **封顶价成交** → Lua检测达到封顶 → 自动结束 → 生成订单
10. **超时结束** → 有人出价则成交 / 无人出价则流拍
11. **竞拍结算** → 赢家保证金抵扣货款 → 其他参与者自动退还
12. **订单全生命周期** → 自动建单 → 用户支付 → 商家发货 → 确认收货
13. **订单超时取消** → 后台 Worker 每分钟清理过期订单 → 商品状态回滚

---

## 二、后端 API（全部已实现）

### 公开接口
| 接口 | 功能 |
|------|------|
| `POST /api/auth/register` | 用户/商家注册（手机号/邮箱+密码+角色） |
| `POST /api/auth/login` | 登录（手机号或邮箱），返回 JWT + 用户信息 |

### 用户接口（需登录）
| 接口 | 功能 |
|------|------|
| `GET /api/user/profile` | 获取个人信息 |
| `GET /api/user/bids` | 我的出价历史（含竞拍/商品上下文） |
| `GET /api/user/deposits` | 我的保证金列表 |
| `GET /api/rooms` | 直播间列表（支持状态筛选） |
| `GET /api/rooms/:id` | 直播间详情 |
| `GET /api/auctions` | 竞拍列表（盲拍自动脱敏） |
| `GET /api/auctions/:id` | 竞拍详情（盲拍自动脱敏） |
| `POST /api/auctions/:id/deposit` | 缴纳保证金（冻结） |
| `GET /api/auctions/:id/deposit` | 查询保证金状态 |
| `GET /api/orders` | 我的订单列表 |
| `GET /api/orders/:id` | 订单详情 |
| `POST /api/orders/:id/pay` | 模拟支付 |
| `POST /api/orders/:id/confirm` | 确认收货 |
| `POST /api/orders/:id/cancel` | 取消订单 |
| `GET /ws?token=xxx` | WebSocket 连接 |

### 商家接口（需登录 + MERCHANT 角色）
| 接口 | 功能 |
|------|------|
| `POST /api/merchant/products` | 创建商品 |
| `GET /api/merchant/products` | 我的商品列表 |
| `PUT /api/merchant/products/:id` | 编辑商品 |
| `DELETE /api/merchant/products/:id` | 删除商品 |
| `PUT /api/merchant/products/:id/list` | 上架商品（DRAFT → LISTED） |
| `PUT /api/merchant/products/:id/unlist` | 下架商品（LISTED → DRAFT，有活跃竞拍时禁止） |
| `POST /api/merchant/rooms` | 创建直播间 |
| `PUT /api/merchant/rooms/:id/start` | 开播 |
| `PUT /api/merchant/rooms/:id/end` | 结束直播 |
| `POST /api/merchant/auctions` | 创建竞拍（含保证金设置，需商品已上架） |
| `PUT /api/merchant/auctions/:id` | 修改竞拍规则 |
| `PUT /api/merchant/auctions/:id/start` | 开始竞拍 |
| `PUT /api/merchant/auctions/:id/cancel` | 取消竞拍（自动退还保证金） |
| `GET /api/merchant/orders` | 商家订单列表 |
| `POST /api/merchant/orders/:id/ship` | 发货 |
| `GET /api/merchant/stats` | 仪表盘统计数据 |
| `POST /api/merchant/upload` | 文件上传（视频/图片，200MB 限制，返回访问 URL） |

### 监控接口
| 接口 | 功能 |
|------|------|
| `GET /metrics` | Prometheus 指标端点 |

---

## 三、WebSocket 实时通信

### 客户端 → 服务端
| 消息 | 功能 |
|------|------|
| `ping` | 心跳保活 |
| `join_room` | 加入直播间（返回全量状态 + 保证金状态 + 直播流地址） |
| `leave_room` | 离开直播间 |
| `bid` | 出价（含保证金前置校验） |
| `sync_time` | 时间同步 |

### 服务端 → 客户端
| 消息 | 功能 |
|------|------|
| `pong` | 心跳回复 |
| `room_state` | 全量房间状态（竞拍信息 + 排行榜 + 我的排名 + 保证金状态 + 直播流地址） |
| `bid_result` | 出价结果（仅出价者） |
| `new_bid` | 新出价广播（明拍/盲拍差异化） |
| `auction_start` | 竞拍开始（含保证金要求） |
| `auction_extend` | 竞拍延时 |
| `auction_end` | 竞拍结束（成交/流拍/取消） |
| `countdown_sync` | 倒计时校准（每5秒） |
| `user_count` | 在线人数变化 |

### 连接管理
- 心跳检测 + 超时断连
- 指数退避自动重连（1s→2s→4s→...→30s，最多10次）
- 同用户全局最多 10 连接
- 同用户同房间最多 3 连接

---

## 四、前端 — 用户端 H5（:80）

| 页面 | 功能 |
|------|------|
| 登录/注册页 | 手机号/邮箱登录注册，密码显隐切换 |
| 首页（直播间列表） | 展示所有直播中房间，底部 Tab 持久导航 |
| 竞拍房间页 | 直播流播放、实时倒计时、排行榜、保证金缴纳、可收起出价面板、返回按钮、通知动画 |
| 我的竞拍 | 出价历史（按场次分组，最高出价，中标标识） |
| 我的订单 | 订单列表 + 详情（支付/确认收货/取消） |
| 个人中心 | 用户信息、保证金钱包（冻结/抵扣/退还明细）、切换账号、退出登录 |

### 核心组件
- **LiveStreamPlayer** — 视频流播放（支持上传视频 / streamUrl / demo 回退，自动过滤本地路径），LIVE 红标、观看人数叠加层
- **CountdownTimer** — requestAnimationFrame 毫秒级渲染，最后10秒红色脉冲
- **RankingList** — 排名徽章，高亮自己，盲拍隐藏他人金额
- **BidController** — 可收起/展开出价面板 + 保证金缴纳 + 快捷加价 + 1.5秒冷却防刷 + 频率提示气泡
- **TabLayout** — 底部持久导航（首页/竞拍/订单/我的），子页面自动隐藏
- **NotificationLayer** — Framer Motion 动画（领先/被超越/延时/成交/流拍）

### 状态管理（Zustand 5 Store）
- `authStore` — 用户身份、Token
- `auctionStore` — 竞拍状态、当前价、倒计时、保证金状态
- `bidStore` — 排行榜、我的排名
- `notificationStore` — 通知队列
- `roomStore` — 房间信息、直播流地址、在线人数、连接状态

---

## 五、前端 — 商家端 PC（:80/merchant/）

| 页面 | 功能 |
|------|------|
| 登录/注册页 | 商家登录注册（手机号/邮箱），密码显隐切换，MERCHANT 角色校验 |
| 仪表盘 | 6 项统计数据（直播中/进行中竞拍/已成交/商品数/订单数/累计营收），快捷操作使用 React Router 客户端导航 |
| 商品管理 | 完整 CRUD + 上架/下架流程，按状态差异化操作按钮 |
| 直播间管理 | 创建直播间（支持上传本地视频/填写链接/留空用默认演示），开播/结束/进入直播间 |
| 直播间预览 | 商家视角查看直播间（视频播放 + 竞拍实时状态 + 出价动态流 + WebSocket 连接） |
| 竞拍管理 | 创建竞拍（完整规则表单 + 保证金设置）+ 开始/取消操作，表格含保证金列 |
| 订单管理 | 订单列表 + 发货按钮 |
| 实时竞拍面板 | WebSocket 接入，三栏布局：竞拍状态/排行榜/出价动态，毫秒倒计时 |

---

## 六、商品上架流程

| 特性 | 说明 |
|------|------|
| 状态流转 | DRAFT（草稿）→ LISTED（上架中）→ SOLD（已售出）/ REMOVED（已下架） |
| 上架操作 | 仅 DRAFT 状态可上架，一键切换为 LISTED |
| 下架保护 | 有进行中竞拍（PENDING/ACTIVE/EXTENDED）的商品禁止下架 |
| 竞拍关联 | 创建竞拍时校验商品必须为 LISTED 状态，防止草稿商品被直接拍卖 |
| 前端操作 | 草稿：上架/编辑/删除；上架中：下架；已售出：只读 |

---

## 七、商家端实时 WS 面板

| 特性 | 说明 |
|------|------|
| 直播间选择 | 下拉选择商家直播间，自动优先选中直播中的房间 |
| WebSocket 连接 | 复用 shared 层 WsClient，支持连接状态指示 + 自动重连 |
| 竞拍状态 | 实时显示当前价、出价次数、延时次数、竞拍模式 |
| 毫秒倒计时 | requestAnimationFrame 驱动，最后 10 秒红色脉冲，NTP 时间同步 |
| 排行榜 | 实时排名，前三名奖牌标识，盲拍金额脱敏 |
| 出价动态 | 最近 50 条出价流水，延时事件高亮，时间戳 + 金额 |
| 在线观众 | 实时在线人数统计 |
| 结果展示 | 成交/流拍/取消差异化展示，含最终价格和中标者 |

---

## 八、保证金机制

| 特性 | 说明 |
|------|------|
| 商家配置 | 创建竞拍时设置保证金金额（0 = 不需要），默认 ¥500 |
| 缴纳入口 | 用户端竞拍房间底部，未缴纳时显示"缴纳保证金"按钮 |
| 冻结机制 | HTTP 接口冻结，状态写入 MySQL + Redis 缓存 |
| 出价校验 | WebSocket 出价前检查保证金（Redis 缓存秒级响应） |
| 赢家抵扣 | 竞拍成交后，赢家保证金状态变为 DEDUCTED（抵扣货款） |
| 自动退还 | 竞拍结束/取消/流拍时，非赢家保证金自动退还（状态变为 REFUNDED） |
| 状态查询 | 用户可查看所有保证金记录及状态 |

### 数据模型（deposits 表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 自增主键 |
| user_id | BIGINT FK | 用户 |
| auction_id | BIGINT FK | 竞拍场次 |
| amount | DECIMAL(12,2) | 保证金金额 |
| status | ENUM(FROZEN, DEDUCTED, REFUNDED) | 状态 |

---

## 九、文件上传 & 直播流播放

### 文件上传

| 特性 | 说明 |
|------|------|
| 上传接口 | `POST /api/merchant/upload`，multipart/form-data 格式 |
| 文件限制 | 单文件最大 200MB |
| 视频格式 | MP4 / WebM / MOV / AVI / MKV |
| 图片格式 | JPG / PNG / GIF / WebP |
| 安全校验 | 扩展名白名单 + MIME 类型检测双重校验 |
| 存储规则 | 按日期分目录 `/uploads/YYYYMMDD/`，文件名随机化防冲突 |
| 持久化 | Docker volume 挂载，容器重启不丢失 |
| 访问方式 | Nginx 代理 `/uploads/` 路径，30 天缓存头 |
| 前端交互 | 拖拽选文件 + 实时进度条 + 上传完成/删除/重选 |
| 双模式 | "上传视频" 和 "输入链接" 可切换 |

### 直播流播放

| 特性 | 说明 |
|------|------|
| 视频播放 | HTML5 `<video>` 标签，autoplay + loop + muted + playsInline |
| 流地址支持 | 直播间 streamUrl 字段传入，服务端通过 room_state 下发 |
| 上传视频支持 | 相对路径 `/uploads/...` 自动识别，无需完整 HTTP URL |
| Demo 回退 | 无 streamUrl 或加载失败时自动回退 demo 视频 |
| 本地路径过滤 | 自动过滤 `file:///` 和 Windows 盘符路径，防止无效加载 |
| UI 叠加层 | LIVE 红标、房间标题、观看人数、连接状态 |

---

## 十、Prometheus 监控

| 指标 | 类型 | 标签 | 说明 |
|------|------|------|------|
| `jingpai_http_requests_total` | Counter | method/path/status | HTTP 请求计数 |
| `jingpai_http_request_duration_seconds` | Histogram | method/path | HTTP 接口耗时 |
| `jingpai_ws_connections_active` | Gauge | — | 当前 WebSocket 连接数 |
| `jingpai_ws_messages_total` | Counter | type/direction | WS 消息类型计数 |
| `jingpai_bids_total` | Counter | result | 出价结果分布（accepted/rejected_precheck/rejected_dedup/rejected_ratelimit/rejected_lua/error） |
| `jingpai_bid_duration_seconds` | Histogram | — | 出价全链路耗时 |
| `jingpai_bid_cache_operations_total` | Counter | layer/result | L1 内存预检 / L2 去重 命中率 |
| `jingpai_auctions_active` | Gauge | — | 当前进行中竞拍数 |
| `jingpai_auction_completions_total` | Counter | result | 竞拍完成统计（COMPLETED/FAILED/CANCELLED） |
| `jingpai_redis_command_duration_seconds` | Histogram | cmd | Redis 命令耗时 |
| `jingpai_redis_commands_total` | Counter | cmd/status | Redis 命令计数 |
| `jingpai_deposits_total` | Counter | action | 保证金操作计数 |

### 基础设施
- Prometheus 容器自动抓取后端 `/metrics` 端点（15s 间隔）
- Redis Hook 自动采集所有命令耗时 + 成功/失败计数
- Gin 中间件自动采集所有 HTTP 请求耗时 + 状态码分布
- 出价五层漏斗每层独立指标，可分析瓶颈和过滤率

---

## 十一、高并发架构特性

| 特性 | 状态 |
|------|------|
| Redis Lua 原子出价（校验+更新+排行一次调用） | ✅ 已实现 |
| 内存预校验（本地缓存当前价，过滤无效出价） | ✅ 已实现 |
| 500ms 去重（防手抖连击） | ✅ 已实现 |
| 用户级限流（1次/秒/用户/场次） | ✅ 已实现 |
| 全局 API 限流（200 req/IP/10s） | ✅ 已实现 |
| 异步批量持久化（channel + 批写 MySQL） | ✅ 已实现 |
| 延时衰减（30→25→20→15→10→5s） | ✅ 已实现 |
| 总时长 ≤ 3× 原时长上限 | ✅ 已实现 |
| 最多 10 次延时 | ✅ 已实现 |
| WebSocket 房间级隔离广播 | ✅ 已实现 |
| 盲拍逐用户消息过滤 | ✅ 已实现 |
| NTP 风格客户端时钟校准 | ✅ 已实现 |
| 保证金 Redis 缓存（出价前毫秒级校验） | ✅ 已实现 |
| 前端出价冷却（1.5秒 + 频率提示气泡） | ✅ 已实现 |
| Prometheus 全链路指标埋点 | ✅ 已实现 |

---

## 十二、基础设施

| 组件 | 状态 |
|------|------|
| Docker Compose 一键部署（MySQL + Redis + Backend + Frontend + Prometheus + Uploads Volume） | ✅ |
| 后端多阶段 Dockerfile（~20MB 镜像） | ✅ |
| 前端 Dockerfile（pnpm build + Nginx） | ✅ |
| Nginx 反向代理（API + WebSocket + Uploads + SPA 路由，200MB 上传限制） | ✅ |
| 配置文件 + 环境变量覆盖 | ✅ |
| GORM AutoMigrate（7张表） | ✅ |
| 健康检查（MySQL/Redis ready 才启动后端） | ✅ |
| 优雅关闭（SIGINT/SIGTERM） | ✅ |
| Prometheus 监控（自动抓取 /metrics） | ✅ |

---

## 十三、数据库设计（7张核心表）

| 表 | 用途 |
|----|------|
| `users` | 用户/商家统一表（手机号/邮箱、昵称、bcrypt密码、角色） |
| `products` | 商品（标题、描述、JSON图片、分类、状态） |
| `live_rooms` | 直播间（标题、流地址、状态） |
| `auctions` | 竞拍场次（商品、直播间、模式、规则、保证金金额、状态机） |
| `bids` | 出价记录（金额、毫秒时间戳） |
| `orders` | 订单（订单号、买卖双方、成交价、支付截止、物流状态） |
| `deposits` | 保证金（用户、竞拍、金额、状态：FROZEN/DEDUCTED/REFUNDED） |

---

## 十四、尚未实现的功能

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 单场/全局出价 QPS 限流 | P3 | 当前仅用户级 |
| 单元测试 | P3 | 无测试文件 |

---

## 十五、访问方式

```bash
# 一键启动
docker compose up -d --build

# 访问地址
用户端 H5:     http://localhost:8888/
商家端 PC:     http://localhost:8888/merchant/
后端 API:      http://localhost:8888/api/...
WebSocket:     ws://localhost:8888/ws?token=xxx
Prometheus:    http://localhost:9090/
指标端点:      http://localhost:8080/metrics
MySQL:         localhost:3306 (root / jingpai123)
Redis:         localhost:6379
```
