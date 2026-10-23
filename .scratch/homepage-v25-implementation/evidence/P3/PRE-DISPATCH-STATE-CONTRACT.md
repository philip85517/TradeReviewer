# P3 派发前状态合同

状态：**PREPARATION ONLY；P1 第二轮尚未接受；P3 0/3 BLOCKED**。本文件不是实施授权、P1/P3 验收或产品交付。

准备人：`/root/state_g61`；实际模型 **gpt-6.1-sol / ultra（GPT6.1 Ultra）**。同票未来页面 owner 仍为 `/root/integration_g61`，协调者 `/root` 负责整页视觉、完整数据流和独立接受；本次未再派代理。

只新增本目录准备文档。未修改产品、现有测试、共享 tracker、S/F 或历史证据；未启动浏览器、服务，未访问数据库。下面的源码事实绑定 [SOURCE-MANIFEST.pre-dispatch.json](SOURCE-MANIFEST.pre-dispatch.json) 的 `2026-10-22T18:17:49.933Z` 读样，P1 仍可变；派发必须再绑定其正式接受版本。原图共 40 个，均核实存在、读取并渲染检查；临时 SVG→PNG 仅用于读图，不是产品截图或视觉验收。

## 1. 原始依据与逐项覆盖

完整阅读 [P3 原票](../../issues/06-search-filter.md)、[DESIGN-COVERAGE](../../DESIGN-COVERAGE.md) 所列 HV25-07..13/23..30、相邻返回/URL/失败合同；正文使用 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`。原图统一位于同 baseline 的 `source/images/`，原文件 hash 全列在 manifest。下列 `HOME-*` 是原 manifest 文本块，**没有原 elementID，不把准备文档编号冒充原稿 ID**。

|覆盖|原正文 / 原文本锚点|准确参考图 / 应读状态|P3 约束|
|---|---|---|---|
|HV25-07|HP03:130–160 / `HOME-HP03-B019`|`search-overlay-open.svg`、`search-motion.svg`、`search-overlay-reduced-motion.svg`|页头全局搜索；最大 960、外侧至少 24；背景 inert；退出回触发器、保查询|
|HV25-08|同上|`search.svg`、`search--detail.svg`、`search--empty.svg`、`search-error-frame.svg`|300ms、IME；loading / 无匹配 / 失败分开；清查询不改范围|
|HV25-09|同上|`search-detail.svg`、`detail.svg`|结果→详情→原结果；详情焦点锁定、外点不关闭；唯一主动作“查看交易”|
|HV25-10|同上|`search.svg`、`search-detail.svg`|名称、代码、交易所、币种、类别直接可辨；实际唯一身份；不能用首行替代|
|HV25-11|HP03:161–190 / `HOME-HP03-B044`|`filter.svg`、`multi-applied.svg`、`multi-applied--reopen.svg`、`cancel.svg`、`cancel--cancelled.svg`、`account.svg`|320 宽 / 字段 36；同维 OR、跨维 AND；草稿、重开、身份切换|
|HV25-12|同上|`multi-applied.svg`、`multi-applied--reopen.svg`|成功后完整条件与数据原子提交；失败保旧 applied 与 draft|
|HV25-13|同上|`clear-attachments.svg`、`clear-attachments--after-clear.svg`、`reset.svg`、`reset--reset.svg`|清附加与默认不同；不改日期；默认第二行、底部 16|
|HV25-23|HP04:255–294 / `HOME-HP04-B001`|`holding-option-C-normal-1440.svg`、`holding-option-C-normal-1280.svg`|48 标题 / 40 表头 / 48 行 / 48 页脚，8 槽；列 25/8/10/11/11/15/14/6，内 16|
|HV25-24|HP10:609–643 / `HOME-HP10-B088`|上述普通金额及 `holding-option-C-large-1440.svg`、`holding-option-C-large-1280.svg`|C 标题右侧汇总；搜索/导出独立空间；A/B 历史候选不替换 C|
|HV25-25|HP04:255–294 / `HOME-HP04-B001`|`extreme.svg`|价格/成本两位显示；原始精度、全值 hover/focus/CSV 保留；极值不撑高|
|HV25-26|HP04:295–346 / `HOME-HP04-B048`|`count-boundaries.svg`、`count-boundaries--nine-items-last-page.svg`、`50-items.svg`、`50-items--page-7.svg`|0/1/8/9/50；50 末页 2 项；0 不伪装 1/1，1–8 禁用翻页|
|HV25-27|HP04:324–346 / `HOME-HP04-B052`|`empty.svg`、`empty--zero-holdings.svg`、`extreme.svg`|无持仓 / 局部无匹配 / 缺成本 / 缺价分开；局部清空只有输入 X|
|HV25-28|HP04:295–311 / `HOME-HP04-B048`|`local-search-pages.svg`、`local-search-pages--one-match.svg`、`local-search-pages--clear.svg`|表内 300ms / IME；改词/清除回 1；不触发全局搜索|
|HV25-29|同上|`count-scales.svg`|完整可比较金额才允许市值/盈亏排序；缺 FX/覆盖解释禁用；范围/排序变化回 1|
|HV25-30|同上|`count-scales.svg`|导出全部筛选结果，不是当前页；完整原始精度|

另完整读相关正文：HP01（全页/局部作用域）、HP04:312–322（持仓来源返回）、HP06:434–464（普通库/完整恢复）、HP08 公共控件、HP09:467–515（原子提交/15s/迟到/动效）、HP11 双桌面与附录2:646–668（URL）。对应补读 `holding-return.svg` / `holding-return--detail.svg` / `holding-return--after.svg`，以及 `search-motion-before-frame.svg` / `search-motion-during-frame.svg` / `search-motion-after-frame.svg`。

公共手册 `source/component-manual.html` 已完整读相关章节：全局对齐:105–108，账户 Select:283–369、Search:370–455、FilterPopover:456–523、Token:524–610、DataTable:785–872 与使用边界。当前手册没有独立 Dialog 章；详情采用 HP03/HP04/HP06 和 `detail.svg` / `search-detail.svg`，不能声称读过不存在的 Dialog 章。手册统一实际账户宽度 176 优先于历史状态样例 180。公共八态应按实际条件实例登记，96 行总数不等于本票已覆盖数。

原资产解释差异必须保留：`search--detail.svg` 实际是“无匹配”，`search--empty.svg` 是“请求失败”；`multi-applied.svg` / `--reopen` 应按图中 draft/applied 文案辨认；`cancel.svg` / `--cancelled` 实际表现附件草稿及重开，正文 state-demo 的“日期草稿/取消日期”标题与图不符。不能按文件名或错误标题实施新的日期入口。动效正文为 160ms / 4px、hover 120ms、数据替换 150ms；reduced-motion 直接最终态，即使旧图沿用动画注记。

## 2. 协调者对既有原稿差异的明确裁定

以下为本次 `/root` 对原正文、手册和旧图冲突的协调裁定，**不是用户新增需求，也未授权本次实施**。

1. **正文 HP03:163 优先**：附件 `openOnly:boolean` 表示单向“仅看未平仓（含真零浮盈）”，不使用旧 `filter.svg` / 手册:457 的“是否有未实现数据 有/无”文案。无浮盈输入、真零浮盈和已平仓不能相互替代。旧图视觉文案偏差留在本报告，不假装完全无差异。
2. **待复盘直接双选**：`pendingReview:boolean[]`；`[true]` 仅是、`[false]` 仅否；`[]` 及 `[false,true]` 均不过滤，但保留用户两种不同选择，供重开显示。数组去重/稳定排序，不把双选写回空数组。贡献 `current.openOnly` 保持现状。
3. **ordinary URL 采用附录2完整合同**：`market/accounts/date-or-range/symbol/live` 是目标条件；attachments 只保存为来源首页 UI，不能经 `hpSource` 偷偷过滤库，不能把 pendingReview 转成 queue。附件应用只限制首页数据。
4. **跨市场搜索可真实展示目录**，但不改首页 market/account/period。“查看交易”仍携带已应用目标范围；交集为空就展示真实空集合和原因，可在详情说明“该标的不在当前范围”，不暗中换市场或账户。
5. **待复盘按 group 聚合**：在适用 episode 中至少一个 `reviewState=pending` 则 yes；已知没有 pending 才是 no，completed/deferred 均不是 pending。未知或缺 episode 证据不能被推成 no/已复盘；先保留 unknown 和原因，不从缺值构造业务事实。

第2项需要 S 的明确版本迁移；原 issue 02 接受/失败历史保留，由 root **另行恢复同票验收第2/3轮**，不能当新票重置 cap。P3 不绕过 S 接受门槛，也不在页面自行兼容一套旧/新附件权威。

## 3. 唯一状态所有权与完整字段

当前 S 为 `app/lib/reviews/homepage-v25-state.ts`，`snapshot.version=2`，唯一 committed 权威；`applied` 是 snapshot 的只读投影，`draft` 是唯一编辑权威。未来 v3 只扩展本合同必要 UI 字段；业务条目、行情、金额、目录结果、请求 Promise 不进 UI snapshot。

|域 / 字段|权威与作用域|恢复/更新边界|
|---|---|---|
|`scope.live=true, market, accounts, rangeMode, from?,to?,date?,symbolIdentity?`|snapshot；全页范围。账户为 `['*']` 或非空具体集合，不能混用|URL 目标优先；`'*'` 是 sentinel，不要求目录有同名账户；非法具体账户、空/mixed/date/symbol 不静默扩大|
|`attachments.categories:string[], openOnly:boolean, pendingReview:boolean[]`（拟 v3）|snapshot；仅已应用后限制首页；draft 独立|同维 OR / 跨维 AND；清附加保 scope；跨身份按正文丢旧附件草稿|
|`draft: HomepageScope & {attachments}`|S 当前内存编辑值，**不持久化为 applied**|Esc/外点保留、重开继续；返回/reload 由 committed 重建，不偷偷承诺跨刷新保未提交草稿|
|`period.preset=all/week/month/ytd/custom, from,to`|snapshot 当前表现期间；all 为 null/null|与首页 identity、history 独立；日期草稿有其独立域；清附加/默认不改|
|`history.range=all/year/this-year/years`，`year` 或 `fromYear/toYear`；`chartMode=period-pnl/cumulative-pnl/win-rate/round-count`|snapshot 历史范围与四图模式|P3 只保持和恢复，不实施 P2 图表；不能因附件/全局搜索丢失|
|`holdings.query,sort,page`|snapshot 持仓表局部|只筛表；词/清除/排序/全局范围变更回 1；返回恢复后按真实数据夹紧页码|
|`contribution.mode`；current/history 各自 `category=long/short/ipo,sort=profit-desc/loss-asc,page,market,symbol,drilldown=markets/symbols`；仅 current `openOnly:boolean`|snapshot 两套独立局部视图|P3 原样保持，不借附件或详情重置；不能合并两个 selected 或 openOnly|
|`search.query,open,resultsScrollTop,selectedSymbol,triggerFocusId`|snapshot **页头全局搜索**上下文|selectedSymbol 是完整身份，非数组位置；与 holdings.query 无关；结果重新从真实目录读取|
|`returnState.source,container,detailId,triggerFocusId,missingContainerTitle`|snapshot 精确来源|container 可 search/holdings/history/contribution；存在回精确触发器，缺对象回对应标题，不固定 holdings|
|`scrollTop,focus,futureDisclosureSources`|snapshot UI-only|返回/刷新恢复；恢复后没有活跃旧请求、没有旧业务快照|
|`requests.{global,period,history}`；各自 `errors,timeouts`；`requestCounter`|S 会话请求；generation + 规范化完整 target key|绝不序列化；15s、失败/取消后迟到不可提交；global 与 period/history 保持原依赖失效规则|
|输入框 raw text、composition、debounce timer、局部候选 loading/error、结果列表/活动 DOM 索引、浮层 ref|同一页面 owner 的瞬时 UI/读模型|不再保存第二份 committed query/identity；异步结果必须核对当前 query + catalog revision + 请求代次；无虚构网络请求/假 loading|

类别必须由真实 metadata / 既有分类函数给出，不能按名称或价格猜股票/ETF。当前 `InstrumentAssetType` 仅 `stock|etf`（`metadata-contracts.ts:18`），旧图还有“基金”；这是一项真实支持边界，不能造 fund 事实或静默把未知当股票。若展示暂不支持的类别，文案和可选状态须准确，结果为空/不支持必须可解释。S 的 string[] 不能替页面决定业务分类。

待复盘判断复用既有状态事实：`reviewState`（`review-queue.ts:157`）先 recall 状态，再 completed，再 deferred/pending。`!review.completed` 会把 deferred 错当 pending。按 root 裁定，在同一适用 group 的 episodes 上做 `any(pending)`；只有完整、已知没有 pending 才是 no；open/pending 不因“普通库不是 queue”而被自动排除。不得擅加 closed-only / queue 资格。缺 episode/未知的 group 是 unknown，不能把“否”文案写成“已复盘”。验收至少列 open/pending、closed/pending、completed、deferred、缺 episode 五组事实。

### 四区共同范围与数据适配

同一 owned bundle、同一 asOf 下先建立 global market/accounts/explicit-live 的真实基础集合，再按既有 canonical 分组键（account/instrument/nature/run；类属性来自真实 instrument metadata）计算附件资格。类别按真实 metadata，openOnly 按该 asOf 的 canonical 未平仓事实（与浮盈是否为0、是否缺价格无关），pending 按上面的 group 聚合。未知保原因，不写成 known false。对 `pendingReview=[]` / 双选均不限制，单选只匹配明确对应事实，未知输入不能被伪造为任一值。

由这一份 group 资格得到唯一首页源集合，分别适配到表现、当前持仓、历史、贡献的既有消费者；模块只再应用各自 period/history/local 控件，不能每区重新猜一次附件谓词。已选 group 内要保留 canonical/F 需要的完整执行与 IPO/费用边界，不能为了“仅待复盘”只截取一条 pending episode 后重算库存/费用。`current` 与 `history` 的贡献局部状态仍各自存在，不与全局附件合并。

适配必须保持**复合组身份**：A账户/X标的与B账户/Y标的通过，不等于 `accountIds=[A,B]` 且 `instrumentIds=[X,Y]` 的笛卡尔范围，后者会漏入 A/Y、B/X。现接口若不能表达复合白名单，应由原数据/F owner 提供有限同账本 seam，或传严格按完整组保留的源数据；不得为页面新建账本。四区计数、金额、图点及 unknown/排除原因必须与同一资格集合对账，不能只证明参数/标签一致。

## 4. 全局搜索 → 详情 → ordinary 集合 → 返回

1. 页头 Search 开启：记录真实触发器 ID，写 `search.open=true`；只将初始输入/结果上下文恢复。首页、导航背景 inert；结果容器独立滚动。桌面最大 960、≥24 外侧；窄屏采用正文可用宽度规则。**不会触发 onScope，不更换账户、市场或期间。**
2. 输入：300ms 后提交完整词；IME composition 中不查询，compositionend 重新计时。clear 取消旧 timer/查询，只清 query/候选/选中；不清全局范围、附件、持仓本地词、日期。关闭保词与位置；待返回时可重读目录。
3. 目录：使用已接受 bundle 的真实交易 + 已有 metadata 的可知目录。当前不是全市场证券服务，必须准确说明覆盖。名称、代码、official exchange、币种、class 来自真实记录；US/provider 不等于 exchange。目录缺失不是假“无匹配”，读失败不是 0 结果。
4. 选中：按 `exchange:code[:class]` 解析到唯一 instrumentId，保存完整 selectedSymbol、结果 scroll、精确结果触发器与来源 search。相同 exchange/code 存在不同 class 时不能用 Object.fromEntries 的最后一项覆盖；缺 class/exchange 证据时不伪造身份。可展示可知详情和原因，唯一“查看交易”在身份不唯一时不可冒进。
5. 详情：同一详情 shell 接受 search 或 holdings 来源，不要求有当前持仓。无持仓的真实目录标的应能打开，金额缺输入显示暂无/原因，不能复制另一行的数量/市值。外点不关闭、Esc/关闭回 search 的词/滚动/所选行；只有最上层处理 Esc，不能一次把详情和搜索都关掉。
6. “查看交易”：构建附录2 URL + 独立 UI source snapshot。URL 始终保 applied market/accounts/live 与已应用成交日期范围，附完整 symbol identity；all 不夹 from/to。来源 snapshot 含附件/所有局部上下文，**不成为目标库过滤权威**。调用现有 guard，取消时 UI/URL/焦点不丢；同意离开后进入普通集合，不自动选首 episode，不带 queue/badge。
7. 目标显示：使用真实 URL intersection；跨市场/账户无成交或 metadata-only 标的无成交时展示真实空集合和范围原因。日期是成交日期、含未平仓成交，不能偷换成 closed-date 统计口径。直接打开同 URL、reload 与从搜索进入应得到同一集合。
8. 返回：现有 host 的 owned read 先重读真实 bootstrap/metadata/行情/FX，成功后 UI-only 恢复；不以 source 恢复旧业务数据。原查询、选中、结果滚动、持仓 query/sort/page、期间、history、双贡献、页面滚动和焦点均恢复。对象不存在时保仍有效 UI，通知并回**搜索结果标题**；holdings 来源才回持仓标题。直接 URL 与 source 不同，URL 优先，不能返回时把目标条件覆盖成来源条件。

`search-detail.svg` 有“原搜索第2页”示例，但正文明确需要结果位置；现 S 只有 resultsScrollTop、selectedSymbol，没有全局结果页码。优先用一个独立滚动结果区满足原上下文；不得为这句图中文字擅自实现第二套持仓分页或未记录的全局 page。若 owner 选择实际分页，须先扩展同一 S 合同并独立验证，不能偷偷存在组件副本。

### 原生 URL 的期间初始化与显式“全期间”

附录2的日期条件在 direct URL/reload 是权威输入。`/home?...rangeMode=custom&from=2026-09-01&to=2026-09-30` 不能在当前表现上显示“全期间”却继续过滤9月；`rangeMode=date&date=...` 也不能丢失该日。进入首页时应将已验证 URL 日期明确初始化到同一已应用 period（date 可映射单日 custom），同时保留必要 route 表达，来源 snapshot 不同则 URL 优先。当前表现期间与历史期间仍是两个独立域。

用户后来**显式选择全期间**，含义是清除 from/to/date 并写 `rangeMode=all`，显示、请求 key、浏览器地址、持久化/恢复与下一次“查看交易”必须一致。不能把“period 尚未初始化的默认 all”和“用户已选择 all”混为一事，更不能靠 `period=all 时继续 fallback scope 旧日期` 令9月条件永久残留。该动作不改 market/accounts/live/附件，也不重置 history。

当前 `homepageTradeUrl` 的最新 fallback 保留 native date/custom，有助于不吞原 URL 日期，但单凭 fallback 不能证明显式 all 可清除。最小边界需由同一 S/session/host 接口明确完成 URL→period 初始化与 period→URL 的受控投影；不得在页面再存 `hasExplicitAll` 作为第二权威。S 的独立 period 请求域和全局 key 依赖仍保留，原子接受后再更新 URL。此处是后续 S/host 有界修复输入，本准备未作改动。

## 5. 附件状态转移与原子提交

`C`=snapshot 已应用；`D`=S draft；`B`=同代已接受业务 bundle。标签/角标、全页投影均读 C；字段选中读 D。不能在点击 checkbox 时改 C。

|动作|S / host 最小转移|用户可观察结果 / 失败|
|---|---|---|
|首次打开 / 重开|首次 D 来自 C；会话中已有 D 则保留|320×字段36；重开显示未提交选择；不重置为 C|
|编辑类别 / openOnly / 待复盘|`editHomepageDraft`，仅修改 D|页面数据、应用标签、已应用账户标题均不变|
|应用|`beginHomepageApply(ui,D)`；host 读取同代 B；`completeHomepageRequest` accepted 时一次提交 `{ui,data}`|全部成功才新 C+B+标签；失败/超时保旧 C+B 和当前 D、显示原因；不显示新标题配旧数据|
|Esc / 外点 / 取消|关闭浮层；如该浮层申请中则结束其 token，`cancelHomepageDraft` 保 D|重开 D 仍在；旧迟到结果不可提交；不隐式应用|
|清除附加|`clearHomepageAttachments` 只变 D；再走同一 apply-purpose 提交|categories=[]、openOnly=false、pendingReview=[]；保 market/accounts/live/date/period/history；失败仍旧 C+B，空附件 D 可重试|
|恢复全部默认|`resetHomepageDefaults` 只变 D；再走 apply-purpose|market=all/accounts=['*']/附件空；日期期间/history 不改；成功才标题/币种/数据一起换，失败仍旧 C+B|
|移除一个已应用 token|从 C 构造下一 D，移去准确条件，走同一 apply-purpose|成功后才删 token；失败 token 与数据保留；焦点回该 token，最后一项成功后回筛选触发器|
|切市场/账户|identity-purpose：`changeHomepageIdentity` 清旧附件草稿并失效请求，然后提交新 identity|立即关闭浮层；不预先改 applied 标题；成功新 identity，无旧附件；失败保旧 C+B，不恢复已作废旧请求|
|手动 retry|新 generation，重试明确的失败目标 D|不能重用旧 token，也不能把 refresh 误当应用草稿|
|自动 focus/visibility refresh|refresh-purpose：target=C；D 独立保留|刷新真实数据但不清附件、不应用未提交 D、不丢草稿；失败保 C+B|

正文“清除附加编辑仍按应用规则生效”与手册:456–523 的清除/默认动作一致：S 清除/默认本身只准备草稿，UI 命令负责同一提交流程；不得为了让画面变立即直接 mutate snapshot。具体加载锁定实例、错误修复入口复用 HP09 公共规则；禁止叠一层与全局状态冲突的局部假成功。

### v2 → v3 的最小比较与选定方案 A

|方案|附件结构变化|收益 / 代价|裁定|
|---|---|---|---|
|A|保留 `categories:string[]`、`openOnly:boolean`；仅 `pendingReview:boolean → boolean[]`|正文单向 openOnly 已完整表达；待复盘可真否、双选；改动最小|**root 选定**|
|B|将附件条件都集合化，例如 openOnly 的单个 `open` 选项也改数组；pendingReview 双选|不能擅加 closed / 旧“有无未实现数据”选项；单元素数组无额外表达收益，迁移面更大|未采用|

显式迁移：严格验证旧 v2 后，`pendingReview:true → [true]`、`false → []`；其余所有 UI 字段逐一保留。不得把旧 false 迁成 `[false]`，这会把“无条件”变成“仅否”。v3 `[false]` 与 `[]` 必须 encode/decode/restore 往返不丢；`[true,false,true]` 规范化为 `[false,true]`，保留双选，不改为 `[]`。筛选谓词对 0/2 项均不限制；提交 key 必须覆盖真实 target UI 选择，集合次序/重复不改变 key，不把未知值吞掉扩大范围。

v3 编码仍逐层 UI 白名单；解码严格拒绝非法字段/类型/未知版本。缺少必需旧字段不自行补默认；不支持的更旧版本继续明确拒绝。恢复只读 UI、requests 为空，不能携业务 rows/FX/价格。host 的 v2 sessionStorage key、v3 新写 key、history.hpSource 和当前会话 source reader 必须统一走 S 的版本化读取；只在成功读取/允许持久化时写新版本。保留旧 v2 数据作为可迁移输入，不靠单纯换 key 丢失用户旧 UI。S 的现有导出维持合理兼容，具体调整另行同票接受。

## 6. 当前 S / host / UI 接口对照：确定缺口与最小 seam

这些是 P3 派发前静态事实；不是对尚未实施 P3 的正式失败验收。P1 同时在修复，行号/字节以 manifest 和其后正式 freeze 为准。

|源码事实|影响|最小处置 / 不另建体系|
|---|---|---|
|S:10 / 118–122 `pendingReview:boolean`；snapshot:26 为 v2|不能区分“仅否”和无条件|按已裁定 A 在 S 同票显式迁移；页面不得另存负条件|
|`session-model.ts:9–11` 每次 `startHomepageRead` 都 `changeHomepageIdentity`|现 helper 不适合附件 apply/refresh；会清附件。当前 refresh 事后 source restore 也不等于保留未提交 draft|给 session/host 分 identity/apply/refresh purpose，仍用 S 原语；identity 才清草稿|
|host:72 调上述 helper；:191 onScope / :192 reload 入口没有附件命令，reload 传 draft|不能把 apply 接 onScope；refresh 不能顺手应用 D|公开语义命令，统一 owned read；手动 retry 与 refresh 目标明确分开|
|S initialSnapshot 的 period 为 all；当前 URL helper 在 period all 时 fallback scope 的原生日期|原生日期初始标签可能与实际目标不一致；用户显式 all 与未初始化 all 不可区分|URL→period 明确初始化；显式全期间清除日期投影；同一 S/host 域完成，不另存布尔旗标|
|S `beginHomepageApply` 会令 draft=target；complete 只提交 snapshot，不覆当前 draft|refresh target=C 时若直接 begin 会吞 D|session 在开始 refresh 时保存唯一 D，begin(C) 后用 S `editHomepageDraft` 恢复 D；保持 token.target=C。若需更小 S helper 也应同票，不加第二 draft store|
|`session-model.ts:20+` URL 只 scope/date/symbol；collectionState 无 attachments|此前可能被误认为漏传附件|依 root 裁定是正确职责分工；保留来源附件，不投影到目标 URL/queue|
|`home-surface.tsx:181–182` 页头搜索/筛选 disabled|尚无 P3 搜索/附件实际控件|一个页面 owner 接入这两个入口及所需共享样式/测试|
|surface:71/85 detailId 在 holdings.rows 中查；:99–100 / :132 固定 fallback `hp-holdings-title`|无持仓搜索标的进不了真实详情；search 来源回错标题|单个 DetailOrigin/详情适配器支持 search/holdings；消费 S returnState 的正确 container 与精确 trigger；复用现有 dialog，不复制一份详情|
|`holdings-model.ts:72–79` 返回 exchange:code；workspace:2174+ identitiesFor 用 Object.fromEntries，输入只有 entries|同 exchange/code 不同 class 会覆盖；metadata-only 不在目录；尚不足搜索全集|同一 catalog adapter 接真实交易+metadata，验证 full identity 唯一性；目录/host URL validation/catalogFor 复用同一 adapter，不双向映射猜首行|
|workspace:2215 `buildHomepageHoldings(...scope)`，options 没有附件；当前页附件无数据投影|即使新增 checkbox/角标，也不会改变首页业务数据|在已接受 bundle 上单一首页范围/附件投影，再交既有 F/持仓消费。不要只过滤显示行，不造第二套库存/费用账本；P2/P4 后续消费同一结果|
|当前目录 assetType 只支持 stock/etf，旧图有 fund；review 状态有 deferred|固定截图例子不等于事实覆盖|类别/待复盘建立准确业务映射，明确不可知输入；未知不当零、不当股票/否|

### 建议的同一 owner 文件集合与消费接口

未来派发只给**一个页面 owner**，不按 Search/Filter/Detail/host 分给并行实现者。最小文件：

- `app/components/homepage-v25/home-surface.tsx` + `home-surface.css`：全局搜索/附件/共用详情/局部工具与来源焦点；可在同目录拆纯视图，但 owner 不变。
- `use-homepage-host.ts` + `session-model.ts`：单一 UI+data 原子会话、read purpose、语义命令、现有 guard/URL/source/storage；不另造 route/store。
- `holdings-model.ts` 或同目录小型 catalog/range adapter：**纯已知目录与筛选投影**，复用现有 canonical/F，不做新 provider/新金融计算。
- `trade-review-workspace.tsx`：仅传同一 bundle/known catalog/命令，复用现有普通集合入口与完整数据流；不改旧 dashboard/replay 或库 V1.0 页面改版。
- 上述文件现有定向测试及最小新增测试。`homepage-v25-state.ts/.test.ts` 不属页面 owner 独占写；v3 另由 root 显式恢复 S 同票并接受，再让页面消费。F、shared types、metadata provider、schema、依赖、配置仍只读，除非另行授权。

建议接口表达语义，以下是**合同草图，不是新增产品实现或另一个状态模型**：

```ts
// 仍由 HomepageSession<{...真实bundle}> 拥有 ui + data。
onAttachmentDraft(next: HomepageAttachments): void; // editHomepageDraft
applyAttachments(): void;                         // beginHomepageApply(D)
clearAttachments(): void;                         // clear draft → 同一 apply
resetDefaults(): void;                            // reset draft → 同一 apply
cancelAttachments(): void;                        // cancel token，保 D，关闭由视图负责
refreshHomepage(): void;                          // read C，保 D
onScope(next: HomepageScope): void;                // identity，沿用现有入口
openTrades(identity: string | null): Promise<void>; // 已应用 URL + UI source + guard
```

read purpose 是 host/session 内部协议，组件不直接发 generation 或持有 data。identity→`changeHomepageIdentity`→begin；apply→begin(D)；refresh→begin(C)并保 D。bootstrap/return 用 URL 验证后的 scope 和可恢复 source 选择目标；source 附件必须纳入真正首页 target，不能先以空附件读再用旧 source 覆盖新状态。accepted 前外部 `onReadAccepted` 不得提交，过期 token 的任何外部 effect 不得覆盖刚接受 bundle。这里沿用 P1 的请求归属边界，不重做其历史诊断/验收。

真实目录只保存业务读模型，不进 S；建议结果字段至少 `instrumentId/fullIdentity/name/code/exchange/currency/assetType/identityReason`（缺值保持 null+reason），详情来源只带稳定 identity 与来源 container/trigger。普通库 intent 仍由 `homepageTradeUrl` 和 `homepageCollectionState` 生成，不从搜索列表索引或 holdings 第一行推断。

## 7. 可独立观察的反例与未来验收表

所有行当前 **NOT VERIFIED**，需要实施版本指纹后由 root 独立接受。纯 S/host 红测只证明纯状态边界；实际浏览器、持久化/reload、视觉各门不能互相替代。写入旅程必须使用 root 所有的隔离 DB；本准备任务不执行这些动作。

|编号 / 覆盖|最小反例 / 实际动作|必须观察 / 建议定向层|
|---|---|---|
|P3-01 / 07|非默认 market/account/period，打开/关闭 Search|范围、金额、附件、local query 均不变；回精确 Search trigger。组件+真实浏览器|
|P3-02 / 08|200ms 连续改词、中文 composition、多次 compositionend|只完整最后词在 300ms 后查询；旧 timer/迟到候选不覆盖；clear 后候选不复活。定时器+真实 IME 分开|
|P3-03 / 08|已知无匹配 / catalog 读失败 / 真空目录|三者文案和可用操作不同；不能失败伪装 0 结果；覆盖说明准确|
|P3-04 / 07,09|鼠标外点、Tab/ShiftTab、Enter/Arrow、Esc 各层|背景不可点/Tab；搜索外点关闭，详情外点不关闭；Esc 只退一层；精确焦点|
|P3-05 / 10|同代码不同 official exchange；同 exchange/code 不同 class；缺 exchange|结果身份直接可辨且命中正确 instrument；不 US/provider/最后一项/首行 fallback；缺证据解释|
|P3-06 / 09,10|metadata-only 或当前无持仓的真实目录标的→详情|真实标的详情可达；不复制持仓金额；数据未知原因与唯一主动作正确|
|P3-07 / 09,44–46|Search 词/scroll/selected→详情→ordinary→返回→reload|URL 全身份+范围；普通集合非首 episode，无 queue；真实重读后所有 UI 恢复|
|P3-08 / 09,31|返回时删除来源对象 / 身份失效|保仍有效 query/scroll/排序等；Search 回搜索标题，holdings 回持仓标题；明确通知|
|P3-09 / 53|复制 direct URL / reload，再提供不同 hpSource|目标集合仍由 URL；source 不改目标；非法具体账户/date/symbol 可见拒绝；'*' 通过|
|P3-10 / 10,44|A股范围搜索到 US；当前账户没有该标的|不偷偷换首页/目标范围；交易库真实空集合+范围原因；返回仍 A股/原账户|
|P3-11 / 11|D 改类别，Esc/外点，重开；自动 focus refresh|草稿保留、C/标签不变；refresh 只读 C、保 D；不是重新从 C 覆写 D|
|P3-12 / 11|D 待复盘只“否”；双选；全不选，各自重开|仅否确实排除 pending；双选/空均不过滤，但 checkbox 选择分别保留|
|P3-13 / 11|stock+etf OR，再叠 openOnly 与 pending 条件|同维 OR、跨维 AND；真实回合事实影响全页集合；未知类别不乱归类|
|P3-14 / 11|真零浮盈但 open；缺浮盈且 open；closed 有历史盈亏|openOnly 纳入前两类、排除 closed；不能按 unrealized!=0 / quote available 代替 open|
|P3-15 / 12,47–49|附件 Apply A→B，B 成功后 A 晚到；失败/15s/取消后晚到|只有有效 B 提交完整 UI+data+FX；旧响应不提交外部 bootstrap；旧 C 保留直到成功|
|P3-16 / 12|同一次 Apply 一条依赖读失败，其他成功|全部旧 C+B+标题/标签保留，D 可继续编辑；无半组刷新或假 0|
|P3-17 / 13|非默认 market/account/date/history+附件，清附加|仅附件清；日期/history/身份不变；不是只参数清了、数据没重算；0 集合如实显示|
|P3-18 / 13|同上恢复默认，注入失败，再 retry|默认第二行；日期不改；失败旧标题/数据保留；成功一次切 market/accounts/附件|
|P3-19 / 11|旧附件 D 未提交时切 market/account；旧请求晚到|关闭丢旧 D，仅 identity 成功后改标题；旧 token 失效|
|P3-20 / Token|点击删除单个 token，失败；删除最后一个成功|失败保 token/原焦点，成功后精准删除；最后回 Filter trigger；无重复隐形命中盒|
|P3-21 / S迁移|真实 v2 true/false → v3 roundtrip；v3仅否/双选；未知字段/版本|true→[true]、false→[]；不吞合法条件、不扩大；nested business 注入不序列化；requests 不恢复|
|P3-22 / 44–46|首页附件仅 pending/open/category，再进 ordinary|目标 URL 无隐含附件/queue，直接 URL 和来源导航集合相同；返回附件准确复原|
|P3-23 / 23,26|0/1/8/9/50 真实行，50 第7页；切筛选使页数缩小|8 槽和底边稳定，末页2；0 无1/1，1–8 disabled；数据变化页码合法|
|P3-24 / 28|持仓第3页中文局部词→单条→输入X清除|只表内筛，改词/清除回1；不打开 Search，不清全局附件/market/account/period|
|P3-25 / 29|完整 CNY 后金额排序；缺一个 FX/金额事实|已完整才能排序；缺依赖禁用+原因，不按显示缩写/混币排序；不改权威原值|
|P3-26 / 30|50条局部筛出>8，在第2页导出|CSV 为全部筛选行、全精度、正确身份；0 禁用并准确提示|
|P3-27 / 25,27|极长名/长值/真0/缺成本/缺价|全值 hover+focus 可读，行48不撑高；0 ≠ 暂无 ≠ 待更新；空态局部清除仅X|
|P3-28 / 23,24,公共控件|1440×1000 与1280×800@100%，普通/大额/C汇总|独立 reviewer 将真实截图与准确原图并排比较；列锚点、工具间距/密度、无挤压|
|P3-29 / 07,11,50|窄屏、search/filter open前/中/后，reduced-motion|舞台与320浮层可达、无底层误操作/布局位移；160ms/4px 与 reduced 最终态区分|
|P3-30 / 46,48|改变 period/history 域与 global 请求交错，再返回|域更新不互盖；四 history mode、双贡献分类/排序/页/drilldown/current.openOnly 全保留|
|P3-31 / 44,guard|详情离开或 browser back/forward 遇真实未保存 guard，取消/接受|取消后原 URL/页面/焦点/搜索上下文保留；接受才离开；真实 pop 时序由 root 浏览器验证|
|P3-32 / 附件四区|A/X pending、B/Y pending，A/Y与B/X非pending；混合已完成/deferred/缺episode|单一复合组资格不发生账号×标的泄漏；yes/no/unknown对；表现/持仓/历史/贡献同源对账，保完整费用/IPO历史|
|P3-33 / 53,期间|direct native custom/date→首页；选择全期间→ordinary→reload|初始期间标签与URL一致；显式all清from/to/date，不再fallback旧日期；market/accounts/附件/history保留|

鼠标、键盘、emulated touch、physical touch 证据分开；不得拿键盘测试签署物理触摸。按 `frontend-control-audit.md` 建本票完整条件实例清单，包含图标、搜索输入/X/结果/详情/退出、附件所有 checkbox/apply/clear/default/token、local search/sort/export/page 与受影响导航；每个实例绑定版本、输入方式、前后状态、功能/状态持久化/视觉证据。P1 既有持仓工具属于回归，不能通过换票名清除其历史 FAIL。

## 8. 派发前顺序与结论

1. root 先完成 P1 正式门槛，页面 owner 对正式 freeze 保持一致；本稿不替 P1 接受。
2. root 显式恢复 S 同票第2/3轮，按已裁定 A 做最小 v3 迁移及纯合同反例，独立接受后更新接口输入；原历史保留。
3. 按已裁定 category / pending group 语义和单一四区首页投影适配，不改 F 账本；一个页面 owner 先贯通 Search→无持仓真实详情→ordinary空/非空集合→返回，再扩展附件所有状态，维持持仓工具回归。URL period 初始化/显式all清日期、refresh 保附件/草稿属于同一合同门槛。
4. root 以版本绑定的实际功能、真实数据/持久化/返回/reload、独立视觉/控件审计分别接受，任一 FAIL/NV 保留并阻断交付。

当前仅完成派发前合同；**P3 仍 0/3 BLOCKED，产品实现/真实浏览器/数据持久化/视觉/正式接受均 NOT VERIFIED。**
