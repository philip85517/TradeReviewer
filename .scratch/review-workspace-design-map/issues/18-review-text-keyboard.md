# 图上 Text 缺少完整的键盘操作入口

ID: review-audit-18
State: open
Status: acceptance-failed
Assignee: unassigned
集成负责人: coordinator
Priority: P2
Blocked by: 无

## Scope / What to build

为新建和已创建的图上文字提供可用键盘完成的定位、选择和编辑路径；此票仅记录审阅发现，不构成修复授权。

## Refs

- [审阅报告与 Text 证据](../evidence/independent-design-review-20261028/REPORT.md)。
- [用户反馈修订 R03](../evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)。

## 验收标准与反例

- [ ] 已有 Text 可通过键盘到达并以 Enter/Space 启动编辑，具备可理解的名称、角色与焦点显示。
- [ ] 从键盘启用 T 后，提供能够定位并完成新文字的键盘路径；与鼠标的图上自由放置语义一致。
- [ ] 确认、取消、Escape 后焦点回到有意义的位置；无障碍树和真实键盘操作分别留证。
- [ ] 不把持仓自由 Text 转换成右侧逐 Bar 记录；图表已有鼠标行为与时间可见性保持。

反例：仅给 div 增加鼠标事件，或只为图标添加说明却不能到达已有文字。

## candidate-v37 版本绑定观察（2026-10-29）

本节仅记录 candidate-v37，清单及文件哈希见[manifest](../evidence/review-fixes-20261028/candidate-v37/manifest.json)。协调者真实浏览器 AX 操作 [v37-audit-ax.json](../evidence/review-fixes-20261028/coordinator/v37-audit-ax.json) 含 `text-keyboard-armed`、`text-keyboard-position`、`text-keyboard-editor`、`text-second-confirmed` 与 `edit-second-keyboard`：记录中 T 工具可由键盘启用，启用后焦点到图表时间位置滑块，定位后可进入 Text 内容编辑区，已有文字按钮暴露 Enter/Space 编辑帮助。独立审阅报告 [final-review-v37](../evidence/review-fixes-20261028/final-review-v37/REPORT.md) 明确审阅者没有进行独立键盘操作，因此这些是协调者实操记录，不是独立验收。

记录补充了键盘入口、定位和编辑路径的部分证据，但未覆盖全部要求：尤其是确认/取消/Escape 后焦点返回、鼠标与键盘语义等价、跨状态/阶段时的连续操作，均仍待同一冻结版本验证。既有 FAIL 保留，本票仍 open / acceptance-failed。

## candidate-45 限定补测（2026-11-05）

协调者在 1440×900 用鼠标放置两条分散 Text，再通过 Tab/Enter 分别进入编辑与确认，两个 ID 的文字互不覆盖；见[操作记录](../evidence/systematic-fixes-20261105/task-final-candidate45/text-keyboard-anchor-v5/observations.json)。这只覆盖既有对象的限定键盘路径，不能替代完整新建定位、Space、焦点恢复、密集态、跨阶段或独立审阅；本票继续开放，完整状态见[当前验收表](../evidence/systematic-fixes-20261105/task-final-candidate45/ACCEPTANCE.md)。
