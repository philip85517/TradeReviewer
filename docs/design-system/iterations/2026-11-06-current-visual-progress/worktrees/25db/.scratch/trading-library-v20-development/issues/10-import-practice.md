# 导入有效日期的独立练习，等价重导打开原练习

ID: TL20-I10
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root
Owner role: DATA
Priority: P0

## Scope / What to build

**最新用户决定：**内容有变化的文件本轮作为独立异常，暂不开发更新/新建选择流程；旧数据迁移采用新数据库，原库不变，见[决定](../USER-DECISIONS-2026-10-27.md)及[迁移任务](33-legacy-database-migration.md)。下方冲突的变更文件交接描述仅为历史。

新文件选择→文件名唯一有效日期校验→确认→真实保存→打开练习→返回→reload；同内容重导定位原练习。

- 历史成交时间缺失/无效时，按[用户确认](../../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-invalid-history-confirmation.md)列出全部问题原行并阻止导入；修正源文件后重试，禁止有效子集或补造历史日期。
- 文件全部记录是一次练习；原始成交、导入历史、练习身份和版本引用在一次事务内保存。有效练习日及来源、历史区间、导入时间独立。
- 按[D04用户确认](../comments/TL20-D04/2026-10-26-resolution.md)，每份练习仅一个账户和一个规范标的；核对全部源记录，包含未配对及parser未接受的行。多归属或归属未明不能保存为有效练习，不自动拆分、截取首个标的或丢弃冲突行；错误展示接I18。
- 等价比较对全部记录作内容多重集比较：保留重复次数和未配对记录，容忍格式/列序/行序；账户、标的、日期按确认后的契约比较，不能只比文件名/收益。
- 同日多次独立练习稳定 #01/#02，重复不占号；更名或重排不新增；文件名日期缺失/坏值/多个直接导入失败，修正文件名后重试；取消不写入。
- 按已批准存量策略提供 dry-run、兼容和回滚验证；旧复盘引用与原始交易可追溯。变更文件在用户选择前保持无写入，并交下一票处理。

本票是独立开发任务，不是wayfinder决策子票。ready-for-agent表示范围已描述；所有依赖accepted且closed、具体接口/待决交互冻结后才能领取，禁止实现者填补业务政策。局部接受不代表功能整体接受。

在最终E页面扩展前，INTEGRATOR先接既有真实容器的最小只读练习入口：显示已保存practiceId、有效日期和全部原记录，能返回并reload重开；不是mock或另一套业务实体。票14在同一身份/读取链上完善最终练习列表/详情。

## Refs

- [docs/design-system/trading-library-design-spec.md](../../../docs/design-system/trading-library-design-spec.md)，L9–61
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L116–159
- [hcr06-final-sim-ab.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-sim-ab.svg)
- [覆盖矩阵](../DESIGN-COVERAGE.md)中Owner为本票的各行；element/control ID为本轮规划本地ID，正文只有章节/文档stable-id，不能借用别的功能元素全集。
- [视觉契约](../visual-contract.md)、[接口与文件责任](../INTERFACES.md)、[回放转移契约](../REPLAY-STATE-CONTRACT.md)、[控件登记计划](../CONTROL-INVENTORY.md)。D03/D02等新增交互使用决策完成后批准的稿件，不拿不相干参考图代替。

## Blocked by

- [旧数据怎样映射为独立练习并保留复盘引用？](01-legacy-contract.md)
- [一次练习的账户与标的边界是什么？](04-multi-scope.md)
- [练习名称与日期口径](../../trading-library-v11-design-decisions/issues/02-practice-names-dates.md)

## 实施与验证步骤

下列尚不存在的定向测试文件是本票拟增测试落点，执行前核对现有测试组织；它们不是本轮已运行或已通过的检查。

- [ ] 重新读完整原规格/准确状态图、相关矩阵行、所有依赖Resolution与契约；按生命周期领取唯一Assignee，冻结允许修改文件及实际类型签名。有新不明业务问题回决策票。
- [ ] 为 `equivalent-practice-multiset` 先建立行为反例并确认失败：格式/列序/行序变化→id与编号不变，成交/练习/历史版本/统计计数无增加；未配对记录或实际次数变化不能判等。
- [ ] 为 `required-practice-date` 先建立行为反例并确认失败：文件名无日期/多个/无效→导入失败且不写；唯一有效日期→保存及reload保留来源；2026练习包含2022–2023成交仍归2026。不提供导入候选选择或补填。
- [ ] 为 `legacy-practice-reference` 先建立行为反例并确认失败：合成旧库dry-run→迁移→旧笔记/截图引用可读取→回滚；无充分来源的日期按已确认策略处理，不猜测。
- [ ] 在允许范围内实现上列可观察旅程，连接真实提供方/消费者；不扩大任务、不再派代理、不重写全局架构。
- [ ] 执行定向检查：`npm run test:unit -- app/lib/import/practice-import.test.ts app/lib/storage/sqlite-store.test.ts app/lib/storage/sqlite-http-client.test.ts app/api/storage/trades/route.test.ts`；实现任务保留失败到通过日志，审计/接受任务保留实际操作证据，不用结构验证代替产品。
- [ ] 显式隔离库，真实操作本票旅程及取消/失败/返回/reload；前端按CONTROL-INVENTORY登记动态实例并记录点击前中后空间/状态链；无写入部分说明范围依据。
- [ ] 非实现者直接看参考与同状态渲染图，协调者独立复核后记录各门槛。检查受影响上游/下游，失败保留并交回owner。

## 验收标准与反例

- [ ] 全部源记录参与历史区间；缺失/无效时间定位原文件问题行并阻止保存，修正后全量重试；未配对边界参与起止；隔离库失败无写、修正后返回/reload重读。

- [ ] 单账户单标的全部源记录可进入后续确认；多账户、多标的、同代码异市场或归属未明输入不保存为有效练习，不靠丢行/自动拆分通过；隔离库确认取消/失败不写入，重读及reload验证。
- [ ] 格式/列序/行序变化→id与编号不变，成交/练习/历史版本/统计计数无增加；未配对记录或实际次数变化不能判等；证据记录在本票独立报告内。
- [ ] 文件名无日期/多个/无效→导入失败且不写；修正文件名至唯一有效日期→保存及reload保留来源；2026练习包含2022–2023成交仍归2026；证据记录在本票独立报告内。
- [ ] 合成旧库dry-run→迁移→旧笔记/截图引用可读取→回滚；无充分来源的日期按已确认策略处理，不猜测；证据记录在本票独立报告内。
- [ ] 控件检查触发：本票影响/检查前端；范围：文件选择、日期校验失败/改名重试、导入确认/取消、重复提示及打开原练习；包括文件和日期动态状态，不提供导入日期补填或候选选择。
- [ ] 不引入未批准的尺寸、默认折叠/阶段、阈值、行情来源或账户默认；无用户授权差异。
- [ ] 参考与渲染版本、CSS视口/缩放/DPR/状态/数据可比；功能、端到端和视觉分别签结论，不以单测/回调/HTTP成功替代。

## 派发说明

- 默认实现模型 Luna (`gpt-5.6-luna`)，协调者 root 独立review/接受；本轮没有派发执行。
- 候选文件范围（技术落点，非产品需求；派发前按契约核实并锁定）：
- `app/components/trade-review-workspace.tsx（仅INTEGRATOR写：导入确认与最小真实读取/返回接线）`
- `app/lib/trades/practice-contracts.ts（拟新增，D01冻结）`
- `app/lib/import/practice-import.ts（拟新增）`
- `app/lib/storage/sqlite-contracts.ts`
- `app/lib/storage/sqlite-store.ts`
- `app/lib/storage/sqlite-repositories.ts`
- `app/lib/storage/sqlite-http-client.ts`
- `app/api/storage/trades/route.ts`
- `app/api/storage/bootstrap/route.ts`
- `app/lib/storage/import-history.ts`
- `app/components/import/import-confirm-dialog.tsx`
- `app/components/import/tradingview-context-dialog.tsx`
- 输入/输出与接线：D01负责冻结 PracticeId/PracticeRevisionId、日期来源、完整内容比较结果、preview/commit/read 的精确类型。DATA实现持久化与HTTP消费者；INTEGRATOR接入现有workspace确认动作；列表消费者必须读取已保存事实。
- 共享文件只由INTERFACES指定owner写；跨owner变更交接给owner，不能并行覆盖。完整页视觉owner为root；完整持久化流owner为DATA；角色未落实到具体受领人前不得执行。
- 禁止：写业务库、变更conf绝对业务库/端口、静默合并/删除人工成果、将mock图/fixture当真实验收、push/merge/publish、擅自扩大或再派子代理。

## 验收证据

实际功能、真实持久化/返回链、独立视觉均 NOT VERIFIED。 未来报告位置：`../evidence/I10/report.md`，每个勾选链接实际日志/截图/持久化重读结果。报告头包含commit/dirty内容manifest、worktree、时间、服务URL/会话、显式隔离库、数据范围、CSS视口/缩放/DPR、输入方式和排除依据。该目录尚未产生证据。

协调者接受：尚未接受。回归须保留旧证据，重开本票并同步README、DESIGN-COVERAGE与FINAL-ACCEPTANCE。

## 历史

- 2026-10-26 拆票：open / ready-for-agent / unassigned；依赖未解除，未实施/未验收。

## 当前导入日期规则覆盖

[用户最新确认](../../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-single-filename-date-confirmation.md)：只读导入文件名，必须只识别一个有效日期；缺失、无效、多个直接导入失败，改名重试，不提供候选选择或补填。详情更正、编号冲突处理和重导保护人工日期沿用既有确认；不以这些值放过不合格文件名。真实导入/保存/返回/reload 仍 NOT VERIFIED。

当前命名决策：[练习名称与日期口径已接受](../../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-resolution.md)。内部配对标题显示完整练习名与“内部配对 N”；更正日期后沿用原 practiceId，标题与归属更新，稳定编号冲突按原确认处理。运行时与视觉证据仍未验证。

2026-10-28 读取重试独立验收第 1 轮 FAIL：独立组件反例发现，通用 CSV 重试读取成功后，真实解析器再次读取失败会丢失原文件与重试入口；解析器长时间未返回时也没有取消入口。反例保存在 `../evidence/I10-practice-persistence/independent-retry-review/reproduction.test.tsx`，真实浏览器与持久化 NOT VERIFIED；触屏、窄屏按用户要求排除。已转回实现者开展第 2 轮修复，不以定向测试通过代表整体验收。

2026-10-28 读取重试第 2 轮独立组件验收 PASS：二次读取失败可保留原文件重试，挂起取消后迟到的成功或失败不会覆盖新的预览；独立反例 3/3、导入组件回归 79/79，详见 [票 31](31-practice-persistence-journey.md) 和 `../evidence/I10-practice-persistence/independent-retry-review/round2-reproduction.test.tsx`。协调者在隔离数据库的桌面浏览器验证了正常导入、保存、刷新、返回及同一练习重开；故障注入的真实浏览器操作和独立同状态视觉仍 NOT VERIFIED，不能以组件验收代替完整票据验收。通用 CSV 解析器的非读取异常是否被错误描述为读取失败是待验证风险，尚无已证实缺陷。
# 2026-10-29 定向独立复验

三个源解析与准备入口测试文件[独立复验](../evidence/I10/import-existing-20261029-independent.md) 147/147；其中跨层相似断言不等同独立用户场景。真实持久化、失败恢复、浏览器与同态视觉未由此证明，整票保持开放。

2026-10-29：文件名规则经客户端、进程内真实路由与隔离 SQLite 的[独立定向复验](../evidence/I10/filename-journey-20261029/independent-review.md)限定 PASS：三类拒绝同连接无写，合法修名保存、关闭连接重读及等价预览身份不变。实际浏览器打开、返回/reload、真实网络及同态视觉仍 NOT VERIFIED。

2026-10-29：[协调者独立浏览器复验](../evidence/I10/import-browser-journey-20261029/coordinator-independent.md)在隔离数据库以单个合成文件确认保存、刷新、返回与重导打开相同练习；保留截图及前后代码清单。完整异常场景、复盘保护、全部控件和独立同态视觉仍 NOT VERIFIED；打开相同练习不等同证明所有表无写入。

2026-10-29：[读取后错误分类调查](../evidence/I10-import-error-followup-20261029/report.md)和[独立复核](../evidence/I10-import-error-followup-20261029/independent-review.md)确认源码存在条件性误分类风险，但五种合成输入未自然复现读取后抛错；未修改产品代码，故障是否实际可达仍 NOT VERIFIED。真实浏览器异常、两次读取一致性及完整视觉不由此证明。

2026-10-29：[历史时间导入链](../evidence/I10-history-journey-20261029/report.md)经[独立复核](../evidence/I10-history-journey-20261029/independent-review.md)限定通过：所测多行异常有行号、预览同连接无写，修正后完整保存并关闭连接重读。直接提交异常、显示完整原行文本、当前浏览器返回/reload 及同态视觉未验证。

2026-10-29：文件名错误[桌面有界观察](../evidence/I10-filename-browser-retry-20261029/report.md)的[独立证据复核](../evidence/I10-filename-browser-retry-20261029/independent-review.md)支持三类错误提示及隔离库前后摘要一致、合法修名后的持久化；返回与重开动作和界面全部原行缺乏直接留存证据，完整旅程 NOT VERIFIED。原报告对 F4 的过宽判断已修订并由[协调者复核](../evidence/I10-filename-browser-retry-20261029/correction-coordinator-review.md)。

2026-10-29：等价重导[独立定向复核](../evidence/I10-multiset-independent-20261029/review.md)覆盖重复次数及 17 列变化、等价重排、七表净变化和重读，进程内入口 1/1；详情不是每次测试后均重读，浏览器和真实网络未验证。原报告过宽描述已[修订复核](../evidence/I10-multiset-independent-20261029/correction-independent-review.md)，保留原 FAIL。

2026-10-29：历史时间异常绕过预览直接提交的[独立复核](../evidence/I10-history-direct-commit-20261029/review.md)限定通过：三类样本 422 并定位行号，64 表快照及同连接写入计数不变，关闭连接重读一致；进程内路由和隔离库不代替完整浏览器或 I10 验收。

2026-10-29：有效数据后出现未闭合 CSV 的[独立集成复核](../evidence/I10-unclosed-prefix-20261029/independent-review.md)限定通过：preview 拒绝、commit 422，隔离库表和已有练习重读保持；仅预览断言问题行号，具体列号及提交诊断位置未由断言验证。未修改产品代码。
