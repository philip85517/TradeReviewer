> 归档副本（2026-10-10）。以下原结论保留原时间和范围；标注“本地历史记录”的文件未随远端归档。当前版本入口见 [版本说明](../README.md)。

# E149 最终有限接受概览

2026-10-10，root已独立审核日志、冻结文件、实际浏览器与数据证据。本轮桌面有限UI登记 **64 PASS / 2环境NOT VERIFIED / 0 FAIL（66行）**；当前限定工程检查PASS。不是全环境100%验收，不把未验证门槛改成PASS。本次只整理文档，没有新增UI、数据库或测试操作。

|范围|结论与依据|
|---|---|
|桌面UI有限动作|[CONTROL](../CONTROL-ACCEPTANCE.md)固定66行，版本复用边界及原始动作链接保持；[11票有限结论](146-current-ticket-boundaries.md)与[设计覆盖](../DESIGN-COVERAGE.md)对应。E140/141/145非空Undo/Redo、短箭头keyboard/Esc；E141/142密集及长数值有限独立视觉接受；E144失败留页/重试与E146即时导航闭合。|
|冻结版本|[freeze-141](freeze-141.json)32文件。root最终确认32文件hash全部相符，无产品或测试变更；本轮文档核对此前亦相符。|
|最终全量单测|[root-149-full-unit.log](root-149-full-unit.log)，`npm run test:unit -- --maxWorkers=1 --reporter=dot`，exit0：325 passed / 3 skipped文件（328总计）；3229 passed / 6 skipped测试（3235总计），803.39s。既有skip不计通过。|
|其他工程检查|[typecheck](root-141-typecheck.log)、[build](root-141-build.log)、[runtime](root-141-runtime.log)由root记录exit0；[scoped lint](root-141-scoped-lint.log)0 errors / 9 warnings，限定PASS。全仓lint历史失败见[范围说明](lint-scope-triage.md)，不声称全仓lint绿。|
|持久化|E146实际点击记录（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/146-immediate-save.json`）trusted index click3961ms < PUT4264 < PUT2006141 < index8806，返回reload成功；E144失败留页/重试已证。E144→146只读JSON对照rev364→368/bundles34→36，working/阶段/决策/计划一致、transient[]；不是整库不变声明。数据与最终版本汇总由root维护最终证据（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/146-root-final-evidence.json`）。|
|活预览|[隔离预览](http://127.0.0.1:3046/design/review)。root于E149结果后重新读取真实IAB现有tab5，预览正常，服务仍运行。启动命令与隔离DB约束见README（本地历史记录：`.scratch/drawing-control-fix-20261009/README.md`）。|

历史工程失败完整保留：E141（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/root-141-full-unit.log`）50 failed / 3179 passed / 6 skipped；E146（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/root-146-full-unit.log`）3 failed / 3226 passed / 6 skipped测试、1 failed / 324 passed / 3 skipped文件，455.32s。[E148诊断](root-148-trade-review-diagnosis.md)3个失败项按默认超时单worker3PASS、完整父文件91PASS，无代码/测试修改；表现符合资源/调度竞争解释，未证明唯一原因。最终串行通过不抹去历史并行失败，不冒称任意并发都稳定。

K02真实中文IME与R03物理触控/软件键盘仍NOT VERIFIED。实际OS原生光标逐帧也未证，computed CSS cursor、模拟coarse/DPR与桌面输入不能代替这些环境证据。旧脚本STOPPED、错误清理及其恢复均按历史记录保留。没有提交、推送或合并；root确认上述有限桌面范围与限定工程门禁通过；环境NV继续保留。
