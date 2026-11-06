# 导入确认前的重复候选和数量

ID: DBB-DUP-PREVIEW  
State: open  
Status: blocked — 第 5/5 候选独立验收 FAIL，停止该原问题的实现迭代
Assignee: /root/confirmation_preview  
集成负责人: /root  
Blocked by: 日期精度丢失、完整账户号码进入公开数据、类型检查失败；完整回归和桌面验收也未通过或未验证。

## Scope / Refs

现有普通导入预览不再包括库中重复，但确认框仍称原始预估为“已跳过”。例：库内已有 A，用户再导入 A；预期确认前显示可核实的重复候选和数量，确认后不增加成交、显示实际核对重复 1，返回和重载仍可核对；当前预览可能显示“0 笔已跳过”。重复对数不足以证明本次导入被跳过，不改写原始预估证据，也不从不充分证据推算确定数量。

已确认 [多券商导入设计](../../../docs/superpowers/specs/2026-07-29-multi-broker-import-metadata-design.md) 第 271、277 行及 [A 股对账规范](../../../docs/specs/2026-09-13-a-share-page-import-reconciliation.md) 第 11、30、35、50、54、68 行；[覆盖矩阵](../DESIGN-COVERAGE.md) DUP-PREVIEW-COUNT / DUP-CONFIRM / DUP-HISTORY；[只读诊断](../evidence/import-history-duplicates-2026-10-27/candidate4/independent/p03-contract-analysis.md)。无独立画板编号，沿用既有确认框视觉规范；desktop 1440×900、1280×800 的对应状态须独立比较。

## 验收标准

- [ ] 已批准页面公开接缝先 RED：普通重复文件上传→服务器核对，正确提示重复候选；保存后实际重复 1、无重复新增、返回／reload 仍可读；保留原始预估与旧失败记录。
- [ ] 审核加载、失败／重试、冲突待选择、取消及零重复不冒充已完成，不破坏资料或交互。
- [ ] 按 frontend-control-audit 登记受影响控件和状态，root 负责隔离库真实桌面持久化旅程，独立 Luna 负责同状态视觉；失败及未验证分别记录。

## 派发与轮次

先只读核对服务器计划公开合同和数据链、冻结方案与最小测试；不并发修改导入历史投影 owner 文件。明确必要文件范围后按 TDD 单一垂直切片实施；如必须改共享后端先回报 root。财务、Bars 及已达 5/5 的任务继续暂停。此为本轮 P03/P04 用户可见回归的受影响 UI 切片，归导入历史原问题候选 5/5 的总验收，不重置原问题轮次。

## 第 5/5 轮独立裁定

**FAIL，停止迭代。** [Luna 独立报告](../evidence/import-confirm-duplicate-preview/INDEPENDENT-CANDIDATE-REVIEW.md)核对候选 33 项哈希一致，有限范围内的重复数来源、失效状态和隔离 SQLite 保存／回读有正向证据，但发现两个阻断：

1. 来源只提供日期时，系统把用于排序的时间值显示成具体到秒的成交时间；预期明确显示“仅日期”，不虚构成交时刻。
2. 富途完整账户号码进入重复候选公开接口；预期供审查的账户信息脱敏，不暴露完整号码。

root 独立类型检查另在 `trade-review-workspace.import-flow.test.tsx:1003` 发现 `body` 为 `unknown`（日志 `/private/tmp/tradereview-tdd-final-types-20261027.log`）。完整页面及 harness 回归 59 PASS / 5 FAIL；真实浏览器、独立同态视觉及完整页面一秒门 NOT VERIFIED。[实现和失败清单](../evidence/import-confirm-duplicate-preview/IMPLEMENTATION-RESULT.md)。不得将局部测试通过当作此项接受，也不得另命名重置原问题的五轮记录。
