# R1 首次集成门槛

ID: chart-first-repair-R1-core-gate
State: closed
Status: accepted
Assignee: root
独立验收: astra_r1_gate (gpt-6-astra / low)

## Scope

本里程碑只判定共享回放、知识边界及基本工作区是否能支撑下一批集成，范围为遮住未来、逐K/连续播放/下一决策、Text录入、回看早期、保存重开、基本紧凑框架。它不替代 R1 整票或 R2–R5 的完整验收。

## Blocked by

None。

## 验收与 Resolution

- [x] 新样本早期不显示后续成交；nextDecision 逐次访问同K1000/600/400，实际点击600/400保留正确身份与边界，缺行情不伪造K。
- [x] 28根早期窗口连续每秒播放至末尾64.89，新增K进入可见区，结束原因可见，无手动fit救场。
- [x] 末尾返回买入前构图准确恢复，未来事实隐藏且已看后续来源保留；再次下一决策只到首买。
- [x] Text/计划经保存、留存及重开保留，编辑箭头不推进；默认主底栏48px且关键3R/4000完整。
- [x] resize不推进边界并保留时间窗口；实际首帧及源码由Astra独立核验。

2026-09-26 19时 root 接受，Astra scoped pass。证据：[独立签署](../reports/R1-astra-final-gate.md)、[真实旅程](../reports/R1-browser-journey.md)、[末尾图](../reports/R1-final-continuous-end-1440.png)、[返回图](../reports/R1-final-return-1440.png)。最后受影响图表测试17项由root独立通过，状态受影响44项亦已复验通过，历史失败日志保留。

后续义务不删除：R1 手动价格窗/低价/捕获与设置等扩展项仍在 R5；R2 Text卡片字号、R3完整阶段布局与窄屏、R4评价数据都保持open；真机键盘unverified。本里程碑只解除这些工作的首次集成前置，不签整体功能接受。
