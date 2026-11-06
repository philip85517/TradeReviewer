# 07 — 核对历史闭合回合与互斥贡献来源

ID: P4
State: open
Status: blocked
Assignee: /root
实现模型: gpt-6.1-sol / ultra
领域数据候选负责人: /root/financial_g61
整页视觉、完整数据流与独立接受负责人: /root
验收: 0/3；内部数据准备/接口审查不重置本票轮数，尚未授权产品实施。

2026-10-24 当前检查点：历史图 leaf 第1轮 FAIL，独立对照确认空态缺少整绘图区琥珀底及调用方已知月份元数据；第2候选由 /root/ui_acceptance_scan24 限定实施，见 [独立接受1](../evidence/P4/history-chart/ROOT-ACCEPTANCE-1.md)。历史四卡第1轮 FAIL、候选2局部静态对照通过，完整交互/动效仍待验。ContributionBars 已 3/3 FAIL 并暂停，保留已有原因，不改名另开第四轮。历史统计生产者/FX/真实页面接线仍依赖未接受的财务 seam；新增纯来源模块不解除这些门槛。整票仍 0/3。

## Scope / What to build

当前持仓下默认展开历史模块：四卡→同几何四种图；其下全页唯一贡献区，以当前期间/历史闭合两个独立局部记忆解释来源。市场→证券→已有详情容器→返回，不新增泛化入口/双栏。原始历史、期内已实现与浮盈变化不能相加冒充一种口径。

## Refs

- 原规格 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` HP05:349–432、HP02:193–209、HP06:436–448、HP08/HP10；current component manual Metric/ChartTooltip/Segment/Select相应完整章。
- [55项矩阵](../DESIGN-COVERAGE.md) HV25-31..43、跨任务15/16/44..49/53..55；原稿无elementID，沿矩阵manifest文本块。
- 同baseline `source/images/` 准确资产：`history.svg`、`history-stats-cumulative.svg`、`history-stats-win.svg`、`history-stats-rounds.svg`、`history-stats-empty.svg`、`history-stats-error.svg`、`history-stats-source-missing.svg`、`history-stats-extreme.svg`、`journeys-year.svg`、`contribution-states.svg`、`contribution-current-a-share.svg`、`contribution-historical-a-share.svg`、`contribution.svg`、`contribution-loading.svg`、`contribution-empty.svg`、`contribution-error.svg`、`contribution-extreme.svg`、`contribution-mixed-sign-demo.svg`。
- round5 `history.html` 与 `contribution.html` 原型仅核对已说明行为；其中占位详情不能代替正式容器。[视觉契约](../visual-contract.md)、[96状态映射](../evidence/A/CONTROL-STATE-MAP.md)、[领域准备方案](../evidence/resume-2026-10-23/F-data-prep/P2-P4-DATA-PLAN.md)。

## Blocked by

- [04 — 真实持仓最小旅程](04-holdings-journey.md)：真实数据/导航与首张整页视觉。
- [05 — 每日与期间表现](05-period-performance.md)：current contribution必须与已接受期间bundle逐组件对账。
- [01 — 唯一财务合同](01-financial.md) 与 [02 — 状态合同](02-state.md)：历史/归因新接口需独立冻结；混合IPO/手买处置政策、历史FX政策和canonical有限接口边界须由root在派发前明确，不视建议为批准。

## 验收标准与反例

- [ ] 四卡依次净盈亏/回合数/胜率/费用；闭合以实际上海平仓业务日归属，部分平仓不冒充闭合回合，反手正确关闭并开启；真实未知结果不被丢弃。胜率为盈利/全部完成回合，零在分母，无回合为—。
- [ ] 单年12个月，多年按年；每期/累计/胜率/回合四模式同容器/绘图区/操作区几何；胜率固定0–100%，回合整数，金额币种与卡一致。0、无回合、未来、源缺失、读取失败独立可读，无虚拟零趋势。
- [ ] 年份草稿应用后历史卡/图/历史贡献原子更新，失败保留旧范围与旧数据；不改变当前期间/持仓或强制贡献切模式。业务修正可重算并显示业务时区更新时间。
- [ ] 全部市场先3条市场汇总→点具体市场→证券；页头market不变。直选市场直接证券。做多/做空/IPO互斥，上市后自买归多；mixed来源的成本、费用、数量、实现/开放费用、期初期末浮盈逐组件守恒。
- [ ] 当前贡献全量合计=期间净盈亏；期初100、期间实现150、期末0得到50；历史只完成回合无当前浮盈。全量总额先于分页/排序/局部筛选；局部合计与范围总额清楚区分。
- [ ] 实现实心/浮变中空同外高14px，同号连续堆叠同方向色、异号分零线，负柱#EF7F89，按分真零中性不画假柱，未知不可计算。
- [ ] 证券固定8行，50项7页末2项；市场3行无伪分页。翻页焦点新页首行，上方不移动。两模式分别记忆分类/排序/市场钻取/页，历史openOnly禁用但保留当前选择。
- [ ] 证券详情/关闭/ordinary库返回/刷新恢复完整来源与最新数据；消失回贡献标题，不代入固定证券。所有选项、动态图点/条形/行、空异常与前中后空间逐项操作并独立看图，适用frontend-control-audit。

## 派发说明（root解除依赖并明确授权后生效）

同一UI owner沿P1页面文件范围；领域owner拟独占新 `app/lib/reviews/homepage-v25-attribution.ts`、`homepage-v25-history.ts`及测试，F trace扩展精确边界待派发。只消费同一canonical/F trace，不对IPO/手买分别重放改变平均成本。共享ledger/S/全局CSS/DB/deps无新增授权。禁止再派代理、提交或更改业务库。

root验收领域字面值、单一trace/组件守恒与性能，再验收UI、真实往返和双视口参考；不能用peer局部PASS代替整票。

## 验收证据

计划 `evidence/P4/{data,functional,state-persistence,visual,controls}/`。版本hash、真实目录/回合/缺失数据边界、隔离DB/服务、viewport/zoom/DPR、鼠标/键盘/模拟触控/物理触控分别记录。当前功能、端到端/持久化、独立视觉均NOT VERIFIED；未签署接受。

## 历史

- 2026-10-23：root补齐后续票，保留前置门槛，不授权实施或新增资金政策。
