# 从首页到实盘成交、回合复盘，再恢复来源

ID: TL20-I13
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root
Owner role: INTEGRATOR
Priority: P0

## Scope / What to build

首页日期/标的/普通入口→实盘成交列表→标的回合集→回合复盘→逐层返回→侧栏首页；刷新和URL直达可重建。

- 落地E整体几何与全局导航；普通入口无pending参数/徽章，到达条件立即生效；只覆盖传入字段。顶栏只显示交易库，返回首页经侧栏。
- 实盘列表以成交日保留未平仓；同标的回合集有范围外必要开仓上下文但不改变筛选归属；显式待复盘按批准的状态主体映射，不能由余仓推断。
- 交易库局部搜索不触发全屏全局搜索；日期/市场/账户/只读摘要/排序/分页/刷新独立，采用H入口参数及IME规则。
- 返回原对象、筛选、页码、scroll和焦点；首页两贡献模式各自分类/排序/下钻/页码及持仓表状态恢复并重读。对象消失回来源容器标题，不能固定首行。

本票是独立开发任务，不是wayfinder决策子票。ready-for-agent表示范围已描述；所有依赖accepted且closed、具体接口/待决交互冻结后才能领取，禁止实现者填补业务政策。局部接受不代表功能整体接受。

## Refs

- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L43–132
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L138–140
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L254–300
- [docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md)，L650–666
- [approved-e-live-list-1440.jpg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/approved-e-live-list-1440.jpg)
- [journeys-date.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-date.svg)
- [journeys-date-1280.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-date-1280.svg)
- [journeys-date-month.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-date-month.svg)
- [handoff.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/handoff.svg)
- [journeys-home-entry.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-home-entry.svg)
- [journeys-library-list.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-library-list.svg)
- [journeys-live-rounds.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-live-rounds.svg)
- [journeys-live-rounds-return.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-live-rounds-return.svg)
- [journeys-library-list-return.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-library-list-return.svg)
- [hcr06-final-pending-library.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-pending-library.svg)
- [hcr06-final-pending-library-1280.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-pending-library-1280.svg)
- [library-return.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/library-return.svg)
- [journeys-library-return.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-library-return.svg)
- [覆盖矩阵](../DESIGN-COVERAGE.md)中Owner为本票的各行；element/control ID为本轮规划本地ID，正文只有章节/文档stable-id，不能借用别的功能元素全集。
- [视觉契约](../visual-contract.md)、[接口与文件责任](../INTERFACES.md)、[回放转移契约](../REPLAY-STATE-CONTRACT.md)、[控件登记计划](../CONTROL-INVENTORY.md)。D03/D02等新增交互使用决策完成后批准的稿件，不拿不相干参考图代替。

## Blocked by

- [主动回合和练习配对在真实主图保存重开（首道门槛）](12-first-chart-journey.md)
- [非法范围和缺失账户参数怎样恢复到可修正状态？](05-invalid-entry.md)
- [市场与账户选择器的规则](../../trading-library-v11-design-decisions/issues/03-market-account-selectors.md)
- [列表排序与复盘状态的表达](../../trading-library-v11-design-decisions/issues/04-list-sort-review-direction.md)
- [表格密度与标的显示规范](../../trading-library-v11-design-decisions/issues/05-table-density-symbols.md)
- [统一滑动切换与柔和模式底色](../../trading-library-v11-design-decisions/issues/06-switches-mode-surfaces.md)

## 实施与验证步骤

下列尚不存在的定向测试文件是本票拟增测试落点，执行前核对现有测试组织；它们不是本轮已运行或已通过的检查。

- [ ] 重新读完整原规格/准确状态图、相关矩阵行、所有依赖Resolution与契约；按生命周期领取唯一Assignee，冻结允许修改文件及实际类型签名。有新不明业务问题回决策票。
- [ ] 为 `home-entry-applies-scope` 先建立行为反例并确认失败：date/symbol/普通入口→立即生效；普通不带pending；直达/刷新URL重建；库内更改不改首页来源。
- [ ] 为 `live-list-vs-stats-date` 先建立行为反例并确认失败：成交日范围保留买入和余仓；回合上下文可越范围但不扩样本；待复盘与留仓独立。
- [ ] 为 `return-full-home-context` 先建立行为反例并确认失败：同代码异市场/原行在第二页/贡献两模式不同分类→返回正确行与原焦点；删除原对象→容器标题且保留条件。
- [ ] 在允许范围内实现上列可观察旅程，连接真实提供方/消费者；不扩大任务、不再派代理、不重写全局架构。
- [ ] 执行定向检查：`npm run test:unit -- app/components/library/library-browse-state.test.ts app/components/library/trade-library.acceptance.test.tsx app/components/library/library-stock-rounds.test.tsx app/components/dashboard/review-dashboard.test.tsx`；实现任务保留失败到通过日志，审计/接受任务保留实际操作证据，不用结构验证代替产品。
- [ ] 显式隔离库，真实操作本票旅程及取消/失败/返回/reload；前端按CONTROL-INVENTORY登记动态实例并记录点击前中后空间/状态链；无写入部分说明范围依据。
- [ ] 非实现者直接看参考与同状态渲染图，协调者独立复核后记录各门槛。检查受影响上游/下游，失败保留并交回owner。

## 验收标准与反例

- [ ] date/symbol/普通入口→立即生效；普通不带pending；直达/刷新URL重建；库内更改不改首页来源；证据记录在本票独立报告内。
- [ ] 成交日范围保留买入和余仓；回合上下文可越范围但不扩样本；待复盘与留仓独立；证据记录在本票独立报告内。
- [ ] 同代码异市场/原行在第二页/贡献两模式不同分类→返回正确行与原焦点；删除原对象→容器标题且保留条件；证据记录在本票独立报告内。
- [ ] 控件检查触发：本票影响/检查前端；范围：完整实盘列表页+入口和返回的受影响首页控件；动态成交/回合/分页及所有筛选选项登记。
- [ ] 不引入未批准的尺寸、默认折叠/阶段、阈值、行情来源或账户默认；无用户授权差异。
- [ ] 参考与渲染版本、CSS视口/缩放/DPR/状态/数据可比；功能、端到端和视觉分别签结论，不以单测/回调/HTTP成功替代。

## 派发说明

- 默认实现模型 Luna (`gpt-5.6-luna`)，协调者 root 独立review/接受；本轮没有派发执行。
- 候选文件范围（技术落点，非产品需求；派发前按契约核实并锁定）：
- `app/components/library/trade-library.tsx`
- `app/components/library/trade-library.css`
- `app/components/library/library-browse-state.ts`
- `app/components/library/library-filter-drawer.tsx`
- `app/components/library/library-scope-controls.tsx`
- `app/components/library/library-stock-rounds.tsx`
- `app/components/trade-review-workspace.tsx`
- `app/components/dashboard/review-dashboard.tsx（仅入口和返回接线）`
- 输入/输出与接线：INTEGRATOR为workspace/browse state/共享壳唯一写者；产生按mode隔离的AppliedScope与ReturnContext契约。REPLAY消费准确roundId，DATA提供含未平仓的Execution列表，不能复用仅closed指标作为列表源。
- 共享文件只由INTERFACES指定owner写；跨owner变更交接给owner，不能并行覆盖。完整页视觉owner为root；完整持久化流owner为DATA；角色未落实到具体受领人前不得执行。
- 禁止：写业务库、变更conf绝对业务库/端口、静默合并/删除人工成果、将mock图/fixture当真实验收、push/merge/publish、擅自扩大或再派子代理。

## 验收证据

实际功能、真实持久化/返回链、独立视觉均 NOT VERIFIED。 未来报告位置：`../evidence/I13/report.md`，每个勾选链接实际日志/截图/持久化重读结果。报告头包含commit/dirty内容manifest、worktree、时间、服务URL/会话、显式隔离库、数据范围、CSS视口/缩放/DPR、输入方式和排除依据。该目录尚未产生证据。

协调者接受：尚未接受。回归须保留旧证据，重开本票并同步README、DESIGN-COVERAGE与FINAL-ACCEPTANCE。

## 历史

- 2026-10-26 拆票：open / ready-for-agent / unassigned；依赖未解除，未实施/未验收。
