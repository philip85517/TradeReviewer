# 13 — 导入判重与截图冲突的逐项归因

ID: DBB-13
State: open
Status: in-progress
Assignee: /root/dbb_import_reconciliation_sol
Coordinator: /root

## 范围和依据
只读诊断中央RECONCILIATION七项和SCREENSHOT三项，共10项原FAIL。依据B设计§5.1、§5.2、§6、§8、§9.3以及实施计划Task1/4/7/8；逐条解释输入、身份/账户/时间精度/性质/材料版本/多重集、最先分叉与可观察原错误。区分当前和中央freeze以及884快照，旧行为不等于当前认可设计。不得从代表例外推全部。

## 验收
- [ ] 完整10项账本，中央原错/stack/输入/调用链/规格逐条对应；未经证实保持UNKNOWN。
- [ ] 产品规则偏差与过时测试/夹具分别列出；提出统一最小方案和准确文件、反例，等待root裁定。
- [ ] 禁止恢复跨材料静默合并、放宽账户/性质/run/精度隔离、丢失合法同值多笔或原始材料。
- [ ] 独立Luna5.6Max随后复核；root全文核对，未接受功能。

## 派发
Sol6.1Ultra只写evidence/task-8/import-reconciliation-diagnosis-1/及专属task-8-import-reconciliation-sol-diagnosis-1.md。无测试、服务、HTTP、浏览器或任何数据库操作，无产品/测试/配置/共享tracking修改，无派代理/提交。严禁读取/复制保护业务库和make dev/npm run dev。财务P1/F07/Bars暂停。修复0次，同问题累计最多5轮，不重命名清零。UI门不适用的依据是只读文档诊断，应用/实际交互/持久化验收NOT VERIFIED，原FAIL保留。


Sol10项只读诊断封存，修复0/5；专属 /root/dbb_import_reconciliation_luna（Luna5.6Max）独立复核中。缺省instant与second比较全域政策仍UNKNOWN，不能以夹具修正预案替代设计接受。


### 2026-10-27 DBB13诊断接受，授权候选1/5
专属Luna静态复核PASS，root逐项中央核对10/10后限定接受诊断（import-reconciliation-diagnosis-1/root-ruling-1.md）。授权Sol仅修改两测试文件的10目标，按候选brief精确一次验证；产品判重规则不改，财务/Bars仍暂停。候选计数1/5；原10FAIL保留，后续行为须运行证明。

### 候选1预门工具恢复裁定（root，2026-10-27）
已全文核对 Sol 停止报告及 pre-gate-tool-error：Python zip(strict=True) 兼容错误发生于冻结清单生成，Vitest/关联 scope/tsc 均为0次。只授权改证据工具为“先验证等长再zip”；先核对已封存候选源和diff一致，再继续候选1首次三门。原错误现场保留，候选代码不得再改；任一门首个非预期失败立即停。此裁定不是候选2，也不是10项目标已通过。


### DBB13候选1/5限定接受

十项测试契约对齐经专属Luna5.6Max三门限定PASS及root独立精确10项通过，证据：`evidence/task-8/import-reconciliation-repair-1/root-scoped-acceptance-1.md`。Sol关联36项和类型检查为单次通过；874输入冻结无漂移，隔离guard未创建。仅改两测试，不改产品规则。原中央10FAIL历史保留，DBB13仍open、实际1/5；正式Store/HTTP/持久化/浏览器与视觉未接受。R05 reported费用冲突及全域缺省精度政策仍未证明。财务P1/F07与Bars暂停；Task7/8整体未接受。
