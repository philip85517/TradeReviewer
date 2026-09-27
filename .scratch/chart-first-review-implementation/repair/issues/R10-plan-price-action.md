# R10 — 计划价格辅助按钮避开右轴标签

ID: R10
State: closed
Status: accepted
Assignee: luna_r7_layout (gpt-5.6-luna / max)
集成负责人: root；独立审查 Astra gpt-6-astra/low

Scope: E05/E06右侧价格轴和计划标签始终可读。参考[元素规范](../../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)、[02主图](../../../../docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png)、[03录入](../../../../docs/designs/2026-09-25-chart-first-review/03-structured-record.png)。

Blocked by: None。

root默认窗口1280×720的[R9-preview-ready.png](../reports/R9-preview-ready.png)发现“显示计划价格”透明动作right76/top36与金色入场价格标签相交。保持前序图表面积/侧栏预算，安排在远离右侧价格标签的固定位置，复用按钮样式、桌面36/触屏44命中。不得缩小文字或增加常驻顶底栏预算。

验收：1280/390主图按钮不压右轴金色标签；绘图工具与时间轴不被新位置挡住；点击后56/52/68计划价格真实进入视野；双截止不推进；其他绘图控制保留。

文件owner：Luna只改replay-chart.tsx及必要已有CSS；root真实浏览器和最终构建；Astra独立图片复核。初始fail，待修复复验。

## root/Astra限定接受

2026-09-27默认1280/390/1440实图、36/44尺寸和真实fit已验证；双截止未推进。Astra独立打开四图，通过。详[R10集成](../reports/R10-integration.md)、[Astra](../reports/R10-astra-review.md)。整体保留真机键盘unverified。
