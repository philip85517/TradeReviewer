# VIEW-MODEL-04 独立审查

日期：2026-10-31。审查对象：候选稿与三份 2026-10-31 证据稿，工作树 `/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview`，代码基点 `b49b17066fab4bea7270082ce07c7dfdfa9cc7d1`。候选稿和本轮证据在该工作树中为未提交文件；结论针对审查时磁盘内容。

审查范围为首页、交易库、复盘、导入的控件/数据映射、现有与候选模型边界、行粒度/聚合、财务和时间语义、异步读写、视觉引用及性能声明。只读文档和源码定位证据；未打开业务数据库、运行产品/UI 或重新执行实验。因此以下是候选设计的缺口，不是对当前线上/本地运行行为的缺陷判定。

## 结论

候选稿正确地把自己标为“候选”，没有把一秒目标、旧预处理实验或逻辑对象冒充为已实施/已验收方案；也覆盖了可追溯事实、共享结果、页面读取结果、失败状态、分页范围和恢复的基本方向。逐控件证据已有首页 H-01–H-32、交易库 T-01–T-19、复盘 E01–E22 和导入 I01–I17 的广度。

但候选稿目前还不能作为已完成的数据模型审查稿：控件证据大多是逻辑需求，没有逐项落到当前持久字段与候选读取/聚合字段；候选表行粒度和跨账户/模拟运行关系仍有混合；财务、回放时点及异步发布约束没有具体到足以证明不会错算、串数据或泄露未来。建议保留候选状态，补完下列 P1 后再做模型冻结。不得把这些缺口改写成已确认业务规则；未定的业务口径应保留为显式决策项。

## 问题

### Q01 — P1：控件证据尚未形成“现有字段 → 候选字段 → 读结果”的逐项交叉表

**判断：已确认的文档缺口。** 候选稿 §4 用首页/交易库/复盘/导入的页面区域归纳需求，并引用逐项证据；§5 再列出通用候选对象，但没有为 H/T/E/I 每项控件注明哪些是当前已持久化字段、哪些缺失/仅临时状态、哪个中间结果或聚合负责提供它。

**具体例子：** H-08 的期间指标、H-10/11 日曲线、H-20/21 历史统计、T-13 趋势与 T-15/16 分布桶，需区分不同时间基准、分母和可算性；候选对象中只有笼统的“时间序列结果”和“页面摘要/列表索引”。E01–E22 与 I01–I17 的映射同样未连接到候选对象字段。候选稿称逐控件证据包含“字段及证据”，但首页/交易库证据明确说来源是逻辑事实来源、不是现有表/API；因此不能据此宣称已映射到预存字段。

**证据：** [候选稿 §4 的区域级表及逐控件证据引用](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:57>)、[候选对象表](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:81>)；[首页/交易库证据对“逻辑来源”的限定](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:35>)；[现有持久字段与表粒度](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:21>)；[复盘/导入逐项投影需求](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:109>)。

**建议：** 增加可反查矩阵，至少含控件/状态 ID、批准依据、当前源表/字段或“当前不存在/仅前端草稿”、候选实体及键、派生表达式/过滤与排序粒度、聚合分母/页范围、版本依赖、未知/缺失状态。一个候件可以服务多个控件，不能按控件复制整表。把“需求已取证”与“现字段已核实”分列。

### Q02 — P1：异步发布的输入版本边界不足以防止旧结果覆盖或新旧数据混读

**判断：候选契约欠具体，存在设计风险；不是已复现的并发缺陷。** §6 提出事务写事实和待处理记录、异步计算、输入变化检查、原子切换“相容版本”，但没有定义“输入变化”的完整版本向量、比较/CAS 点、输出发布资格及读请求如何绑定同一 publication。仅检查成交簿版本不足以覆盖首页依赖。

**具体例子：** 当前源码中的 `BookVersion` 含数据库身份/epoch/sequence；其触发覆盖不包括名称元数据、行情、FX 设置和复盘内容。首页实际分别取得成交来源、FX 和行情。若后台计算仅凭成交版本发布，过程中更新的报价、汇率或名称/复盘可能使摘要、表行和详情不一致。候选稿也未明确保存回执成功但投影未就绪、请求结果未知、重试幂等、失效游标/旧完整结果标记等状态的接口契约。

**证据：** [候选流程与发布步骤](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:105>)、[当前成交簿版本的覆盖边界](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:42>)、[首页多来源取得及各自版本限制](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:67>)、[现有保存回执与 saved-awaiting-read 状态](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:57>)。

**建议：** 写明 publication 的依赖向量及其变更来源，至少覆盖数据库身份/epoch、成交与来源/撤回、标的展示、行情/FX、复盘、计算规则/代码/schema、选择范围/报告币种/as-of。定义复制输入、锁外计算、发布 CAS、旧任务拒绝/重排队、同快照读取、游标失效和 ready/stale/pending 的用户可见语义。若采用异步任务，明确 dirty/outbox 与重试幂等；将“事实已保存”与“新读模型可用”区分。保留现有请求 ID/回执语义。

### Q03 — P1：财务聚合的时间基准、公式、精度与不可算分母仍过于抽象

**判断：有充分依据的设计缺口，部分业务规则确实待定。** 候选稿说明不能把未知当零，并将金额/区间口径列为待审，这是正确的；但通用字段“时间、指标、完整性”及“结果按范围汇总”不足以区分目前明确的各类指标，也不足以在未决项解决前保护原始事实。

**具体例子：** 首页期间净盈亏须为期间已实现 + 期末浮盈 − 期初浮盈；历史已平仓按平仓日，当前持仓是最新截面；日曲线同时含期间与累计读数。交易库列表按成交日、实盘统计按平仓日、模拟统计按练习保存日；分布分母是全部有效闭合回合，缺失输入不能伪装成净零。复盘还有冻结的 R0、费用分摊和币种换算规则。候选稿仅用“回合结果”“时间序列”“聚合按账户/证券/时间”等概括，未给投影所需来源值、公式版本、币种/汇率方向与 as-of、覆盖计数或 null reason。`TEXT`/decimal 精度和舍入也未写入逻辑字段合同。

**证据：** [候选稿的通用时间序列和聚合说明](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:90>)、[候选稿待定的曲线/金额/统计口径](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:130>)；[首页/交易库不同时间语义和金额资格](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:25>)、[首页指标公式及当前/历史拆分](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:46>)、[交易库日期、分母与缺失约束](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:61>)、[复盘精度/费用/FX 规则](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-25-chart-first-review-ui.md:154>)。

**建议：** 对 H/T/E 每个指标定义独立逻辑输出（grain、dateBasis、currency、value/partial/total validity、coverage、missing reason、公式版本、source/as-of），注明可相加字段和禁止相加字段。已有批准公式可明确记录；未决定的 FX 日、成本与收益率分母只列待裁决并保留足够原始输入，不预先物化成单一 PnL。基于 `round` 的统计需定义哪些回合进入总数、有效数和分布分母。

### Q04 — P1：复盘防未来泄漏的字段与状态转移契约还不够明确

**判断：候选稿部分提到双截止与不泄露未来，但不足以落实为可验证模型。** §4 写了“当前回放截止”，§5 有可见时间和数据版本，§6 的市场/成交截止分别保存是正确方向；不过候选实体没有逐项定义阶段、两个游标、已完成 bar、知识时间、source 时间精度、决策稳定顺序、`hasSeenFuture` 来源以及快照原子绑定。

**具体例子：** 日期精度只有 date-only 的来源文件可能包含同日多个 pair；已经知道某笔成交，并不意味着当前周期未完成 K 可显示。切周期、拖动视野、开关侧栏不推进成交游标；下一决策与逐 bar 播放有不同的执行游标/Text 归属规则。回看事前阶段不得带回最终结果；用户看过后续后补记不得伪装为盲态。候选稿笼统的 `visible time` 与单一“当前回放截止”不能保证这些区别。

**证据：** [候选复盘对象和通用可见时间字段](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:93>)、[候选稿的回放需求概述](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:65>)；[复盘逐元素时间可见性](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:30>)、[动作级双截止与持久投影要求](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:54>)；[批准规格：独立行情/成交游标及完成 K 线边界](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-25-chart-first-review-ui.md:114>)、[批准规格：未来信息限制与阶段回看](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-25-chart-first-review-ui.md:118>)。

**建议：** 给回合/决策/快照读上下文建立状态表：phase、market cutoff、execution cutoff、bar completion/version/timezone/adjustment、source precision/knownAt、稳定事件排序、Text ownership、hasSeenFuture 与来源、当前 view/viewport。逐行动作写哪些字段会变化/不变，并把阶段成果、决策列表、行情/成交及计划修订绑定到不可变快照版本。不能只用 UI phase 或单个时间戳代替双游标。

### Q05 — P1：导入模型粒度不足以承载来源行证据、审核选择与真实提交结果

**判断：已确认的候选模型覆盖缺口。** §5 将“导入批次与来源材料”合成一行语义（一次导入**或**一份来源材料版本），且仅列标识、来源、文件指纹、状态、时间；没有为来源原始行/字段证据、解析观察、身份待确认、冲突/撤回、服务端审核选择和实际提交回执定义候选关联。

**具体例子：** 文件/图片 batch、material/version、source row/observation、规范 execution、TradingView pair/round/practice 不是同一粒度；旧整文件指纹不等于完整来源比对。月结单的库存/辅助证据可能零新增成交但仍需写入；截图 OCR 草稿可以只在浏览器内，确认后的证据必须可追溯；预览重复计数不能替代服务器实际提交结果。当前源码已存在材料版本、来源观察/成交链接、事实撤回状态和 plan/receipt 等不同表，但候选稿没有说明哪些复用、哪些新增或如何映射。

**证据：** [候选导入对象定义](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:84>)、[候选成交/修订对象定义](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:85>)；[当前材料、观察、链接、撤回和计划/回执粒度](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:26>)、[来源材料与成交并非同一实体](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:27>)；[导入 I02–I14 所需数据和写入语义](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:92>)、[导入粒度/计数边界](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:116>)。

**建议：** 把 material、material version、batch、source observation/raw row、规范 execution/revision、pair/report metric、server plan/choice、commit receipt/completion evidence 分开定义身份和生命周期，并加来源-specific 约束。明确 browser-only draft 与服务端持久证据的边界；计数分别保留 source rows/pairs/executions/rounds/practices、候选/实际新增/修订/重复/排除/未解决。逐项链接 I01–I17，避免通用“重复数”覆盖各来源规则。

### Q06 — P1：候选对象把不同自然键/生命周期混在一起，回合键漏掉模拟运行维度

**判断：已确认的粒度定义问题，实际错误合并尚未验证。** 候选表有多处用“X 或 Y”定义一行，包括“一个账户或一个证券”“一次导入或一个材料版本”“一笔成交或一次修订”。另将回合写为账户、证券、交易性质及规则下的回合，但没有明确模拟 `simulation_run_id` / `practice_id` / 配对成交关联、币种及未平仓余量如何构成稳定键。

**具体例子：** 当前存储的 `executions.account` 是可空文本字段，并有 separate source-account mapping；证据没有发现通用账户主表。`execution` 还有 `simulation_run_id`。同标的、同日可属于不同练习/运行，交易库要求每个练习独立且按最近开仓优先配对；live 的“回合”算法仍未定。若按名称、账户文本、symbol+date 或单个 round rule 合并，可能串账户/练习并污染盈亏与复盘关联。

**证据：** [候选对象的混合行粒度](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:83>)、[候选回合和练习关系](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:88>)；[当前 execution/source-account/simulation 字段与无通用账户表边界](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:24>)、[练习/回合身份的批准规则及 live 未决](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:84>)、[领域冲突待定](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:122>)。

**建议：** 拆开账户 principal、证券、batch/material/version、execution/revision 等实体定义；每个对象给一个明确的 row grain、稳定 ID、唯一性范围、删除/撤回/修订语义。为回合分开定义 live 与模拟规则；在业务规则确认前至少保存并传播 `account/scope + tradeNature + simulationRun/practice + execution IDs + settlement currency + ruleVersion`，禁止以 display name 或日期作身份键。

### Q07 — P2：导入视觉引用标签与已确认视觉范围不一致

**判断：已确认的引用问题。** 候选稿把 `2026-09-07-tradingview-simulated-trade-import.md` 标作“截图导入功能规格”。该文件是 TradingView 模拟交易导入规格，并不是截图导入视觉稿；证据稿也明确表示没有统一的导入页、材料版本、服务器审核、撤回恢复视觉合同。

**证据：** [候选视觉依据表的导入行](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:31>)；[证据稿对已批准导入来源及缺少统一视觉稿的说明](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:14>)、[具体导入审核链视觉缺口](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:124>)。

**建议：** 修正文案链接为其真实来源类型；明确导入功能规格只能证明相应业务流程，不证明界面视觉。把“无统一批准视觉稿”列为设计缺口，依据各来源已有图稿/明确批准规格并标明适用范围；不要以当前组件代码补成已批准设计。

### Q08 — P2：一秒目标的证据状态应直接保留已知失败与未验证项

**判断：候选稿表述审慎但信息不完整。** §1、§6 已声明性能不是已证明结果，且要求冷/热/重启、导入修订后分别测量；不过没有在候选稿里明确引用真实规模 measurement-06 的整次 `FAIL`、measurement-07 仅 synthetic finalization `PASS`、真实规模仍 `NOT VERIFIED`。如果读者只看候选稿，容易把“已有实验不包含完整财务和浏览器”理解成只是覆盖不全，而不是已经有一次真实规模尝试失败。

**证据：** [候选稿一秒目标与资格限制](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:20>)、[候选验收边界](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:126>)；[measurement-06/07 明确状态及其边界](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:90>)。

**建议：** 在性能目标旁补充当前资格状态：完整产品一秒目标 `NOT VERIFIED`；真实规模 measurement-06 `FAIL`，measurement-07 只修复合成记录闭合、没有覆盖真实规模；不得把局部预计算 PASS 升级为产品目标通过。说明端到端计时边界与样本/冷暖条件，留待后续实验验收。

## 未发现/已正确处理的边界

- 候选稿开头与 §3 明确是逻辑对象，不是现有 SQL、迁移或性能通过；本报告没有将其称作已实施。[候选状态声明](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:3>)、[逻辑名称说明](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:47>)。
- 候选稿指出历史预处理实验不够证明完整页面一秒，且要求服务端数据完整、旧结果 stale 与异步未就绪分开；方向正确，只需按 Q02/Q08 补足具体合同和证据状态。
- 首页与交易库证据保留了旧徽章/筛选图滞后、统计口径和控件默认未定等冲突，没有把旧图机械升级为产品规则；这些未决点应继续单列。

## 放行建议

审查结论：**候选方向可继续；完整性审查未通过（P1 未解决）**。先完成 Q01–Q06 的模型字段/粒度/时间/发布映射，并修正 Q07–Q08 的引用与性能状态，再由独立读者复核候选稿和关联矩阵。此结论不要求运行 UI 或数据库，也不代表任何当前实现已通过或失败。
