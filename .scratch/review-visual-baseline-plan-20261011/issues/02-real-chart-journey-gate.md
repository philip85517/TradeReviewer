# 首条真实图表旅程与状态门槛

ID: review-visual-baseline-real-chart-journey-20261011
Parent: [TradeReview 复盘视觉基线：开发与独立验收路线图](00-map.md)
Labels: wayfinder:task
Mode: AFK
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root

## Scope / What to build

在真实 `/design/review` 图表上接受一条最小、可回放、可重开的纵向旅程，作为依赖同一状态契约的布局和绘图开发门槛：

`S0 入场前 → 下一根/播放并暂停 → S1 持仓中 → 下一笔决策 → Text 价格锚点/编辑 → 回看早期状态 → 保存 → 返回 → 重开 → 刷新`。

必须记录市场截止和成交截止的独立变化、真实图表新增的 K 线/成交/时间轴、Text 的阶段归属、未来信息来源、视野和保存结果。末尾、无下一根、未平仓事后状态和保存失败/重试至少各覆盖一个反例。

## Refs

- [S0/S1/S2 状态与回放转移契约](../STATE-TRANSITIONS.md)
- [设计覆盖矩阵 V04/V06/V12/V13](../DESIGN-COVERAGE.md)
- [2026-10-10 视觉基线启动与预览](../../../docs/design-system/versions/2026-10-10/README.md)
- [项目拆票标准的真实主图门槛](../../../docs/agents/task-decomposition.md)

## Blocked by

- [基线契约与设计覆盖矩阵](01-baseline-contract-and-coverage.md)

## 验收标准与反例

- [ ] 使用最终版本真实服务和显式隔离库；在 `1440×900` 至少完成一遍，必要时在 `1280×800` 复核；不使用 mock chart、直接调用 handler、注入 state 或仅 HTTP 200 作为证据。
- [ ] 每个推进动作有 `before / during / after` 证据：阶段、市场截止、成交截止、可见 bar/成交、视野和页面布局；播放必须能暂停并保留中间帧。
- [ ] Text 先点价格/bar 锚点，连线/标签随指针预览，第二点或释放固定框并进入编辑；取消不落空草稿，编辑焦点阻止回放快捷键。
- [ ] 回看早期状态仍保留原图形、原判断与图表关联，并标出后来查看/未来信息来源；刷新不把 S2 的信息伪装成 S0 已知。
- [ ] 保存、返回、重开和刷新通过真实隔离库闭环；失败/版本冲突留住输入，显式重载后再编辑可保存。反例：回调显示成功但 reload 丢 Text 或阶段。
- [ ] 任一真实图表步骤 FAIL 或必须步骤 NOT VERIFIED 时，不解锁依赖本状态契约的布局/绘图扩展；记录责任人和下一步，而不是改写为 N/A。

## 验收证据

- 真实浏览器操作日志/录屏：起始 URL、服务进程、视口、DPR、数据集、隔离库路径、时间。
- 状态日志：每次动作前后独立的市场/成交截止、可见 bar/成交、阶段、未来来源和视野。
- 同态截图：S0、S1、S2、Text selected/editing、回看早期、保存后 reload；另附末尾/失败反例。
- 数据摘要：保存前后逻辑 counts/关键内容摘要或 hash；禁止上传业务明细。
- 功能、状态链、视觉三项分别给 `PASS/FAIL/NOT VERIFIED`，不得用一项覆盖另一项。

## 派发说明

- 允许写入范围：本目录新增旅程报告、操作日志、截图索引；不得修改产品代码、设计基线或共享业务库。
- 写入验收必须使用 `TRADEREVIEW_DB_PATH="$PWD/.scratch/<feature>/acceptance.sqlite"`；结束后报告隔离库摘要，不复制正在写入的 SQLite 文件。
- root 是真实图表和状态门槛 owner；独立视觉复核者负责同态截图；若失败，保留原证据并在地图中阻塞下游票。

## 历史

- 2026-10-11：创建，依赖契约覆盖票。
