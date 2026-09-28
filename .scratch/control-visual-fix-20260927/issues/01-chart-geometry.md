# 01 — 查看不变形且可交互的持仓与业绩图
State: closed
Status: accepted
Assignee: charts (gpt-6-luna / max)
集成负责人: root
Blocked by: None（依赖已由root接受）

Scope: C03/C06/C07。实际容器宽高与图表几何同步；自然布局提高绘图区可读性；保留指标、期间、日周月、tooltip、键盘选点、空/缺数据语义。
Refs: ../visual-contract.md；../DESIGN-COVERAGE.md 对应行；../../control-visual-diagnosis-20260927/DIAGNOSIS.md；矩阵中的图2/4原图。必须先看图。

允许修改: app/components/dashboard/room-holdings-history.tsx/.module.css/.test.tsx；room-performance.tsx/.module.css/.test.tsx；必要的图表尺寸hook放同目录及对应测试。不得修改领域计算、数据库/API、筛选状态模型、其他UI文件。不能只设置meet导致大片空白，不能只让red probe通过而保留矮卡片裁切。

- [x] 沿用原始红灯证据并为真实尺寸同步行为补充有效回归；相关测试pass。证据：[实现报告](../implementation-charts.md#验证)及原始复现[repro.log](../../control-visual-diagnosis-20260927/repro.log)。
- [x] 真实页面至少一次图表切范围/选点及resize，几何一致、选中状态稳定。证据：[首条旅程记录](../evidence/minimal-journey.json)、[整页日志](../evidence/accept-real-first.log)；桌面图表几何通过。
- [x] 原始图片对照与多视口截图，无拥挤截断，缺数据保留说明。未验证：独立视觉审查及 `pointer: coarse` 浏览器模拟待完成；整页821/820/390横向溢出已定位，控件负责人正在修复，尚未复验；证据：[整页日志](../evidence/accept-real-first.log)、[节点记录](../evidence/overflow-first.json)。
报告: ../implementation-charts.md。当前仅 implementation-ready；保持 open，不代表本票已接受或功能已接受。不提交git，不再派代理。

root签署：已核验当前Scope适用门槛，证据见[最终验收](../FINAL-ACCEPTANCE.md)与[独立验收第三轮](../independent-acceptance.md)。各勾选对应DESIGN-COVERAGE同ID证据；真实完整圆环/物理触摸仍NOT VERIFIED，未被勾选宣称通过。保留此前缺陷发现及修复历史。
