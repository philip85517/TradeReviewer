# 当前首页访问超时全链耗时诊断
ID: HOMEPAGE-TIMEOUT-FUNNEL
State: closed
Status: accepted（诊断）
Assignee: /root
集成负责人: /root
Blocked by: 无（诊断；旧3/3暂停不恢复）
Scope: [README](../README.md)及[范围矩阵](../DESIGN-COVERAGE.md)，仅隔离copy的观察性计时与一次完整桌面首读；必要时单独标记cold/warm，不改业务行为。
Refs: 用户systematic-debugging指令；[上次诊断](../../desktop-home-db-diagnosis-2026-10-24/DIAGNOSIS.md)。
验收：
- [x] 原源码/业务数据保护与隔离服务实际文件证明：[source](../FINAL-SOURCE-VERIFICATION.json)、[五表区间摘要](../BUSINESS-AFTER.json)、[运行隔离](../RUNTIME-ISOLATION.json)。
- [x] API/SQLite/HTTP body/contract/bundle/计算/host终态均有时序或明确未测原因：[报告](../DIAGNOSIS.md)、[冻结trace](../complete-trace.json)。
- [x] 桌面1440×900真实浏览器复现并保存DOM/截图：[截图](../complete-desktop.png)、[AX](../complete-desktop-AX.txt)、[geometry](../complete-desktop-geometry.json)。
- [x] 同request分清并行和嵌套耗时、超时首次跨越环节，当前测量替代历史推测：[metrics](../FUNNEL-METRICS.json)、[复算脚本](../build-funnel.py)。
- [x] /root独立复核日志、instrumentation差异和报告边界：[主验收](../FINAL-ACCEPTANCE.md)、[独立Astra复核](../INDEPENDENT-REVIEW.md)。
反例：console日志本身有开销；冷编译和浏览器运行不能用Node纯计算替代；timers可能被同步CPU阻塞；未发布不等于空库；不得输出账户/完整账单内容。

Accepted by: /root，2026-10-24。结论：bundle13.827秒 + fromGlobal3.704秒，在17.541秒afterDomain拒收；首次15秒越界为sourceEncode。236行情请求7.243秒、两轮大型来源指纹约5.968秒为主要已测热点。诊断接受，产品超时仍FAIL。

历史与轮次：首个cold样本console500条截断继续NOT VERIFIED，保留原始文件；增加持久collector后一个完整样本独立冻结。未进行产品修复迭代；P1/F07、ContributionBars 3/3 FAIL暂停不变。没有以测量工具修正或文档纠正重置旧候选轮数。
