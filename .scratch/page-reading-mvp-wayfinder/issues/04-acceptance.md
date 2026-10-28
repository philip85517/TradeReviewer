# 实验是否真正达到一秒和数据正确

ID: page-reading-mvp-evidence
Labels: wayfinder:task
Parent: [首页与交易库一秒优化实验决策地图](00-map.md)
Mode: AFK
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

基于可复现的对照实验，哪些性能和正确性结论可以成立，哪些完整首屏或写入场景仍不能验证？实验能否支持最终方案决策？

## Scope / Refs

- 两页分别测完整桌面首屏：真实数据、主要控件可操作；冷／热、服务重启首读、导入或修订后首读分别记录。
- 用同一隔离数据版本做新旧结果逐项核对，记录数据缺失和异常，不为指标变快删校验或把未知归零。
- 真正导入／修订流程、财务或 Bars 若触及暂停，明确 NOT VERIFIED 和受影响门槛；模拟写入不能替代真实流程。

## 验收标准

- [ ] 表格列出每个场景的预期、实际、耗时、数据及截图或追踪依据、PASS/FAIL/NOT VERIFIED、限制和复现命令。
- [ ] 并列报告写入、结果准备、打开页面时间及总等待、资源成本和完整性；不更改用户已确认的 1 秒计时边界。
- [ ] 对发现的失败保留复现和原因，不将单接口成功或单次理想情况当作整页达标。

## Blocked by

- [最小实验能否安全复用预先准备的结果](03-mvp.md)
