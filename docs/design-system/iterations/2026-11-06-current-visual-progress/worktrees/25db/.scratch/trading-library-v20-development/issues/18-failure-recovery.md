# 范围失败、迟到请求和缺失输入均可解释并恢复

ID: TL20-I18
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root
Owner role: INTEGRATOR
Priority: P1

## Scope / What to build

从完整有效结果连续换范围→迟到/失败/超时→保留旧结果与旧范围→重试失败目标→成功原子替换；直达坏参数可修正。

- 首次加载使用最终工具/表头/行槽；后台更新保持最后完整有效scope+结果，不能新日期配旧金额。重试携带失败目标，新generation与scope key双匹配，旧请求忽略。
- 区分无交易、搜索无匹配、实盘无闭合回合、模拟无内部配对、字段缺失、费用/估值缺失；保留有值部分，未知不变零。
- 非法市场回all并提示且其他条件保留；坏范围和缺账户按D05确认路径，不能静默扩大；搜索IME组合不发半成词。
- 大金额/负值/长名/错误长文/展开行/选中条目均保持批准空间预算，自然向下增长，不能裁切内容或用缩字绕过。

本票是独立开发任务，不是wayfinder决策子票。ready-for-agent表示范围已描述；所有依赖accepted且closed、具体接口/待决交互冻结后才能领取，禁止实现者填补业务政策。局部接受不代表功能整体接受。

## Refs

- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L103–132
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L302–329
- [docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md)，L660–665
- [05-loading.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/05-loading.svg)
- [06-empty.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/06-empty.svg)
- [07-error.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/07-error.svg)
- [08-extreme.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/08-extreme.svg)
- [09-missing-input.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/09-missing-input.svg)
- [覆盖矩阵](../DESIGN-COVERAGE.md)中Owner为本票的各行；element/control ID为本轮规划本地ID，正文只有章节/文档stable-id，不能借用别的功能元素全集。
- [视觉契约](../visual-contract.md)、[接口与文件责任](../INTERFACES.md)、[回放转移契约](../REPLAY-STATE-CONTRACT.md)、[控件登记计划](../CONTROL-INVENTORY.md)。D03/D02等新增交互使用决策完成后批准的稿件，不拿不相干参考图代替。

## Blocked by

- [从首页到实盘成交、回合复盘，再恢复来源](13-live-entry-return.md)
- [独立模拟练习逐层进入回放，更正日期后仍属原练习](14-simulation-entry-date.md)
- [实盘按平仓回合看统计，趋势和分布下钻可返回](15-live-statistics.md)
- [模拟趋势与分布按练习下钻并恢复原选择](17-simulation-distribution.md)
- [非法范围和缺失账户参数怎样恢复到可修正状态？](05-invalid-entry.md)

## 实施与验证步骤

下列尚不存在的定向测试文件是本票拟增测试落点，执行前核对现有测试组织；它们不是本轮已运行或已通过的检查。

- [ ] 重新读完整原规格/准确状态图、相关矩阵行、所有依赖Resolution与契约；按生命周期领取唯一Assignee，冻结允许修改文件及实际类型签名。有新不明业务问题回决策票。
- [ ] 为 `scope-generation-atomicity` 先建立行为反例并确认失败：A→B→C，B晚到不能覆盖C；C失败仍显示A完整scope与值；retry请求C成功后一起更新。
- [ ] 为 `distinct-library-empty-and-missing` 先建立行为反例并确认失败：逐一制造六类空/缺状态，消息/分母/可用字段不同；未知不可变0，日期不合法停导入。
- [ ] 为 `invalid-entry-and-recovery` 先建立行为反例并确认失败：非法market仅改market；坏范围/无账户提示可修正，取消保留旧scope，手动修正后URL/reload一致。
- [ ] 在允许范围内实现上列可观察旅程，连接真实提供方/消费者；不扩大任务、不再派代理、不重写全局架构。
- [ ] 执行定向检查：`npm run test:unit -- app/components/library/trade-library.acceptance.test.tsx app/components/library/library-browse-state.test.ts app/components/library/library-statistics.test.tsx`；实现任务保留失败到通过日志，审计/接受任务保留实际操作证据，不用结构验证代替产品。
- [ ] 显式隔离库，真实操作本票旅程及取消/失败/返回/reload；前端按CONTROL-INVENTORY登记动态实例并记录点击前中后空间/状态链；无写入部分说明范围依据。
- [ ] 非实现者直接看参考与同状态渲染图，协调者独立复核后记录各门槛。检查受影响上游/下游，失败保留并交回owner。

## 验收标准与反例

- [ ] A→B→C，B晚到不能覆盖C；C失败仍显示A完整scope与值；retry请求C成功后一起更新；证据记录在本票独立报告内。
- [ ] 逐一制造六类空/缺状态，消息/分母/可用字段不同；未知不可变0，日期不合法停导入；证据记录在本票独立报告内。
- [ ] 非法market仅改market；坏范围/无账户提示可修正，取消保留旧scope，手动修正后URL/reload一致；证据记录在本票独立报告内。
- [ ] 控件检查触发：本票影响/检查前端；范围：全页四主态及loading/updating/error/retry/empty/missing/extreme；跨组件范围和工具条中间布局均登记，不能仅审最终静态页。
- [ ] 不引入未批准的尺寸、默认折叠/阶段、阈值、行情来源或账户默认；无用户授权差异。
- [ ] 参考与渲染版本、CSS视口/缩放/DPR/状态/数据可比；功能、端到端和视觉分别签结论，不以单测/回调/HTTP成功替代。

## 派发说明

- 默认实现模型 Luna (`gpt-5.6-luna`)，协调者 root 独立review/接受；本轮没有派发执行。
- 候选文件范围（技术落点，非产品需求；派发前按契约核实并锁定）：
- `app/components/trade-review-workspace.tsx`
- `app/components/library/library-browse-state.ts`
- `app/components/library/trade-library.tsx`
- `app/components/library/library-statistics.tsx（STATS负责模块内部）`
- `app/components/library/library-practice-statistics.tsx（STATS负责模块内部）`
- 输入/输出与接线：INTEGRATOR为scope/generation/lastComplete/failedTarget唯一owner；DATA提供显式错误原因，STATS接受完整不可分模型；恢复动作由实际入口触发并传到真实读取，不能仅mock callback。
- 共享文件只由INTERFACES指定owner写；跨owner变更交接给owner，不能并行覆盖。完整页视觉owner为root；完整持久化流owner为DATA；角色未落实到具体受领人前不得执行。
- 禁止：写业务库、变更conf绝对业务库/端口、静默合并/删除人工成果、将mock图/fixture当真实验收、push/merge/publish、擅自扩大或再派子代理。

## 验收证据

实际功能、真实持久化/返回链、独立视觉均 NOT VERIFIED。 未来报告位置：`../evidence/I18/report.md`，每个勾选链接实际日志/截图/持久化重读结果。报告头包含commit/dirty内容manifest、worktree、时间、服务URL/会话、显式隔离库、数据范围、CSS视口/缩放/DPR、输入方式和排除依据。该目录尚未产生证据。

协调者接受：尚未接受。回归须保留旧证据，重开本票并同步README、DESIGN-COVERAGE与FINAL-ACCEPTANCE。

## 历史

- 2026-10-26 拆票：open / ready-for-agent / unassigned；依赖未解除，未实施/未验收。
