# P4 canonical / F 只读事实 seam — 新任务候选1

2026-10-23，root。用户已授权首页与公共规范持续并行开发，实际模型 gpt-6.1-sol / ultra。财务A同任务显式恢复1/3已由root独立接受（evidence/P2/data/calendar-resume/ROOT-ACCEPTANCE-1.md）。本票是原P4尚未实现的只读事实接口，不是A重命名或第四轮修复，0/3；P4整票0/3。实现owner /root/finance_calendar_resume，root独立接受并拥有整页视觉/完整财务持久化流。禁止再派代理。

## 依据与需求映射

读当前 AGENTS / development-workflow / task-decomposition / issue-tracker；systematic-debugging、test-driven-development、codebase-design 与 verification-before-completion。原批准设计 docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md HP05:349–432、HP02:193–252、HP09:467–518；HV25-32..46及14..22、47..49，原稿无稳定elementID，以HOME-HP05-B001/B002及HOME-HP02-B001定位。参考同source/images/history.svg、contribution-states.svg、current-a-share.svg、historical-a-share.svg（按实际文件定位，不能以摘要代读原图）。本票无画面修改。

必须完整读 P4/ROOT-FINANCIAL-DECISIONS.md、P4/PRE-DISPATCH-CONTRACT.md、P4/CANONICAL-READ-FACT-SEAM-PROPOSAL.md（提案先前未授权，**此派发明确授权其有界实现**）、P2/data/P4-COORDINATOR-PROVENANCE-DECISION.md、当前F/A/ledger与对应测试、刚接受的A原始九样本。旧提案读时hash仅历史，输入以当前root接受SHA为准，先做快照。

## 唯一写权限与接口

仅 app/lib/replay/position-ledger.ts / 同名test、app/lib/reviews/homepage-v25-performance.ts / 同名test、以及本seam新证据。其它UI、series、S、host/session/Workspace、存储/schema/provider/IPO现金计算/共享日历/原证据/共享tracker禁止修改。所有原测试断言保留，新增行为测试；不得另写第二本成本/费用账本、lot FIFO/pro-rata或造disposal link。

允许一个additive只读canonical fact query（名称可沿提案readPreparedPositionFacts），复用同evaluator，ordinary / attached exact-context沿原语义；observer记录各execution、IPO/bonus/transfer、reconciliation、suppression/knownness变化，包括continue路径。输出完整精度不可变字符串、before/after、时间精度/证据、实际close/open量/realized delta、精确context和独立coverage；不要求假markPrice。旧snapshot/wrapper保持逐字段一致，未知不能变兼容0。

F在既有fee step留下只读allocation facts，输出opening pool前后、释放、该movement fee close/open分配、realizedFeeDelta与精确context，仍F独占费用方程和unknown门。incurred FeeFacts不改日、不重复计算。最终提供财务owner可消费的完整group read bundle，UI不直接操纵facts，不写入S/URL/session。

normal A热路径不得无条件建立新的全量fact graph；需显式只读调用才收集事实，或给出预算内的等价方案。任何保留在prepared/source的额外索引/Map都必须纳入原缓存计量，不能绕过64MiB。提案O08复杂度要求仍适用；attached若保exact fallback据实报告，不能为速度放宽knowledge/选择/未来carrier规则。

## 逐项验收（由本票唯一owner实现，root独立审查）

- SF01 / O01：累计加仓→partial→归零只有1round，canonical总gross70、F已分配fee10/native60，首次partial不是closed；incurred日与已分配费分开。
- SF02 / O02：合法反向close1/open1，fee4分2+2，不双扣；旧long16、新short7，总net23，原raw fill不重复；非法方向仍unknown。
- SF03 / O03–04：lateIPO两个knowledge context不可互相污染；退款不改关闭日/费用日；非execution cover不新增fill，真实quantity/matching/fee来源可对齐。
- SF04 / O05：event-only/bonus/transfer/reconciliation与quantity-gap、month precision分别保留；终态0不能捏造close次数/日/利润。
- SF05 / O06：完整account/instrument/nature/run、重复冲突、episode conflict/未来carrier保持；未覆盖group明确unknown，不造fill。
- SF06 / O07：全精度native胜负上游可用；历史FX和分类缺coverage保留，不取latest、不默认分类；本票仅facts，不实现完整P4历史聚合。
- SF07 / O08：旧wrapper/新facts/F逐quantity、cost、gross、fees、reason/warnings等价；显式selectedID/cursor/tie/未知ID规则不改；入参/返回值mutation隔离。
- SF08：原ledger/F/A/B相邻回归、strict依赖tsc/lint通过。保留A已接受快照，数值公开等价与新增facts调用复杂度/缓存如实报告。正式A三形态性能回归由root安排安静窗口后独立执行，worker不抢跑重测试。

实际journey：完整原始entries→canonical同evaluator事实→同context F费分配→稳定可追溯read bundle；不会直接放行历史cards/contribution或宿主。先用真实原始fixture写有意义interface RED，保存，再实现；first complete minimal O01/O02通过后向root报告准确接口/断言，再扩O03–08。不要先实现一个P4全金融模块。

本票纯只读财务函数无UI/DB写，UI视觉/控件/数据库写入在本票NA有范围依据；整页功能、状态持久化、视觉、全控件仍NOT VERIFIED。worker只称implementation-ready。冻结精确source/testSHA、diff、命令/log、coverage和限制；同票最多3正式root验收，第三FAIL或requiredNV即暂停，不改名继续。
