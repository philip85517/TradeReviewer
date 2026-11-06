# 冻结真实副本：非财务成交事实读取实验

本目录只研究既有首页来源读取的重复工作、响应体大小与持久化非财务投影。它不是产品改动、财务修复或完整 MVP 验收。协调者负责独立接受；本 worker 不更改 wayfinder 票，不提交、不推送。

## 冻结输入与写入范围

冻结输入为 `.data/mvp-baseline-20261029/seed.sqlite`，SHA256 `176beaee3afe356984a3407f3ee99d276dd25862e2edc284eceafbbb9b6993e6`。只以只读文件句柄校验并复制到 `.data/mvp-baseline-20261029/fact-worker/run-NN/source.sqlite`，再次核对相同 SHA。为避免 SQLite 在 seed 同目录创建 WAL/SHM，不以 SQLite 直接打开 seed。实际来源读取连接只打开专属源副本，使用 `DatabaseSync(...,{readOnly:true})` 和 `PRAGMA query_only=on`，设置显式 `TRADEREVIEW_DB_PATH`；运行结束再次校验输入副本与 seed 字节不变。不读取 runtime.json，不打开正式业务库。

代码与脱敏结果只写本目录；数据库、原始源副本和含敏感行的预备投影只写专属 `fact-worker/run-NN`。不转储真实行到报告或终端，错误详情不回显，只记阶段和安全分类；所有账户、标的、成交 ID、筛选值只用于内存比较或专属数据库。证据文件仅记计数、摘要、耗时、字节和代码清单。数据库不由脚本自动删除，便于独立复核；只可清理本 worker 所有路径。

## 可复现命令

运行环境固定 Node 26.0.0 / SQLite 3.53.0。命令均在当前 worktree 根目录执行：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test .scratch/real-data-fact-experiment/core.test.mjs .scratch/real-data-fact-experiment/runtime.test.mjs
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/real-data-fact-experiment/run.mjs --check
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --expose-gc .scratch/real-data-fact-experiment/run.mjs --measure
```

`--check` 仅进行 TypeScript 语法转换，不打开数据文件。`--measure` 默认每路线每工作负载 7 次；可设 `FACT_REPEATS=3..15`，实际值写入证据。每次新建 run-NN，最多三轮，保留失败。不在脚本执行期间改代码。Vitest 使用独立配置、Node 环境、单 worker、私有 cacheDir 与 `--configLoader native`；产品 `server-only` 只在实验 harness 中 alias 到空模块。

启动测量前，协调者必须协调停止其他服务/测量，避免竞争；2026-10-29 已收到协调者“桌面服务已关闭，可以运行隔离性能实验”的指令。未启动 HTTP 服务。完整命令、阶段、原始值和失败写入 `results/run-NN.json`；`latest.json` 指向最近一轮的内容。

run-02已在第二轮独立静态预审通过、协调者重新授权后完成：58项脚本检查PASS、42个样本，331.961秒；[独立验收仅实验范围PASS](INDEPENDENT-REVIEW-02.md)。自测仅用内存SQLite，路径预检只读取文件元数据及代码/依赖文件，不读取真实数据内容。当前结果见 [RESULTS-RUN-02.md](RESULTS-RUN-02.md)，不再启动额外测量。

## A/B/C 对照与准确口径

|路线|实际执行|响应与计时边界|
|---|---|---|
|A|调用产品 `readHomepageStoredCollection`，完整 JSON 编码/本地解码，再调用产品 `parseHomepageStoredCollection`|真实完整来源包；包含现有读取、嵌套整理、摘要及合同校验。用于对照的非财务投影在计时外提取，不额外声称财务资格|
|B|同一产品读取函数与完整合同校验，再无排序提取非财务事实、筛选、仅一次实验排序、计数、取当前页|只将摘要与一页事实 JSON 编码/本地解码，并执行实验窄合同校验；计数器断言每个计时样本恰好一次实验排序；不统计或改变产品内部排序|
|C|首次准备仍调用同一产品读取及校验，持久化非财务事实、all/单账户/单市场摘要及绑定元数据|之后只查预备表、生成窄响应并编码/本地解码和校验；组合筛选摘要执行轻量表 SQL 聚合，不是所有组合都预计算|

A/B/C 共享冻结来源字节和同一非财务合同。A 完整包不随实验筛选缩小；其相应摘要/分页在计时外对照。B/C 的窄响应逐页 deep-content digest 相同。预备绑定含冻结文件 SHA、产品 bookVersion 摘要、实验规则版本和读取/实验代码摘要。**绑定只适用于这份冻结文件及本实验规则，启动和结束的 SHA 检查不能冒充动态产品失效机制。** 没有动态写入、真实导入/修订、源版本变化更新或生产通用缓存策略。

事实字段仅为 `id,instrumentId,accountId,market,symbol,side,executedAt,tradeNature,simulationRunId,importBatchId`，数量/价格/费用/金额/盈亏/持仓/回合/材料均不进入 C。活动事实排除 `execution_fact_states.state='withdrawn'`。ID 是成交身份，计数不是持仓或回合数。null 原样保留；accountId/tradeNature/simulationRunId/importBatchId 各自单列缺失计数，缺少 simulationRunId 不被解释为异常。空字符串不被改为 null 或零。

范围先筛选再排序、计数和分页；每页默认 8 笔。账户支持显式 null 与空集合，市场支持集合，symbol 使用 JS 小写子串。日期是存储 `executedAt` 字符串前 10 字符的含端点日期标签，**不代表市场时区、平仓日期、练习日期或财务期间归属**。排序明确为字符串 `executedAt DESC,id ASC`、二进制顺序，**不声称是混合偏移时间戳的绝对时间排序**。游标绑定源/代码/规则、完整筛选、排序和页大小；没有旧快照保留。

实验筛选合同拒绝不存在的日历日期（如 2 月 30 日）及非闰年 2 月 29 日。带游标的 offset 必须小于当前完整范围总数；offset 等于或超过总数拒绝，而无游标的空范围可以返回空第一页。这只修正本目录实验合同，没有改产品日期或游标接口。

路线按A/B/C、B/C/A、C/A/B轮换，避免始终最后读取C；没有随机化、独占机器或OS冷缓存。仅在worker确实暴露GC时才在计时前调用，是否暴露写入证据。初次A、首次准备、准备后首次C、checkpoint、新进程C单列。p50/p95为nearest rank，7次时p95为最大样本。CPU为进程user+system，但分别通过两次cpuUsage调用取值，时刻存在一次函数调用差异，只作近似值；RSS增量不是各路线独立峰值，整体高水位单列。空间同时记主文件、WAL、SHM；准备总时间和checkpoint分列。字节为未压缩本地UTF-8 JSON，含本地解析，没有HTTP/网络/浏览器。

## 正确性与失败边界

产品来源提取的全量非财务事实对照独立原始 SQL；all、逐账户、逐市场、空集合、跨账户、期间边界、老成交 symbol 搜索及组合范围完整翻页，逐页核对 B/C 内容、全量有序 ID、无重复、完整摘要与各项 null 计数；每页 8 改为 17 不改总数。第二轮候选增加：真实同标的跨两个已知账户的计数/排名与摘要见证、全量排序第 8n/8n+1 笔同日跨页见证、跨账户范围必须超过一页且恰好两个已知账户。选择值只留内存，结果只输出脱敏计数/排名/摘要。

分别测试 sourceSha、bookVersionDigest、codeDigest、rules 变化：C不传游标时4项拒绝；B传旧游标时4项拒绝，不能声称C的4种旧游标变化已实测。另有C游标页大小变化，合成范围变化/非法日期/越界游标/窄 JSON 篡改，以及真实发布前失败回滚。run-02真实null账户0、withdrawn状态行0；这两类反例只由少量内存合成 case 覆盖，不算真实来源生命周期验收。合成 withdrawn case 验证实验 SQL 排除谓词和活动投影，不声称产品撤销流程通过。失败注入只改实验预备表。

C 每次读取比较存储 binding，但**不重新计算全部 factsDigest 或 summaryDigest**。响应 `payloadDigest` 是当前返回内容的非密钥摘要，只能验证这份 envelope 自洽，不能证明存储内容未被修改或提供认证；合成测试明确演示存储 row_json 改动可以通过当前 wire 校验。准备时摘要及运行中全页对照只提供当次一致性证据。

执行身份包含产品读取/合同源码、本目录顶层代码（含 server-only alias、配置、测试）、根 package.json/lockfile、node_modules lockfile、所有直接声明依赖的实际 package.json 与可解析 Node 入口文件；不散列每个传递依赖的全部字节。启动代码清单计算时间另记 `identityManifestMs`，重启 `identityCheckMs` 单列且包含在进程总耗时。路径访问会预检实际 root/seed/私有目录、结果与 Vitest cache 的现存组件无 symlink，结果和数据库路径也逐次检查；不防御检查后恶意并发替换路径的竞态。

新 Node 进程打开同一 C 数据库并比较默认第一页完整响应摘要，观测准备函数调用数为 0，不导入产品来源模块；进程启动＋身份检查＋打开＋读取＋退出与进程内身份检查、打开、首次读分列。它不是断电恢复、并发发布或动态更新验收。

财务 P1/F07、Bars、重复导入、真实财务资格、完整页面及全部控件、完整首屏一秒、真实导入/修订后首开、行情/FX、浏览器、追溯详情/导出、并发竞争和断电恢复均 **NOT VERIFIED**，没有恢复任何暂停任务。CLI 无 UI、控件、布局或产品数据接线修改，因此前端控件/视觉验收与预览服务不适用。

首轮脚本47项PASS；独立验收隔离/数据/分页PASS，B重复排序公平性FAIL，首轮不被接受为最终对照。第二轮候选无真实库自测10/10 PASS，harness语法PASS；静态预审后真实run-02为58项脚本PASS，独立验收仅实验范围PASS。独立验收另以内存SQLite补查C旧游标四类绑定变化拒绝；不计入真实58项。完整原值、修订过程和限制见 [RESULTS.md](RESULTS.md)、[RUN-HISTORY.md](RUN-HISTORY.md)、[CANDIDATE-02.md](CANDIDATE-02.md)。两轮Vitest worker均实测 `gcExposed=false`，没有执行显式GC。
