# S 状态合同根因诊断（systematic-debugging Phase 1–3）

日期：2026-10-23。诊断者：`/root/state_g61`。基线 HEAD：`5a94ee3ff76e32993fe2c4791a83b40e877a7344`。固定 Node：`v26.0.0`。

结论：S 尚未满足可接入合同。根因是**没有一个在提交、快照、编码、解码和 URL 边界共同使用的规范化 UI 状态模型**。这些边界分别维护形状和合法性，产生了多份可分歧的已应用状态。成功提交把完整 applied 塞进仅应包含 scope 的字段，而持久化读取另一份旧 attachments；编码器宽进、解码器严拒；设计要求的状态又没有进入任何可持久化类型。三轮失败已经反复暴露这一结构问题，不能继续仅按失败断言逐字段补丁。

本次只诊断，不修复。新建探针、参考图阅读副本及本报告均在本目录；未改产品源码、原测试、历史证据和任务状态；未启动服务、运行全量测试、访问业务数据库或提交推送。原暂停记录及前三轮 FAIL 保留。本报告不构成 S 接受或 UI 交付。

## 1. 方法、读取范围与边界

已按 `AGENTS.md`、`docs/agents/development-workflow.md`、`docs/agents/task-decomposition.md` 和 `docs/agents/frontend-control-audit.md` 检查本次范围。使用并完整读取：

- `/Users/zhoulin/.codex/plugins/cache/openai-curated-remote/superpowers/6.4.2/skills/systematic-debugging/SKILL.md`
- 同目录 `root-cause-tracing.md`
- 原任务 README、PLAN、issue 02-state、S 三次 acceptance、实现报告、第三轮反例与测试记录；DESIGN-COVERAGE 中本次相关行及 CONTROL-STATE-COVERAGE 的状态清单。
- 首页 V2.5 正文 HP01、HP02、HP03、HP04、HP05、HP06、HP09、附录 2；重点 HP03:161–190、HP05:349–431、HP06:432–464、HP09:467–502、附录 2:646–678。
- 完整 `homepage-v25-state.ts` 与其原测试；完整 `dashboard-browse-preferences.ts`、`library-browse-state.ts`、`trading-room-pending.ts`，以及 workspace 的持久化读取、搜索/待复盘/历史入口、详情、逐层返回、library 渲染链；dashboard reducer、偏好 hydrate/save 与 sourceSnapshot 构造链。

原始参考 SVG 已栅格化到 [reference-contact-sheet.png](reference-contact-sheet.png) 并直接查看：筛选草稿、已应用与重开、更新失败、四种历史曲线、贡献明细、普通交易库入口、返回来源与搜索详情。生成方法见 [render-references.mjs](render-references.mjs)。这只是设计阅读证据，不是产品截图或视觉验收。

前端审计触发：状态与持久化合同影响筛选、历史、贡献、详情、交易库到达/返回。此次范围仅源码诊断与纯模块运行；鼠标、键盘、触屏、真实浏览器存储、刷新/返回、数据写入和视觉对比均 **NOT VERIFIED**，待 S 修复后由 P1–P5 独立验收。库内 V1.0 全页改版不在本次范围。

## 2. 原始复现与版本绑定

从仓库根目录运行（只读取原脚本；输出另存本目录）：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/S-debug/probe.mjs
```

探针内部以同一固定 Node 执行原 `evidence/S/coordinator-round3.mjs`。原脚本退出码 **1**，六项检查仍为 **5 FAIL / 1 PASS**，源 hash 与第三轮完全一致。原始 stdout/stderr 见 [original-six.stdout.txt](original-six.stdout.txt)、[original-six.stderr.txt](original-six.stderr.txt)。扩展边界观测见 [observations.json](observations.json)，探针见 [probe.mjs](probe.mjs)。探针自身退出码 0 表示完成观测，不表示产品检查通过。

|原始检查|新鲜复现|原始输出依据|
|---|---|---|
|应用 attachments 后快照往返保留|FAIL|applied 为 `categories=[long], openOnly=true`，恢复为空与 false|
|snapshot.scope 不含 attachments|FAIL|成功后 scope 出现 attachments 字段|
|nested businessRows 不进入序列化|FAIL|holdings 注入被编码|
|全账户与真实 allowedAccounts 列表兼容|FAIL|`*` 被当作未知真实账户|
|历史 chartMode 可表示|FAIL|history 仅 from/to/year|
|非法日历日期拒绝|PASS|`2026-02-31` 被拒绝|

原 7/7 PASS 的历史 Vitest 记录保持原样；本次没有把它当作完整状态合同通过，也没有为获得更大 PASS 数运行全量测试。

源 SHA256（完整清单也在 observations.json）：

|源文件|SHA256|
|---|---|
|`app/lib/reviews/homepage-v25-state.ts`|`a0285648e5874a2678763083fbb07163782fdd4e88345e74ab98c280d1f35029`|
|`app/lib/reviews/homepage-v25-state.test.ts`|`05f50bae66f78cbda202f94781f77a37e0d2ea55b92805c08c22414b1355147c`|
|`app/lib/reviews/dashboard-browse-preferences.ts`|`ad8871cb36a036795d532082d1b559489f1d563407e40c2d86f4cc09e6b9b36f`|
|`app/components/library/library-browse-state.ts`|`bff0f833131d7ac7200be64ca47c9ef58f1698da661912d563bc6e1a873f2047`|
|`app/components/trade-review-workspace.tsx`|`608f67cf29284bad6c252ba4843b2bc20fe67e9ef43583247d88e8fdc729e74b`|
|`app/components/dashboard/review-dashboard.tsx`|`c87940a65ca303a399e785c6df4242a8391fa1934d5628b7f0dcfecfbb276fa2`|
|`app/lib/reviews/trading-room-pending.ts`|`3ac59ec8628d0c5d370ce22bf4933c67e5a54b9500d0f9a0ad4b8b14d67f9401`|
|`app/page.tsx`|`76de4eb447c1ef8fa19620e4176a767a567544f8bca83b94c7e27a6eb11afed5`|
|首页 V2.5 `visual-design.candidate.md`|`daa1434e4437c340cbd23e38e15a7a34c31a892685ad7dfd1269ffe418605c22`|
|原 `coordinator-round3.mjs`|`a9cb5c2375f56bb924522731a7a2c9446fbbddc1c8ca38f7ba9f933b4ac6837d`|

探针结束复核上述全部文件 hash 未改变。

## 3. Phase 1：跨层输入输出与反向追踪

### 3.1 已应用筛选丢失是提交边界首次产生的分歧

相关源码：[类型与权威字段](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/homepage-v25-state.ts:27)、[成功提交](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/homepage-v25-state.ts:138)、[编码](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/homepage-v25-state.ts:176)、[解码](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/homepage-v25-state.ts:193)。

|边界|实际值/行为|合同后果|
|---|---|---|
|初始 applied 与 snapshot|all / `*` / all；attachments 均空|起始一致|
|编辑 draft|`categories=[long]`, `openOnly=true`|旧 applied 应继续展示|
|begin|request.target 与 draft 一致，generation=1、完整 draft key|请求边界正常保留旧 applied|
|成功 apply|applied/desired/draft 都变新；`snapshot.scope=clone(result.applied)`；`snapshot.attachments` 未更新|首次出现双重、矛盾权威；scope 运行时已违背类型|
|直接 JSON stringify → decode|strict validScope 拒绝 scope.attachments，返回 null|模块生成的快照本身不是 decoder 的合法输入|
|encode|显式 scope 投影删掉其 attachments；另取旧的 snapshot.attachments|新已应用筛选在此被确定删除|
|存储字节→decode|恢复空 categories、openOnly=false|刷新/来源返回将复用错误条件|

这里的存储边界用内存 Map 存放真实编码字节建模，未假称调用浏览器 localStorage。无论实际选择 sessionStorage、localStorage 或 history.state，已经错误的字节都无法自行恢复新筛选。

`createHomepageState(scope, previous)`（112–129）从 previous.draft 继承附件，而 applied/snapshot 从 previous 的已应用版本继承；它不是“从持久化快照完整恢复”的入口。`changeHomepageIdentity`（161–164）显式清除旧附件草稿、取消 request 并递增 counter，但保留旧 applied/snapshot，直到新的目标成功；保留旧已应用展示符合等待期规则。UI 仍须调用 begin 发起新身份加载，不能把 create/change 后的 draft 当作已应用标题。此处不能通过提前更新 snapshot 来掩盖等待期差异。

### 3.2 UI-only 白名单只在部分节点实施

encoder 对顶层、scope 和 attachments 显式列字段，对 holdings、period、contribution、history、search、returnState 却使用对象 spread。逐一向六节点注入同一个**合成** `businessRows` 标记，六者均进入编码字符串；同样标记放 scope/attachments 被剔除。无真实业务数据参与。

decoder 对六节点都要求 exact keys，于是这些由本模块 encoder 输出的字符串又全部被本模块 decoder 拒绝。仅“decoder 拒绝未知字段”不能满足“不序列化业务对象”，也无法保证 encoder/decoder 自闭合。TypeScript 类型不是运行时字段过滤器；调用处 spread、结构子类型和历史存储内容都能带额外属性。

### 3.3 设计模式在类型边界缺失或有多个权威

|设计状态/来源|当前合同|实测与影响|
|---|---|---|
|HP05 / HV25-34 四历史曲线：各期盈亏、累计盈亏、胜率、回合数|history 只有 from/to/year|四种 chartMode 分别加入均被 encoder 保留、decoder 拒绝；不能返回原模式|
|HP05 / HV25-33 单年/今年/年份区间/全部|from/to/year 松散 nullable 字符串|可装部分日期，但没有范围选择模式；无法无歧义重建“今年”选择语义，非法日历和反向历史范围仍被接受|
|HP05 / HV25-38 贡献当前模式独立“仅看未平仓”|仅全局 attachments.openOnly|缺贡献区本地字段；加 currentOpenOnly 后无法往返；不能挪用全局字段改变整页口径|
|HP05 / HV25-37/42 贡献逐模式局部市场/证券/下钻|共享 selectedMarket/selectedSymbol 与 current*/history* 并存|mode=current、selectedMarket=hk、currentMarket=a 仍 decode 成功；消费者没有唯一来源|
|HP03/HP06 搜索详情原查询/选中行/滚动/触发点|字段基本具备|没有完整 restore constructor/存储接线；restoreFocus 返回区域枚举，不返回精确 triggerFocusId，UI 必须另读该字段并处理不存在|
|HP06 来源对象消失回原容器标题|returnState.missingContainerTitle+focus helper|有纯辅助函数；对象存在判定、DOM focus、有效条件保留和重新取数仍属 P1/P3/P4 验收|

year/date/symbol 等值域目前过宽，须跟对应 UI 枚举/身份校验共同确定。附加筛选类别是**标的类别**（图示股票/ETF/基金等），贡献分类是**做多/做空/打新**，不能因原反例用字符串 `long` 就把两个类别合同混为一谈。原反例中的 long 只用于追踪附件值是否被保留。

### 3.4 URL 特殊账户与目录校验冲突

`ALL_ACCOUNTS='*'`、serializer 默认值、parser 语法检查均承认单独 `*`。但 [parser:225](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/homepage-v25-state.ts:225) 随后对每个字符串执行真实账户 membership 检查，没有区分“全部账户”的语义值。结果：

- `accounts=*` 无 options：成功。
- 同一 URL，`allowedAccounts=['broker-a','broker-b']`：invalid-account。
- 真正已知 concrete account：成功；未知 concrete、`*,broker-a`：拒绝；非法日期：拒绝。

目录不能通过人为加进一个伪真实账户 `*` 来修补。应先解析全账户/明确选择两种语义，再仅校验选中的真实 IDs；空/缺失仍显式报错，不能默认扩大范围。URL 附录只要求 live/market/accounts/日期/symbol；**没有要求把所有首页局部 UI 或附加草稿塞进 URL**。URL 负责目标条件，来源快照负责返回上下文，职责必须分开。

### 3.5 完整 request key 仍未规范化

`homepageScopeKey`（104–109）虽然排序账户和类别数组，却 spread 原 scope，再 JSON stringify。语义相同的 `{live,market,accounts,rangeMode}` 与 `{rangeMode,accounts,market,live}` 生成不同 key。保持 generation 和 request.scopeKey 不变，只把成功 payload 的属性插入顺序改变，结果被拒为 `update-failed`。这是可复现的误拒绝，不是网络时序问题；完整 key 应由规范化字段固定顺序构造。

另观测到普通失败结果保留活跃 request，同代随后成功仍能被接受；它在一次性 Promise 中未必出现，但 reducer/流式回调/重复完成时会绕过“失败后手动重试”期望。后续应明确请求终态，而不是把此次观测直接当作已发生的生产故障。负数滚动值被接受也记录为运行时 schema 约束项，不扩展成无证据的用户故障。

## 4. Phase 2：完整工作模式对照

|工作实例|完整输入→处理→输出链|可以采用的模式|不能照搬的语义|
|---|---|---|---|
|dashboard-browse-preferences|read localStorage（捕获 getter/read 失败）→ parse→ normalizePreferences 显式重建每字段→ apply 到 RoomScope；save 也先走同一 normalizer→ JSON→容错写|单一 normalizer 为读写边界提供一致形状；日期 union；只存 UI；无可用存储时不阻断页面|旧偏好特意排除 shared identity；V2.5 的来源快照必须包括明确市场/账户；旧 month/last-3-months 不是 V2.5 week/month/ytd 原样替代|
|review-dashboard reducer/恢复|创建浏览状态→异步偏好 hydrate→显式 restore revision→整体恢复期间、历史、持仓分页等；restore 后忽略较旧偏好；save 等 hydrate 与 restore revision 对齐|恢复优先级可执行，不只写说明；一次 reducer action 恢复相互关联 UI；防晚到偏好覆盖显式返回|旧历史日历不是 V2.5 四种历史图；旧 holdings 只有 query/page，尚不含新 sort；不能宣称旧 restore 已满足 V2.5|
|library-browse-state|默认→兼容旧 queueFilter 的 normalize→同一 browse state 派生 queue/filter/stock rows；range key 排除 selection/scroll/page；rows 与 LRU cache 内存派生且数据身份变化就重建|区分 UI 浏览状态、查询身份、临时缓存与真实业务行；目标入参明确清本地冲突项；导航状态不污染数据键|normalize 有 `...persisted`，不是深白名单范例；accounts=[] 是旧库内部 all 表示，不能让新 URL 缺 accounts 默认 all；closeDateFrom/To 是最终平仓日并排除未平仓，不能充当成交日查询|
|workspace 搜索入口|真实 result instrumentId/episodeId→清旧 library 本地范围→设 libraryTarget→普通 stocks→activeView library|使用真实对象身份，清会遮蔽目标的旧过滤，无固定首条证券|旧搜索入口清 source snapshot，不能直接满足新首页搜索→详情→库→首页来源返回|
|workspace 待复盘/历史入口|sourceSnapshot→shared scope→queue+closed+closeDate range→setActiveView；sourceSnapshot 内存保存|到达前构造完整目标状态，来源条件独立保留|两者均 queue/closed/final-close date；即使 history reviewStatus=all，也不是 V2.5 普通交易库执行日包含未平仓入口|
|workspace 逐层返回|openLibraryEpisode→review；returnToLibrary 保留 browse 仅清选择；returnToDashboardSource→sharedScope+restoreContext→dashboard reducer|逐层返回与主页来源返回不同；精确对象身份；来源恢复有单独 action|activeView/sourceSnapshot 是 useState 内存；刷新后会丢。当前没有 /home/page.tsx、/trades/page.tsx；app/page.tsx 只处理策略原型参数，无新 parser 消费|

`rg` 在 app 中排除模块及其测试后，找不到任何 `homepage-v25-state`/`createHomepageState`/`parseHomepageNavigation` 生产消费者。不能把纯模块的 encode/decode 命名视作浏览器存储已接通。路由、storage adapter、URL 目标优先级与真实数据重新读取属于 **P1 集成工作**，此次只给出接口前提，不跨范围实现。

## 5. Phase 3：一个假设及最小验证

**假设 H1：** 这些失败共同源于“没有规范化的唯一已提交 UI 模型与共享边界投影”；各边界各自维护近似形状，导致成功链与持久化链不封闭。运行环境、数据库或视觉布局不是这些纯模块失败的必要条件。

最小实验 A：只改变诊断副本的一个生成边界，不修改源码。在同一次成功提交后，解构 `applied` 得到 `{attachments, ...scope}`，用它们分别重建 snapshot.scope 与 snapshot.attachments；其它 UI 字段、编码器、解码器、Node 与输入全保持原样。结果：decoder 接受，恢复 `categories=[long],openOnly=true`。对照组原链恢复空值。见 observations.atomicApplyTrace.counterfactualProjection。它确认错误最早出现在 apply→snapshot，而不是实际存储或读取处。

最小实验 B：每次只给一个 nested node 增加同一 synthetic businessRows，六次编码都泄漏，六次解码都拒绝；scope/attachments 两个显式投影对照不泄漏且可解码。它把不一致定位到 spread 与 exact schema 的交界。

最小实验 C：同一 URL 仅增加真实 allowedAccounts 选项；`*` 从成功变失败。最小实验 D：同一成功结果仅调整 scope 字段插入顺序；从成功变 update-failed。共同证明边界需要语义规范化，而非测试字面替换。

H1 得到支持，未执行 Phase 4 产品修复。将 A 中三行投影直接抄入产品只能修一个表现，仍会留下其它非封闭边界和缺失工作模式。

## 6. 三轮失败所反映的结构问题

|历史轮次|已被指出的问题|当前仍暴露的结构|
|---|---|---|
|第 1 轮|请求编号、响应目标、日期、缺来源状态、decoder 不完整、提前更新 snapshot|状态机没有先固定 draft/desired/applied/来源快照的所有权和事务边界|
|第 2 轮|scope 附件双权威、全账户、未规范化 key、缺历史模式、贡献共享与分模式混合|新增字段与特殊分支逐项补上，但提交、编码、解码仍各有 schema|
|第 3 轮|7 测试 PASS 仍 5/6 独立反例 FAIL，正式暂停|测试以函数局部结果/初始快照为主；未经过“变更→成功→来源捕获→编码→存储字节→解码→恢复”完整链，字段存在也没有证明完整设计工作模式|

当前原测试的成功检查只看 applied；快照 roundtrip 从未变更的初始快照开始；businessRows 只测 scope/顶层；`*` 未与真实目录一起测；chartMode/current local openOnly 没有设计反例。报告中的“完整 whitelist/implementation-ready”不能覆盖独立失败。应先让合同在真实设计模式上闭合，再继续页面依赖。

## 7. 建议的最小修复顺序（需协调者继续派工）

1. **先定权威和完整 UI schema。** 明确 global identity、applied attachments、当前期间、历史范围/四模式、持仓、贡献分模式、搜索与来源返回的唯一位置。scope 不承载 attachments；将贡献共享 selected 与分模式字段合并为可推导的单一位置。S 子合同同步覆盖 HV25-33/34/38，不能等 P4 再发现类型缺失。
2. **用一个运行时 normalizer 显式重建全部可存叶子。** encode、decode、restore、source capture 和 scope-key 投影复用它；不 spread 不可信 nested。保留 UI 合法状态，业务对象从不进入输出。日期、枚举、页码、滚动、身份值域和范围关系一起验证；版本改变给明确 migration/reject 行为，不静默扩大范围。
3. **从唯一 applied 构造来源快照。** 成功接受同一 generation+完整规范化 key 的结果才提交。旧 applied 继续驱动旧标题/币种/数据；失败/超时不更新 committed；draft 只供编辑与重试。成功时新 scope、附件及受影响数据必须由集成 owner 原子切换。模块只管理 UI，不存业务 rows。
4. **修请求终态和语义 key。** 固定字段次序，排序只对集合语义字段；保持跨成功/取消/身份切换/超时重试的 counter 单调；清晰区分 popup 关闭保草稿、请求取消、日期取消；晚响应/已终结响应不重新提交。current period 与 history apply 有独立更新域，不能共用一个可互相覆盖的单范围请求。
5. **分离导航目标与来源快照。** 全账户 sentinel 先语义解析；真实目录只校验具体 IDs；serializer/parser 互闭合。以目标 URL 为权威解析 live/market/accounts/execution-date range/symbol；来源只用于返回。非法目标显式纠错，不以旧来源扩大/覆盖。
6. **跑下节最小反例矩阵，再独立接受 S。** 原三轮证据不改名覆盖。本轮新增 RED/GREEN 在 resume 目录绑定新 hash；只跑定向状态与必要邻居。接受后再交 P1 连接实际路由、容错 storage、实际 data reload 与已有详情容器，并执行真实浏览器旅程。

不建议先在 UI 中到处修正 snapshot 的重复字段，也不建议把 previous.applied/businessRows 存一份来“保证返回一致”。返回必须重新读取业务数据。

## 8. 未来 UI 消费 API 与完整工作模式

以下是所需接口行为，命名可由实现者保持最小兼容；本次未引入新产品 API。

|接口边界|所需输入/输出与权威|
|---|---|
|初始化/恢复|`create/restore(unknownSnapshot, context{todayShanghai,knownAccounts,knownSymbols})` 返回 canonical committed UI 或结构化恢复错误；恢复时 request 不活跃。不能仅用 create(scope, previous) 代替完整 snapshot restore。可用条件保留，失效对象只产生 focus fallback|
|编辑|独立 filter/current-period/history-range draft；popup 关闭保留 filter draft，日期取消回 applied；改身份丢旧范围 filter draft。draft 不驱动已应用标签与数据|
|请求|`begin(state, changeDomain, target, now)` 返回 request token（generation、完整规范化 key、域）与 pending state；UI fetch 只使用该 target。`complete(token, outcome)` 返回是否接受与新 committed UI。网络数据仍在集成层，只有 accepted 才同步替换对应 data projection 与标题|
|普通 UI 浏览|明确动作更新 holdings query/sort/page、history chartMode、贡献 mode 及各自 view state、搜索 query/scroll/selected identity、source focus/scroll。不得靠调用者写同一语义的多个字段维持一致|
|来源捕获/编码|`captureSource(committedUI, origin{container,entityIdentity,triggerFocusId,scrollTop})` → UI-only snapshot；`encode/decode` 同 schema、全层白名单；只能捕获 applied 条件，不把新草稿变成已应用|
|持久化 adapter（P1）|容错读写 storage，SSR/阻止访问/配额错误给可继续使用页面的结果；以成功读取完成状态防默认值先写覆盖；保留版本与来源生命周期；选择 storage 介质后以真实 reload 验证，不把 Map 探针算浏览器通过|
|导航 adapter（P1）|`buildNavigation(committedUI, entry{kind,date?,symbolIdentity?})` 得目标 URL 与来源 snapshot；`parseNavigation(url,catalog)` 给目标 execution-date 条件；URL 目标优先。普通 stocks/all review/all position，无 queue，不强制 closed；页面到达即应用|
|返回/focus（P1）|解码→重新加载源条件业务数据→恢复有效 UI→DOM 可用后恢复精确 triggerFocusId；缺对象则定位对应 container title，保留仍有效条件。精确 ID 与区域枚举不能互相替代|

canonical UI 必须完整覆盖：

- **全局：** 首页 live、market、accounts 的 all/selected 区分；附加标的类别多选、global openOnly、pendingReview。币种从 market 派生，不能维护第二份冲突币种。
- **当前期间：** week/month/ytd/custom（若保留 all 则说明合同）；上海业务日具体 bounds；draft/applied 分离。只影响当前 KPI/主图/当前贡献，不改最新持仓或历史域。
- **历史：** single year/this year/year span/all 的范围语义、合法 bounds 与四 chartMode；历史范围只影响历史卡图和历史贡献，保留 contribution 当前可见 mode。
- **持仓：** query/sort/page，范围/排序/查询变化的页码规则；每页 8 行；来源证券完整 identity、滚动和原行触发点。
- **贡献：** mode；current/history 各自 category（long/short/IPO）、sort、page、局部 market→symbol path、选择身份；当前 local openOnly 单独记忆，历史呈现禁用且不清除。局部下钻不改 global market，不持久化 rows/金额/合计。
- **搜索与返回：** query、open、results scroll、selected identity、detail identity、原触发 ID、来源容器和滚动；搜索关闭不清 query，详情关闭回结果。必要的持久化来源与短期浮层状态可分层，但必须定义恢复优先级。

## 9. 必需反例与验收矩阵

本表是后续实现的最小行为矩阵；状态为本次诊断结果，未标 PASS 的项目不能因原 7 tests 通过而关闭。

|ID / 合同|最小反例或工作模式|必须证明|此次状态|
|---|---|---|---|
|S01 / HV25-11/12/46|应用非默认 attachments→capture→encode→storage bytes→decode→restore|applied/唯一 scope/附件/恢复一致，raw snapshot 自身合法|FAIL 已复现|
|S02 / UI-only|分别污染所有 nested node 以及数组元素/来源对象|输出不含任何业务字段；decode(encode(validUI)) 可用；拒绝值域非法|六节点 FAIL|
|S03 / HV25-33/34|4 历史范围 × 4 chartMode，模式切换→详情/库返回→reload|选择语义、范围与图模式完整恢复；不修改当前域|chartMode FAIL；其余 NOT VERIFIED|
|S04 / HV25-36/38/42|两贡献模式设置不同分类/排序/页/下钻；current local openOnly=true→history→current|各自恢复且没有共享冲突；global market 不变|local openOnly FAIL；冲突字段可接受|
|S05 / HV25-49|同语义属性顺序、集合排列不同；真正 account/category/symbol/date 不同|语义相等 key 相等；完整目标任一不同不接受|属性顺序 FAIL|
|S06 / HV25-47/49|A→HK→US 乱序、错误 payload、取消、失败、15s 超时、重试|始终旧整组直到最新成功；终态晚结果忽略；counter 单调|已有部分纯保护；整链 NOT VERIFIED|
|S07 / HV25-11/13|Esc/外点关闭再开；清附加；恢复默认；改身份|保草稿/清范围规则正确；dates 不被 reset；仅成功应用改变 committed|原测试覆盖局部；完整链 NOT VERIFIED|
|S08 / HV25-53|`*` with catalog、known、unknown、empty、missing、mixed、重复 IDs|全账户合法；未知/空不能静默扩大；normalize 稳定|`*` with catalog FAIL；其它局部 PASS|
|S09 / HV25-45/53|date-only、all 无 bounds、custom、倒置、不可能日期、非法 market/scope/symbol、queue|serializer/parser 闭合；非法 market 提示；其它错误可纠正|非法日期/queue 拒绝 PASS；全边界待矩阵|
|S10 / HV25-44/45/55|普通入口/日期点/真实证券→/trades|到达即 applied；成交日筛选包含 open；无 pending queue/closed 强制|P1 NOT VERIFIED|
|S11 / HV25-46/53|与旧 source 冲突的复制 URL，刷新目标，再返回 /home|目标 URL 权威；来源只恢复；回源重读业务数据|P1 NOT VERIFIED|
|S12 / HV25-46|source object 删除、页数减少、FX/数据更新|只回正确标题/有效页；保有效条件；不恢复旧 rows|纯 fallback helper 局部；P1 NOT VERIFIED|
|S13 / HP03/HP06|搜索结果滚动→详情→库→回首页；Esc 关闭层级|恢复 query/scroll/选中行与精确焦点，不固定首条|P1/P3 NOT VERIFIED|
|S14 / 存储边界|SSR、storage getter/read/write 抛错、坏 JSON、旧版本、hydrate 晚于显式 return|不崩溃、不默认写覆盖、更早偏好不覆盖显式返回|新合同 NOT VERIFIED|
|S15 / 独立 UI gates|1440/1280 对照设计；鼠标、键盘、emulated touch 分别旅程|功能、真实持久化返回、视觉各有独立证据|全部 NOT VERIFIED；本次不启动服务|

后续 S 接受必须绑定更新后的源码 hash 和全部适用定向反例。P1 路由、storage 与页面旅程由协调者继续派工；S 单模块通过仍不等于首页交付。

诊断阶段状态：**diagnosis-ready**。等待协调者授权下一阶段修复派发。
