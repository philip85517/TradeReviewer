# 03 — 既有全量回归与首页阻塞（保留）

State: open
Status: deferred-out-of-scope
Assignee: root

本次仅优先解决市场字段，未授权顺带修改 Q02 规则或恢复财务/Bars。

- 全量回归：366 文件，20 文件失败；215 失败、4399 通过、6 跳过。
- 将本次修改前的 statement-evidence.ts 通过 Vite pre-transform 注入失败文件重跑：20 文件、215 同名失败全部复现，无仅当前版本失败；说明这些观测到的失败不由本次解析器修复引入，不代表项目已健康。
- 全量 TypeScript：8 个 Recall 测试既有类型错误；该文件 SHA 与此前记录相同。
- 桌面首页仍显示“读取已超时，新范围未应用。”；真实 source HTTP 为 1254.347ms，不满足 ≤1 秒目标。
- Q02 缺口从 231 降为 228；106 条缺乏明确证券身份的辅助事件未盲填，须继续分离账户级事件与证券级事件的业务规则。
- 财务 P1/F07 与 Bars：仍保持原 3/3 FAIL 暂停，不另开同义票规避上限。

证据：[失败对比](../evidence/REGRESSION-COMPARISON.json)、[完整失败清单](../evidence/FULL-FAILURE-INVENTORY.json)、[最终验收](../FINAL-ACCEPTANCE.md)。本票仅记录，不计为已恢复的实现候选。
