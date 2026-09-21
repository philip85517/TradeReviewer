# ADR-0001：TradeReview 当前架构回溯（2026-09-21）

- 状态：实现回溯记录
- 日期：2026-09-21
- 代码基线：`07f86b8e4d4703f4f5cd171e1a7d9a37aa374de4`
- 范围：当前工作树中已实现的网页、API、导入、行情、复盘和持久化路径
- 性质：本文不是新批准的架构决策，也不为尚未实现的云端部署或多用户能力背书

## 背景

TradeReview 是本地优先的历史交易复盘工具。用户在浏览器选择券商文件、TradingView 模拟 CSV 或成交截图，解析和人工核对后，把结构化成交、复盘内容、图表状态、行情缓存和设置交给同源 API 保存。原始文件和完整 OCR 文本由浏览器侧处理；当前业务数据源是部署目录挂载的 SQLite。

仓库同时保留了 vinext/Cloudflare Worker/D1 的构建接线和 D1 示例，但生产式本地运行路径使用 Node.js `node:sqlite`。因此本文把“当前已实现”和“历史/遗留接线”分开描述，避免把 Cloudflare 模板或未来 D1 方案误读为当前存储实现。

## 系统上下文

```text
浏览器（React 工作区、文件解析、OCR、图表、导出）
        │ 同源 HTTP/JSON
        ▼
vinext/Vite Node.js API（存储、交易回合、Recall、行情代理）
        ├── 本机 SQLite（唯一业务持久化来源）
        └── 公开行情/证券资料来源（按 provider 降级）
```

入口页面是 [`app/page.tsx`](../../app/page.tsx)，挂载 `TradeReviewWorkspace`；页面给服务端演示回放帧作为初始 UI 数据，但 `showDemo` 已关闭。前端组件和领域逻辑按 `app/components`、`app/lib/import`、`app/lib/market`、`app/lib/recall`、`app/lib/reviews`、`app/lib/insights` 等目录组织。它们是逻辑模块，不是独立微服务。

浏览器边界由导入 dispatcher 和 OCR 管线体现：[`app/lib/import/dispatcher.ts`](../../app/lib/import/dispatcher.ts) 对 XLSX、PDF、TradingView CSV 做本地检测与解析；截图 OCR 相关代码在 [`app/lib/import/screenshot`](../../app/lib/import/screenshot)；用户确认后的正常导入由工作区调用 `/api/storage/trades` 写入服务端。导出也由浏览器工作区触发，生成 Markdown、图片或 ZIP，目录选择由浏览器能力完成。

## 技术栈与运行拓扑

当前依赖是 React 19、TypeScript、vinext/Vite、Next App Router 形状的路由、Lightweight Charts、SheetJS、PDF.js、PaddleOCR/ONNX Runtime、Decimal.js 和 Vitest，具体版本见 [`package.json`](../../package.json)。本地启动由 [`scripts/start-local.mjs`](../../scripts/start-local.mjs) 设置绝对 `TRADEREVIEW_DB_PATH`（开发默认 `.data/tradereview.sqlite`）并启动 vinext；存储 API 明确声明 `runtime = "nodejs"`，例如 [`app/api/storage/bootstrap/route.ts`](../../app/api/storage/bootstrap/route.ts)。

Node API 通过 [`db/sqlite.ts`](../../db/sqlite.ts) 打开并缓存 `DatabaseSync`，启用外键、WAL 和 5 秒 busy timeout；迁移在同一模块中以 `begin immediate` 事务执行。SQLite 生产默认路径为 `/var/lib/tradereview/tradereview.sqlite`，可由 `TRADEREVIEW_DB_PATH` 覆盖。Docker Compose 将 `./data/sqlite` 挂载到该目录并以 `/api/storage/status` 做健康检查，见 [`deploy/compose.yaml`](../../deploy/compose.yaml) 和 [`deploy/DEPLOYMENT.md`](../../deploy/DEPLOYMENT.md)。部署脚本以 release 目录和同一数据目录切换应用版本，发布代码不会另建业务库。

仓库还保留 [`worker/index.ts`](../../worker/index.ts)、[`vite.config.ts`](../../vite.config.ts) 中的 Cloudflare Worker、D1 binding 和 R2 binding 接线，以及 [`db/index.ts`](../../db/index.ts) 的 Drizzle D1 helper；`.openai/hosting.json` 当前 `d1`/`r2` 均为空，且 `db/schema.ts` 有意为空。因此它们是 vinext/Cloudflare 构建模板或历史部署遗留，当前本地业务读写不经过 D1、R2 或 `getDb()`。

## 模块职责

| 模块 | 当前职责 | 主要证据 |
| --- | --- | --- |
| 工作区 UI | 交易库、图表回放、绘图、复盘、导入核对、Recall 导出 | [`app/components/trade-review-workspace.tsx`](../../app/components/trade-review-workspace.tsx)、[`app/components/review`](../../app/components/review) |
| 导入 | 本地识别和解析富途/Tiger/招商证券文件、TradingView 模拟 CSV、截图 OCR；保留指纹和证据 | [`app/lib/import/dispatcher.ts`](../../app/lib/import/dispatcher.ts)、[`app/lib/import/statement-evidence.ts`](../../app/lib/import/statement-evidence.ts) |
| 交易领域 | 按账户、证券和交易性质聚合成交为 episode；处理方向、持仓、缺失历史和费用证据 | [`app/lib/trades/types.ts`](../../app/lib/trades/types.ts)、[`app/lib/trades/episodes.ts`](../../app/lib/trades/episodes.ts) |
| 存储 | 校验 JSON 合约、合并导入、CAS 复盘写入、行情/覆盖/设置/建议持久化 | [`app/lib/storage/sqlite-store.ts`](../../app/lib/storage/sqlite-store.ts) |
| 行情 | 前端按成交区间规划缓存缺口和刷新；API 负责限流、超时、取消、provider fallback；服务端结果回写 SQLite | [`app/lib/market/sync-service.ts`](../../app/lib/market/sync-service.ts)、[`app/api/market-data/daily/route.ts`](../../app/api/market-data/daily/route.ts)、[`app/lib/market/providers/router.ts`](../../app/lib/market/providers/router.ts) |
| Recall | 从持久化成交构建回合，保存草稿和正式完成版本，按 revision 做并发控制 | [`app/lib/recall/server-repository.ts`](../../app/lib/recall/server-repository.ts)、[`app/lib/recall/document.ts`](../../app/lib/recall/document.ts) |
| 洞察与复盘 | 回合事实、标签建议、评价和交易室指标，作为存储 API 的业务消费者 | [`app/lib/insights`](../../app/lib/insights)、[`app/lib/reviews`](../../app/lib/reviews) |

## 核心领域模型与存储

领域主线是 `Instrument → TradeExecution → TradeEpisode → Review/Recall`：证券身份由 `instruments` 保存；一笔规范化成交由 `executions` 保存并可关联 `import_batches`；[`buildTradeEpisodes`](../../app/lib/trades/episodes.ts) 按账户、证券和交易性质/模拟运行分组，通过买卖数量回放形成 open/closed episode。`reviews` 保存计划、复盘、绘图、修订和确认标签；Recall 的草稿/正式版本单独保存，避免编辑草稿覆盖上次正式快照。

SQLite 表由 [`db/sqlite-schema.ts`](../../db/sqlite-schema.ts) 的 1–7 号迁移建立：

- `instruments`、`executions`、`import_batches`、`data_migrations` 构成交易和导入主链；`evidence_json`、`reconciliation_json`、来源字段保留可审计证据。
- `reviews`、`recall_documents`、`tag_suggestions`、`trade_revisions` 保存复盘文档、建议和审计修订。
- `daily_candles`、`market_candles`、`coverage`、`interval_coverage`、`provider_symbols`、`market_data_jobs` 保存行情、来源映射、覆盖范围和刷新状态。
- `app_settings` 保存 JSON 设置。JSON 列使用 SQLite `json_valid` 检查；外键启用，行情表对证券级联删除，成交对证券限制删除。

金额、数量、价格在领域层使用字符串并由 Decimal.js 计算，避免浮点精度损失；没有证据的费用、时间精度或盈亏会保留未知/不可用状态。模拟交易通过 `trade_nature`/`simulation_run_id` 和来源字段与真实成交分开，演示帧也不进入导入成交库。

## 关键数据流

### 导入与迁移

1. 浏览器读取文件字节，计算 fingerprint，dispatcher 检测格式并在浏览器解析；PDF 文本由 PDF.js 提取，截图由本地 OCR 管线处理。
2. UI 展示区间、成交、排除项、来源证据和冲突，让用户确认或修正。解析失败、格式歧义、证据不足会阻断导入。
3. 正常确认导入由工作区通过 [`/api/storage/trades`](../../app/api/storage/trades/route.ts) 调用 `mergeTradeData`，在事务内按规范化成交身份和可信来源溯源去重/报告冲突。
4. 旧 `localStorage`/IndexedDB 的历史集合才通过 [`/api/storage/migrate`](../../app/api/storage/migrate/route.ts) 以 `BrowserStatePayload` 一次性迁移；`SqliteStore.mergeBrowserState` 按 fingerprint、规范化成交身份和可信来源溯源去重，`data_migrations` 记录 source fingerprint、计数和校验摘要。正常读取从 SQLite bootstrap 获取，迁移后不会把原始券商文件上传到服务端。

### 行情与 Recall

行情路径由前端 `sync-service` 根据成交区间和 coverage 规划缺口，先读 SQLite 缓存；需要补齐时调用 `/api/market-data/daily` 或 `/api/market-data/intraday`，再用 `/api/storage/market-data` 提交蜡烛和覆盖状态。服务端 provider router 按市场和周期选择腾讯、东方财富、Yahoo、百度，必要时使用可选 Tiger；盘中路由还会为 A 股 `1h` 注入 BaoStock（见 [`app/api/market-data/intraday/route.ts`](../../app/api/market-data/intraday/route.ts)），美股 `1h` 的候选链包含 Sina US，并在空结果、稀疏小时数据、限流、超时和拒绝时降级。缓存完整时不请求外部来源。`1h/4h/1w` 等展示周期的聚合由市场模块从底层缓存计算，原始持久化表仍按日线或原生间隔保存。

Recall 读取成交后由 [`server-repository.ts`](../../app/lib/recall/server-repository.ts) 重建 episode。文档把成交分配到决策（`decisions`），每个决策可保留带图像、绘图、视野和时间范围的周期快照（`snapshots`）；工作稿支持全局/决策局部草稿，快照仍是可导出的正式留存。回放同时携带行情游标 `cursor` 与成交揭示游标 `executionCursor`，分别限制当前已知行情和已揭示成交，避免同一根 K 线中的后续成交提前进入持仓。保存时在 `begin immediate` 事务内读取当前 revision、比较 `expectedRevision`，再写入草稿；显式 finalize 前由服务端重新确认 episode 已闭合，正式版本与草稿分栏保存。revision 不匹配返回 409，防止旧页面覆盖新编辑。

## API、安全、并发与迁移

存储 API 统一返回 JSON、`Cache-Control: no-store`，对请求结构、字符串、枚举、JSON 可序列化性和证券存在性做校验；无库时返回 503，未知资源返回 404，冲突返回 409。行情和证券资料公开 API 使用客户端识别的内存限流（通常每分钟 30 次）、AbortController 和有限超时；日线约 55 秒、盘中约 12 秒、证券资料由 [`app/lib/instruments/metadata-timeouts.ts`](../../app/lib/instruments/metadata-timeouts.ts) 控制。来源配置通过绝对路径 `TIGER_OPENAPI_CONFIG` 指向仓库外文件，密钥不应进入代码、日志或文档。

SQLite 使用 WAL、外键、busy timeout 和事务；写入迁移、批量合并、行情提交、Recall CAS 都以事务保护。迁移表保存每条迁移的 checksum；已有版本 checksum 不匹配会停止启动。迁移 4/5 兼容一次已发布的模拟交易历史版本，说明该迁移历史曾出现编号冲突，当前代码只接受精确 checksum 后提升版本。

这些措施解决的是单机单用户和同一数据库并发写入，不是多租户认证或跨实例协调。当前 API 没有用户登录/授权层；部署指南默认只绑定 `127.0.0.1:3000`，将 `APP_BIND=0.0.0.0` 暴露到公网需要额外的反向代理、HTTPS 和访问控制配置。

## 运行、部署与恢复

开发环境要求 Node.js `>=22.13.0`，`npm run dev` 启动本地 vinext，默认数据库为工作树下 `.data/tradereview.sqlite`。Docker 运行时是 Node 22 slim，构建阶段执行 OCR 资源准备和 vinext build；运行阶段安装 SQLite CLI，服务监听容器 3000。Compose 将业务库、备份和日志置于部署根目录，运维脚本提供备份、恢复、健康检查、回滚和 release 保留，详见 [`deploy/DEPLOYMENT.md`](../../deploy/DEPLOYMENT.md)。

部署数据目录是跨 release 共享的单一 SQLite 来源；备份使用 SQLite 在线备份和 `quick_check`，恢复前先保留一致性副本，失败时换回原库。浏览器迁移和生产部署的数据库迁移是两条不同机制：前者处理客户端历史集合，后者处理 SQLite schema/data migration。

## 历史设计与当前约束

历史文档和计划中出现的 D1、R2、站点托管以及浏览器数据库方案，不能直接视为当前运行拓扑。当前实现已经把业务读写集中到 Node `node:sqlite`/SQLite；Cloudflare Worker 和 Drizzle D1 仍服务于 vinext 构建兼容性，但没有实际 D1 binding。当前也没有云端跨设备同步、实时行情或盘口数据、多用户权限和跨实例锁。

已知运行约束包括：公开行情源可能限流、拒绝或改变格式；无 Key 的来源不能保证完整的历史分钟覆盖；支持的券商版式和截图版式有限；原始文件只在浏览器解析，服务端只接收确认后的结构化数据和有限来源证据；单机 SQLite 是故障和并发边界。上述约束来自 [`README.md`](../../README.md)、provider 路由和部署脚本的实际行为，而非未来计划。

## 选择与后果

### 选择

当前代码采用浏览器本地解析 + 同源 Node API + 本机 SQLite 的单机拓扑；以规范化证券/成交/回合为主线，以 JSON 证据字段承载券商差异；行情采用缓存优先、缺口调度和多 provider 降级；Recall 采用草稿/正式版本分离和 SQLite CAS revision。

### 后果

这种选择让原始券商文件和 OCR 内容留在用户浏览器，部署简单、备份边界清晰，并能在外部行情短暂不可用时继续使用已有缓存。代价是服务需要本机文件系统和 Node SQLite 运行时，数据天然绑定单机；没有认证、跨设备同步或多实例写协调。provider fallback 只能改善可用性，不能保证历史覆盖或商业授权；JSON 证据灵活但会把一部分模式校验和演进责任留在应用层。

## 证据与维护规则

本记录的主要证据是上文链接的源码、迁移 SQL、路由和部署文件。架构图见 [`architecture.html`](architecture.html)，规格见 [`architecture.json`](architecture.json)；图中的“行情与资料适配”是服务端 provider 请求，“缺口调度/缓存查询”仍在前端 `sync-service`，两者不要合并解释为独立后台服务。代码边界变化时，应更新本 ADR、图规格和验证回执；不应把本回溯文件当作未经代码验证的目标架构。
