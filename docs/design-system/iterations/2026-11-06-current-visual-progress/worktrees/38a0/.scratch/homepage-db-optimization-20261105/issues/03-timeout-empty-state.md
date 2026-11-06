# 服务器有20行，页面却在超时后保持空持仓

ID: HOME-DB-TIMEOUT
Parent: [首页数据库优化](00-map.md)
Labels: wayfinder:task
Mode: AFK
State: open
Status: acceptance-failed
Execution: paused under parent 5/5 limit
Assignee: /root
集成负责人: /root

## Scope / 服务的目标
新版本正确显示，失败明确区分加载/真实零；完整≤1秒。

## 当前用例
- 预期：新版本正确显示，失败明确区分加载/真实零；完整≤1秒。
- 实际：名称PUT成功，HTTP16.3秒200/20行；15秒前端截止已撤销pending，45秒仍空期间/0持仓。
- 已尝试：本轮只读定位15秒token、pending归属、空种子与迟到拒收；没有第六轮代码修复。
- 原因与下一方向：不能简单延长超时冒充性能成功。需与预计算设计一并明确初始失败与恢复状态；财务/Bars不在本票恢复。

## Refs / 证据
[直接证据](../frontend-report.md) · [最终验收](../FINAL-ACCEPTANCE.md) · [控件登记](../CONTROL-AUDIT.md)。本票为失败拆解，不重新计算尝试次数；父目标5/5后暂停。

## Blocked by
父目标达到用户尝试上限，暂停实施；等待用户后续恢复决定，不自动开始。

## 验收标准
- [ ] 上述预期在隔离真实数据和最终生产浏览器通过。
- [ ] 相关控件、返回/刷新与独立视觉有证据，保留未知语义。
- [ ] 原业务数据不变，无既有FAIL被悄悄改成通过。

## Resolution comment
未解决，保持open；没有成功Resolution。
