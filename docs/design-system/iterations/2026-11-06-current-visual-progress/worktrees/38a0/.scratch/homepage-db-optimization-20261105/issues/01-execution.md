# 提前准备首页结果是否能实现真实一秒首屏

ID: HOME-DB-EXECUTION
Parent: [首页数据库优化与一秒首屏](00-map.md)
Labels: wayfinder:task
Mode: AFK
State: open
Status: acceptance-failed
Execution: paused — prior 5/5 retained; restored stage 5/5 exhausted; final acceptance failed; no further product edits
Assignee: /root
集成负责人: /root

## Question / Scope
把完整来源和重复计算移出打开首页的路径后，真实桌面首页能否在一秒内完整正确展示？实施必要的版本、结果、查询与客户端接线，并提供前后对比；失败不得宣称通过。

## Refs
- [实施计划](../../../docs/superpowers/plans/2026-11-05-homepage-db-optimization.md)
- [设计覆盖](../DESIGN-COVERAGE.md)
- 专家报告原件：`/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/homepage-database-expert-review-2026-11-05.md`

## Blocked by

前置06/07已接受关闭。当前整体FAIL，原问题恢复5/5耗尽，停止实施；不是前置接口继续阻塞。财务规则、Bars和并发原暂停状态保持。

## 验收标准与反例
- [x] [原库四表逻辑摘要保持一致，全部写入仅在隔离副本](../FINAL-ACCEPTANCE.md#6-数据安全和最终版本)。
- [ ] 相同依据不重复计算；输入更新、重启、失败不会把旧结果当成新结果。
- [ ] 真实数据前后对账；缺失不补零、未知性质不猜测。
- [ ] 记录冷/热访问、重启后首读、修订后首读的 HTTP、字节与浏览器完整展示时间。
- [ ] 桌面真实浏览器验证受影响控件、返回/刷新与独立视觉审查。
- [ ] 独立审查和协调者逐项接受，所有 FAIL/NOT VERIFIED 保留。

## 验收证据
基线 HEAD `8c8c66c7`，任务分支 `codex/homepage-db-1s-20261105`。初始全库只读盘点：1,866 成交、236 标的、154,410 日线、52,781 其他行情、213 批次；1,784 条原始性质列为空、82 条模拟；为空不等于实际 unknown，既有读取还依据原始解析规则与指纹解析性质，新目录实际识别7个实盘账户。现有 3333 服务属于其他工作树，不停止、不复用其验收结果。

## 当前结果

最新[第5轮报告](../write-precompute/ROUND-5.md)：后台待办、独立计算与版本发布已接通，普通组结果可复用；已准备结果约0.29–0.71秒仅为现有内容。写后首次打开约22.8秒；交易库16秒仍加载，真实15.966秒截止仍轮询，四卡/曲线/历史不完整。视觉图表约高92px。完整功能、性能、视觉与回归未接受。恢复5/5后暂停，不用拆票继续试改。

## Resolution comment
未解决，不创建成功Resolution，不关闭。

## 恢复记录

原验收仍FAIL，不删除。新阶段执行[共用计算首项契约验证计划](../../../docs/superpowers/plans/2026-11-05-homepage-precompute-contract-validation.md)，恢复第1轮漏比规则印记而未接受，第2/5轮前置验证已接受，见[简明结果](../resume/ROUND-2.md)。后台更新、批量刷新和一秒完整页面仍未完成；接受子票不等于关闭父目标。

## 恢复第5轮最终状态

Sol6.1 Ultra实施、Luna6 Max独立审查、root最终接受流程已结束。保持open / acceptance-failed / Execution paused。局部125、41+356、107项通过不抵消真实桌面FAIL、全量97失败与未验证项。详见[最终验收第12节](../FINAL-ACCEPTANCE.md#12-恢复阶段第五轮后台已接通整体仍失败并暂停)。未提交推送合并，原业务库未打开。
