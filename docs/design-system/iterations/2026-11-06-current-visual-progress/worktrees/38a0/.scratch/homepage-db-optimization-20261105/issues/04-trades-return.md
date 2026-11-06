# 从首页进入交易库后超时，返回仍加载

ID: HOME-DB-NAV
Parent: [首页数据库优化](00-map.md)
Labels: wayfinder:task
Mode: AFK
State: open
Status: acceptance-failed
Execution: paused under parent 5/5 limit
Assignee: /root
集成负责人: /root

## Scope / 服务的目标
正确目标集合可见，返回及刷新恢复首页。

## 当前用例
- 预期：正确目标集合可见，返回及刷新恢复首页。
- 实际：真实侧栏点击后25秒已显示目标集合读取超时；返回/刷新仍连接数据。
- 已尝试：首次旧target工具挂起没有操作证据，未判应用失败；fresh target重新执行才记录FAIL。
- 原因与下一方向：根因未继续下钻，不能将它断言为数据库缺记录或前端特定行错误；本目标5/5暂停，不另开修复绕过上限。

## Refs / 证据
[直接证据](../desktop-trades-after.json) · [最终验收](../FINAL-ACCEPTANCE.md) · [控件登记](../CONTROL-AUDIT.md)。本票为失败拆解，不重新计算尝试次数；父目标5/5后暂停。

## Blocked by
父目标达到用户尝试上限，暂停实施；等待用户后续恢复决定，不自动开始。

## 验收标准
- [ ] 上述预期在隔离真实数据和最终生产浏览器通过。
- [ ] 相关控件、返回/刷新与独立视觉有证据，保留未知语义。
- [ ] 原业务数据不变，无既有FAIL被悄悄改成通过。

## Resolution comment
未解决，保持open；没有成功Resolution。
