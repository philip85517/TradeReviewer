# 整理口径异常与现有调用链证据

ID: market-evidence-baseline
Labels: wayfinder:task
State: open
Status: ready-for-agent
Assignee: unassigned
Mode: AFK
Parent: [独立行情数据模块重构决策地图](02-refactor-map.md)

## Question

用当前仓库的源码、已有探测 JSON 和测试 fixture，能证实哪些时间、复权、成交量、持久化及取消行为？哪些结论仍缺完整原始响应或外部文档？

## What to build

本票产出决策依据或取证记录，答案写入独立 resolution comment；不直接实现生产功能。

## Context

此任务只整理当前工作目录内证据，为后续决策提供依据；不修复 adapter，不运行全市场压测，不读写真实交易数据库。已有探测是一次样本，不是本轮在线证明。

证据入口：[相关规格或证据](../../../docs/adr/0005-market-platform-architecture-review.md)。入口是调查依据，不是预定答案。

## Blocked by

无。

## Acceptance

- [ ] 列出事实、推断、未知三栏，逐项链接证据
- [ ] 记录东财美股盘外时间、600519量差及high差、BaoStock已减时的反例
- [ ] 说明单次响应成功/首根摘要不能证明全区间质量
- [ ] 绘出从现有同步入口到原子提交、取消和超时的实际调用关系
- [ ] 把需新增在线取证的问题单列，只有问题明确时才新建 research/task 子票

## Resolution comment

尚未解决。HITL 票须记录用户真实选择；AFK 票须链接事实证据。关闭后在地图添加命名链接与一句摘要。
