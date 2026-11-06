# 实盘按平仓回合看统计，趋势和分布下钻可返回

ID: TL20-I15
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root
Owner role: STATS
Priority: P1

## Scope / What to build

实盘列表切统计→确认平仓日范围→趋势读数→收益率/金额区间→区间对象→标的回合集/回合复盘→返回原区间。

- 按主动平仓回合计数且按平仓日归属，不直接复用持仓episode计数/开仓日；必要开仓上下文不能扩分母。
- 复用公共Metric/趋势/分布/Tooltip，率/金额沿既有区间：01-live-normal.svg的5%标签、distribution-amount.svg的100标签，不能从E旧数字推统计语义。实施前冻结精度、等值落桶和币种契约；若原稿无法确定则先建明确决策，不自行设阈值。
- 频数横条共享最大频数尺度，亏损条向正向画宽，零不画假最小条；显示回合数和两位占比；展开不改范围/分母。
- 趋势跨度≤31天日、>31天且≤2年月、>2年年；缺口断线/单点不外推/空无假点；回到统计保留金额/率、选中区间、分页、scroll和对象focus。

本票是独立开发任务，不是wayfinder决策子票。ready-for-agent表示范围已描述；所有依赖accepted且closed、具体接口/待决交互冻结后才能领取，禁止实现者填补业务政策。局部接受不代表功能整体接受。

## Refs

- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L176–183
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L210–245
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L269–291
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L331–352
- [approved-e-live-stats-1440.jpg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/approved-e-live-stats-1440.jpg)
- [01-live-normal.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/01-live-normal.svg)
- [distribution-amount.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/distribution-amount.svg)
- [03-distribution-selected.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/03-distribution-selected.svg)
- [04-return.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/04-return.svg)
- [hcr06-final-return.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-return.svg)
- [覆盖矩阵](../DESIGN-COVERAGE.md)中Owner为本票的各行；element/control ID为本轮规划本地ID，正文只有章节/文档stable-id，不能借用别的功能元素全集。
- [视觉契约](../visual-contract.md)、[接口与文件责任](../INTERFACES.md)、[回放转移契约](../REPLAY-STATE-CONTRACT.md)、[控件登记计划](../CONTROL-INVENTORY.md)。D03/D02等新增交互使用决策完成后批准的稿件，不拿不相干参考图代替。

## Blocked by

- [从首页到实盘成交、回合复盘，再恢复来源](13-live-entry-return.md)
- [表格密度与标的显示规范](../../trading-library-v11-design-decisions/issues/05-table-density-symbols.md)

## 实施与验证步骤

下列尚不存在的定向测试文件是本票拟增测试落点，执行前核对现有测试组织；它们不是本轮已运行或已通过的检查。

- [ ] 重新读完整原规格/准确状态图、相关矩阵行、所有依赖Resolution与契约；按生命周期领取唯一Assignee，冻结允许修改文件及实际类型签名。有新不明业务问题回决策票。
- [ ] 为 `live-close-date-statistics` 先建立行为反例并确认失败：开仓在范围外、平仓在范围内→1回合；未平仓留在列表不进入closed统计；拆单不增加分母。
- [ ] 为 `frequency-distribution-invariants` 先建立行为反例并确认失败：切金额/率不改条件，区间展开不改分母，零条宽0、亏损条宽正、占比两位；边界等值按确认阈值落桶。
- [ ] 为 `statistics-drill-return` 先建立行为反例并确认失败：选第二页区间对象→真实回合复盘→返回原区间/页码/scroll/focus，不能固定第一个证券。
- [ ] 在允许范围内实现上列可观察旅程，连接真实提供方/消费者；不扩大任务、不再派代理、不重写全局架构。
- [ ] 执行定向检查：`npm run test:unit -- app/lib/reviews/library-live-statistics.test.ts app/components/library/library-statistics.test.tsx app/components/library/library-performance-summary.test.tsx`；实现任务保留失败到通过日志，审计/接受任务保留实际操作证据，不用结构验证代替产品。
- [ ] 显式隔离库，真实操作本票旅程及取消/失败/返回/reload；前端按CONTROL-INVENTORY登记动态实例并记录点击前中后空间/状态链；无写入部分说明范围依据。
- [ ] 非实现者直接看参考与同状态渲染图，协调者独立复核后记录各门槛。检查受影响上游/下游，失败保留并交回owner。

## 验收标准与反例

- [ ] 开仓在范围外、平仓在范围内→1回合；未平仓留在列表不进入closed统计；拆单不增加分母；证据记录在本票独立报告内。
- [ ] 切金额/率不改条件，区间展开不改分母，零条宽0、亏损条宽正、占比两位；边界等值按确认阈值落桶；证据记录在本票独立报告内。
- [ ] 选第二页区间对象→真实回合复盘→返回原区间/页码/scroll/focus，不能固定第一个证券；证据记录在本票独立报告内。
- [ ] 控件检查触发：本票影响/检查前端；范围：完整实盘统计、趋势逐点/读数、率金额切换、每区间/动态对象与返回；图表选中和提示的中间空间均检查。
- [ ] 不引入未批准的尺寸、默认折叠/阶段、阈值、行情来源或账户默认；无用户授权差异。
- [ ] 参考与渲染版本、CSS视口/缩放/DPR/状态/数据可比；功能、端到端和视觉分别签结论，不以单测/回调/HTTP成功替代。

## 派发说明

- 默认实现模型 Luna (`gpt-5.6-luna`)，协调者 root 独立review/接受；本轮没有派发执行。
- 候选文件范围（技术落点，非产品需求；派发前按契约核实并锁定）：
- `app/lib/reviews/library-live-statistics.ts（拟新增）`
- `app/components/library/library-statistics.tsx（拟新增）`
- `app/components/library/library-statistics.module.css（拟新增）`
- `app/components/library/library-performance-summary.tsx`
- `app/lib/reviews/library-performance.ts（保留旧消费者语义，显式适配）`
- 输入/输出与接线：STATS输出带sampleUnit=round、scopeKey、metricEligibility、bucketId和对象ID的统计模型；INTEGRATOR接列表/统计切换、shared scope和ReturnContext；REPLAY只接准确round。
- 共享文件只由INTERFACES指定owner写；跨owner变更交接给owner，不能并行覆盖。完整页视觉owner为root；完整持久化流owner为DATA；角色未落实到具体受领人前不得执行。
- 禁止：写业务库、变更conf绝对业务库/端口、静默合并/删除人工成果、将mock图/fixture当真实验收、push/merge/publish、擅自扩大或再派子代理。

## 验收证据

实际功能、真实持久化/返回链、独立视觉均 NOT VERIFIED。 未来报告位置：`../evidence/I15/report.md`，每个勾选链接实际日志/截图/持久化重读结果。报告头包含commit/dirty内容manifest、worktree、时间、服务URL/会话、显式隔离库、数据范围、CSS视口/缩放/DPR、输入方式和排除依据。该目录尚未产生证据。

协调者接受：尚未接受。回归须保留旧证据，重开本票并同步README、DESIGN-COVERAGE与FINAL-ACCEPTANCE。

## 历史

- 2026-10-26 拆票：open / ready-for-agent / unassigned；依赖未解除，未实施/未验收。
2026-10-29：来源数据准备[独立复验](../evidence/I15/live-round-data-prep-20261029/independent-review.md) 1/1，覆盖公开解析、进程内路由及隔离库重开后的部分字段；两个样本方向均为买入但开平语义不同，不能据此推断同一次操作。第二次提交复用解析对象，不证明重新解析重导；平仓回合统计及整票 NOT VERIFIED。

2026-10-29：已识别动作按范围选择的[纯数据准备](../evidence/I15/live-identified-action-sample-20261029/implementation.md)经[独立复核](../evidence/I15/live-identified-action-sample-20261029/independent-review.md)限定接受，尚未接入生产；真实身份唯一性、日期校验、确认、持久化、统计及页面均 NOT VERIFIED。首次独立探针的预期错误和修正保留在报告中。
