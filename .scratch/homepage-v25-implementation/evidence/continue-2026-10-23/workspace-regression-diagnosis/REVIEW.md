# 当前 workspace 两项失败：独立只读诊断

冻结：2026-10-22T23:25:07.453387+00:00。实际模型：GPT-6.1 SOL / ultra。HEAD 开始与结束均为 `5a94ee3ff76e32993fe2c4791a83b40e877a7344`。七个接线产品文件及原 workspace 测试与前次冻结 SHA-256 一致，详见 MANIFEST.json。本次只在本目录新增诊断资料，没有修复产品或原测试。

## 结论和证据边界

Root 的完整原始日志 `../ROOT-current-workspace-all.log`：101 项，99 PASS / 2 FAIL。两项失败分别停在原测试 5523、5672 行，均尚未执行 ETF 筛选或详情复盘返回断言。直接失败属于 V2.5 已替换的旧页面入口断言，不能推导 ETF 元数据断线或状态恢复成功/失败。两份 fixture 又都缺少明确实盘性质；返回正向 fixture 还缺美股交易所身份。这些是后续迁移必须补齐的数据前提，不能用放宽生产约束解决。

**没有验证出新的 Critical / Important / Minor 产品回归。静态未发现新缺陷不等于 PASS。** 当前期间、历史和贡献消费者仍是占位，完整 V2.5 状态返回合同仍 FAIL / NOT VERIFIED；这是已知未实现门，不能因旧日历设计过时而删除。P1 正式仍 **2/3 FAIL**，P3 正式仍 **0/3**，本报告不增加任何正式轮次。此前同页限定范围测试不能覆盖这两项完整旧用例。

## 执行失误，原始证据保留

本目录新增纯字面 fixture 测试，原意仅执行它一次。实际唯一命令使用 `mergeConfig(base, override)`；仓库 `vitest.config.ts:17` 的 `include` 数组与新配置的 include 合并，扩大到了原仓库范围。`RAW-fixture-diagnosis.log` 只记录 workspace 101 项完成、2 FAIL，随后收到 Ctrl-C，命令退出 130。进程已终止，之后没有再运行测试。

该重复运行违反了本任务的预期定向范围，已立即向 root 报告。日志、配置和未取得执行结果的字面 fixture 均原样保留；不将其当作新增覆盖或正式轮次，不声称纯 fixture 三项通过，也不以该中断进程证明全仓检查。不得直接重用此配置启动测试。未启动服务或浏览器，未调用业务数据库或网络工具；由于误命令扩大了测试选择，不能声称整个误运行严格只选择纯函数。

## 两项失败的实际停止点

|用例|Root 可观察结果|实际生产分支|分类|
|---|---|---|---|
|`passes stored instrument metadata into the trading room scope`，原测试 5475–5529|日志 366–372：`findByRole(region, 我的交易室)` 在测试 5523 超时。5524–5528 未执行|`trade-review-workspace.tsx:5976` 的 `showDemo ? ReviewDashboard : HomeSurface`，该测试 5521 明确 `showDemo=false`；6025 渲染 HomeSurface；`home-surface.tsx:266–269` 是无 region 名的 section 与“首页”标题|直接原因：旧 selector；潜在前提：来源性质未知；ETF 业务断言未到达|
|`returns to the trading room with its filters, period, and calendar view after opening a holding review`，原测试 5654–5709|日志 730–736：测试 5672 查找旧文案“1 个未平仓回合”超时。5673 之后全部未执行|同上分支；新持仓区 `home-surface.tsx:294–296` 名为“当前持仓（最新）”，计数在 320 行为“共 N 条持仓 · M 个标的”|直接原因：旧文案；潜在前提：来源性质未知、美股交易所缺失；返回业务未到达|

“我的交易室”主导航按钮仍存在（Workspace 5843），但按钮存在并不能证明旧同名 region 仍存在；把导航名称当作 V2.5 内容容器是本次第一失败的具体错配。不得用 `showDemo=true` 恢复旧 Dashboard 使这两个生产测试变绿。

## 原规格与替换映射

原稿为 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`。下表给出实际原规范位置和迁移含义，未把票据摘要当作规范。

|原断言/动作|V2.5 原规范|保持原业务意图的迁移|
|---|---|---|
|旧 Dashboard / 交易室范围 / 更多筛选 / 资产类型 radio|115–124：页头四市场、账户、搜索、附加筛选；163–175：独立筛选浮层，多选草稿、应用成功后生效|等待“首页”heading 和“当前持仓（最新）”region；按钮 `附加筛选` → dialog `附加筛选` → checkbox `ETF` → `应用`；不能只换 selector 后保留“点击即生效”语义|
|旧计数“1 个回合进入范围”或“1 个未平仓回合”|257、283–285：最新持仓的明确标题、数量分页和固定八槽|在最新持仓 region 中断言真实目标行、共 1 条持仓及具体标的；不要把空槽数量当作业务行数量|
|独立币种 USD 下拉|119–122：市场决定报告币种，全部/A股 CNY、港股 HKD、美股 USD|选择 group `市场` 下 `美股` button；断言 pressed、USD 列标题及实际范围。不得重新加入独立币种控件|
|近3个自然月|212–216：本周/本月/本年与自定义日期草稿；期间不改变最新持仓|在期间消费者接线后改为规范支持的快捷/自定义期间，断言实际起止边界及返回保留；不得静默删除期间恢复的业务责任|
|盈亏日历、日历层级“年”|V2.5 期间/历史模块由 193–252、328–372 定义；状态类型 `homepage-v25-state.ts:16–20` 是历史范围与四种指标图，不含旧日历模式|替换为 V2.5 的历史范围、历史图模式恢复。当前页面未接入，不能通过删除日历断言或断言“尚未接入”冒充此义务已完成|
|持仓行直接“打开持仓回合复盘”|314：先“查看持仓详情”，详情唯一主动作“查看交易”；440–448：完整标的身份进入普通交易库集合，不代入固定首行|详情 → 查看交易 → 精确普通集合 → 用户明确选择 episode → 复盘；不能直接自动选首回合|
|回我的交易室后只保留旧币种/日历|456：fresh read + 当前期间、历史范围、市场/账户/附加、持仓查询/排序/页码、贡献双模式、滚动和焦点|按当前状态键验证实际消费者；来源对象消失仅焦点回容器标题，不能清空其他有效条件|

对应参考图：`images/account.svg`、`filter.svg`（原稿筛选章节）、`period.svg`、`holding-return.svg` / `holding-return--detail.svg`、`journeys-library-entry.svg`、`library-return.svg`；本次没有浏览器或视觉比较，不新增视觉结论。

## Fixture 根因及最小修改范围（建议，未实施）

### 两个正向 fixture 的共同缺口

原测试 `availabilityExecution`（307–324）仅设置 `source: {platform: 'futu', row}`（315），无 `tradeNature` / `tradingNature`。`app/lib/trades/types.ts:207–208` 对此返回 `unknown`。生产 `attachment-groups.ts:51–63` 排除非 live 组；`holdings-model.ts:44–49` 要求回合每笔 fill 均明确 live。原稿 13 行只呈现实盘，缺省 broker 为 live 会削弱用户合同。

最小范围是在这两个用例自己的成交对象/局部 fixture 内补 `source: {...source, tradeNature: 'live'}`，而不是修改共享 `availabilityExecution`，避免改变另外 99 项的未知/模拟边界。保留独立负向 fixture：原始未知来源在首页没有可操作持仓，不自动归为实盘。当前这种空结果是源码可直接推出的预期；本次未取得新增纯 fixture 运行证明。

`beforeEach` 的 fetch stub（653–657）除账户别名外一律返回 `nextFrame`。新首页 fresh read 实际调用 FX（Workspace 2191–2197），但 `fx-adapter.ts:4–8` 会将该 replay frame 视为无 FX，**不会仅因这个 body 形状而抛错阻止初始化**。两条当前停止点不是 FX 失败。未来局部测试应按 URL 返回明确的 FX missing/complete schema，replay 端点才返回 frame，不能把错误协议当作有效金额证据。

若新迁移场景增加待复盘单布尔筛选，必须为 `/api/storage/recall/summaries` 提供合法 `{summaries: [...]}` 响应。Workspace 2190–2195 只在 pendingReview 恰好单个布尔时发请求；`summary-client.ts:31–43` 严格拒绝 frame。空选或 true+false 双选不额外读取、`reviewSummariesComplete=false`。已披露 caveat 保留：旧 helper 的默认 pending 状态可在摘要覆盖不全时给出 pending=true；不能把该默认当作 fresh summary 证据。生产 single-bool owner 要求完整 fresh summary，不能为迁移测试放松它。

### 用例一：ETF 元数据

只需局部补明确 live，保留原 bootstrap `instruments[0].metadata` 的 `market:'US'`、相同 symbol、`assetType:'etf'` 及 statement 来源（5496–5506），迁移旧 selector 与 apply 语义。仅验证类别不要求凭空补美股交易所；若增加详情→交易正向导航，再补经过 schema 校验的交易所证据。

最小且仍有效的业务断言序列：

1. 等待 fresh bootstrap 的目标持仓出现；打开“附加筛选”dialog，勾选 ETF checkbox。此时没有已生效 ETF 标签/角标变化，数据仍属旧 C。
2. 点击应用。未完成时旧 C、旧数据保留；成功后出现 ETF 可移除标签与“附加筛选，1 个已生效条件”，目标 `交易室ETF` 行仍在，最新持仓计数为 1。
3. 打开该行详情，类别明确为 ETF；不能只断言名称含 ETF。另用同一可信 fixture 应用股票条件后目标被排除，或用无 metadata 的独立负例证明 unknown 不冒充 ETF/股票。
4. 若要声称筛选完整合同覆盖，再加拒绝请求后的 C+D 保留、取消不提交、返回重新读取等相应旅程；一条成功案例不能覆盖这些门。

真实生产链静态可追踪：Workspace 2191 bootstrap → 2200 stored metadata overlay、2209 `instrumentMetadata` Map → 2212 完整 bundle → `useHomepageHost` owned accepted read → Workspace 2255 → `buildHomepageHoldings` 110–113 → `qualifyHomepageAttachmentGroups` 204–213 的可信分类与类别匹配 → 最新持仓/详情。此链存在是审查证据，不等于完整交互已执行。

### 用例二：详情→普通集合→明确回合→返回状态

最小数据前提：局部 fill 标为 live；在 `bootstrap.instruments`（旧测试 5666 目前为空）新增同 instrument 的可信 metadata，若保持 XPEV 则使用经合法 schema 表达的交易所，例如 `{code:'NYSE', source:'sec', resolvedAt:'2026-09-10T00:00:00.000Z'}`。这是诊断 fixture 的身份输入，不是本次网络验证的证券事实。`metadata-contracts.ts:187–191` 验证 code/source/time；`holdings-model.ts:76–86` 在美股缺交易所时保持 identity=null；`HomeSurface:364` 禁用查看交易。必须继续保留缺交易所的负向用例，不能把 US:symbol 当完整身份。若该测试选择类别筛选，还需匹配 assetType；没有类别筛选时不必为了显示行虚构股票类型。

一条成交只能验证 page=1 的回退，不能证明多页来源恢复。最低保留单行原意时明确只验 page=1；要声称分页恢复，应增至少 9 个明确 live 的不同持仓，使原查询后仍有第 2 页，并使用一行可唯一识别的目标，不借空槽数量造覆盖。价格或 FX 不全时金额排序按钮禁用（HomeSurface 307–308）；最小场景可用名称排序，若声称金额排序则必须提供原始行情/FX证据。

应继续断言的状态和路径：

1. 用当前页头设非默认市场/账户，按 apply 规则设至少一个真正影响资格的附加条件；设非空局部持仓查询、明确名称排序、可证明的页码，记录 scroll 与来源行按钮 id。期间、历史及贡献状态在对应真实消费者接线后按原稿支持值另行设置，不能从组件内部直接塞 state 代替用户操作。
2. `region 当前持仓（最新）` 内打开目标行 `查看持仓详情`，验证完整身份、账户和标的；关闭详情时立即验证查询、排序、页码、滚动和原按钮焦点。缺行重读分支只回表格标题。
3. 再从详情唯一主动作 `查看交易` 进入 `/trades` 的普通集合。验证精确身份/当前 market+account+已应用 attachments、成交日期来源；不预设 queue、不自动选择任何首 instrument/episode。用户明确选择目标 episode 后再进入复盘，验证正确 instrumentId/episodeId。
4. 从复盘通过“我的交易室”返回时走现有 guard；取消或保存失败不得切地址、丢草稿，成功才返回。新 `getBootstrap` 必须被再次调用，返回 fresh 数据而保留仍有效 UI；不能只检查旧缓存或 callback。
5. 返回后分别断言 market pressed / 账户、已应用 token 与真实行集合、局部查询/排序/页码、scroll 和来源焦点；期间/历史/贡献的真实当前消费者及各自选择也必须恢复。旧 currency/calendar/近3并无逐字保留义务，但对应范围/期间/历史上下文保留义务仍存在。
6. UI snapshot 的 sessionStorage/remount 恢复仅是 UI 持久化证据。若复盘涉及写入，还要由 root 在隔离 DB 验证 save→返回→reload 的实际持久化；此处 `getBootstrap` 静态 mock 与 fake IndexedDB 不能证明服务端保存链。

当前静态返回调用链：HomeSurface 216–220 记录来源/scroll/focus → 234–240 / Workspace 6032 → host 250 `homepageTradeUrl` 携带 source snapshot → Workspace 2263–2287 建立普通集合 → `session-model.ts:34–47` 仅设过滤且 selectedInstrumentId/selectedEpisodeId 均 null → Workspace 6133–6145 处理明确选择回合 → nav 5848 `openHome` → host 232–247 先 guard 后 URL/owned fresh read → host 153–169 验证匹配来源、`session-model.ts:12–17` 接受 owned read 后恢复 snapshot → HomeSurface 173–180 恢复 scroll 与焦点。host 227–230 将首页 UI 写入 session snapshot。此链静态存在，完整真实返回仍未由这两项日志执行。

## 严重度与交付门

|级别/门|结论|证据限制|
|---|---|---|
|Critical|没有新增已验证产品缺陷|不代表全系统无缺陷|
|Important|无本次反例验证的新产品回归；已知完整期间/历史/贡献接线门仍失败/未验证|HomeSurface 290–293、323 是明确占位；原稿 212–220、456 的实际恢复义务未完成|
|Minor|无新增已验证产品缺陷；旧 selector / fixture 需迁移|原测试业务断言未到达，不能计业务通过|
|Function / state|静态诊断完成；两项 root 完整测试仍 FAIL|原 99/101 不改；本次纯 fixture 未取得运行结果，重复中断执行不计覆盖|
|真实浏览器交互/键盘/触摸|NOT VERIFIED|本次禁止浏览器，未替代 root 证据|
|视觉|NOT VERIFIED|未截图或与原图比较|
|实际 DB 保存/返回/reload|NOT VERIFIED|本次没有持久化验收|
|正式轮次|P1 2/3 FAIL；P3 0/3；其余沿 root 记录|本报告不改 tracker 或接受状态|

建议修复边界仅限后续单独授权的这两个测试及局部 fixture / 协议 mock，按上述原意映射迁移；若实际消费者未接线，应继续明确 FAIL / NOT VERIFIED，由对应 P2/P4 owner 实施。不得恢复旧设计、放宽 live/exchange/summary 资格、改 `showDemo`、跳过测试或用占位文字替换原业务义务。整页视觉、完整数据与独立最终接受仍归 root。

本报告与 MANIFEST 写入后停止写入，冻结资料不再追改。
