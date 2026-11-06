# 四页面字段矩阵独立复核（第 3 轮）

日期：2026-10-31。审查对象：`docs/backend-design/view-field-mapping.candidate.md` 与最新 `docs/backend-design/view-driven-data-model.candidate.md`，并只读核对其首页/交易库、复盘/导入、当前代码证据引用。未连接业务数据库、运行页面、验证保存/重载、重放图表、异步并发或性能。除本报告外未改文件。

## 结论

**Q01 的矩阵结构和 90 项覆盖已修；候选模型尚不能因此视为定稿。** 我以脚本枚举矩阵行 ID，结果为 H01–H32（32）、T01–T19（19）、E01–E22（22）、I01–I17（17），合计 90 行、90 个唯一 ID，缺项、额外项、重复项均为 0。每行有需求来源链接、候选对象/读写字段、当前现状列，以及范围/计算/依赖说明；I 编号也被明确标为调查索引而非批准元素 ID。[矩阵范围和编号说明](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:3>)

“当前”与“候选”的证据边界处理总体准确：S 只表示 schema 列定义；B 只表示调查观察到的浏览器计算/临时状态；U 保留未核实项；候选字段统一称逻辑建议名。S01–S12 逐项列出当前源码字段并明确 JSON、数据完整性和接线限制；版本表也明确只有 Vt 的完整三元组已被调查证明。因而 90 行覆盖不能解读成 90 个持久字段已存在或控件已经接通。[标记规则与共同合同](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:7>)、[当前字段字典](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:19>)、[证据边界](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:152>)

矩阵与主稿的主要方向一致：模拟 LIFO 规则现在在主稿 §5 与矩阵 T10 同时写明；写入口表和逐项依赖也没有把 Vt 说成涵盖行情、FX、名称或复盘。剩余问题如下，故本轮结论是**矩阵覆盖通过；字段/业务口径及实现验证仍未通过**。

## 问题（按严重程度）

### P1 — 分布分母口径仍有未决项被写成固定值

**状态：部分修。** 矩阵 T15 一方面写“固定全范围有效闭合回合分母”，另一方面写收益率端点和“缺失排除规则待决”；T17 又要求 metric 级可算性和分母资格明确。主稿 §5.159 已把交易库分母说成“有效闭合回合”，但 §5.165 又说有效分子/分母与不可计算数量仍需细化。对金额分布和收益率分布，事实有效的闭合回合数未必等于该指标可计算的回合数：例如某闭合回合净额已知但用于收益率的分母缺失时，它是否进入收益率占比的分母并未定。读者目前无法判断 `share` 的分母究竟是全部有效闭合回合还是选中指标可计算的回合。[T15/T17](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:93>)、[分布候选合同](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:159>)、[桶与资格待决](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:165>)

**建议：** 暂不把“固定分母”写成已定算法；分别记录范围 cohort 数、所选指标可计算数、缺失数，并在正式规则确定后给 `denominatorDefinition` 和桶版本一个单义定义。金额与收益率分别给缺字段反例及预期计数。

### P2 — T10 未映射主稿要求保存的 LIFO 次序和未平仓余量

**状态：部分修。** 模拟配对算法已修清楚，矩阵也复述了 100+50 卖80 → 配50和30、余70。但主稿 §5.111 明确要求保存配对“顺序”和“余量”；矩阵 T10 的 `MatchAllocation` 只列 `practiceRef,openExecutionRef,closeExecutionRef,quantity,feeAllocation,ruleVersion`，没有 allocation ordinal/stable order key，也没有未分配数量/开放状态的字段或明确可无损推导规则。仅在计算说明里写 LIFO，仍不能说明同时间精度不足/同日多笔时如何重放同一分配、如何在页面显示 70 未平仓。[主稿 LIFO 保存要求](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:111>)、[核心回合候选行](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:139>)、[矩阵 T10](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:88>)、[成交时间精度现状限制](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:24>)

**建议：** 矩阵候选字段补 allocation ordinal/order evidence（说明依赖哪种来源可证明顺序；date-only/歧义时保持未决），并将 open remainder 作为明确投影字段，或说明从原成交与所有 allocation 可确定性重建。规则版本和余量应随相同结果版本读取。

### P2 — 导入来源对象虽拆名，主稿详细粒度表仍未给出可核验的关联键

**状态：部分修。** §5.105–107 及 I01–I17 已清楚拆分材料、材料版本、批次、来源观察、原始行、pair、成交、服务器计划、choice 和 receipt；因此没有把它们直接混成“一个 import”。但主稿详细表 §5.136 仍将“导入批次、来源行与回执”压在一行，只列各自 ID，没有列出它们之间的外键/关联方向、locator 的唯一范围，以及 plan/version/book digest 到 choices 和 receipt effects 的关联键。矩阵 I02/I05/I13/I14/I17 给出了字段级建议名，但这些仍是逻辑候选，且正文明确未定物理结构。[主稿来源与审核关系](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:105>)、[合并的详细表行](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:136>)、[矩阵 I02/I05/I13/I14/I17](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:135>)

这不是当前文档对“90 行”的反证，但若后续把该表当 schema 输入，无法仅凭现有字段确定一条来源行如何追到审核选择和实际副作用。**建议：** 在进入物理 schema 评审前，将材料版本、观察/行、batch、plan、choice、receipt 关系逐个列成候选键/FK/唯一性范围；当前 schema 证据仍和候选建议分栏，不能写成已存在。

### P2 — 异步更新合同已增强，但写入口覆盖和运行正确性仍未证明

**状态：候选设计已修，代码/运行未验证。** 主稿 §6 已增加写入口到候选依赖的表、发布 CAS 和按任务水位消费变化的合同；同一段落也明确它们尚待实现/故障实验，复盘写入仍要求逐入口核实。静态证据表列出成交、证券名称、行情、FX 和复盘，但“复盘保存相关代码”尚未逐写入口拆开；行情/FX 快照、任务领取失效、发布与消费水位的事务以及崩溃恢复没有在本轮运行验证。矩阵把 P/V/Q 作为候选依赖并明确非现有统一版本，这一点是正确区分。[写入口责任表](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:200>)、[入口表为候选声明](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:211>)、[消费水位合同](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:222>)、[矩阵版本边界](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:17>)

**建议：** 设计评审可按“候选合同已写”继续，但不能标为实现通过。后续实现验收应逐个枚举实际写函数、事务、依赖版本和 dirty 范围，并覆盖输入变化与发布竞争、任务中断/重复、行情或 FX 单独变化、读页期间换版的隔离数据库故障场景。

## 已修与未验证边界

- **已修（文档结构）：** 90 个 ID 完整且唯一；每行均回指 H/T/E/I 证据索引并有候选字段及当前现状栏。首页/交易库 ID 与原 H-/T- 编号的映射、I 索引非批准 ID 的边界清楚。
- **已修（现状/候选区分）：** S/B/U、S01–S12 和 Vt/候选版本的定义总体一致；schema 列、浏览器观察、待核实接线没有混写成同一证据等级。I08 的当前队列 worker/内存行为仍明示 U；这是正确保留未验证，而非矩阵漏项。
- **已修（模拟配对规则）：** 两份候选稿采用规范中的两配对/余70规则，没有继续把算法本身留作未知。T10 的顺序/余量字段映射缺口如上。
- **仍待定：** T15 分母；收益率/桶边界；live 回合规则和 practice/run/episode 稳定身份；各依赖版本的真实写入/恢复；财务历史覆盖与FX口径；回放实际图表是否显示正确 bar/trade；导入/复盘保存回执到 reload 的端到端正确性。
- **明确未验证：** 本轮没有检查真实数据库行、运行 UI、导入/复盘持久化、并发/崩溃、全页视觉或一秒指标。不能将“矩阵 90 项覆盖通过”扩大为模型、功能或性能验收。

