# 首页数据库优化：独立审查与第5轮视觉验收

日期：2026-11-05。审查分支 `codex/homepage-db-1s-20261105`，基线 HEAD `8c8c66c7`；当前候选后端冻结文件与 `backend-freeze-sha256.txt` 的14项哈希全部匹配。只读源码、计划、覆盖表、profile 汇总与候选截图/JSON；未运行测试、未操作数据库、未触发应用交互。依协调者授权，用独立 CDP target 只读保存 V2.5 首页参考图 1440×1000/1280×800、持仓方案 C 原尺寸参考图 1440×642/1280×642，并直接比较 round5 候选 PNG。未动 root target 或应用数据。

## 结论摘要

|门|当前判定|证据/边界|
|---|---|---|
|冷 cache miss 正确结果 ≤1s|**FAIL**|round4 隔离副本 miss：`buildMs=16,782.69ms`、`totalMs=16,794.20ms`。round5 的“cold”浏览器截图实际 view API `cacheHit=true`，不代表结果缓存 miss；同步构建仍超过目标。|
|桌面完整首屏 ≤1s|**FAIL**|round5 现有表面 `paintedReadyMs=588ms`（1440）/`329.5ms`（1280），但 JSON 明确 `completeApprovedHomepage=false`；两图四项指标为空、图表无数据，不能把未完成页面的 ready marker 算完整首屏通过。|
|真实编辑→首次读取展示|**FAIL**|隔离副本revision 0→1写入成功；HTTP 200返回20行，但UI 45.026秒仍无paint、未展示更新值。之后revision2缓存命中不能覆盖此失败，详见P1。|
|真实数据齐备/完整视图|**FAIL / NOT VERIFIED**|20 持仓中14项数量/成本/未实现盈亏不可用，另6项数值字段齐但报价陈旧；底层成因未定。lifetime coverage 为基线已有接线缺口，历史读取明确 `not-wired`；均阻止完整视图通过。|
|失效、TTL 与 atomic publish|**静态审查未见缺口；并发未验**|版本含 book identity/epoch/sequence 及触发器 revision；发布 transaction 重读版本、上海日和有效期并回滚失败。未做并发运行验收。旧版本/算法/过期清理及32项上限、digest 绑定已在冻结实现中补齐（详见下文）。|
|持久缓存跨服务重启|**有限证据支持；独立进程验收未完成**|协调者提供的 round5 服务重启浏览器冷启动 JSON 显示 view API `cacheHit=true`，支持 SQLite 结果被重启后的服务复用；本审查未操作数据库，也未独立核对重启前后库文件指纹。Decimal 精确小数只见测试报告，未独立复核。|
|V2.5 桌面视觉|**最终态 FAIL；回归归因 NOT VERIFIED**|1440×1000 和1280×800 round5 直观对照：候选未达到参考完整终态，指标与主图空白，标题/状态、垂直占位不同。但没有优化前同数据、同状态截图；空财务/历史与布局现状可能来自基线接线和既有空状态，不能据此断言本次修改造成回归。|

## 数据齐备边界

|profile 观察|分类|理由|
|---|---|---|
|round3 DTO slim前临时profile：291 groups中289 `missing-completed-session`、2 `quote-missing`；`missingSessions`共153,144项|**当时的原始行情/覆盖证据缺口；非当前计数**|builder逐证券读取daily candles与coverage后才计算这些状态（`app/lib/storage/homepage-view-builder.ts:127-145`）。它证明那轮fixture对所需完成交易日存在证据缺口，不是持仓为空；该profile已被round4 wire取代，只作为历史分类依据，不宣称现行数量或字节。|
|round4 的20个持仓行中，14行 quantity/cost/unrealized unavailable；另6行这些数值字段 available，但报价 freshness 均为 stale|**不完整；根因未分类**|匿名汇总与 round4 profile 只能证明可见结果及报价陈旧；14行没有逐项原始来源 receipt，无法判定是原始数据未记录、存储投影缺口还是计算协议造成。对6行也不推断报价过时的底层原因；没有一行可被当作“当前新鲜且完整”通过。|
|round3 profile有291 groups及303条lifetime类reasons；round4候选仍将lifetime coverage留空|**基线既有 F资格/financial-source接线缺口造成的unknown**|固定HEAD `8c8c66c7`已在原 `buildHomepageFinancialAcquisition`写 `fxObservations: [], lifetimeSourceCoverage: []`（`git show 8c8c66c7:app/components/homepage-v25/financial-acquisition.ts`行168-172）；原输入及provenance没有lifetime coverage字段。strong `complete()`只把inspection/gaps用于升级universe coverage（同文件行227-250），不是本次server修改丢掉该字段。下游无候选时lifetime返回unknown，bounds对eligible group追加coverage缺失原因。不能将lifetime unknown归因于fixture原始表缺少lifetime数据，也不能归责为本次新增回归。|
|round3 strong profile曾得到4个universe类reason|**实际carrier/存储表示证据缺口，细分原因待逐项核对**|`prepareHomepageFinancialAcquisition`重新检查original carriers，合并`inspection.universeReasons`和存储投影gaps；coverage只有无reason时才complete（`financial-acquisition.ts:230-265`）。profile摘要未输出reason原文，不能断言根因是数据库缺行或表示不足；该4项只指round3，不当作当前候选计数。|
|history `status: "not-wired"`，`reloadHistory` 明确抛出尚未接线错误|**产品链路未接，不是数据集缺失**|`trade-review-workspace.tsx:2432-2465`。设计覆盖表 H19-H28 已将历史标记为 frozen/not wired；这不能算完整首页通过。|

## 具体发现

### P1 — 冷 cache miss 在用户请求内构建，实测远超 1 秒

**复现条件：**清空/失效首页结果后读取任一首页范围。`readHomepageView` 查不到 cache 后，直接 `await buildHomepageViewPayload(...)` 并仅在构建后发布（`app/lib/storage/homepage-view-store.ts:145-190`）。没有已接入的后台预热器；`Options.background` 注释写明仅预留未来 worker（同文件 `:41-47`）。

**实际证据：**round4 strong acquisition读到20持仓，`buildMs=16,782.69ms`、`totalMs=16,794.20ms`；未缓存结果miss仍远超1秒。round5的1440 cold JSON中view API为HTTP 200、`cacheHit=true`；画面ready为588ms，证明该服务启动后取到了持久结果，不是cold result-cache miss。当前响应JSON body为269,217 bytes（网络传输约26,280 bytes），与round4 DTO slim的269,224-byte profile相符；字段膨胀已大幅缩减，但不抵消miss builder时间。修订、cache过期或新范围仍可能再次同步构建。当前round5页面未达完整view，故其588ms不构成完整首屏通过。

### P1 — 成功修改后的首次真实读取返回20行，但UI超时并保持空占位

**复现证据：**隔离副本公开 `PUT` 修改名称成功，`after-edit-report.json` 记录 source revision `0→1` 且修改值匹配。随后 catalog HTTP 200 约480.68ms；view HTTP 200，但 `cacheHit=false`、服务端总耗时16,281.42ms（网络约16,296.6ms），返回20行和更新后的 input version。真实 Chrome 状态在45,025.7ms仍 `ready=false`、无 `paintedReadyMs`、未显示已保存名称、`completeApprovedHomepage=false`；[round5 修改后截图](</Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/candidate-round5-after-edit-1440.png>)显示超时提示、空KPI、图表未就绪和空持仓占位。JSON证据为 `after-edit-report.json` 与 `candidate-round5-after-edit-1440.json`。

**影响：**HTTP成功并不意味着本次编辑已流入可见首页；本次端到端修改/首次读取 **FAIL**。之后原名称恢复到revision2；[最终预览](</Users/zhoulin/.codex/worktrees/38a0/TradeReview/.scratch/homepage-db-optimization-20261105/candidate-final-preview-1440.png>)的374.7ms来自 `cacheHit=true`，不是revision1首次miss的补证或修复。具体是host timeout、状态绑定还是其他原因，本审查不据此推断。

### P1 — 基线既有 lifetime unknown：F 资格接线没有提供来源 coverage

固定 HEAD `8c8c66c7` 已在 `buildHomepageFinancialAcquisition` 的 raw 构造处无条件写 `lifetimeSourceCoverage: []`（`git show` 行 168-172）；该版本 acquisition 输入及 provenance 没有 lifetime coverage 字段。原 strong `complete()` 在行 227-250 检查 carrier 并升级 universe coverage，但不产生 lifetime coverage。故这是**基线已经存在的 F 资格/financial-source 接线缺口**，不是本次 server agent 的新增字段丢失。下游按 selected group 过滤空数组后，每组无法找到 lifetime coverage 而产出 unknown；profile 的 291 groups 与 303 lifetime 类 reasons 与该路径一致。

**影响：**该 baseline 及基于它的候选中，period-all/lifetime 相关 unknown 不能作为 fixture 原始数据不齐的证据，也不能当完整规格通过。strong path 的 `universeCoverage` 已经按 inspection 升级；本审查不把 universe coverage 错报成永久 unknown，也不把 lifetime 接线缺口误报为本次优化引入。

### 已解决（原 P2）— builder 日切冲突由 client 有界重试一次

store 在构建跨过 Shanghai 日切或 `validUntil` 后仍返回409并拒绝发布旧结果，这是必要的 freshness 保护。当前 `homepage-view-client.ts:46-56` 仅对明确的 `409/HOMEPAGE_INPUT_VERSION_CHANGED` 同请求重试一次；未知409仍原样失败；expiry 也使用同一总计两次的 read budget。`homepage-view-client.test.ts:52-74`覆盖同请求一次重试、非指定冲突不重试及冲突/expiry共享预算；`frontend-report.md:12,33`记录红测后修复。故“前端完全不重试”已失效，不再列为当前缺陷；若同一窗口内两次读都冲突，最终仍报告请求错误，没有无界重试。

### 已解决（原 P2）— 持久结果清理与保留上限

round4 冻结实现的 `pruneResults()` 在发布 transaction 内删除 input version、算法版本不匹配及 `valid_until<=now` 的行，并按 `built_at desc,cache_key asc` 确定性保留最多32个 selection、始终保留本次刚发布的 key（`app/lib/storage/homepage-view-store.ts:109-115,187-189`）。对应 store tests 覆盖同时间戳的32项淘汰、保留当前项、旧版本/算法/过期清理。该旧的无界积累问题不再作为当前缺陷；本审查只静态检查代码与测试存在性，未重跑测试。

### P2 — 首页 GET catalog miss 会同步扫描并聚合全量 executions，首屏等待它

`GET /api/storage/homepage-catalog` 直接调用 `readHomepageCatalog`；catalog cache miss 调 `buildHomepageCatalogPayload`（`homepage-view-store.ts:98-119`），其读取所有 instruments 和 executions，构建 summaries、entries、compact catalog（`homepage-view-builder.ts:98-105`）。workspace 初始化 `await Promise.all([getCatalog(), activeAliasLoader()])`，catalog 成功前不设 ready（`trade-review-workspace.tsx:3029-3046`）。

没有 catalog miss 的单独实测值，故不声称这一路径单独已超过 1s；但它仍在用户可见初始化请求内做全量聚合，真实端到端计时必须包含它，不能只报 view POST。

### 已解决（原 P3）— resultVersion 与 payload digest 绑定

冻结实现命中前要求 `row.result_version === homepage-result-v1:${row.digest}`（`app/lib/storage/homepage-view-store.ts:166-168`）；单字段篡改重建测试在 `homepage-view-store.test.ts:69-78`。不再能按旧实现复现错误版本标签。本审查检查了冻结源码及测试，不独立运行该测试。

## 需保留的通过证据与待验收项

- **失效表静态审查：**已纳入执行、证券、行情、覆盖、市场任务、汇率设置、复盘、tag suggestions、Recall 与来源材料等当前读取输入；对当前源码读取表的对照未发现遗漏。触发器在首次 store 初始化时为已存在的表配置 insert/update/delete，table list 见 `homepage-view-store.ts:17-30,74-81`。`tag_suggestions` 变更单测现已覆盖，旧的漏项判断不成立。
- **原子发布静态审查：**输入复制用单一 deferred transaction；构建完成后在 immediate transaction 中复核 input version、上海日和有效期，插入结果/同 key 清理/新 catalog 后 commit，异常 rollback（`homepage-source-snapshot.ts:21-59`、`homepage-view-store.ts:170-179`）。未做并发执行验收。
- **scope/generation/navigation 静态审查：**cache key 区分 financial selection；缓存去掉旧 requestGeneration，`bind()` 为当前请求 restamp（`homepage-view-store.ts:121-135`）；客户端断言 selection、range、generation、asOf、currency（`homepage-view-client.ts:27-38`），host 在提交时校验 generation 与 route（`use-homepage-host.ts:141-179`）。静态结构合理；快速连续切范围、导航离开/返回仍需 Chrome 实测。
- **TTL 静态审查：**cache read 要求 `valid_until > now`；发布时再次确认 `validUntil` 未过期，并以最多24小时及来源/市场下一转换点限制复用（`homepage-view-store.ts:155,172-179`、`homepage-view-builder.ts:33-66`）。未发现过期数据可直接命中的静态路径；跨日冲突在client最多自动重试一次，第二次冲突仍向用户报错，见已解决原P2的边界。
- **DTO slim 状态：**round4 冻结后 wire 为269,224 bytes，display view 159,442、catalog79,948、holdings27,518；相对 round3 旧的2,702,755-byte profile 明显缩减。代码在 builder 返回前调用 `toHomepagePeriodDisplayView`（`homepage-view-builder.ts:181`），只保留 quote state/reasons、删除 `missingSessions`（`homepage-display-contract.ts:43-75`）。这解决字段膨胀量级，但不改变 cold miss 的构建耗时，也不补足缺失的领域数据。
- **重启/Decimal：**round5 协调者提供的服务重启后截图 JSON 中 `cacheHit=true`，是持久结果跨服务启动复用的正向证据；本审查未操作 `.data/homepage-optimization.sqlite` 或独立核对进程前后数据库身份。decimal string/null 静态传递，后端报告列有大于安全整数的小数测试，但本审查未运行该测试或对真实持久命中金额逐项核对，精确金额验收仍 NOT VERIFIED。
- **设计视觉：**参考与候选分别见下方对照表与 findings；本轮判为 FAIL，主因是 metrics/chart 核心数据缺失且布局垂直占用大于 V2.5。这里只验 screenshots/JSON；点击、键盘、滚动交互由协调者负责，不用视觉截图替代交互验收。

## 第5轮验收范围与版本覆盖

触发：本次优化改动首页数据库读取、状态接线和冷启动渲染，要求真实首页≤1秒；按项目标准直接比对批准的 V2.5 参考。当前候选后端冻结清单14个文件SHA均匹配；视觉证据为 `.scratch/homepage-db-optimization-20261105/candidate-round5-*` 与 after-edit/final-preview JSON/PNG。参考截图由独立 CDP target 只读生成：V2.5 home 1440×1000、1280×800；持仓方案 C 原尺寸1440×642、1280×642，均DPR1。此审查不操作数据库，不执行mouse/keyboard/touch、筛选/导航/导出控制旅程；这些控制旅程由 `/root` 验收，不在本表判PASS。

|需求 / 元素|scope及参考|独立证据|判定|
|---|---|---|---|
|1秒完整首屏 PERF01 / 缓存DB01|V2.5 home SVG；cold、warm、重启和写后首次read|round4 isolated result-cache miss 16,794.20ms；after-edit revision0→1后view miss 16,281.42ms。round5 cold browser page paint 588ms、hot 329.5ms，但两者 view `cacheHit=true` 且 `completeApprovedHomepage=false`；after-edit 45.026s仍未ready。|**FAIL**；暖命中不代表冷miss，未完成页面不算完整首屏。|
|当前表现/曲线 H07-H11|`home-1440.svg` 与 round5 cold/hot 1440×1000；`home-1280.svg` 与 cold 1280×800|两视口均四张指标卡无值，日期不可用、曲线区显示无数据；1440候选曲线面板约到y=639、持仓卡y=680，参考约y=546/y=586；1280候选约y=590/y=630，参考y=546/y=586。|批准完整终态对照 **FAIL**。差异是否由本次优化导致 **NOT VERIFIED**：无优化前同数据、同状态截图；空金融状态/主图尺寸可能是基线接线和既有空态。|
|持仓组件 H12-H18|holding option C 两张SVG与首页持仓区域|表头、行情/损益列和横向密度方向相近；option C可见summary有效值与搜索/筛选/导出，候选summary为破折号，截图没有显示quote freshness标记。截图为整页裁面，无法比较全部8行槽、排序/翻页/详情/导出旅程。|局部外观**部分符合**；金额/报价完整性 **FAIL**；其余控制 **NOT VERIFIED**。|
|历史与贡献 H19-H28|V2.5 `home-history-1440.svg`；当前候选源状态|现有链路标记 `history.status="not-wired"`，reloadHistory未接线；不是本次优化新引入，但不能覆盖完整页验收。|产品完整性 **FAIL**；不推定为原始数据缺失。|
|账户/范围/导航控制 H01-H06、H29-H32|项目 CONTROL-AUDIT journeys|本独立审查仅看截图和JSON，不操作账户/市场/筛选/导航/返回控件。协调者负责这些journey。|本审查 **NOT VERIFIED**，不以静态可见控件判通过。|
|persistent view/decimal DB01|后端冻结报告、store/client源码、round5及after-edit profile|cache hit 能跨服务重启使用有协调者运行证据；版本表和publish事务静态未见缺口，cleanup cap/resultVersion binding已补齐。Decimal有测试报告，独立真实库小数逐项对账未做。|失效/atomic为**静态审查未见缺口，并发未验**；持久重启为有限支持；Decimal **NOT VERIFIED**。|

真实修改的单次结果也已单列在P1：公开PUT将隔离副本revision从0改到1成功；view HTTP 200/cacheHit=false返回20行，但真实Chrome45秒仍空占位并没有展示新名称。改回原名称到revision2后的final preview虽374.7ms ready，却是 `cacheHit=true`，不抹除revision1首次读取失败。截图中的空财务/主图、持仓区下移是当前最终态与批准设计的客观差异；没有同态baseline，报告不把它们归因为本次改动。

## 本轮判定限制

这是冻结生产候选的独立截图/静态接受记录，不是整体验收。冷result-cache miss≤1秒及真实修改后的首次read分别FAIL；后者在45秒仍未ready。round5 588ms/329.5ms与最终预览374.7ms均为持久命中时的未完整页面。还需保留lifetime coverage基线接线缺口、history `not-wired`、14项原因未分类和6项stale quote为未通过/未验证；catalog miss暂无独立耗时。协调者另行完成mouse/keyboard流程；不得把暖cache、ready marker或空/unknown视图当完整规格通过，五轮继续暂停。

## 最终构建收尾复核（只读增补）

协调者提供最终内容指纹 `f4ad4d0c7d3eaa1e63bd1689e5b18c8d360eca19cab03de1aa15bc8f8c1e86d3`，该值与 `final-build-manifest.json` 的 `sha256` 一致；协调者报告 `final-build/current` 与之匹配，并确认相对上一浏览器候选只有两个测试文件及 workspace 中一行说明性 ESLint 注释变化，执行代码未变。本审查未重建或重测。

最终浏览器 JSON 的1440×1000状态为 `paintedReadyMs=477.8ms`、1280×800为 `325ms`；两者均 `ready=true`、`completeExistingSurface=true`、`completeApprovedHomepage=false`、`overflow=false`、错误列表为0。对应 view API 均 HTTP 200、`cacheHit=true`、`buildMs=0`，因此是命中持久结果时的现有表面绘制速度，不能替代未命中构建或完整首页≤1秒验收。视图 raw body约269KB。新截图仍为首页标题、四张KPI为空、主图无数据；1440持仓区约从y=680开始，对照参考约y=586；1280约从y=630开始，对照约y=586。V2.5最终态仍 **FAIL**；无同数据同状态的优化前图，回归归因仍 **NOT VERIFIED**。证据：`final-build-preview-1440/1280.{png,json}`。

协调者提供的交易库入口journey证据也未通过：目标交易集合页在约26.8秒仍 `ready=false`，截图显示读取超时；途中页约1.7秒仍在连接/读取SQLite；返回首页约28.6秒及随后reload约17.8秒仍 `ready=false` 且有busy读取项。故入口目标集合、返回与刷新后的完整加载均 **FAIL**，不把按钮可见或旧表格残留算作旅程完成。证据：`desktop-trades-after/during/return/return-reload.{png,json}`；本审查只读核对截图和状态摘要，没有独立执行这些交互。

最终四表对账的协调者摘要称原库四表未变化；隔离副本对照 `data-final-differences.json` 显示成交1866行与导入批次213行均无变化。副本236条instrument中12行变化仅涉及 `metadata_json`、`updated_at`，metadata内部键为 `exchange`、`resolvedAt`；138条review中1行仅 `updated_at` 变化。该对账不支持“副本完全未变”的说法，也没有显示成交或review内容改变；本审查不输出行标识或字段值。未访问或修改任何数据库。

此增补只更新最终构建截图、所给交互证据及数据差异摘要，不改变前述判定：当前候选依然整体 **FAIL**，五轮暂停；冷miss、写后首次读取、完整页面、历史接线及真实数据完整性门仍未通过或未验证。
