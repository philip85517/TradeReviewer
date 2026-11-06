# 07 - HTTP与桌面导入确认接线

ID: DBB-07
State: open
Status: in-progress-core-journey
Current acceptance: FAIL / NOT ACCEPTED
Assignee: /root/dbb_ui
Coordinator: /root


**Files:** `app/api/storage/trades/`路由/测试，`sqlite-http-client.ts`及测试，`trade-review-workspace.tsx`及其导入测试；允许新增专用导入计划展示文件。首页只接一致事实读取，不改暂停财务与Bars实现。
**Refs:** 设计6、8现有调用迁移、9.1/9.3；项目当前导入视觉与控件规范。
**Interfaces:** prepare/commit/getCommit实际HTTP，typed错误；前端只传本次候选与选择，使用凭据权威刷新，不上传全库。确认失败保留本地输入，冲突重新准备；断线同requestId查证/重试。
**Blocked by:** Task5、6。
- [ ] 实施前读取frontend-control-audit及ui-task-templates，登记实际受影响桌面控件、视觉参考和状态，补齐DESIGN-COVERAGE。
- [ ] HTTP非法/冲突/忙/内部错误代码稳定，不能以异常消息前缀分类；真实路由合同测试。
- [ ] 实际客户端和页面接线；月结缺失、冲突选择明确，不暗自确认删除；提交后按至少凭据版本刷新，返回/重载一致。
- [ ] 实际隔离库桌面浏览器验证导入→预览→确认→返回→重载、失败/冲突/断线恢复及相关视觉；独立Luna验证截图与规格，协调者独立实际验收。


## Acceptance

2026-10-27补充：未知费用两种原始值已由root完成真实桌面保存/返回/重载及SQL差分，局部8项7PASS、1FAIL。空串费用在服务器审核摘要显示为空且名称回退内部ID，保留FAIL待修；尚未消耗新修复轮次。证据：`../evidence/task-7/post-review/fee/browser-fixture-1/root-ui-acceptance-candidate3-1.md`。独立Luna、其余控件与6个目标视口仍待验，整票不关闭。

Attempts: 1/5 development, not frozen. Separate Luna review and root acceptance pending. Evidence: ../evidence/task-7/

## Dependency issue links

- [Task5](./05-task.md) must be accepted and closed.
- [Task6](./06-task.md) must be accepted and closed.

## 当前并行放行边界

Task5候选2已接受，root明确释放公共import/revision/material意图的HTTP/client/UI消费，与Task6共享整合并行；不改Task6独占文件。先完成最小真实导入旅程交root后再扩展T7-01至13，最终冻结/接受仍依赖Task6。自建browser-candidate-1.sqlite及服务17453已由root准备，空库检查通过；当前未seed/导入，不是UI通过证据。财务/Bars暂停、完整首屏1秒NOT VERIFIED。

## 20:22 最小真实旅程通过（局部）

此前“未seed/导入”状态已由新证据更新：root实际桌面导入、确认、返回、reload及合成库精确持久化比较PASS，见../evidence/task-7/root-minimum-journey-1.md。原E0完整保留。已放行原Sol扩展其余状态，仍candidate1/5；最终视觉、剩余控件、独立Luna与Task6绑定未通过，不关闭本票。

## 20:49 原候选1收口状态

owner 报告同版 Home/bootstrap、active counts、raw null、修订正式协议及 receipt/read 恢复已实现；定向4文件78 PASS与真实SQLite修订恢复局部PASS属于实现者证据，尚非整票接受。剩余：成功DTO校验、兼容route回归、修订/补录与真实解析冲突/缺行/恢复夹具、tsc/lint和冻结报告。root最小桌面旅程通过保留；最终Task6 c2绑定、独立Luna、完整受影响控件及视觉仍NOT VERIFIED。

Ruling: Task7 材料替代采用用户显式选择，默认独立材料；同券商/账户/月只是范围证据，不能推断同一文件的版本。选择来源为同版权威SourceMaterialContext，交现有服务器计划核验材料当前版本、缺行及依赖，不改来源模块身份规则；新文件指纹不得冒充已撤回成交ID。依据B§4.2/5/8、Task7月结缺行与现有调用迁移要求。成本：多一步明确选择，避免错误撤回历史成交；新增控件须加入视觉/状态/持久化验收，仍原候选1/5。

## 22:10 原文件恢复失败的消费者裁定（仍候选1）

已读 conditional-restore-diagnosis.log、真实 PDF→路由测试及 monthlyImportIntent/source-materials 实现。恢复原文件的正式提交因 import_batches.source_fingerprint 唯一约束失败；根因为 UI 为每次尝试生成新 legacy batch，而材料版本本身允许同真实指纹。

Ruling: 同一明确所选材料、同真实指纹复用该材料历史拥有的展示 batchId；各不可变版本仍保留当时投影。独立材料不能取得另一材料的投影所有权：保留独立材料/版本/观察及真实指纹，重复文件可省略新增兼容展示投影，并记录只读的既有展示批次参考，不表示替代或账户映射。消费者须红测同材料恢复、跨材料独立同文件、后续换版及原来源不被覆盖，说明 UI 语义；不改已冻结源模块、唯一约束或历史指纹，不以少一条 legacy 展示记录冒充来源丢失。原失败日志保留，最终由专属 Luna 与 root 核对。

桌面首页阶段检查：真实浏览器1440×900已显示3条持仓（港股、美股及保留的未知交易所E0）；截图 root-home-inprogress-1440.png，仅在途检查点，不是最终哈希绑定、视觉、财务或一秒验收。

## 23:17 冻结后独立验收进行中

最终候选1已冻结，40owner文件及依赖/930根manifest由root哈希复核。独立Luna5.6Max正在做全量静态与后续视觉复核。root真实monthly首次新增2笔、缺行全部明确保留、SQL精确核对及健康tab reload局部通过，见../evidence/task-7/root-final-monthly-journey-1.md。预览曾退出，原因未知、失败保留并同库恢复完整日志；不能宣称整体稳定。剩余恢复/撤回/冲突/故障/修订与视觉仍NOT VERIFIED，本票继续open。运行故障工具mock19PASS只是工具自身条件，不代替产品验收。Task8 socket统一fix2已交专属Luna静态复验，Task8整体0/5 BLOCKED不变。


## 独立最终审查回退（2026-10-26）

Task7候选1独立Luna：FAIL / NOT ACCEPTED。I-1历史unknown/null费用阻断非费用修订；V-1审核计划分组与561px按钮可读性Minor。原局部通过/失败记录保留。root派发两个不重叠的Sol6.1Ultra修复切片，各自单独Luna5.6Max；准确规格、owner、控件/状态和证据见[evidence/task-7/post-review/root-dispatch.md](../evidence/task-7/post-review/root-dispatch.md)。每问题累计最多5次，未完成不得关票。

## 2026-10-26 独立审查后第1轮修复进度

用户模型要求沿用：实现 Sol 6.1 Ultra，各项独立验收 Luna 5.6 Max，root 集成把关。同一问题按实际修改计数，达到第5次仍失败则暂停；旧失败不覆盖。

- I-1 历史未知费用：已取得真实 client→HTTP→Store 与 UI 的 RED，12项6失败/6通过。root 阅读精确方案后，明确释放 `stock-data-dialog.tsx` 与 `sqlite-store.ts` 两文件限定修改权，进入实际修复第1/5轮。输入/显示与 revision 审计仍为 `fee:string` 的空投影和 unknown；只有可信当前快照与完整 baseline 核对后才能继承 SQL NULL/空原值，ReviewChange 和 SQL 共用该原值；新输入、伪造 before 和 reported 降级不能借此绕过。专属 `dbb_fee_luna` 已完成准备，最终验收待冻结。Task5/6受影响依赖需回归，原接受证据保留。
- V-1 审核页可读性：Sol 第1/5轮已冻结3文件。manifest SHA256 `d5de39e715254e8067bebefbb6a093f39eaabef6cf17d99f29886c31fff3eb63`；定向3文件50项通过，lint/CSS parse通过。专属 `dbb_readability_luna` 仅准备与静态审查；七视口、真实操作及独立视觉结论仍 NOT VERIFIED。
- root 原文件恢复旅程在提交前被开发热更新打断，未触发本次 commit，记录 `evidence/task-7/post-review/root-hmr-interruption-1.md`。等待两名实现者冻结后 fresh reload 重新执行；不把这一中断算成 V-1 修复失败，也不冒充恢复已通过。
- Task7 仍 FAIL / NOT ACCEPTED；Task8 runtime 仍 BLOCKED / 0次运行。财务 P1/F07、Bars 继续暂停，完整首页≤1秒 NOT VERIFIED。未访问业务库，未推送/合并/发布。

## 2026-10-27 root 后审冻结与并行验收放行

- I-1 实际修复累计 **2/5**：第一轮行为测试通过但 TSC 三错失败，第二轮只修 callback 参数与非法 DTO 测试构造；两轮证据保留。专属 Luna5.6Max `task-7-final-luna-review-2.md` scoped 静态/定向证据 PASS；root 独立 9 文件 **298 PASS**（root-regression-1.log）。真实费用 UI/reload 与整票仍待验。
- V-1 实际1/5，最终七视口与专属 Luna 独立视觉门进行中。原 Task7c1 FAIL 不覆盖。
- root 最终源码 freeze 952文件，manifest `post-review/root-final-manifest-1.json` SHA256 fb65577d2761a684fcf2e0781af3a2a8cee5f60bfac9b3ba3c2e446751668104，重新核对0差异。schema smoke固定14→17由独立Sol/Luna静态通过1/5，runtime待统一检查。
- 同一原PDF恢复：真实桌面先选择保持撤回保存/reload，卖出仍withdrawn；随后选择activate，空理由禁止确认，填写明确理由后保存/reload，恢复原ID，AAPL由3增至4笔。两次owned DB只读快照 raw6笔、原E0全部原列原值、FK/完整性通过。postreview-reactivate-kept / active快照及截图保留。
- Root `task-8-root-runtime-release-1.md` 显式调整先后顺序：最终产品已冻结，允许Task8独立socket与T7浏览器并行，不再等待T7整票接受才开始；不免除任何门槛。专属Sol6.1Ultra仅执行已审harness，新合成A/B库4396/4397，root独占服务生命周期，首次失败停下诊断，无自动重试。完整Task8仍NOT VERIFIED。
- 财务P1/F07、Bars暂停；完整首页≤1秒NOT VERIFIED；业务库不访问，原884文件基线保留，无提交/推送/合并/发布。
