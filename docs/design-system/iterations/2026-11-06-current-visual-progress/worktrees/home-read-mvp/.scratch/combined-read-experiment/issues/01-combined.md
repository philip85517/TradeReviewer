# 01 — 成交与展示信息的组合读取原型

ID: combined-read-contract
State: closed
Status: accepted-experiment-scope
Assignee: integrated_worker
集成负责人: 主协调者

## Scope / Refs
限定实验目录，先合成数据库验证 [C01–C04](../DESIGN-COVERAGE.md)，评估现有实验的组合契约。无真实业务数据库、产品代码、UI；财务、Bars、重复导入暂停。已有实验只读，不覆盖旧证据。

## Blocked by
None

## 验收标准与反例
- [x] 名称、逐笔标签变化不改变成交版本时，旧内容拒绝或刷新后可见新值；来源、展示、游标与分页保持一致。
- [x] 历史新增、跨组修订及旧游标，失败/过期写入、独立进程重启的合成链路有证据。
- [x] 测试先行，Luna 独立审查及协调者验收；首轮合成读取范围通过，最多三轮。

## 验收证据
首轮冻结 [SNAPSHOT](../prototype/SNAPSHOT.json)；协调者独立重跑核心和运行时测试 20/20 通过。Luna 独立合成验收 10/10 通过，详见 [审查](../reviews/combined-01/REVIEW.md)。此结论仅限合成数据下 C01–C04 的读取和单写入者更新行为，产品数据版本接线及 C05 真实规模未验证。并发展示写入可能丢失更新，见 [问题 03](03-display-concurrency.md)；单写入者真实规模读取实验可以继续。
