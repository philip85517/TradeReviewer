# 独立三门验收与放行包

ID: review-visual-baseline-independent-acceptance-20261011
Parent: [TradeReview 复盘视觉基线：开发与独立验收路线图](00-map.md)
Labels: wayfinder:task
Mode: AFK
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root

## Scope / What to build

在实现票完成后，组织一份可复核的最终接受包，分别给出功能、端到端状态链/数据保护、独立视觉和前端控件审计的结果。报告必须覆盖最终代码/manifest、服务、数据、视口、阶段、导航状态和排除项，并提供可点击预览 URL 与仍在运行的启动命令。

## Refs

- [设计覆盖矩阵](../DESIGN-COVERAGE.md)
- [状态与回放转移契约](../STATE-TRANSITIONS.md)
- [前端控件审计范围与登记](../CONTROL-AUDIT-SCOPE.md)
- [UI 任务与验收模板](../../../docs/agents/ui-task-templates.md)
- [前端控件与视觉空间审计标准](../../../docs/agents/frontend-control-audit.md)
- [2026-10-10 历史验收边界](../../../docs/design-system/versions/2026-10-10/reports/149-final-acceptance.md)

## Blocked by

- [公共样式组件固化与数据闭环边界](05-public-component-promotion.md)

## 验收标准与反例

- [ ] 功能门：真实鼠标/键盘完成 S0→S1→S2 最小旅程、下一根/播放/下一笔决策、Text 锚点/编辑/取消、线段预览/确认/取消、选中/拖动/光标和 1:1；有动作前中后结果证据。反例：只有 DOM/单测/mock state。
- [ ] 状态链与数据门：隔离库真实保存→返回→重开→刷新；市场/成交截止、未来信息来源、原图形/原判断/当前补充、派生盈亏和保存错误/重试符合契约；共享业务库未写入。反例：callback 成功但 reload 丢值。
- [ ] 独立视觉门：非实现者在 `1440×900`、`1280×800`、约 `390px`、导航展开态和 S0/S1/S2 对照基线；检查信息层级、图表空间、中文字体/回退、字号/行高、控件尺寸、图标重量、间距/基线、语义颜色/对比度、状态、长内容和窄窗口。反例：以单个截图、HTTP 200 或整体评分代替同态对照。
- [ ] 控件审计门：全集登记、动态边界、点击/状态覆盖与结果通过率分开；before/during/after 几何、鼠标/键盘/模拟粗指针/物理触控分开；系统原生光标和软件键盘未验证时明确保留 `NOT VERIFIED`。
- [ ] 任一适用项 FAIL 或必需项 NOT VERIFIED 会阻止“最终通过”表述；报告给出重开票、责任人和下一次验证条件，不能移除旧失败证据。

## 验收证据

- `FINAL-ACCEPTANCE.md`：范围、版本/manifest、服务 URL、启动命令、隔离库、浏览器/视口/设备状态、结果和未决项。
- `CONTROL-AUDIT.md`：控件全集、动作、expected/actual、几何、状态链、证据、覆盖率/通过率。
- `visual-comparison/`：同态截图、叠图/差异说明、elementID 映射、独立复核签名。
- `journey/`：真实图表录屏/操作日志、状态截止日志、保存/返回/reload 证据和失败反例。
- 构建、定向测试、类型检查、运行时检查和已知全仓限制分开记录；测试结果不替代视觉/状态证据。

## 派发说明

- 允许写入范围：本 feature 的最终报告、截图索引、操作日志和 manifest；不覆盖基线历史报告，不改共享业务库。
- root 负责启动最终服务、隔离库和完整旅程；实现者不能担任自己改动 UI 的独立视觉复核者。
- 最终报告回填 `DESIGN-COVERAGE.md` 的每一行，并同步地图/功能 README 的回归记录；任何版本或环境变化都重新冻结证据。

## 历史

- 2026-10-11：创建，等待公共组件边界与实现票完成。
