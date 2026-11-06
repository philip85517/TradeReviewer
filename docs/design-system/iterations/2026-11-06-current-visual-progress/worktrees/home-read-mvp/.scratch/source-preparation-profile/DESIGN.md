# 首次来源准备：只读分段诊断候选 01

本实验只回答既有首次准备 7312.530 ms 中哪些同步来源读取/合同解析阶段占时。原 run-02 分别记录 sourceRead 3524.701、productContractParse 3714.932、project 6.236、persist 42.561 ms；总计还包含约 24.100 ms 的 harness 校验/调度间隙。原始报告是单次观察，不能直接推导根因或稳定 SLA。

## 已批准边界

协调者 2026-10-29 指令：仅在本目录新增文件；从已冻结 seed 通过安全文件复制创建本实验私有只读副本，不访问业务库，不修改旧实验/产品。真实测量必须先经协调者和独立审查许可。本候选仅运行合成自测。UI/视觉、财务 P1/F07、Bars、重复导入、缓存/页面修复均不在范围。

## 假说与对照

当前仅有“来源读取与合同解析占主要时间”的证据，内部根因未知。可能代价包括重复全量内容编码、来源材料重建、结构/页面一致性检查；不在测量前选定根因，也不实施优化。

选择 Vite `enforce: pre` 插件在内存对准确产品文件和唯一字符串锚点插入探针。原文件哈希和每个锚点出现次数必须匹配，否则失败。未插桩 baseline 与插桩 profile 均调用 `readHomepageStoredCollection` + `parseHomepageStoredCollection` 原入口，使用独立 Vite module graph。相比手写分解算法，该方式保留原调用顺序和分支；相比逐函数/逐行或 CPU profiler，探针数量较少，且不生成可能携带真实内容的 profile/heap 文件。

阶段树包含 source.read 下的 rawCopy、counts/orphan、bootstrap（各集合 getter）、recall、transactionCommit、page materialize/display/encodeDigest、materialize sourceContext/evidence/history、整包 encodeDigest、shape；contract.parse 下的 canonical/JSON clone、shape（assemblePages、executionEquality）、bindingEncode/UTF8/WebCrypto、逐页 parse/selection。嵌套 span 输出 inclusive 与 exclusive wall/进程 CPU，完整原始每 span 时间和计数；未命名工作落在父阶段 exclusive residual，不把所有 inclusive 相加。SQL 查询和行映射共处 getter，不能归因到单条 SQL 或某一行；递归 canonical 不逐层插桩。

## 计划真实采样（本轮禁止执行）

固定 seed 路径 `.data/mvp-baseline-20261029/seed.sqlite`，引用既有冻结报告 SHA-256 `176beaee3afe356984a3407f3ee99d276dd25862e2edc284eceafbbb9b6993e6`（本候选施工/审查期间未重新读取或 hash seed）。协调者发现旧 run-02 source.sqlite 有非空 SHM，保持拒绝且不删除/修复。获批执行后，只以 `O_RDONLY|O_NOFOLLOW` 文件句柄读取 seed，不通过 SQLite 打开 seed；先要求源父目录 0700、源文件 0400、规范路径无 symlink、所有 WAL/SHM/journal 均不存在，核对固定 SHA/主文件身份/静止性。安全复制到本目录 `private-inputs/<runId>/source.sqlite`，父目录 0700、文件 0400；目录与文件独占创建，禁止覆盖，复制后复核源 SHA/stat/sidecar 状态、目标 SHA/权限/无 sidecar，再接受该输入。复制耗时与完整性护栏时间单列，不计产品来源+解析时间。

实际 SQLite 只打开这个实验私有副本；每次 `readOnly:true`、`query_only=on` 与 immutable URI，前后核对副本 SHA/stat/无 sidecar。来源读取期间不执行 schema 初始化、checkpoint 或 mutation。所有样本后再核对 seed 不变。权限和前后检查针对正常合作环境，不声称抵御恶意并发替换或临时修改后恢复。真实复制/读取现在均禁止，等待独立接受与协调者批准。

3 对独立新连接样本，顺序 B/P、P/B、B/P；各 module graph load、DB open、输入完整性 SHA、校验在准备计时外单列。首对分别标记首次观察，不假称 OS 冷缓存；没有 warmup、drop cache、强制 GC。每次明确完整调用总时（source+parse），不含投影持久化、复制、首次产品页面读取/网络/浏览器/启动服务。阶段只能解释该调用内的耗时，不是完整原 7.3 秒重演。

每个样本保存归一化完整已解析 payload SHA、聚合 counts/页数/字节、bookVersion 的不透明摘要。仅将已知随机顶层与 snapshot receipt 的 receiptId/knownAt 和受其影响的顶层/page payloadDigest 替换为固定哨兵；snapshot receipt.payloadDigest 只绑定 data，不受回执随机字段影响，必须保留。其余字段、数组顺序和所有记录在内存参与摘要。原始返回值每次先经真实 parse 合同接受，再对其 owned return 做归一化，不重算原回执以绕过合同；所有 baseline/profile normalized SHA、counts、字节一致。归一化算法合成反例须证明业务嵌套 receiptId/knownAt 不被删除，任意数据变动改变 SHA。真实记录、名称、账户、source JSON、SQL 错误详情、stack、CPU/heap profile 一律不输出。

## 扰动、环境与护栏

探针 wall/CPU 读取、闭包、Vite transformation、JIT、GC、缓存热度均可能扰动；保存未插桩对照原始值，合成无操作探针校准单列，但不得拿差值当准确探针开销。全局 span stack 只用于严格串行的样本；busy guard 拒绝重叠，async 跨越期间不允许另一 recorder sample 运行。CPU 是进程 usage 区间，不是系统独占 CPU；async WebCrypto 区间也可能包含其他进程内任务。机器非独占，已有 3333/4393 服务保持原样；只记录 OS/CPU/内存/负载，不查看服务内容，不启动/停止服务。3 对样本只供定位，禁止声称稳定 p95/SLA、性能上限或完整首页一秒。

合成调查发现普通 readOnly 连接也可创建 WAL/SHM，因此实际连接使用 `file:...?...mode=ro&immutable=1` 加 readOnly+query_only。合成实测应证明完整来源读取后无 sidecar，且写入被拒绝；仅设置 query_only 不是充分证据。immutable 跳过锁/变更检测，必须服从冻结主文件、所有 sidecar 不存在与前后静止校验前提；不能用于活跃产品数据库，也不能证明与并发写者的一致性。

CLI、直接导入 `measureApproved(request)` 和 `prepareApprovedInput(request)` 共用 gate.mjs；缺审批、额外路径参数或身份变化均拒绝。sample/moduleGraph 为私有，不能直接选择任意数据库；syntheticSelfTest 无参数，只创建规范且无 symlink 的本目录 tests/tmp 独占样本。入口与 `--check` 在 DB/Vite 打开前核对严格冻结工具路径清单、工具源码 SHA、支持证据身份、产品 app/lib+db 源码和依赖锁/直接安装 manifest/entry 身份与 tsconfig.json。SNAPSHOT 自身不自哈希，协调者须核对外部交付 SHA；冻结支持文件不能自称验真它们自身的真实性。目录含未冻结 issue/results/private-inputs/generated 测试临时数据不在身份清单，但可执行源码必须恰好匹配清单。实际 `--measure` 另外要求单独审批 JSON，匹配候选 snapshot SHA、runId、固定输入 SHA、3 pairs；候选不生成审批文件。输出目录与 result.json 独占创建，冲突拒绝，不覆盖。拒绝、输入变化或产品异常均仅安全错误码；保留失败壳，不产生 PASS 报告。

## 测试与冻结

TDD 顺序：严格 manifest/审批/只读静止/不可覆盖护栏 RED→GREEN；计时树与归一化 RED→GREEN；内存插桩唯一锚点与小型合成真实产品入口 equivalence/readonly/完整性 GREEN。所有 SQLite 合成 fixture 放本目录唯一 tests/tmp 子目录，绝不读真实副本。候选最多 3 轮；冻结 candidate-01 后提交协调者和独立审查，未获正式批准不测真实输入。
