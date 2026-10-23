# P2-A canonical sweep 后正式三冷样本：性能目标未达

2026-10-23 03:04 CST。P2 仍 0/3，未 implementation-ready，UI NOT VERIFIED。仅测受控显式 live 原始成交管线，不读写数据库，不将旧 1866 unknown 成交改为 live。

## 固定版本、命令与结果

Node `v26.0.0`，可执行路径 `/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`。root 已确认本窗口不跑重 CPU，integration 已通知避让长回归。每个样本独立 Node/Vitest 进程及全新 prepared handle，未修改规模或重试选取最好值。

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/homepage-v25-implementation/evidence/P2/data/p2-a/run-performance-v3.mjs 1 rounds
# 同一命令样本参数依次为 2、3，均完整保留 JSON/log/exit。
```

|样本|prepare ms|batch ms|cold ms（目标≤2000）|repeat ms（目标≤200）|365 独立数值 oracle|
|---|---:|---:|---:|---:|---|
|1|426.13|2519.37|2945.84 FAIL|1.21 PASS|PASS|
|2|409.81|2528.12|2938.31 FAIL|1.97 PASS|PASS|
|3|401.94|2510.94|2913.29 FAIL|1.51 PASS|PASS|

每次真实 `buildInstrumentTradeSummaries → buildTradeLibraryEntries → prepare → batch`：1866 fills、365 endpoints、1 instrument、252 合法 US sessions；upstream 约97ms单独记录，不混入 cold。每个日点以原始成交截止数量的闭式数值独立验证：成交交替 buy1@100/sell1@101、fee0，`net=floor(n/2)+(n%2?10:0)`，期末净933，独立 currentMV0。源中未来成交不进入之前日点。

真实 instrumentation：canonical prepare1次、ordinary sweep1次、transitions1866、checkpoint queries366、legacy完整replay0次；repeat额外canonical查询0次。说明完整 builder 的365倍重放已消除，但批量外围成本仍超过工程目标。

缓存真实 live inspect：约66,624,318估计字节（低于64MiB=67,108,864），11 memo entries、357 LRU evictions、1 batch；repeat hit1。source估计4,162,790 bytes、index估计5,129,564 bytes分列。样本1 heap：prepare前31.23MB、prepare后33.33MB、cold后78.03MB、repeat/序列化后82.48MB；heap不是memo估计的等价量。输出JSON27,701,102 bytes，序列化约100ms，另外记录，不包含在cold。

原始文件为 `benchmark-v3-rounds-{1,2,3}.{json,log}` 及对应 `-exit.json`；三次 exit1均为cold阈值断言，数值及repeat断言通过。不得把这些失败替换为后续绿色测量。

独立长前缀压力（非正式三样本替代）：`run-performance-v3.mjs diagnostic long-prefix`，1866单边buy、365点，cold3175.68ms、repeat1.50ms，365数值均PASS，期末net18660/currentMV205260；原始 `benchmark-v3-long-prefix-diagnostic.*` 保留。

## 有限因果 profile

`performance-v3-profile.test.ts/config.ts` 复制相同受控fixture，仅对batch用Node inspector采样，标签diagnostic-profile，不算正式性能成绩。原始 `.cpuprofile`、summary及 `28-diagnostic-profile.log` 已保存。

采样热点：`ProjectionMemo.set`的完整JSON序列化约402个self samples；`visibleFeeFacts`/`validKnowledge`路径约679；calendar `marketTimeParts`约246；`indexedQuote`约38。canonical finalize只有少量。采样证明下个最小调整应在F/P2外围，而非扩canonical成本/平均成本公式。

第一单一假设：每个state入memo都JSON.stringify完整执行引用，重复遍历/序列化相同source，虽源对象实际共享仍按每个前缀重复估计，造成成本及无效LRU抖动。下一候选只替换memo保留量估算为可复核的保守结构共享估算，source/index与memo分列；不得削减任何输出字段/端点，不能低报64MiB。

若该候选仍未达标，才独立RED验证fee fact日期/knowledge反复解析的数值索引或session缓存；incurred与knowledge、month边界/unknown和晚refund行为必须原样保持。root已限定最多两个有因诊断候选，仍未达则停止提交架构讨论，不循环碰绿。

## 此测量源文件 SHA256

```text
F source       f9112e208617262be1699aff3c9bbcb5f49cdcfa45f2ccf64aa493f33156bdd2
F test         e15a49894f525d0de904c50e888245e864dfe04b805cfd755ea05688f80fcf53
canonical      f46564c0ac473d78859f31c057ade82c3dc78852de8f55cfb04eee6e46927126
canonical test 21ed853ab8f64526c8faea4b369eda2f70328fb805bdea98fa87e8f801732ea9
```

F原100测试字节前缀保持；canonical原33测试前缀保持。此报告记录失败，不表示root接受，也不授权series/UI。
