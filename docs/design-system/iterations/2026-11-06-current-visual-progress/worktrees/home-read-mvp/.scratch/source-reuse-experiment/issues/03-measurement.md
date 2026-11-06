# 03 — 真实规模隔离对照与结论

ID: source-reuse-measurement
State: closed
Status: accepted
Assignee: 主协调者
集成负责人: 主协调者

## Scope / Refs

依据 [需求矩阵 E04、E05](../DESIGN-COVERAGE.md)，在候选通过独立审查后，使用固定来源的只读私有副本进行对照。报告限制，不声称完整页面一秒达标。浏览器及视觉不适用：仅测量来源与解析调用。

## Blocked by

- [01 — 分页复用来源材料实验](01-material.md)（仅对该候选的测量）
- [02 — 减少重复编码与复制实验](02-encoding.md)（仅对该候选的测量）

## 验收标准与反例

- [x] 受保护副本、交替样本、输入前后身份和输出完整语义均记录；输入变化或合同不一致应失败。
- [x] 说明耗时边界、环境及未验证项，审查结果并更新总实验票。

## 验收证据

独立工具审查 15/15 通过，固定代码快照 `027df72fa68a1bbd53f63a57098229ce475ec2bbf0a8bde3fd0e6e6cd13416d8`；12 样本、各三对执行成功，输出一致，隔离样本和私有副本前后未变化。预热后来源＋解析仍为 6.63～8.26 秒，不代表整页一秒验收。见 [实验结论](../reports/real-sample-01.md)、[测量器审查](../reviews/measurement-01/REPORT.md)、[原始结果](../measurement/results/approved-01/result.json)。测量工具审查报告人工核验 SHA `a39de84e5a7a60b57404b229fc713c588e384e161222d4e6c20b758fdc15f338`，不在自动快照内。

独立结果审计：见 [逐样本复核](../reviews/real-results-01/REPORT.md)，仅对数据审计 PASS。
