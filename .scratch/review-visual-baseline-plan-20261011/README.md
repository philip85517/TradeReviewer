# TradeReview 视觉基线：开发与验收路线图

这是一份基于 `2026-10-10` 视觉基线的 Wayfinder 规划包。它把已经确认的视觉和交互规则转成可派发的开发任务、状态契约和独立验收门槛；本次只建立路线图，不修改业务代码、数据库或产品行为。

## 目标

交给实现者和验收者一条可追踪的路线：先在真实图表中确认最小回放旅程，再按紧凑布局、侧边/底部控件、Text 价格锚点与绘图控件、公共组件固化的顺序推进，最后用功能、端到端状态链、数据保护和独立视觉四道门槛放行。用户已确认的整体框架、暗色中文环境、盈亏颜色、S0/S1/S2、默认盈亏比 1:1 和选中反馈不在本路线中重新审美投票。

## 入口

- [Wayfinder 地图与依赖路线](issues/00-map.md)
- [设计覆盖矩阵](DESIGN-COVERAGE.md)
- [S0/S1/S2 状态与截止契约](STATE-TRANSITIONS.md)
- [前端控件审计范围与证据计划](CONTROL-AUDIT-SCOPE.md)

## 基线依据

- [2026-10-10 复盘工作区视觉基线](../../docs/design-system/versions/2026-10-10/README.md)
- [经用户确认的问题修复契约](../../docs/design-system/versions/2026-10-10/design-contract.md)
- [基线控件验收登记](../../docs/design-system/versions/2026-10-10/CONTROL-ACCEPTANCE.md)
- [基线设计覆盖](../../docs/design-system/versions/2026-10-10/DESIGN-COVERAGE.md)
- [前端控件与视觉空间审计标准](../../docs/agents/frontend-control-audit.md)
- 用户本轮提供的 TradingView 对照图：顶栏/侧栏/底栏的紧凑控件密度只作为视觉参考，不能覆盖 TradeReview 已确认的复盘阶段与数据可知边界。

## 角色与执行规则

- 协调与最终集成负责人：`root`。
- 默认实现模型：`gpt-5.6-luna`，按项目开发流程在实现票派发时使用；视觉复核者必须与实现者分离。
- 前端票登记稳定 elementID、阶段、视口和 before/during/after 几何证据；不能以 DOM 存在、HTTP 200、单测或 mock 状态替代真实图表操作。
- 所有会写入的浏览器验收使用显式 `TRADEREVIEW_DB_PATH` 隔离库；共享业务库保持不变。
- 每次改变布局、字号、命中区或交互契约，都在同一版本报告中保留旧证据、差异和未验证项。

## 当前已知边界

归档基线的 66 行有限桌面验收为 `64 PASS / 2 NOT VERIFIED / 0 FAIL`。真实中文 IME、物理触控/软件键盘和操作系统原生光标逐帧仍是 `NOT VERIFIED`；该结果不代表全页面、全设备或所有长内容组合已通过。

## 本路线完成定义

完成路线图不等于产品开发完成。路线图完成的条件是：每个在范围内的视觉元素、动作、阶段和失败/取消路径都有唯一任务、实现边界、验收方式和证据位置；无法在当前证据中确定的内容进入地图的 `Not yet specified`，不被静默简化。

## 2026-10-11 执行状态

本路线已按用户授权进入实现。当前可评审样板运行于 [http://127.0.0.1:3046/design/review](http://127.0.0.1:3046/design/review)，服务启动命令、隔离库、真实浏览器证据、测试结果和未验证门槛见 [FINAL-ACCEPTANCE.md](FINAL-ACCEPTANCE.md)；控件逐项审计见 [CONTROL-AUDIT.md](CONTROL-AUDIT.md)。

源码级实现和 `1280×720` 桌面鼠标/键盘检查已完成：顶部 48px、左右本地收缩入口、底部居中 icon group、Text 价格/bar 锚点、单点线动态预览、选中/拖动反馈和 RR 默认 1:1 均已落地。真实保存重载、1440/390、触摸、IME 及独立浏览器视觉复核仍保留为 `NOT VERIFIED`，因此本路线输出的是“可交给用户评审的桌面样板”，不是全环境放行声明。
