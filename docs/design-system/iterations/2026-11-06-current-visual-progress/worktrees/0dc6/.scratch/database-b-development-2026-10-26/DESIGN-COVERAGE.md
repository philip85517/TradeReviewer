# 设计覆盖

所有规格指向[B设计稿](../../docs/backend-design/database-module-design.candidate.md)。首批只改后端；Task7实施前须补齐实际桌面控件、参考状态及视觉登记，不能以本表代替UI验收。

|要求|准确章节|负责人|旅程与反例|证据|状态|
|---|---|---|---|---|---|
|DB01账户、性质、重数|5.1|Task1 Sol / 独立Luna|跨账户、重导、同秒多笔|evidence/task-1/；task-1-luna-review-2.md|backend PASS, candidate2|
|DB03身份、DB04输入|5.2、9.3|Task2 Sol / 独立Luna|坏输入无半写、精度合法|evidence/task-2/、root-tasks-1-2-verification-2.log；task-2-luna-review-2.md|后端局部PASS，UI后续|
|版本和读取事务|4.3、4.4、6|Task3 Sol / 独立Luna|新增/来源变化、重启、恢复接口|evidence/task-3/root-verification-2.log；task-3-luna-review-2.md|后端局部PASS，候选2|
|恢复、克隆与运行切换|6、8|Task9 Sol / 独立Luna|恢复换世代，普通重启不换，失败阻止上线|evidence/task-9/；task-9-luna-review-2.md|本地后端PASS，候选2；真实部署NOT VERIFIED|
|来源、换版、范围|4.2、5.3、7、8|Task4 Sol / 独立Luna|零成交、缺E2明确处置、未知归属|evidence/task-4/candidate-2/root-verification-2.log；task-4-luna-review-2.md|backend PASS，候选2；提交/接线后续|
|计划、并发、幂等|4.1、6、8、9|Task5 Sol / 独立Luna|准备→确认→断线重试|evidence/task-5/root-candidate-2-verification.json；task-5-luna-review-2.md|后端局部PASS，候选2；HTTP/桌面后续|
|专项迁移和回滚|8.1|Task6 Sol / 独立Luna|新依赖阻止过期回滚|evidence/task-6/|NOT VERIFIED|
|HTTP及桌面接线|6、8、9.1、9.3|Task7 Sol / 独立Luna|导入→确认→刷新→重载|evidence/task-7/|NOT VERIFIED|
|集成及实际桌面|9.3及项目规范|Task8 / root|完整旅程及独立视觉|evidence/task-8/|NOT VERIFIED|

财务、Bars保持暂停，完整首屏1秒未验证，不从矩阵中删除或伪称通过。

## Task7 实施前局部交互契约

[视觉契约](evidence/task-7/visual-contract.md)和[控件/状态清单](evidence/task-7/control-inventory.md)已按当前源码登记；所有浏览器证据仍NOT VERIFIED，实施前还需当前渲染截图及实际DOM/AX核对。准确需求/元素ID对应上表及清单，root负责整页一致性，Task7负责数据闭环，专属Luna独立视觉。

## Task7预检追加的必要入口

下表是已授权数据库设计6/8的消费者完整性细化，不增加财务或Bars范围。待Task5/6交接后实施；当前均NOT VERIFIED。

|要求/控件ID|规格/参考|owner|旅程与反例|证据|状态|
|---|---|---|---|---|---|
|DISPLAY-NAME-SAVE|B设计5.2/6、现有名称失败提示；Task7预检2.3|Task5 Store；Task7接线；root集成|已有证券名称成功/失败一致；无executions上传；身份和metadata不变|task-7-preflight.md；evidence/task-7/|NOT VERIFIED|
|REVISION-SAVE/SUPPLEMENT|B设计6/8，既有StockDataDialog编辑与回合提示|Task5事务；Task7路由/页面|精度/未知费、失败保留、返回重载、无自动Recall重绑|Task7预检2.2/7；control-inventory|NOT VERIFIED|
|HOME-FACT-READ/READ-RETRY|B设计4.3/6.3，现有摘要校验|Task5 active读；Task7同版HTTP/聚合|atLeast完整世代；多页不混版；withdrawn不复活；半读不发布|Task7预检3；evidence/task-7/|NOT VERIFIED|

Task7 owns necessary homepage source contract/snapshot/route, bootstrap route, revision route/client, display-name route/client and metadata repository consumer wiring after Task5/6 release; shared Store/contracts remain Task5 until explicit handoff. This is file ownership, not permission to alter paused financial/Bars computation. Root retains visual/control evidence ownership and independent acceptance.

Task9受控恢复/克隆的本地实现ACCEPTED（候选2/5，专属Luna+root15PASS），见issues/09-runtime-activation.md；真实Docker/跨namespace/生产恢复保留NOT VERIFIED。

## Task7 c1 显式材料换版消费者（2026-10-26 root 裁定）

|要求/控件ID|准确规格/参考|owner|旅程、状态与反例|证据|状态|
|---|---|---|---|---|---|
|IMPORT-MATERIAL-SELECT|B §4.2/5/8；现有确认框；root 明确裁定|Task7 数据/控件；root 整页视觉|默认独立材料；月结文件可显式选择“将此文件作为所选材料的新版本”。选项来自同版权威 materialHistory，显示文件/账户/月/指纹；同月账户不推断身份|trade-import-material.ts；conditional-inputs.test.ts；fixtures/monthly-*.pdf|实施中；真实页面 NOT VERIFIED|
|IMPORT-MATERIAL-RECHECK|B §4.3/6/8；同上|Task7|切换/重准备重新读取并验证同版；版本冲突保留材料意图、重新取得计划与逐项选择，不复用陈旧计划|workspace；计划/读取定向测试|实施中；真实页面 NOT VERIFIED|
|IMPORT-MATERIAL-SAME-FILE|B §4.2/5/8；root 同指纹兼容投影裁定|Task7|同材料恢复复用本材料已有展示批次；独立材料同文件保留独立版本/观察，兼容批次仅只读参考，不借用他人 batch 所有权；页面明确已导入及独立含义|conditional-history-red.log；conditional-restore-diagnosis.log；后续 green 与真实 UI|实施中；真实页面 NOT VERIFIED|

新控件位于既有固定头尾确认框的滚动内容区；不增加弹窗阶段或改变已批准默认尺寸。原文件→缺行文件→显式选择→保留/撤回→重传原文件恢复为必要旅程。保留/撤回和原因仍由同一服务端计划核验。完整来源版本数独立于旧 importHistory 展示批次数，不因同文件少一个兼容批次而丢弃来源。最终 1440×900/1280×800 与断点直接视觉比较仍由 root/独立 Luna 执行，当前不能声称通过。

2026-10-26 并行交接：Task5 候选2后端已由专属 Luna 和 root 接受。Task6 独占共享 Store/contracts/engine；Task6 来源映射子任务独占 source-materials.ts 及新测试。Task7 只读消费公共三类意图 DTO，先提交最小真实桌面旅程给 root，再扩展剩余消费者；最终冻结和验收仍依赖 Task6。Task6/7 当前候选1均未验收，不因分阶段重置计数。

## Task7 c1 最终源码冻结交审

Task6 c2已由原Luna和root局部接受，manifest `444418d1e7faf94fead9d1d37b89a096169e43054fd55e8a368392c20224d33d`、engine `7b6d410273bbfeafb1c34f95e91c1b1b2e8ead5386a483903b8a981c71de03d8`；共享依赖未由Task7修改。Task7仍c1，`evidence/task-7/candidate-1-final/manifest.json`绑定40份全稿、共同祖先完整diff和前置归属/哈希；不是Task7 ACCEPTED。T7-01…13定向结果及NOT VERIFIED见task-7-candidate-1.md，实际修复次数见failure-attempts.md。

IMPORT-MATERIAL-*、全部冲突allowed、missing keep/withdraw、reactivate两项、REVISION-SAVE/补录/补充、unresolved重查与name/Home逐项入口及合成前置见fixtures/README.md条件表。root最低真实XLSX旅程仅scoped PASS，最终冻结hash控件/视觉及目标视口仍待root/独立Luna。新控件沿用原固定头尾滚动区，不改变已批准尺寸/阶段；材料默认独立与批次参考说明须参与视觉比较。无确定性外部解析/识别/行情差异时不以mock签页面通过。


## 独立最终审查回退（2026-10-26）

Task7候选1独立Luna：FAIL / NOT ACCEPTED。I-1历史unknown/null费用阻断非费用修订；V-1审核计划分组与561px按钮可读性Minor。原局部通过/失败记录保留。root派发两个不重叠的Sol6.1Ultra修复切片，各自单独Luna5.6Max；准确规格、owner、控件/状态和证据见[evidence/task-7/post-review/root-dispatch.md](evidence/task-7/post-review/root-dispatch.md)。每问题累计最多5次，未完成不得关票。

## 2026-10-27 当前回归与桌面局部验收

- 实际socket首轮A在H6失败：合法修订首次200、完全相同请求再次409，已停止该run（A状态FAILED、B仅初始化），旧库/日志/锁原样保留；后续撤回、A重启与B迁移均NOT VERIFIED。不是数据库连接失败。服务端审计时间被放入请求比较是已定位根因。Task5受影响接受门重开，[DBB-10](issues/10-legacy-revision-retry.md) 实际修复1/5由Sol6.1Ultra处理，独立Luna5.6Max审查，尚未接受。新候选使旧952文件freeze失效时需重新冻结；旧证据保留。
- 桌面1440×900/DPR1：root实际完成保持撤回、明确理由后恢复、同一原文件默认独立材料保存/返回/重载。独立材料新增来源历史，旧来源逐行不变，成交仍6笔且无重复。证据 post-review/root-browser-journeys-1.md 与独立材料全表快照。
- Luna独立视觉审查仅1440×900局部PASS；另7个准确视口因工具set未实际生效保持NOT VERIFIED，不以文件名或DOM冒充。V-1实际1/5。
- I-1实际2/5，静态/定向证据已获专属Luna局部PASS；NULL/空串合成独占库4398夹具READY，真实UI保存/reload待验。夹具loader首次错误单列工具诊断，不计产品修复。
- 取消计划快照显示 plans 及既有reviews.updated_at变化，不能宣称数据库零写；来源/成交/审计不变，时间戳写入归因仍待厘清。
- Task7仍FAIL/NOT ACCEPTED，Task8整体NOT VERIFIED，财务P1/F07与Bars暂停，完整首页≤1秒NOT VERIFIED。

## 2026-10-27 H6 当前验收边界

|要求/控件ID|准确规格|owner|旅程与反例|证据|状态|
|---|---|---|---|---|---|
|DBB-10 / REVISION-SAVE 重试|B §4.1/6/8/9；既有幂等合同|dbb_socket_runtime_sol；独立 dbb_h6_luna；root|相同请求返回原结果、全表及BookVersion零写；变更同ID409；损坏历史scope409、非法新scope结构化400|task-8-h6-luna-review-1.md；evidence/task-8/h6-repair-1/；issues/10-legacy-revision-retry.md|候选1 FAIL；第2/5轮实施中；真实socket后续未验证|

旧候选后端通过和952文件冻结证据保留，不能代替当前修复后的真实socket、UI、重启和全量回归。Task7 FAIL/NOT ACCEPTED；Task8 NOT VERIFIED。财务/Bars暂停。

## 2026-10-27 剩余UI证据清单校准

独立 Luna 已完成 `task-7-remaining-acceptance-map-1.md`，root全文核对后纠正了两处证据边界：视觉规范实际共7个目标尺寸，1440×900局部PASS，另6个规范目标未验证；1280×720/DPR2及1280×900是非规范探针，不计入目标分母。历史记录中“另7个”说法保留为原记录，当前准确分母以此为准。4398费用夹具只有两条合成AAPL、无E0；本夹具应核对另一条未编辑AAPL与无关事实/表，旧3333 E0是单独历史证据。所有待验入口和失败恢复均未以静态/夹具结果替代真实UI。

| H6 修订幂等修复3/5 | 原§4.1/6/8/9；接口和原金额合同不变 | 原Sol6.1Ultra；独立dbb_h6_luna | 候选2运行测试PASS但TS18046，原FAIL保留；仅测试类型收窄后新冻结、复审、root和真实HTTP验收 | 未接受 |

## 2026-10-27 当前桌面与中央检查补充

| 范围 | 规格/对象 | 负责人 | 真实证据 | 当前结论 |
| --- | --- | --- | --- | --- |
| I1未知费用编辑/保存/重载 | 原金额合同；日期与费用原值保留；DBB-07既定审核旅程 | root实际浏览器，独立Luna待验 | fee/browser-fixture-1/root-ui-acceptance-candidate3-1.md；两次只读快照差分；1440×900截图 | 保存链局部PASS；空串费用审核摘要FAIL，未修，不增加轮次 |
| H6候选3及最终整合 | 原幂等合同/质量检查 | Sol中央执行、专属runtime_plan_luna | root-20261027-2 full-check-runs | native/tsc PASS；Vitest进行中已观察FAIL；新socket/native部署/build/runtime未跑 |

本次局部桌面8项7PASS/1FAIL不代替完整登记，仍7个目标视口共1个局部通过、6个未验证。Task7不接受、Task8未验证，暂停范围不变。


### 中央运行结束后的覆盖状态（2026-10-27）

| 范围 | 负责人/依据 | 证据 | 状态 |
| --- | --- | --- | --- |
| 中央类型/全量回归 | Sol执行，独立runtime_plan_luna，root核对 | root-20261027-2：native/tsc exit0；Vitest exit1，244 FAIL/4973 PASS/6 SKIP | FAIL-stop；native8/build/runtime3/socket NOT VERIFIED |
| Task5/6/9 owner证据适用范围 | Sol绑定、独立h6_luna | task-8-final-owner-bindings-sol-1.md / luna-review-1.md | 报告准确性PASS；非产品接受，两deploy项不在full1167 |
| 空串未知费用审核摘要 | 原V-1 Sol候选2/5、专属Luna待派 | root真实1440反例及candidate-2诊断/RED待产出 | FAIL，修复中；I1 2/5/H6 3/5保持 |

本表追加更新前表的在途状态；旧FAIL/原freeze不覆盖。Task7/8均NOT ACCEPTED，七视口仍只有1440局部证据，其余6个NOT VERIFIED，财务与Bars暂停。


## 2026-10-27 独立排查与候选验收续进

- ENV受控确认仅运行 deploy 与 baostock-client 两文件，实际88/88通过、exit0、368.3秒，监控源码前后无变；原中央244失败记录保持，不能改写成全套通过。证据 evidence/task-8/environment-confirmation-1/，专属Luna独立复核中。
- V-1 candidate2/5已冻结，16/16与限定lint通过、独立Luna静态规格/质量局部PASS。root1440×900/DPR1实际预览显示未知费用/友好名称/账户，并保存、返回、reload、重开；原空串/NULL/毫秒/长小数保留、旧审计按ID不变。全表快照表明sequence10到12、reviews/instruments时间变化，未宣称零写。详见 evidence/task-7/post-review/readability/candidate-2/root-ui-acceptance-1.md。独立真实视觉待复核；其余6规范视口等缺项仍NOT VERIFIED，Task7仍FAIL。
- H6新失败定位到validateRevisionBaseline两处旧值/范围冲突使用领域422而非协议409。环境确认结束后已释放原Sol进入实际candidate4/5，仅Store两处类型化错误与专属测试；原3轮保留，尚未接受。
- 性质筛选由Sol用884源快照/当前代码在同一受控harness成对验证；仅两条代表用例、每臂一次。等待正式报告和独立Luna，不外推其他失败组，不放宽实盘认定规则。
- I-1仍2/5；同一问题实际第5次候选未解决即暂停，禁止重命名问题清零。Task8 FAIL/NOT ACCEPTED；财务P1/F07、Bars继续暂停，完整首页1秒目标NOT VERIFIED。未提交、推送、合并、发布或访问保护业务库。


## 2026-10-27 当前独立复核结果与并行归因

- ENV 限定两文件88/88确认通过，独立Luna task-8-environment-confirmation-luna-review-1.md 局部PASS。原中央244 FAIL保留。监控scope未覆盖market源文件，不能扩大其前后不变声明。
- V-1 candidate2/5：独立Luna已直接对照1440×900新旧实图，并核对56表稳定ID快照，未知空串费用摘要及鼠标保存/返回/reload/重开局部PASS。Store证据绑定H6 candidate3；六视口、键盘/触摸和异常恢复NOT VERIFIED；Task7仍FAIL/NOT ACCEPTED。
- H6 candidate4/5初次RED含6FAIL/101PASS。missing-before夹具用撤回模拟物理删除不成立，已保留日志并要求先纠正夹具；尚无第4轮产品修改，原撤回语义不变，不另计第5轮。其余422/409反例有效，统一两处修复待定向验证。
- 性质两代表诊断已冻结，独立Luna dbb_nature_pair_luna复核中，不能外推其余140。新增DBB-11只读归因三项storage-boundary失败，明确未授权产品修复。
- 当前I-1 2/5、V-1 2/5、H6 4/5；财务P1/F07、Bars保持暂停；完整首页≤1秒NOT VERIFIED。所有原FAIL/轮次保存，无业务库访问及远端操作。


## 2026-10-27 第四轮冲突验证结果与新增独立归因

- H6 candidate4/5已完成两处类型化冲突错误修正，产品SHA256为4d5479ba78d1bfc182348b28b9fbd571d39cee7d67b33ecd0ae1787386d41417。首次修复后定向运行106 PASS / 1 FAIL（总107），Store105项通过；原route的过期请求409通过，但后续历史总数断言期望1、实际2而失败。导入已有一条正常审计、修订新增一条是已追踪原因，等待专属Luna/root裁定；未删导入审计，未启动第五轮。关联299项和tsc本轮未运行，不能引用为本轮通过。完整证据：task-8/h6-repair-4/ 与 task-8-h6-sol-candidate-4.md。
- V-1 candidate2/5的1440×900/DPR1六条真实键盘序列经专属Luna追加复核，局部6/6 PASS；取消仅有当前界面显示证据，不证明数据库零写。键盘证据绑定H6 candidate4，鼠标保存闭环绑定candidate3，分别保存。完整Tab顺序/focus trap、键盘保存/reload、其他六视口、触摸及异常恢复仍NOT VERIFIED，Task7仍FAIL。
- 两条性质代表诊断已由专属Luna复核为限定诊断PASS：当前与884原源在同一现有harness均复现unknown被live范围排除，仅内存夹具显式改live后代表断言通过。不能外推另外140项，也不能宣称历史环境失败或恢复自动实盘推断；没有产品修复。
- DBB-11继续只读归因三项storage-boundary失败；新增DBB-12由另一Sol6.1Ultra逐项扫描工作区57项失败，均须各自独立Luna复核后再由root批准具体修复。没有将诊断当作开发完成。
- H6累计4/5、I-1 2/5、V-1 2/5；同问题第5轮仍未解决则暂停并记录，不更名清零。原中央244项失败保留，Task7/8整体FAIL / NOT ACCEPTED。财务P1/F07与Bars保持暂停，完整首页≤1秒NOT VERIFIED；没有访问保护业务库、提交或远端操作。


## 2026-10-27 并行归因覆盖矩阵

|需求/规格|元素与视觉依据|状态/旅程|唯一所有者|交付与证据|当前门|
|---|---|---|---|---|---|
|DBB-11；B §4.3、§6.1–6.3、§7、§9.3|不适用：只读源码诊断，无UI修改|空库读取、导入准备/提交、禁止迁移存储runtime依赖|Sol dbb_storage_boundary_sol；专属Luna待派；root集成|issues/11-storage-boundary-diagnosis.md；evidence/task-8/storage-boundary-diagnosis-1/|诊断进行中；产品修复0；UI未接受|
|DBB-12；B §4.3、§5、§6、§7、§9|不适用：只读源码诊断，无UI修改|中央8文件57项逐项归因；每类输入、首次失败与新旧接口|Sol dbb_workspace_diagnosis_sol；专属Luna待派；root集成|issues/12-workspace-regression-diagnosis.md；evidence/task-8/workspace-diagnosis-1/|诊断进行中；产品修复0；UNKNOWN不得外推|
|DBB-10/H6；B §4.1、§6、§8、§9|不适用：仅HTTP测试修正，无页面修改|seed审计保留、repair新增1、retry与stale审计不变|Sol dbb_h6_candidate5_sol；专属Luna待复审；root独立回归|task-8-h6-candidate5-brief.md；evidence/task-8/h6-repair-5/|累计第5/5轮进行中；首次失败即暂停；未授权第6轮|

所有非UI诊断/测试范围均不替代Task7的真实控件、状态链和视觉门，原FAIL及NOT VERIFIED仍在。


## 2026-10-27 H6第五轮验证完成，独立复核待定

H6第5/5轮只改原HTTP测试第一用例：保留完整seed审计，成功修订恰新增一条，重复/过期请求的审计逐条不变。Store与Store测试哈希维持candidate4。定向107/107、关联5文件299/299、tsc均exit0，各执行一次且三文件冻结一致；证据 task-8/h6-repair-5/*-result-1.json。Root已直接读取diff、日志与结果，独立Luna及root另行验证尚待完成，因此仅验证阶段PASS，H6/Task8未接受，不开展第6轮。

DBB-11只读诊断已冻结（FREEZE SHA256 6551ac223efb40d67b1c3c707b145e5a20d5c40d019173a223c2d2d8a0fd52de），独立Luna5.6Max复核中：两项旧测试合同失配与一类实际纯校验器职责依赖需分别处理；没有产品修复。DBB-12继续逐项扫描57项，月结证据接线疑点未运行确认且不自动恢复暂停财务任务。

Task7/8整体FAIL / NOT ACCEPTED；I-1 2/5、V-1 2/5、H6 5/5。财务P1/F07、Bars继续暂停，完整首页≤1秒NOT VERIFIED。原失败/轮次保留，无保护业务库访问和远端操作。


## 2026-10-27 Root限定验收与下一轮分工

H6第5/5轮经专属Luna及root独立107/107复跑通过，关联299及tsc为Sol单次冻结证据。定向spec/quality接受，真实socket/restart、整套回归/full build仍NOT VERIFIED，原runtime FAIL保留；DBB-10不关闭且无第6轮修复授权。详见 evidence/task-8/h6-repair-5/root-scoped-acceptance-1.md。

DBB-11诊断经root全文核对及Luna追加勘误裁定：source-materials归Task4；原guard不拦截新的纯合同名，不修改guard。放行同问题第1/5轮8文件纯合同提取，由Sol6.1Ultra唯一实现，随后独立Luna5.6Max验收；不改两项旧UI测试，不改财务/Bars或产品语义。准确范围 task-8-storage-contracts-candidate1-brief.md；证据 storage-boundary-diagnosis-1/root-ruling-1.md。

DBB-12已逐项封存57项/8文件；18/17/4/1/14/1/1/1分组，原FAIL及下游UNKNOWN保持。专属Luna dbb_workspace_diagnosis_luna复核中，尚无测试侧修复授权。W39仅高置信暂停财务接线疑点，未运行确认。I-1 2/5、V-1 2/5、H6 5/5；Task7/8整体FAIL / NOT ACCEPTED，财务P1/F07、Bars暂停，完整首页≤1秒NOT VERIFIED。

### DBB-11第1轮派发覆盖（替代旧“待派”状态，历史保留）

|需求 / 精确设计依据|elementID / 图与浏览器|状态及反例|owner / 集成|交付及证据|当前门|
|---|---|---|---|---|---|
|DBB11-C1；B设计99–106/224–238/317–334；Task4/7/8|不适用：纯合同移动，无控件或state wiring|正式供数runtime依赖只指纯合同，原architecture guard不变；旧业务存储模块仍禁|Sol dbb_storage_contracts_sol；独立Luna待派；root|brief8文件；evidence/task-8/storage-contracts-repair-1/|待实施，第1/5轮|
|DBB11-C2；B设计143–150/240–277/317–334|同上|严格校验接受集等价；非法/NaN/负数/可选字段/月结/status/interval/error反例；迁移宽松parse/v1/recovery不变|同上|两新合同测试、4关联测试、freeze/diff/tsc|NOT VERIFIED|
|DBB11-C3；B设计99–106/224–238/317–334|同上|加载调用纯合同无需浏览器存储；无localStorage/IndexedDB依赖|同上|纯合同测试及静态依赖核对|NOT VERIFIED；不代表两旧UI用例通过|

### DBB-13只读归因覆盖

|需求/规格准确行|元素/图/操作|状态/反例|owner|证据|门|
|---|---|---|---|---|---|
|DBB13-R1；B设计132–150、166–222、240–277、317–334；Task1/4/7/8|不适用：只读源码与旧日志，无产品/UI行为改变|中央RECONCILIATION7+SCREENSHOT3逐项；跨账户/性质/run/精度不混，材料多重集与历史保留|Sol dbb_import_reconciliation_sol；专属Luna随后；root|issues/13-import-reconciliation-diagnosis.md；evidence/task-8/import-reconciliation-diagnosis-1/|诊断进行中，修复0，原FAIL保留|

| DBB12-G5-C1（14项） | B§5.1行132–141、§5.2行143–150、§7行224–238、§9.3行317–334；原G5 W29–32/W40–42/W47–52/W57 | 元素ID/参考图不适用：仅测试输入迁移 | Sol6.1Ultra唯一实现；单独Luna5.6Max审核；root集成接受 | live/unknown/simulation/run/account隔离；精确回合/缓存/返回态旧断言保留 | `workspace-g5-repair-1/`；14项精确目标、性质scope反例、tsc；产品真实UI仍未验证 | 1/5实施，尚未PASS |


## DBB-14 原两性质/仪表盘组：完整只读归因（待派）
| 需求/元素 | 精确规格 | Owner | 用户旅程/范围 | 验收证据 |
| --- | --- | --- | --- | --- |
| 原NATURE-MODELS72 + DASHBOARD-UI70，不代表外推 | database-module-design.candidate.md §5.1/5.2、§7、§9.3 DB-01；Task7/8 | root协调，dbb_nature_dashboard_sol（Sol6.1Ultra）；专属Luna随后 | 9文件142原FAIL的输入→成员性质/账户/run筛选→模型→渲染，纯静态；财务/Bars不开发 | 完整逐项账本/原log与stack/中央和884源绑定；Luna/root限定诊断接受。当前原FAIL、实际修复0/5、产品与UI未接受 |

| DBB13-C1 十项目标 | B§5.1/5.2/6/8/9.3；R01–07/S01–03原日志精确映射 | Sol dbb_import_reconciliation_sol；专属Luna dbb_import_reconciliation_luna；root | 两测试局部契约/精度输入对齐，保留账户/材料/费用/未知隔离与blocker/deferred旅程；产品不改 | repair-1冻结diff、精确10、既有scope/Store scope、tsc；候选1/5，产品/UI未接受 |

### 最新限定裁定与下一步（原记录保留）

DBB11-C1–C3 已由专属Luna和root限定接受：root56PASS/3skip；两旧UI失败保留。DBB12-G5-C1已由专属Luna及root限定接受，root独立精确14PASS，证据 `workspace-g5-repair-1/root-scoped-acceptance-1.md`。两者均不关闭原问题或Task7/8。

| 需求/精确规格 | 元素/图与范围 | owner / 集成 | 保留旅程与反例 | 证据与门 |
| --- | --- | --- | --- | --- |
| 原DBB12剩余37非财务＋DBB11两旧UI；B§4.3/5.1/5.2/6.1–6.3/7/8/9.3 | 本轮只读迁移方案；不改控件，产品UI验收未豁免 | dbb_workspace_ports_sol（Sol6.1Ultra）；专属Luna随后；root | 当前生产入口、同版本原子读取、正式提交重试/重读、名称持久化、账户精度隔离、浏览器旧业务键禁用；不删除原业务断言 | `workspace-ports-design-1/`逐项映射及统一test adapter方案；只读设计进行中，尚不授权新候选；原DBB12 1/5、DBB11 1/5 |


### DBB13限定接受与TradingView四项独立诊断派发

DBB13候选1/5已由专属Luna及root独立精确10项接受，见 `import-reconciliation-repair-1/root-scoped-acceptance-1.md`；正式应用门仍未接受。本段为审查后的tracking追加，先前冻结快照与hash保留其当时版本，不声称后续tracking永远无变化。

| 原需求/准确规格 | 元素及范围 | 唯一owner/审查 | 旅程与证据 | 当前门 |
| --- | --- | --- | --- | --- |
| DBB12 W15/W16/W17/W24；B§5.1/5.2/6/8/8.1/9.3；原cases-57精确四项 | 无产品元素修改；原TradingView重导入旅程，正式Store最小合成探针 | Sol dbb_tv_compat_sol；专属Luna随后；root裁定 | 原ID/account/role/precision/财务字段seed→真实Store回读→正式prepare与旧专项matcher对照；不commit；输入/输出/原日志/有限freeze，详task-8-tv-compat-diagnosis-brief.md | 原四FAIL保留，诊断待执行；DBB12实际修复仍1/5；不是新问题或候选2，财务/Bars暂停 |


| DBB14-C1，B§5.1/5.2/7/9.3；原142逐项账本 | 测试输入迁移，无产品元素/参考图修改 | Sol dbb_nature_dashboard_candidate1_sol；专属Luna dbb_nature_dashboard_luna；root集成 | exact90：排除036、038–070、096–112、134；成员性质/真实legacy与brokerunknown、account可选/memo、成员模拟run；037仅输入、Recall未接受 | candidate1 brief与nature-dashboard-repair-1；90精确目标、scope反例、tsc；实际1/5已FAIL封存（90+68通过、tsc两错）；专属Luna复核中，原142FAIL/下游UNKNOWN保留 |


### 2026-10-27 工作区39项设计限定接受，最小adapter候选2授权

专属Luna只读Spec/静态证据PASS、设计PASS WITH P1 GATES；root全文核对并采纳正式createTradeReadHandler最小提取，禁止test-only复制读协议。静态39唯一条目/37原workspace对象完整，35迁移与4TV兼容分区保留。依据 `workspace-ports-design-1/root-ruling-1.md`。

原DBB12与DBB11各进入同原问题候选2/5共同packet：先新strict内存SQLite adapter合同及生产读handler机械提取，再验两条原SBUI纵向旅程，之后才其余33项迁移。各阶段不重置候选。尚未有运行PASS；原FAIL/UNKNOWN、G5限定接受、四项TV独立诊断保留。S1真实UI owned发布、S5图表设置/prefs及正式浏览器/文件重启均未验收。brief `task-8-workspace-strict-adapter-candidate2-brief.md`；财务/Bars仍暂停。


### 最新执行门：共同候选2封存

DBB11/12最小adapter候选2/5：17PASS/9FAIL，九项在真实Store模拟证据seed校验首断；S1–S5未到达，原39 UI未接受。专属Luna独立复核中，未授权候选3。DBB12四项TV只读诊断Spec/静态证据限定PASS、设计有未决裁定；原UI FAIL保留。SBUI两旅程brief已准备但未派，依赖adapter门。财务/Bars暂停，全套FAIL保留。

### 2026-10-27 原问题轮次与独立门更新

DBB14候选1专属Luna：范围/证据完整性PASS，设计与候选总门FAIL，仅两处兼容枚举错误。原Sol候选2仅修两字面量，exact90自测90PASS；68关联原证据经75依赖哈希未变复用，未重跑。类型检查、该候选独立Luna及root运行尚待完成。52排除项和所有产品门不变。

DBB11/12候选2专属Luna总门FAIL：已证实非法模拟seed、未知费历史记录误经新incoming导入；其他来源组合静态风险已统一纳入候选3brief。候选3仅一个合同测试文件，按B§5.1/5.2/6/7/9.3分开合法新输入与原三条未知费读/写反例，一次27项，后续Luna与root独立门待验证；不放宽生产规则。SBUI和其余33仍未派发，TV四项设计审查中；不能据此宣称接口/UI/文件重启/视觉或完整首屏达标。

### 2026-10-27 工作区候选3/5失败封存

唯一GREEN：27执行、26PASS/1FAIL，UTC 20:13:24.457980→20:13:40.865941，exit1，完整日志SHA256 `758d3b5c6185d1adaeb4fd8ea53acc0406c3d17a9d53b0c1cce786fb1a3149ea`。已解除非法模拟seed阻塞，handler2、原protocol/conditional15、Home raw-unknown1、S2–S5均通过。剩余S1 delayed carrier在 `expect(JSON.stringify(old)).toBe(frozenPayload)` 失败；封存两响应深层JSON值/版本/receipt/页数据相同，静态parser有canonical键排序，尚待专属Luna独立审查。保留真实FAIL，未改断言、未重跑、未执行tsc；不能以26PASS接受adapter或原UI。候选3仅该测试文件变化，44有限源稳定；三历史反例与其他8回调保留。证据 `workspace-strict-adapter-repair-3/`。任何后续修正必须算同原问题候选4，达到5次仍失败即停，不新票重置。

## Root：DBB14 候选2/5限定接受

交易性质及仪表盘的90项授权输入迁移限定通过。Sol exact90为90/90，root独立同90为90/90，native tsc通过；专属Luna 5.6 Max的规格、设计/测试合理性和有限证据三门均PASS。68反例在75文件依赖闭包未变的条件下复用原68/68，未当作新运行。两处修正仅将兼容字段改为合法值simulated，保留与显式live矛盾时归unknown的反例。候选1 FAIL及2/5累计轮次保留。

root独立日志SHA256：813fdf0f1775ad6c97917bcf6b7a8edc06b60a076ca2784600413f5116e3c660；证据nature-dashboard-repair-2/root-candidate-2/。专属报告task-8-nature-dashboard-luna-candidate-review-2.md。worker seal与root六项独立证据分别限定，不把辅助manifest冒充seal绑定。

此接受只覆盖测试输入迁移与定向合同，不代表DBB14产品通过。52排除、037 Recall持久化、真实HTTP/写入返回reload、浏览器/视觉和完整首页≤1秒继续未验收；038–070为图表marker/label/geometry等断言，不能误称为运行时性能优化。财务P1/F07、Bars继续暂停；中央原244FAIL结果保留，未作相减。


### 2026-10-27 工作区adapter候选4/5限定接受

Sol6.1Ultra与root独立exact27均27PASS/0FAIL，原生tsc通过；原专属Luna5.6Max的Spec/合法输入Design/worker证据三门限定PASS。44有限源稳定，16项Home按pattern未运行；journal仅为已解析对象，不是原始wire bytes。候选3末3历史未达与候选4完整S1通过已在Luna报告勘误区分。root日志SHA256 b431f6a0834e03f988c3242304ae261652c24a965ad7cdc4814c7190801983b4。裁定 task-8-workspace-strict-adapter-root-acceptance-4.md。

只解除最小adapter前置门，原UI/真实HTTP/文件重启/视觉及整体仍未接受，原候选2/3 FAIL保留。已派原Sol仅只读SBUI统一前置设计，原专属Luna随后；未授权实现。DBB11/12仍累计4/5，今后TV/SBUI/剩余迁移共同实际候选不得另起计数；下一最多5/5。RoomPerformance33项只读设计已封存并交其独立Luna，DBB14仍2/5。财务P1/F07、Bars暂停，中央原244FAIL及完整首页一秒NOT VERIFIED不变。

### DBB14候选3/5：图表测试输入迁移授权

root全文复核task-8-chart-contract-luna-design-review-1.md；Spec、Design及静态Evidence限定PASS。授权原Sol6.1Ultra仅改room-performance.test.tsx：DBB14-038至070的33callback/54callee明确opt-in成员live；其余9callback/14callee逐字保护，原实参/金额/断言/metadata缺失不动。B§5.1/5.2/7/9.3及chart-contract-design-1/design-coverage.json为逐项准确映射，非新视觉设计。专属Luna5.6Max独立审查，root独立同冻结目标复验；不得以测试输入变更修改生产性质规则或图表算法。

触发范围为既有图表测试输入合同迁移，真实控件、持久化、真实chart、桌面视觉仍NOT VERIFIED，不以jsdom替代。本候选有限运行77目标（42 RoomPerformance、3 chart、31 nature、1 scope）；首FAIL封存，累计3/5，不重置。90/68既有证据未作新运行；原候选1FAIL、原33FAIL历史/其余排除及中央全套FAIL保留。财务/Bars暂停、完整首页≤1秒NOT VERIFIED。


### TV 最终实施合同补充（尚未实施）

B§5.1/§6/§8.1/§9.3 → TV design-2 + root supplement1 + root-contract-ruling-2；Sol dbb_tv_compat_sol 为13生产文件及完整数据/持久化流所有人；Luna dbb_tv_compat_luna 独立审查，root集成与最终接受。identity审核→受绑定重prepare→ready确认→receipt→atLeast读回→返回/刷新为完整旅程；来源scope、材料选择、待审独立按钮与确认guard按原覆盖表实施，不授权视觉简化。R1–R5、原TV4和非TV普通三选择的运行名单待有限锁定，当前均NOT RUN。受影响真实控件/桌面/视觉须另行独立验收；该静态合同裁定不计候选，未来仍共同5/5。


### SBUI 设计门限定接受；源码实施等待图表静止窗口释放

root全文读取 task-8-sbui-preflight-luna-design-review-1.md：Spec范围内PASS、Design条件PASS、Evidence NOT VERIFIED。采纳八项具体实施条件，准备新 task-8-sbui-candidate5-brief.md；旧candidate2 brief作废。root G1裁定限定typed正式consumer→同Store，raw HTTP路由解析继续NV，不在harness复制协议。已迁移空seed必须真实merge/receipt，Recall晚绑定、Storage实例guard、真实设置返回/重挂载为必经，不允许可选跳过；财务已知503不能假造成功。

当前尚未派源码写入；等DBB14候选4唯一77/tsc与root同冻结复验封存，避免编译版本漂移。后续仍DBB11/12共同候选5/5，原两UI FAIL及candidate2/3 FAIL保留。


### DBB14 图表候选4/5限定接受

Sol实际77/77、root独立77/77、唯一静止tsc及专属Luna5.6Max三门PASS；root另核对29项封存报告/证据hash全部一致。root裁定 task-8-chart-contract-root-acceptance-4.md。只接受测试输入合同/运行器，20排除、候选3零执行FAIL及中央原244FAIL保留；真实chart、控件/持久化/视觉、Recall及完整首页一秒仍未接受。后续TV/SBUI新版本需新冻结，不能追溯复用70源。财务P1/F07、Bars暂停。


### 2026-10-27 共同候选5/5静态验收失败，达到上限停止

Luna 独立发现且 root 源码核对确认：真实 Storage 的 key/length 无条件放行，可枚举已写入的旧业务 poison 键名，违反“仅允许批准 UI 偏好键”的合同。属于测试防护缺陷；尚未证明生产页面读取旧数据。原候选5完整存储边界门 FAIL，达到5/5停止，不修第6轮、不换名、不缩窄合同。原候选4的有限 PASS 与旧失败保留，不升级为新版本通过。

SBUI A27/B8、TV C35/D15、本轮 tsc/build/全套均 NOT RUN，桌面/HTTP/文件重启/视觉仍 NOT VERIFIED。原TV Sol 已于 2026-10-26 21:47:53 UTC 停写，13生产＋6测试只封存现有进展；其专属 Luna 静态审查另记，不把依赖停止写成其运行失败。剩余33项迁移因最小真实旅程未通过而 BLOCKED。财务P1/F07、Bars暂停，完整首页一秒未验证，中央原244FAIL不变。

根裁定：`.superpowers/sdd/2026-10-26-database-b-implementation/task-8-sbui-root-candidate5-stop.md`；专属审查：`task-8-sbui-luna-candidate5-static-review.md`（含追加勘误）；运行目录已写 STOPPED-FAIL.json，未生成任何运行许可。


## 最终追加：专属 Luna 审查结束，root 确认两项静态缺陷

**共同候选5/5未接受，达到上限停止。** SBUI 与 TradingView 均由各自独立的 Luna 5.6 Max 审查；root 再核对关键源码。不得自行续修候选5、改名计数或进行隐性第6轮。未来修订须用户明确授权新的有界范围与计数，保留原五轮失败历史。

| 问题 | 专属验收及 root 结论 | 影响与证据边界 |
| --- | --- | --- |
| SBUI F1：Storage.key/length 无条件放行 | 静态完整合同 FAIL，P2 | 防护可枚举旧业务 poison 键名；属于测试保护缺陷，不等于已证实生产页面读旧数据或数据库泄漏 |
| TV5-S-01：首次写入前未完整校验来源证据 | 静态实现 FAIL，P1；设计可行 | 未检查完整字段及成交候选对应关系，畸形输入静态可达不完整材料或错误异常分类；没有运行证明实际数据库已受影响 |

TV 的13个生产文件＋6个测试文件、SBUI三文件保留封存；封存完整性不能替代功能验收。专属 TV 报告为 `task-8-tv-compat-luna-candidate5-static-stop-review.md`，root复核为 `task-8-tv-root-candidate5-final-disposition.md`，共同停止裁定为 `task-8-sbui-root-candidate5-stop.md`，均位于 `.superpowers/sdd/2026-10-26-database-b-implementation/`。

A27/B8/C35/D15 共85项计划检查均 **NOT RUN**；本候选类型检查、构建、全套回归未运行。桌面视觉、HTTP、真实持久化、返回/reload、重启和完整首页一秒均 **NOT VERIFIED**。其余33项迁移仍受最小真实旅程前置条件阻塞；财务P1/F07与Bars保持暂停。原限定通过及中央原244项失败完整保留，没有据局部通过推算新全套结果。没有提交、推送、合并或发布。

## 2026-10-27 用户授权的 TDD 恢复范围

用户确认三个公开测试边界；旧共同候选5/5停止与已知失败不删除。详细步骤、独立验收和新任务计数见 [TDD 恢复计划](TDD-RESUMPTION-2026-10-27.md)。财务与 Bars 继续暂停。

| 要求/对象 | 准确规格及参考 | owner | 用户旅程与反例 | 本次证据 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| TV 来源与成交关联 | B设计 §4.2/5/6/8/9；TV design2 / TV5-S-01裁定 | Sol import_fix；专属 Luna；root | 合法导入；来源缺项/未知项/字段缺失时明确拒绝并保护既有数据 | TDD 恢复计划 A | NOT VERIFIED |
| 旧浏览器业务键防护 | B设计 §4.3/6/7；storage-boundary 原完整合同；SBUI F1裁定 | Sol storage_fix；专属 Luna；root | 真实 Storage 的枚举/值访问不能绕过防护；合法页面偏好可读写 | TDD 恢复计划 B | NOT VERIFIED |
| 桌面导入—审核—保存—交易库—返回/reload | B设计 §6/8/9.3；本页 Task7 visual-contract 与 control-inventory；V2.5 首页规范 | root 整页与旅程；未实施者独立视觉 | 隔离数据库实际保存与重新读取；错误/取消保留数据；控件正常、加载、失败状态 | TDD 恢复计划 C；适用前端审计表待建立 | NOT VERIFIED |

状态按最终版本及执行证据更新；先前局部通过不能替代上述门槛。

## 2026-10-27 旧复盘恢复的冲突条件

|要求/对象|依据与责任|旅程|证据|门|
|---|---|---|---|---|
|数据库无权威复盘时不同别名内容冲突|用户明确决策；Sol 实现、独立 Luna 审查、root 协调|首次 migration=null 时导出→迁移→读取；暂停并提示，原文均保留|[候选5独立报告](evidence/tdd-storage-2026-10-27/luna-review-candidate5.md)，native Store 反例|**FAIL，5/5 停止**|
|同名兼容、跨名比较与实际写入闸门|同上|已迁移时的读取和派发前检查|同报告，核心 50/50|限定 PASS；不代表完整页面通过|
|桌面功能、返回刷新、视觉、覆盖率|B §6/8/9.3 及桌面视觉契约|最终冻结版本的隔离数据库真实旅程|待最终运行|NOT VERIFIED|

冻结版量化门：14个完整文件分支覆盖率78.53%（5232/6662），95%目标FAIL；598 PASS / 53 FAIL / 4 SKIP。[报告](evidence/tdd-coverage-final-frozen-2026-10-27/FINAL-MEASUREMENT-REPORT.md)。最终隔离桌面文件选择失败，交互/返回刷新/视觉均NOT VERIFIED；源码后续改动须重新绑定、重新测量。
# 2026-10-27 后续范围证据（最终版本尚未冻结）

| 需求／旅程 | 证据 | 状态 |
| --- | --- | --- |
| 模拟成交上传 → 审核 → 确认 → 回交易库 → 刷新 | 隔离库真实浏览器：2 笔成交及来源数据保存，刷新后可见；`/private/tmp/tradereview-desktop-hmr-isolated-20261027-thxlEn/final-empty-01/` | 探索范围 PASS；最终版本、取消／失败／冲突及独立视觉 NOT VERIFIED |
| 导入历史实际重复数量来源归属 | [候选 2 独立审查](evidence/import-history-duplicates-2026-10-27/candidate2/luna-review-candidate2.md)：A/B 混合来源反例 | FAIL；原问题第 3/5 轮进行中 |
| 浏览器文件选择耗时 | 单次工具调用约 3989 秒后出现审核；环节归因未证实 | NOT VERIFIED；独立诊断中 |

最新冻结裁定：导入历史候选 3/5 的异常回执归属 **FAIL**，按原问题进入第 4/5 轮；[独立证据](evidence/import-history-duplicates-2026-10-27/candidate3/luna-review-candidate3.md)。18 完整文件分支覆盖率 78.54%、存储防护完整文件 86.88%，均未达到 95%；[测量](evidence/tdd-coverage-final-candidate3-2026-10-27/FINAL-MEASUREMENT-REPORT.md)。账户纠正测试合同修订限定通过，不替代产品验收。所有桌面、视觉和暂停项原门槛不变。

# 2026-10-27 最新验收状态补记

导入历史候选 4/5 独立审查整体 FAIL；66 项定向案例通过不替代异常性能、原工作区案例、真实浏览器与视觉等门槛。截图导入 P13 仅一次隔离诊断通过，原失败与真实浏览器未验证状态保留。完整见 [最终验收记录](FINAL-ACCEPTANCE.md) 与 [当前状态](CURRENT-STATUS.md)；既有设计范围、参考和责任划分不因该补记改变。

## 确认前重复信息：第五轮影响面

参考 [多券商导入已确认设计 §确认弹窗](../../docs/superpowers/specs/2026-07-29-multi-broker-import-metadata-design.md) 第 271、277 行和 [A 股导入对账规范](../../docs/specs/2026-09-13-a-share-page-import-reconciliation.md) 第 11、30、35、50、54、68 行；本范围无独立画板/元素编号，视觉依据为既有确认框及已记录的 1440×900、1280×800 对照，保持尺寸、信息顺序和交互。以下 ID 为本任务可追踪控件编号。

| 要求／控件 ID | 状态与旅程 | 实施 owner / 验收 | 预期和反例 | 证据 / 状态 |
| --- | --- | --- | --- | --- |
| DUP-PREVIEW-COUNT；导入确认重复摘要 | 上传后、服务器审核前／审核中／审核后、审核失败／重试 | Sol confirmation_preview；root 集成；独立 Luna | 预览显示可核实的重复候选和数量；未确认结果不得称为已完成；加载／失败不得显示伪确定值 | issues/16-import-confirm-duplicate-preview.md；NOT VERIFIED |
| DUP-CONFIRM；确认及取消 | 准备成功、待选择、提交／取消、失败 | 同上 | 按服务器计划核对，取消和失败不保存候选；不以预估替代正式保存结果 | 同上；NOT VERIFIED |
| DUP-HISTORY；历史及返回／刷新 | 提交后打开历史、返回及 reload | Sol confirmation_preview 负责旅程，root 跨模块协调；独立 Luna | 保存凭据的实际数量与原始预估分别可查；原 P03/P04 测试及旧失败保留；不修改原始来源 | 同上；NOT VERIFIED |

该条 UI 局部修复触发 [控件审计](../../docs/agents/frontend-control-audit.md)：确认摘要、服务器计划区、确认／取消／重试、历史入口和返回／刷新须登记并实际验证；root 负责整页一致性与持久化链，未实施者负责相同状态独立视觉对照。功能、真实持久化和视觉分别裁定。财务、Bars、已到 5/5 的 TV/SBUI/旧复盘不在本次范围。

2026-10-27 独立验收追加：DUP-PREVIEW-COUNT 因日期精度丢失及完整账户号码进入公开接口 **FAIL**；DUP-CONFIRM 和 DUP-HISTORY 的自动化局部证据不能替代真实浏览器、返航刷新和独立视觉，仍 **NOT VERIFIED**。第五轮候选不接受、不增加轮次；具体证据、版本清单及待验证项见[独立报告](evidence/import-confirm-duplicate-preview/INDEPENDENT-CANDIDATE-REVIEW.md)和[任务票](issues/16-import-confirm-duplicate-preview.md)。
