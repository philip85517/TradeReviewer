# 前端实施报告

状态：生产代码已冻结，协调者已执行独立生产构建和真实桌面首开/热开测量，完整功能及视觉接受仍由协调者裁定；本报告不代表首页完整或一秒验收通过。实施 owner `/root/homepage_read_diagnosis`，模型 `gpt-6.1-sol` / `ultra`。未派子代理、未推送、未写原业务库。整页视觉与完整数据流接受者为 `/root`。

## 接线和边界

- `trade-review-workspace.tsx:1262/1345`：默认生产首页启用 wire；homeReady 与完整 workspace hydrated 分离。首页不启动 bootstrap、全证券行情、FX 外部读取、现金/本金读取。进入交易库、分析、数据、导入或显式缺行情修复后才载入完整工作区；不能用 wire 把 hydrated 伪设为 true。
- `workspace:3030`：轻目录与 alias 独立结算。migration=false 必先安全检查 browser legacy；空检查允许 wire，不写迁移标记；存在 legacy 才调用原迁移/完整启动，成功后重读轻目录。exporter 异常保留错误和重试。alias 单独失败时保留有效目录，在原首页恢复入口重试。
- `workspace:2365/2418/2433`：首页只读 materialized view，catalogFor、fromGlobal、实际 HomeSurface 都消费 wire 的 accounts/catalog/view/holdings。客户端不构造 prepared handle。普通交易库继续走原 atomic source。
- `workspace:2419`、`use-homepage-host.ts:174`：恢复账户 fallback 若与首包不符，用原 token/实际接受选择补读一次；异步后重验 generation、pending、deadline、route origin、destination，匹配后才调用 onReadAccepted。旧包不能覆盖导航或草稿。
- `workspace:2449`：独立期间请求带原 accepted selection 和真实 period target；远程读取 display view，持仓保持当前时点，不随期间切换。失败保留已提交期间与金额。
- `workspace:2587`：只按服务端 validUntil 设置可见首页刷新；隐藏页恢复由既有 focus/visibility 链路重读；没有 60 秒轮询。client 仅对明确的 409 `HOMEPAGE_INPUT_VERSION_CHANGED` 或到达时已过期重读，二者共用最多两次请求预算。
- `workspace:2387`：原月结链路使用 prepared.executions 构造条目，避免将投影前 raw bootstrap carriers 交给 prepared.complete；不改月结证据和财务算法。现有 Stage B 反例验证同一载体、Recall 摘要、完整表示证明和 handle 关闭。

## display 公共合同

`homepage-display-contract.ts` 定义只供展示使用的 HomepagePeriodDisplayView，并导出纯投影 `toHomepagePeriodDisplayView`，供 backend 在完整 view 已构造 holdings 后调用。完整 view 与 display 消费者结构兼容。没有以空数组伪造领域对象。

保留 stamp/range/bounds/reasons；当前市值、浮盈、覆盖原因和修复 instrumentId；series source/request/revisions/boundary/summaryState；每点日期、状态、六项 tooltip metric、覆盖原因、报价 source/date、FX source/publication；期间汇总的净盈亏/已实现/浮盈变动。金额与金融状态直接保留，不重新计算。删除内部成交/费用账本、missingSessions 大枚举、逐证券完整财务投影及未被页面消费的诊断。HomeSurface、PeriodSurface、MetricCards、PerformanceChart 仅改类型，无 JSX、样式、尺寸或布局修改。

|范围|已接入显示及交互|剩余必需验收|
|---|---|---|
|H01–H06|wire 市场/账户/证券目录；附加筛选草稿与应用；URL/session/alias 恢复|真实桌面逐控件操作与匹配状态视觉对照|
|H07–H11|远程期间、四卡金额/覆盖详情、曲线点和缺口/报价/FX 说明、精确值与修复依据|真实库全期间缺证据仍 unavailable；不能算完整财务首屏|
|H12–H18|全部持仓小行；原客户端搜索/排序/八行分页、详情、CSV、持仓/目录转交易库|桌面长名称、金额、20行分页/导出与返回独立验收|
|H19–H28|保留原 `not-wired`，页面明确“历史统计与贡献将在后续阶段接入”|历史已平仓、历史图表、贡献未接入，明确 FAIL/NOT VERIFIED，不算通过|
|H29–H32|进入交易库才完整加载；返回首页重新 wire；失败重试；旧 token 和导航拒绝|真实桌面及草稿/返回/刷新状态链独立验收|

## 测试与失败记录

- display DTO 首次缺模块为 RED；实现后测试精简输出与完整输入的 PeriodSurface 文本、按钮禁用状态、口径详情一致，内部诊断被移除但原金额/未知状态/修复 ID 保留。
- 轻 alias 失败用例修前落到通用 SQLite 门页（RED）；修后在首页一键修复，再接收真实 wire（GREEN）。
- 409 用例修前两条失败；修后明确 code 才重试、其他 409 原样报错、过期与冲突共享两次预算。
- Stage B 原反例修前 `Original carrier assembly mismatch`，修后通过。后端现在直接调用 projectMonthlyHistoryEvidence，所以运行次数 spy 追踪该现有 authority，不再追踪旧 apply wrapper。
- 最新定向命令：`./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/components/homepage-v25/homepage-display-contract.test.tsx app/components/homepage-v25/metric-cards.test.tsx app/components/homepage-v25/performance-chart.test.tsx app/components/homepage-v25/period-surface.test.tsx app/components/homepage-v25/home-surface.test.tsx app/components/homepage-v25/homepage-view-client.test.ts app/components/homepage-v25/use-homepage-host.test.tsx app/components/trade-review-workspace.homepage-view.test.tsx --reporter=dot`，8 文件 **192/192 PASS**，日志 `frontend-targeted.log`。
- 真实 wire workspace integration 10 场景：不全量启动/不读 FX/cash/rawsource；独立期间失败保留；migration=false 无 legacy；exporter 错误重试；alias 错误重试；交易库完整启动及返回 wire；有效期到达；账户删除恢复二次 token；市场切换；修复前完整启动。
- main workspace 143 项使用真实默认 catalog/display HTTP fixture；没有整个 suite 关闭 wire 的 mock。原本明确验证 atomic-source/FX producer 的四个 alias 参数场景显式注入 storageClient + 真实 alias loader，因现有 prop 契约选择该旧路径，其实际 getHomepageSource/FX/token/assertions 保留。FX 启动用例改为证明首页不请求、进入数据后才请求。通知导航用例重取当前 DOM：首次完整启动显示 loading 时会替换首页原导航，旧 DOM 引用不能模拟用户第二次点击。
- main 完整无 bail 结果：**134 PASS / 9 FAIL（143）**，133.81 秒；原始失败保留于 `frontend-workspace-full-134-pass-9-fail.log`。初轮归因（下列最终结果替代“待复现”状态，但保留原始 FAIL）：4 个行情测试各自覆盖 fetch 后将新 homepage-catalog 请求误答为行情或 FX 响应，目录校验拒绝；2 个现金测试按旧启动的两次隐藏摘要请求排 ordinal 503，现 hydrated gate 延后后只发最终范围请求，故障未落在保存后；3 个截图/补充测试仍需用未修改 workspace 独立复现，不能先归为过时夹具。不得用 192 个定向通过代替此结果。
- 最近已完成 `./scripts/native-node.sh node_modules/typescript/bin/tsc --noEmit`：exit 0；最终统一类型检查与 production build 由协调者执行。

## 接受限制

功能/状态/视觉是独立门槛。本子任务没有真实浏览器或独立截图接受证据，1440×1000 与 1280×800 由协调者执行。当前真实库来源/行情/汇率/起始证据缺失仍按原规则显示未知；没有补零、猜 nature、制造历史或隐藏缺口。历史区域没有接线，因此不能把快缓存或控件可用认定为“完整首页≤1秒”。本报告仅为 implementation-ready，不是 feature accepted。

### Final fixture attribution after production freeze

- Three unchanged tests independently fail at the same assertion under a complete `git archive HEAD` of 8c8c66c715be46e1e8a53d61d02b82f4fa13b22c. Only installed node_modules are shared. See `frontend-head-baseline-three.log` and `frontend-baseline-repro.json`. Original assertions remain unchanged.
- Four market-data fetch mocks now delegate only homepage-catalog/view requests to the default HTTP fixture, retaining their market/FX failures and all business assertions. Two cash tests target the summary failure after PUT rather than counting startup reads.
- Added a visible homepage import-button journey: no bootstrap on home; clicking waits for deferred full bootstrap behind the SQLite loading gate, with no import input or data-management region; after bootstrap resolves those controls become available. This is state-wiring evidence, not a persisted import acceptance.
- Production freeze SHA comparison: all eight files unchanged. Final main143 + wire11 has ended; see the recorded result below.

### Final result (01:36:48, 131.51s)

Command: `./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/components/trade-review-workspace.test.tsx app/components/trade-review-workspace.homepage-view.test.tsx --reporter=dot`. Exit 1. Main workspace **138 PASS / 5 FAIL (143)**; wire **11/11 PASS**; total **149 PASS / 5 FAIL (154)**. Full log: `frontend-workspace-final-138-pass-5-fail-wire11-pass.log`. No full-repository suite was run.

Remaining FAILs are unchanged assertions: the three screenshot/supplement cases reproduced on HEAD above; `refreshes every trade episode regardless of the selected episode` still waits for mergeExecutions to persist the canonical name (all preceding network/date-range/episode/plan assertions passed); `uses META as the market-data symbol for historical FB trades` passes its META network assertion then waits for zero-called mergeExecutions. Both current workspace and git HEAD already use putInstrumentName for name metadata. These last two have source-level attribution only; no independent runtime HEAD reproduction was run during the coordinator quiet window. They remain FAIL. No expected assertions were weakened to turn these green.

The four original partial fetch mocks now reach their intended market-data journeys. Two cancel/confirm-import-with-failed-market-refresh cases pass; two canonical-name persistence cases expose the older endpoint assertions above. The two cash-save/summary-error cases now pass with their original saved-fact, one-write-only, repeated failure and read-only retry checks. New wire import navigation test passes as described above.

No new heavy command will run during the coordinator cache-invalidation measurement. Final test-only option cleanup removed unsupported, runtime-ignored `exact:true` from the new role query; its string-name query already uses exact name matching. Unified type validation after that test-only addition is pending coordinator scheduling. Production remains byte-identical to the freeze manifest.

### Round 5 after-edit deadline diagnosis (read-only; original issue paused)

Coordinator evidence: isolated PUT name revision 0→1; catalog about 481ms; view HTTP 200 after 16,296ms, cacheHit=false/build16,278ms/20 rows. UI rejected that result, remained without accepted holdings/period view through 45s, saved name was not shown. Coordinator restored the original name at revision 2. Five-round cap reached: original after-edit complete homepage ≤1s issue is PAUSED/FAIL; no further production changes authorized here.

The configured host has a 15,000ms absolute budget measured from the global token startedAt (homepage-v25-state.ts:287–289,362–367), after the light catalog is ready. use-homepage-host.ts:314 schedules only the remaining original deadline; :317 confirms the owner; :320 nulls pending and marks timeout; :323 ends initialization. On the eventual HTTP 200, :142 drops the result because pending no longer owns the generation. Synchronous fallbacks at :145, :179 and :197 also reject a deadline crossed before publication. The HTTP client :58 does not impose a timeout and workspace :2368 does not supply AbortSignal, so server HTTP completion is compatible with client rejection.

The initial domain seed is null view/empty holdings (workspace:2432), and only accepted fromGlobal replaces it (:2433–2436). UI continues to derive that seed (:2506–2507); PeriodSurface:62 renders its fixed “period data reading” placeholder whenever view is null, including after timeout. HomeSurface:325–331 renders empty slots/empty-state text. Timeout preserves sourceRecovery (host:79–81,129); only matching success clears it (:211), so the focus/visibility automatic refresh condition (:514) remains false for this initial navigation timeout. Expiry refresh also needs an accepted wire resultVersion/validUntil (workspace:2587–2591), absent here. Recovery remains explicit through homepage error state/retry; waiting by itself cannot publish the late response.

The two canonical-name cases were now independently executed against the complete unchanged HEAD archive: **2/2 FAIL**, same old mergeExecutions assertions, 13.60s. Log `frontend-head-baseline-name-two.log`; the current and HEAD source already persist names through putInstrumentName. Combined with the earlier three-case baseline, **all five remaining FAILs have independent unchanged-HEAD runtime reproduction**. This proves they pre-exist this change; it does not establish those user journeys are product-correct or authorize weakening their assertions. No production or expected assertion changes were made.

### Independent lint closeout

After the five-round performance halt, coordinator separately authorized one static-quality fix. Only workspace.tsx:3032 gained a reasoned single-line `react-hooks/set-state-in-effect` exemption: the replacement external catalog request synchronously invalidates prior ready state. No executable code, dependency array, timeout, API, or financial behavior changed. Removing that one comment reproduces all eight earlier production freeze hashes exactly. Targeted eslint of workspace.tsx exits 0, with 21 remaining warnings; see `frontend-eslint-close.log`. Original manifest retained as evidence; coordinator creates the final manifest/rebuild/restart/browser verification. No test expectations were updated.
