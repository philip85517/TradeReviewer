# 首页数据库优化与一秒首屏

ID: HOME-DB-20261105
Labels: wayfinder:map
State: open
Status: acceptance-failed
Execution: paused — prior 5/5 retained; restored stage 5/5 exhausted; final acceptance failed; no further product edits
Assignee: /root
集成负责人: /root

## Destination
在本工作树实现经审查的提前计算、持久结果和按需读取，使用隔离的真实数据副本验证桌面首页完整且正确展示是否不超过 1 秒。

## Notes
用户本次明确要求设计与实施，覆盖 wayfinder 默认仅规划的限制；本轮只解决一张执行决策票，内部实施步骤在计划与验收记录中维护。用户已批准之前的设计方向与独立专家审查，常规工程取舍由协调者落实，不重复审批。
2026-11-05用户回复“按照上述建议推进迭代”，批准[写后计算补充设计](../../../docs/superpowers/specs/2026-11-05-homepage-write-precompute-design.md)，恢复原问题并保留此前5轮失败记录；新授权最多5轮。本次先解决“共用计算的局部重算契约”决策，不能把整库后台化当作一秒成功。
使用 wayfinder、systematic-debugging、writing-plans、subagent-driven-development 和测试先行流程。项目默认 Luna 5.6 不可用，已向用户说明；沿用此前明确授权的 gpt-6.1-sol/ultra 开发与 gpt-6-luna/max 独立验收。
同一问题最多 5 轮；超过上限暂停并记录预期、实际、原因与已尝试方案。原始数据库只读，所有迁移、缓存和浏览器写入在显式隔离库进行。不推送或合并。

## Decisions so far
- [恢复阶段第5轮及暂停](../write-precompute/ROUND-5.md)：后台已接通，完整首页和交易库一秒仍FAIL；恢复5/5耗尽，保留旧失败并停止产品修改。
- [第5轮验收与暂停](../FINAL-ACCEPTANCE.md)：持久结果读取明显提速，写后首次读取、完整内容及交易库往返仍失败，5/5后暂停。
- [单笔更新与旧库刷新能否安全共用局部计算](06-precompute-contract.md)：现有全量入口可共用，安全局部复用须先拆开全库校验与分组结果；前置验证通过，产品目标未通过。
- [如何保留全库校验并复用按组计算结果](07-global-proof-group-results.md)：持久当前组结果与全库资格可安全分开，接口验证通过；后台和整页目标仍未通过。

## Not yet specified
后台、持久待办、发布和页面读路径已实施部分接线，见第5轮证据；安全缩小全局失效、准备/历史/持仓哪些层需进一步预存，以及真实截止失效和Recovery的根因仍待后续获准调查。财务来源资格和持仓缺证据的逐项成因须尊重原暂停范围；不能用快速空态或命中结果关闭地图。

## Out of scope
多人并发、重新定义财务公式、Bars 数据补齐与采集改造、无依据将 unknown 成交认定为实盘。保留原暂停任务。

## 当前暂停

原[写后后台已接通、首次打开仍约23秒](02-on-demand-rebuild.md)已完成恢复第5/5候选验收，整体FAIL并暂停，owner仍为root。前置06/07合法关闭，但不为本任务重置额度；不派发新的同义产品任务。下一次恢复需要用户重新授权。

本轮已接通持久待办、独立后台、版本发布与普通组复用。已准备结果现有内容快至0.29–0.71秒，但写后首读约22.8秒、交易库超时、真实15秒截止与视觉密度仍失败；完整首页一秒没有通过。未测选项、真实导入闭环、20样本和95%分支保留NOT VERIFIED。[最终第5轮](../write-precompute/ROUND-5.md)。财务规则、Bars、并发仍暂停。
