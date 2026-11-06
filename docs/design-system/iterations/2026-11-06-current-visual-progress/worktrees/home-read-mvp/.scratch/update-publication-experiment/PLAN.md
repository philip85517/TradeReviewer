# 非财务更新实验执行计划

**Goal:** 在隔离实验源模型验证同库源/投影事务发布、旧游标、失败回滚与增量/全量等价。
**Architecture:** 复用冻结非财务读取合同，新增同库 source_facts/version，比较 full 和受影响内容更新。WAL 双连接与线程屏障独立观察。
**Spec:** DESIGN.md。只写本目录与私有 .data/update-publication-worker；Node26/SQLite3.53；不跑产品全量套件（协调者集中；本实验无产品修改，遵从派发轻量边界）。

1. core.test.mjs 先写真实 SQLite 行为测试；core.mjs 暂空实现，运行保存 RED；再实现 createStore/publish/read/readInsideSnapshot/sourceRows，验证 GREEN。
2. concurrency.test.mjs 先写真实 worker/WAL 验证，保存 RED；实现 reader-worker.mjs + concurrency.mjs，覆盖真实重叠事务及跨提交无快照负例；GREEN。
3. runtime.test.mjs 先写私有路径拒绝与隔离输入校验测试；实现 runtime.mjs，保存 RED/GREEN。run.mjs 仅 --check / --light，默认拒绝基准，真实基数单次成本与等价分开记录。
4. 轻量验证一次，保存源前后hash、所有原始计时与失败。最多3候选轮，冻结摘要与可运行命令送协调者；等独立预审，不自行跑耗时重复基准。

Review focus: 旧新分组失效；null与空组；成功后旧游标而失败后仍有效；reader源/投影混合快照；源模型与真实产品边界；主/WAL/SHM与CPU测量公平口径。每项由上述行为测试与真实基数 oracle 覆盖。不得把实现自测写成独立接受。

2026-10-29 执行状态：步骤1–4的实现者部分已完成；14/14 TDD、10文件语法检查与一次候选01轻量验证PASS。冻结版本见SNAPSHOT.json；独立预审与最终接受等待协调者，耗时基准未授权。本计划没有扩展为真实导入任务。
