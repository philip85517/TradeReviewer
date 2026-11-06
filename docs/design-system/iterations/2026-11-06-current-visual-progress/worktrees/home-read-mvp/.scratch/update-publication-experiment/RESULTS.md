# 候选 01 自验结果（待独立预审）

2026-10-29，冻结代码摘要 `28b1b5bda18251af10638d0fc24b484671667b9edd2b3a92aac4216e200c237e`。14/14 TDD、语法检查与获批的一次 `--light` 均通过；轻量验证总计 16.867 秒，保留 5,478 个检查、147 个范围阶段检查与 12 个更新样本。[原始结果](results/candidate-01.json)含每次 wall/CPU/文件大小、摘要、屏障观察值。PASS 是实现者在有限实验边界内的自验；独立预审及产品接受仍待办。

## 输入与写入范围

真实冻结投影含 1,866 行十字段非财务事实，排序后摘要 `e50a59fb0d6d43dc8f052b8bba3fdcbf5422e682d6a3bb143ea0e031b849cd24`。seed SHA `176beaee3afe356984a3407f3ee99d276dd25862e2edc284eceafbbb9b6993e6`；原 run-02 主文件 SHA `88cd4498cb3f1ee3d6d44a6b68c92d8870a34061dc38be69fe3bbaedd850bc3f`。复制前后及结束均相同，WAL 为 0；主文件 1,343,488 B、SHM 32,768 B。原 seed 和原预备库从未用 SQLite 打开，只做只读文件散列和复制。私有副本摘要相同，integrity_check=ok。此法依赖冻结文件静止和空 WAL，不是活动数据库备份方案。

新数据库只位于 `.data/update-publication-worker/candidate-01/`。真实初始投影被装入新的实验 `source_facts` 与投影，后续六种变化全部显式 `synthetic=true`。没有写原产品 executions、真实导入/修订流程、业务数据库或冻结证据。

## 内容、版本与失败

历史新增、精确时间平手新增、跨账户/市场/日期/symbol修订、nullable修订、withdrawn、同ID复活共六次发布，版本 v1→v7。每步含基线共七阶段、每阶段21个范围（全体、每个初始账户/市场、null/新组、空集合、检索、日期及组合）。pageSize=8 全页、pageSize=17 全页内容/统计相同。

验证同时使用四条路径：新 full 发布、新 incremental 发布、独立读取 `source_facts` 的 SQL+手写 JS 过滤/统计 oracle、冻结 candidate-02 的全量 prepare+read。后者共享原有 narrow字段/范围/封包规则；独立源 oracle 不读取投影/摘要，也不调用投影筛选/统计 helper。逐页封包、拼接内容、排序、总数、唯一标的/已知账户、四个 nullable 缺失统计全部相等。最小夹具另断言旧组最后一条移出、新组第一条移入后空组/新组统计；原始真实基数检查不能单独替代此边界夹具。

成功后旧游标拒绝；失败后三处注入点（source后、projection后、binding后commit前）均保持四张表的完整摘要，旧游标仍有效。full与incremental均做真实基数失败回滚。identity四个维度（seed/projection/rules/code）、范围页大小不匹配均拒绝。慢v1保存delta后，v2先提交，v1调用真实publish路径被CAS拒绝；真实基数也验证旧v1无法覆盖v7。关闭连接后重新打开，返回封包摘要相同；没有测试独立进程重启或崩溃。

## 原子发布与双连接证据

实验源模型、sourceVersion、facts、summaries、binding在**同一数据库、同一 `BEGIN IMMEDIATE` 写事务**提交。主线程writer与独立worker reader使用不同SQLite连接，通过Atomics确定重叠边界：

|reader屏障|源版本/投影版本|行数|观察|
|---|---|---|---|
|write前、source写后、projection写后、commit前、commit后旧快照|1/1|1866/1866|源和投影内容摘要相等|
|结束旧快照后新读事务|2/2|1867/1867|源和投影内容摘要相等，旧游标拒绝|
|read取得metadata(v3)后暂停，writer提交v4，再读摘要/行|3/3|旧payload摘要完全相同|后续新事务才读v4|
|不包读事务的负例：先读源，writer提交后再读投影|2/3|内容摘要不同|mixed=true，证明跨查询混读风险可观测|

这不是一次JS串行调用冒充并发。它证明本候选要求的实验事务和读快照契约，不能证明真实业务源与产品投影原子一致；也不证明分库预备发布、异步导入或多个并发写者。同步publish在拿到写事务后检查版本；写锁竞争、等待超时和失败等待策略 NOT VERIFIED。worker屏障等待上限10秒属于测试防挂死机制，不是产品等待策略。

## 单次成本原样记录

Node 26.0.0 / SQLite 3.53.0，Darwin x64，Intel i5-1038NG7 2GHz、8逻辑核、16GiB。机器非独占；前后lsof均发现含3333、4393在内的14个loopback监听端口，未停止或操作任何服务。没有OS冷缓存控制，没有重复采样/分位数/稳定上限。

每格为本次唯一单个操作 wall/CPU 毫秒。更新是源delta+投影+摘要+版本事务至commit；首次读含本地SQLite读、JSON序列化、解析及摘要，没有HTTP/浏览器。CPU由一次process.cpuUsage差值取得；不含单列检查点。每轮交替full/inc执行顺序。

|synthetic变化|full更新 wall/CPU ms|incremental更新 wall/CPU ms|full首次读 wall/CPU ms|incremental首次读 wall/CPU ms|
|---|---:|---:|---:|---:|
|历史新增|65.868 / 63.010|3.134 / 2.896|0.828 / 0.833|0.557 / 0.560|
|精确时间平手新增|58.208 / 69.268|2.678 / 2.313|0.478 / 1.358|0.447 / 0.640|
|跨组/symbol/日期修订|61.098 / 60.158|2.562 / 2.192|0.453 / 0.457|0.422 / 0.598|
|nullable修订|70.723 / 66.941|2.704 / 2.396|0.643 / 0.993|0.674 / 0.672|
|withdrawn|66.191 / 60.835|2.309 / 1.955|0.467 / 0.472|0.442 / 0.446|
|复活|59.413 / 55.582|2.290 / 1.944|0.455 / 0.469|0.410 / 0.414|

full每次重写1,867–1,868条投影、重算13–15个摘要组；incremental写0–1条投影（withdrawn为0，另有删除）、重算3–5组。后者仍重新扫描all摘要及受影响组，不是常数复杂度维护。

两个实验库在初始化检查点后均为2,052,096 B主文件+32,768 B SHM，WAL=0；每次更新后full WAL为1,359,632–1,371,992 B，incremental为32,992–53,592 B，随后TRUNCATE检查点WAL均归零，主文件大小不变。这是包含源模型的实验库，不能与原1,343,488 B只投影库作同义存储比。首次返回3,260–3,300 B。identity散列7.107ms wall /6.454ms CPU；复制+校验4.338/7.923ms；输入散列、初始化、每次检查点原始指标另存JSON，均未藏入“首次读”。

本次观察表明有限基数下受影响更新少写行和WAL，不能给出稳定倍数、规模上界或完整首页1秒结论。正确性遍历、独立重建和双连接检查耗时属于验证，不当作更新/首次读指标。

## 明确限制与待验

- `source_facts`只是合成源模型；真实导入、修订、撤销、产品版本通知与源/投影提交边界 NOT VERIFIED。财务P1/F07、Bars、重复导入继续暂停。
- 名称、localized_name、accountLabel不在十字段合约，bookVersion未覆盖名称变化，禁止以其单独作为未来完整页面统一版本凭据。
- 排序键id/executedAt仅非空可打印ASCII；非ASCII输入拒绝，Unicode排序 NOT VERIFIED。symbol使用JS lowercase与字面包含，不证明国际化搜索；日期为字符串前缀，不做时区折算。
- 连接重开不等于进程/系统崩溃恢复；断电、磁盘故障、写锁竞争、超时、异步预备库CAS均 NOT VERIFIED。路径检查防止已有symlink/traversal，不证明抵御并发恶意替换路径。
- 无产品/前端变更，UI控件与视觉检查NOT APPLICABLE；HTTP、浏览器、完整首页、独占负载、冷启动、长期性能均 NOT VERIFIED。
- 独立预审、最终接受、任何进一步耗时基准仍等待协调者；本实验自验不恢复暂停工作。
