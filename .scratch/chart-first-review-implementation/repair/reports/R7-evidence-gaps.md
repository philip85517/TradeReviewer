# R7 保存/结构化口径/人工证据定位

2026-09-27，`gpt-6-astra / low`。只读现有报告、日志和具体测试代码；没有运行测试、浏览器或修改产品/数据库。只写本文件。这里的“未找到”限定为本功能 reports/qa/repair/reports 及相关测试搜索，不声称任何地方绝无证据。

## US29/30：保存失败与冲突

**已有明确运行证明，属于组件自动化而非真实浏览器。**

- `app/components/recall/recall-workspace.test.tsx:385`，`exposes an awaitable leave guard that blocks navigation when saving fails`：repository.save拒绝network unavailable，添加drawing后leave guard返回false，alert显示错误。运行逐例✓见 `R7-workspace-regression-green.txt:259`。
- 同文件`:1443`，`preserves newer local edits and blocks leaving on a genuine external revision conflict`：首次成功revision1，后续409；明确断言冲突提示、快照编辑按钮仍在、submitted drawings/snapshots各1、expectedRevision仍1。运行逐例✓见 `R7-workspace-regression-green.txt:290`。这是输入/留存没有被冲突覆盖的直接自动化，不只有源码意图。
- 同文件`:402`，`keeps the newer local draft when an older save response arrives`；`:438`，`keeps a local edit dirty when the first delayed save resolves`，同R7逐例日志记录pass；另 `reports/final-review.md:31` 保留12 passed/99 skipped的历史独立受影响运行记录（明确包含leave guards/newer drafts/queued saves/external conflicts）。
- 服务端 `app/lib/recall/server-repository.test.ts:224`，`rejects stale capture evidence and CAS conflicts without changing projections`，及 `app/lib/recall/metric-projections.test.ts:73`，`rolls back JSON and every metric partition on projection failure and stale CAS`，分别证明CAS/事务回滚，不证明浏览器错误界面。

**日志重要限制：** `R7-workspace-regression-green.txt`名字含green，但结尾`:509–510`实际是1 failed、127 passed（2 files）。上述逐例✓可以引用；不得把整次运行写全绿。R5-full-unit也是3 failed/257 passed/3 skipped、21 failed/2406 passed/6 skipped，不能全绿化。

**真浏览器证据缺口：** 本次搜索未找到实际断网/服务器500/另客户端409→本地原输入仍在→恢复重试的点击序列/截图。已有R6完成→库→reload及A/B冻结通过不替代错误路径。没有发现新的产品失败；若项目要求此边界真实浏览器，仍应保留unverified。自动化的网络失败用例主要断言阻止离开和alert，没有直接断言任意文本字段原值，应准确限定范围。

## US37/38：结构化身份、分母、缺失、币种

**已有具体代码及运行历史，不应整体写“仅源码未验证”。**

1. `app/lib/recall/exit-evaluations.test.ts:28`，`keeps exits independent and distinguishes null uncertain and explicit decision/quantity denominators`：yes/no两笔给decisionRate .5、quantityRate .3；改uncertain后统计明确排除未知分母。`:113`附近 `rejects authoritative opening-decision evaluation and flags unknown quantity without zero substitution`：缺数量计missingQuantityDecisions=1及partial-quantity-coverage。`:130`，`preserves missing evidence pointers and explicit historical absence`：无评价数2且rates为null。`reports/05-evaluations.md`记录精确三文件运行13通过及后续17通过，覆盖这些行为；R5全量没有列该文件失败，但其精简日志不逐例列通过。
2. `app/lib/recall/metric-projections.test.ts:43`，`persists exact whole and exit metrics with typed source, missing reason and references`：实际SQLite查询typed currency/unit/method_version，净6760、退出4776/1984、risk缺失null+reason、document/capture revision与execution refs。其余用例覆盖重建旧值、事务回滚、formal/draft分区、legacy absence。`comments/chart-first-implementation-06/2026-09-26-resolution.md`有协调者30 focused+260 combined的运行记录，并有离线SQL bundle15 known6760/1.69、bundle11 unknown-fees的具体查询结果；这是历史可复用证据，不能伪称本轮再次运行。
3. `app/lib/recall/actual-metrics.test.ts:38`，`rejects cross currency and unknown cost or quantity`；`:70`，`keeps gross known when fees missing`；`:46`，`requires episode budget before second opening decision but permits split fills`；`:68`，`conserves exact golden partial fees and frozen R`。上列06协调者记录18 domain/30 focused并明确未知费用和跨币种范围；R5/R6实际unknown-fee/open-position图另提供UI缺失原因证据。
4. `app/lib/recall/manual-evaluation-projections.test.ts:33`，`projects manual drafts, immutable versions, evidence, associations, and bundle refs`，`R4-evaluation.md`精确8文件/62通过命令包含此文件。R4独立10通过是另一窄子集，不能误写其覆盖全部62。

**证据界限：** 上述覆盖单回合/决策统计分母与可查询结构化基础；未找到新建跨交易统计大屏的要求，也不应为了US38增加它。现有SQL行保留episode_id、scope、currency、reason及版本，消费者可以按明确范围抽取。若要声称跨交易聚合查询本身已验，应给具体查询/测试；当前06历史SQL只证明两个回合各自同版值，不能冒充任意跨交易统计。

## US39：实盘与各模拟运行隔离

**已存在上游测试、具体scope防护；缺口应精确定位，不要求UI统计大屏。**

- `app/lib/trades/episodes.test.ts:395`，`keeps live and simulated positions in separate episodes`；`:674`，`keeps broker opening inventory out of a simulation with the same account and symbol`；`:687`，`normalizes legacy simulated evidence into the same scope as the new simulation API`。
- `app/lib/reviews/trading-room-scope.test.ts:303`，`filters simulation runs and keeps performance dates inclusive`：构造live/run-a/run-b，实际filter仅返回run-a。该文件测试代码是明确两run隔离反例。
- `app/components/trade-review-workspace.test.tsx`，`retains alternate simulation runs when the complete room changes its shared scope`，`R7-workspace-regression-green.txt:250`有逐例✓，证明对应工作区消费者场景。
- `reports/performance-review.md`独立审查记录simulate排除/缓存同输出，协调者72 related通过；R5-full-unit全量的失败清单不含上述episodes/scope文件。由于精简日志没有逐例通过，不能从“2406”单独推定每个新加测试都在该版本运行；按历史运行证据复用，不标本轮独立重跑。
- `app/lib/recall/actual-metrics.ts:105`实际检查account/instrument/tradeNature，以及simulationRunId不匹配，返回scope错误。**在当前 `actual-metrics.test.ts` 未找到直接注入混live/run或不同simulationRunId的专门用例**。所以防护源码存在，上游分组有测试；“Recall指标入口自己拒绝混run payload”这一精确反例缺定向测试/运行证明，不应声称已单独验证，也不是已复现bug。

## E18：重导待确认及旧missing

**已有明确域、服务端、组件自动化运行；没有找到真实浏览器完整链。**

- `app/lib/recall/manual-evaluations.test.ts:110`，`requires explicit confirmation after the episode execution set changes`：执行集合变化后保持needs-confirmation，显式确认才更新。`R4-astra-review.md`独立运行3 files/10 passed/22 skipped的命令含此manual文件（名称匹配manual），明确表列“独立确认测试通过”。
- `app/lib/recall/server-repository.test.ts:79`，`rejects a new manual evidence pointer at the server boundary without advancing the CAS revision`；`:100`，`preserves an older manual evidence pointer when its source snapshot is later unavailable`。同R4独立10项覆盖；不等同于错误指针UI绘制。
- `app/components/recall/recall-manual-evaluations.test.tsx:39`，`shows an explicit confirmation action when the current episode execution set changed`：实际组件点击“确认使用当前回合成交”，断言onChangeDocument关联linked且executionIds正确。`:27`，`reads only selected immutable bundle revisions and shows explicit historical absence`：传missing-snapshot，断言稳定指针文字存在；空versionIds显示未记录。精确8文件62通过命令见 `R4-evaluation.md`，包含此组件文件；这是组件测试运行历史，而不是只有未执行测试源码。
- `app/lib/recall/exit-evaluations.test.ts:130`的missing Text revision/owner保留属于领域；manual组件当前用例显示的是missing snapshot，并非missing Text revision，两个范围不要混称。

**真实浏览器待验：** 本次搜索未找到重导改变成交集合→UI待确认→确认→保存/重开，以及真实旧missing Text revision显示稳定指针的路径截图/动作记录。R4-astra-review本身明确列它们unverified。最小补验应针对这些consumer边界，不需要再次全跑领域套件或新统计界面；也不允许为造missing状态写业务库。

## 建议回写矩阵

US29/30改为“组件错误/冲突保留局部pass＋真浏览器错误路径unverified”；US37/38改为“typed SQL与单回合分母/缺失/币种已有历史运行/SQL证据”，US39区分“上游运行隔离已有测试/消费者运行证据”与“Recall metric混run直接反例尚无定向证明”；E18保留真实consumer缺口，但撤销“确认/missing只有源码未跑”的误读。未发现需要立即交实现者修复的确定新缺陷。
