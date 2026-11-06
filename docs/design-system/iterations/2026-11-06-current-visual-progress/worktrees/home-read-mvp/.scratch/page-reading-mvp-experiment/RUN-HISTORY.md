# 运行历史：失败也保留

## Round 1 — FAIL（不可用测量，不作结果）

2026-10-29（本地时间）。初始实现运行期间，实验实现者修改了脚本，加入持久化摘要表。父进程已经加载旧脚本并建立旧 schema；其随后启动的新 Node 进程加载到新脚本，按新 schema 读取旧实验数据库。

保留的关键错误：

```text
PASS synthetic 1867: 14 correctness checks; 9 samples/route
AssertionError [ERR_ASSERTION]:
Error: no such table: prepared_summary
  at readPrepared (.../experiment.mjs)
  at restarted (.../experiment.mjs)
1 !== 0
```

根因：运行期间修改实验脚本导致父子进程版本不一致。不是产品错误，也不是一个有效的“重启恢复通过”样本。该轮未完成，未保留为正式性能结果；finally 清理了合成临时数据库。其 stdout 中的局部 PASS 不代表整个运行通过。

修正：完成摘要缓存 schema 和独立正确性交叉核对后，冻结脚本，从全新独立合成库完整重跑；后续不修改该轮执行中的脚本。未调节参数或更换数据以取得更好数字。

## Round 2 — PASS（原有自测边界；独立复核发现覆盖缺口）

固定脚本 SHA256：`d1ca6181c4e4ecd1699a7ad4d6fd38482388f85a95bd6db3b79fc6ab7cd2cb98`。

原始结果：`results/2026-10-29-run-02.json`，记录时间 `2026-10-28T16:33:33.086Z`（北京时间 2026-10-29 00:33:33）。

```text
PASS synthetic 1867: 14 correctness checks; 9 samples/route
PASS synthetic 20000: 14 correctness checks; 9 samples/route
exit_code=0
```

两组都从新库创建、准备、读取、全页核对、合成状态变更、注入发布失败、恢复，随后启动新 Node 进程读取同一库；响应摘要值与父进程一致。每组三主路线及一个附加筛选路线各测 9 次。数据库已清理；没有读取真实交易副本。

协调者独立复核后指出：benchmark精确组合缺少逐页断言、回滚只比对行数/指针、full/narrow缺少剥除来源后的等价断言，以及重启rebuilds=0是硬编码。这些是验证覆盖与表述缺口，本轮原始值继续保留，不因后续补测删除。

第三轮将一次性增加精确组合的独立JS与逐页校验、全体旧行/摘要/发布指针稳定digest对比、fullSource剥除后的响应等价断言，并用实际prepare函数调用计数替代硬编码。按照协调者要求，第三轮失败则停止，不再重跑。


## Round 3 — PASS（独立复核要求的最后一轮）

最终脚本SHA256：`eaeac44724a44124114494aeb7723da13a655f66c4ccdfe85b76db5212dae31c`。记录时间：`2026-10-28T16:38:16.851Z`。原始值：`results/2026-10-29-run-03.json`。

两组各15项检查、各路线9次（共72次）、两个新Node进程读取均通过，exit_code=0。精确benchmark组合、全体旧行/摘要/指针digest、full剥除fullSource后的响应等价均已加入并实际执行。prepare函数调用计数插桩在两个子进程内均观测为0，替代第二轮硬编码字段。最终脚本冻结，不再修改或进行第四轮。

当前仅实验实现自测通过，协调者独立接受尚待签署；原wayfinder和暂停范围不变。
