# 第二轮候选冻结历史（现已完成run-02，仅实验范围独立PASS）

本文件保留测量前候选记录；独立静态预审通过后，协调者授权run-02，58项脚本检查/42样本PASS，并获[独立验收仅实验范围PASS](INDEPENDENT-REVIEW-02.md)，结果见 [RESULTS-RUN-02.md](RESULTS-RUN-02.md)。冻结时“未测量”的状态保留于快照，以下正文为冻结时历史，不代表当前状态。真实四字段绑定负例的实际路径为C无游标拒绝、B旧游标拒绝；独立验收另以内存SQLite补查C旧游标四类变化拒绝，不计入真实58项。

冻结时间 `2026-10-29T02:43:55.336Z`。执行身份摘要 `b96738ad18fb4f65fb547554ad4d50bb7f8063c18b9109c140303a12f0612e59`，373 个身份条目。9 个当前代码文件、逐文件 SHA 和完整执行身份清单保留在 [archive/candidate-02/SNAPSHOT.json](archive/candidate-02/SNAPSHOT.json)。本候选没有创建 run-02 数据目录或运行任何真实测量；下一步由协调者安排独立审阅和测量窗口。

run-01 原始 JSON、latest 和代码快照保留。首轮独立隔离/数据/分页 PASS，B 重复排序公平性 FAIL；首轮不是最终对照。此文只陈述候选实现和无真实数据库文件的自测，不补写任何第二轮真实性能结果。

|审阅要求|候选实现与证据|准确边界|
|---|---|---|
|B 仅排序一次|`projectStoredFacts` 只按来源遍历顺序投影；`narrowResponse` 筛选后一次 `selectFacts` 排序。合成 case 验证投影无排序、B 恰好一次；真实样本将记录并断言 B=1、A/C=0 的实验 JS 排序次数|不改变或统计产品读取/合同内部排序；A 的对照投影在计时外|
|真实跨账户与跨页证明|`coverageWitnesses` 在独立原始 SQL 有序行中找到同标的跨两个已知账户，输出计数、全局排名、身份摘要；找到第 8n/8n+1 笔同日跨页边界，输出排名、当日笔数、是否同精确时间戳和不同 ID。两项必须存在；跨账户筛选必须超过 8 笔/1 页且恰好两个已知账户|选择值只在内存；真实是否满足尚待 run-02。精确时间戳平手只单列观测，合成 case 已覆盖|
|四项身份拒绝|sourceSha、bookVersionDigest、codeDigest、rules分别变更时C无游标拒绝；每项变更后B路径旧游标拒绝。10项自测中的绑定case通过，真实harness已逐项接入|没有C四种旧游标实测；冻结身份比较不是动态产品失效、签名或认证|
|alias/锁/依赖身份|清单包含本目录顶层代码及 server-only alias/配置/测试，产品读取/合同相关源码，根 package.json/package-lock、node_modules lock，直接声明依赖的实际 package.json 和可解析 Node 入口文件。自测断言必要条目存在|没有散列所有传递依赖的全部文件；清单/校验成本单列，并计入新进程总耗时|
|symlink 边界|访问数据库/结果路径逐次排除现存 symlink；实际 ROOT/OWN/seed 的 realpath 一致，seed 是 regular file；私有目录、results、Vitest cache 的组件预检。合成 symlink 越界路径被拒绝，实际元数据预检通过|不防御预检后的恶意并发路径替换；不据此宣称安全沙箱|
|真实缺少 null/withdrawn 反例|真实 harness 将分别记录 active null 账户数、withdrawn 状态行数和实际缺少的 case；内存样本保留活动 null 账户，排除 withdrawn-null 行；投影 case 排除非 displayExecutionIds 的行|内存 SQL 是实验谓词反例，不是产品撤销操作或生命周期验收；真实覆盖与合成覆盖分开|
|严格日期与越界游标|不存在的日历日/非闰年 2 月 29 日拒绝，2024-02-29 接受；带游标 offset 等于或大于总数时 B/C 都拒绝|只修改实验接口；日期仍是存储时间前10字符标签，排序仍是字符串二进制顺序|
|摘要校验范围|每读比较 binding；响应非密钥摘要检查当前 envelope 自洽。合成测试主动改 stored row_json，证实当前 wire 校验可通过，记录为限制|每读不重算全部 factsDigest/summaryDigest，不提供存储篡改检测；准备摘要、全页比较仅是当次一致性证据|
|运行上限与失败证据|harness 10 分钟、launcher 15 分钟超时；保存阶段及每个样本后进度；真实最多3轮，每轮新目录，不覆盖首轮|不立即重跑；失败只输出安全阶段，不回显产品异常/真实行|

最终无真实库验证命令（workdir `/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview`）：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test .scratch/real-data-fact-experiment/core.test.mjs .scratch/real-data-fact-experiment/runtime.test.mjs
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/real-data-fact-experiment/run.mjs --check
```

结果：10 tests，10 PASS，0 FAIL，0 skipped；harness TypeScript syntax PASS。单元测试用内存 SQLite；路径测试只在专属目录建临时空目录/symlink 后清理，读取真实路径的元数据及代码/依赖身份文件，没有打开真实数据库文件。语法命令只做内存运行时版本检查和 TS 转换。先前 RED 过程保留于 [RUN-HISTORY.md](RUN-HISTORY.md)，没有因自测重复真实测量。

授权后第二轮使用与首轮同一完整测量命令、默认两种工作负载/每路线7样本，A/B/C 来源、合同、范围、轮换及字节口径不变；变化是修正 B 排序及加强身份/覆盖/边界记录。命令在 [README.md](README.md)；候选冻结清单用于审核版本，独立审阅通过前不执行。

财务 P1/F07、Bars、重复导入、动态产品失效、真实导入/修订、真实财务资格、HTTP/浏览器、完整首屏与全部控件、并发/断电恢复继续 NOT VERIFIED；没有产品代码或业务数据写入，没有 wayfinder 修改、提交或推送。无 UI/布局/前端接线，视觉和预览验收按范围不适用。
