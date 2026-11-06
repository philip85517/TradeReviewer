# 首页调整实现预检

2026-10-06 18:29 Asia/Shanghai · homepage_preflight · 只读源码/进程/数据库检查；未改应用、未启动/重启服务、未提交；未运行全仓测试。用户后续“开始推进修复”由协调者记录，覆盖旧草案“仅规划”的阶段边界。

## 实现边界

| 元素 | 可独立写入边界 | 真实接口与集成要求 |
| --- | --- | --- |
| H03 金额摘要 | `app/components/dashboard/room-portfolio-summary.tsx`、其 CSS 与测试 | `CurrentPortfolioModel.rows` 已含逐仓 marketValue/cost/unrealizedPnl、holding.settlementCurrency，可按币种和指标分别计算覆盖；现有 coverage 是全组合，不可直接贴在每个币种旁。dailyPnl 和收益率已独立传入。无需改变财务算法。 |
| H05/H06 分布与问题 | `room-allocation.tsx`、其 CSS/测试及新增局部详情组件 | 比例已有 `group.complete && denominator > 0` 门槛；完整空头使用 SignedBars/总敞口，不能回退成自动禁用。灰环实际来自 `.unavailableChart` 的 12px border/50% radius。现组件没有 retry/data-check callback，root 必须接 `holdingsRefresh.request()` 与 `onOpenDataCheck`/质量流程，独立详情不能只渲染动作。 |
| H04 趋势 | `room-holdings-history.tsx`、其 CSS/测试 | Props 只有 model/reportCurrency/periodControls/periodLabel。观察期间由 dashboard 管，metric/granularity/selection 是组件本地状态；默认 day，原币所有系列共享一个 valueDomain。单币选择、自动粒度可以在此切片实施，必须定义保留/重置规则。 |
| H07 日期/明细接线 | root 的 dashboard；必要时 holdings 与历史组件按先约定接口分派 | 历史选点只改变组件内部 selection；内部历史持仓表跟着选点。`RoomHoldingsPanel` 始终拿 currentHoldingsScope/portfolioModel，只有 query/page browseState，没有历史日期 prop。如 H07 指下方独立明细随日期改变，必须先明确 snapshot/日期/callback 的接线，不能只改标题冒充联动。 |
| H01/H02/H08 与更新整合 | root 唯一写入 `review-dashboard.tsx`/CSS/测试；workspace 接线也由 root | 已有 UnifiedPageHeader slots；优先用 scopeActions/status/globalTools/filters，不增加第二页头。activeFilterChips 当前在 roomFiltersOpen 条件内部，关闭后全部消失，要挪至常见层。上方待复盘可锚点进入同页现有列表；列表继续使用准确 episode ID 与 queueIds。 |

`RoomPerformance` 在复盘区，拥有独立日历与 closed-trade 范围。它不是持仓趋势组件；不要把观察期间 patch 到其 scope。pending 表默认 3 条；`page` 与 `onPageChange` 已由 root 控制，可压缩分页不改变真实页码/返回链。

先接受 H03 已知小计 → H06 缺口详情/真实动作 → async 更新 → 金额/覆盖恢复，再扩大日期联动，符合当前流程。协调者还需在 DESIGN-COVERAGE.md 写准确规格、状态、所有权与证据后派发，不能以本预检代替设计契约。

## 方案与真实契约的差异 / 必须明确的选择

1. 旧 proposal 和 01–06 决策票仍明确“候选/设计决策票/Resolution None”。后续授权允许推进，但应保存用户原话与选定默认值、形成实施票/视觉契约；不能把所有尚未决定的尺寸和阈值宣称原本已批准。9 月绩效在前与新持仓在前差异已有草案记录，当前源确实持仓在前。
2. H02 的 `pendingModel.count` 来源 `buildPendingReviews(roomModel.rows, ...)`，因此受当前复盘统计期间及 room filters 限制；通知数量另有来源。顶部“实时数量”应标清“当前统计范围”，或明确更改计数范围并同步列表，不得顶部全期间、下部当前期间。加载来源由父层 `globalEntryStatus` 提供，不能直接在 loading 时显示 0。
3. `ReviewDashboard` 没有已保存复盘游标/恢复进度 props；`onOpenInReview` 在 workspace 选准确回合后设 historyMode=`history`、panel=`notes`。应提供“待复盘/开始复盘”，不凭 pending 状态创造“继续复盘”。直接入口返回靠当前已挂载 dashboard 的状态；pending library 路径另有 `RoomPendingSourceSnapshot`，包含 sharedScope、roomScope、observationPeriod、historyPeriod、holdings query/page、pending page、historyCalendar。刷新只持久化既有 browse preferences，不保证所有本地图表状态可恢复。
4. summary 当前金额原币使用 `/` 拼接字符串，币种/金额不是独立不可拆行；coverage 是全卡，时点是底部统一文字并 `shortDates` 丢掉时刻。可改为独立币种行，贴指标覆盖，明确“全组合”；不能从有市值推断成本/盈亏/收益率可用。
5. 原币默认稳定 CNY→HKD→USD 必须新实现：allocation 当前取 `availableCurrencies[0]`（row 顺序），趋势当前显示所有币种。两者是否共享图内选项要先约定，不能隐式改 sharedScope/reportCurrency。报告计价只有 original/CNY/HKD；USD 是原币系列，不是现有目标折算模式。
6. 自动粒度 92/730 天是候选，现有 sampler 只取周/月末可用快照。其 `sampleHoldingsHistory` 不保留桶内每个缺失/成员变化边界；下游 buildSeriesSegments 只看采样后的 coverage。新自动采样若直接启用可能跨越桶内缺失，须有边界反例测试，并先约定 sampler 扩展接口/唯一文件 owner。不得把值求和。
7. 对细粒度报价/成本保留现有原值，不统一 toFixed(2) 到 ETF 单价。pending closingPrice 已保留最多 6 位与原值详情。
8. 现有字体存在 9px（allocation note/legend/cash、dashboard 部分密度样式），allocation tabs min-height 36px；新 14/12px、44px 契约要求实际调整，不是已有 PASS。overview 当前以 viewport <=1054px 单列，proposal 用内容宽 <900px；应使用 dashboard 内容测量或 container query，并在导航展开状态比较。
9. 更新状态已有真实 hook：phase/label/detail/announcement、active、request/cancel；historyWorker 另有 statusReason/error/retry。只改呈现，保持 acceptedInput===currentInput 判定、兼容旧快照检查、scheduler/session 去重/预算；不要再造第二个全局调度器。旧最终验收明确全仓 lint 与 unit FAIL，不能本轮报告全绿。

## 当前预览与隔离数据

`conf/runtime.json` 默认共享库 `/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite`、3022、127.0.0.1。保持不变。

18:26 实际检查：3031 listener **PID 91640**，16:59:15 启动；父链 npm 91621 → start-local 91639 → vinext 91640；cwd 是本工作树；lsof 明确打开 `.scratch/local-review-20261006/review.sqlite`、WAL、SHM。旧 FINAL-ACCEPTANCE 的 PID 62247/session 30810 是历史证据，不能写成当前进程。现服务为 production `start`，新源码需重新构建并确认属于当前授权后重启该链，不能期望 HMR。

复用已隔离且含 prior market cache 的 review.sqlite，可避免重复下载。建议沿用原 `start-preview.sh`（绝对 TRADEREVIEW_DB_PATH 已正确）：

```sh
npm run build
sh .scratch/holdings-valuation-repair-20261006/start-preview.sh
```

启动前检查 `lsof -nP -iTCP:3031 -sTCP:LISTEN`，确认该工作树旧服务后由 root 停旧/起新；不动正式 3022。实现阶段如需要 dev 服务，显式使用同一隔离路径与确认空闲端口，避免多个服务同时自动补同一隔离数据；不要删库或复制 SQLite 主文件遗漏 WAL。

本预检没有浏览器操作。root 通知：CUA 对 3031 的访问已安全拒绝，已请用户恢复访问，禁止重试其他浏览器/自动化入口；真实浏览器验收目前 **BLOCKED / NOT VERIFIED**。源码工作可推进，此限制不能以 HTTP、DOM 测试或历史截图消除。

## 原始数据保护核对

18:28 用 `node:sqlite DatabaseSync(path,{readOnly:true})`，四表按 rowid 全行 JSON 的 SHA256；共享/隔离各 4 项均与 prior `assets/data-integrity-final-delivery.json` **一致**。没有数据库写入。

| 表 | 两库 count | 两库 SHA256 |
| --- | --- | --- |
| executions | 1866 | `75fe94e2737f1fc68361770e12ee453b7dca2e21cd99335896ebd5b0c085ac8c` |
| import_batches | 213 | `3ab12ede2dc903bbc5d865b0d31821529f55475f0de7280ad67c58587baf5e41` |
| trade_revisions | 11 | `1b6f1f70f6591690ce3c0d7d1a0770540c9cc5edfdfe775bf6602a9881c0bb60` |
| account_principal_provisionals | 1 | `3cc4cf25fcac825f58d3a57e1e404e28e8639e180ba4a3254ae171cf38942379` |

后续沿用相同算法保存本次 before/after；market candles 增长不算原始成交污染。若本次真实复盘保存有意增加 trade_revisions，须记录准确对象/原因/预期差异，不能机械要求 revisions 全表不变；executions/import_batches 原始字段仍须不变。保存后的返回/刷新及失败/取消保持旧值依然必须通过真实隔离持久化验收。

预检结论：文件边界可分派；H07 日期接口、pending 计数范围、自动采样边界应由 root 先固定。功能、端到端、视觉接受尚未执行，不构成本轮 UI 完成证据。
