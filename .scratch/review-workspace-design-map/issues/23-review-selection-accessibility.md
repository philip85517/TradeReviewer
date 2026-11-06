# 计划规模与退出评价的选中状态缺少辅助技术语义

ID: review-audit-23
State: open
Status: acceptance-failed
Assignee: unassigned
集成负责人: coordinator
Priority: P2
Blocked by: 无

## Scope / What to build

在复盘工作区原型中审查并后续修复两个单选分段控件的状态表达：买入前的计划规模（按数量、按金额、按仓位）和结束后的提前退出评价（未评价、是、否、不确定）。本票只记录验收发现，不构成修复授权；保留现有的业务选项与回合隔离。

## Refs

- [本轮覆盖合同 W05/W09、I32/I35](../evidence/independent-acceptance-20261104/DESIGN-COVERAGE.md)。
- [工作区独立审阅证据](../evidence/independent-acceptance-20261104/workspace/)：`32-scale-semantics.json`、`13-early-yes.dom.txt`、`15-early-1..4`。
- [前端控件与视觉空间审计规范](../../../docs/agents/frontend-control-audit.md)、[R01–R05 原型合同](../evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)。

## 可复现问题

在 candidate-v37、Chrome、1200×569 CSS、DPR 2 的合成数据原型中，通过鼠标切换两组按钮可以看到颜色改变，提前退出四态均可选择。但独立审阅者读取实际可访问性树时，提前退出的“是”为普通 button，没有 selected / checked / pressed 状态；焦点的 active 状态不等于选中状态。计划规模按钮的实际 DOM 只以 `selected` 类区分，`aria-checked` 和 `aria-pressed` 均为空。辅助技术无法从控件状态获知当前选择；这不意味着视觉切换或数值转换本身失败。

## 验收标准与反例

- [ ] 两组控件都提供与单选关系一致、可被辅助技术读取的组名及当前选中状态；所有选项变更后语义同步。
- [ ] 鼠标和键盘均可切换并保留合理焦点；对应回合草稿、计划规模转换和提前退出评价不串项。
- [ ] 在入场与结束两种状态分别进行独立浏览器复验，记录操作、可访问性树及截图；保留本次失败证据。

反例：仅增加颜色或让焦点停在按钮上，不提供实际选中状态；或用错误的单选语义掩盖多个按钮同时选中的状态。

## 2026-11-05 候选复测

[candidate-17 限定验收](../evidence/systematic-fixes-20261105/task-06-candidate17/REPORT.md)的两组名称、checked、鼠标/键盘切换、两回合内存草稿隔离和指定画面视觉审查通过；读屏软件、物理触屏与整页最终验收未完成。本票先保留 open，原 candidate-v37 的 FAIL 不覆盖。
