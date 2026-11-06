# 02 — 减少重复编码与复制实验

ID: source-reuse-encoding
State: closed
Status: accepted
Assignee: encode_reuse
集成负责人: 主协调者

## Scope / Refs

只在本实验 `encoding/` 下实现和测试，依据 [需求矩阵 E02、E03、E05](../DESIGN-COVERAGE.md) 和 [诊断报告第 7 节](../../source-preparation-profile/reports/approved-01-plain-report.md)。不改产品，不读取业务数据库。浏览器和视觉不适用：仅命令行实验。

## Blocked by

None

## 验收标准与反例

- [x] 与原实现对照，保留完整摘要、输入隔离及篡改、错版、缺页、重复等拒绝语义；记录未覆盖项。
- [x] 独立审查及协调者复核；每轮结果记录，最多三轮。

## 验收证据

首轮独立审查通过，合成 42/42、独立反例 43/43、类型检查通过；真实规模实验已执行。原解析器对重新生成摘要的缺失撤销审计的既有语义边界保留。见 [独立审查](../reviews/encoding-01/REVIEW.md) 和 [实验结论](../reports/real-sample-01.md)。本票接受实验范围，不代表生产接受。
