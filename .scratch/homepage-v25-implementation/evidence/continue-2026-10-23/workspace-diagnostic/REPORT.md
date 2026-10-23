# Workspace 11 项失败：只读消费者诊断

本报告保留 root 原结果：**99 项，88 PASS / 11 FAIL**。没有运行测试、应用代码、浏览器、服务、数据库、性能测量或 profile；没有修改产品、测试、fixture、共享 tracker。本次只有本目录新增证据。P1 仍 **2/3 FAIL**，P2/P3 仍 **0/3**，本报告不是第 3 候选或任何正式接受。

输入日志为 `evidence/continue-2026-10-23/root-workspace-current-0522.log`，启动 05:19:30，耗时 114.78s。日志没有运行时源 hash；以下是日志堆栈与诊断时当前源码的静态对应，不能补称运行时精确版本已证实。`static-inputs.json` 绑定日志和全部分析输入的 SHA-256、字节数、11 个原始错误与堆栈；`inspect-inputs.py` 仅标准库读取文字，不加载应用。

## 分类与首偏差

|编号|原失败位置（同名 Workspace test）|分类|首偏差 / 已知边界|
|---|---|---|---|
|1|805:33，bootstrap 预期 3 / 实际 4|固定总调用次数未覆盖 metadata 后台 owner|空目标集合、准确身份、fresh 返回数据、查询、scroll、focus 的前置断言已执行；最后总次数断言失败|
|2|1901:47，market read 预期 4 / 实际 6|新增 cold owner 改变基线；metadata 回归尚未被检验|1904 的 metadata deferred 尚未 resolve，不能把多 2 次归因于 metadata 更新|
|3|2025:34，找不到交易库 region|真实 cold owned-read 等待链回归|所有标的 daily Promise 汇合后才初始化普通库，测试的 daily 在进入复盘后才 resolve|
|4|helper 1172:34 / 调用 2298:11|真实跨标的阻塞，与 #3 同根|无关 ZZZ daily 未完成，挡住已可用 XPEV 的显式复盘入口|
|5|2373:47，market read 预期 3 / 实际 4|新增 cold owner 改变基线；持久化状态显示尚未被检验|复盘已打开；源不可用详情断言在失败点之后|
|6|helper 1172:34 / 调用 3668:11|过宽 fetch 502 fixture 污染 FX；暴露 global 库与 FX 的耦合|先于“刷新所有回合”动作，cold FX 非 OK 已使 owned bundle 失败|
|7|3820:18，找不到交易库 region|同 #6|先于导入 / 取消动作|
|8|3852:34，找不到交易库 region|同 #6|先于确认导入 / merge / 返回动作|
|9|3903:29，同步找不到“按标的浏览” tab|页面就绪等待竞态，静态高可信，修正效果未运行证实|点击导航后立即同步查询，未等待 owned 初始化与 ordinary key 提交|
|10|5405:36，找不到“我的交易室” region|旧生产首页消费者 / 控件假设；新筛选尚未实现|生产分支已是 HomeSurface，旧 ReviewDashboard 只在 showDemo 分支|
|11|5554:18，找不到“1 个未平仓回合”|旧生产首页 / 直接持仓复盘路径假设，且 fixture nature 未显式实盘|当前批准路径是详情→普通标的集合→用户选回合；期间/附件/日历仍有未实现门|

**不是“没有显式进入目标路由”的统一问题。** #2–#9 均在 render 前显式写入 `/trades`；#1 从首页详情实际导航到准确普通集合；#10/#11 正在生产首页。helper 1166–1199 本身不导航，但它的这些失败调用方已经设置路由。实际 `app/trades/page.tsx:5` 另传 `initialPage="trades"`；测试多数只设置地址而未传此 prop，这能影响初始呈现时序，却不能解除 #3/#4 的 bundle 依赖。不能通过给所有测试加一次 nav click 或延长 timeout 来解释这些失败。

## 源码路径索引

下文 W/T/H 分别指当前绝对路径：

- W：`/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.tsx`
- T：`/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace.test.tsx`
- H：`/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/homepage-v25/use-homepage-host.ts`

其余行号均以 `static-inputs.json` 记录的相对路径从仓库根解析。关键消费者链：

1. W:2602 初始 bootstrap；legacy 数据确实存在时 W:2603–2610 才迁移并二读。T:640–657 每项重置 URL/storage，默认除 aliases 外 fetch 返回 `nextFrame`；legacy adapter 的 `getBootstrap` 由 browser fixture 导出，不提供专用 metadata endpoint。
2. W:2202 设置 `readOnInitialize:true`，H:156–170 cold 地址初始化启动 owned navigation read；这也包括无 query 的 global `/trades`。
3. W:2184 并行读取 bootstrap 与 `/api/trading-room/fx`，W:2185 FX 非 OK 直接 throw；W:2191 对 bootstrap 全部 summaries 做 daily-only `Promise.all`，没有传 scheduler / signal，也没有按目标标的裁剪。
4. H:122 只在 owned success 后设置 initialized；H:124–131 在 cold error 路径设置 trades error 再 initialized。pending 另有 15 秒 deadline（H:188–205），而这些 region 查询约 1 秒便失败；deadline 也只导向错误，不提供交易集合。
5. W:2226 在 !initialized 时不提交 ordinary key；W:6059 key 未等于 route key 时显示“正在读取目标交易集合…”，error 时显示 alert，均不挂载 TradeLibrary。
6. 原 legacy inventory 链 W:2943–3066 每个 summary 独立读取，W:3028 合并自己的 state，W:3032–3033 独立 restore / 标记 hydrated。selected replay 链 W:3068–3099 只为当前 review instrument 读取 intraday。新增的第 3–5 步使这条原本逐标的可用的链失去入口。
7. W:2205–2211 在接受 owned bundle 时更新 executions / instruments / reviews / reviewStates / marketStates / jobs；H:92、109–112 有 generation 与同代 catalog / acceptance 检查。11 个错误没有证明这些检查被绕过，也没有证明 late bundle 覆盖了正在编辑的 replay state。

## 逐项诊断

### 1 — owned metadata-only directory / empty ordinary collection / source return

原测试：T:767–806，`searches the owned metadata-only directory and returns from its exact empty ordinary collection to the search source`。原错误：`expected "vi.fn()" to be called 3 times, but got 4 times`，T:805。

测试明确从有 market/account/date 的 `/home` 开始，metadata-only `US:META` 带 NASDAQ、stock 证据（T:769–778）。到 T:805 前已经完成详情唯一动作、`NASDAQ:META:stock` URL、目标空集合不混入边界证券、overlay 关闭、返回时新名称 `Meta refreshed`、焦点、META 查询和 scrollTop=143 等断言（T:790–804）。因此本错误不支持“搜错身份”或“返回旧业务数据”的结论；也不把这些静态前置断言扩大成浏览器完整接受。

额外 bootstrap 有实际后台路径：英文 US metadata-only 行没有 localized name，`localized-metadata-hydration.ts:35–49` 会入队；W:2805–2823 运行 queue，其 reload 在 W:2819 调 `getBootstrap`。queue 在 `localized-metadata-hydration.ts:167–191` 用 forceRefresh 请求，随后即使结果 unresolved 仍 reload。默认 fetch 给 resolve endpoint 的是 `nextFrame`，`resolve-service.ts:269–273` 的 metadata 验证失败会记录 unresolved 而返回，不会把整个 batch 抛出；然后 queue reload 仍发生。初始 bootstrap + cold owned bootstrap + queue reload + source return bootstrap 与实际 4 次相符。**原日志没有调用级 trace，不能把这个静态分解冒充四个运行时调用的独立采样。** 这里 forceRefresh 路径不会先调用 getMany；不要把这一次误记为 repository 缓存读取。

最小建议：保留完整身份 / 空集合 / fresh source return 所有断言；把“来源返回恰好一次 owned read”与 metadata 后台读取分开观察，按 owner 或阶段记录增量，或在此单一旅程中显式隔离 metadata hydration fixture，另保留真实后台共存反例。不能仅把 3 改成 4，更不能因此删除 fresh return 断言。未证实：运行时四次调用的具体归属、真实浏览器来源持久化。

### 2 — metadata hydration must not reread every market cache

原测试 T:1826–1908；原错误 T:1901：预期 4 次，实际 6 次。T:1888 已设置 `/trades`，T:1896 已通过 helper 打开 XPEV review，1897 找到检查/修复数据按钮。

首偏差是 **metadata 完成前的总 market 基线**。metadata resolve Promise 到 T:1904 才释放，1901 先失败，故这次日志无法证明 metadata 导致 reread。当前两种 cold owner 都存在：legacy inventory 对 2 个标的读 daily（W:2985）；owned bundle 对同 2 个标的再读 daily（W:2191）。选中空缓存 review 再读 hourly，空后 fallback 15m（W:670–672）。`sqlite-repositories.ts:112–125` 每个 combined daily 调一次 getMarketData，`:69–89` 每个 intraday interval 调一次；因此 **2 + 2 + 1 + 1 = 6** 与日志相符。owned 分支没有传 scheduler，不能由 legacy scheduler 自动去重。这是当前双 owner 冗余读取的真实源码事实，但不是已经证实的“metadata 更新重读”回归。

fixture 还有因果标记缺陷：T:1853–1867 用 `bootstrapReads > 1` 就给 XPEV 刷新名；cold owned read 本身已经使该条件成立。T:1905 的同一计数条件即使走到也不足以证明 metadata queue 已完成。T:1902 的 sync range 次数、1906 的无额外 reviewState write、1907 的无额外 market read 均未执行到。

最小建议：记录 cold/replay 稳定后按 instrument/interval/range 的调用基线，再 resolve metadata，等待真实该批 metadata 完成 / 可见名字改变，然后断言 market read 和 reviewState write 的 **零增量**。保留“无无关标的重读”的语义和源内容断言；单独让 root 裁定 cold 双 owner，不统一把 4 改 6。未证实：metadata 完成后的零增量、saved state 没有改写。

### 3 — saved intraday replay state pending until lazy data settles

原测试 T:1965–2073；原错误 T:2025 找不到交易库。T:2012 已设置 `/trades`；saved Recall 与 bootstrap reviewState 都设 15m / 指定 Jan 7 cursor。T:2003–2008 故意使 daily / intraday deferred，daily 到 T:2032（进入 review 之后）才 resolve。

**真实首偏差是新增等待依赖，不是一次已定位的坏 state write。** W:2191 等 daily → H:122 initialized 未提交 → W:2226 ordinary key 未提交 → W:6059 TradeLibrary 不挂载 → T:2025 无法选择回合。此时原本用于保护 pending cursor 的 W:2827–2848 / lazy intraday 后续消费者根本尚未到达；不能把“图表未出现”视为 cursor 安全通过。

最小建议：root 需要在普通交易集合的 bootstrap/catalog 归属与可选行情完成之间划清 readiness 边界，让合法 ordinary 集合和显式回合入口不依赖全量行情 settled，同时维持 scoped source 的同代原子性、错误恢复与 URL 校验。不能恢复已被否定的外部 latest seed 旁路。保留 unresolved daily 的 RED；不能提前 resolve、去掉保存游标断言或延长等待掩盖。未证实：晚到 intraday、旧请求丢弃、离开/重进后的原 timeframe/cursor；T:2030–2072 均没有得到此次运行证据。

### 4 — selected replay must not wait on another stock

原测试 T:2239–2310；原错误 helper T:1172，调用 T:2298。T:2290 已设置 `/trades`。XPEV 缓存读取立即完成，只有 ZZZ 返回 blocked Promise（T:2282）；它到 T:2308 才 resolve。

W:2191 的全 summaries Promise.all 把 ZZZ 加到 XPEV review 入口之前，与 #3 同一实际回归。原 inventory 在 W:3028–3033 按标的发布，可在 ZZZ pending 时让 XPEV hydrated；不是 selected replay 自己等待 ZZZ intraday。首偏差发生于 cold bundle 汇合，后续 500ms 内 selected heading 断言（T:2301）未执行。

最小建议同 #3，保留无关 blocked Promise 直到 selected review 可用之后，另检查其他标的晚到不会覆盖选择 / 游标。不能先 resolve ZZZ、改成只含一个标的或删掉时序断言。未证实：实际 replay 可见性 / saved state；该测试未到图表。

### 5 — persisted hourly provider failure with no cache

原测试 T:2310–2381；T:2363 已设置 `/trades`，T:2371 helper 已成功打开 review；T:2373 预期 3 / 实际 4。与 #2 一样，W:2985 legacy daily + W:2191 owned daily + W:670 hourly + W:672 empty hourly 后的 15m，可静态解释 **1 + 1 + 1 + 1 = 4**。这没有单独证明 provider failure 记录丢失。

最小建议：保留 instrument/interval 调用边界，按 owner/阶段测试读取增量，并继续执行 persisted `source-unavailable` 的实际详情文案断言；不能只改 3→4 就称完成。T:2378–2380 打开详情和“行情源暂不可用”尚未执行，状态可见性仍 NOT VERIFIED。

### 6 — refresh every episode regardless of selection

原测试 T:3617–3739；原错误 helper T:1172 / 调用 T:3668。T:3666 已设置 `/trades`，不是缺失路由。T:3650–3659 的 fetch 仅给 aliases、instrument resolve 成功；其他 URL 全返回 502 source-unavailable。新增 `/api/trading-room/fx` 也落入 502，W:2185 在任何 daily 汇合前 throw → H:124–131 设置 cold trades error → W:6059 alert 分支，交易库不存在。

这里有两件独立事实：**fixture 把“行情刷新失败”过宽模拟成所有其他 HTTP 失败**；**当前 bare global cold library 确实也受首页 FX 失败阻挡**。前者使原目标测试提前失败；后者是否符合普通库可用性要求须由 root 裁定，不能通过移除 owned error guard 自动解决。原日志 DOM 被裁短在导航附近，没有完整 alert 正文；上述 error 文案归因来自明确源码和 URL 匹配，不声称日志截图片段已显示该 alert。

最小建议：让故障限定到实际行情 refresh endpoint，并提供符合合同的 FX 响应；另保留一个独立的 cold FX failure / 恢复反例来验证 owned atomicity 与 global 库可用性决策。后续计划保存、所有历史回合区间刷新、选中回合保持均未执行，不能按“fixture 过时”标成 PASS。

### 7 — cancelled import after failed market refresh

原测试 T:3805–3835；T:3818 已设置 `/trades`，T:3812–3815 同样只排除 aliases / resolve 后统一 502；原错误 T:3820 在任何 import 操作前找不到交易库。同 #6 的 W:2184–2185 → H:130 → W:6059。

最小建议仅缩窄故障 endpoint 并分离真实 FX fail 合同；保留取消导入不 merge、原 chart / library 仍可用断言。取消动作、mergeExecutions 空调用与 chart 可见性未执行，NOT VERIFIED。

### 8 — confirmed import with failed market refresh

原测试 T:3837–3881；T:3850 已设置 `/trades`，T:3845–3847 的统一 502 同样先污染 FX；T:3852 在确认导入前失败。首偏差同 #6/#7，不是已证明 import merge 或来源 query 被写坏。

最小建议同 #6，保留真实确认导入、3 个 execution 的 merge、review 保存 / 返回 query XPEV 的后置断言。它们都未执行，本次不具有 import 持久化接受证据。

### 9 — explicit library entry in shared history workbench

原测试 T:3883–3920；T:3894 设置 `/trades`，T:3897–3902 找到 nav 并 await click；T:3903 随即用同步 `getByRole("tab", {name:"按标的浏览"})`。等待导航点击完成不代表异步 owned bundle 和 W:2226 ordinary key 已提交。W:1337–1338 的 view 设置、H:215–230 的 async navigation guard、W:6059 的 cold ready gate 可在 tab 查询时仍让库未挂载；fixture 没有 #3/#4 的 intentional pending Promise，也没有 #6 的 blanket error。

最小建议：在完整库 region ready 后于该 region 查 tab，再执行股票展开和用户显式选择子回合；保留共享 history workbench、账户、返回 context 的后置断言。不要把标题中的旧 “queue” 词解释成允许新首页自动 pending queue 或自动首 episode。分类为 readiness race 的静态高可信推断；未重跑，不能承诺一个 await 已使全测试通过，后续断言仍 NOT VERIFIED。

### 10 — stored ETF metadata into room scope

原测试 T:5355–5412；T:5403 render `showDemo=false`，T:5405 找旧 region 失败。W:5929 的 ReviewDashboard 仅 showDemo 分支，生产在 W:5980 挂 HomeSurface。旧 `dashboard/review-dashboard.tsx:1139` 才有“我的交易室” region，`:1160–1164` 才有更多筛选 / ETF radio；当前 `home-surface.tsx:244–258` 是“首页”与尚未接入的 disabled 附加筛选。这不是单纯改 accessible label 就能到达原测试的 ETF 消费链。

metadata fixture T:5375–5388 提供 statement / etf，但无 exchange；availabilityExecution T:307–324 也无 explicit tradeNature。新的完整身份目录在 `catalog-model.ts:39–55` 校验证据，缺 exchange 会 identity=null，不可假造 NASDAQ；首页持仓 `holdings-model.ts:41–45` 只含明确 live。缺失类别筛选功能本身仍是 P3 required 未交付，不能以“旧测试”豁免。

最小建议：把 metadata 应用意图映射到实际新 catalog / search / detail 消费者，在可信完整身份 fixture 与缺 exchange 负例分别保留类别证据；旧 ReviewDashboard scope 的独立 seam 测试可继续保留旧组件约束。待 P3 附件授权后，还必须验证真实 ETF filter 的数据作用；不能只重命名 region，或只补造交易所使其变绿。T:5406–5411 的 metadata→ETF→1 回合断言未执行，metadata 传递正确性在此测试仍 NOT VERIFIED。

### 11 — holding review return restores filters / period / calendar

原测试 T:5536–5591；T:5554 首次查旧“1 个未平仓回合”即失败。旧 scope、自然月 tab、currency 筛选、年日历、直接“打开持仓回合复盘”（T:5555–5571）都属于旧 ReviewDashboard 的生产路径；当前 W:5929/5980 不再渲染它，HomeSurface:264–265 明示期间表现尚未接入，:258 的附件筛选尚未接入。fixture 继承 T:307–324 无 explicit live 的 futu fill，也不应被默认推成新实盘首页持仓。

批准的现行路径是 `home-surface.tsx:194–218` 记录 detail 来源后 `onTrades` / `onSymbolTrades` → W:5985 `homepage.openTrades(full identity)` → `session-model.ts:23–36` 精确 ordinary collection 且 selectedInstrumentId / selectedEpisodeId=null → W:6085 由用户选子回合才进入 review。原规格 HP06:436–448 与 HP04:312–316 明确普通交易集合、完整身份、来源恢复，不许可为旧测试重装直接首回合 shortcut。

最小建议：用有来源证据的 explicit live fixture，按批准路径走持仓详情→同一准确 ordinary 集合→手动选择回合→guarded 返回重读，保留局部 query / sort / page / scroll / focus 的实际 UI 来源恢复断言。原 period / applied filter / calendar 年层级的恢复要求仍须在实际消费者可用后完成，当前不能删掉、跳过或改成“尚未接入”文案就记 PASS。T:5574–5590 所有返回断言尚未执行；当前测试不证明一次坏 UI-state write，也不证明恢复安全。

## 设计与回放约束的核对

适用映射为 DESIGN-COVERAGE 的 HV25-09/10（search / unique identity）、HV25-23/24/27/29（持仓与未知 / 比较边界）、HV25-31（holding return）、HV25-53/55（ordinary URL / 必要交易库数据流）。本次核对原规格 HP03:113–190、HP04:295–316、HP06:436–448；原 SVG `holding-return.svg`（1100×780）和 `search-detail.svg`（1100×760）的文字/结构来源分别明确持仓来源状态恢复和唯一“查看交易”/完整身份。这里只读取源文本，没有渲染截图，不提供视觉 fidelity 或像素结论。

`issues/04-holdings-journey.md` / `06-search-filter.md` 要求来源 UI-only、返回 fresh bootstrap、准确普通集合、无自动 queue/episode；不能通过恢复旧快捷路径关闭 #10/#11。`docs/agents/development-workflow.md:24–34` 要求独立 market/execution cutoff、懒加载不推进 / 回退保存游标、阶段和未来信息边界保持；因此 #3/#4 的阻塞反例应原样保留，不能为“进入图表”而丢 saved state 或提前 settle。

触发范围为 Workspace/host/state 消费者回归的只读诊断。版本绑定检查表就是上面的 11 项；排除真实鼠标/键盘/触控、layout/空间/视觉、HTTP 控制注入、持久化写入/reload，以及所有正式验收。没有新增 UI/DB 接受结论，也没有把其他 88 项日志 PASS 扩大为当前全部旅程 PASS。

## 交 root 的最小裁定项与未证实边界

1. **先裁定真实入口阻塞**：#3/#4 共因 cold owned bundle 等全标的行情再开放普通库；确立 bootstrap/catalog 集合与可选 market/FX 的读取所有权及 readiness 边界，仍必须防止旧 seed、旧 generation 或错误 source 旁路。
2. **分别修正测试因果，不批量改计数**：#1 的后台 metadata reload；#2/#5 的 cold 双 owner 基线与 metadata 完成后 delta；#6–#8 的 provider fault endpoint；#9 的 region ready。每项保留原业务/状态后置断言以及当前 FAIL。
3. **把旧 UI 测试迁到真实旅程，不能当已交付**：#10/#11 要对应完整身份、明确 live 和批准的 ordinary detail→collection 路径；附件/期间/日历未实现要求继续 FAIL/NOT VERIFIED，由 root 独立 UI / persistence 接受。
4. **late owned completion 的 state safety 尚未证实**：W:2210–2211 是整个 reviewStates / marketStates 替换，H:92 的 generation guard 只证明该 owned 请求仍当前。11 项日志没有提供“旧 bootstrap 开始→用户打开/编辑 review→读取完成”的事件 trace，故既不能宣称覆盖发生，也不能宣称已排除。若 root 后续授权，应以受控 pending owned read、真实选中回合/保存状态、晚到旧 payload 的一个因果反例核对首写、双 cutoff、phase、selected ID 和 pending restore，不能用总次数替代。
5. **metadata presentation 的真实传播仍待证实**：W:2819–2820 的 queue reload 更新 storedInstruments；H:176–178 的 options.data effect 只在初始化阶段播种，之后 owned bundle 才是业务权威。#2 在 metadata resolve 前失败、#10 在旧 region 前失败，二者均不足以证明当前 committed catalog 名称/类别更新或 scope 不重读。需后续真实消费者的有限 counterexample，不在本次执行。

本次到此冻结；不实现修复，不请求或重置正式轮次，不动 performance，不重跑任何性能/测试。后续修改及接受由 root 决定。
