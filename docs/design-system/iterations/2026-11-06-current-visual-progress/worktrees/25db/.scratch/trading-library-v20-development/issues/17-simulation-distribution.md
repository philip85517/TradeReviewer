2026-10-29：收益分布层级[独立局部复核](../evidence/I17/distribution-hierarchy-20261029/independent-review.md)通过，四张两个桌面尺寸的滚动截图和回归 33/33；只含两条合成盈利样本，亏损、长值、异常态、整页同态及下钻返回仍未验收。原竖排 FAIL 保留。

2026-10-29：I17 收益分布真实数据接线的作者隔离测试 31/31，但协调者在 1440×1000 隔离真实浏览器金额量纲观察到区间标签逐字换行，首列仅 22.23px、首行高 78px，[截图](../evidence/I17/distribution-observation-20261029/coordinator-1440-amount-visual-fail.jpg)；视觉 FAIL，第 1/5 轮修复中。独立功能复审、指定桌面同态对照及完整 I17 均未验收。

2026-10-29：I17 全未知日期遗漏第 1/5 次修复[独立限定复验 PASS](evidence/I17/trend-20261029/independent-fix1-review-20261029.md)；协调者重跑统计组件及聚合 33/33，并在隔离浏览器观察到六条未知练习分布于五个日期，日期起始改为 10 月 16 日后显示四条与四个日期。保留原 FAIL；真实已知金额、独立浏览器操作、辅助技术、同态视觉及完整 I17 未验收。

2026-10-29：I17 趋势展示[独立首验 FAIL](evidence/I17/trend-20261029/independent-review-20261029.md)：全未知练习的日期未显示，保留第 1/5 轮失败证据，修复中；已知样本累计是可计算小计，真实可访问性、浏览器和同态视觉尚未验证。

# 模拟趋势与分布按练习下钻并恢复原选择

2026-10-29：仅趋势 UI 切片已依据[覆盖矩阵](../DESIGN-COVERAGE.md)派给 `design_reference`，消费现有完整练习净额与确认日期；合成已知结果仅用于组件验证，真实来源的完整财务仍未确认。无日期边界的一侧以当前已筛选练习的最早或最晚确认日期确定展示粒度；空样本无虚构日期。分布/下钻、生产财务、真实浏览器和独立视觉仍未验收；本票保持 open。

ID: TL20-I17
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root
Owner role: STATS
Priority: P1

## Scope / What to build

模拟统计→日/月/年趋势→切率/金额→区间内练习→练习详情/内部配对回放→逐层返回分布。

- 按当前确认练习日聚合，31天/两年粒度边界与实盘一致但日期口径不同；缺口/单点/空样本独立呈现，完整年份标签自然增长不裁切。
- 频数单位为练习，金额/率各自使用对应eligible样本和分母；未知不画条，亏损宽度正，零无假条。
- 区间展开只列其中练习，不改变原条件/分母；同标的A/B分别定位，模拟配对回放不能走实盘回合集；返回区间、原练习、排序、页码、scroll/focus。
- 共享STATS组件由同一owner维护，使用批准的阈值和预览列，不发明混合方向类别。

本票是独立开发任务，不是wayfinder决策子票。ready-for-agent表示范围已描述；所有依赖accepted且closed、具体接口/待决交互冻结后才能领取，禁止实现者填补业务政策。局部接受不代表功能整体接受。

## Refs

- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L198–245
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L269–291
- [02-simulation-normal.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/02-simulation-normal.svg)
- [journeys-trend-gap.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-trend-gap.svg)
- [journeys-trend-single.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-trend-single.svg)
- [journeys-trend-empty.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-trend-empty.svg)
- [journeys-trend-month.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-trend-month.svg)
- [journeys-trend-year.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-trend-year.svg)
- [hcr06-final-return.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-return.svg)
- [覆盖矩阵](../DESIGN-COVERAGE.md)中Owner为本票的各行；element/control ID为本轮规划本地ID，正文只有章节/文档stable-id，不能借用别的功能元素全集。
- [视觉契约](../visual-contract.md)、[接口与文件责任](../INTERFACES.md)、[回放转移契约](../REPLAY-STATE-CONTRACT.md)、[控件登记计划](../CONTROL-INVENTORY.md)。D03/D02等新增交互使用决策完成后批准的稿件，不拿不相干参考图代替。

## Blocked by

- [实盘按平仓回合看统计，趋势和分布下钻可返回](15-live-statistics.md)
- [模拟统计显示练习金额、胜率、收益率与最差回撤](16-simulation-metrics.md)

## 实施与验证步骤

下列尚不存在的定向测试文件是本票拟增测试落点，执行前核对现有测试组织；它们不是本轮已运行或已通过的检查。

- [ ] 重新读完整原规格/准确状态图、相关矩阵行、所有依赖Resolution与契约；按生命周期领取唯一Assignee，冻结允许修改文件及实际类型签名。有新不明业务问题回决策票。
- [ ] 为 `practice-trend-granularity` 先建立行为反例并确认失败：31/32天、两年边界、跨年/闰日、单点/缺口/空→正确日月年且不造点；日期更正后只迁移原练习归属。
- [ ] 为 `practice-distribution-eligibility` 先建立行为反例并确认失败：金额可算但率未知→两种分母分别可解释；同日两练习分别计数，内部配对数不增加频数。
- [ ] 为 `practice-bucket-return` 先建立行为反例并确认失败：选金额区间A练习→配对→返回恢复A与原区间，B不串入；无内部配对只解释不可进入原因。
- [ ] 在允许范围内实现上列可观察旅程，连接真实提供方/消费者；不扩大任务、不再派代理、不重写全局架构。
- [ ] 执行定向检查：`npm run test:unit -- app/lib/reviews/practice-performance.test.ts app/components/library/library-practice-statistics.test.tsx app/components/library/library-statistics.test.tsx`；实现任务保留失败到通过日志，审计/接受任务保留实际操作证据，不用结构验证代替产品。
- [ ] 显式隔离库，真实操作本票旅程及取消/失败/返回/reload；前端按CONTROL-INVENTORY登记动态实例并记录点击前中后空间/状态链；无写入部分说明范围依据。
- [ ] 非实现者直接看参考与同状态渲染图，协调者独立复核后记录各门槛。检查受影响上游/下游，失败保留并交回owner。

## 验收标准与反例

- [ ] 31/32天、两年边界、跨年/闰日、单点/缺口/空→正确日月年且不造点；日期更正后只迁移原练习归属；证据记录在本票独立报告内。
- [ ] 金额可算但率未知→两种分母分别可解释；同日两练习分别计数，内部配对数不增加频数；证据记录在本票独立报告内。
- [ ] 选金额区间A练习→配对→返回恢复A与原区间，B不串入；无内部配对只解释不可进入原因；证据记录在本票独立报告内。
- [ ] 控件检查触发：本票影响/检查前端；范围：完整模拟趋势/分布，逐点与每区间/练习动态实例、数据空缺、率金额切换及全部返回入口。
- [ ] 不引入未批准的尺寸、默认折叠/阶段、阈值、行情来源或账户默认；无用户授权差异。
- [ ] 参考与渲染版本、CSS视口/缩放/DPR/状态/数据可比；功能、端到端和视觉分别签结论，不以单测/回调/HTTP成功替代。

## 派发说明

- 默认实现模型 Luna (`gpt-5.6-luna`)，协调者 root 独立review/接受；本轮没有派发执行。
- 候选文件范围（技术落点，非产品需求；派发前按契约核实并锁定）：
- `app/components/library/library-practice-statistics.tsx`
- `app/components/library/library-statistics.tsx`
- `app/lib/reviews/practice-performance.ts`
- `app/components/library/library-statistics.module.css`
- 输入/输出与接线：消费16的金额/率资格集，不从已渲染明细反算分母；输出practiceId和metric/bucket selection返回上下文，INTEGRATOR接真实练习容器。
- 共享文件只由INTERFACES指定owner写；跨owner变更交接给owner，不能并行覆盖。完整页视觉owner为root；完整持久化流owner为DATA；角色未落实到具体受领人前不得执行。
- 禁止：写业务库、变更conf绝对业务库/端口、静默合并/删除人工成果、将mock图/fixture当真实验收、push/merge/publish、擅自扩大或再派子代理。

## 验收证据

实际功能、真实持久化/返回链、独立视觉均 NOT VERIFIED。 未来报告位置：`../evidence/I17/report.md`，每个勾选链接实际日志/截图/持久化重读结果。报告头包含commit/dirty内容manifest、worktree、时间、服务URL/会话、显式隔离库、数据范围、CSS视口/缩放/DPR、输入方式和排除依据。该目录尚未产生证据。

协调者接受：尚未接受。回归须保留旧证据，重开本票并同步README、DESIGN-COVERAGE与FINAL-ACCEPTANCE。

## 历史

- 2026-10-26 拆票：open / ready-for-agent / unassigned；依赖未解除，未实施/未验收。

2026-10-29：收益分布纯计算在输入完整、币种一致和身份唯一前提下通过限定独立复核，协调者重跑相关 3 文件 86/86；[证据](../evidence/I16-statistics-snapshot/distribution-independent-review-20261029.md)。趋势纯计算独立首验 FAIL：缺少未知结果所在日期，无法提供正确缺口解释；见 [首验](../evidence/I17/trend-independent-20261029.md)。第 1/5 次修复待独立复验。I15、I16 仍未关闭，客户端尚无已确认完整练习净额，页面接线暂停；不能将纯计算验收当成整体或浏览器通过。[页面接线前提](../evidence/I16-statistics-snapshot/distribution-ui-scope-20261029.md)。

2026-10-29：趋势未知收益日期第 1/5 次修复[独立限定复验 PASS](../evidence/I17/trend-independent-fix-round1-review-20261029.md)，协调者复跑 13/13 和 3/3；缺失数据原因、生产数据合同、页面旅程及视觉仍未验收。首轮 FAIL 保留。
2026-10-29：区间展开[独立数据和组件复核](../evidence/I17/distribution-expand-20261029/independent-review-20261029.md)局部 PASS；[隔离浏览器局部记录](../evidence/I17/distribution-expand-20261029/coordinator-browser-observation.md)含鼠标及键盘操作。[独立视觉初查](../evidence/I17/distribution-expand-20261029/visual-independent-20261029.md)指出可点击和选中状态缺乏明显提示，待修；不存在可用于同态对照的模拟展开画板，详情下钻及返回未实现，整票保持 open。


2026-10-29：原可发现性风险第 1/5 次修复[独立组件复验](../evidence/I17/distribution-expand-20261029/visual-feedback-fix1/independent-review.md) 26/26，静态截图反馈改善；独立真实浏览器操作与同态视觉未通过，完整下钻返回仍未实现。保留原视觉风险和全部旧证据，票保持 open。

2026-10-29：[独立浏览器验收](../evidence/I17/distribution-expand-20261029/visual-feedback-fix1/independent-browser.md)因审查代理浏览器不可用而未执行；仍 NOT VERIFIED，不以服务 HTTP 成功或旧截图替代。
2026-10-29：[独立浏览器局部观察](../evidence/I17/distribution-browser-independent-20261029/report.md)在隔离数据库的两条合成练习上观察到鼠标展开、键盘收起/展开、金额切换、空区间及刷新；期间出现样式热更新且截图和几何证据未持久化，版本绑定、正式控件覆盖与视觉均 NOT VERIFIED，完整下钻返回保持开放。

2026-10-29：[下钻链只读诊断](../evidence/I17/drill-return-readonly-20261029/report.md)及[独立复核](../evidence/I17/drill-return-readonly-20261029/independent-review.md)支持当前区间成员没有直达练习的连接，切出统计会卸载本地量纲和展开状态；统计手动切换入口仍存在，不能将其误称不存在。复核发现原报告若干过宽表述和失效链接，报告精确性 FAIL，待修正。历史导航风险来自静态耦合，未证明必然触发；完整下钻、返回及视觉均 NOT VERIFIED。

2026-10-29：诊断报告的四项表述及链接问题经[修订独立复验](../evidence/I17/drill-return-readonly-20261029/correction-independent-review.md)限定 PASS，原 FAIL 保留；此复验不代表产品功能或视觉通过。

2026-10-29：当前源码版本趋势纯计算[独立定向复验](../evidence/I17/trend-current-independent-20261029/report.md) 16/16，限既有合成样本及反例，运行前后所列文件指纹一致。数据来源、缺口原因、浏览器及整票仍 NOT VERIFIED。

2026-10-30：趋势纯计算新增闰日小数累计、输入跨月变更两个测试；定向 10/10，[独立复核](../evidence/I17/trend-unit-coverage-20261029/independent-review.md)报告单文件分支 45/45，新增前同为 45/45。数据持久化、页面旅程和整票仍 NOT VERIFIED。

