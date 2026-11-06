# 日期与关闭浮层的焦点和键盘退出缺口

ID: review-audit-21
State: open
Status: acceptance-failed
Assignee: unassigned
集成负责人: coordinator
Priority: P2
Blocked by: 无

## Scope / What to build

明确日期选择与关闭工作区两个浮层的模态性质、背景操作、键盘退出和焦点管理。此票仅记录审阅发现，不构成修复授权。

## Refs

- [独立审阅报告及实际操作证据](../evidence/independent-design-review-20261028/REPORT.md)。
- [日期回放状态问题](15-review-replay-date-state.md)。

## 验收标准与反例

- [ ] 两类浮层分别说明是否模态、进入焦点、背景操作、确认、取消和关闭后焦点位置。
- [ ] 真实键盘与无障碍树分别验证标题可感知、Escape/取消按约定关闭、焦点合理恢复。
- [ ] 若选择模态，验证背景不可操作；若选择非模态，验证背景动作不会使浮层状态或结果误导用户。

反例：只添加 Escape 事件，却仍让焦点丢到页面外或保留错误的日期状态。

## candidate-v37 版本绑定观察（2026-10-29）

candidate-v37 冻结清单见[manifest](../evidence/review-fixes-20261028/candidate-v37/manifest.json)。协调者在真实浏览器留下 [v37-audit-ax.json](../evidence/review-fixes-20261028/coordinator/v37-audit-ax.json) 记录：日期弹层包含 `date-open`、`date-tab`、`date-escape`、`date-cancel-return`；关闭弹层包含 `exit-tab-0..3`、`exit-shift-tab`、`exit-escape`、`exit-resume`。AX 状态显示日期弹层初始焦点在日期步进器，Tab 可移动焦点，Escape/取消后返回“选择日期”；退出对话框中执行 Tab/Shift+Tab、Escape 和恢复操作后，焦点仍可回到工作区关闭入口。独立报告 [final-review-v37](../evidence/review-fixes-20261028/final-review-v37/REPORT.md) 查看了两个弹层截图，但明确未独立操作或验证焦点。

这属于协调者键盘/AX 实操观察，不能表述为独立验收。初始焦点是否符合预期、模态背景锁定、确认后的焦点恢复、各关闭/取消路径及无障碍树完整性仍需同版核验。本票继续 open / acceptance-failed。
