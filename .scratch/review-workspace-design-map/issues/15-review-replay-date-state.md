# 回放日期浮层与背景状态一致性

ID: review-audit-15
State: open
Status: acceptance-failed
Assignee: unassigned
集成负责人: coordinator
Priority: P1
Blocked by: 无

## Scope / What to build

处理日期浮层打开后仍能推进回放，以及确认日期后提示与当前阶段矛盾的问题。此票仅记录审阅发现，不构成修复授权。

## Refs

- [审阅报告、操作及截图](../evidence/independent-design-review-20261028/REPORT.md)。
- [回放状态合同 R05](../evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)。

## 验收标准与反例

- [ ] 明确浮层是模态或非模态；背景推进与日期草稿的关系、焦点入口/返回、Esc 和取消行为均有可见一致的反馈。
- [ ] 日期确认、取消、前后跳转与推进后，顶部提示、行情日期/Bar、交易阶段和面板状态一致；未来信息不提前展示。
- [ ] 在真实图表重复 28→29、确认旧日期及相反方向，并由独立审查者保留前中后证据。

反例：只是隐藏旧提示，但日期草稿和实时回放状态仍互相覆盖。

## candidate-v37 版本绑定观察（2026-10-29）

[v37 冻结清单](../evidence/review-fixes-20261028/candidate-v37/manifest.json) 记录了本候选源码快照及哈希；协调者的真实浏览器 AX 操作记录为 [v37-audit-ax.json](../evidence/review-fixes-20261028/coordinator/v37-audit-ax.json)。其中 `date-open`、`date-tab`、`date-escape`、`date-confirm-33`、`date-cancel-open`、`date-cancel-return` 记录了日期弹层打开、键盘操作、确认/取消及返回焦点；记录显示 Escape 与取消后焦点回到“选择日期”按钮。独立审阅者另查看了 [日期弹层截图](../evidence/review-fixes-20261028/coordinator/v37-date-open.jpg)，该图仅用于静态视觉比较，没有独立操作。

这补充了协调者对弹层键盘路径的实操观察，不证明弹层打开时背景回放被锁定，也未证明确认、取消及日期前后跳转后，提示、实际 Bar、成交截止和面板状态始终一致。既有 FAIL 保留；本票仍为 open / acceptance-failed，需同一冻结版本补验背景互锁、日期状态一致性和相反方向日期跳转。
