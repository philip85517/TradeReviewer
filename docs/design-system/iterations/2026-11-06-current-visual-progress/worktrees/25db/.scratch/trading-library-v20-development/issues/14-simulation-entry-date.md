2026-10-29：列表指标[独立限定复验](../evidence/I14-practice-list/list-metrics-independent-round1-20261029/report.md)通过；[协调者隔离浏览器](../evidence/I14-practice-list/list-metrics-coordinator-browser-20261029.md)发现详情未平仓未知、与列表的 0 不一致，FAIL，首轮修复中。整体列表与 V2 未验收。

2026-10-29：协调者在隔离合成库实际截取 1440×1000 与 1280×800 桌面列表；[独立静态对照](../evidence/I14-practice-list/first-load-20261029/independent/list-visual-independent-comparison-20261029.md)发现额外入口和工具区影响首屏位置、列对齐差异。两行与参考六行不属同态，且代码并行变化；不能用其作为最终冻结版视觉通过或失败。搜索及生效摘要有正文依据，不能据参考图缺失而删除；完整视觉、首次加载与空/失败/重试仍 NOT VERIFIED。

2026-10-29：桌面导航对齐第 1/5 轮[独立局部复验 PASS](../evidence/I14-practice-list/workspace-20261029/sidebar-alignment-independent-fix1-20261029.md)；协调者隔离浏览器观察鼠标到首页及键盘返回、独立重跑 57/57。保留偏左 FAIL；独立操作、1280 桌面、整页视觉 NOT VERIFIED（第二截图实际 1152×800）。

2026-10-29：共享导航首页房屋图标经[独立局部截图对照](evidence/I14-practice-list/workspace-20261029/home-icon-20261029/independent-review-20261029.md) PASS；协调者在隔离浏览器完成鼠标与键盘往返。审查发现侧栏整组位置偏左，需独立修复；独立浏览器操作及完整同态视觉仍 NOT VERIFIED。

2026-10-29：共享导航首页标签修复[独立截图对照](../evidence/I14-practice-list/workspace-20261029/home-label-independent-review-20261029.md)文字局部 PASS；协调者隔离浏览器鼠标及键盘往返通过，独立操作因审查者浏览器不可用仍 NOT VERIFIED。原画板房屋图标与当前四格图标不符，独立审查另列 FAIL，正在修复；整页视觉、正式迁移和完整 V2 仍未验收。

2026-10-29：1440 桌面截图与批准规范的[独立局部对照](../evidence/I14-practice-list/workspace-20261029/independent-1440-partial-visual-20261029.md)发现模拟工作区背景及顶部强调线不符，FAIL；第 1/5 轮修复中。截图与画板数据状态不同，完整同态视觉 NOT VERIFIED。触屏和窄屏按用户要求排除。

2026-10-29 更新：I14 视觉第 2/5 轮修复经[独立局部复验](../evidence/I14-practice-list/workspace-20261029/independent-visual-fix-round2-20261029.md)确认侧栏文字和选中项可读；该结论仅覆盖已有 1280×720、两条练习截图，非 1440×1000 六行同态完整视觉验收，首页文案和其他差异仍待核对。前一轮 FAIL 保留。I16 统计页及共同筛选接线开发中；I12 详情状态接线开发中。

2026-10-29 更新：I14 旧账户筛选及相关回归第 1/5 轮修复经[独立限定复验](../evidence/I14-practice-list/workspace-20261029/independent-regression-round1-20261029.md)通过，混合账户与失败重试反例 2/2、四项原回归定向 4/4；回放测试只证明该样本可见计数边界。视觉第 1/5 轮[独立复验](../evidence/I14-practice-list/workspace-20261029/independent-visual-fix-round1-20261029.md)仍 FAIL，侧栏文字缺失，原 FAIL 保留，第 2/5 轮修复中。

2026-10-29 更新：I14 工作区回归第 1/5 轮修复后，协调者运行工作区测试 **93/93 通过**，日志见 [回归日志](../evidence/I14-practice-list/workspace-20261029/coordinator-regression-round1.log)；运行期间关联页面仍在开发，冻结代码后的最终回归仍未验证。视觉修复第 1/5 轮在 [1280×720、两条合成练习截图](../evidence/I14-practice-list/workspace-20261029/visual-fix-round1-1280x720-two-practices.png) 中使选中项可读、侧栏收窄；独立复核发现侧栏文字被隐藏，与画板不符，转入第 2/5 轮。1440×1000 六行同态视觉及完整交互仍 NOT VERIFIED，原 FAIL 保留。

# 独立模拟练习逐层进入回放，更正日期后仍属原练习

2026-10-29 后续：I14 练习日期更正的[隔离持久化测试](../evidence/I14-practice-list/isolated-persistence-journey-20261029.md)经[独立复核](../evidence/I14-practice-list/isolated-persistence-independent-20261029.md)限定 PASS，协调者重跑 36/36；该审查者曾实现列表，但未实现新增测试，故仅接受新增数据链测试范围。日期冲突为同日编号冲突，不是并发冲突。新测试未直接比较首次输入与保存字节；旧复盘、工作区、实际网络/浏览器及同态视觉仍 NOT VERIFIED。


2026-10-29 更新：账户模式记忆第 2/5 轮[独立复验](../evidence/I14-practice-list/independent-account-memory-round2-20261029.md)限定组件与状态合同 PASS；协调者核对冻结 SHA 并以隔离数据库重跑 6/6。保留第 1 轮 FAIL；真实浏览器、完整视觉及新版列表接线仍 NOT VERIFIED，不能视为 I14 完成。


2026-10-29：[账户模式记忆独立复核](../evidence/I14-practice-list/independent-account-memory-20261029.md) FAIL；规范控件的完整参数在组件测试中通过，但类型允许的部分更新存在跨模式账户污染反例，第 2/5 轮限定组件和状态合同已独立复验通过（见上方更新）。真实浏览器的切换和刷新恢复 NOT VERIFIED；实际工作区仍未接入新版练习列表。单次资金入口经源码确认可达，现有 key 保护练习切换，但浏览器写入和 A/B 切换未复验。

列表刷新后所选账户暂时没有练习时错误显示全部账户的问题，[第 1/5 轮独立复验](../evidence/I14-practice-list/account-refresh-independent-review-round1-20261029.md)在冻结版本、合成组件范围 PASS；协调者复跑组件 19/19 及独立反例 4/4。工作区接线、真实浏览器、服务端授权及同态视觉仍 NOT VERIFIED。

## 2026-10-28 日期更正存储层独立复核：FAIL，修复第 1/5 轮

独立代理在临时隔离 SQLite 上用真实绑定链路复现两项问题：已有旧成交及复盘引用的练习更正日期时报 `legacy-migration-policy-required`，事务回滚；更正后的练习用相同原文件重新导入时返回 `manual-date-conflict`，未能按既定规则打开原练习。两次检查均保留原练习、复盘及人工日期，不代表数据丢失。原实现者按这两项反例修复，待不同代理重新验收；API、页面、真实返回重开均未验收，I14 保持 open。

ID: TL20-I14
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root
Owner role: LIBRARY
Priority: P0

## Scope / What to build

实盘切模拟→练习列表→练习详情→内部配对→回放→逐层返回；更正练习日→保存→筛选/标题变化→reload→切回实盘。

- 模拟表以练习为入口，成交条数/内部配对数/余仓独立；同标的同日A/B不混入；内部预览仅按旧D05最终决定实现，指标标明内部口径。
- 按[D04用户确认](../comments/TL20-D04/2026-10-26-resolution.md)，练习只展示唯一账户和标的，沿用既定名称/稳定编号；筛选匹配唯一归属，整份练习进入详情，不增加多标的名称。一个账户多练习仍分别保存和展示。
- 练习日期、历史区间、导入时间分列追溯；更正有效日期按旧D02处理命名冲突，id及既有作品不变，标题/排序/筛选/统计同步。空或非法不能保存，重导不覆盖人工确认。
- 两模式日期/市场/账户/搜索/排序/分页/滚动/焦点各自恢复；列表/统计共享当前mode范围，不将实盘账户当练习身份。
- 复用容器，不增中间页/双栏；配对只属于当前练习，开仓来源与原数量清楚，未配对不生成已闭合回放。

本票是独立开发任务，不是wayfinder决策子票。ready-for-agent表示范围已描述；所有依赖accepted且closed、具体接口/待决交互冻结后才能领取，禁止实现者填补业务政策。局部接受不代表功能整体接受。

## Refs

- [docs/design-system/trading-library-design-spec.md](../../../docs/design-system/trading-library-design-spec.md)，L23–61
- [docs/design-system/trading-library-design-spec.md](../../../docs/design-system/trading-library-design-spec.md)，L81–87
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L101–116
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L142–169
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L258–298
- [approved-e-sim-list-1440.jpg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/approved-e-sim-list-1440.jpg)
- [hcr06-final-sim-ab.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-sim-ab.svg)
- [hcr06-final-rounds-a.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-rounds-a.svg)
- [hcr06-final-replay-a1.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-replay-a1.svg)
- [hcr06-final-replay-a2.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-replay-a2.svg)
- [journeys-rounds-a-return.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-rounds-a-return.svg)
- [journeys-simulation-return.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-simulation-return.svg)
- [journeys-rounds-b.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-rounds-b.svg)
- [hcr06-final-replay-b1.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-replay-b1.svg)
- [journeys-view-simulation.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-view-simulation.svg)
- [journeys-view-restore.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-view-restore.svg)
- [覆盖矩阵](../DESIGN-COVERAGE.md)中Owner为本票的各行；element/control ID为本轮规划本地ID，正文只有章节/文档stable-id，不能借用别的功能元素全集。
- [视觉契约](../visual-contract.md)、[接口与文件责任](../INTERFACES.md)、[回放转移契约](../REPLAY-STATE-CONTRACT.md)、[控件登记计划](../CONTROL-INVENTORY.md)。D03/D02等新增交互使用决策完成后批准的稿件，不拿不相干参考图代替。

## Blocked by

- [主动回合和练习配对在真实主图保存重开（首道门槛）](12-first-chart-journey.md)
- [从首页到实盘成交、回合复盘，再恢复来源](13-live-entry-return.md)
- [练习名称与日期口径](../../trading-library-v11-design-decisions/issues/02-practice-names-dates.md)
- [表格密度与标的显示规范](../../trading-library-v11-design-decisions/issues/05-table-density-symbols.md)
- [一次练习的账户与标的边界是什么？](04-multi-scope.md)

## 实施与验证步骤

下列尚不存在的定向测试文件是本票拟增测试落点，执行前核对现有测试组织；它们不是本轮已运行或已通过的检查。

- [ ] 重新读完整原规格/准确状态图、相关矩阵行、所有依赖Resolution与契约；按生命周期领取唯一Assignee，冻结允许修改文件及实际类型签名。有新不明业务问题回决策票。
- [ ] 为 `practice-isolation-and-return` 先建立行为反例并确认失败：同标的同日A/B→A详情只有A配对→返回A焦点/原范围；进入B从B详情开始，不能混配。
- [ ] 为 `practice-date-edit-persists` 先建立行为反例并确认失败：改日期不新增id/编号，三时间可追溯，reload及统计归属一致；无效拒存、重导保留人工日、冲突按批准流程。
- [ ] 为 `mode-memory` 先建立行为反例并确认失败：实盘10/1–15与模拟10/15–19不同账户/排序/页码→来回切换/刷新保留各自状态，列表统计共享当前范围。
- [ ] 在允许范围内实现上列可观察旅程，连接真实提供方/消费者；不扩大任务、不再派代理、不重写全局架构。
- [ ] 执行定向检查：`npm run test:unit -- app/components/library/library-practice-list.test.tsx app/components/library/library-practice-detail.test.tsx app/components/library/library-browse-state.test.ts app/api/storage/practices/route.test.ts`；实现任务保留失败到通过日志，审计/接受任务保留实际操作证据，不用结构验证代替产品。
- [ ] 显式隔离库，真实操作本票旅程及取消/失败/返回/reload；前端按CONTROL-INVENTORY登记动态实例并记录点击前中后空间/状态链；无写入部分说明范围依据。
- [ ] 非实现者直接看参考与同状态渲染图，协调者独立复核后记录各门槛。检查受影响上游/下游，失败保留并交回owner。

## 验收标准与反例

- [ ] 同标的同日A/B→A详情只有A配对→返回A焦点/原范围；进入B从B详情开始，不能混配；证据记录在本票独立报告内。
- [ ] 改日期不新增id/编号，三时间可追溯，reload及统计归属一致；无效拒存、重导保留人工日、冲突按批准流程；证据记录在本票独立报告内。
- [ ] 实盘10/1–15与模拟10/15–19不同账户/排序/页码→来回切换/刷新保留各自状态，列表统计共享当前范围；证据记录在本票独立报告内。
- [ ] 控件检查触发：本票影响/检查前端；范围：完整模拟列表/练习详情及更正日期窗口、内部配对动态行、两模式切换和逐层返回。
- [ ] 不引入未批准的尺寸、默认折叠/阶段、阈值、行情来源或账户默认；无用户授权差异。
- [ ] 参考与渲染版本、CSS视口/缩放/DPR/状态/数据可比；功能、端到端和视觉分别签结论，不以单测/回调/HTTP成功替代。

## 派发说明

- 默认实现模型 Luna (`gpt-5.6-luna`)，协调者 root 独立review/接受；本轮没有派发执行。
- 候选文件范围（技术落点，非产品需求；派发前按契约核实并锁定）：
- `app/components/library/library-practice-detail.tsx（拟新增，复用现有容器）`
- `app/components/library/library-practice-list.tsx（拟新增）`
- `app/components/library/library-practice.module.css（拟新增）`
- `app/lib/trades/practice-contracts.ts（DATA写入）`
- `app/api/storage/practices/route.ts（拟新增，DATA写入）`
- 输入/输出与接线：LIBRARY实现practice列表/详情；INTEGRATOR接入共享壳和mode记忆，DATA接日期expectedRevision写入API；REPLAY消费practiceId+pairId并返回精确入口。契约在D01/D06冻结后使用，不新增孤立callback。
- 共享文件只由INTERFACES指定owner写；跨owner变更交接给owner，不能并行覆盖。完整页视觉owner为root；完整持久化流owner为DATA；角色未落实到具体受领人前不得执行。
- 禁止：写业务库、变更conf绝对业务库/端口、静默合并/删除人工成果、将mock图/fixture当真实验收、push/merge/publish、擅自扩大或再派子代理。

## 验收证据

实际功能、真实持久化/返回链、独立视觉均 NOT VERIFIED。 未来报告位置：`../evidence/I14/report.md`，每个勾选链接实际日志/截图/持久化重读结果。报告头包含commit/dirty内容manifest、worktree、时间、服务URL/会话、显式隔离库、数据范围、CSS视口/缩放/DPR、输入方式和排除依据。该目录尚未产生证据。

协调者接受：尚未接受。回归须保留旧证据，重开本票并同步README、DESIGN-COVERAGE与FINAL-ACCEPTANCE。

## 历史

- 2026-10-26 拆票：open / ready-for-agent / unassigned；依赖未解除，未实施/未验收。

## 当前导入日期规则覆盖

[用户最新确认](../../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-single-filename-date-confirmation.md)：只读导入文件名，必须只识别一个有效日期；缺失、无效、多个直接导入失败，改名重试，不提供候选选择或补填。详情更正、编号冲突处理和重导保护人工日期沿用既有确认；不以这些值放过不合格文件名。真实导入/保存/返回/reload 仍 NOT VERIFIED。

当前命名决策：[练习名称与日期口径已接受](../../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-resolution.md)。内部配对标题显示完整练习名与“内部配对 N”；更正日期后沿用原 practiceId，标题与归属更新，稳定编号冲突按原确认处理。运行时与视觉证据仍未验证。

2026-10-28 新的真实桌面浏览器证据：隔离库已有一份可从数据页重开的完整练习，但切到交易库“模拟盘”后显示“还没有导入交易”，见 [截图](../evidence/I10-practice-persistence/root/simulation-library-empty-20261028.png)。只读代码诊断：当前交易库从旧 executions 构建列表，未读取 PracticeStore 的练习/来源；不能据空态断言原始资料丢失。practice-http-client 当前严格要求 awaiting-policy/空 executionRefs，后续投影接线必须同步演进契约与测试。真实图表首旅程及有关业务决策仍是前置，不以数据页来源重开冒充 V2 列表完成。

2026-10-28 日期更正存储修复第 1/5 轮独立复验 FAIL：旧关联更正及单候选原文件重导已通过，但一个唯一等价练习旁存在不同内容候选时，preview 和 commit 误拒绝，不符合等价重导打开原练习的规则。两个反例均只读且未写入；多个等价候选仍应阻止歧义。已交原实现者进行第 2/5 轮修复，API、界面和完整票仍未验收。

2026-10-28 日期更正存储修复第 2/5 轮独立复验：限定存储范围 PASS，23/23 测试通过；唯一等价候选可重开，多等价候选仍阻断，关联、编号和并发保护已覆盖。详见 [独立复验](../evidence/practice-date-storage-round2-independent-20261028.md)。日期 API、页面操作、真实重读与整票验收仍未完成。

2026-10-28 后续：日期更正 HTTP API 与客户端经未参与实现的代理[独立验收](../evidence/I14-date-api-independent-20261028.md)通过限定数据契约切片；协调者以直接 Vitest 重跑 2 文件 27/27。页面接线、浏览器持久化、返回及完整 I14 尚未验收。

2026-10-28 列表与详情后续：独立列表审查发现共享账户范围外的筛选选项、倒置日期误报为空结果、刷新失败时筛选区消失，代码切片 FAIL；[报告和反例](../evidence/I14-practice-list/independent-code-20261028.md)。上述局部问题进入第 1/5 轮修复。列表尚未接入真实工作区，搜索、排序、分页及返回状态仍缺失，不能据局部组件测试认定已交付。日期更正控件在独立文件开发，尚未接线。另据[真实数据审计](../evidence/I14-practice-list/detail-data-audit-20261028.md)，原始记录尚未形成已确认成交和可持久化内部配对，必须保持未知，不能把原始行或设计稿数字直接展示为配对与盈亏；完整 I14 和真实回放继续 NOT VERIFIED。

2026-10-28 局部复验：列表上述三项第 1/5 轮[独立复验](../evidence/I14-practice-list/independent-round1-20261028.md)通过，并覆盖刷新失败期间切换共享范围与请求乱序；不解除页面挂载、搜索排序分页、回放或视觉门槛。日期控件新增后协调者运行 `npm run typecheck` 通过，并直接运行日期与列表两个测试文件 15/15 通过；日期控件独立审查、真实页面接线和数据库持久化旅程仍未完成。

2026-10-28 列表搜索、排序与分页的[独立复验](../evidence/I14-practice-list/independent-navigation-20261028.md) FAIL：内部配对标题错误、共享账户范围为空时提示不准确、账户显示内部 ID。第 1/5 轮修复进行中。日期控件第 1/5 轮[独立复验](../evidence/I14-date-ui/independent-round1-20261028.md) FAIL：保存结果未知后取消仍可能显示旧日期；不同练习的重读结果也需在控件边界拒绝。第 2/5 轮修复进行中。功能、真实持久化、返回链与整页视觉仍未验收。

2026-10-28 后续：列表搜索等修复经[独立复验](../evidence/I14-practice-list/independent-navigation-round1-20261028.md)通过；日期控件第 3/5 轮经[独立复验](../evidence/I14-date-ui/independent-round3-20261028.md)通过组件和隔离库接口范围。详情首版[独立复验](../evidence/I14-practice-detail/independent-20261028.md)视觉层级、数值对齐和费用说明 FAIL，正在修复。浏览接线[独立复验](../evidence/I14-practice-browser/independent-20261028.md)发现保存未完成或结果未知时仍可返回、筛选移除原行后焦点丢失，进入第 1/5 轮修复；页面级离开和滚动、真实浏览器、完整持久化及整页视觉均 NOT VERIFIED。

2026-10-28 协调者补充：浏览组件修复后，日期控件、详情与浏览三个测试文件 41/41 通过；新增向外层传递保存/重读期间导航阻塞状态的测试先失败、实现后浏览组件 5/5 通过。外层工作区尚未接线，主导航与共享筛选仍须实际验证；上述仅为局部自动测试，独立复验和整页交付仍未完成。

2026-10-28 [详情第 2 轮独立复验](../evidence/I14-practice-detail/independent-round2-20261028.md)：组件测试、定向 lint 和类型检查通过；但已有旧成交绑定时仍提示没有已确认成交，语义 FAIL，交原实现者第 2/5 轮修复。真实浏览器、键盘、悬停及独立视觉对照 NOT VERIFIED。

2026-10-29 工作区[接线阻断](../evidence/I14-practice-list/workspace-integration-blocker-20261029.md)：现有插槽替换旧模拟列表，覆盖不明时会遮挡旧交易和复盘；已开发[只读覆盖边界](../evidence/I14-practice-list/legacy-coverage-boundary-20261029.md)，独立验收中，存在未核实 Recall 表时返回不可判定。旧入口保持可见，真实接线和视觉 NOT VERIFIED。

2026-10-29 I14 覆盖边界[第 1/5 轮有界独立验收 PASS](../evidence/I14-practice-list/legacy-coverage-independent-round1-20261029.md)：隔离库回归 76/76、独立反例 4/4；未核对 Recall 数据导致不可判定。实际旧库、旧入口、正式迁移、工作区接线及视觉 NOT VERIFIED。

2026-10-29 工作区接线实施范围：`period_reader_independent` 负责旧模拟入口保全、新练习入口及导航状态；映射和视觉偏差见 DESIGN-COVERAGE「I14 工作区接线：实施前范围」。TDD 从用户可观察的工作区切换/进入/返回开始；旧回顾真实保存重开、桌面浏览器与独立视觉尚未验收。

2026-10-29：I14 模拟工作区底色、强调线在限定版本的 [独立截图对照](evidence/I14-practice-list/workspace-20261029/sim-surface-independent-fix1-20261029.md)局部 PASS，但侧栏首页文案不符 **FAIL**，修复中；全页同态及完整控件独立验收 NOT VERIFIED。协调者在六条合成练习的隔离浏览器中验证日期筛选、列表/统计及基本模式切换，并验证统计长页模拟滚轮，见 `evidence/I14-practice-list/workspace-20261029/coordinator-desktop-interactions-20261029.md`；物理触控板、完整返回链和整体 V2 仍未验收。
2026-10-29 列表首读独立组件探针：加载中六行占位，空或失败后占位移除，而容器无高度下限；错误提示放在结果卡之前。该状态与 V2 正文第 55 行要求结果区位置、尺寸稳定存在冲突。原始探针与日志保留在 `evidence/I14-practice-list/first-load-20261029/independent/`；第 1/5 轮修复进行中，真实浏览器几何及视觉 NOT VERIFIED。

2026-10-29 后续：首读结果区第 1/5 轮[独立组件及样式复验](../evidence/I14-practice-list/first-load-20261029/independent/fix1-review.md)限定 PASS，独立反例 5/5、定向套件 33/33，协调者另复跑 33/33。此前首验 FAIL 保留；实际桌面浏览器几何和同态视觉仍 NOT VERIFIED。

2026-10-29：1280×720 隔离浏览器中，正常数据和搜索无匹配的结果外框位置、大小一致；见[协调者记录](../evidence/I14-practice-list/first-load-20261029/coordinator-browser-partial-20261029.md)和[独立截图核查](../evidence/I14-practice-list/first-load-20261029/independent/coordinator-browser-review-20261029.md)。表头横向位置变化待进一步核对规范；初始空库、读取中、失败、重试及规定视口的同态视觉仍未验证。


# 2026-10-29 未平仓数量补充

[隔离浏览器观察](../evidence/I14-practice-list/detail-open-quantity-fix-20261029/coordinator-reload-observation.md)中普通合成练习的列表与详情均显示 0，刷新后重新进入仍显示 0；不代表自动恢复详情。[独立首轮](../evidence/I14-practice-list/detail-open-quantity-independent-round1-20261029.md)发现合法数值格式被错误显示为未知，首轮 FAIL，第 2/5 次修复中；极小合法数量标准化后客户端拒绝另行诊断。完整功能和视觉未验收。

第 2/5 次[修复记录](../evidence/I14-practice-list/detail-open-quantity-fix-round2-20261029.md)：四种合法格式经隔离导入与详情测试先红后绿，作者 19/19；协调者使用显式隔离路径分别复跑集成 7/7 和详情组件 12/12。该版本仍待非作者独立复验、真实浏览器与视觉检查；保留首轮 FAIL。

另一个[微小数量隔离诊断](../evidence/I14-practice-list/small-quantity-contract-diagnosis-20261029.md)确认：合法 `0.0000001` 可保存但投影客户端和配对绑定拒绝，列表计算与详情不同；已映射首轮修复，原始数据保持不变。真实浏览器和独立复验未完成。

2026-10-29：未平仓数量第 2/5 轮[独立复验](../evidence/I14-practice-list/detail-open-quantity-independent-round2-20261029.md)对冻结版本限定 PASS（31/31）；协调者核对文件 SHA 与报告一致并重跑定向测试 19/19。保留首轮 FAIL，极小数客户端拒绝另行修复；新版真实浏览器完整流程、独立同态视觉及完整 I14 仍 NOT VERIFIED。本更新取代后文“等待独立复验”的状态。

2026-10-29：极小数量[独立限定复验](../evidence/I14-practice-list/small-quantity-independent-review-20261029.md)冻结测试 12/12、含独立反例 15/15，依赖哈希一致；协调者复跑修复及详情 19/19、六份真实来源 4/4。超出预算的数字客户端仍拒绝，浏览器、视觉及整体 I14 NOT VERIFIED。


2026-10-29：日期控件[独立首验](../evidence/I14-practice-list/sim-date-control-20261029/independent-review.md) FAIL：打开后 Escape 无法关闭及按钮名称缺少用途。第 1/5 轮修复中；接线、真实浏览器和同态视觉未验收。

2026-10-29：日期第 1/5 轮[独立复验](../evidence/I14-practice-list/sim-date-control-20261029/fix1-independent-review.md) FAIL：原问题通过，快捷和手动应用后焦点丢失，第 2/5 轮修复中；浏览器与同态视觉未验收。

2026-10-29：详情财务[独立审查](../evidence/I14-practice-list/detail-financial-20261029/independent-review.md)限定财务链 PASS，配对加载提示 FAIL；[协调者隔离浏览器](../evidence/I14-practice-list/detail-financial-20261029/coordinator-browser-observation.md)见相同短暂状态，完整浏览器与独立视觉 NOT VERIFIED，提示第 1/5 轮修复中。100/50 异常样本的初步误判已撤回，真实配对路由返回 unavailable，不代表用户文件不合格。

2026-10-29：详情财务加载提示第 1/5 轮[独立复验](../evidence/I14-practice-list/detail-financial-20261029/async-fix1-independent-review.md)限定 PASS，41 通过、1 跳过；配对重试的父页面真实链、浏览器及独立视觉仍 NOT VERIFIED；原 FAIL 保留。

2026-10-29：日期第 2/5 轮[独立复验](../evidence/I14-practice-list/sim-date-control-20261029/fix2-independent-review.md)原快捷/手动应用焦点反例和回归 18/18 通过；组件外部值在输入持焦期间变化时的焦点丢失反例 FAIL，现有页面是否可触发尚未证实；真实浏览器及整体日期功能 NOT VERIFIED。保留该风险并核查接线，不以组件测试通过宣称功能通过。

### 2026-10-29：不同入口切换后刷新显示错误练习

状态：FAIL，修复第 1/5 轮待开始。数据页打开 A 后从交易库打开 B，刷新跳回数据页 A。设计映射及责任见 DESIGN-COVERAGE.md；根因与保留旧深链、离开保护等约束见 `../evidence/I14-practice-list/workspace-20261029/practice-url-refresh-diagnosis-20261029.md`。需要测试先红后绿、独立审查和真实隔离浏览器复验。

2026-10-29 第 1/5 轮局部复验：独立 8/8、history 日期保护 1/1；协调者隔离浏览器验证 A→B 刷新、返回与前后、详情切实盘刷新。证据见 workspace-20261029/practice-url-round1-independent-20261029.md 和 practice-url-coordinator-browser-round1-20261029.md。静态复盘离开保护及账户变更风险仍调查，完整 I14 未验。

第 1/5 轮独立扩展反例 FAIL：账户切换返回列表后旧 ID 残留；Recall 保存失败时 history.back 未经过离开保护而卸载（测试替身制造失败）。按同一问题进入第 2/5 轮，等待独立报告，原局部通过不代表整项通过。


2026-10-29：地址与历史第 2/5 轮冻结后尚未通过；[交接](../evidence/I14-practice-list/workspace-20261029/practice-url-fix-round2-handoff-20261029.md)记录重挂载后后退不恢复预期详情及未定位超时。运行中源码变更，独立冻结版复现进行中；真实浏览器、连续历史操作及保存保护 NOT VERIFIED。


2026-10-29：列表首读独立截图初审发现筛选区换行导致结果区约下移 50px，FAIL；第 2/5 轮进行中。详见 [协调者隔离浏览器记录](../evidence/I14-practice-list/first-load-20261029/preparation/coordinator-browser-partial-20261029.md)。1280×720 非规定视口；完整视觉和控件未验。


2026-10-29：地址/历史第 2/5 轮新增独立反例 FAIL：模拟刷新后日期保存未决时后退会截断已经确认存在的前进记录。真实工作区组件、模拟重挂载和 mock 日期 client；真实浏览器未复现，待第 3/5 轮。
# 2026-10-29 首次读取第 2/5 轮复验

独立截图对照 [FAIL](../evidence/I14-practice-list/first-load-20261029/preparation/fix2-screens-independent-review-20261029.md)：1280×720 隔离样本中筛选区及结果容器纵向位置稳定，但空占位与数据行表格列宽不同，加载后表头横向移动。进入第 3/5 轮；保留历史失败。规定视口、独立浏览器操作与完整视觉尚未验收。
# 2026-10-29 地址历史保护第 3/5 轮

[独立复验 FAIL](../evidence/I14-practice-list/workspace-20261029/practice-url-round3-independent-review-20261029.md)：刷新旧会话路径通过，构造未标记历史条目时已存在的前进记录丢失；自然可达性及真实浏览器未验证。进入第 4/5 轮，保留各轮证据。
# 2026-10-29 地址历史保护第 4/5 轮

[调查](../evidence/I14-practice-list/workspace-20261029/round4-history/assessment-20261029.md)再次复现构造反例，旧接口无法确定未标记条目的方向；Chrome 的新接口探针不能证明其他环境有无损回退。本轮无生产修改，FAIL；自然可达性及真实应用浏览器仍未验证。
# 2026-10-29 首次读取第 3/5 轮复验

[独立复验 FAIL](../evidence/I14-practice-list/first-load-20261029/fix3/independent-review.md)：1280×720 两条合成数据表头位置稳定，但代码换行导致实际行高高于骨架；定向测试 37/37，规定视口尚未验收。进入第 4/5 轮。
# 2026-10-29 地址历史保护第 5/5 轮：停止

2026-10-29 执行偏差：其他接口开发代理误启动全量单测并触及本问题已停止的历史导航用例，发现后中断，整套未完成。相关失败不作为新一轮修复或验收，本问题继续 STOPPED 5/5，后续不得重跑。

[独立调查](../evidence/I14-practice-list/workspace-20261029/round4-history/round5-independent-assessment-20261029.md)未证明跨环境、前后导航及保留前进记录的完整方案；按用户五轮上限停止本问题。第 5 轮测试提前失败，不能作为反例重现或修复证据；正常用户可达性和真实浏览器 NOT VERIFIED，保留此前 FAIL。
# 2026-10-29 首次读取第 4/5 轮限定复验

[独立复验](../evidence/I14-practice-list/first-load-20261029/fix4/independent-review.md)对 1280×720 两条合成数据限定 PASS：表头和行边界稳定、代码单行；独立测试 38/38。规定视口、长名称真实排版和完整页面未验收，保留第三轮 FAIL。

2026-10-29：[独立规定视口截图复核](../evidence/I14-practice-list/first-load-20261029/precise-viewport-20261029/visual-independent-review.md)在 1440×1000、1280×800 两条合成记录下确认表头和前两行首读前后位置稳定，限定 PASS；采集使用无头 Chrome。参考画板数据与功能状态不同，长名称、空/错误、键鼠、整页同态视觉仍 NOT VERIFIED，历史 FAIL 保留。

2026-10-29：详情逐配对净盈亏[独立隔离库及路由验收](../evidence/I14-practice-list/pair-net-20261029/independent-route-review.md) 10/10；[协调者 IAB 局部操作](../evidence/I14-practice-detail/pair-net-20261029/coordinator-browser.md)验证单组返回重开及刷新。仅支持可证明整体闭合的来源；部分持仓、规定视口视觉和受影响控件审计 NOT VERIFIED。

2026-10-29：独立规定视口截图对照画板发现配对与摘要正收益颜色未呈绿色，视觉 FAIL；第 1/5 轮修复中。完整详情视觉及受影响控件尚未验收，保留失败证据。

2026-10-29：详情正收益颜色第 1/5 轮[独立限定复验](../evidence/I14-practice-detail/pair-net-color-round1-20261029/independent-review.md)：两个规定桌面视口正收益绿色、费用中性色；测试 13/13。负数、零、未知浏览器视觉及摘要字号层级仍未验收。修复前两张截图被误覆盖，原 FAIL 报告及校验记录保留，新截图独立保存；完整页面与控件审计 NOT VERIFIED。

2026-10-29：详情摘要字号及基线：前版[两视口视觉 FAIL](../evidence/I14-practice-detail/summary-typography-20261029/browser-recapture/report.md)；对齐第 1/5 轮[独立复验](../evidence/I14-practice-detail/summary-baseline-round1-20261029/independent-review.md)合成样本两视口限定 PASS，65/65。长值、其他状态、说明按钮真实鼠标/键盘和整页同态 NOT VERIFIED。

2026-10-29：日期控件焦点第 3/5 轮[独立复验](../evidence/I14-practice-list/sim-date-control-20261029/fix3-independent-review.md)组件 29/29，协调者原四文件 22/22；旧源码完整快照缺失，无法独立确认修改差异范围。实际页面可达性、真实浏览器、同态视觉及整项 I14 均 NOT VERIFIED。
2026-10-29：账户字段截断[独立桌面局部复验](../evidence/I14-practice-list/account-field-independent-round1-20261029/report.md)于 1440×1000 和 1280×800 空态看到所测账户名称完整、邻接控件无视觉重叠。键盘选择、正常数据行与整页同态仍 NOT VERIFIED；保留此前 FAIL 与浏览器不可用的历史记录。

2026-10-29 21:10 +0800：协调者使用新建临时 TMPDIR 和显式隔离 TRADEREVIEW_DB_PATH，串行复跑 `library-practice-list.account-width.test.tsx` 与 `library-practice-list.test.tsx`，2 文件 29/29，退出 0，Node 报 module.register 弃用提示；此组件测试不代替真实交互、状态链及完整视觉验收。

2026-10-29：[键盘补充观察](../evidence/I14-practice-list/account-field-independent-round1-20261029/report.md)发现可 Tab 聚焦及 Enter 清除，方向键选择未验证。并行临时测试文件被删除使本次版本绑定验收 NOT VERIFIED；1440 截图裁切，冻结后需要复验。

2026-10-29：详情负数、零与未知状态[有限视觉诊断](../evidence/I14-practice-detail/net-states-independent-20261029/report.md)的[独立复核](../evidence/I14-practice-detail/net-states-independent-20261029/review.md)支持两视口负/零数值与色值、未知汇总静态展示；逐配对未知、导航刷新等动作缺直接证据，整页同态视觉 NOT VERIFIED。原报告过宽陈述已[修正复验](../evidence/I14-practice-detail/net-states-independent-20261029/correction-independent-review.md)，保留限定 FAIL。

2026-10-29：详情交互[证据独立复核](../evidence/I14-practice-detail/net-interaction-20261029/independent-review.md)为 FAIL，已记录的页面状态不足以独立证明 36 次输入；这些动作 NOT VERIFIED，不代表已发现产品故障。后续限定重新操作的证据不得覆盖原 FAIL，完整 I14 与同态视觉仍未验收。

2026-10-29：未知费用样本在一个桌面视口的新隔离库[独立重新实操](../evidence/I14-practice-detail/net-interaction-reperformed-20261029/independent-review.md)限定 PASS：10 项页面入口及说明动作有调用和前后状态记录；Tab 从指定前一按钮开始。两规定视口、其他状态及整页同态视觉未由此验收，保留原 FAIL。

2026-10-29：账户筛选[局部浏览器复查](../evidence/I14-practice-list/account-field-recheck-20261029/report.md)的[独立证据复核](../evidence/I14-practice-list/account-field-recheck-20261029/independent-review.md)支持截图中账户名称和摘要可见；逐步调用与服务日志未导出且出现热更新，输入路径和稳定版本绑定 NOT VERIFIED。方向键未观察到选择变化，原因未确定，不能判定产品故障；非空过滤和整页同态视觉未验。
# 2026-10-31 局部复验现象

独立浏览器从隔离合成库打开日线练习、点击内部配对回放后，进入回放区域但显示“练习已变化，请返回并重新读取练习”，未进入图表；原因未确认，不归因周期提示改动。完整记录见 [独立验收](../evidence/I14-period-notice-20261031/independent-acceptance.md)。小时练习提示已局部修改；整体回放、未知周期浏览器状态和同态视觉仍未通过。按既定五轮限制不继续调查已停止的回放问题。

