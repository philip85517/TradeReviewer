# VIEW-MODEL-04 第二轮独立复核

日期：2026-10-31。审查对象：当前版 docs/backend-design/view-driven-data-model.candidate.md 及三份证据稿。重点复核首轮 Q02–Q08；Q01 逐控件映射由另一位审查者负责，本轮不等待或替代。仅只读审查文档与源码定位；未查业务数据库、运行 UI、重跑并发/性能实验。

## 结论

主稿已实质回应首轮意见：更清楚地写了依赖版本、CAS、回放双截止、导入对象生命周期和真实规模性能资格。Q07、Q08 在文档层已修；Q02 的逻辑合同已修，但实现依赖登记尚未落到当前写入口；Q03–Q06 部分修复，仍有页面字段缺项、已批准规则和未决规则未完全分层、详细粒度表不一致等问题。

仍不能声称首页/交易库/复盘/导入每项控件已映射到持久字段。主稿 §4 是页面区域级推导；证据稿也限定其中部分是逻辑需求而非现有表/API。Q01 的矩阵完成后仍需独立复核。

## 首轮问题状态

### Q02 — 部分修复：发布版本边界明确，真实写入口与依赖版本尚未逐一对应

**已修：** 候选 §6 要求事实、版本变化和待处理记录同库事务提交；计算绑定输入版本；发布事务比较完整依赖向量并原子切换；不匹配则拒绝旧任务并重排；读请求固定同一发布版本。§6.192 已列数据库身份/恢复代次、成交/来源/撤回、证券展示、行情、FX、复盘、规则/代码/结果结构、范围/币种/业务时点/可知边界。保存成功和读模型就绪、超时未知和重试也分开。

**未修/未证明：** §6.192 仍只要求“每类变化明确负责入口”，未列当前哪些名称、行情、FX/settings、复盘写入口各自递增什么版本并投递什么 dirty 范围。跨来源行情/FX 如何生成可重读的一致快照 ID 与知识边界也未定。现有代码证据显示这些数据分开写；现有合成增量实验未覆盖完整依赖向量、异步 prepared swap、崩溃或并发。因此候选合同尚不能证明实现层 CAS/outbox 完整。

**证据：** [候选 §6 发布流程](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:183>)、[依赖向量](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:192>)；[当前版本触发器边界](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:44>)、[独立写入口](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:61>)、[实验未覆盖项](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:87>)。

**可执行改进：** 加来源登记表：每个写入口/表 → revision 或内容 digest → dirty 范围/最早影响时点 → 读模型依赖版本；外部行情/FX 指定可重读快照 ID、来源版本、asOf/knownAt。实现验收注入“计算期间各依赖分别变化、服务重启、任务重复、CAS 失败、页游标遇版本切换”。

### Q03 — 部分修复：核心财务公式明确，日曲线和收益分布仍缺字段级口径

**已修：** §5.1/5.2 明确期间净盈亏公式、历史胜率分子/分母、平仓日/模拟保存日等日期类别、覆盖与缺失原因、币种与适用时点、十进制精度与舍入要求。§5.153 明确胜率/分布回合数及比例可加性边界，避免以 null 当零；历史价格和 FX 时点仍明确待决。

**未修/仍待决：**
- 首页 H-10/H-11 同时存在当日/期间净额、累计读数、真零、无回合、非交易日、缺行情/FX、未来点。候选 §5.60/151 未定义独立 metric ID、累计起点、业务日截止及各状态对应的 tooltip/序列字段；不能以一个 net 字段同时提供期间值和累计值。
- 交易库收益率/金额分布未列收益率分母、桶上下界/边界归属、空头或零成本、金额缺失时的回合数与占比分母资格。§5.153 的“有效闭合回合”不能替代“该指标可计算回合”定义。
- 历史 FX、收盘/复权价、成本/费用分摊、live 闭合回合规则、空头市值展示仍是明确待定项。保留待决是正确的，但相应预计算不得先固化唯一答案。

**证据：** [候选 §4、§5.1–5.2](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:60>)；[首页曲线 G-06](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:105>)、[FX/价格/成本 G-10](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:109>)、[收益率/桶/分母 G-12](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:111>)、[批准的分布规则](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:61>)。

**可执行改进：** 指标契约增加 metricId、formulaVersion、dateBasis、bucket grain/bounds/inclusivity、分子/分母资格、coverage、missingReason、source/asOf。为 H-10/H-11 分开列当日值、范围期间净额、范围起点累计，并说明 tooltip 字段。已批准口径写入；未决 FX、bucket、收益率分母和 live 配对单列决策，阻止相关汇总冻结。

### Q04 — 部分修复：双截止与防未来字段已较完整，低精度成交的游标推进仍不够可执行

**已修：** §5.3 列 phase、market/execution cutoff、已完成 bar、source precision/known time、decision order、hasSeenFuture 及哪些 UI 动作不推进截止；快照绑定双截止与版本。满足了从单一回放时间戳拆分的首轮要求。

**未修/未证明：** §5.166/167 对逐 bar 时成交截止“按批准规则独立推进”和下一决策“推进到对应边界”仍引用性较强，没有明确同一完成 bar 多决策、date-only 同日多个 pair、成交已知但本周期 K 未完成时，cursor 按什么稳定键推进或何时必须停在不确定状态。证据要求低精度源保留 order-only/ambiguous，不能从数组顺序推造先后。§5.171 将 occurred/known/snapshot 时间说成不同字段，但未给每个字段的职责/精确边界表；当前文档也不能证明真实图上确实揭示目标 bar/trade 或不泄露未来。

**证据：** [候选双截止动作表](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:163>)、[候选 snapshot 字段摘要](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:171>)；[E07/E08/E19 时间与 Text](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:30>)、[低精度来源/推进约束](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:54>)、[正式完成 K 线规则](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/specs/2026-09-25-chart-first-review-ui.md:114>)。

**可执行改进：** 补逐状态转移表：phase、marketCursor、executionCursor、barVersion/completedAt、sourcePrecision/orderStatus、eventKnownAt、textOwner、hasSeenFuture；逐一说明动作改变项与不变项。仅在来源可证明顺序时推进到 event ID，否则显示不确定并依规格停留/提示。

### Q05 — 部分修复：主对象拆分，附表重新合并且来源证据字段未完整定义

**已修：** §5.85–105 分别提出 batch、material/version、source observation、审核计划/回执、成交事实、修订撤回；说明预览和实际结果分开，按 source rows/pairs/executions/rounds/practices 统计；也说明截图草稿只在浏览器暂存。

**未修：** 详细表 §5.129–130 又合并“导入批次及来源行”，没有明确 batch/material version/observation 的外键、locator 唯一范围和关联；§5.88 把审核计划、选择与提交回执放在一行，虽然写各自独立 ID，但没有 plan digest/version 到 choices、receipt effects 的关联字段。截图证据需要逐字段 OCR raw text/confidence/bounds/crop ref/人工确认；“原始字段、解析结果与诊断”不足以证明这些保留。月结单还需可追溯 row/page、原时区、opening/closing inventory、corporate action/aux kind、费用分摊和守恒。候选只在原则层承认辅助证据，无法从字段模型检查来源审核控件。

**证据：** [候选主对象](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:85>)、[详细表](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:125>)；[当前材料/观察/链接粒度](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:27>)、[I06–I10](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:96>)、[I13/I14计划与回执](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:103>)。

**可执行改进：** 详细表为 batch、material、material_version、source_observation、server_plan、plan_choice、commit_receipt、receipt_effect/completion evidence 分别给 row grain/FK/版本/不可变与撤回规则。添加 screenshot OCR 字段级证据合同；添加 statement snapshot/aux evidence 类型、时间区与是否参与统计的约束。

### Q06 — 部分修复：核心身份维度补齐，但已批准的模拟配对规则未写入候选算法

**已修：** §5 主表已拆账户、证券、批次、材料版本、来源观察；回合含 account/nature/simulation run/practice/currency/rule version；持仓含账户/证券/性质/run/币种；禁止用名称/日期当身份并把跨账户合并留到读取规则。

**未修：** §5.132 将练习与 simulationRun 映射待定，§5.133 又把实盘/模拟配对口径整体留待确认。但交易库 V1.0 已批准模拟最近开仓优先规则：先买100、再买50、卖80，配50和30为两份有效配对回合，剩70开放。需区分已批准配对算法与 TradingView 源文件到 account/practice/run 的身份映射待证；候选目前可能让读者以为模拟算法也未定。Live 算法确属未决，不能从模拟规则推导。练习的稳定服务端 ID 也未在详细表定义唯一键来源。

**证据：** [主候选练习/回合行](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:93>)、[详细表](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:132>)；[批准 LIFO 规则与余量例](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md:49>)；[账户/run/practice 待映射差异](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:122>)。

**可执行改进：** 将模拟 LIFO 算法与版本直接写入候选合同及反例；单列待决的源文件到账户/practice/run 稳定映射和 live round 算法。配对关联至少保存 execution ID、配对数量/角色/序号、ruleVersion 和余量状态。

### Q07 — 已修（设计层）：导入功能规格不再充当统一视觉稿

§2.31 标为 TradingView 导入功能规格，并明确没有统一批准的导入页视觉稿；与证据稿一致。此项可从首轮问题清单关闭，但不表示导入页面视觉验收通过。

证据：[候选视觉依据表](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:31>)、[视觉缺口](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:124>)。

### Q08 — 已修（设计层）：真实规模 FAIL 与 NOT VERIFIED 状态明确

§1.20 写明完整产品一秒目标 NOT VERIFIED、measurement-06 真实规模整次 FAIL、measurement-07 仅合成记录收尾修复；§7.219 要求隔离库和端到端分阶段计时。状态符合证据，可关闭首轮文案问题。未重跑实验，仍不能据此证明产品达标。

证据：[候选性能状态](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:20>)、[measurement 状态](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:90>)。

## 页面字段遗漏与口径冲突（供 Q01 矩阵复核）

| 页面/控件 | 当前候选不足或冲突 | 最低可执行补充 |
| --- | --- | --- |
| 首页 H-10/H-11 曲线与 hover | 当日值、期间净额、累计值和累计起点未映射到独立 metric ID；点级真零、无回合、非交易日、缺行情/FX、未来状态也未落字段。可能误用一个 net 字段。 | 各序列列 formula/dateBasis/grain/asOf/tooltip 字段；期间、当日、范围累计互相独立；每点 coverage/missingReason。 |
| 首页 H-12/H-13/H-14–18 持仓表、标题、搜索、排序、详情、分页、导出 | 只有一般的全量筛选排序分页说明；候选字段未列持仓天数起点、成本/剩余数量算法、行情/FX引用、局部搜索命中字段、nullable排序资格、标题合计是否随局部搜索变化、8行页边界与全量导出列。 | 按 row grain 给字段；区分完整 summary、totalMatched、pageRows；列排序资格、稳定 tie-breaker 和 8行边界；摘要是否受局部搜索影响按批准控件明确。 |
| 交易库实盘/模拟/统计分布 | 主稿仍未明确实盘列表一笔成交一行还是标的摘要；统计未列收益率/金额桶边界、count/share、下钻 ID 与缺失值分母资格。已批准模拟 LIFO 规则应影响回合集和统计数。 | 每个 read surface 明确 row grain、筛选范围、排序页键、分母资格、bucketVersion/bounds 和下钻 ID；模拟算法与 live 待决分开。 |
| 复盘 E07/E08/E16/E19/E20/E22 | 通用复盘文档/决策/快照未逐字段链接只读 execution ID、decision-execution link、Text ID/anchor/owner/revision、退出评价修订、save expectedRevision/receipt/conflict、snapshot image/version refs。无法检查各保存动作的原子持久边界。 | 按 E-ID 建命令/读投影字段矩阵，明确用户修订 ID、原始事实引用、原子事务与快照组合版本。 |
| 导入 I06/I07/I09/I10/I13/I14 | 泛化 source observation 不能证明月结文件月份/zone/page/行、库存快照/辅助证据、截图逐字段 OCR 置信/crop、server plan choices、receipt effects/completion evidence 可查询审计；附表仍合写 batch+source row。 | 按生命周期拆实体/字段，写清 browser draft 与服务端已确认证据边界；增加 statement snapshot/aux、OCR field evidence、plan choice 和 receipt effect。 |

## 尚无法证明的结论

1. **字段和数据库现状：** 本轮未查业务库；代码证据不能证明真实数据行、历史覆盖质量或每项控件已有字段。主稿不是迁移；Q01 矩阵仍待复核。
2. **财务正确性：** 不能证明当前产品输出符合候选公式；历史 FX/行情、live 回合、收益率分母/桶、曲线累计基准、空头/跨账户语义仍未定。
3. **并发和崩溃恢复：** CAS/outbox 是候选合同，尚未证明当前每个写入口都产出版本变化；实验未覆盖完整依赖及故障/竞态。
4. **回放无未来泄漏：** 规范描述不等于当前图表能真实揭示预期 bar/trade，也未验证 date-only 次序或盲态状态。
5. **导入全流程与视觉：** 未运行解析/确认/重载/交易库/复盘真实旅程；统一导入视觉稿仍缺。
6. **性能：** 当前真实规模证据为 measurement-06 FAIL、完整产品目标 NOT VERIFIED；本轮没有新测量。

## 放行意见

Q07、Q08 可关闭首轮问题（限引用与文档证据状态）。Q02 的逻辑方向足以进入实现细化，但须登记当前各写入口及依赖版本。Q03–Q06 仍需补字段/粒度映射或明确决策。此轮不批准 schema、迁移、运行正确性或一秒性能结论；请合并 Q01 新矩阵后，再区分已批准规则与未决规则做最终复核。
