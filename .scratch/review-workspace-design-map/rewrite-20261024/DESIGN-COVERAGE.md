# 全文改写覆盖合同

状态：候选文档制作与检查 PASS，用户决议及产品实现另行验收。仅文档与解释图；不实现业务控件。参考同目录 PLAN.md；原任务 Refs 是精确来源，子代理必须阅读。截图参考：docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-reference.png；当前已修正原型 prototypes/tradingview-alignment-v0.1/。旧01–10画板仅用于识别待替换内容。

|任务/精确原票|元素|目标章|owner|旅程/验收对象|证据与状态|
|---|---|---|---|---|---|
|[01](../issues/01-trade-identity.md)|E07/E15/E16/E22|RV04|domain，coordinator整合|入场→加仓→减仓配对|[本轮验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)；PASS（候选文档覆盖）|
|[02](../issues/02-tradingview-research.md)|E03/E19|RV03|coordinator，coordinator整合|13绘图槽/7回放槽证据|[本轮验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)；PASS（候选文档覆盖）|
|[03](../issues/03-event-journey.md)|E02/E04/E07/E09/E19/E22|RV04/RV05|domain，coordinator整合|正常/加减仓/恢复三旅程|[本轮验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)；PASS（候选文档覆盖）|
|[04](../issues/04-immersive-layout.md)|E01/E02/E03/E04/E05/E09/E19/E22|RV02|coordinator，coordinator整合|双侧开合/全幅工作区|[本轮验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)；PASS（候选文档覆盖）|
|[05](../issues/05-tradingview-contract.md)|E03/E06/E08/E19|RV03/RV06|coordinator，coordinator整合|工具身份/样式/生命周期|[本轮验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)；PASS（候选文档覆盖）|
|[06](../issues/06-plan-and-notes.md)|E06/E08/E10/E11/E12/E13/E14/E22|RV06|plans，coordinator整合|独立计划→标注→留存|[本轮验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)；PASS（候选文档覆盖）|
|[07](../issues/07-process-metrics.md)|E13/E14/E15/N03|RV07|results，coordinator整合|正常/加减/空头算例|[本轮验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)；PASS（候选文档覆盖）|
|[08](../issues/08-exit-ratings.md)|E15/E16/E17/E18/N04|RV07|results，coordinator整合|退出→归因→四维评分|[本轮验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)；PASS（候选文档覆盖）|
|[09](../issues/09-save-export-return.md)|E01/E20/E21/E22|RV09|results，coordinator整合|保存→冲突→完成→导出→关闭|[本轮验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)；PASS（候选文档覆盖）|
|[10](../issues/10-responsive-and-states.md)|E01–E22|RV08|coordinator，coordinator整合|宽窄/键盘/状态|[本轮验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)；PASS（候选文档覆盖）|
|[11](../issues/11-document-argument.md)|导言/RV01–10|全篇|coordinator，coordinator整合|逐章扫描→论述→规则→引用|[本轮验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)；PASS（候选文档覆盖）|
|[12](../issues/12-integrated-acceptance.md)|E01–E22/N01–N04|RV10|coordinator，coordinator整合|完整旅程/独立证据|[本轮验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)；PASS（候选文档覆盖）|

逐项用户评论：43d411（术语）→RV01/08；008a57（重复图）→RV02数字预算；a0b107（连续动线、独立交易、指标评分）→RV04–07/09；2afceb（沉浸、左右职责、TV、退出）→RV02/03/08/09。截图及红框纠正→RV03现有候选原型，未知身份保持待核实。

全量E01–E22逐项去向在最终正文RV10，不允许遗漏。浏览器只检查本文阅读器目录/链接/解释图/评论读取，业务UI/数据库NOT APPLICABLE；内容检查、用户批准、工具功能证据分别判定。

版本绑定：source SHA `b192586ae0e1814eb62d2009fa99bb241fdb914f0a9f64ad616a711c3014fae7`。独立审查首次 F1–F5 已修订并复核关闭；原始报告与复核均保留。工具实操、触控、真实图表、持久化与导出不计作通过；图标/尺寸高保真仍需同状态补证。
