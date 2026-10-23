# P1 派发前复核补充

日期：2026-10-23。owner：`/root/integration_g61`。本文件只补准备证据；不领取 P1、不写产品、不启动服务、不访问数据库、不做 P2–P4。原诊断、历史失败和 0/3 独立验收计数保留。

## 1. 新契约与任务票的完整阅读

已完整读取 root 新建的 [visual-contract.md](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/visual-contract.md) 和 [04-holdings-journey.md](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/issues/04-holdings-journey.md)，并逐条对照已完整阅读的 V2.5 正文、控件手册及 A 的 P1 旅程。认可唯一整页实现 owner、root 独立三门槛、真实第一旅程先过、有限 metadata 边界和禁止提前 P2–P4 的约束。未发现需要删减批准交互、视觉或更换参考图才能实施的理由。

批准原图已在首次诊断实际看图；本次增加的是源合同复核，不把源图阅读当产品截图。两宽、C 汇总、8 槽、行高、数字字形右缘、详情返回等仍按新视觉契约执行。控件手册 :105 的 176px 账户宽度、正文 :117/:128 与 root 契约一致；手册账户章节沿用的 180px 八态尺寸字样不能反向覆盖页头明确的 176px。

## 2. S 新报告目前的可用性

本次已完整阅读 [S-debug/ROOT-CAUSE.md](/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/S-debug/ROOT-CAUSE.md)。该报告支持已确认根因：提交、快照、编码/解码与 URL 没有共用规范化 UI 模型；需要 v2 单一 committed authority、全层 UI 白名单、完整历史/贡献状态、独立请求域与目录语义校验。

2026-10-23 00:38 CST 检索 `S-fix/` 只发现 RED、green-initial、run-checks 等过程证据，尚无新的 `INTERFACES.md` 或实现交付报告。`green-initial.json` 的退出码为 0，但不构成 S 接受，不据其旧/未冻结字段提前写 UI。新的 S 接口报告和 root 独立接受仍为正式 P1 派发的前置；本文件末尾保留待核清单。

## 3. 精确 metadata 边界复核

新增 optional exchange 证据必须经同一 owner 贯穿 **provider → validator → resolve result → repository/HTTP → SQLite metadata_json → bootstrap → 首页 identity adapter → URL/详情**。普通 `US:code` 仍只表示市场与代码，不能伪装交易所身份。没有证据的现有记录保持明确不可解析及原因，不硬编码补足图稿。

|文件/函数|已核实边界|必要动作与限制|
|---|---|---|
|`app/lib/instruments/metadata-contracts.ts`，`ResolvedInstrument` / `validateResolvedInstrument` (:35/:118)|当前没有 exchange；validator 显式重建返回值，会剥新字段|optional 有验证的证据字段；旧记录仍合法；拒绝不匹配市场/代码、非法来源、不可用交易所值。证据来源/时间不能借父记录的新时间凭空更新。配同名测试。|
|`providers/sec-company-tickers.ts`，`parseSecCompanyTickers` (:30)|实际读取官方 `fields.exchange`，验证非空，在创建结果时丢失|保留该行真实值及来源；不能因 source=sec 推断某所。官方响应缺字段/未知值明确不可解析。|
|`providers/nasdaq-directory.ts`，`addNasdaqRows` / `parseNasdaqDirectories` (:163/:195)|nasdaqlisted 和 otherlisted 使用同一构造器；provider=nasdaq 不能区分交易所|保留目录种类和行证据；otherlisted 使用该行 Exchange，映射必须有官方依据，不能从测试 fixture 发明；nasdaqlisted 目录成员证据与 provider 名称分开。配 `metadata-providers.test.ts`。|
|`app/lib/instruments/resolve-service.ts`，`resolveInstrumentMetadataBatch` (:183/:275/:299)|缓存旧记录进 resolved；新响应仅合并 localizedName，repository.put 后又 `resolved.set(..., record)`|**任务票初版少列此层。root 已在本次消息中明确批准该文件及 `resolve-service.test.ts`**，仅可信 optional exchange 的保留/冲突政策。新记录缺 exchange 不删除旧可信证据；在内存结果和持久记录一致。不得改 TTL、并发、请求、路由。|
|`app/lib/storage/sqlite-store.ts`，`putInstrumentMetadata` (:1051)|`newestByResolvedAt` 按整个记录选新者；当前只有 localizedName 独立合并|仅 optional metadata 的校验与保留/冲突规则；已有 metadata_json，无新业务表或 schema。新缺字段不能擦除旧可信。配现有 store 测试。|
|`app/lib/storage/indexeddb-instrument-metadata-repository.ts`，`resolvedInstrument` / `put` (:16/:92)|文件明确 MIGRATION-ONLY；读取显式投影会丢新字段，写入 spread 后整条覆盖|只保证历史迁移/导出测试兼容及 optional 字段保留；不恢复为运行时业务存储，不新增迁移机制。配同名测试。|
|`app/api/storage/instruments/metadata/route.ts`，`parseMetadata` / PUT / GET (:35/:66/:52)|生产路由复用 validator 与 store，无独立字段白名单|当前无需生产路由改动，新增 `route.test.ts` 的 PUT→GET 验证即可；若后续证据显示必须改生产文件先报告 root，不能自行扩边。|
|`app/lib/storage/instrument-metadata-repository.ts` / `sqlite-contracts.ts` / `sqlite-http-client.ts`|metadata 类型经 ResolvedInstrument 继承；HTTP 客户端按响应传递；`StoredInstrument.metadata` 已有类型|目前无需修改；bootstrap/readback 必须验证，不能因类型可传便宣称已连通。|
|`app/components/trade-review-workspace.tsx`，`instrumentMetadata` (:1565) 与新增 `homepage-v25/**` adapter|旧 TradingRoomMetadataInput 只服务原用途，不足以传完整 exchange 证据|用新首页有限适配读取完整 StoredInstrument metadata；不改旧 dashboard/holdings；CN-SH/CN-SZ/HK 仅从明确市场证据解析，US 无证据仍缺失。|

冲突政策需要在实现前以用例写清：同市场同代码是前提；新缺字段保留旧可信；两条可信 exchange 冲突按已验证的来源与各自证据时间判定，无法比较则显式冲突/不可解析，不能以整个 metadata 的 resolvedAt 当交易所证据新鲜度。失效/矛盾证据不能因“保留旧字段”无限恢复为有效。具体 optional 数据形状由 owner 在上述范围选择，必须保留足够 provenance；无需建立第二套证券主数据系统。

必须覆盖的回归链：可信旧记录→不含 exchange 的新响应→当前结果仍可信→repository 重读仍可信→reload/bootstrap 仍可信；另测合法可信更新、矛盾证据、坏字段、旧无字段记录、provider/US 不能充当 exchange。证券类别来源同样不能猜；BRK 类代码现有 canonical 规则保留，不从公司名称推断 share class。

## 4. 实际控件清单的补差

详细准备清单见 [P1-CONTROL-INVENTORY-DRAFT.md](P1-CONTROL-INVENTORY-DRAFT.md)。它补充 A 清单和任务票，不替代 55 项矩阵或 96 公共状态分母；全部运行时状态仍 NOT VERIFIED。

1. **市值排序必须单列。** A 的 P1 逐操作表只有名称和浮盈排序，但正文 :297–299 明确市值和浮盈在完整 CNY 换算后可排序。名称排序保留 A 已接受范围；三种各自方向、箭头、可访问名称、页码重置、FX 禁用原因均登记。未知/缺 FX 不排序成零。
2. **账户选择不能只验正常值。** 手册账户 :345–370 要求加载保当前值、错误保原因并经全局修复、空账户提供“导入账户”下一步。须接现有数据管理/导入入口，验证切换后返回，不增加第二套导入业务。176px 触发器/浮层、选项全名、键盘开关/方向键/Enter/Esc 都有实例。
3. **局部查询各动作为单独实例。** 工具栏搜索入口若存在，要真正呈现内联输入；输入、IME、清除 X、debounce、失焦、无匹配不能折成一个“搜索 PASS”。无匹配仅 X 清空，不增正文按钮；不复用 P3 全局遮罩。
4. **分页与导出不能只测第1页。** 0 条不画可操作箭头/伪页码；1–8 双向禁用；9 与 50 验末页空槽、边界、排序/查询后回第1页。导出全筛选结果、真实精度与 CSV 文本安全，0 条明确禁用。只读页码、计数、C 汇总不误算按钮。
5. **行控件实例键要升级。** A 原清单 `ROW-DETAIL:{instrumentId}` 不能区分同证券多账户/episode；采用 `instrumentId+accountId+episodeId`，详情明确账户。保留唯一前进动作；关闭按钮、Esc、外点不关、Tab 约束与返回焦点分别验。
6. **普通库和既有复盘也在必要上游/下游审计里。** 来源返回、原库条件、选择回合、真实保存、返回、guard 确认/取消，以及浏览器 back/forward/reload 都必须列；只验 home DOM 不证明旅程。
7. **所有条件恢复/错误动作按实际渲染展开。** 全局一键修复、错误说明的 focus/Esc、URL 纠错/清理入口、对象消失 fallback、未知身份说明等应登记；没有渲染的入口不虚构。有多处错误不产生每卡重试或多个全局修复。

## 5. 首张页面和分阶段范围

P1 的实际可用范围是 root 票规定的 shell、市场/账户、真实持仓、详情、普通库与完整返回。P2 当前表现、P3 全局搜索/筛选、P4 历史/贡献尚未实现；其设计位置和最终状态分母保留。首张真实页面立刻交 root 两宽截图作进行中布局审查，不能把未实现区域填假金额/假图或宣称整页通过。

页头搜索/筛选及 P2/P4 控件是批准设计的一部分，但不因 shell 出现便被写成 P1 PASS。若第一张进行中截图呈现其占位/未完成功能，证据要显式标注对应 deferred/NOT VERIFIED，不能以 noop、隐去、伪禁用替代最终合同。正式 P1 交付前 owner 与 root 确认本轮实际渲染边界；不能为“所有已渲染控件 PASS”擅自提前实施 P3/P4，也不能把整个项目分母缩成持仓子集。最终整页只在 P5 全功能独立验证后接受。

第一条可接受主旅程仍为：真实 live/account+episode 的固定 8 槽→非默认局部条件打开准确详情→唯一查看交易→ordinary `/trades` 对应证券集合、execution 日期包含 open→显式返回/原生后退/直接刷新恢复 URL 和完整 UI 来源→重新读业务数据→原触发焦点或标题 fallback。其后再加边界、既有保存/guard、故障乱序和两宽视觉对照；root 接受首旅程前不扩 P2–P4。

## 6. S 正式交付后仅需补的接口核对

- 新 `INTERFACES.md` 与实现报告完整阅读，记录源码/test hash 和 root 的独立接受版本；不把 green-initial 当交付。
- 唯一 snapshot v2 authority 与 derived applied、create/restore、UI action/patch 入口、scope/attachments 的唯一位置。
- holdings.sort 是否含名称/市值/浮盈及方向；8 行页码、query 与精确 source trigger identity 的表示；UI 不靠不受控 spread 另存状态。
- current-period/history 独立请求域及 global generation；完整 key、终态、15 秒超时、乱序、错误保已应用范围。P1 只消费必要域，保留其他已提交 UI 字段，不实施其页面交互。
- history.range 四语义+chartMode；contribution current/history 分别分类/排序/page/drill/current.openOnly；source 完整往返，v1 reject 的明确恢复信息。
- URL 语法与目录 ready 后语义两阶段；`accounts=*` sentinel 与具体 IDs；可信 symbolIdentity 格式不能再次把 US 当交易所；URL 目标优先于来源。
- 浏览器 storage 容错、hydration 写入时机、source token 生命周期、DOM scroll/focus 和实际业务重读仍由 P1 owner 接线，并由 root 在独立库直接验；S 纯模块接受不代替这些证据。

当前结论：准备差距已明确；**产品未实施，等待 S 报告/接受与 root 正式 P1 派发**。
