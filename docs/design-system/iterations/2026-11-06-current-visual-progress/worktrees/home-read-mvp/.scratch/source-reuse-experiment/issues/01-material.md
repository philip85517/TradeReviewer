# 01 — 分页复用来源材料实验

ID: source-reuse-material
State: closed
Status: accepted
Assignee: page_material
集成负责人: 主协调者

## Scope / Refs

只在本实验的 `material/` 下实现和测试单次读取跨页复用，依据 [需求矩阵 E01、E03、E05](../DESIGN-COVERAGE.md) 和 [诊断报告第 7 节](../../source-preparation-profile/reports/approved-01-plain-report.md)。不改产品，不读取业务数据库。浏览器和视觉不适用：仅命令行实验。

## Blocked by

None

## 验收标准与反例

- [x] 合成多页对照保留原合同、摘要、来源缺失、撤销和历史语义，记录关键反例和未覆盖项。
- [x] 独立审查及协调者复核；每轮结果记录，最多三轮。

## 验收证据

首轮独立审查限首页实验入口通过，9/9 合成测试通过；真实规模实验已执行。底层可选 getter 可被错误传入旧 context，导致当前损坏来源绕过解析，**正式实现前必须修复**。见 [独立审查](../reviews/material-01/REPORT.md) 和 [实验结论](../reports/real-sample-01.md)。本票接受实验范围，不代表生产接受。
