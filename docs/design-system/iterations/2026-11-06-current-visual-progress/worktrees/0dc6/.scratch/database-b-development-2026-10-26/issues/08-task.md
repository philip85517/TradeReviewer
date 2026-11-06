# 08 - 集成回归与交付

ID: DBB-08
State: open
Status: blocked
Assignee: unassigned
Coordinator: /root


**Files:** 仅必要集成修复（回给各owner），任务证据及文档。
**Refs:** 全设计、任务矩阵、项目开发流程。
**Interfaces:** 上述所有真实调用方，保留旧数据/审计。
**Blocked by:** Task1–7及Task9的本地安全入口验收；最终schema变动后须复验受影响的Task9范围。
- [ ] 协调者集中运行类型检查、构建、全量单元与适用运行时测试，分离既有失败和新增失败。
- [ ] 独立Luna全变更审查、协调者确认每票已验收，必需项FAIL/NOT VERIFIED阻止整体完成。
- [ ] 桌面实际预览服务保持运行，交付可点击链接、启动命令和验证结果；财务/Bars/1秒完整首屏未验证继续明示。
- [ ] 同问题第5轮仍失败则停止并记录原因、已试方法、证据与影响，依赖票保持阻塞；不把暂停标为通过。

## Acceptance

Attempts: 0/5. Separate Luna review and root acceptance pending. Evidence: ../evidence/task-8/

## Dependency issue links

- [Task1](./01-task.md) must be accepted and closed.
- [Task2](./02-task.md) must be accepted and closed.
- [Task3](./03-task.md) must be accepted and closed.
- [Task4](./04-task.md) must be accepted and closed.
- [Task5](./05-task.md) must be accepted and closed.
- [Task6](./06-task.md) must be accepted and closed.
- [Task7](./07-task.md) must be accepted and closed.
- [Task9](./09-runtime-activation.md) local backend scope must be accepted; reverify affected initialization/activation checks against the final schema. Real Docker and production operations remain outside this delivery.

## 独立前置：测试类型兼容
- 原9组编译诊断已复现，Sol候选1/5冻结；两个测试文件类型表达，运行时代码未改。
- 独立Luna dbb_typecheck_luna审查中；整体Task8仍0/5、blocked，不借切片宣称全量通过。
- 证据：../evidence/task-8/typecheck/；报告task-8-typecheck-report.md。

- Task8测试类型切片candidate1 ACCEPTED：专属Luna spec/quality Approved，root已读全部slice.diff及真实viewport seam，独立35Recall PASS、snapshot16已包含在Task4 root133PASS中，冻结hash匹配；worker全量tsc exit0日志已核对。保留DEP0205 Minor。仅前置切片接受，Task8整体验收仍blocked/NOT VERIFIED。


## socket fix2 独立静态复验

专属Luna task-8-socket-luna-review-2.md已给STATIC PREP PASS；root已读全报告。原失败保留。实际runtime仍0/5 BLOCKED于Task7最终冻结/接受，不以工具mock或静态检查替代实际HTTP。

## 2026-10-27 当前回归与桌面局部验收

- 实际socket首轮A在H6失败：合法修订首次200、完全相同请求再次409，已停止该run（A状态FAILED、B仅初始化），旧库/日志/锁原样保留；后续撤回、A重启与B迁移均NOT VERIFIED。不是数据库连接失败。服务端审计时间被放入请求比较是已定位根因。Task5受影响接受门重开，[DBB-10](10-legacy-revision-retry.md) 实际修复1/5由Sol6.1Ultra处理，独立Luna5.6Max审查，尚未接受。新候选使旧952文件freeze失效时需重新冻结；旧证据保留。
- 桌面1440×900/DPR1：root实际完成保持撤回、明确理由后恢复、同一原文件默认独立材料保存/返回/重载。独立材料新增来源历史，旧来源逐行不变，成交仍6笔且无重复。证据 post-review/root-browser-journeys-1.md 与独立材料全表快照。
- Luna独立视觉审查仅1440×900局部PASS；另7个准确视口因工具set未实际生效保持NOT VERIFIED，不以文件名或DOM冒充。V-1实际1/5。
- I-1实际2/5，静态/定向证据已获专属Luna局部PASS；NULL/空串合成独占库4398夹具READY，真实UI保存/reload待验。夹具loader首次错误单列工具诊断，不计产品修复。
- 取消计划快照显示 plans 及既有reviews.updated_at变化，不能宣称数据库零写；来源/成交/审计不变，时间戳写入归因仍待厘清。
- Task7仍FAIL/NOT ACCEPTED，Task8整体NOT VERIFIED，财务P1/F07与Bars暂停，完整首页≤1秒NOT VERIFIED。

## 2026-10-27 H6 第2/5轮定向修复进行中

独立 Luna 候选1 spec/quality FAIL 已由root源码复核：损坏历史scope在比较中触发原生异常，HTTP500而非兼容拒绝409；新请求也缺提前shape校验。原 Sol owner 在原两文件范围做第2/5轮，先RED后修复，候选1/旧socket失败锁保持不变。下一次真实运行须重新冻结并创建fresh run；当前未放行。详见[DBB-10](10-legacy-revision-retry.md)及 task-8-h6-luna-review-1.md。Task7仍FAIL/NOT ACCEPTED、Task8整体NOT VERIFIED；财务/Bars暂停。


## 2026-10-27 H6 candidate 3 bounded acceptance

Sol 6.1 Ultra candidate 3: focused 99 PASS, tsc exit 0; product unchanged from candidate 2 (related 299 PASS inherited). Dedicated Luna 5.6 Max review-3 spec/quality PASS. Root independently read the code/reports and ran 3 files / 138 tests PASS, exit 0; evidence task-8/h6-repair-3/root-focused-1.log and root-focused-result-1.json. Details and exact SHA: issues/10-legacy-revision-retry.md, latest entry. Runtime, new socket and full suite are NOT VERIFIED; do not close DBB-10. H6 3/5, I-1 2/5, V-1 1/5. Original FAIL records retained; Task7 NOT ACCEPTED, Task8 NOT VERIFIED, Finance/Bars paused, complete Home <=1s NOT VERIFIED.


## 2026-10-27 中央回归最终结果与后续分派

新run `root-20261027-2` 已真实结束：原生环境与tsc退出0；Vitest退出1，24文件失败/351通过/3跳过，244用例失败/4973通过/6跳过（总5223）。日志计时724.13秒，外层进程726.765秒。各阶段freeze前后均退出0。失败后native8、build、runtime3及新socket未启动，均NOT VERIFIED；证据位于 `evidence/task-8/socket/full-check-runs/root-20261027-2/`。独立Luna `task-8-central-checks-luna-review-1.md` 裁定FAIL-stop，root已读全文并核对原始日志/退出码。

244项不能直接解释为244个产品缺陷：30项共享listen EPERM，其余按共同原因继续定位，未证明者为UNKNOWN。性质规则、shared-scope及history与实施前baseline同字节，只证明未改，不能替代基线成对复现或宣称原来就失败。财务与Bars继续暂停，不借测试失败恢复开发。

Owner绑定报告经独立Luna `task-8-final-owner-bindings-luna-review-1.md` 核对准确性PASS，root已读两份全文；旧Task5/6证据不能直接覆盖后来修改的共享Store。两项deploy文件虽与Task9 owner哈希相同，仍不在full1167，旧freeze不回写，不宣称本轮全覆盖。

原V-1 Sol继续候选2/5，范围为审核事实显示与专属测试，先定位和RED再修；空串费用摘要漏显“未知”/友好名称的真实FAIL保留。另由专属Luna审查root未知费用真实保存证据。I-1仍2/5、H6仍3/5。Task7 FAIL/NOT ACCEPTED，Task8 FAIL/NOT ACCEPTED；完整首页≤1秒NOT VERIFIED。未提交、推送或接触保护业务库。


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


## 2026-10-27 H6第五轮验证完成，独立复核待定

H6第5/5轮只改原HTTP测试第一用例：保留完整seed审计，成功修订恰新增一条，重复/过期请求的审计逐条不变。Store与Store测试哈希维持candidate4。定向107/107、关联5文件299/299、tsc均exit0，各执行一次且三文件冻结一致；证据 task-8/h6-repair-5/*-result-1.json。Root已直接读取diff、日志与结果，独立Luna及root另行验证尚待完成，因此仅验证阶段PASS，H6/Task8未接受，不开展第6轮。

DBB-11只读诊断已冻结（FREEZE SHA256 6551ac223efb40d67b1c3c707b145e5a20d5c40d019173a223c2d2d8a0fd52de），独立Luna5.6Max复核中：两项旧测试合同失配与一类实际纯校验器职责依赖需分别处理；没有产品修复。DBB-12继续逐项扫描57项，月结证据接线疑点未运行确认且不自动恢复暂停财务任务。

Task7/8整体FAIL / NOT ACCEPTED；I-1 2/5、V-1 2/5、H6 5/5。财务P1/F07、Bars继续暂停，完整首页≤1秒NOT VERIFIED。原失败/轮次保留，无保护业务库访问和远端操作。


## 2026-10-27 Root限定验收与下一轮分工

H6第5/5轮经专属Luna及root独立107/107复跑通过，关联299及tsc为Sol单次冻结证据。定向spec/quality接受，真实socket/restart、整套回归/full build仍NOT VERIFIED，原runtime FAIL保留；DBB-10不关闭且无第6轮修复授权。详见 evidence/task-8/h6-repair-5/root-scoped-acceptance-1.md。

DBB-11诊断经root全文核对及Luna追加勘误裁定：source-materials归Task4；原guard不拦截新的纯合同名，不修改guard。放行同问题第1/5轮8文件纯合同提取，由Sol6.1Ultra唯一实现，随后独立Luna5.6Max验收；不改两项旧UI测试，不改财务/Bars或产品语义。准确范围 task-8-storage-contracts-candidate1-brief.md；证据 storage-boundary-diagnosis-1/root-ruling-1.md。

DBB-12已逐项封存57项/8文件；18/17/4/1/14/1/1/1分组，原FAIL及下游UNKNOWN保持。专属Luna dbb_workspace_diagnosis_luna复核中，尚无测试侧修复授权。W39仅高置信暂停财务接线疑点，未运行确认。I-1 2/5、V-1 2/5、H6 5/5；Task7/8整体FAIL / NOT ACCEPTED，财务P1/F07、Bars暂停，完整首页≤1秒NOT VERIFIED。


## 2026-10-27 Sol/Luna实际owner与并行范围

DBB-11第1轮纯合同提取由dbb_storage_contracts_sol（Sol6.1Ultra）实现，专属Luna随后；DBB-12的57项只读归因由dbb_workspace_diagnosis_luna（Luna5.6Max）独立复核；DBB-13新增只读归因RECONCILIATION7+SCREENSHOT3，由dbb_import_reconciliation_sol（Sol6.1Ultra）负责，专属Luna随后。DBB-13覆盖矩阵与issue已建立，修复0次；两Sol写入范围互不重叠。

H6第五轮review首部作者误写已由Luna追加纠正：实际候选5实现者dbb_h6_candidate5_sol，原socket代理属于早期工作。历史报告和失败保留。财务/Bars暂停，Task7/8整体未接受。

## 2026-10-27 DBB-12诊断限定接受，G5候选1派发
专属Luna完整核对57项后给出scoped diagnosis PASS，root另逐项核对中央名称/原日志范围。诊断限定接受，57项产品FAIL未关闭。先按 `task-8-workspace-g5-candidate1-brief.md` 处理G5的14项成员性质测试输入，3测试文件，不改产品或全局helper。首次实际候选1/5；首次失败停，由专属Luna和root独立验收。其余43项不实施，W39/财务/Bars继续暂停。证据：`evidence/task-8/workspace-diagnosis-1/root-ruling-1.md`、`root-ledger-check-1.json`。
