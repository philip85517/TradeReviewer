# 02 首屏解析依赖按需加载（候选 2 范围收敛）

State: open
Status: partially-verified
Assignee: /root/astra_lazy_startup_impl
集成负责人: root
Blocked by: 完整首页数据/范围旅程与正常数据视觉门槛未通过；原财务任务保持暂停
验收轮次: 2/3（同一轮统一修复，未重置）

## Scope / 决策

root 根据候选 1 真实生产 chunk 恢复失败，将 Task02 收敛为 dispatcher/XLSX 按需加载、取消/替换防护及模块失败准确提示。四个条件视图恢复冻结 baseline 的 eager value imports；新增 wrapper 与其专用测试已移除，原 JSX/props/key/条件/guard/生命周期保持。四视图拆分是 **NOT IMPLEMENTED** 的后续优化，需独立资源协议设计；没有新建任务绕过轮次。

唯一产品变更文件 `app/components/trade-review-workspace.tsx`：删除 dispatcher 静态导入；按需 import 后及 parse 后检查 requestId；模块未加载成功则通过现有错误区提示“导入组件加载失败，请刷新页面后重试。”；已加载后的解析异常保持原反馈。catch/finally 保留取消序列防护，不自动刷新，不新增重试控件。DataManagement、财务/host/source/alias/migration 与暂停 P1/F07/Bars 不动。

## Refs / 合同

见 `../DESIGN-COVERAGE.md`、PLAN、task-02-brief；原始 homepage v2.5 / library v1.0 正文、首页组件手册与四张 1440/1280 current/history SVG 已阅读/查看。当前 workflow、task-decomposition、ui-task-templates、frontend-control-audit 已应用；原参考查看不等于渲染页面视觉通过。HP11/HP03/HP02，root 持有整页视觉与完整持久化验收。

## 当前证据

- [x] 专用测试 2 文件 7/7 PASS；首页 passthrough 模块探针明确证明 dispatcher/XLSX 不求值、四视图仍求值。无静态 XLSX 测试导入。
- [x] pending import 取消/替换、旧 parse 晚到、取消后的模块拒绝均不发布过期结果。
- [x] 同一个拒绝 Promise 持续失败时显示刷新提示、释放输入；一个已加载 parser 解析失败后重选可恢复。没有宣称浏览器同页模块网络重试成功。
- [x] 最终既有 workspace 定向旅程 7/7 PASS，135 excluded；取消/确认导入与首页→交易库→Recall→返回上下文回归通过。模拟/隔离 adapter 不代表真实持久化验收。
- [x] root narrowed 生产 build PASS；真实首次资源不含 dispatcher/SheetJS 实现；模块真实404→准确提示→恢复同hash→手动reload→有效CSV预览 PASS。typecheck 独立 FAIL，与基线相同8项错误、无新增错误。
- [x] C4 真实CSV确认→SQLite1866→1868→交易库→reload，原1866行逐列不变；取消键盘Space、右上关闭鼠标及此前Esc分别有证据。1440/1280匹配导入预览视觉通过。
- [ ] 完整首页范围旅程、正常非零财务视觉与一秒首屏门槛未通过。Sol续验已补实际慢模块反馈/锁定/释放，取消/替换/晚到竞态仍只有专项测试；关闭后焦点FAIL，详见最新局部控件审计。State 保持 open，不将局部代码接受等同整页交付。

最终证据：`../evidence/task-02/round-02/narrowed-final/`（完整 baseline diff、候选 1 增量、manifest、实际命令、red/green logs）。报告 `.superpowers/sdd/PLAN/task-02-report.md`。产品/测试已冻结等待 root，worker 未运行服务、浏览器、build、广套测试/typecheck 或访问业务库。

## Review rounds / 保留失败

- **Round 1/3 FAIL — type:** root build PASS、专用 8/8 PASS，但新增 `startup.test.tsx:65 TS2540`。修复采用不可变 receipt，无 cast/强制覆盖。候选 1 startup SHA-256 `809cb5b3740ca8c144ad44c7fc782d4e757e61032946328412862b27cc69e369`，manifest `c5f43b69b58ff6f87fa71021eb62104d774edcf9194d06606218ea99024a3627`，candidate.diff `80e9cfc1746fff4af21eca4b285d49ec0c741527a38c0a6b50fe5e61cc69a1fc`。
- **Round 1/3 FAIL — real retry:** root 暂移 `trade-library-CawTTKre.js`，首次加载失败后原样恢复并校验 hash，点击“重新加载交易库”仍失败。证据 `../evidence/candidate-01/chunk-failure/`。清空 wrapper Promise 未清理浏览器失败模块身份；Vite preload 去重状态亦不能由 wrapper 重置。原 mock 换成可用模块的恢复证据不足，明确撤回同页恢复结论。
- **Round 2/3：** root 拒绝扩展 Vite 插件、解析错误/loader 字符串、有限 query 变体，选择保守范围和用户手动刷新边界。最初 type-only 中间候选已 superseded；原 `round-02/` 文件及 `type-only-superseded/` 保留，未覆盖。
- 中间 type-only 首跑 7 PASS / 1 timeout；不改代码/超时，隔离与整组复核通过。失败日志保留，不把复跑当作完整根因证明。
- 收敛红测：保留 eager 四视图期望先失败；模块准确提示测试 5 PASS / 1 FAIL 后实施。一次验证因“Vitest 失败工厂只执行一次”的假设失败（6 PASS / 1 FAIL），修正为同一拒绝 Promise 的受控持续失败，最终 7/7 PASS；不借 mock 行为证明浏览器缓存机制。

真实 baseline 数据的默认 live 空态，以及切 unknown 后仍 0 标的/回合且 console 无 error，保持为实测局限；不改性质/过滤规则，不把所有 0 归因默认 live，也不作为非零性能通过。全页和财务门槛不借此票关闭。

## Root 最终裁决（仍为候选2/3）

代码与分包收益接受；UI 总验收未完成。C4 的884文件冻结清单无后续源码变化，实际首页9个JS/CSS资源已绑定本地产物hash，与C2净体积完全相同：2,427,780 raw /657,658 gzip9 bytes；相对baseline减少449,044 /148,745 bytes（15.61%/18.45%）。这是资源体积，不是首屏耗时或实际网络传输量。四视图恢复eager，候选1四个retry控件已移除且不可宣称同页重试恢复。完整记录：[FINAL-ACCEPTANCE](../FINAL-ACCEPTANCE.md)、[C4局部审计](../evidence/candidate-04/CONTROL-AUDIT.md)。不继续修改财务或借此任务恢复暂停事项。

## Sol 6.1 Ultra 续验（2/3不变）

两个Sol 6.1 Ultra agent分别只读扫描/方案与独立视觉证据复核，root真实浏览器操作。没有产品、测试或dist改动，无新候选。[root裁决](../evidence/continuation-2026-10-24/ROOT-ACCEPTANCE.md)、[覆盖表](../evidence/continuation-2026-10-24/CONTROL-AUDIT.md)。

- 1440 CSV、Futu XLSX1笔、Tiger PDF2笔月结单核对→预览；1280 PDF核对/预览；实际取消不保存。限定格式/结构PASS，其它券商、展开滚动及所有条件阶段未验证。
- dispatcher真实503→准确提示/输入解锁→关闭提示；实际手动reload后同hash dispatcher/PDF/worker成功；PDF依赖真实hold24.150秒期间可见等待、3输入disabled，释放后实际预览PASS。外部门控不改成功JS，不将人为延迟当性能样本；4393已停止。
- 首页“导入交易”→数据管理→CSV预览PASS；不扩大为首页写入返回全链。1868笔原executions全列missing0/changed0/added0。
- 初始焦点/Tab循环PASS；正常紧凑入口→预览→Esc后BODY **FAIL**，遮罩不关闭但焦点BODY **FAIL**。相关源码与基线一致支持继承缺口推断，不证明基线运行也失败。见[统一诊断/设计](../evidence/continuation-2026-10-24/parser-plan/focus-design.md)。
- root不把共享焦点所有权/四阶段/嵌套drawer重构混入最后一次窄解析器候选，保留open2/3及FAIL。实际pending取消/替换无可达控件，浏览器竞态NOT VERIFIED；不制造新控件、事件或新票绕过。

Task01/04不重做，原财务与Bars仍paused3/3；正常首页和一秒目标不借此次补证关闭。
