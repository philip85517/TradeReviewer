# Trading Library V2.0 Implementation Plan

> 用户最新范围以[2026-10-27 决定](USER-DECISIONS-2026-10-27.md)为准：练习资金全局默认10万元人民币并可单次设置；I11 复杂更新流程暂缓，变更文件作为独立异常，不再作为 I14/I20 的本轮前置；旧数据迁移新库见[I33](issues/33-legacy-database-migration.md)；先扫描无用旧测试，约95%分支覆盖目标不变。以下旧表保留历史，冲突处以本条为准。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. 项目默认：协调者统筹，Luna承担边界清晰且互不重叠的实现票，协调者独立接受；不得未读原票直接批量执行。

执行覆盖（用户2026-10-26后续指令）：多个`gpt-6.1-sol / ultra`承接有界任务，每位由不同`gpt-5.6-luna / max`独立验收，root协调并独立接受；同一稳定问题最多5轮修复复验，仍未解决则停该问题及依赖并记账。实际派发、问题与局部接受见[EXECUTION](EXECUTION.md)，该覆盖优先于各票保留的项目默认模型说明。

**Goal:** 按已批准V2.0交付完整交易库产品，并以真实保存、双模式返回链和独立视觉证明行为。

**Architecture:** 扩展既有SQLite/HTTP/bootstrap和Recall工作区，显式区分独立练习及版本、人的主动回合、内部配对与原始成交。共享交易库壳及范围/返回上下文由一个集成owner管理；模拟练习指标与现有持仓episode指标通过显式模型适配，防止改变其他页面语义。先接受真实主图最小旅程，再扩展列表、统计和布局。

**Tech Stack:** 当前仓库React/TypeScript、vinext、SQLite、decimal.js、Lightweight Charts、Vitest；Node26.0.0与内置SQLite3.53.0，沿用conf固定环境。

**Spec:** [交易库设计规范](../../docs/design-system/trading-library-design-spec.md)；[V2.0正文](../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)；[V2.5公共规范与入口](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md)。本计划不代替原稿。

## Global Constraints

2026-10-26 user override: filename must contain exactly one recognized valid date; zero/multiple/invalid fails import, no candidate chooser/manual rescue. This supersedes older import date fill/confirm requirements below. Detail edits and protection of prior manual dates remain separate.

- 顶栏64px、导航72px、次栏58px；内容左96px右24px；1440×1000和1280×800比较，长页自然增长；无新增双栏/中间页或顶部返回首页。
- 文件全记录为一份练习；同日同标的稳定编号；有效练习日导入前必填，重导保护人工日期；不猜存量日期。
- 实盘一次人的主动平仓为一回合；配对份数/成交条数分离，技术拆单不加回合；识别规则由原决策票确认。
- 独立练习不串权益；毛已实现+毛残余浮动-费用一次，已含费不再扣；残余估值未知不借当前价；收益率只用该练习正本金。
- URL生效范围与来源返回快照分离；列表/统计日期口径分离；两模式独立记忆；局部搜索不启用全屏全局搜索。
- 原始交易及人工成果保留；写入验收显式隔离库；不得更改conf/runtime.json的绝对业务库/端口。未要求远端操作，本轮不commit/push/merge/publish。
- 角色、空间、状态、数据闭环和独立验收按当前docs/agents工作流；已接受票被回归影响则重开并同步证据。

## Review Focus

- 相同收益合计但未配对记录/实际次数不同：导入不可误判为重复；由“equivalent-practice-multiset”覆盖。
- 两个窗口更新同练习并删除带笔记成交：人工内容保留，冲突后可重载再保存；由“practice-update-conflict-recovery”覆盖。
- 同K多决策、看结果再回早期、resize与导航同帧：事实与视野不泄未来；由“replay-no-future-leak”和“real-chart-navigation-and-save”覆盖。
- 金额可算但本金未知、部分练习缺权益：金额/率/回撤覆盖各自解释，不能假0；由“amount-rate-separate-eligibility”和“worst-practice-drawdown”覆盖。
- 来源对象位于非首行且返回前消失、迟到范围与失败重试竞争：保持正确身份/有效条件并回容器焦点；由“return-full-home-context”和“scope-generation-atomicity”覆盖。


## 可执行切片

详细步骤、精确候选文件、接口提供方/消费者、反例、检查命令均在各独立任务文件。依赖决策没有关闭时，不声称已形成无歧义实施接口。

|顺序|完整用户行为|真实前置|完成证据|
|---|---|---|---|
|10|[导入有效日期的独立练习，等价重导打开原练习](issues/10-import-practice.md)|[旧数据怎样映射为独立练习并保留复盘引用？](issues/01-legacy-contract.md)、[一次练习的账户与标的边界是什么？](issues/04-multi-scope.md)、[练习名称与日期口径](../trading-library-v11-design-decisions/issues/02-practice-names-dates.md)|独立报告+本票验收，初始NOT VERIFIED|
|11|[变更练习先选更新或新建，并保留历史和人工成果](issues/11-update-protection.md)|[导入有效日期的独立练习，等价重导打开原练习](issues/10-import-practice.md)、[变更文件的候选、冲突和部分失败怎样让用户处理？](issues/03-update-conflict.md)|独立报告+本票验收，初始NOT VERIFIED|
|12|[主动回合和练习配对在真实主图保存重开（首道门槛）](issues/12-first-chart-journey.md)|[导入有效日期的独立练习，等价重导打开原练习](issues/10-import-practice.md)、[新回合身份怎样接入既有回放状态并安全重开？](issues/06-replay-adapter.md)、[人的交易行为识别与配对范围](../trading-library-v11-design-decisions/issues/07-action-identification.md)、[列表排序与复盘状态的表达](../trading-library-v11-design-decisions/issues/04-list-sort-review-direction.md)|独立报告+本票验收，初始NOT VERIFIED|
|13|[从首页到实盘成交、回合复盘，再恢复来源](issues/13-live-entry-return.md)|[主动回合和练习配对在真实主图保存重开（首道门槛）](issues/12-first-chart-journey.md)、[非法范围和缺失账户参数怎样恢复到可修正状态？](issues/05-invalid-entry.md)、[市场与账户选择器的规则](../trading-library-v11-design-decisions/issues/03-market-account-selectors.md)、[列表排序与复盘状态的表达](../trading-library-v11-design-decisions/issues/04-list-sort-review-direction.md)、[表格密度与标的显示规范](../trading-library-v11-design-decisions/issues/05-table-density-symbols.md)、[统一滑动切换与柔和模式底色](../trading-library-v11-design-decisions/issues/06-switches-mode-surfaces.md)|独立报告+本票验收，初始NOT VERIFIED|
|14|[独立模拟练习逐层进入回放，更正日期后仍属原练习](issues/14-simulation-entry-date.md)|[变更练习先选更新或新建，并保留历史和人工成果](issues/11-update-protection.md)、[主动回合和练习配对在真实主图保存重开（首道门槛）](issues/12-first-chart-journey.md)、[从首页到实盘成交、回合复盘，再恢复来源](issues/13-live-entry-return.md)、[练习名称与日期口径](../trading-library-v11-design-decisions/issues/02-practice-names-dates.md)、[表格密度与标的显示规范](../trading-library-v11-design-decisions/issues/05-table-density-symbols.md)、[一次练习的账户与标的边界是什么？](issues/04-multi-scope.md)|独立报告+本票验收，初始NOT VERIFIED|
|15|[实盘按平仓回合看统计，趋势和分布下钻可返回](issues/15-live-statistics.md)|[从首页到实盘成交、回合复盘，再恢复来源](issues/13-live-entry-return.md)、[表格密度与标的显示规范](../trading-library-v11-design-decisions/issues/05-table-density-symbols.md)|独立报告+本票验收，初始NOT VERIFIED|
|16|[模拟统计显示练习金额、胜率、收益率与最差回撤](issues/16-simulation-metrics.md)|[独立模拟练习逐层进入回放，更正日期后仍属原练习](issues/14-simulation-entry-date.md)、[练习资金、结束估值与权益轨迹以什么来源为准？](issues/02-valuation-authority.md)、[一次练习的账户与标的边界是什么？](issues/04-multi-scope.md)|独立报告+本票验收，初始NOT VERIFIED|
|17|[模拟趋势与分布按练习下钻并恢复原选择](issues/17-simulation-distribution.md)|[实盘按平仓回合看统计，趋势和分布下钻可返回](issues/15-live-statistics.md)、[模拟统计显示练习金额、胜率、收益率与最差回撤](issues/16-simulation-metrics.md)|独立报告+本票验收，初始NOT VERIFIED|
|18|[范围失败、迟到请求和缺失输入均可解释并恢复](issues/18-failure-recovery.md)|[从首页到实盘成交、回合复盘，再恢复来源](issues/13-live-entry-return.md)、[独立模拟练习逐层进入回放，更正日期后仍属原练习](issues/14-simulation-entry-date.md)、[实盘按平仓回合看统计，趋势和分布下钻可返回](issues/15-live-statistics.md)、[模拟趋势与分布按练习下钻并恢复原选择](issues/17-simulation-distribution.md)、[非法范围和缺失账户参数怎样恢复到可修正状态？](issues/05-invalid-entry.md)|独立报告+本票验收，初始NOT VERIFIED|
|19|[独立核对整页控件、视觉和关键断点](issues/19-independent-control-visual.md)|[范围失败、迟到请求和缺失输入均可解释并恢复](issues/18-failure-recovery.md)|独立报告+本票验收，初始NOT VERIFIED|
|20|[协调者独立接受持久化、返回链与最终预览](issues/20-integrated-acceptance.md)|[独立核对整页控件、视觉和关键断点](issues/19-independent-control-visual.md)、[变更练习先选更新或新建，并保留历史和人工成果](issues/11-update-protection.md)、[主动回合和练习配对在真实主图保存重开（首道门槛）](issues/12-first-chart-journey.md)、[独立模拟练习逐层进入回放，更正日期后仍属原练习](issues/14-simulation-entry-date.md)、[实盘按平仓回合看统计，趋势和分布下钻可返回](issues/15-live-statistics.md)、[模拟趋势与分布按练习下钻并恢复原选择](issues/17-simulation-distribution.md)|独立报告+本票验收，初始NOT VERIFIED|

## 推进顺序与并行边界

1. 先查询决策frontier，建议先领取“旧数据怎样映射为独立练习并保留复盘引用？”核对本地证据；每会话只解决一张决策票。其余HITL按用户交流推进，已有票保持原Assignee/状态。
2. 日期、范围和数据契约冻结后，实施导入与等价重导；更新保护可在自己的前置清晰后推进。首条真实图表旅程独立接受前，不扩大依赖它的图表/状态/布局实现。
3. 首道门槛关闭后，由集成owner完成共享壳和实盘来源/返回合同，再接模拟练习链。统计owner可准备纯计算反例，但正式UI切片依赖已接受的用户入口/身份契约。
4. 实盘统计与模拟指标在文件所有权不冲突、冻结公共接口后可并行；共享STATS文件按owner串行落地。文件冲突是调度约束，不冒充产品依赖。
5. 统一异常恢复→独立控件/视觉→协调者真实持久化与最终预览接受。UI、状态安全、真实保存、独立视觉分别过门，不以票数量或worker报告宣布交付。

## 执行前必须补齐的确切契约

[接口与责任表](INTERFACES.md)定义现有入口与拟增边界。D01/D06及原有HITL决策完成后，派发人把精确类型签名、字段和批准草图链接回票；当前不伪造尚未确认的API/schema。不能把这份依赖计划直接当作可跳过决策的代码说明书。

本轮只拆票，不开始执行。未来实施沿项目默认的Luna分工与独立验收，无需为已授权任务重复询问流程偏好。

2026-10-26用户已确认[D04：练习唯一账户、唯一标的](comments/TL20-D04/2026-10-26-resolution.md)。该依赖已解除；I10/I14/I16采用单归属契约和完整源行核查，其他未决依赖仍保留。D01历史候选归属数组不作为应用接口，混合方向继续由原方向票处理。

## 已授权执行的第二批独立前置

本轮只拆票的历史范围已由用户后续开发授权覆盖。并行执行[范围核心](issues/22-practice-scope-core.md)与[日期核心](issues/23-practice-date-core.md)，不同Sol 6.1 Ultra及各自Luna 5.6 Max独立验收；批准规则、精确输入、owner、反例已冻结到派发合同/矩阵，不新增HITL答案。I10整旅程及I14未接受。

### Task 26: Replace the obsolete date candidate policy

Read `.scratch/trading-library-v20-development/evidence/dispatch/date-policy-requirements.md` first — it is your requirements, with the exact values to use verbatim. All scope, interface, source references, test cases, ownership, constraints and report path live in that one requirements file. This is an authorized revision of the existing pure date core; original product tasks remain open.


### Task 27: Prepare the complete TradingView source and compare content

Read `.scratch/trading-library-v20-development/evidence/dispatch/tradingview-practice-source-requirements.md` first — it is your requirements, with the exact values to use verbatim. Exact interfaces, ownership, complete byte-to-record pipeline, normalization and diagnostics, test cases, references and report location live there. Run only after all dependencies in issue27 are accepted; I10 remains open.

### Task 28: Reject bad files at the real import entry and recover

Read `.scratch/trading-library-v20-development/evidence/dispatch/import-preflight-ui-requirements.md` first — it is your requirements, with the exact values to use verbatim. Implement only after Task27 acceptance; root owns browser/control/data-safety and independent visual acceptance. This is the real rejection/retry/cancel slice, not whole-practice persistence or V2 library completion.

### Task 29: Keep preview metadata staged until the actual trade save succeeds

Read `.scratch/trading-library-v20-development/evidence/dispatch/preview-metadata-safety-requirements.md` first — it is your requirements, with the exact values to use verbatim. This repairs the actual Task28 cancellation write and the existing supplement input's CSV reachability. The original Task28 FAIL remains preserved; acceptance requires a newly frozen runtime, fresh uncached-symbol cancellation with adjacent database summaries, successful save/return/reload, real CSV supplement controls and separate independent visual review.
