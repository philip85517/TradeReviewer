# 12 — 交易工作区回归的分组归因

ID: DBB-12
State: open
Status: acceptance-failed
Assignee: /root/dbb_workspace_strict_adapter_sol
Coordinator: /root

## 要解决的问题与范围

中央回归的 WORKSPACE-UI 组有57项失败，尚不能判断是旧页面和导入测试预期、夹具缺少交易性质，还是实际接线缺陷。本票先只读归因，列出每个失败对应的输入、调用链、首次失败及设计依据；不授权产品或原测试修改。

## 依据与所有权

- 设计：docs/backend-design/database-module-design.candidate.md §4.3、§5、§6、§7、§9；实施计划 Task7/8。
- 原始失败：evidence/task-8/socket/full-check-runs/root-20261027-2/sol-vitest-failure-groups-1.json 及同目录原日志、失败清单。
- 输入：该组8个测试文件、实际调用源代码、evidence/baseline/ 的884份原始快照。
- Sol 6.1 Ultra 仅写 evidence/task-8/workspace-diagnosis-1/ 与专属 task-8-workspace-sol-diagnosis-1.md；独立 Luna 5.6 Max 随后复核，root裁定。

## 验收与限制

- [ ] 57项逐一归入有证据的原因；没有证明的保持 UNKNOWN，不从代表例外推。
- [ ] 区分当前与原快照源码差异；同字节不证明历史运行结果。
- [ ] 每类提出统一的最小处理方案、准确文件和反例，保留原功能能力及设计依据。
- [ ] 财务/Bars以及首页金额和完整首屏性能不实施；不修改交易性质判定以迎合旧夹具。
- [ ] 专属Luna复核和root全文核对。

不运行测试、服务、HTTP、浏览器或数据库，不修改原源码/测试/配置/共享跟踪。此票只读诊断，不接受UI、持久化或整套测试；UI门不适用的依据是没有产品修改或真实操作。修复0次；后续同问题累计最多5轮，达到上限仍未解决则暂停，旧失败不清零。

## 2026-10-27 诊断冻结
Sol逐项57/8完成，专属dbb_workspace_diagnosis_luna独立复核中。修复0次。原FAIL、历史及下游UNKNOWN保留；W39财务疑点继续暂停，不授权19项测试侧建议实施。

## 2026-10-27 DBB-12诊断限定接受，G5候选1派发
专属Luna完整核对57项后给出scoped diagnosis PASS，root另逐项核对中央名称/原日志范围。诊断限定接受，57项产品FAIL未关闭。先按 `task-8-workspace-g5-candidate1-brief.md` 处理G5的14项成员性质测试输入，3测试文件，不改产品或全局helper。首次实际候选1/5；首次失败停，由专属Luna和root独立验收。其余43项不实施，W39/财务/Bars继续暂停。证据：`evidence/task-8/workspace-diagnosis-1/root-ruling-1.md`、`root-ledger-check-1.json`。

实际派发owner：`/root/dbb_workspace_g5_sol`，model=`gpt-6.1-sol`，reasoning_effort=`ultra`；专属Luna待候选冻结后创建。


### DBB-12候选1/5：G5测试输入限定接受

Sol6.1Ultra完成14项局部输入迁移；专属Luna5.6Max的Spec/质量/证据限定PASS；root独立精确14项14PASS/0FAIL，544文件冻结一致、隔离guard及sidecar未出现。详见 `evidence/task-8/workspace-g5-repair-1/root-scoped-acceptance-1.md`。原DBB-12保持open，其余43项原FAIL/UNKNOWN保留（6项财务暂停）；真实持久化/HTTP/UI/视觉和中央全套尚未接受。此为原问题1/5，不重置计数。


### 2026-10-27 工作区39项设计限定接受，最小adapter候选2授权

专属Luna只读Spec/静态证据PASS、设计PASS WITH P1 GATES；root全文核对并采纳正式createTradeReadHandler最小提取，禁止test-only复制读协议。静态39唯一条目/37原workspace对象完整，35迁移与4TV兼容分区保留。依据 `workspace-ports-design-1/root-ruling-1.md`。

原DBB12与DBB11各进入同原问题候选2/5共同packet：先新strict内存SQLite adapter合同及生产读handler机械提取，再验两条原SBUI纵向旅程，之后才其余33项迁移。各阶段不重置候选。尚未有运行PASS；原FAIL/UNKNOWN、G5限定接受、四项TV独立诊断保留。S1真实UI owned发布、S5图表设置/prefs及正式浏览器/文件重启均未验收。brief `task-8-workspace-strict-adapter-candidate2-brief.md`；财务/Bars仍暂停。


### 2026-10-27 工作区候选2失败封存；TV诊断限定接受

工作区DBB11/12共同候选2/5唯一GREEN为17PASS/9FAIL，新增harness九项均在真实Store校验模拟seed时首断（INVALID_INPUT / Invalid simulation evidence），S1–S5未到达。worker未修改、重跑或tsc；五源码及38依赖冻结不变。原handler两项和原protocol/conditional-inputs十五项限定通过，不能代替harness或UI。已交专属Luna5.6Max一次性复核输入和实现的其余疑点；未授权候选3，SBUI brief仅准备，未派实施。

TV四项只读诊断由专属Luna独立审查：Spec/静态证据PASS，设计PASS WITH OPEN RULINGS；root接受诊断子范围，不接受产品。W24为招商证券而非TV，当前旧matcher与正式路径一致，不能推断历史版本行为；W17旧专项财务硬阻断与通用理由选择、W15/16零事实变更的材料沿革仍需裁定。Sol正在只读形成最小设计，不增轮、不得普通导入触发专项迁移。原四项UI FAIL/commit/持久化/真实浏览器均保留未通过或未验证。

依据：task-8-workspace-strict-adapter-sol-candidate-2.md、task-8-tv-compat-luna-review-1.md及各原证据目录。中央全套FAIL不变，财务/Bars暂停；同问题超过五轮停止的规则继续适用。

### 工作区共同候选3/5派发（2026-10-27）

候选2专属Luna总门FAIL，已确认非法模拟seed及下一层未知费incoming混用。root裁定只修一个新合同测试文件：合法模拟pair/新来源ID行一次对齐，S1明确新费用已报告但性质未知输入；历史未知费保留在原protocol两合同及原Home raw-unknown合同，不新增harness原始写入口或放宽生产规则。一次27项后申请静默tsc，失败即封存；Sol6.1Ultra实施、原专属Luna5.6Max复核、root独立接受。依据task-8-workspace-strict-adapter-candidate3-brief.md。SBUI和其余33仍等待前置门，原失败与暂停范围不变。

### 2026-10-27 工作区候选3/5失败封存

唯一GREEN：27执行、26PASS/1FAIL，UTC 20:13:24.457980→20:13:40.865941，exit1，完整日志SHA256 `758d3b5c6185d1adaeb4fd8ea53acc0406c3d17a9d53b0c1cce786fb1a3149ea`。已解除非法模拟seed阻塞，handler2、原protocol/conditional15、Home raw-unknown1、S2–S5均通过。剩余S1 delayed carrier在 `expect(JSON.stringify(old)).toBe(frozenPayload)` 失败；封存两响应深层JSON值/版本/receipt/页数据相同，静态parser有canonical键排序，尚待专属Luna独立审查。保留真实FAIL，未改断言、未重跑、未执行tsc；不能以26PASS接受adapter或原UI。候选3仅该测试文件变化，44有限源稳定；三历史反例与其他8回调保留。证据 `workspace-strict-adapter-repair-3/`。任何后续修正必须算同原问题候选4，达到5次仍失败即停，不新票重置。


### 2026-10-27 工作区adapter候选4/5限定接受

Sol6.1Ultra与root独立exact27均27PASS/0FAIL，原生tsc通过；原专属Luna5.6Max的Spec/合法输入Design/worker证据三门限定PASS。44有限源稳定，16项Home按pattern未运行；journal仅为已解析对象，不是原始wire bytes。候选3末3历史未达与候选4完整S1通过已在Luna报告勘误区分。root日志SHA256 b431f6a0834e03f988c3242304ae261652c24a965ad7cdc4814c7190801983b4。裁定 task-8-workspace-strict-adapter-root-acceptance-4.md。

只解除最小adapter前置门，原UI/真实HTTP/文件重启/视觉及整体仍未接受，原候选2/3 FAIL保留。已派原Sol仅只读SBUI统一前置设计，原专属Luna随后；未授权实现。DBB11/12仍累计4/5，今后TV/SBUI/剩余迁移共同实际候选不得另起计数；下一最多5/5。RoomPerformance33项只读设计已封存并交其独立Luna，DBB14仍2/5。财务P1/F07、Bars暂停，中央原244FAIL及完整首页一秒NOT VERIFIED不变。


### 当前：共同候选5/5实施中，尚未运行

SBUI design1及TV design2/root合同裁定2均经各自独立Luna静态审查；root已授权两个原Sol6.1Ultra按不重叠三文件与13生产＋6测试实施。各自专属Luna5.6Max后续验收，root最终接受。历史GET仅SBUI helper owner机械接真实Store。有限目标为A27/B8/C35/D15合计85，root独立核对继承名单及无重复；等全部writer封存才授权运行。第一次实际FAIL停止共同5/5，不内部改跑或另起第6轮。

其余33项迁移仍待最小真实旅程前置门，原FAIL/未验证项不关闭；真实HTTP、文件重启、桌面/视觉、完整首页一秒及中央全套仍未验收。财务P1/F07、Bars继续暂停。具体brief、test-lock及进度见主台账，原候选2/3失败保留。


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
