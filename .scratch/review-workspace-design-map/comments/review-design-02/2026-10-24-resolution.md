# TradingView 参考研究验收

2026-10-24，coordinator 独立接受公开资料调查范围。本次建图只接受研究，没有代用户决定设计。

## 结论与依据

[研究报告](../../evidence/tradingview-research/research.md)登记13个绘图槽位、拖动柄及7个回放入口，区分截图事实、候选身份和官方功能。多节点工具、框内T及底部“天”未唯一确认；其他候选也没有完整操作证据。所有工具的1:1实际功能仍为 NOT VERIFIED。

协调者对照用户原图检查槽位登记，阅读完整报告；另行打开[官方回放说明](https://www.tradingview.com/support/solutions/43000474024-how-do-i-turn-bar-replay-on/)核对播放、速度、单步、返回实时和X关闭回放面板，打开[官方产品比较](https://tradingview.github.io/lightweight-charts/docs/product-comparison)核对工具栏、绘图、保存及API边界。项目package.json及锁文件均为lightweight-charts 5.2.0。

## 四项验收结果

- PASS：截图槽位全部登记；未知身份及缺少的证据明示。
- PASS：官方功能由目录或专页支持；候选身份未冒充确认结果。
- PASS：项目库事实、可复用基础、需另建/评估扩展、仍需核实分列；未批准降级或迁移。
- PASS：[独立快照](../../evidence/tradingview-research/context-pointer.md)复核通过。分支research/review-workspace-tradingview-reference，提交487a13fa858f5d7bf49083aff66acf52b79a8bdf。两份报告逐字节一致，SHA-256为1dca690637e5d526ecd7a0e3b394176b365f89d960d2e4fa59cb9686e25a3943，快照工作树干净。它是独立临时研究仓库中的分支，不是产品分支。

## 下游边界

[确定 TradingView 绘图与回放的逐项对齐契约](../../issues/05-tradingview-contract.md)可开始讨论。未确认工具身份、行为及参考版本须补证后才能定稿；研究关闭不代表功能实现、视觉验收或用户批准设计。
