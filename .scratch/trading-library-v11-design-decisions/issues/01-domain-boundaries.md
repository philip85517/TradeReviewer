# 账户、练习与完整交易的边界

ID: TL11-D01
Labels: wayfinder:grilling
Parent: [交易库 V1.1 反馈设计决策地图](00-map.md)
Mode: HITL
State: closed
Status: accepted
Assignee: root
集成负责人: root
Resolution comment: [领域定义与统计口径结论](../comments/TL11-D01/2026-10-25-resolution.md)

## Question

用户已确认的练习与实盘回合含义见[一次练习与实盘复盘回合的用户澄清](../comments/TL11-D01/2026-10-24-practice-and-round-clarification.md)。本票的领域定义范围已接受，见独立 Resolution。以下保留讨论入口；行为识别与跨账户/证券范围已移交新票，不视为本票已决定：

- [人的行为与技术拆单已澄清](../comments/TL11-D01/2026-10-25-human-action-confirmation.md)：一次卖出对应同次买入决策，即使系统拆成两条成交，也只计一个复盘回合。[主动平仓回合计数已确认](../comments/TL11-D01/2026-10-25-completed-action-rounds-confirmation.md)：一次主动卖出80股关联两次买入，计一个已完成配对回合，剩余70股之后主动卖出再形成第二个回合；旧的按配对份数计回合解释作废。行为识别和跨账户/证券的边界移交[人的交易行为识别与配对范围](07-action-identification.md)。
- [“已完成”的业务含义已确认](../comments/TL11-D01/2026-10-25-completed-trade-meaning.md)：指开仓与本次平仓已配对、已完成的单次交易；不等于全部持仓清零或用户已完成复盘。
- [模拟账户与练习关系已确认](../comments/TL11-D01/2026-10-25-simulation-account-confirmation.md)：一个账户包含多次练习，账户下拉筛选所属练习，不拼接权益曲线。同文档重导沿用既有不复制成交的约束；练习身份与修订映射的实现需要另行验证。
- [统计层级已确认](../comments/TL11-D01/2026-10-24-statistics-levels-confirmation.md)：汇总按练习，内部统计进详情，列表可加预览列。[练习收益计价已确认](../comments/TL11-D01/2026-10-25-exercise-valuation-confirmation.md)：包含结束时点浮动盈亏，费用扣一次，缺少必要价格显示暂不可计算。[胜率分母已确认](../comments/TL11-D01/2026-10-25-win-rate-denominator-confirmation.md)：持平计入，暂不可计算单列且排除。[练习收益率已确认](../comments/TL11-D01/2026-10-25-exercise-return-confirmation.md)：净盈亏除以本次练习初始资金；本金缺失或非正时收益率暂不可计算，保留可计算的金额。[导入字段静态核查](../evidence/2026-10-25-import-capabilities.md)已记录当前缺口，尚未证明存在可用的练习资金与结束估值来源。保留已确认的最差练习回撤。
- 如何将已确认概念同步到 V1.1 的层级、计数和说明，并列明旧例子须重新计算的范围？

## Scope

形成设计决策与后续验收契约；当前正在逐项澄清概念，明确术语同步到词汇表。不得自行修改正式原型或把建议记录为用户结论。

## Refs

[项目公共设计规范：领域词汇](../../../docs/design-system/domain-language.md)已纳入用户确认的定义，后续设计统一引用。

BT02 / approved-e-sim-stats-1440；BT04 / hcr06-final-rounds-a；CONTEXT.md 的模拟账户、交易回合、已完成复盘；V1.1 第四章配对样例。

精确图片路径、评论原文与版本见[反馈覆盖表](../DESIGN-COVERAGE.md)及[源文件清单](../evidence/source-manifest.json)。已确认约束见[决策地图](00-map.md)。

## Blocked by

无。

## 验收标准

- [x] 用户确认概念关系及命名，明确现有两份定义的冲突如何处理；不把显示名称当实体关系。
- [x] 用分批开仓、部分平仓、最终清仓、重复练习四类反例给出计数表和统计影响清单。
- [x] 保留最差练习回撤约束；若其他统计需改变，列明旧/新口径与受影响图帧。
- [x] 记录真实用户结论及需同步的词汇表/设计文档位置；本票结论独立保存。

## 反例与证据

四项验收均对应[独立结论](../comments/TL11-D01/2026-10-25-resolution.md)中的“用户依据”“四类反例与计数”“统计口径与设计修订范围”及“接受证据”。root 已完成文档核对；接受只限本票领域决策，不表示产品实施或整张地图完成。
