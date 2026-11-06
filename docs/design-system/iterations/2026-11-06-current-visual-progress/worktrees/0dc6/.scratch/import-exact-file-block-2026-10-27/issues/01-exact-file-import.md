# 01 — 成功同文件拦截与未完成重试

ID: EXACT-01
State: open
Status: acceptance-failed
Assignee: unassigned
集成负责人: root

## Scope / What to build

同字节成功导入后在确认前及提交事务阻止再次导入；未完整导入保留重试；不同文件成交对账沿用现有规则。候选 3 补齐合法非成交排除、monthly 缺口、无成交完整材料与旧 XLSX 自动适配边界。不改财务/Bars、不写业务库、不提交。

## Refs

- [设计与验收矩阵](../DESIGN-COVERAGE.md)，EXACT-1–6；本任务没有独立 element ID/画板，沿用现有导入弹窗标准。
- [候选 3 报告](../CANDIDATE-03-IMPLEMENTATION.md)、[候选内容哈希](../CANDIDATE-03-CANDIDATE-HASHES.json)。
- [项目工作流](../../../docs/agents/development-workflow.md)、[前端控件审计](../../../docs/agents/frontend-control-audit.md)。

## Blocked by

真实桌面验收受 Codex 内置浏览器对本地地址的自动安全策略阻断；完整相关文件的 95% 分支覆盖尚未达到。详见 [补充验收](../ACCEPTANCE-RESUME-2026-10-28.md)。

## 验收标准与反例

- [x] 强成功回执、改名重复、取消/事务回滚、并发、同请求恢复和部分重叠通过公开隔离 SQLite/API 测试：[GREEN-09.log](../GREEN-09.log)。
- [x] 正常非成交可成功；unknown/blocked/monthly gap 不记强成功；无成交只有保存完整 material 才成功；旧 XLSX 自动 history adapter 不误作显式 revision：[GREEN-09.log](../GREEN-09.log)。
- [x] 相关 parser/material 回归及类型检查：[解析回归](../PARSER-REGRESSION-03.log)、[类型检查](../TYPECHECK-06.log)。
- [ ] root 独立真实浏览器上传、取消、确认、返回/reload 和同态视觉；本地浏览器安全策略当前拒绝访问，保留 NOT VERIFIED。
- [ ] 受影响控件局部登记及对应最终哈希的覆盖表、完整集成验收；未完成不能关闭本票。

## 验收证据

候选 3 自动化 74 核心 + 257 解析/材料 pass（另 2 skipped），UI 定向 5 pass/42 skipped；类型检查 exit 0。真实浏览器与独立视觉 NOT VERIFIED；整仓测试由 root 集中执行。协调者接受：待填写。

## 历史

- 2026-10-28：保留候选 1/2、原 issue 15/16 五轮历史及本轮 RED；恢复并冻结候选 3，保持 open / implementation-ready。

- 2026-10-28：root 对候选 3 独立审查发现 TradingView CSV 静默丢异常行，重新打开完成性缺陷；候选 3 冻结原件保留。候选 4 统一扫描另实证招商新旧布局、Tiger 和富途 PDF 的校验前丢成交，正在回归与冻结。RED-08、RED-09 及首次 Tiger 修复失败 GREEN-11 均保留。

- 2026-10-28：第四轮独立验收 FAIL，见 [验收记录](../ACCEPTANCE-ROUND-4.md)。现代招商正常页码误判与损坏成交漏行已验证到隔离数据库，Tiger 正常汇总误判、富途 PDF 多字段损坏漏行已独立复现。下一次冻结为第五轮；超过上限不继续该问题。

- 2026-10-28 01:21:42：第五轮最终候选冻结30文件，见 [第5轮报告](../CANDIDATE-05-IMPLEMENTATION.md) 与 [哈希](../CANDIDATE-05-CANDIDATE-HASHES.json)。最终相关6文件188通过、类型检查exit0；源文件停止修改。独立接受和真实UI/视觉仍待root；若第5轮失败按上限停止，不继续第6轮。

- 2026-10-28：第 5 轮局部自动化和真实 HTTP/隔离数据库链路通过，独立 247 个用例 PASS；相关 10 文件整体分支覆盖 64.64% 未达 95%，浏览器和视觉 NOT VERIFIED。保持 open / acceptance-failed；按五轮约束暂停该问题的进一步实现，见 [最终验收](../ACCEPTANCE-ROUND-5.md)。

- 2026-10-28 用户确认继续补单测与浏览器验收；测试和验收均使用本地隔离库，不改共享已部署数据库；保持第 1–5 轮历史及原有失败。此授权针对测试与验收，不自动重开已达上限的生产代码修复。root 协调，coverage_tests、ui_tests、storage_tests 并行负责不重叠测试。

- 2026-10-28：补充单测及独立复验完成，18 文件 412 例通过，类型检查通过；10 个完整源码文件分支覆盖 69.32%，未达 95%。用户确认尚未更改浏览器权限，Codex 内置浏览器此前的安全策略拒绝尚未解除，真实桌面及视觉 NOT VERIFIED；整体验收继续失败，见 [记录](../ACCEPTANCE-RESUME-2026-10-28.md)。本次未修改生产源码，不重置五轮上限。
