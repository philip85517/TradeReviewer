# D07 动作识别：数据流与可独立推进的切片

核查时间：2026-10-28；HEAD `d95afc37d30f817edbd6daab41e85f485138de0d`，工作树有并发未提交修改。本报告基于源码和用户原话，只读核查，未运行测试、浏览器或业务库，不是产品验收或 D07 Resolution。

## 决策边界

用户在提问中看到的前提是“同一账户、同一标的的成交有相同委托编号，可视为一次操作”；其选项答复是“标记待确认，确认后计入回合统计”。无编号待确认的规则已经确认。对于题目前提是否足以构成自动合并的完整授权，现有 [D07](../../trading-library-v11-design-decisions/issues/07-action-identification.md) 和 [独立业务逻辑审查](TL11-D07-independent-rule-review.md)均记为提问建议而未关闭；方向、不同来源/日期编号复用、分组修改和已有复盘映射仍未冻结。即便把相同账户/标的/编号视作候选依据，也不能把它当成所有情况都充分安全的合并键。实盘与模拟各自适用范围也须区分。

V2 的 [领域原文](../../../docs/design-system/trading-library-design-spec.md#L63)确认一次主动平仓是一回合：先买 100 再买 50，卖 80 是 1 回合（对应 50+30 两份分配），再卖 70 才是第 2 回合。模拟练习总体统计按练习计样本；[视觉规范](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md#L148)明确样例中的相同行为 ID 不是对生产识别规则的决议。

## 当前数据如何流动

|环节|现状与边界|
|---|---|
|来源解析|[富途 PDF](../../../app/lib/import/futu-pdf.ts#L194)识别部分版式的订单号、同向及标的线索，并在本解析分组内聚合。[当前未提交改动](../../../app/lib/import/futu-pdf.ts#L123)让单笔有编号时也保存 `executionGroup.orderReference`；新文件 [隔离库测试](../../../app/lib/import/futu-pdf-order-persistence.test.ts)覆盖解析、保存/重读与部分替换场景，但本次未执行。旧审查指出修改前会漏存单笔编号，**现存缺号不等于原文件缺号**。提取范围/真实文件可靠性仍需证据。|
|交易记录|[TradeExecution](../../../app/lib/trades/types.ts#L59)含 `id`、`accountId`、标的、`side`、数量、价格、费用、成交时间，来源含平台、文件/页行、方向证据、模拟范围及可选 `source.executionGroup.orderReference` 和 fills；`sourceTradeId` 是 [TradingView 配对来源](../../../app/lib/import/tradingview-simulation.ts#L280)，不是可直接当作券商委托编号的字段。|
|保存/读取|[executions 表](../../../db/sqlite-schema.ts#L47)含原成交字段与 `evidence_json`；[SqliteStore](../../../app/lib/storage/sqlite-store.ts#L844)恢复来源，[订单号帮助函数](../../../app/lib/storage/sqlite-store.ts#L338)从 `executionGroup` 读值。缺少已落地的人工确认持久化事实、原始来源可靠性判定和新动作身份。|
|持仓与现有回合|[buildTradeEpisodes](../../../app/lib/trades/episodes.ts#L36)按账户/标的/交易性质组织现有持仓 episode，现有 [列表](../../../app/lib/trades/library.ts#L272)用其数量展示回合；其与新主动平仓回合不等价。不能先删除缺号成交或直接替换 episode builder，否则可能改变持仓/费用/复盘引用。|
|资格门|[action-confirmation.ts](../../../app/lib/trades/action-confirmation.ts#L8)只处理调用方提供的 `archivedOrderReference`、`referenceIsReliable` 和 `manualConfirmationSatisfied`，依赖调用方独立确认 `actionIdentified`/`pairingComplete`；`canCountCompletedActionRound` 当前未接生产，且会检查调用方提供的每条成交。哪些开仓纳入该门尚未决定。它不提供确认界面/保存、动作识别或配对；不能把该局部逻辑当用户可用功能。|

## 推荐下一切片：只读来源证据投影

可先独立开发、测试的最小后端切片是：以现有 `TradeExecution[]` 为输入，产出每个原成交的**来源证据投影**；无写库、无界面、无自动分组、无回合计数、无新复盘关联。建议为新模块单独建测试和实现文件，由实际 owner 冻结路径；这比直接接入当前资格门更符合尚未决定的人工确认对象/开平仓边界。

每条投影至少保留：原 `execution.id`；账户 ID；标的稳定身份及市场；买/卖和已知 `positionEffect`（未知保留未知）；平台、输入类型、实盘/模拟范围及可能存在的练习/来源范围；原始文件指纹、文件名、页/行；存档中的原始委托编号及其提取字段路径；存档证据状态（有非空编号／存档不可用）和“原文件是否核实”的独立状态。不得把空值自动描述成“源文件没有委托编号”，也不得把出现编号自动设置为 `referenceIsReliable=true`。输出需保留原记录顺序或声明稳定排序、避免修改输入；敏感原文不应被重复输出到普通日志。

后续完整流应是：来源提取与证据核验 → 在已批准范围内确定动作候选 → 用户确认无编号或歧义的对象并持久化可追溯结果 → 根据已批准的动作和配对范围形成回合与资格 → 仅将合格的已完成回合计入实盘回合统计 → 旧复盘关联和返回链安全适配。此流程说明依赖，不预定用户确认 UI、撤销/合并规则、分组键或新数据库 schema；也不把资格过滤用于持仓计算。必要字段或对象的最终版本、旧记录补证方式和冲突恢复应由 D07/D06 明确。

建议 TDD 反例（只断言事实投影，不断言未决分组）：

1. 合成记录分别含可靠来源号、空串/空白、未存号、未确认来源；前者原值可追溯、后者为存档不可用，均不声称已经核验原文件或形成动作。
2. 旧解析存档无号但合成原文有号；投影保持“未核实”，新解析号保留；不覆盖旧值、不自动重导或修改旧记录。
3. 相同编号的不同账户、标的、方向、日期或来源分别保留各自范围；编号复用、不同方向输出候选事实，不推定合并或拆分。
4. 很接近的两次独立卖出不按时间推定一次；一个订单技术拆单保留原成交数量、费用和 fills；模拟 `sourceTradeId` 不被伪装为券商订单号。
5. 两次部分平仓、缺少开仓/超卖、无号开仓后有号平仓都保留原始记录；不生成回合数，不能用该投影修改持仓或现有复盘。之后针对人工确认、回合统计、重试/撤销、修改分组与旧成果的测试应等决策冻结。

此切片不显示“用户待确认”产品状态，不构成确认后计数，也不完成 I12/D07；集成或真实数据库更改仍需隔离库测试、旧复盘与持仓保护、以及独立验收。
