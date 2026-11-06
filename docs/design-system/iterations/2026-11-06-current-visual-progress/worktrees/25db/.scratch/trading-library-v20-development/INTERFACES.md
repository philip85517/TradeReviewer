# 接口、模块与责任

2026-10-26 当前决策：[练习名称与日期口径已由用户真实答复汇总接受](../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-resolution.md)。内部标题沿用“内部配对 1／2”，显示完整练习名称；文件名零/多/无效日期直接失败。原日期票已 closed/accepted，后文旧批次的 open/待确认表述仅为历史。I10 的本项决策依赖解除，具体源适配、生产 schema/API、保存/重导和端到端验收仍待实施；完整产品 NOT VERIFIED。

2026-10-26 最新用户变更：[导入文件名必须只识别一个有效日期，否则导入失败](../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-single-filename-date-confirmation.md)。取消导入候选选择/补填。修订后的日期纯核心已由 practice_date_policy_sol 实现，专属 date_policy_acceptance_luna 规格/质量双 PASS，并由 root 独立336项回归、项目类型检查和冻结包复算后[重新接受](evidence/I10-date-policy/acceptance.md)；下文旧批次 PASS 保留历史版本。validatePracticeDate 日历接口及历史/CSV/归属/指标核心接受不受该政策变更影响；完整产品仍 NOT VERIFIED。


这是派发合同草案，不能把未决数据来源或动作识别写成既定实现。D01只读事实准备现已接受，候选类型和调用链可供后续定案；D04已由用户确认单账户、单标的。仍须结合原日期/行为票及其余未决票，把下列生产语义边界冻结为精确类型签名与调用路径，再派发受阻开发票。`root`为当前协调者和整页视觉一致性owner；其余是单一责任角色，尚未受领，不是虚假Assignee。

|角色|唯一责任与共享文件|提供/消费及最终可见行为|
|---|---|---|
|INTEGRATOR（root）|app/components/trade-review-workspace.tsx；library-browse-state.ts；trade-library.tsx/.css；首页入口/返回接线|AppliedScope与ReturnContext；实际调用导入/日期保存、列表/统计切换、准确复盘目标；负责整个产品体验而非仅自己的文件|
|DATA（待派发Sol 6.1 Ultra）|SQLite contracts/store/repositories/http client；storage APIs；practice-contracts；practice-import/reimport/revisions|完整练习/版本/日期来源、内容等价/差异、事务写入和历史/人工引用；向真实bootstrap与消费者重读，不止可选callback|
|REPLAY（待派发Sol 6.1 Ultra）|human-action-rounds/practice-pairs；D06限定Recall适配；review-chart-workspace/replay-controls/episode-viewport|准确回合/配对上下文→双截止/暴露/草稿保存→原入口返回；不改变其他持仓账本的episode语义|
|LIBRARY（待派发Sol 6.1 Ultra）|拟增library-practice-list/detail/module.css；详情展示和日期表单|读取DATA，选择准确practice/pair，向INTEGRATOR请求保存/返回；不得直接改workspace或数据库事务|
|STATS（待派发Sol 6.1 Ultra）|拟增library-live-statistics/practice-performance；library-statistics/practice-statistics与样式；现有performance适配|同一scopeKey的金额/率资格集、round/practice统计、趋势/分布；显式对象ID进入真实容器；不得把其他页面旧performance语义全局替换|
|VISUAL-REVIEWER（未来非实现者）|只读产品，写控件、空间、同态截图及finding证据|直接参考vs渲染比较，重大差距交owner修复再独立复看；不能自签自己实现的UI|

执行模型按用户2026-10-26指令覆盖：实现为Sol 6.1 Ultra，每个实现者由不同Luna 5.6 Max验收；角色不是模型。当前实际领取和并发安排见[开发协调](EXECUTION.md)。

## 派发时冻结的语义边界

|契约|精确语义|冻结者 / 真实消费者|
|---|---|---|
|Practice identity/revision|一次文件全部记录、稳定id/版本/编号、唯一accountId和instrumentId、有效练习日及来源、历史区间/importedAt；不能以文件名或旧simulationRunId自动等同|D01+原日期票+[D04用户确认](comments/TL20-D04/2026-10-26-resolution.md)；DATA→bootstrap/list/detail/stats/replay|
|Import preview/commit|完整多重集等价、候选差异、用户选择、expectedRevision、原子事务、受影响引用/历史；确认前不变更|D01+D03；DATA→导入确认→workspace commit→重读|
|Human action/round/pair|原成交id、人的动作证据、主动回合id、开仓来源分配、原数量、部分数量、费用去重；配对不跨练习|原行为票+D06；REPLAY→实盘列表/统计和模拟详情|
|Valuation and metric eligibility|每练习结束时点/权威价格/正本金/费用属性/权益轨迹与缺失原因；金额、率、MDD各自覆盖|D02；DATA→STATS→信息i/分布/下钻|
|Applied scope|URL字段按H入口，mode live/sim，日期/市场/账户共享当前列表统计；lastComplete+failedTarget+generation分离|原选择器票+D05；INTEGRATOR→列表/统计真实读取|
|Return context|mode/准确对象/日期/市场/账户/search/filter/sort/page/scroll/focus；首页贡献两模式独立快照；对象消失回容器标题|INTEGRATOR→实际入口、REPLAY和各级返回|
|Replay saved state|phase、marketCutoff、executionCutoff、selectedDecision、Text所属、exposure来源、viewport与草稿版本；须定义原子更新组合|D06；REPLAY→已有服务端保存/关闭重开|

候选新增文件只有在上述契约和现有模块边界核实后才确定；按行为需求拆而不是为每层建票。跨owner修改由唯一owner写入；如后续调整接口，同步所有消费者、矩阵和受阻票。相互独立的纯计算/数据准备可并行，但不绕过真实图表接受门槛。

## 已接受的独立计算接口

用户确认的[单账户、单标的边界](comments/TL20-D04/2026-10-26-resolution.md)覆盖D01历史候选的归属数组：后续应用契约使用单个`accountId`和可区分市场的`instrumentId`。DATA核对完整源记录，不自动拆分或丢弃冲突行；多归属或归属未明不能保存为有效练习。LIBRARY/STATS以唯一归属筛选整份练习，不合并同账户的练习或权益。具体方向分类仍由原方向票决定，此决策不批准默认账户或选择器联动。唯一归属纯校验已接受，见下；完整导入及保存运行时尚未实施。

D01已接受的[事实与候选声明](evidence/root-D01/acceptance.md)仅用于后续设计：现系统缺少一等practice/revision身份，完整源文件不能由accepted executions还原，旧run不能直接当practice，Recall同ID财务变化仍有失效判定缺口。`candidate-contracts.ts`不属于应用export，不是已落地API；元数据/内容双版本CAS、完整行比较、事务和旧引用保护仍需运行时实现和独立验收。

`TL20-I16-CORE`仅冻结[practice-metrics.ts](../../app/lib/trades/practice-metrics.ts)当前export：`calculatePracticeMetrics(PracticeMetricsInput): PracticeMetrics`、`calculatePracticeDrawdown(PracticeEquityPath | null): PracticeMetric`、`summarizePracticeMetrics(readonly PracticeMetricsInput[]): PracticeMetricsSummary`。完整只读输入/输出类型以源码和[冻结包hash](evidence/I16-core/review-package.json)为准；[接受边界](evidence/I16-core/acceptance.md)。

未来DATA适配须显式确证同币种、gross/net覆盖整笔已实现与余仓及费用、残余结束浮动、练习正本金、完整且严格有序并含一致估值/费用和已处理外部流的权益路径。无法确证就传unknown及原因，不用当前价/账户本金/零值补造。返回Decimal字符串或带原因null，金额/率/MDD各自coverage；重复ID/混币抛RangeError，消费者必须在调用前处理。该拒绝边界不批准混币产品UX。当前没有产品调用者，不冻结D02来源或未决交互，也不接受I16页面。

## 第二批独立校验接口（已接受纯核心）

Historical interface (superseded for import by task26): [范围合同](evidence/dispatch/practice-scope-brief.md)：validatePracticeScope(PracticeScopeInput): PracticeScopeValidation，显式完整性+全部源行的accountId/canonical instrumentId，未明/多归属拒绝；[日期合同](evidence/dispatch/practice-date-brief.md)：validatePracticeDate(string|null)、resolvePracticeDateCandidate(PracticeDateCandidateInput)，严格日历+全部已提取候选+本次明确人工输入。唯一写入owner分别practice_scope_sol和practice_date_sol，只写两对独立新文件。未来DATA adapter负责真实完整源行/候选提取，当前无产品消费者。两项纯核心的实际只读判别联合已由专属Luna及root接受，准确签名以各源码和冻结hash为准；未冻结任何外部JSON或持久化API。

日期编号决策：用户已[确认冲突只改被更正练习](../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-date-number-conflict-confirmation.md)，保留ID、复盘和编号历史，目标日期同标的下分配下一个未用号，其他练习不重排。运行时NOT VERIFIED；原日期票剩余问题仍open。

跨午夜日期决策：用户已[确认保留一份练习并在导入确认页选定单个日期](../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-cross-midnight-confirmation.md)，标题、筛选与统计统一归属，不按历史成交日拆分；真实导入、持久化及统计接线仍NOT VERIFIED。 Current override: keep one practice, but derive its import date only from the unique valid filename occurrence; the earlier import date chooser is withdrawn.

Historical interface (superseded for import by task26): 日期纯核心已[接受](evidence/I10-date/acceptance.md)，冻结实际exports `validatePracticeDate(string | null): PracticeDateValidation`、`resolvePracticeDateCandidate(PracticeDateCandidateInput): PracticeDateResolution`，类型以[源码](../../app/lib/trades/practice-date.ts)及[17项工人冻结hash](evidence/I10-date/review-package.json)为准。返回有效date/source或needs-confirmation加missing/invalid/ambiguous；人工优先仅指本次明确输入，此句仅记旧版本：当时真实文件名提取、原人工日期保护和任意外部JSON shape验证归未来DATA adapter；当前文件名提取已由 task26 重新实施，尚未接受。源完整性/日期保存并未因此验证。

归属纯核心已[接受](evidence/I10-scope/acceptance.md)，实际export `validatePracticeScope(PracticeScopeInput): PracticeScopeValidation`，类型以[源码](../../app/lib/trades/practice-scope.ts)及[26项工人冻结hash](evidence/I10-scope/review-package.json)为准。完整、非空、每行有效且单账户/单规范标的才返回身份，否则返回稳定顺序diagnostics及全部适用零基原行indexes；不trim账户、不修正规范ID、不生成合格子集。未来DATA必须传入完整源行、保留解析拒绝/未配对行并诚实声明完整性；这些真实提取及保存行为仍NOT VERIFIED。

历史时间异常决策：用户已[确认缺失/无效时阻止导入并定位全部问题原行](../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-invalid-history-confirmation.md)，修正源文件后重试，不丢行或使用有效子集冒充完整区间。该确认未证明实际 parser、UI 或持久化已支持。Original date ticket now only retains its other undecided scope; filename conflicts fail import.

## 第三批技术合同（仅纯函数已接受）

[历史日期合同](evidence/dispatch/practice-history-brief.md)冻结 validatePracticeHistory(PracticeHistoryInput): PracticeHistoryValidation，全部源本地日历DTO及显式完整性→全量起止或全部问题索引；不能证明原始timestamp有效或调用方没漏行。[CSV来源合同](evidence/dispatch/practice-csv-source-brief.md)冻结 parsePracticeCsvSource(string): PracticeCsvSourceResult，严格词法→含表头/空/重复/坏业务值的全部逻辑记录及原UTF-16范围/物理行；不能证明业务有效。唯一写入owner分别practice_history_sol、practice_csv_source_sol，无共享或未冻结调用依赖。未来DATA adapter负责实际decode/表头识别/所有原时间严格解析/源身份映射/原文件留存并诚实声明完整性，再接已经接受的范围/日期及历史核心；现生产parser不变，不借词法valid批准保存。

两项纯合同已分别由专属不同Luna双审及root接受：[历史核心](evidence/I10-history/acceptance.md)、[CSV来源](evidence/I10-csv-source/acceptance.md)。只解除对应纯函数前置；实际调用方、原时间解析、物理行UI及保存重读尚未接入，完整I10与产品接口门仍NOT VERIFIED。

## Current filename date API, pending independent acceptance

Task26 replaces the unused candidate/manual resolver with resolvePracticeDateFromFilename(fileName: string): PracticeDateResolution. It accepts a single File.name basename, recognizes YYYYMMDD or YYYY-MM-DD occurrences, and returns valid/date/source=filename only for exactly one calendar-valid occurrence; otherwise invalid with missing/ambiguous/invalid reason. No manual input or needs-confirmation outcome remains. validatePracticeDate signature/results stay compatible with history. Two-date source files are the only changed product files; see evidence/dispatch/date-policy-requirements.md. Future I10 validates every incoming filename before duplicate/update handling; a valid incoming filename does not authorize overwriting a stored manual date. Real adapter/persistence is still NOT VERIFIED.

## 下一段完整来源合同 / Task27（待依赖接受后派发）

[精确技术合同](evidence/dispatch/tradingview-practice-source-requirements.md)冻结完整 Uint8Array 与 File.name、显式整份格式 context 的真实组合；prepareTradingViewPracticeSource 只生成完整源/元数据预检或全量诊断，compareTradingViewPracticeContent 只比较全部17列内容次数。生产 DATA owner 后续接入 import preview/commit，单独核实账户/标的/当前确认日期与人工保护。没有适配调用者或生产归属认证已完成的声明；prepared 与 content equal 都不是保存授权或练习身份。业务未知值按 raw 完整保留，其最终业务接纳政策不在此模块决定。


## Task27 当前接受与 Task28 消费者

[完整源纯模块已接受](evidence/I10-tradingview-source/acceptance.md)。Task28在既有模拟parser中用当前规范账户常量及同一证券推断/明确确认声明整份context，消费实际完整bytes的预检拒绝结果，按现有diagnostic映射原物理位置并在工作区保留全部错误。prepared后保留既有财务配对和ID，不保存未使用元数据；内容比较尚未接生产身份/重导。精确合同与范围见[evidence/dispatch/import-preflight-ui-requirements.md](evidence/dispatch/import-preflight-ui-requirements.md)，该消费者仍NOT VERIFIED。
