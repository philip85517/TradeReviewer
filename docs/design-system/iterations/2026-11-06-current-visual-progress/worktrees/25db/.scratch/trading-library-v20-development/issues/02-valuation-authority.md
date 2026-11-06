# 练习资金、结束估值与权益轨迹以什么来源为准？

ID: TL20-D02
Labels: wayfinder:grilling
Parent: [交易库 V2.0 完整产品落地决策地图](00-map.md)
Mode: HITL
State: open
Status: in-progress
Assignee: root
集成负责人: root
Resolution comment: 未产生

## Question

2026-11-05 用户确认按练习币种使用对应默认本金：美股 100,000 美元、A 股 100,000 人民币、港股 100,000 港币。港股通按导出数据实际币种计价：港币导出用港币，人民币导出用人民币；取代此前统一按人民币的表述。全局默认本金按币种分别配置。其他市场和币种识别不明时的处理仍待确认。

同日用户最初确认无法判断普通港股或港股通交易由用户选择；后来明确港股通按实际导出币种计价，覆盖此前“港股通使用人民币”的前提。是否需要交易方式选择需结合实际数据确认。

同日用户确认练习结束时可能有未平仓，表示“默认结束即可，按照最后一根 bar 写复盘”；剩余持仓按最后一根 K 线的收盘价计算未实现收益，保留未平仓状态，不生成模拟卖出记录。最后一根 K 线为导入记录中最后一笔交易所在的 K 线。如果暂时找不到收盘价，练习仍可保存并复盘，未平仓收益暂时显示无法计算，行情可用后更新。具体行情来源仍需确认。

同日用户确认：TradingView 模拟练习记录缺少手续费时按 0 计算；有费用记录时使用记录中的费用，不据此改变实盘规则。

同日用户说明，除已列股票市场外，模拟练习可能涉及加密货币，其他市场或品种暂不涉及；加密货币默认本金使用 USDT，结合既定规则初始为 100,000 USDT，按币种分别配置。加密货币练习先只考虑 USDT 计价的交易对。

同日用户确认：多币种模拟练习合计时，总盈亏金额统一按当前汇率换算成人民币显示；管理页面至少提供用户输入的兜底汇率，实时汇率不可用时使用兜底值。管理入口、初始值与未设置时的具体行为仍需设计。

2026-10-27 至 2026-10-28 [用户已决定初始资金](../USER-DECISIONS-2026-10-27.md)：全局默认值可配置；单次练习可手动设置，未设置使用全局默认。全局默认值变化时，未单独设置本金的既有练习随新默认值重新计算收益率；已单独设置的练习继续使用其设置。初始默认金额及币种以 2026-11-05 的决定为准；结束估值和权益轨迹等仍待明确，本票保持 open。

每次练习的正初始资金、结束时点、残余标记价格、含费/未含费属性及逐时权益轨迹由谁提供并确认？无可信来源时怎样保留未知，用户何处补正与追溯？

## Scope

只解决本问题或为其准备事实，不实施产品。已确认合同不重新投票；未决业务规则不能由实现者推定。HITL结论须与用户实时交流后记录。

## Refs

- [docs/design-system/trading-library-design-spec.md](../../../docs/design-system/trading-library-design-spec.md)，L89–109
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L198–208
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L401–408
- [开发计划](../IMPLEMENTATION-PLAN.md)、[覆盖矩阵](../DESIGN-COVERAGE.md)、[当前代码证据](../evidence/code-baseline.md)。
- 代码入口：app/lib/reviews/library-performance.ts；app/lib/trades/episode-metrics.ts；app/lib/reviews/trading-room-scope.ts；现有资金/行情接口只作能力核查。

## Blocked by

None.

## 验收标准与反例

- [ ] 与用户逐一决定来源优先级、时间/币种/费用依据、可修改权限、来源冲突与持久化；正本金不能取账户历史暂定本金。
- [ ] 覆盖无残余、有残余无估值、已含费金额、非正本金、缺费/缺汇率、缺权益路径及未调整现金流；金额与收益率的样本资格分开。
- [ ] 确认完整/部分/无轨迹三种回撤呈现沿用既定规则；不再决定已批准公式，不借 fixture 的140或当前行情确定生产价格。
- [ ] 如需外部 API 事实，另开 research 子票并交独立研究代理；本票不凭记忆承诺外部价格可得。
- [ ] 独立Resolution记载事实/用户原话、理由、影响边界和待同步位置；协调者接受证据后才可closed。

## 验收证据

完整来源合同 NOT VERIFIED；root 已领取并核对原业务规范和 V2.0 指标来源要求。初始资金持久化与默认变化已有[隔离数据库局部复验](../evidence/initial-capital/unit-coverage-independent-review.md)，统计页面接线及完整行为仍未验收。结束估值与权益轨迹等未决问题不因初始资金决定自动确定。后续事实/草稿放 `../evidence/decisions/TL20-D02/`，Resolution放 `../comments/TL20-D02/`；未生成完整 Resolution，不关闭。纯决策不要求产品UI/DB验收。

## 历史

- 2026-10-26 建图：open / ready-for-agent / unassigned；待真实依赖关闭后领取。
- 2026-10-27 root 领取“练习资金、结束估值与权益轨迹以什么来源为准？”，与完整来源保存验收并行；不改变当前 DATA/UI 白名单或缺失值规则。
