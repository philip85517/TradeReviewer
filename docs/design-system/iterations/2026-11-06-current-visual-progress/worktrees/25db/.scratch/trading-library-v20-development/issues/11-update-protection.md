# 变更练习先选更新或新建，并保留历史和人工成果

ID: TL20-I11
State: open
Status: deferred-user-scope
Assignee: unassigned
集成负责人: root
Owner role: DATA
Priority: P0

## Scope / What to build

**本轮范围变更：**[用户决定](../USER-DECISIONS-2026-10-27.md)暂不实现下述复杂更新/新建、差异和历史流程；内容变化作为独立异常处理，具体处理另行确定。保留此票和历史内容，不以暂缓冒充完成；不作为本轮 I14/I20 的前置。

带已完成复盘/笔记/截图的练习→导入变更→查看候选和差异→取消/更新/新建→历史查看→返回→reload。

- 按D03批准稿实现多候选与增删改差异、版本冲突、部分失败和取消；选择前原数据/统计不变。
- 更新保留id/编号，事务提交当前版本和历史；仅有明确对应且无冲突的内容沿用；受影响部分待核对，未受影响完成状态保持。
- 被删除/无法匹配/冲突的交易及人工成果可追溯，绝不静默删除或强移；旧版本只读且不重复进入当前样本。
- 新建独立练习且原对象保持；双窗口并发检测版本，失败保留用户输入，可重试/显式重载，重新编辑能成功保存。

本票是独立开发任务，不是wayfinder决策子票。ready-for-agent表示范围已描述；所有依赖accepted且closed、具体接口/待决交互冻结后才能领取，禁止实现者填补业务政策。局部接受不代表功能整体接受。

## Refs

- [docs/design-system/trading-library-design-spec.md](../../../docs/design-system/trading-library-design-spec.md)，L35–45
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L146–159
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L365–369
- [hcr06-final-rounds-a.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-rounds-a.svg)
- [覆盖矩阵](../DESIGN-COVERAGE.md)中Owner为本票的各行；element/control ID为本轮规划本地ID，正文只有章节/文档stable-id，不能借用别的功能元素全集。
- [视觉契约](../visual-contract.md)、[接口与文件责任](../INTERFACES.md)、[回放转移契约](../REPLAY-STATE-CONTRACT.md)、[控件登记计划](../CONTROL-INVENTORY.md)。D03/D02等新增交互使用决策完成后批准的稿件，不拿不相干参考图代替。

## Blocked by

- [导入有效日期的独立练习，等价重导打开原练习](10-import-practice.md)
- [变更文件的候选、冲突和部分失败怎样让用户处理？](03-update-conflict.md)

## 实施与验证步骤

下列尚不存在的定向测试文件是本票拟增测试落点，执行前核对现有测试组织；它们不是本轮已运行或已通过的检查。

- [ ] 重新读完整原规格/准确状态图、相关矩阵行、所有依赖Resolution与契约；按生命周期领取唯一Assignee，冻结允许修改文件及实际类型签名。有新不明业务问题回决策票。
- [ ] 为 `update-preserves-manual-work` 先建立行为反例并确认失败：新增/删除/改价/分组变更→笔记、原文、截图、批注和来源均保留；只受影响状态待核对。
- [ ] 为 `update-or-new-no-early-write` 先建立行为反例并确认失败：多候选/取消/部分失败/确认前→原内容与统计摘要不变；更新计数仍1，新建计数2；历史不叠加。
- [ ] 为 `practice-update-conflict-recovery` 先建立行为反例并确认失败：双窗口冲突→保留本地输入→显式重载字段/派生值/状态一致→再次编辑保存成功。
- [ ] 在允许范围内实现上列可观察旅程，连接真实提供方/消费者；不扩大任务、不再派代理、不重写全局架构。
- [ ] 执行定向检查：`npm run test:unit -- app/lib/import/tradingview-reimport.test.ts app/lib/storage/trade-revisions.test.ts app/api/storage/trade-revisions/route.test.ts`；实现任务保留失败到通过日志，审计/接受任务保留实际操作证据，不用结构验证代替产品。
- [ ] 显式隔离库，真实操作本票旅程及取消/失败/返回/reload；前端按CONTROL-INVENTORY登记动态实例并记录点击前中后空间/状态链；无写入部分说明范围依据。
- [ ] 非实现者直接看参考与同状态渲染图，协调者独立复核后记录各门槛。检查受影响上游/下游，失败保留并交回owner。

## 验收标准与反例

- [ ] 新增/删除/改价/分组变更→笔记、原文、截图、批注和来源均保留；只受影响状态待核对；证据记录在本票独立报告内。
- [ ] 多候选/取消/部分失败/确认前→原内容与统计摘要不变；更新计数仍1，新建计数2；历史不叠加；证据记录在本票独立报告内。
- [ ] 双窗口冲突→保留本地输入→显式重载字段/派生值/状态一致→再次编辑保存成功；证据记录在本票独立报告内。
- [ ] 控件检查触发：本票影响/检查前端；范围：多候选、差异行、更新/新建/取消、待核对、历史入口及冲突恢复；草图只能来自D03批准稿，不能把练习详情图当作冲突交互已定。
- [ ] 不引入未批准的尺寸、默认折叠/阶段、阈值、行情来源或账户默认；无用户授权差异。
- [ ] 参考与渲染版本、CSS视口/缩放/DPR/状态/数据可比；功能、端到端和视觉分别签结论，不以单测/回调/HTTP成功替代。

## 派发说明

- 默认实现模型 Luna (`gpt-5.6-luna`)，协调者 root 独立review/接受；本轮没有派发执行。
- 候选文件范围（技术落点，非产品需求；派发前按契约核实并锁定）：
- `app/lib/import/tradingview-reimport.ts`
- `app/lib/import/practice-import.ts`
- `app/lib/storage/trade-revisions.ts`
- `app/lib/storage/sqlite-store.ts`
- `app/api/storage/trade-revisions/route.ts`
- `app/components/import/import-confirm-dialog.tsx`
- `app/components/import/import-management-drawer.tsx`
- `app/lib/recall/（仅D01/D03确定的引用适配文件）`
- 输入/输出与接线：DATA提供有expectedRevision的preview/commit/result契约与历史读取；INTEGRATOR处理workspace commit后重读；REPLAY只接收稳定对象与待核对标记，不能自行重分人工内容。
- 共享文件只由INTERFACES指定owner写；跨owner变更交接给owner，不能并行覆盖。完整页视觉owner为root；完整持久化流owner为DATA；角色未落实到具体受领人前不得执行。
- 禁止：写业务库、变更conf绝对业务库/端口、静默合并/删除人工成果、将mock图/fixture当真实验收、push/merge/publish、擅自扩大或再派子代理。

## 验收证据

实际功能、真实持久化/返回链、独立视觉均 NOT VERIFIED。 未来报告位置：`../evidence/I11/report.md`，每个勾选链接实际日志/截图/持久化重读结果。报告头包含commit/dirty内容manifest、worktree、时间、服务URL/会话、显式隔离库、数据范围、CSS视口/缩放/DPR、输入方式和排除依据。该目录尚未产生证据。

协调者接受：尚未接受。回归须保留旧证据，重开本票并同步README、DESIGN-COVERAGE与FINAL-ACCEPTANCE。

## 历史

- 2026-10-26 拆票：open / ready-for-agent / unassigned；依赖未解除，未实施/未验收。
