# 首页 6+1 修复：独立只读审查

## 审查关闭确认：2026-09-21

收到中央最终验证结果后，再次只读核对 R1 当前 helper、model 与组件期间切换代码：全历史发现和当前 scope 统计仍分离，外部期间切换与内部下钻的处理保持此前独立验证的实现。**R1 无新增发现，可关闭；本次限定范围的独立代码审查关闭，无剩余阻断项。**

协调者报告（本审查未代跑）：typecheck/build/diffcheck 通过；完整 Vitest 1898 passed、5 skipped、0 失败断言，但原未修改 BOC 套件仍缺未跟踪 fixture，不表述为全套无错误。真实浏览器已完成 all history 695 → YTD 62 / 29146.06（月格）→ all 695 → 本月空样本（日格）→ last3 三个月格 / 4 样本 → custom 2025 年 116 / 126291.22 → all 695 的往返验收，与下述独立模型及组件验证互补。

本轮仅追加报告，未改应用文件；赔率、夏普及其他既定范围外项目仍未评估。

## 最终代码复审结论：2026-09-21 21:35 CST

**R1 已通过最终复核，可以关闭。连同此前已复核关闭的 R2–R9，本次限定范围内没有剩余代码审查阻断项。** 此结论不替代协调者正在执行的完整全量测试、typecheck/build 与真实浏览器最终验收；未把已知 BOC 缺 fixture 的情况隐去或判为通过。

R1 当前实现核验：

- [trading-room-calendar.ts:246](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/lib/reviews/trading-room-calendar.ts:246) 的 `findTradingRoomHistoryRange` 独立发现全历史，保留账户等非期间筛选，并按当前 asOf 排除未来交易与未平仓回合。
- 同文件 263–270、441 行的当前统计始终使用真实 `scope`，没有按 month/custom/YTD 等 preset 特判放宽范围。摘要、趋势和累计末值均由该范围的 rows 构建。
- [room-performance.tsx:269](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/dashboard/room-performance.tsx:269)、306 行区分内部期间请求与外部范围变化；实际往返操作确认外部快捷/自定义变化重置 calendar level 为 month、保留 view，内部年/月/日下钻保留正确层级。

独立验证结果：

1. **54 组模型组合通过**：本月、近三月、YTD、自定义单月、自定义跨年、自定义空范围六组期间 × month/year/all-years 三种日历层级 × day/week/month 三种趋势分桶。每组断言实际 rows 不越界，dashboard 摘要、calendar 摘要、trend endMoney、末点金额一致；对应测试金额为 110、180、200、60、120、空金额映射。每一种期间都能独立重新发现同一全历史范围。
2. **真实 ReviewDashboard 的 jsdom 点击流程通过**：每组均先连续点击两次“全部年份”，再点击快捷期间或通过真实日期输入应用 custom，随后切趋势核对卡片、累计末值和最后点详情。空范围保持“暂无样本”，不显示假零收益。每组后均可再次回到全历史金额 300。
3. **重复下钻与选择清理通过**：全部年份 → 2025 年 → 9 月 → 9 月 2 日详情；再切本月，日历视图保留且旧日期详情清理。趋势中切 YTD 仍为趋势、旧点选择清理。最后重新进入全部年份，摘要/末值/末点均恢复为 300。内部下钻不打开自定义编辑器。
4. 历史发现另验证账户过滤、未平仓排除、未来数据排除，以及不传 asOf 时按当前日期发现历史，而非受历史 custom 结束日限制。

两份本轮只读内存断言脚本退出码均为 0。已复读最新代码和相关回归测试，不以 A 的 36 tests 报告代替独立验证。未运行全套或 build，未访问数据库/行情源，未改应用文件；仅更新本报告。赔率、夏普、其他既定范围外事项仍未评估。以下保留分阶段及首次审查记录，当前状态以上述最终结论为准。

## 非 R1 复审记录：2026-09-21 21:29 CST

**当时 R2–R9 八项可关闭；没有发现这些修复中的新阻断问题。R1 当时按协调者要求暂不复审，等待 A 完成通知。** 最新状态见报告顶部最终结论。

| 项目 | 复核当前实现与独立重放结果 |
| --- | --- |
| R2 / 已关闭 | [quality-details.tsx:84](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/data-management/quality-details.tsx:84) 统一 await/catch，维度按钮和逐项按钮都调用该函数。分别点击两类按钮：进行中禁用、再次点击未重复调用；接入当前真实 retry 函数拒绝后显示失败并恢复按钮，`unhandledRejection=0`。 |
| R3 / 已关闭 | [trade-review-workspace.tsx:2388](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/trade-review-workspace.tsx:2388) 的实际入口只在取得锁的 callback 内将 `started=true`，并在等待运行结束后返回；3476 行将此返回值传给新 helper。抽取当前真实 start/retry 声明、使用真实锁函数，空锁结果为 false、运行调用次数 0，旧成功 job 未令 retry resolve；可用锁结果为 true。 |
| R4 / 已关闭 | [retry-market-data.ts:39](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/lib/market/retry-market-data.ts:39) 先检查 job 级失败，再按维度选择 interval。真实 helper + workspace retry 重放：`1D=complete、1h=source-unavailable、job=partial` 时 holdings resolve、historical reject；job 级 storage-error/error/source-unavailable/source-forbidden/invalid-response/source-rate-limited/needs-provider 七种状态均 failed；日线自身 storage-error/error 也均 failed，没有为忽略小时线而放过这些错误。 |
| R5 / 已关闭 | [trading-room-quality.ts:295](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/lib/reviews/trading-room-quality.ts:295)、335 行起复用 `statusReason` 与 `diagnostic`，源诊断仅追加为次级说明。用真实 holdings→quality 两层模型验证：pre-trade + source-unavailable、pre-trade + stale、币种不符 + not-requested、过期 + source-unavailable、未来报价 + source-unavailable；主原因逐项一致，前两类及币种/未来问题为查看数据，过期为 retry。 |
| R6 / 已关闭 | [room-performance.tsx:158](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/dashboard/room-performance.tsx:158) 显式区分周分桶。真实组件点击“周”后，轴标签分别为 `09-01~09-06`、`09-07~09-13`、`09-14~09-19`。 |
| R7 / 已关闭 | [room-performance.tsx:249](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/dashboard/room-performance.tsx:249) 仅已换算聚合使用 CNY。单 USD 无快照的实际点标签为 `USD · 2026-09-02，期间收益 +US$100.00，累计收益 +US$100.00`，没有 CNY 点标签。 |
| R8 / 已关闭 | [room-holdings.tsx:47](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/dashboard/room-holdings.tsx:47) 展示两位。真实模型保留数量 `1.23456789`，真实组件显示 `1.23`。 |
| R9 / 已关闭 | [review-dashboard.tsx:268](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/dashboard/review-dashboard.tsx:268) 先判断 same-currency。真实卡片在纯 CNY、无 FX 快照下显示 `CNY 原币`，不再显示“已按汇率快照换算”；详情仍说明无需换算。 |

复核方法及限度：

- 阅读新 helper 的全部代码/测试，检查 workspace 的真实调用和终态写入路径、QualityDetails 两类消费者，以及其余各项新增测试。没有仅根据实现者的测试数量关闭发现。
- 两份成功的内存 Node 断言脚本分别覆盖 R2–R4、R5–R9，退出码均为 0。第二份脚本首次因夹具抽取顺带包含 A 新增的 JSX 辅助函数而在初始化阶段失败；收窄为所需纯数据夹具后重跑通过。该脚本错误不是应用失败，也未计为通过的验证。
- R2–R4 使用从当前文件 AST 读取的真实 start/retry 函数，外围调度用内存依赖替代；不是完整 workspace/browser 网络运行。新增 workspace 锁测试点击“更新全部数据”，本身没有验证 holdings retry 消费者，独立脚本补验了真实 start 返回值贯穿 retry 的链路。
- 原有 R2 新测试分别覆盖逐项 pending 与维度 reject；独立脚本额外将两类按钮都置入拒绝路径。R8 仓库测试仅验证展示，独立脚本同时断言模型精度未改变。
- 没有运行全套 Vitest、typecheck/build，没有访问数据库或行情源；未修改应用文件，仅更新本报告。R1 的所有 preset、真实 scope 和全历史往返切换留待下一次明确通知后复审；本次对 R6/R7 的确认不包含 R1。

## 首次审查记录（历史）

审查时间：2026-09-21 21:07 CST。基线 HEAD：`2836a51049c876007895a5980ee7638a78780fcd`；审查对象是当前未提交工作树，包含未跟踪的 chart helper。已在收到 A/B/C 完成通知后复核当前文件。

当时结论：**仍有需修复的行为问题，不能仅凭 A22/B19/C43 的通过数量判为验收完成。** 下列 R1 为财务范围错误；R2–R6 为异步反馈、诊断或坐标日期问题；R7–R9 为较小的明确验收差异。最新处置见报告顶部。

## 主要发现

### R1 · P1：保留“全部年份”层级后，快捷期间会混入全历史金额

- 位置：[review-dashboard.tsx:585](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/dashboard/review-dashboard.tsx:585)、[room-performance.tsx:205](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/dashboard/room-performance.tsx:205)；计算入口 [trading-room-calendar.ts:428](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/lib/reviews/trading-room-calendar.ts:428)，末值赋值在 531 行。
- 触发：存在跨年成交 → 日历 → 全部年份 → 顶部“今年至今”。移除重建 key 后，`level` 仍为 `all-years`；`filterPerformanceRows(..., true)` 忽略新期间。再切回趋势，同一错误继续保留。
- 实际复现：2025-09-02 盈利 100、2026-09-02 盈利 200，截点 2026-09-21。顶部摘要为 **200**，日历仍显示 2025 年和 2026 年、合计 **300**；趋势标题“区间累计末值”为 **300**，曲线最后一点为 **200**。已用真实 `ReviewDashboard` 的 jsdom 点击流程和模型双重复现。
- 最小修复：外部快捷期间/主动应用期间时保留 `view`，但将历史浏览层级恢复为适合该期间的层级；区分日历自身下钻和外部范围变化。确保趋势 rows、摘要和 endMoney 始终使用同一生效范围。
- 覆盖缺口：[review-dashboard.test.tsx:499](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/dashboard/review-dashboard.test.tsx:499) 已走跨年流程，却只断言标题、期间文案及详情消失；没有断言历史年份退出、样本数或三个金额一致。

### R2 · P2：数据管理的重试按钮未接住新异步回调的拒绝

- 位置：[trade-review-workspace.tsx:3498](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/trade-review-workspace.tsx:3498)；调用端 [quality-details.tsx:108](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/data-management/quality-details.tsx:108)、135 行；workspace 4420 行仍将同一回调传入。
- 触发：从数据管理质量明细重试持仓或历史行情，返回 `source-unavailable`、存储失败或未完成 job。新 `retryDataQuality` 会 reject，而按钮直接调用，未 await/catch，也无进行中或失败反馈。
- 实际复现：将当前 workspace 中的真实函数声明抽出、注入失败 job，再交给真实 `QualityDetails` 点击，捕获到 `unhandledRejection: test source down`；页面未出现失败反馈，按钮未禁用。首页 `HoldingRow` 的 catch 不覆盖这个调用端。
- 最小修复：同步更新此回调的所有实际消费者，接住 Promise 并显示进行中/失败状态，避免重复点击。不要把 workspace 的失败重新吞掉来迁就旧接口。
- 覆盖缺口：`QualityDetails` 测试只使用同步 `vi.fn()` 并验证参数；新 `RoomHoldingsPanel` 的 reject 测试无法覆盖数据管理入口。

### R3 · P2：未获得刷新锁时，旧终态 job 会把“未执行”判成“完成”

- 位置：[trade-review-workspace.tsx:3484](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/trade-review-workspace.tsx:3484)，3488–3499 行只检查当前 job 是否终态；锁行为见 [refresh-lock.ts:39](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/lib/market/refresh-lock.ts:39)。
- 触发：已有一次成功 job，但报价已过期；同源另一页面持有刷新锁，此时从首页点击重试。锁函数返回 `undefined`，不发请求、不更新 job；调用方随后读取旧成功 job，正常 resolve。
- 实际复现：模拟 `navigator.locks.request` 返回空锁，保留旧 `complete` job；得到 `operationCalls=0`、`noticeCalls=1`、`retry outcome=resolved`。首页因报价仍旧会显示“行情重试完成，仍不可用”，与实际未开始矛盾。
- 最小修复：让刷新入口返回本次是否启动及运行结果/标识；重试只接受本次请求或明确加入的同一运行的终态。未获得锁应返回未开始结果，不根据旧 job 判完成。
- 覆盖缺口：本轮面板测试把 Promise 的 resolve/reject 直接作为输入，没有测试真实 workspace 的锁拒绝与旧 job 组合。

### R4 · P2：持仓日线重试成功，仍会被无关小时线失败判成失败

- 位置：[trade-review-workspace.tsx:322](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/trade-review-workspace.tsx:322)、3495 行。
- 触发：重试后 `1D=complete`，已取得当前日收盘价并恢复浮盈亏；但 `1h=needs-provider/source-unavailable`。`isFailedMarketDataJob` 扫描所有 interval，因此 `holdings` 也 reject；面板显示“行情重试失败”，即使当前行已可用。
- 实际复现：当前 retry 函数注入终态 job `{status:'latest-available', intervals:[{interval:'1D',status:'complete'},{interval:'1h',status:'needs-provider'}]}`，结果为 rejected。
- 最小修复：按请求维度判定结果。持仓使用日线结果与更新后的估值状态；小时线问题留给历史复盘维度，同时保留实际持仓相关的存储失败处理。
- 覆盖缺口：面板“成功”测试手动 resolve 后 rerender 可用报价，没有覆盖工作区产生 resolve/reject 的规则。主协调者已验证的单标的真实成功路径不能覆盖此混合终态。

### R5 · P2：首页与数据管理对同一条无效报价采用不同优先级

- 状态：协调者已在真实 UI 发现黄金 ETF `pre-trade → source-unavailable`、半导体 `pre-trade → stale`，并交 C 修复。收到该通知后再次读取 quality/holdings，当前仍是下述逻辑；**本项为已交办、待修复后复核，不是新增的第二个问题**。
- 位置：[trading-room-quality.ts:329](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/lib/reviews/trading-room-quality.ts:329)、345 行；首页门槛在 [trading-room-holdings.ts:672](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/lib/reviews/trading-room-holdings.ts:672)。
- 触发：存在正数价格，但币种不符、已过期或早于交易，同时同步状态为 `not-requested`、`source-unavailable` 等。首页仅在缺价时采用源诊断，quality 却对所有 `quoteStatus !== available` 重新采用源原因。
- 实际复现：USD 持仓、HKD 正数报价、日线状态 `not-requested`：首页为“行情币种与结算币种不一致，无法计算浮盈亏”，数据管理却为“尚未开始行情更新”。过期报价也得到同样不一致。两者均直接调用当前真实模型验证。
- 最小修复：quality 复用持仓模型已确定的主诊断/原因与证据优先级；源状态作为次级说明，使用一致的 action 规则。另统一 daily status 缺项时的逐标的 fallback。
- 覆盖缺口：现有转发测试使用 `price:null`，两套逻辑在该情况下刚好一致；需增加“有价但无效 + 源状态”的交叉用例。

### R6 · P2：周趋势横轴把不同周都缩成相同月份

- 位置：[room-performance.tsx:157](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/dashboard/room-performance.tsx:157)、250 行。
- 触发：切换趋势分桶为“周”，一个月内的多个周桶都进入“起止日期同月”的分支，显示相同的 `YYYY-MM`。
- 实际复现：2026-09-01 至 09-19 的周趋势，三个横轴标签均为 `2026-09`，无法从刻度区分哪一周。
- 最小修复：标签格式显式考虑 trendLevel；周使用周起始日或短日期区间，月才使用年月。保留现有几何映射。
- 覆盖缺口：周分桶测试未断言轴标签；缩短标签测试只覆盖日分桶。

## 较小但明确的验收差异

| 编号 / 严重度 | 当前位置、触发及实际结果 | 最小修复与补测 |
| --- | --- | --- |
| R7 / P3 | [room-performance.tsx:253](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/dashboard/room-performance.tsx:253)：仅 USD 且无 FX 时，单序列仍硬编码 `key: CNY`；点的 aria-label/title 标 CNY，而金额和纵轴为 USD。已渲染复现。 | 只有 converted 聚合才用 CNY，否则用唯一原币；测试单 USD 无快照的点标签。 |
| R8 / P3 | [room-holdings.tsx:47](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/dashboard/room-holdings.tsx:47)、192 行：数量格式化仍默认 8 位；输入 `1.23456789`，页面原样显示八位。本项是 issue03 明确要求但本次尚未补齐的原有缺口。 | 展示传两位精度，模型原始值不变；使用非整数数量测试。 |
| R9 / P3 | [review-dashboard.tsx:268](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/components/dashboard/review-dashboard.tsx:268)：纯 CNY 且无 FX snapshot，卡片仍显示“已按汇率快照换算”，展开详情却显示“原币为人民币，无需汇率换算”。跨年 UI 夹具同时复现。 | 优先判断 `conversion === same-currency`，仅真实换算显示快照文案；补无快照纯 CNY 测试。 |

## 已复核修复与审查边界

- 已读取根 AGENTS.md、development-workflow、issue-tracker、本轮 README 与完整 7 个 issues、原 acceptance-review。遵照用户明确覆盖的流程，不启动子代理，不扩大到无关重构。`code-review` 技能仅用于规范与需求两个角度；上述发现均为具体行为/需求差异，不报告猜测性的代码气味。
- C 的 `open-short + positionEffectEvidence.kind=inferred` 已在当前 [trading-room-holdings.ts:488](/Users/zhoulin/.codex/worktrees/ccc5/TradeReview/app/lib/reviews/trading-room-holdings.ts:488) 排除，测试 343 行起已同时设置这两个字段。本报告不重复将此列为未解决项。
- A 当前已采用 callback ref 绑定 ResizeObserver，并在元素移除/替换时 disconnect；“初始空→有”测试已加入。本报告不重复列旧 observer 问题，也不因 `preserveAspectRatio=none` 单独认定仍变形：当前 viewBox 宽度随实测尺寸变化。
- 对 R1/R5 调用真实模型，对 R1/R6–R9 渲染真实 React 组件并操作 jsdom；R2–R4 从当前 workspace 的 AST 读取真实函数声明，在内存中注入有限状态依赖。其中 R2 同时操作真实 QualityDetails 按钮并捕获未处理 rejection。没有创建临时源文件或测试文件，三次 Node 诊断命令退出码均为 0；这不是全量测试通过声明。
- 没有重新运行全套 Vitest、typecheck 或 build，未干扰协调者集中验证。未独立声称真实浏览器四尺寸已通过；320px 内格子溢出、坐标误差 ≤2px、触屏命中和原生键盘体验由协调者浏览器验收补充。
- 未直接访问真实/隔离交易数据库、发出行情请求或修改原始交易。四个实际负仓的逐笔原始数据审计由协调者负责，本审查核对了对应代码和测试，未冒充重新完成数据审计。
- 未评估赔率、夏普、新行情源、汇率算法变更、导入/replay 的全面正确性及其他上一轮布局/导航修改；这些不属于本轮独立审查范围。
- 唯一写入文件为本报告；未修改应用文件，未 commit/push/merge，未启动服务或子代理。
