# V2.0 开发协调与问题记录

## 产品与内部资料边界修正（2026-10-27）

按用户最新要求，开发资料备份和管理是待单独讨论的项目 harness 议题，`ROOT-AUDIT-002` 不作为交易库产品功能验收或开发关闭的阻塞条件。历史失败和 STOPPED / UNRESOLVED 5/5 不变，不进行第六轮。下方旧的“依赖结构门的最终归档/功能关闭停止”属于已纠正的历史判断；产品自身的未完成项和真实验收要求不因本次纠偏消失。当前代码、部署工具例外和产品完成状态见[边界审查](PRODUCT-BOUNDARY-REVIEW.md)。

## 2026-10-27 当前阶段结论（以下旧批次记录保留为历史）

**完整V2.0未接受；Task31/32保持open / acceptance-failed。** [协调者阶段验收](evidence/I10-practice-persistence/root/acceptance.md)已归档：两个实际Sol6.1Ultra实现者各配不同Luna5.6Max；DATA SPEC/QUALITY PASS，root638/638相关集成回归、tsc及最终生产build PASS，lint仍有基线1error+10warnings、新增0。

root已真实完成完整原行保存、返回/reload、等价打开、整份拒绝、事务失败回滚及原命令重试、列表/详情停服恢复，以及第二HTTP客户端先保存后浏览器等价打开同ID。隔离库当前4份合成练习原bytes完整，46既有表含时间与Recall不变；[最终浏览器后53表/schema/migrations核对](evidence/I10-practice-persistence/root/final-43-evidence-check.json)PASS。

证券确认字段重叠在第1/5轮解决；[独立Luna20图复验](evidence/I10-context-layout/reviewer/report.md)对五必需视口、断点和长名的局部SPEC/QUALITY PASS。旧FAIL与错尺寸采集保留。完整[局部控件登记](evidence/I10-practice-persistence/root/CONTROL-AUDIT.md)为44 PASS / 13 NOT VERIFIED（57项）；动作结果43/56，不能说整页100%。原生popup/触控/真机键盘及若干竞态阻断分支仍NV，单测不能替代。

**ROOT-AUDIT-002第5轮仍FAIL，已STOPPED / UNRESOLVED 5/5**：[冻结引用链接识别失败与停止记录](evidence/I10-practice-persistence/root/structure-stop.md)。不继续第6轮，不改冻结包绕过；依赖结构门的最终归档/功能关闭停止。其他有限PASS保留。资金估值来源、变更文件政策、迁移及真实主图/完整返回链仍待决策或开发。

[当前实际预览](http://127.0.0.1:3334/?keep=sentinel&practiceId=79057bbf-2f29-46fa-ab42-09b6125f3df7#origin)已在真实浏览器检查，生产session33895仍运行，使用显式合成隔离DB；[截图](evidence/I10-practice-persistence/root/final-42-delivery-preview-1440.jpg)、[版本与启动说明](evidence/I10-practice-persistence/root/acceptance.md)。没有提交、推送、合并或发布。

2026-10-28 [持久化技术合同](evidence/I10-atomic-contract/acceptance.md)已接受（Luna 9独立反例、root21合成/strictTS/冻结核验）。真实保存纵切开始委派 DATA 与 UI 两位独立 Sol6.1Ultra；每位专属不同 Luna5.6Max，root负责首次真实保存→GET→返回/reload和整页视觉。缺少费用/估值不阻断有效练习，非法必需字段整份拒绝；SQLite/API/UI各门仍NOT VERIFIED。

2026-10-28 当前局部接受：文件拒绝与预览元数据安全修复经专属不同 Luna SPEC/QUALITY 双 PASS 和 root 独立实际浏览器/隔离 DB/视觉复验后[接受](evidence/I10-preview-metadata/acceptance.md)。Task28 初验 FAIL 保留；两个稳定问题各 1/5 已解决。登记准确为 35 PASS / 0 FAIL / 3 NOT VERIFIED（额外浏览器内部 ordering），23/23 action 已执行；不冒称浏览器竞态全通过。完整 I10/V2.0、独立练习保存与真实主图仍 NOT VERIFIED。


用户于2026-10-26授权启动多个实现Agent：`gpt-6.1-sol` / `ultra`；每位实现者配不同的 `gpt-5.6-luna` / `max` 独立验收；root协调进度、集成复核及问题记录。是否可用以实际工具返回为准，不静默替换。

## 执行规则

- 原拆票交付已完成；本轮开始开发。使用现有隔离工作树和任务分支，保留原文档；不提交、推送、合并、发布，不碰业务库。
- 同一问题使用稳定Problem ID；一轮是“针对该问题的修复派发 + 有证据的复验”。初次发现不算修复轮。达到5轮仍未解决，停止该问题及其依赖，不更名重置计数；保留失败，不把受阻票标完成。其他独立工作可继续。
- 只派发无文件重叠、接口清楚的切片。未决HITL不由实现者补定；技术事实和纯计算可先推进，不扩大依赖真实主图的UI。
- 每个实现Agent有独立验收Agent；验收报告必须分别给出规格符合性和质量结论。root仍亲自复核集成；局部通过不代表I10–I20整票或完整产品完成。

## 第一批

2026-10-26用户补充确认“一份练习仅可能包含一个账户和一个标的”。[D04已接受](comments/TL20-D04/2026-10-26-resolution.md)，领域词汇、接口草案和I10/I14/I16验收约束同步；撤回多范围展示提议。原方向票继续处理同标的内混合多空，不自动代答。此次为决策文档同步，未再次派发或声称运行时校验已实现；其余依赖仍按实际前沿判断。

|切片|实现模型|允许写入|验收模型|状态|
|---|---|---|---|---|
|旧数据怎样映射为独立练习并保留复盘引用？|gpt-6.1-sol / ultra|evidence/decisions/TL20-D01/；只读产品|gpt-5.6-luna / max：legacy_acceptance_luna，工具已接收|ACCEPTED（事实准备）：Luna SPEC/QUALITY双PASS；root内存10项及候选Bundler tsc通过，[接受记录](evidence/root-D01/acceptance.md)；产品契约仍未冻结|
|练习指标纯计算合同（模拟统计的独立前置）|gpt-6.1-sol / ultra|app/lib/trades/practice-metrics.ts及同名test；evidence/I16-core/|gpt-5.6-luna / max：metrics_acceptance_luna，工具已接收|ACCEPTED（纯核心）：60项测试；Luna SPEC/QUALITY双PASS；root 111项回归及项目tsc通过，[接受记录](evidence/I16-core/acceptance.md)|

纯计算独立生命周期见[在未知输入下准确计算独立练习指标](issues/21-practice-metrics-core.md)；它是11张主票之外的前置，不以整票的HITL阻塞为由猜测来源。

## 问题账本

|Problem ID|任务/现象|证据|修复轮数|结果/阻塞影响|
|---|---|---|---|---|

|ENV-001|基线测试缺Vitest（exit 127）|[环境检查](evidence/environment-baseline.md)|1|统一npm ci后已解决；相关27项基线测试通过，不计为算法修复轮|
|TL20-LEG-001|候选changeDate仅校验成交revision，不能发现并发日期修改|[候选类型](evidence/decisions/TL20-D01/candidate-contracts.ts)、[独立审查](evidence/decisions/TL20-D01/review.md)|1|候选层已解决并独立接受：元数据CAS及duplicate-open不写人工日期；运行时未实施/未验证，保留后续门槛|
|TL20-MET-001|150,000点权益/缺价路径触发JS参数上限|[首份失败](evidence/I16-core/long-path-red.log)、[缺价失败](evidence/I16-core/long-unknown-path-red.log)、[修复后](evidence/I16-core/green-02.log)、[独立复验](evidence/I16-core/review.md)|1|已解决；专属Luna及root接受纯核心；原失败保留，不更名重置计数|
|SYN-HARNESS-001|合成脚本传入undefined SQLite options被Node26拒绝|[原始轮次记录](evidence/decisions/TL20-D01/verification-rounds.md)|1|研究脚本已修，root独立10/10 PASS；仅内存库|
|SYN-FIXTURE-001|合成样本漏sourceTimezone及幂等请求混入返回字段|[原失败](evidence/decisions/TL20-D01/synthetic-results.round-1.json)、[轮次说明](evidence/decisions/TL20-D01/verification-rounds.md)|1|样本已修，root独立10/10 PASS；非生产改动|
|ENV-002|root候选tsc首命令误用NodeNext路径规则，TS2835|[原失败](evidence/root-D01/candidate-typecheck-nodenext-failed.log)、[项目Bundler配置复验](evidence/root-D01/candidate-typecheck.log)|1|改正命令后exit0，不改候选导入，不计产品修复轮|
|DATE-AUDIT-001|日期Luna冻结diff审计脚本遗漏末尾换行、空文件边界|[原失败与两轮复验](evidence/I10-date/review.md)|2|仅审计harness已解决；17工人/7参考hash及逐文件diff重建PASS，无产品代码修复|
|ENV-003|scope及history工人shasum因Perl LC_CTYPE退出9|[首次失败](evidence/I10-scope/07-hash-tool-environment.log)、[首次独立复算](evidence/I10-scope/10-hash-verification.log)、[同原因再现](evidence/I10-history/worker-check-07-shasum-environment.log)、[本批Node复算](evidence/I10-history/worker-check-08-source-hashes.log)|2|两次均改用Python/固定Node crypto后通过；沿用同ID累计，不改产品；后续直接使用内建hash工具|
|DOC-AUDIT-001|核验报告提前链接尚未写出的命令记录，首次结构检查失败|[原失败](evidence/root-batch2/structure.log)、[复验](evidence/root-batch2/structure-r1.log)|1|记录写出后结构检查PASS；不涉及产品修复|
|ROOT-AUDIT-001|root冻结审计误假设CSV包沿用旧hash字段/值结构，先assert失败，再误报嵌套hash对象为漂移|[首失败](evidence/root-batch3/pre-acceptance-hash-check.log)、[第1轮失败](evidence/root-batch3/pre-acceptance-hash-check-r1.log)、[第2轮复验](evidence/root-batch3/pre-acceptance-hash-check-r2.log)|2|按实际manifest支持diff.sha256和{sha256,bytes}后PASS；只修审计脚本，126工人文件无漂移，不修改或重冻产品|
|CSV-AUDIT-001|CSV独立审查两项oracle手算原文offset错误，首次7通过/2失败|[可恢复初始失败](evidence/I10-csv-source/review-independent-counterexamples-initial-failure-transcript.log)、[初始oracle标识复现](evidence/I10-csv-source/review-independent-counterexamples-initial-oracle-repro.log)、[修正](evidence/I10-csv-source/review-independent-counterexamples-oracle-diff.patch)、[root复验](evidence/root-batch3/csv-review-counterexamples.log)|1|只修审查测试后9/9 PASS；root不调用parser的原文位置检查亦PASS。首次精确时间/exit/分流不可恢复已明示，不补造；无产品返修|
|DOC-STYLE-001|独立审查Markdown行尾双空格同类再现于Task31 DATA报告|[原失败](evidence/root-batch3/structure-pre.log)、[原报告字节保留与逐项核验](evidence/I10-practice-persistence/root/final-32-independent-checks.json)、[最新归档复核](evidence/I10-practice-persistence/root/final-43-evidence-check.json)|3|已解决：原审查者只移除自有报告3/4行各两个ASCII空格，原12704bytes报告raw保留；语义、初验FAIL和结论不变。当前报告12700bytes/SHA匹配；不是产品修复。|
|ROOT-AUDIT-002|归档引用清单/inline与冻结包引用格式兼容，同一稳定问题|[原失败](evidence/root-batch3/structure-style-r1.log)、[第2轮](evidence/root-date-policy/structure-after-title.log)、[第3轮](evidence/I10-preflight-ui/root/structure-after-freeze.log)、[第4轮历史PASS](evidence/I10-preview-metadata/root/structure-after-acceptance-r4-recheck.log)、[第5轮FAIL](evidence/I10-practice-persistence/root/final-33-structure-stop-r5.log)|5/5|**STOPPED / UNRESOLVED**：第5轮严格支持DATA allowlistedFiles/unchangedReferences后，UI冻结reference相对CONTEXT链接仍失败。只改validator，保留原脚本与原包；不进行第6轮/改包绕过。依赖结构门的最终关闭停止；[完整记录](evidence/I10-practice-persistence/root/structure-stop.md)。|
|I10-PF-SAFETY-001-METADATA-PREVIEW-WRITE|新标的预览取消仍发布证券元数据|[原失败及修复接受](evidence/I10-preview-metadata/acceptance.md)|1|Task29 专属 Luna 与 root 实际隔离 DB/浏览器复验已解决；历史 Task28 FAIL 保留。|
|I10-PF-ENTRY-002-CSV-ACCEPT|补充文件 chooser 的 accept 排除 CSV|[修复和真实原生选择证据](evidence/I10-preview-metadata/acceptance.md)|1|已解决；真实 CSV 文件选择及后续取消/保存路径通过，未将组件合成选择冒充浏览器证据。|
|I10-PERSIST-LEGACY-RELOAD-WRITE|只读数据页/练习页启动与reload自动保存旧复盘状态、改updated_at|[原失败](evidence/I10-practice-persistence/root/first-journey-checkpoint.md)、[第1轮实际复验](evidence/I10-practice-persistence/root/r1-06-first-journey-check.json)|1|已解决最小首旅程：UI限定review页才自动保存，真实review编辑正向回归；root首页/preview53表无写，保存/返回/reload后46既有表含全部时间字段与Recall不变。允许原票边界扩展，整票/视觉/独立接受未签。|
|ROOT-PERSIST-FIXTURE-001|root自造Recall sentinel不符合RecallDocument，导致summary503|[原seed](evidence/I10-practice-persistence/root/r1-legacy-sentinel-seed.json)、[仅隔离库fixture修复](evidence/I10-practice-persistence/root/r1-valid-synthetic-recall-seed.json)|1|仅新R1临时库fixture按生产factory/validator修正；原失败DB及seed保留，无产品修改。真实summary200且保存/reload后草稿及正式副本不变。|
|I10-PERSIST-STALE-PREVIEW-RETRY|stale-preview后旧保存命令未清理|[RED](evidence/I10-practice-persistence/ui-worker/commands/14-stale-preview-red-scoped.log)、[独立判断](evidence/I10-context-layout/reviewer/report.md)|1|代码/冻结测试与专属Luna静态判断PASS：清过期preview/command，保留File/input，重检后新命令；普通失败原命令重试已实测。stale-preview实际浏览器分支仍NOT VERIFIED，不以second-client equivalent代替。|
|I10-PERSIST-NONTV-LIMIT|16MiB误阻非TV通用CSV旧行为|[RED](evidence/I10-practice-persistence/ui-worker/commands/19-generic-csv-limit-red.log)、[独立判断](evidence/I10-context-layout/reviewer/report.md)|1|代码/冻结78测试与专属Luna静态判断PASS：generic先识别，非TV保留legacy，显式TV读前拒绝。非TV超限真实浏览器入口仍NOT VERIFIED。|
|I10-PERSIST-UI-CONTEXT-LAYOUT-001|证券确认字段在1440/1280/759/760重叠|[原FAIL](evidence/I10-practice-persistence/ui-reviewer/report.md)、[Task32独立20图](evidence/I10-context-layout/reviewer/report.md)、[root状态/零写](evidence/I10-context-layout/root/verification.json)|1|字段布局缺陷局部已解决，五视口/断点/长名SPEC与QUALITY PASS。原生popup/触控/软件键盘仍NV；Task32保持open/acceptance-failed。原报告发现阶段误称round1，协调账本统一发现0、实际修复复验1，不重置计数。|

待决业务政策沿用决策票，不作为算法失败反复尝试。

## 已发现且保留的来源/迁移缺口

以下是现有实现事实和待决政策，不是本轮已经修复的产品问题。未派修复，因此修复轮数为0；不与研究脚本或核心算法的修复轮混算。

|ID|证据及影响|后续责任|
|---|---|---|
|FULL-CONTENT-001|现parser会排除重复角色、未配对及无效源行，accepted executions不足以证明完整文件多重集等价；[S06/S07与源码事实](evidence/decisions/TL20-D01/report.md)|DATA / I10先保留完整源行，再接严格比较；当前未实施|
|LEGACY-REF-001|现Recall对账仅比较ID增删，同ID改财务内容仍可能completed；改开仓又可能换episode键；[S08/S09](evidence/decisions/TL20-D01/report.md)|D01/D06及DATA/REPLAY；保留旧作品和正式版，不能自动迁移或清空|
|LEGACY-IDENTITY-001|规范TV episode可跨run，旧run读写合同不同，批次不是稳定practice身份；[S01–S05](evidence/decisions/TL20-D01/report.md)|D01及后续有界dry-run；未检查真实旧数据，不猜映射|
|PROD-VERIFICATION-001|新事务、迁移、恢复、文件暂存和完整来源均未实现；10项内存检查只验证当前事实；[Luna边界审查](evidence/decisions/TL20-D01/review.md)|DATA/REPLAY及root；生产运行时与隔离库验收仍未开始，0轮修复|
|HITL未决|资金估值来源、日期例外、人的动作、混合方向分类、更新冲突和非法入口等；见[决策地图](issues/00-map.md)|账户/标的边界已按D04用户确认关闭；其余按各票既有owner与用户真实决定推进，不由Agent默认回答|

实际调用已被工具接收：legacy_contract_sol、practice_metrics_sol使用gpt-6.1-sol / ultra；legacy_acceptance_luna使用gpt-5.6-luna / max。当前并发上限含root为4席；第一位Luna完成只读预检释放席位后，已独立启动metrics_acceptance_luna（gpt-5.6-luna / max），不复用验收者。两位Luna在冻结产物前仅做准备，不预判通过。

## 协调者检查（当前）

- root亲读指标源码和关键行为测试；`npm run test:unit -- app/lib/trades/practice-metrics.test.ts app/lib/trades/episode-metrics.test.ts app/lib/reviews/library-performance.test.ts app/lib/reviews/library-performance.acceptance.test.ts app/lib/reviews/review-metrics.test.ts app/lib/reviews/trading-room-metrics.test.ts`：6 files / 111 tests PASS，exit0，[原始日志](evidence/I16-core/root-integration-tests.log)。
- `npm run typecheck`：exit0，[项目配置类型检查](evidence/I16-core/root-project-typecheck.log)。
- [专属Luna审查](evidence/I16-core/review.md)SPEC/QUALITY双PASS，9项独立反例有可运行脚本及原始输出；root核对冻结hash后签署[纯核心接受](evidence/I16-core/acceptance.md)。UI、来源provider、持久化和整票均未接受。
- D01专属Luna SPEC/QUALITY双PASS；root核对12工人产物+4参考hash、亲读现有链路，独立10项合成及Bundler strict tsc通过，签署[事实准备接受](evidence/root-D01/acceptance.md)。[Resolution](comments/TL20-D01/2026-10-26-resolution.md)已记录，未决政策及所有生产门槛保留。
- [首批最终核验](evidence/development-verification.md)：结构、链接、124覆盖行、58批准来源及25项冻结工人产物全部通过；两张参考票仅生命周期/证据更新。11张主任务仍受未结业务/集成前置阻塞，无同一问题达到5轮，未接受整产品。

## 第二批：导入基础校验

|切片|实现者 / 模型|专属验收者 / 模型|状态|
|---|---|---|---|
|TL20-I10-SCOPE / 完整源行唯一归属|practice_scope_sol / gpt-6.1-sol ultra|scope_acceptance_luna / gpt-5.6-luna max（正式审查已接收）|ACCEPTED（纯核心）：Luna双PASS/7项独立反例，root253项回归及项目tsc/ESLint通过；[签署](evidence/I10-scope/acceptance.md)|
|TL20-I10-DATE / 有效日与已提取候选|practice_date_sol / gpt-6.1-sol ultra|date_acceptance_luna / gpt-5.6-luna max（正式审查已接收）|ACCEPTED（纯核心）：Luna双PASS/11项独立反例，root253项回归及项目tsc/ESLint通过；[签署](evidence/I10-date/acceptance.md)|

两者无共享写文件，也不消费对方尚未冻结输出；root独占任务/矩阵/账本。未实现文件名提取、完整源行adapter、日期持久化或UI，I10/I14与整产品仍NOT VERIFIED。编号冲突已获用户确认，记录独立评论，不塞进本批日期校验。

日期编号决策：用户已[确认冲突只改被更正练习](../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-date-number-conflict-confirmation.md)，保留ID、复盘和编号历史，目标日期同标的下分配下一个未用号，其他练习不重排。运行时NOT VERIFIED；原日期票剩余问题仍open。

跨午夜日期决策：用户已[确认保留一份练习并在导入确认页选定单个日期](../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-cross-midnight-confirmation.md)，标题、筛选与统计统一归属，不按历史成交日拆分；真实导入、持久化及统计接线仍NOT VERIFIED。

第二批root独立检查：9文件253项回归、项目TypeScript（关闭增量缓存）和四个本批产品文件ESLint均exit0，命令/时间/退出码及原日志见[汇总核验](evidence/root-batch2/verification.md)。两项专属Luna共18项独立反例通过，无产品返修；68项两批冻结工人产物保持不变。历史成交时间缺失/无效现已获用户确认阻止导入并定位原行，详见下方决策记录；真实接线仍未实施。所有11张完整产品主票保持open，未签署产品完成；当前没有问题达到5轮停止阈值。

历史时间异常决策：用户已[确认缺失/无效时阻止导入并定位全部问题原行](../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-invalid-history-confirmation.md)，修正源文件后重试，不丢行或使用有效子集冒充完整区间。该确认未证明实际 parser、UI 或持久化已支持。原日期票仍待候选冲突与内部标题确认。

## 第三批：历史区间完整性

|切片|实现者 / 模型|专属验收者 / 模型|状态|
|---|---|---|---|
|全量历史交易日期校验并定位全部坏行|practice_history_sol / gpt-6.1-sol ultra|history_acceptance_luna / gpt-5.6-luna max|ACCEPTED（纯核心）：69项worker、Luna双PASS/5项独立反例、root复核通过；[签署](evidence/I10-history/acceptance.md)|
|保留完整CSV记录及原物理行/offset|practice_csv_source_sol / gpt-6.1-sol ultra|csv_source_acceptance_luna / gpt-5.6-luna max|ACCEPTED（纯词法）：61项worker、Luna双PASS/9项独立反例、root复核通过；[签署](evidence/I10-csv-source/acceptance.md)|

[任务](issues/24-practice-history-core.md)、[冻结技术合同](evidence/dispatch/practice-history-brief.md)。用户历史异常处理已确认，候选冲突与内部标题仍在原日期票。不会把未配对或 parser 排除行漏掉的已接受列表伪报完整；真实源 adapter 仍是后续前置。root 继续维护接口与证据，无重叠写文件。

第三批另行派发[保留完整CSV记录并定位原文件物理行](issues/25-practice-csv-source.md)：practice_csv_source_sol / gpt-6.1-sol ultra；专属 csv_source_acceptance_luna / gpt-5.6-luna max 已在冻结后开始正式审查。仅两个新产品文件及自有证据，无历史核心调用或共享写入；全源记录包含表头/空/重复/坏业务值并保留原始offset及物理行。本纯词法前置不等于 FULL-CONTENT-001 生产接线已修复。

CSV来源定位合同预检已澄清：前置BOM虽不进入首cell，仍占原始UTF-16首行第1列，首内容column2；offset/column不重编号。澄清发生在实现/冻结前，不计产品修复轮。

root已亲读本批四个实际产品/测试文件，独立6文件283项回归、项目TypeScript（无增量缓存）、四文件ESLint及4项合成全源组合检查均exit0，见[evidence/root-batch3/](evidence/root-batch3/)。组合反例保留未配对最早记录、坏日期与空逻辑行对应原物理行、词法失败不输出子集；它不是生产adapter。接受前hash复验见[成功快照](evidence/root-batch3/pre-acceptance-r2-hashes.json)：126工人文件无漂移，本批history20/CSV17参考全部匹配；58批准来源及124覆盖行同步。先前审计脚本失败保留在上述账本。

专属不同Luna现均已独立SPEC/QUALITY双PASS，分别5项/9项独立反例通过；root已签署接受并关闭两张纯核心票。CSV初始两项失败为审查oracle错误，原失败/修正/标识复现保留；root独立原文位置核验和最终9项反例复跑exit0。无产品finding或产品返修，原日期HITL与11张主产品票保持open；真实导入、原行UI、持久化、返回/reload和完整产品全部NOT VERIFIED。没有问题达到5轮未解阈值。

第三批最终核验见[协调者汇总](evidence/root-batch3/verification.md)。文档格式和归档快照路径检查各修复1轮后通过；原失败与审计工具变更保留，17份原始镜像不改字节。126份冻结工人文件、58批准来源与124覆盖行均匹配；只允许6张已接受参考票更新生命周期/证据，不把主产品门槛改为通过。

## Date-policy revision, 2026-10-26

User explicitly requires one recognized valid date in File.name, otherwise import failure; no candidate selection or manual rescue. The exact user-response addendum is linked from the active date ticket. This is a requirement change, not a defect repair round. The date-core issue is reopened; historical evidence remains immutable. Only CONTEXT.md was rebound in the approved-source manifest, with before/after hashes in evidence/I10-date-policy/source-rebind.json.

Task26 owner practice_date_policy_sol (Sol6.1Ultra), paired independent date_policy_acceptance_luna (Luna5.6Max). Two date files only; root owns shared records. Real import, UI, persistence, return and reload remain NOT VERIFIED.

用户已确认内部配对沿用画板并显示完整练习名称，原命名日期决策已按真实回复[接受并关闭](../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-resolution.md)。I10 解除该决策依赖，下一步仍须冻结实际源适配与生产保存接口；不将决策接受记作产品通过。

DP-TYPE-01：新日期函数的 regex 匹配首项在项目严格类型检查下仍为 string | undefined；Sol 保留首次失败，定位为长度判断未提供索引窄化，第1轮明确 undefined guard 修复复验已解决；214项定向/ESLint/tsc及root336项回归/tsc通过，专属 Luna双PASS，见[本次接受](evidence/I10-date-policy/acceptance.md)。


Task26 当前版本已由 root [接受](evidence/I10-date-policy/acceptance.md)：Sol6.1Ultra、不同 date_policy_acceptance_luna Luna5.6Max SPEC/QUALITY双PASS与8项独立反例；root336项/tsc及55 payload/20快照/实际diff复算通过。只关闭纯日期票，真实 I10/I14、生产DB/UI/返回/reload仍 NOT VERIFIED。ROOT-AUDIT-002 同类审计工具问题累计第2轮已解决，原失败保留；无问题达到5轮。

## 第四批：完整业务来源预检

[Task27](issues/27-tradingview-practice-source.md)的四项纯核心前置均已接受，精确接口/全部17列/原行保留/数值规范化和内容多重集已在[派发合同](evidence/dispatch/tradingview-practice-source-requirements.md)冻结。只允许两个新源/测试文件和自有证据；没有生产调用者，不把 prepared 当作可保存资格或相同练习身份。准备派发 tradingview_practice_source_sol / gpt-6.1-sol ultra，专属不同 tradingview_practice_source_acceptance_luna / gpt-5.6-luna max 在冻结后验收；root 负责下一步实际入口接线。

实际工具已接收上述 Sol 实现与冻结后的专属不同 Luna 正式验收。Sol 冻结48自产物、24原文快照及两个产品文件，97新增/443定向测试PASS（4私有样本skip），ESLint/无增量tsc通过；尚待Luna/root接受。TVSRC-TEST-FIXTURE-001：it.each数组参数被展开，6项fixture TypeError，第1轮改对象参数后恢复完整97项有意义RED再GREEN；全部初始失败保留，不算两轮产品修复。

root准备[Task28真实文件拒绝与恢复](issues/28-import-preflight-rejection.md)，已冻结入口/错误提示/补充导入的局部控件范围和合同。实际服务使用显式合成隔离库、端口3334；旧版真实文件选择截图及限制见[审计登记](evidence/I10-preflight-ui/CONTROL-AUDIT.md)。Task27尚待接受，不提前派发消费者；完整产品全部门仍NOT VERIFIED。frontier.py预先适配Task27明确的artifact/list-reference清单格式，不修改原冻结包或重置ROOT-AUDIT-002历史轮数。


2026-10-26 Task27纯模块[root接受](evidence/I10-tradingview-source/acceptance.md)：专属不同Luna SPEC/QUALITY PASS+6独立反例，root430项/无增量tsc/冻结48+24核验PASS，关闭issue27。Task28前置解除，领取到import_preflight_ui_sol后按唯一合同派发。真实浏览器局部审计更正源码事实：交易库按钮先转数据页，非数据页错误没有关闭控件；没有新增控件或设计决定。

实际 spawn_agent 已接收 import_preflight_ui_sol / gpt-6.1-sol / ultra（fork none），worker 已确认唯一五文件合同并开始有意义的 RED；冻结后由不同 import_preflight_ui_acceptance_luna / gpt-5.6-luna / max 独立验收。root 不改五个受领文件，继续原生文件选择、局部空间与隔离库证据准备。无问题因尝试次数而重置。

2026-10-27 Task28五文件已冻结；不同 import_preflight_ui_acceptance_luna 实际gpt-5.6-luna/max已完成初验。独立33目标测试与五视口视觉截图通过，root独立90项/5文件相关回归通过。真实新标的300857预览取消使instruments从1到2；reject-only各表不变。root已核实enrich/resolver/API repository写链，Luna独立同判。稳定问题 `I10-PF-SAFETY-001-METADATA-PREVIEW-WRITE` P1，修复/重验0/5。Task28保持open/acceptance-failed，按[Task29合同](evidence/dispatch/preview-metadata-safety-requirements.md)限定修复，不删除旧失败或修改已冻包。控件/最终安全复验仍未接受，无问题达到5轮。


### Task29 实际修复派发确认与可达性补充

原Sol 6.1 Ultra已通过followup_task恢复同一实现者，确认读取Task29精确合同，采用每预览暂存metadata，仅成功merge/revise后发布；拒绝/取消/迟到/无变化/保存失败均不可发布，cache失败不伪装成交失败。独立Luna 5.6 Max仍为原专属验收者，待新冻结包再启动复验。源扫描另外发现通用补充chooser accept只列Excel/PDF，真实CSV不可选，Task28组件applyAccept:false不能证明可达；root在冻结前授权只扩充该input的CSV类型，保留其他规则。单独稳定问题 I10-PF-ENTRY-002-CSV-ACCEPT，0/5，与metadata问题分别计轮。Sol已确认纳入并移除相关CSV补充测试的accept绕过。首次修复+复验尚未结束，不能提前计为通过。

root补齐Task28历史版31个局部控件/状态登记：27已执行，PASS26/FAIL1，4项仍NOT VERIFIED；鼠标/选择20、键盘5、disabled观察1、reload1，未以此宣称整页覆盖。独立报告仍保留初验FAIL，新版本将重新绑定运行指纹及真实DB。见 evidence/I10-preflight-ui/CONTROL-AUDIT.md、control-register-r1.json。


Task28历史R1由原专属Luna独立补充复核，31登记与26PASS/1FAIL/4NV、25/29点击按键口径自洽；五视口静态门仅对应旧manifest。新300857取消写入P1、真实竞态/补充/Recall未验证均保留；见[独立补充](evidence/I10-preflight-ui/reviewer/control-r1-addendum.md)。该结论不支持Task29放行。历史Luna报告先逐字节另存snapshot，再仅清理14个行尾空白；DOC-STYLE-001同类累计第2轮结构复验PASS。Task29产品仍待新冻结与真实验收。

## 当前真实保存纵切

- 预览安全：Task28/29 的有限合同已接受；I10-PF-SAFETY-001-METADATA-PREVIEW-WRITE 与 I10-PF-ENTRY-002-CSV-ACCEPT 各第 1 轮解决。原失败和 raw 3 NV 保留，不重置计数。
- 技术合同：practice_persistence_contract_sol / gpt-6.1-sol ultra 已冻结；专属 practice_persistence_contract_acceptance_luna / gpt-5.6-luna max 正式审查。167 文件、142 引用快照、21 合成当前/快照检查及 strict TS 属候选证据，不是 SQLite/API/UI 通过。
- 下一旅程：[完整练习实际保存、重读与等价打开](issues/31-practice-persistence-journey.md)。必须交真实消费者和完整原行，费用/估值未知保留练习；非法必需字段整份拒绝。前置接受后才派发无重叠 DATA/UI 产品文件；不再以另一个未消费 helper 代替旅程。


## 2026-10-27 冻结版本实际边界与 DATA 独立审查

2026-10-27 冻结版本最终检查点：root [638项集成回归与实际数据库边界](evidence/I10-practice-persistence/root/final-progress-checkpoint.md)PASS；专属 DATA Luna 正式 SPEC/QUALITY 双PASS，稳定 finding 0。三份真实练习原字节完整、事务失败回滚、46既有表含更新时间/Recall不变。专属不同 UI Luna 正在五视口独立验收；生产模式读取恢复、最终构建和控件/视觉门仍待，Task31/I10/V2.0未接受。

DATA四套独立审查代码和结果已归档，root逐字节核对10文件全匹配；缺失的三个成功stdout明确记未保存，不补造。UI正式审查期间root不操作其浏览器或重启/build服务；原5轮计数保持不变。

## 归档校验标准设计（候选）

针对 ROOT-AUDIT-002，已依据用户要求整理[归档验收标准候选稿](evidence/I10-practice-persistence/root/archive-acceptance-standard-draft.md)，覆盖清单与副本身份、当前及离线链接、历史版本、分项门槛和反例；用户曾选择每次归档均须独立打开必需文件，但随后表示可能理解为交易数据归档，因此该选择是否适用于开发验收资料包待厘清，其余规则仍为候选。此工作是标准设计，不改验收程序及历史冻结包，不改变原 FAIL 与 STOPPED / UNRESOLVED 5/5，也不代表产品验收通过。

### 范围纠偏（用户反馈）

用户明确指出，开发过程的资料包不是 TradeReview 的产品功能，为其扩展验收测试案例偏离 V2.0 产品开发目标。上述候选稿暂停使用，仅留作历史过程记录，不再扩展；先前关于“独立可携带”的回答不作为交易数据功能要求，也不据此认定开发资料包的放行规则。`ROOT-AUDIT-002` 的原失败及 STOPPED / UNRESOLVED 5/5 继续保留，不进行第六轮修复。产品任务及其实际功能、数据、复盘和视觉验收状态应独立记录，不因内部资料问题自动宣称通过或失败。
