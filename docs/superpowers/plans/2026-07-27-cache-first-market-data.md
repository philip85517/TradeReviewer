# Cache-First Market Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax so progress remains auditable.

**Goal:** 为已导入的美股、港股和 A 股成交补齐无需 API Key 的真实日线数据，以 IndexedDB 长期缓存；完整命中缓存时保持零外部请求，并在复盘页支持日线/周线切换。

**Architecture:** 浏览器端的 Coverage Planner 只根据交易区间和 IndexedDB 覆盖信息计算缺口；同源 API Route 只接收白名单市场、代码和日期，按腾讯 → 市场备用源路由并统一响应；同步服务校验完整批次后，以单个 IndexedDB 事务写入 K 线和覆盖元数据。图表只从本地仓库读取，周线由缓存日线确定性聚合。

**Tech Stack:** TypeScript 5.9、Next/vinext、React 19、Lightweight Charts 5、原生 IndexedDB、Vitest、Testing Library、fake-indexeddb、Cloudflare Workers/Sites。

## Global Constraints

- 持久化价格和成交量使用十进制字符串；只在图表边界转为 `number`。
- 完整缓存命中时，Coverage Planner 必须返回空请求，Sync Service 不得调用 `fetch`。
- Provider 不接收账户、成交、笔记或用户标识；代理不能成为通用 URL 转发器。
- 只请求原始日线。周线在本地聚合；不混用复权与未复权序列。
- 网络或格式错误不得覆盖既有可用缓存；部分返回只能形成 `partial` 覆盖。
- 每项实现遵循 Red → Green → Refactor，并在进入下一项前运行目标测试。

---

## Task 1: 固化行情领域契约和来源代码映射

**Files:**
- Create: `app/lib/market/contracts.ts`
- Create: `app/lib/market/symbol-map.ts`
- Test: `app/lib/market/symbol-map.test.ts`
- Modify: `app/lib/market/types.ts`

- [ ] 编写失败测试，覆盖 `HK:1810 → hk01810`、`CN-SH:600519 → sh600519`、`CN-SZ:000001 → sz000001`，以及美股候选 `.N/.OQ/.A`。
- [ ] 运行 `npx vitest run app/lib/market/symbol-map.test.ts`，确认因模块缺失失败。
- [ ] 定义 `SupportedMarket`、`AdjustmentMode`、`DailyCandleRecord`、`CoverageSegment`、`CoverageStatus`、`DailyCandleRequest`、`ProviderResult` 和 `MarketDataProvider`。
- [ ] 实现严格代码规范化；不认识的市场或非法代码抛出类型化错误，不猜测。
- [ ] 保留现有数字型 `Candle` 作为图表 DTO，并增加从 `DailyCandleRecord` 转换的单一边界函数。
- [ ] 运行目标测试、`npm run typecheck`。

## Task 2: 实现 Provider 解析、校验和路由

**Files:**
- Create: `app/lib/market/providers/errors.ts`
- Create: `app/lib/market/providers/tencent.ts`
- Create: `app/lib/market/providers/eastmoney.ts`
- Create: `app/lib/market/providers/yahoo.ts`
- Create: `app/lib/market/providers/router.ts`
- Create: `app/lib/market/validation.ts`
- Create: `app/lib/market/providers/__fixtures__/*.json`
- Test: `app/lib/market/providers/providers.test.ts`
- Test: `app/lib/market/validation.test.ts`

- [ ] 先以固定响应夹具编写失败测试，覆盖三市场腾讯数据、A 股东方财富备用和港/美股 Yahoo 备用。
- [ ] 为 403、429、超时、空数据、格式变化定义稳定错误码；Yahoo 429 不立即重试。
- [ ] 实现腾讯原始日线解析：行格式 `[日期, 开, 收, 高, 低, 量]`；美股候选代码仅在首个响应为空时顺序探测。
- [ ] 实现东方财富 `fqt=0` 解析和 Yahoo 原始 OHLCV 解析。
- [ ] 实现校验：严格升序、无重复、区间内、`low <= open/close <= high`、价格和量非负。
- [ ] Router 对 US/HK 使用腾讯后接 Yahoo，对 CN-SH/CN-SZ 使用腾讯后接东方财富；可用结果携带真实 provider、providerSymbol、fetchedAt 和 warnings。
- [ ] 运行 Provider/校验测试、`npm run typecheck`。

## Task 3: 建立受限同源日线接口

**Files:**
- Create: `app/api/market-data/daily/route.ts`
- Create: `app/lib/market/request-policy.ts`
- Test: `app/api/market-data/daily/route.test.ts`
- Delete: `app/api/market-data/refresh/route.ts`

- [ ] 编写 GET Route 失败测试：合法请求、非法市场/代码/日期、超过 500 个自然日、来源限流、无可用来源。
- [ ] 实现 `GET /api/market-data/daily?market=&symbol=&start=&end=`；仅允许四个市场和日线。
- [ ] 加入 12 秒超时、类型化错误映射、`Cache-Control: public, max-age=21600, stale-while-revalidate=86400`。
- [ ] 使用 `CF-Connecting-IP`/`x-forwarded-for` 做进程内尽力限流，同时依赖严格请求形状避免开放代理；文案不得宣称这是全局强限流。
- [ ] 删除旧占位 Route，运行 Route 测试、`npm run typecheck`。

## Task 4: 实现版本化 IndexedDB 行情仓库

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `app/lib/storage/market-data-repository.ts`
- Create: `app/lib/storage/indexeddb-market-data-repository.ts`
- Test: `app/lib/storage/indexeddb-market-data-repository.test.ts`

- [ ] 安装锁定的 `fake-indexeddb` 开发依赖并编写失败测试。
- [ ] 创建 `trade-reviewer` v1：`dailyCandles` 复合键 `[instrumentId,tradingDate,adjustmentMode]`，`coverage` 键 `instrumentId`，`providerSymbols` 复合键 `[instrumentId,provider]`。
- [ ] 实现按股票/区间读取、覆盖读取、来源映射读取，以及“蜡烛 + 覆盖 + 映射”单事务写入。
- [ ] 测试重复写入幂等、事务失败回滚、schema 升级、日期范围读取和旧缓存保留。
- [ ] 运行仓库测试、`npm run typecheck`。

## Task 5: 实现内置交易日历和缺口规划

**Files:**
- Create: `scripts/generate_exchange_holidays.py`
- Create: `app/data/exchange-holidays-2010-2030.json`
- Create: `app/lib/market/calendar.ts`
- Create: `app/lib/market/coverage-planner.ts`
- Test: `app/lib/market/calendar.test.ts`
- Test: `app/lib/market/coverage-planner.test.ts`

- [ ] 先写失败测试，覆盖周末、三市场代表性节假日、最近完整交易日和日历范围外降级。
- [ ] 生成并提交 2010–2030 的 XNYS、XHKG、XSHG 休市表；首期 SZSE 使用同版本中国交易日表。
- [ ] 实现所需范围：首笔成交前 400 个自然日；已平仓最后成交后 35 日；开放持仓到最近完整交易日。
- [ ] 合并同股多个回合范围，再减去 `complete` 覆盖；每个请求块最多 500 个自然日。
- [ ] 缓存完整测试必须断言规划结果为 `[]`；日历范围外返回 `partial/calendar-out-of-range`，不得伪装完整。
- [ ] 运行日历/规划测试、`npm run typecheck`。

## Task 6: 实现 Cache First 同步服务

**Files:**
- Create: `app/lib/market/sync-service.ts`
- Test: `app/lib/market/sync-service.test.ts`
- Modify: `app/lib/storage/market-data-jobs.ts`
- Modify: `app/lib/market/sync-status.ts`

- [ ] 使用内存仓库与 fetch spy 写失败测试：完整命中零请求、只取缺口、网络失败保留缓存、部分响应、主动更新仍只补缺口、开放仓位 12 小时门槛。
- [ ] Sync Service 依次执行读取覆盖 → 规划缺口 → 同源请求 → 校验 → 原子写入；同一股票使用请求序号/AbortSignal 防止旧响应覆盖新状态。
- [ ] 将状态扩展为 `not-requested | syncing | complete | partial | stale | source-unavailable | invalid-response | storage-error`，并迁移旧 localStorage job 状态。
- [ ] 实现有效日线不足 260/20 根时的前向或后向追加规划。
- [ ] 所有错误路径保留旧 K 线和可读状态，运行同步服务测试、全部单元测试和类型检查。

## Task 7: 接入导入流程、单股更新与本地日/周图

**Files:**
- Create: `app/components/review/imported-market-chart.tsx`
- Create: `app/lib/market/use-market-data.ts`
- Modify: `app/components/review/imported-episode-review.tsx`
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: `app/components/trade-review-workspace.test.tsx`
- Modify: `app/globals.css`

- [ ] 编写组件失败测试：真实股票名、缓存状态/来源/区间、更新按钮、1D/1W 切换、错误与离线降级。
- [ ] 导入确认后为新增或扩展区间的股票启动同步；完整缓存股票不触发请求。
- [ ] 单股“更新行情”复用同一缺口同步服务；不提供隐式全量重下。
- [ ] 从 IndexedDB 读取日线，使用现有 `aggregateCandles` 生成周线并渲染 Lightweight Charts；成交点保持叠加。
- [ ] 用股票名 + 代码替代隐晦标题，并显示真实来源和抓取时间。
- [ ] 运行组件测试、`npm run test:unit`、`npm run typecheck`、`npm run lint`。

## Task 8: 验收、文档和公开部署

**Files:**
- Create: `tests/market-data-cache-first.test.mjs`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-27-data-trade-library-pattern-insights-design.md`

- [ ] 添加固定夹具的渲染验收；开发环境用受控 fetch 记录验证：首次打开有缺口请求，刷新/切股/切回合/切 1D-1W 均为零请求。
- [ ] 对 Tencent 三市场和备用源分别做一次非阻断 live smoke；记录日期、状态和来源，不把外部稳定性作为单元测试条件。
- [ ] 运行 `npm run test:unit && npm run typecheck && npm run lint && npm test && npm run build`。
- [ ] 在浏览器完成导入 → 自动补数 → 日/周切换 → 重载缓存 → 单股更新 → 离线只读的人工回归，并保存截图。
- [ ] 更新 README：数据源免责声明、本地存储、缓存策略、清缓存与导出提示。
- [ ] 提交精确源码状态，创建 Sites 版本并部署公开站点；检查部署状态直到终态，再访问生产 URL 验收。
- [ ] 仅在所有证据通过后宣布第一阶段完成，并进入交易库实施计划。
