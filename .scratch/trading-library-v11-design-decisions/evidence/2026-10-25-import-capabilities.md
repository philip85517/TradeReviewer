# 现有导入字段与设计差距

2026-10-25，root 静态阅读当前工作区源代码。此记录是设计依赖核查，不是运行测试或产品验收；不改原始成交、评论状态、正式原型或业务算法。

|核查项|源代码事实|对后续设计实施的影响|
|---|---|---|
|账户与来源|`execution()` 写入统一 TradingView 模拟账户，同时保留文件指纹和 `simulationRunId`|存在分别表达账户与文件来源的字段，但来源标识不能直接证明已有独立练习实体|
|未配对记录|解析器发现缺失 entry 或 exit 时，产生 `incomplete-tradingview-trade`，加入排除项并跳过|当前已接受记录不能完整代表用户定义的一次练习；后续需保留未配对事实并明确导入质量，不能默默缩小练习范围|
|资金与估值|当前解析上下文只有市场、证券；来源报告含收益与波动指标，但没有独立的练习初始资金、练习结束时点和结束估值字段|不能仅凭这些字段认定整体收益率和剩余持仓估值可计算；其他数据来源尚未验证。缺输入沿用暂不可计算规则，不倒推本金或套用账户暂定本金|
|手续费|配对两行费用须相等，生成记录时 entry 费用为零、exit 记录该费用|此解析路径已避免一对记录重复记费；不代表全链路或练习汇总已验收|
|来源范围与业务范围|账户身份模块明确把 canonical 账户的业务 scope 设为 whole-account，`simulationRunId: null`|后续交易库按文件展示练习时，需区分来源练习与既有账户范围；不能直接把账户 episode 当成练习。其他账户对账功能不因此自动改变|
|重导身份|来源 run 由 `sourceFileId`、市场、证券组成；项目已有同文档重导不复制成交的规范|文件名不是唯一身份。完整重导、修订映射及练习身份连续性仍需后续实施验证，本次不声称已完成|

## 证据入口

- [TradingView 模拟导入解析器](../../../app/lib/import/tradingview-simulation.ts)：`report`、`execution`、`parseTradingViewSimulationCsv`。
- [导入上下文](../../../app/lib/import/contracts.ts)：`TradingViewSimulationContext`。
- [来源报告类型](../../../app/lib/trades/types.ts)：`TradingViewSourceReport`。
- [TradingView 账户身份](../../../app/lib/trades/tradingview-account-identity.ts)：`TradingViewBusinessScope`、`tradingViewEpisodeBusinessScope`。
- [内容指纹](../../../app/lib/import/file-fingerprint.ts)：`fingerprintBytes`。
- [项目词汇](../../../CONTEXT.md)：同文档重导、成交明细、交易决策、模拟账户。

## 范围边界

上述缺口进入后续实施约束。本轮不新增资金录入流程、不执行导入迁移、不承诺已有数据可以恢复所有未配对记录。练习结束时间的显示规则由“练习命名与两种日期”继续决定；复盘完成条件由对应状态票继续决定。
