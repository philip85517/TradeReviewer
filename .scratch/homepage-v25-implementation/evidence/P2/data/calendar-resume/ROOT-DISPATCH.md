# 财务 A 同任务显式恢复 — 2026-10-23 10:26 CST

用户两个异步答复按先暂停、后明确授权恢复解读：授权恢复未来交易污染历史汇率资格的确定性错误，再做批内市场日历共享；保持原金额合同、64MiB缓存、cold≤2000ms/repeat≤200ms；恢复最多3轮。原3候选失败、2617.548995ms和未来FX RED全部保留。本恢复独立计数0/3，P2整票0/3，不放行UI。

实现owner `/root/finance_calendar_resume`，实际 gpt-6.1-sol / ultra；root独立审查、数值及性能接受。纯财务任务无页面控件修改，UI/数据库写入本票NA；页面功能、持久化、视觉仍另行未验证。禁止再派代理。

## 必须读取的依据

- 当前AGENTS及docs/agents/development-workflow.md、task-decomposition.md、issue-tracker.md；systematic-debugging及test-driven-development。
- 原规格 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` HP02:193–252、HP09:467–518；HV25-14..22、47..49，文本HOME-HP02-B001，无独立elementID。参考images/period.svg、chart-gap.svg、chart-hover.svg；本票不修改画面。
- P2/data/PRE-DISPATCH-CONTRACT.md全篇及COORDINATOR-CONTRACT-DECISIONS.md；不可丢完整来源、未知原因、原币精度、六字段或独立current。
- P2/data/p2-b/independent-review/REVIEW.md及future-currency-isolation.test.ts和原COUNTEREXAMPLE.log；ROOT-independent-future-currency.log。
- P2/data/immutable-sharing/ROOT-CHECKPOINT.md、PROFILE-PLAN.md、diagnostic-analysis-v2.json；单次采样projection calendar/quote/timezone1424ms(64.69%)是诊断非性能通过。
- 原源app/lib/reviews/homepage-v25-performance.ts及同名测试、app/lib/replay/position-ledger.ts(只读)、market/calendar.ts与sync-range.ts(只读)；现A SHA094b24161c7714149535cb3c1893ed2fe8304d140ed090ec26a81df3decacd5a。

## 有界写权限与阶段

仅修改performance.ts及同名测试、新增本calendar-resume证据。其它产品、ledger、series、providers、共享日历、UI、host、Workspace、存储、原证据和原测试断言禁止修改。保留既有dirty内容，记录输入hash/源码快照/精确diff。

1. 先运行原独立future-currency-isolation测试保留原RED；从实际boundary/current的eligible exposure确定所需FX，不从原始全部groups直接生成需求。保留所有future carriers及早期合法附属证据，不能UI预过滤或假定未来组无历史证据；历史期间/独立current依赖分别处理，覆盖真正有HKD暴露缺FX的负例、已平仓期间实现、未知quantity及现有六字段。
2. 定向数值通过后，基于诊断只在本次projection batch内共享(市场、准确cursor/所需边界、日历语义/错误)的相同计算。cache不能永久挂source/index以绕预算；instrument quote选择/缺session/knownness保持独立，CN-SH/CN-SZ/HK/US、DST、收盘前后/合法休市/缺失及out-of-range不改变。不要另建账本或修改current旧F3 wrapper行为。
3. 定向原F/A/B/ledger及原独立反例、严格依赖范围tsc/lint，完整结果按原oracle比较；保留所有新发现失败，不能改旧断言制造绿。
4. 完成后freeze implementation-ready，给root exact命令/hash/diff/结果与限制。本候选是恢复候选1；root正式验收计数，后续同任务最多3轮。

## 性能门与安静窗口

复用原immutable-sharing/fixtures.ts和benchmark.test.ts的完整1866fills×365points：rounds、long-prefix、multimarket三形态，每形态3fresh进程、每次3repeat；完整public内容等价(仅operational diagnostics可分列)、365字面oracle、原cache计量≤64MiB、额外canonical work0。数值修复使旧缺陷oracle变化的场景必须明确隔离，不能删掉原正常场景等价。

实现者可准备新evidence-local runner/config，但不得未经root安静窗口许可跑正式重性能；root独立执行最终三形态样本。不调小fixture、不换阈值、不选最好值、不静默重跑。若门失败保留实际结果，最多剩余本恢复3轮内定向修复；第3轮失败即暂停并记录原因。
