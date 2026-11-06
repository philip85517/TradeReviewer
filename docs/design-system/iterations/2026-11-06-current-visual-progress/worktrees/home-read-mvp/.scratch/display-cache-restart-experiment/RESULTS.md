# candidate-01 原型验证记录

## 可得出的结论

在固定两条合成成交上，name、localizedName、逐成交accountLabel任一单字段变化时，真实产品readBookVersion读取到的合成成交版本仍是synthetic-display-book/synthetic-epoch/7，十字段factDigest也不变，presentationDigest变化。故仅凭成交版本相同不能证明未来展示缓存可复用。本实验的组合凭据能拒绝旧缓存，显式刷新后返回手工字面预期的新展示，事实投影构建数保持1、展示构建数由1变2。

这是限定原型结论。当前产品启动fresh read，完整source payload已有digest，没有证明当前产品已有跨重启旧名称bug。name使用非空中文/emoji；未把非法空name当真实接口支持。空accountLabel和localizedName→SQL NULL属于合成序列化/缺失语义，真实名称删除接口和优先级待验证。accountLabel按execution ID绑定，测试同账户两条成交可有不同标签。

## 重启与快照证据

最终证据目录results/candidate-01/evidence中的restart-unchanged：父进程84892、child84895；真正重开同一私有库，refresh.reused=true，factBuilds=1、displayBuilds=1，child同一连接changesBefore=0、changesAfter=0、changeDelta=0，返回结果等于重启前。它证明未重复DML构建；不代表零IO、零读扫描或零摘要成本。

restart-changed：关闭后另一连接改为“关闭期间新名称”，child84896先读得到CACHE_STALE；显式refresh后factBuilds=1、displayBuilds=2，旧请求VERSION_CHANGED，新读全为新名称；bookVersion与facts不变。该child changeDelta=5，包含更新展示缓存和manifest，不是未变复用对照。

wal-safe：worker连接在beginRead中已查询源和cache manifest，发送captured并阻塞。另一SQLite连接在WAL中提交源名称/标签变更；源与缓存分两个事务，中间read明确CACHE_STALE。随后refresh提交新展示缓存，才解除worker屏障。旧读事务返回完整旧名称/旧标签/旧localizedName；后续新读旧凭据VERSION_CHANGED，新凭据得到完整新展示。wal-unsafe负例关闭元数据读事务后再等同一屏障，确定性观察到旧metadata和新rows，证明屏障确实跨过另一个连接的提交。

源修改与refresh不是同一事务，本轮未证明它们原子发布。证明的是本原型读取期间保持快照一致，以及中间stale状态明确拒绝；真实产品跨表、跨进程、事务和通知适配仍待验证。

## 原始验证

最终执行时间：2026-10-29T04:27:39.754Z至04:27:40.980Z。Node26.0.0、内置SQLite3.53.0。固定原生Node直接执行cache.test.mjs与restart-snapshot.test.mjs，exit0，16通过、0失败；完整stdout原始duration_ms=1055.251992。run.json记录精确命令、代码前后hash、17个新私有库路径、10份JSON证据来源/复制摘要。测试期间6个mjs文件hash前后相同。

|TDD组|RED通过/失败|GREEN通过/失败|原始duration_ms（RED→GREEN）|证据|
|---|---|---|---|---|
|组合版本逐字段/no-op|0/4|4/0|342.480011→368.685483|red/green-01-version.txt|
|持久缓存及明确拒绝|4/8|12/0|542.730695→497.23273|red/green-02-cache.txt|
|独立进程/双连接WAL|0/4|4/0|799.273334→1048.577697|red/green-03-process-snapshot.txt|
|同child连接DML差值补强|3/1|16/0|1283.228175→1049.333253|red/green-04-child-delta.txt|

前3组是分阶段缺失行为的RED；第4组先要求changesBefore/After/delta，旧worker缺字段失败，再补实现。全部失败原文保留，不作为候选轮次；首次代码冻结为candidate-01，总预算至多3轮。最终整套16项还包括JSON对象键序/空白no-op、连续两次展示刷新、合成源事务rollback不泄露半状态、非财务事实日期和显式合成book版本变化、缺失/非法/旧/foreign凭据、缺失状态、损坏缓存和过期实现身份拒绝。

10份原始JSON为三个字段的版本变化、三个字段刷新、两种重启、两种WAL读；其他拒绝/rollback/no-op等证据在最终stdout及冻结测试断言，不另称逐项JSON。初始factDigest为bc7df306885e79eab33ad6a680b27bd445f6e44b60e70b16d2a6eecf2c8f208a；初始presentationDigest为8b55e4e5813c9594c8d12927ee6bd2ec1a2bbb7e7c8b8935e7db9516d39e2bd7；运行时codeDigest为c6c52d87a6ba88a1b0cb369c4bfa0937bade6dde222d6465fc4fcdd01096e18b。运行时codeDigest覆盖cache.mjs与真实trade-book-version.ts；完整冻结清单另覆盖辅助代码与FACT_KEYS来源，不能把前者当完整构建身份。

prior-freezes-readonly-check.json只读核对既有更新candidate-01、benchmark tool-02代码/支持文件及十字段candidate-02归档共42项，与其冻结hash一致，0差异。未访问正式业务库，未打开旧实验数据；本轮所有库为新合成源，不涉及冻结seed复制。

## 限制和验收状态

机器非独占：Intel i5-1038NG7、8逻辑核、16GiB，测试开始1/5/15分钟load约9.907/6.866/9.774。协调者报告3333、4393已有服务，本轮未操作。上述原始duration仅是测试证据，未运行性能测量，不代表稳定上限或冷启动首次读取延迟。

每次currentVersion/read/refresh都扫描事实并按行读取展示源、计算presentationDigest和缓存摘要。这本身可能昂贵；重启避免重写缓存不等于避免读源、避免hash，也不证明完整首页1秒。初建、复制、产品源读取或大数据性能均未测量。

真实产品输入校验/LocalizedName结构约束、显示优先级、真实写入口版本机制、迁移、跨表/跨进程接线、HTTP/浏览器缓存、完整页面、分页游标、非ASCII排序/搜索、崩溃断电恢复、恶意路径/符号链接/代码替换、财务/Bars/重复导入、真实导入均未验证。本原型只验证指定两行及自建事务；事实字段只校验十字段键集合，没有实现产品全量类型校验。

实现者验证PASS；独立审查、协调者接受均NOT VERIFIED。保持issue open；此记录不能代替独立验收。无UI元素或页面接线，UI/视觉审查范围不适用。
