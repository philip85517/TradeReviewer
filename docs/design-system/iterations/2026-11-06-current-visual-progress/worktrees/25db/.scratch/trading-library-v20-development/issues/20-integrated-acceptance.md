# 协调者独立接受持久化、返回链与最终预览

ID: TL20-I20
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root
Owner role: INTEGRATOR
Priority: P1

## Scope / What to build

**最新用户范围：**复杂变更文件更新流程暂缓，最终验收不依赖 I11；变更文件作为独立异常处理，旧数据迁移到新库并验证，详见[用户决定](../USER-DECISIONS-2026-10-27.md)及[I33](33-legacy-database-migration.md)。下文与本决定冲突的更新旅程仅保留历史。

最终构建→隔离库导入/更新/日期补正→实盘复盘与模拟配对各一次真实保存→逐层返回→reload重开→全链统计核对→新鲜浏览器预览。

- 亲自验真实保存/重读/返回即时变化/reload；取消、保存失败、双窗口版本冲突后保留/重载与再保存均正确；未知、来源、人工成果和未来暴露记录不丢。
- 全套定向测试、typecheck/lint/build/仓库必需测试及原始数据保护证据分别记录；既有失败如实保留，不借局部票accepted当全功能接受。
- 核对19独立视觉及全部控件证据版本一致、无重大差距/未决必需检查；FAIL或NOT VERIFIED阻止整体accepted，回归重开票并同步README/矩阵/最终记录。
- 最终预览URL实际浏览器新鲜打开、服务仍运行，聊天给可点击地址/启动命令/分项结果；不push/merge/publish，除非用户另有请求。

本票是独立开发任务，不是wayfinder决策子票。ready-for-agent表示范围已描述；所有依赖accepted且closed、具体接口/待决交互冻结后才能领取，禁止实现者填补业务政策。局部接受不代表功能整体接受。

## Refs

- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L354–378
- [docs/design-system/trading-library-design-spec.md](../../../docs/design-system/trading-library-design-spec.md)，L111–129
- [hcr06-final-return.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-return.svg)
- [journeys-library-return.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-library-return.svg)
- [journeys-simulation-return.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-simulation-return.svg)
- [覆盖矩阵](../DESIGN-COVERAGE.md)中Owner为本票的各行；element/control ID为本轮规划本地ID，正文只有章节/文档stable-id，不能借用别的功能元素全集。
- [视觉契约](../visual-contract.md)、[接口与文件责任](../INTERFACES.md)、[回放转移契约](../REPLAY-STATE-CONTRACT.md)、[控件登记计划](../CONTROL-INVENTORY.md)。D03/D02等新增交互使用决策完成后批准的稿件，不拿不相干参考图代替。

## Blocked by

- [独立核对整页控件、视觉和关键断点](19-independent-control-visual.md)
- [迁移旧交易和复盘数据到新数据库](33-legacy-database-migration.md)
- [主动回合和练习配对在真实主图保存重开（首道门槛）](12-first-chart-journey.md)
- [独立模拟练习逐层进入回放，更正日期后仍属原练习](14-simulation-entry-date.md)
- [实盘按平仓回合看统计，趋势和分布下钻可返回](15-live-statistics.md)
- [模拟趋势与分布按练习下钻并恢复原选择](17-simulation-distribution.md)

## 实施与验证步骤

- [ ] 重新读完整原规格/准确状态图、相关矩阵行、所有依赖Resolution与契约；按生命周期领取唯一Assignee，冻结允许修改文件及实际类型签名。有新不明业务问题回决策票。
- [ ] 为 `persistent-two-journeys` 执行已定义场景并如实记录通过/失败/未验证：准确对象→保存→read→返回→reload→重开，实盘与模拟各一次；统计日期/身份/状态保持。
- [ ] 为 `original-data-and-manual-work` 执行已定义场景并如实记录通过/失败/未验证：显式隔离库，隔离副本内原始成交逻辑摘要无变化；配置/写入路径证明未接触业务库；更新历史人工成果可读取，原成交记录不损毁。
- [ ] 为 `final-version-preview` 执行已定义场景并如实记录通过/失败/未验证：最终manifest对应运行服务和截图，URL新鲜检查且服务留运行；未测项不改PASS。
- [ ] 在最终运行版本直接验证上述旅程；本票不修改产品，缺陷另建票交对应owner修复再复验。
- [ ] 执行定向检查：`npm run typecheck && npm run lint && npm run test:unit && npm test（执行时按原生命令环境；逐项保存退出码/日志，不先验声称通过）`；实现任务保留失败到通过日志，审计/接受任务保留实际操作证据，不用结构验证代替产品。
- [ ] 显式隔离库，真实操作本票旅程及取消/失败/返回/reload；前端按CONTROL-INVENTORY登记动态实例并记录点击前中后空间/状态链；无写入部分说明范围依据。
- [ ] 非实现者直接看参考与同状态渲染图，协调者独立复核后记录各门槛。检查受影响上游/下游，失败保留并交回owner。

## 验收标准与反例

- [ ] 准确对象→保存→read→返回→reload→重开，实盘与模拟各一次；统计日期/身份/状态保持；证据记录在本票独立报告内。
- [ ] 显式隔离库，隔离副本内原始成交逻辑摘要无变化；配置/写入路径证明未接触业务库；更新历史人工成果可读取，原成交记录不损毁；证据记录在本票独立报告内。
- [ ] 最终manifest对应运行服务和截图，URL新鲜检查且服务留运行；未测项不改PASS；证据记录在本票独立报告内。
- [ ] 控件检查触发：本票影响/检查前端；范围：复核完整范围的登记/验证/差异闭环，亲自重走核心旅程；全局侧栏其余入口仅检查受影响导航回归。
- [ ] 不引入未批准的尺寸、默认折叠/阶段、阈值、行情来源或账户默认；无用户授权差异。
- [ ] 参考与渲染版本、CSS视口/缩放/DPR/状态/数据可比；功能、端到端和视觉分别签结论，不以单测/回调/HTTP成功替代。

## 派发说明

- 本轮没有派发执行。独立审查者必须与所审实现者不同；最终集成接受由root亲自完成，不能委托worker代签。
- 候选文件范围（技术落点，非产品需求；派发前按契约核实并锁定）：
- `.scratch/trading-library-v20-development/FINAL-ACCEPTANCE.md`
- `.scratch/trading-library-v20-development/README.md`
- `.scratch/trading-library-v20-development/DESIGN-COVERAGE.md`
- `.scratch/trading-library-v20-development/evidence/integration/（未来证据）`
- 输入/输出与接线：INTEGRATOR独立接受所有实际消费者串联；DATA提供隔离库逻辑counts/内容摘要前后对照；VISUAL-REVIEWER独立签视觉；任何报告无法替代协调者真实操作。
- 共享文件只由INTERFACES指定owner写；跨owner变更交接给owner，不能并行覆盖。完整页视觉owner为root；完整持久化流owner为DATA；角色未落实到具体受领人前不得执行。
- 禁止：写业务库、变更conf绝对业务库/端口、静默合并/删除人工成果、将mock图/fixture当真实验收、push/merge/publish、擅自扩大或再派子代理。

## 验收证据

功能、端到端行为、原始数据保护、独立视觉、最终预览均 NOT VERIFIED。 未来报告位置：`../evidence/I20/report.md`，每个勾选链接实际日志/截图/持久化重读结果。报告头包含commit/dirty内容manifest、worktree、时间、服务URL/会话、显式隔离库、数据范围、CSS视口/缩放/DPR、输入方式和排除依据。该目录尚未产生证据。

协调者接受：尚未接受。回归须保留旧证据，重开本票并同步README、DESIGN-COVERAGE与FINAL-ACCEPTANCE。

## 历史

- 2026-10-26 拆票：open / ready-for-agent / unassigned；依赖未解除，未实施/未验收。
