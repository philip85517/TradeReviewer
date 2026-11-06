# 10 - 相同修订请求重试被错误拒绝

ID: DBB-10
State: open
Status: acceptance-failed
Assignee: /root/dbb_socket_runtime_sol
Coordinator: /root
Reviewer: /root/dbb_h6_luna (gpt-5.6-luna / max)

## 要解决的问题

同一个合法请求原文重试必须返回原结果，不能因服务端新增审计时间而报冲突。不同请求内容使用同一ID仍须409，不能为幂等而丢失内容比较。

## 范围与依据

- 精确设计：docs/backend-design/database-module-design.candidate.md §4.1、6、8、9；既有 app/lib/storage/trade-revisions.test.ts 幂等用例及 write-entry-handoff.md。
- 唯一产品owner：app/lib/storage/sqlite-store.ts；测试owner：app/lib/storage/trade-revisions.test.ts。界面/HTTP/schema/财政/Bars/其它产品文件不在本票。
- Task8真实HTTP A阶段为验收旅程；复验须新合成库、新freeze、新run，禁止覆写首次失败。无业务库访问。
- 根因证据：evidence/task-8/socket/runs/root-20261027-1/diagnosis-h6-first-failure-1.md；070与071请求SHA相同，request_json和客户端只有服务端 recordedAt 差异。

## 验收标准

- [ ] 现有相同请求重试用例在修复前RED，修复后GREEN。
- [ ] 相同重试所有应用表和BookVersion均无变化。
- [ ] reason、changes、expectedScope、importHistory 等业务内容变化仍409。
- [ ] 兼容旧的受污染 request_json，必须与完整审计及SQL recorded_at严格一致；原历史不可重写。
- [ ] 客户端伪造/额外 recordedAt 不得使不同业务请求相等。兼容边界有反例。
- [ ] 独立Luna实际审查候选diff与证据；root独立测试、受影响费用/TV回归。
- [ ] 新freeze与新socket run通过实际精确重试及后续A/B重启/回滚；失败保留。

## 尝试账本

首次实际socket验收FAIL保留；不计作修复次数。实际产品修复候选1/5已启动，尚未接受。第5轮未解决即暂停，记录根因、尝试和影响，不能冒充通过。

## 2026-10-27 H6 候选1冻结后的审查状态

- Sol6.1Ultra已冻结DBB-10实际修复1/5：修订定向39项、相关299项及tsc通过。root独立3文件78项通过（含未知费用UI和非法费用回归），证据 evidence/task-8/h6-repair-1/root-focused-1.log；不代替真实socket重试/重启。
- 独立Luna5.6Max dbb_h6_luna审查中。开发者自查指出损坏历史审计expectedScope非数组可能抛非类型化异常，尚未复现/裁定，候选未接受。任何后续修复按下一轮记录。
- 取消来源只读诊断已冻结于evidence/task-7/post-review/cancel-provenance-1.md：直接取消链无reviews/commit调用，后台version2 writer可产生仅时间戳变化；无请求关联，不能唯一归因，也不能称全库零写。另有专属Luna复核。
- 4398费用桌面暂未执行保存，避免共享Store变化使证据失去版本绑定。旧FAIL/锁与测试日志全部保留。Task7 FAIL/NOT ACCEPTED、Task8 NOT VERIFIED不变；财务/Bars暂停。

## 2026-10-27 H6 候选1正式失败，第2轮启动

- 独立 Luna `dbb_h6_luna` 的 `task-8-h6-luna-review-1.md` 判定 candidate1 spec FAIL、quality FAIL。root 已核对实际源码：`validateRevision` 未验证 `expectedScope` 形状，证明函数后续 `.map` 在 catch 外，会让损坏旧审计触发原生异常/HTTP500；非法新请求也有同类风险。合法幂等路径的既有局部通过仍保留。
- 授权原 Sol6.1Ultra owner 进行实际第2/5轮，唯一产品/测试仍 Store 与 trade-revisions.test.ts。先用合成内存库 RED，覆盖scope容器及元素，再验证旧审计稳定409、非法输入结构化400与全表零写；不吞存储异常、不放宽请求比较、不重写旧审计。候选1及旧socket失败不覆写。
- 另行 Sol6.1Ultra 只读整理全量/新socket复验清单，独立 Luna5.6Max 汇总剩余UI证据缺口。运行时、真实UI保存和新freeze需等待候选2审查与root放行。
- 当前 H6 2/5（进行中），I-1 2/5、V-1 1/5；Task7 FAIL/NOT ACCEPTED、Task8 NOT VERIFIED。财务与Bars继续暂停。


## 2026-10-27 H6 候选2类型检查失败，第3轮限定修正

- 候选2定向99项、关联299项均通过；tsc退出2，唯一错误为trade-revisions.test.ts:385 TS18046，新增真实route测试未收窄response.json()的unknown类型。候选2冻结和全部FAIL日志保留，不能据运行测试通过而接受。
- root核实源码后授权原Sol6.1Ultra owner第3/5轮：仅修正新增测试的真实响应结构收窄，不改产品逻辑、不用any或不安全断言掩盖错误。独立Luna5.6Max保留候选2评审并对新冻结另行复审；root后续独立回归与新合成库真实HTTP验收。
- 当前H6 3/5；I-1 2/5、V-1 1/5不变。Task7 FAIL/NOT ACCEPTED、Task8 NOT VERIFIED；财务与Bars继续暂停，完整首页≤1秒NOT VERIFIED。

## 2026-10-27 H6 候选3局部接受，等待新版本运行时验收

- Sol6.1Ultra候选3仅增加6行测试响应结构校验，产品SHA仍a1d9ee042ba58af294171d2d7ed2d1909abe34c1905c418269001b28e7bdde92；测试SHA1be6d63884a47c189ebbb517f68cba3cdf0ae73c6ead63018bdc51715193e780。定向99项PASS、tsc退出0；关联299项为产品相同候选2的实测结果，本轮未重复运行。
- 独立Luna5.6Max的task-8-h6-luna-review-3.md：spec/quality局部PASS。root全文审查，并独立复跑修订、未知费用UI、非法费用三个文件，138项PASS、退出0，证据evidence/task-8/h6-repair-3/root-focused-1.log和root-focused-result-1.json。允许进入新freeze运行时复验，不关闭本票或Task5集成门。
- 完整文件清单与gate后缀投影分别命名并绑定；全量测试须显式新建合成sentinel。新预检由另一独立Luna复核，尚未运行全量或新socket。候选1与2、旧socket首次失败均保留。
- H6累计3/5，I-1 2/5、V-1 1/5；Task7 FAIL/NOT ACCEPTED、Task8 NOT VERIFIED。财务与Bars暂停，完整首页≤1秒NOT VERIFIED。


## 2026-10-27 第四轮冲突验证结果与新增独立归因

- H6 candidate4/5已完成两处类型化冲突错误修正，产品SHA256为4d5479ba78d1bfc182348b28b9fbd571d39cee7d67b33ecd0ae1787386d41417。首次修复后定向运行106 PASS / 1 FAIL（总107），Store105项通过；原route的过期请求409通过，但后续历史总数断言期望1、实际2而失败。导入已有一条正常审计、修订新增一条是已追踪原因，等待专属Luna/root裁定；未删导入审计，未启动第五轮。关联299项和tsc本轮未运行，不能引用为本轮通过。完整证据：task-8/h6-repair-4/ 与 task-8-h6-sol-candidate-4.md。

独立评审：/root/dbb_h6_candidate4_luna；原实现者冻结等待裁定，不授权第五轮。


## 2026-10-27 H6第5/5轮限定放行

Ruling: 保留B正式导入审计，修正旧HTTP测试的固定总数预期——root直接核对Store审计产生/读取、原测试和Luna review4后裁定。若裁定有误，风险是测试掩盖审计合同差异，因此本轮同时保留seed原文、验证repair只新增一次及retry/stale无审计改变，不允许产品改动。候选4 spec限定PASS、quality未验证、整体FAIL保留。

原问题累计第5/5轮仅授权新Sol6.1Ultra修改route测试第一用例，Store及Store测试冻结不变，定向107、关联5文件、tsc按顺序首次失败即停；专属Luna5.6Max后续独立复核。准确范围 task-8-h6-candidate5-brief.md；未授权第6轮，失败即暂停。真实socket/重启与Task7/8整体仍未接受。


### H6第5轮预检工具裁定

新Sol在任何源修改/冻结/正式验证前的shasum静态哈希遇宿主LC_CTYPE=C.UTF-8导致Perl panic、exit9。Root裁定：这是已知静态工具故障，不是H6产品修复或正式验证失败，允许Python hashlib完成静态哈希，保留原失败，不重跑shasum；仍为第5/5轮，不授权第6轮。冻结后的三个正式验证继续各一次、首个FAIL立即停止。


## 2026-10-27 H6第五轮验证完成，独立复核待定

H6第5/5轮只改原HTTP测试第一用例：保留完整seed审计，成功修订恰新增一条，重复/过期请求的审计逐条不变。Store与Store测试哈希维持candidate4。定向107/107、关联5文件299/299、tsc均exit0，各执行一次且三文件冻结一致；证据 task-8/h6-repair-5/*-result-1.json。Root已直接读取diff、日志与结果，独立Luna及root另行验证尚待完成，因此仅验证阶段PASS，H6/Task8未接受，不开展第6轮。

DBB-11只读诊断已冻结（FREEZE SHA256 6551ac223efb40d67b1c3c707b145e5a20d5c40d019173a223c2d2d8a0fd52de），独立Luna5.6Max复核中：两项旧测试合同失配与一类实际纯校验器职责依赖需分别处理；没有产品修复。DBB-12继续逐项扫描57项，月结证据接线疑点未运行确认且不自动恢复暂停财务任务。

Task7/8整体FAIL / NOT ACCEPTED；I-1 2/5、V-1 2/5、H6 5/5。财务P1/F07、Bars继续暂停，完整首页≤1秒NOT VERIFIED。原失败/轮次保留，无保护业务库访问和远端操作。


## 2026-10-27 Root限定验收与下一轮分工

H6第5/5轮经专属Luna及root独立107/107复跑通过，关联299及tsc为Sol单次冻结证据。定向spec/quality接受，真实socket/restart、整套回归/full build仍NOT VERIFIED，原runtime FAIL保留；DBB-10不关闭且无第6轮修复授权。详见 evidence/task-8/h6-repair-5/root-scoped-acceptance-1.md。

DBB-11诊断经root全文核对及Luna追加勘误裁定：source-materials归Task4；原guard不拦截新的纯合同名，不修改guard。放行同问题第1/5轮8文件纯合同提取，由Sol6.1Ultra唯一实现，随后独立Luna5.6Max验收；不改两项旧UI测试，不改财务/Bars或产品语义。准确范围 task-8-storage-contracts-candidate1-brief.md；证据 storage-boundary-diagnosis-1/root-ruling-1.md。

DBB-12已逐项封存57项/8文件；18/17/4/1/14/1/1/1分组，原FAIL及下游UNKNOWN保持。专属Luna dbb_workspace_diagnosis_luna复核中，尚无测试侧修复授权。W39仅高置信暂停财务接线疑点，未运行确认。I-1 2/5、V-1 2/5、H6 5/5；Task7/8整体FAIL / NOT ACCEPTED，财务P1/F07、Bars暂停，完整首页≤1秒NOT VERIFIED。
