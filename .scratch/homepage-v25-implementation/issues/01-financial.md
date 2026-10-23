# 期间财务投影与证据

ID: homepage-v25-financial
State: closed
Status: accepted (pure contract, including completed exchange sessions)
Assignee: /root/financial_g61
Model: gpt-6.1-sol / ultra
集成负责人: /root
Acceptance rounds: historical 3/3 FAIL preserved; resumed 3/3 PASS

Current finite supplement: quote-session regression independently accepted in resumed 3/3; prior FAIL/PASS evidence preserved. See ../evidence/resume-2026-10-23/F-fix/acceptance-3.md.

## Scope / What to build

建立首页专用纯财务投影，可供真实账本调用。追踪实际 execution、部分平仓、方向、费用、估值和 FX 来源。期间净额=期间已实现+期末浮盈-期初浮盈；最新市值不随期间变化。不用日盈亏求和或 closed-only 回合贡献替代。

## Refs

原设计根 docs/design-system/baselines/2026-10-22-homepage-v2.5/。读取 source/visual-design.candidate.md HP02:191–252、HP05:395–431、HP09:465–502；source/images/contribution.svg、chart-gap.svg、account.svg。DESIGN-COVERAGE.md HV25-14..20、38..43 财务子合同归本票，UI 归 P2/P4。无独立 elementID，以原表 manifest 定位。

只读当前 app/lib/reviews/trading-room-history.ts、portfolio.ts、scope.ts、contribution.ts 及账本/估值依赖。可对照其他估值分支，不自动合并。

## Blocked by

None

## 验收标准与反例

- [x] 原字段到纯投影输入输出完整追踪；真实首页消费仍由 P1/P2/P4 验收，证据见恢复第1轮接受记录。
- [x] 跨年期初100、期间实现150、期末0→净50；部分平仓2份成本100/期初价150/卖1份180/剩余期末价160/费用0→净40。证据见恢复第1轮接受记录。
- [x] 做空、费用一次、仅未平仓、缺行情/汇率、市场账户隔离与执行日期归属；coverage/reasons，不伪0。证据见恢复第1轮接受记录。
- [x] RED/GREEN 原始证据与定向测试结果，输出模型及现有字段适配说明。证据见恢复第1轮接受记录。

## 派发说明

只允许写入 app/lib/reviews/homepage-v25-performance.ts、同名 .test.ts，以及本票 evidence/F/。不得改现有共享模块或页面，不提交、不再派代理、不访问业务库或启动服务。依赖由协调者安装；固定 Node 26；读并执行 TDD/writing-good-tests，只跑定向测试，协调者统一全量。

纯模块/准备可独立接受；产品 UI、持久化、视觉不属于本票，整页仍 NOT VERIFIED。最多3轮协调者独立验收，第三轮失败暂停并记录；实现者只报告 implementation-ready。

报告 evidence/F/report.md，包含实际接口、文件、测试输出与未验证项。

## 验收证据

2026-10-23 当前持仓接线预审：真实费用探针证明旧持仓毛浮盈与已接受 F 净浮盈不同（买2@100、开费2、现价110：20 对 18；部分卖出后10对9）。同名当前浮盈不得采用两种口径。root 授权原 F owner 在同两文件追加当前净浮盈、开放敞口费用与逐账户证券当前金额，复用已有 current state/quote/metric，不新增 ledger；原字段和第1轮指纹保留。该追加仍属本票，下一轮为恢复2/3；日序列、归因实现尚未授权。P1 在使用追加接口后须独立浏览器验收。

2026-10-23 01:10 CST：恢复第1轮独立接受PASS，仅纯财务合同。root固定冻结源码执行12文件277测试全PASS，strict依赖范围类型与双文件lint exit0；原始根因/IPO/费用/重复冲突有真实管线独立数值证明。[接受记录](../evidence/resume-2026-10-23/F-fix/acceptance-1.md)。日序列性能与全部UI门槛仍NOT VERIFIED。

2026-10-23：用户明确要求先debug、后修复并完成后续开发，恢复本票。历史上限与失败不撤销，恢复过程见 ../RESUME-2026-10-23.md。协调者已在未改源码版本重新复现14测试10通过4失败；根因报告已由协调者独立审查，现授权原owner TDD修复。新增证据只写resume-2026-10-23/F-fix，旧证据不覆盖；恢复验收0/3。

第 1、2、3 轮 FAIL，见 evidence/F/acceptance-1.md、acceptance-2.md、acceptance-3.md。达到用户上限，暂停迭代；不进入第四轮。保留财务投影、真实交易库适配与定向测试；第三轮原10反例通过，但真实适配层4个时区/asOf反例仍失败（首日重复seed、未来库存进入当前市值、未回选截止日前行情、未来期间发布899净额）。P2/P4因财务合同未通过而阻塞；UI NOT VERIFIED。

2026-10-23 01:27 CST：root恢复第2轮接受当前指标补充PASS，286测试、strict类型及lint通过，原69文件与补充manifest全部匹配。见 ../evidence/resume-2026-10-23/F-fix/acceptance-2.md。允许P1消费净浮盈，UI仍NOT VERIFIED。

2026-10-23 01:43 CST：行情完成时段回归重开。root独立复制并运行真实entries→F→P1探针，US/CN-SH/HK共3/3 RED；US 17:30Z误选当日未完成日线，CN/HK 08:30Z漏选当日已完成日线。根因quoteFor用上海日替代交易所完成时段。原F恢复1/2轮PASS及原始证据保留，仅行情边界及其金额依赖重开；当前fixing，已用恢复2/3，implementation-ready后正式第3轮。授权同owner仅F源码/同名测试复用既有完成时段规则；不能修改共享日历/账本或用adapter绕过。证据：evidence/resume-2026-10-23/coordinator/F-session-cutoff-red.log及同前缀3份JSON。P1仍0/3，F依赖金额尚未放行。
