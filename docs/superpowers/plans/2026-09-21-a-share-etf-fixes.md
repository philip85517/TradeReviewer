# A 股持仓证据与 ETF 市场归因修复计划

> 目标：修复招商证券 PDF 导入后 A 股/ETF 首笔卖出被误判为负向持仓的问题，并统一交易室按交易市场统计收益。
> 执行方式：当前隔离 worktree 内由主协调者按 TDD 顺序执行；保留工作区既有修改，不推送、不合并、不覆盖真实交易数据库。

## 已确认根因与边界

- 招商证券流水表的“证券余额”已存在于 PDF 和表格解析层，但当前只用于成交行指纹，未进入 `MonthlyStatement`，因此首笔卖出没有可信期初库存。
- “方向待核对”是通用负仓差额状态，不代表 A 股存在真实做空；修复应优先补齐来源期初/期末持仓证据，不把 A 股负仓自动解释为空头。
- 交易室当前先按 `assetType === "etf"` 分到 ETF 类别，导致 A 股 ETF 没有计入 A 股市场汇总。新口径是 CN-SH/CN-SZ → A股，HK → 港股，US → 美股；ETF 仅保留为资产类型筛选。
- 原始 PDF 只读核验；浏览器导入/数据重算使用独立 SQLite，不能改写用户现有库。

## Task 1: 接入招商证券“证券余额”持仓证据

- **文件范围**：`app/lib/import/china-merchants.ts`、`app/lib/import/china-merchants.test.ts`，必要时仅调整相关 import-evidence 测试。
- **行为**：为可解析成交行生成同一文档的 opening/closing `StatementPosition`；首行 opening quantity = 该行证券余额 - 成交的有符号数量，逐行保留 closing quantity 和 PDF 页/行来源；证据随 records 附着并通过 `monthly` 持久化。缺失或不可解析的证券余额必须标记 `reviewRequired/historyIncomplete`，不得静默按 0。
- **禁止**：不修改成交数量、价格、费用和交易市场；不把 ETF 标的内容重新分类市场；不从无证据的负数余额推断做空。
- **测试**：先增加失败测试，覆盖买入后卖出、首笔卖出期初库存、缺失证券余额复核标记，以及证据来源定位；然后实现并跑招商证券 parser、statement-evidence、相关 replay 测试。
- **验收**：现有 parser fixture 保持交易行结果不变；新结果含可信 `monthly.positions`，首笔卖出能读到 opening position。

## Task 2: 按交易市场归因并提供 ETF 次级筛选

- **文件范围**：`app/lib/reviews/trading-room-scope.ts`、`app/lib/reviews/trading-room-scope.test.ts`、`app/components/dashboard/review-dashboard.tsx` 及其必要测试。
- **行为**：分类顺序按市场优先：A股、美股、港股、未知；ETF 只保留 `assetType`，同一市场下的 ETF 与股票进入同一收益汇总。筛选器把市场和资产类型拆开，ETF 不再作为市场主分类；兼容旧调用者传入 `assetCategory: "etf"` 时仍可筛 ETF，但不生成独立 ETF 收益类别。
- **禁止**：不改变已有日期、实盘/模拟盘、账户、币种和复盘状态筛选口径；不重做页面信息架构，不扩展无关视觉设计。
- **测试**：先验证 A 股 ETF 进入 A 股类别、港/美 ETF 分别进入对应市场、资产类型筛选只缩小结果、不再出现独立 ETF summary category。
- **验收**：A股市场收益包含 A 股 ETF；“ETF”只作为资产类型条件，页面标签和汇总文案清楚表达按交易市场统计。

## Task 3: 集成回归与真实页面验收

- **文件范围**：本地任务记录与验证产物；除前两项必要修复外不扩展业务代码。
- **行为**：运行全套相关测试、类型检查和构建；在独立 SQLite 中重新导入用户提供的招商证券 PDF，确认相关 ETF 期初库存、A股归因和收益结果；启动当前 worktree 服务，使用真实浏览器检查首页和筛选交互。
- **验收**：原始 PDF 文件未变；无“方向待核对”由缺失证券余额导致的目标负仓；A股 ETF 不再出现在独立 ETF 主分类；最终报告给出可点击预览 URL、验证命令和已知限制。

## 执行顺序

1. 任务 1：红灯测试 → 实现 → parser/replay 回归。
2. 任务 2：红灯测试 → 实现 → scope/dashboard 回归。
3. 任务 3：集成测试 → 独立数据库导入核验 → 浏览器验收 → 独立复核。
