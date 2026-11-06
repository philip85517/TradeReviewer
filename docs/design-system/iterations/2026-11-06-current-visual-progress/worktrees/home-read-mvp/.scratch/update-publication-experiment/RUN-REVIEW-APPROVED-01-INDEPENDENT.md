# run-review-approved-01 独立只读验收

**结论：隔离对照结果记录可接受，范围受限。** 我复核了本次 run 的冻结身份、输入身份、28 个样本、14 个配对和汇总计算，没有发现会推翻本次隔离实验结果的完整性或计算错误。它支持“在这组非独占机器、同一进程、暖缓存条件下，实验库对两种单行合成变化的增量发布耗时显著低于全量重建”这一有限观察。它不证明真实导入与投影的原子性，也不证明浏览器完整首屏通过或任何首页时限。

本报告只增加独立审查记录；未重跑 benchmark，未用 SQLite 打开正式库、输入库、基线库或样本库，未修改冻结工具、支持文件、原始 run 结果或数据库文件。审查读取 JSON/Markdown、对输入与证据文件作 SHA-256 字节散列，并对样本库仅检查文件存在和文件大小；没有读取样本库内容。审查没有输出任何事实行或个人/财务字段值。

## 身份与输入证据

运行回执中的工具身份与 tool-02 冻结清单一致：`codeDigest=e8b7cdecd16cdbc1202d5a778c696e03c61dfe4646fcf5c043650bf6ec4bef93`、`supportingDigest=59b797d237feb2baca772a540703cece160202ec00d5d2af9fb8edf9b27d76f8`、`SNAPSHOT-02.json SHA-256=40941bc9ed590718da67b0d2bb62088ebfcb7ad895df0f1ade86978449b7966b`。冻结清单列出的 9 个工具代码文件和 12 个支持文件均与当前散列相符。它引用的 candidate-01 身份 `28b1b5bda18251af10638d0fc24b484671667b9edd2b3a92aac4216e200c237e` 及其 12 个代码文件、3 个证据文件也与冻结清单相符。

输入回执及本次只读散列核对相符：seed SHA-256 `176beaee3afe356984a3407f3ee99d276dd25862e2edc284eceafbbb9b6993e6`；run-02 投影 SHA-256 `88cd4498cb3f1ee3d6d44a6b68c92d8870a34061dc38be69fe3bbaedd850bc3f`。投影原文件记录为主文件 1,343,488 字节、WAL 0 字节、SHM 32,768 字节；回执称它和 seed 均未由 SQLite 打开。私有投影副本 SHA 与原投影相同，私有副本完整性检查及 1,866 行内容摘要由 run 回执记录。独立审查只验证了这些文件身份和回执一致性，没有重新查询库内容。

实验基线回执 SHA 为 `68550f6f589cc848210e349ed869b1feda2fde7e5ec05dadd34bc0c3ff43027c`。28 个样本都从该 SHA 起步、版本 1 更新到版本 2；所有样本数据库路径都在本次隔离目录 `.data/update-publication-worker/benchmark/run-review-approved-01/` 下。运行报告记载输入及基线结束时未变。当前文件散列与回执匹配，但当前只读检查不能独立证明运行期间任一时刻的历史状态。

冻结与运行核心回执：

- [tool-02 冻结清单](benchmark/SNAPSHOT-02.json)
- [run STARTED](benchmark/results/run-review-approved-01/STARTED.json)，SHA-256 `f8b8f0c66e3995728d614343d075daa69d1a6a6abeae762addc8aacfc55f42ce`
- [run FINISHED](benchmark/results/run-review-approved-01/FINISHED.json)，SHA-256 `14db4c4b030ba534b5dbcd028bfb0cfb55b14df53d770204813954998f3e9ef4`
- [既有只读对账记录](benchmark/reports/run-review-approved-01/READ-ONLY-RECONCILIATION.json)，包含逐个 JSON 的 SHA 与重算汇总计数

`STARTED` 与 `FINISHED` 的 run ID、开始时间、冻结代码摘要和工具摘要一致；结束状态为 `PASS`。结果目录有预期的 72 个 JSON：两个 run 回执、28 份样本 STARTED/FINISHED 和 14 份 pair 回执；没有 FAILED 或额外结果文件。协调者报告启动命令 exit 0，但结果目录没有单独保存 stdout/stderr 或 shell exit-code 回执，因此我能独立确认的是文件记录完整且 `FINISHED.status=PASS`，不能从文件证据独立证明操作系统进程退出码。

## 样本、对照与计算

每个样本均有匹配的 STARTED/FINISHED ID、场景、路线、pair 序号和基线 SHA；实际样本主文件存在，关闭后主文件大小与回执的 `afterCloseSpace` 一致，WAL/SHM 也与记录一致。样本文件未打开验证数据库内容。所有 28 个样本回执状态为 PASS，均标记变化为 synthetic；历史新增后 1,867 行，跨组修订后 1,866 行。full 路线分别全量写回活动投影行，incremental 路线写回 1 行。14 个 pair 的 sample IDs、交错路线顺序与聚合回执相符，`semanticEqual` 和 `firstReadEqual` 均为 true。

每个样本包含 21 个范围的独立源 oracle 对账记录，合计 588 个范围实例；pageSize 8 检查 19,992 页，pageSize 17 检查 9,604 页。全量和增量路线的源摘要、语义摘要及首次读取摘要均逐对相等。逐样本结果没有保存事实行；这次审查核对的是其摘要、计数、页数和 pair 引用。

我从样本原始 wall/CPU 值重新计算了各场景和路线的 min/median/max，四组的值均与 `FINISHED.summary` 精确相等。中位 wall 时间如下，单位毫秒：

| 合成变化 | 全量发布 | 增量发布 | 全量首次读 | 增量首次读 |
|---|---:|---:|---:|---:|
| 历史新增 | 72.405 | 3.983 | 0.461 | 0.707 |
| 跨组修订 | 72.796 | 3.832 | 0.435 | 0.706 |

以两种路线各自的发布中位数相除，本次观察约为 18.18× 与 18.99×。这只是 7 对/场景的一次运行描述；它没有置信区间、稳定上限或 SLO 意义。首次读中位数没有显示增量更快。

## 计时边界及可支持结论

按冻结 `engine.mjs` 的计时边界，`updateMetric` 包含 `publish` 调用，即合成源事实更新、投影/摘要更新和事务提交；样本克隆、数据库连接打开和 PRAGMA、首建基线、首次事实提取、全页正确性核对、checkpoint 与 close 均另行计时或排除。发布后没有正确性预读，随后测量的 `firstReadMetric` 是同一 SQLite 连接上的本地实验 API 读取，再 JSON 编码/解析及字节计数。它不是 HTTP 请求、浏览器导航、React 渲染或完整首页读取。总运行时间约 38.756 秒，包含逐页正确性验证；不能解释为单次更新或首读耗时。

运行机器报告为 Node 26.0.0 / SQLite 3.53.0、Darwin 24.3.0 x64、Intel i5-1038NG7、8 个逻辑 CPU、16 GiB。前后报告同一组 14 个 loopback 监听端口，机器非独占且没有停止服务。所有样本在一个进程内按路线交错执行，前序复制、散列与更新使缓存变暖。因而结果仅适合说明此固定基数下 full 与 incremental 两条实验路线的相对工作量和本次测得的发布成本，不适合外推冷启动、独占负载、长期尾延迟、吞吐量、其他机器、生产规模或完整首页性能。

## 未覆盖范围与保全限制

本 run 以冻结的真实非财务投影作为初始事实输入，但两种变更都是实验工具构造的单行合成 delta，`source_facts` 是新建的实验模型。它没有调用实际产品 importer、真实 executions 来源、撤销/修订路径或产品页面；同一实验数据库内的事务不能证明真实产品来源与投影原子发布。完整首屏、浏览器/HTTP、数据持久化用户旅程均未测试。财务 P1/F07、Bars 和真实重复导入仍然暂停；本结果不改变其状态。

独立审查没有重跑回滚、旧游标、并发读取、进程重启或崩溃恢复检查；candidate-01 先前的功能证据属于另一轮实验，不能由这次 benchmark 重新证明。`FINISHED.json` 自身包含工具代码摘要及代码清单，但不含 `SNAPSHOT-02` 文件 SHA 或 supportingDigest；外部保全应同时保存本报告列出的快照 SHA。该门禁基于可信快照比对文件身份，不是数字签名，也不防恶意同时改写验证器与快照或检查后替换工具文件。

结论状态：**本次隔离合成 benchmark 记录与汇总验收 PASS；生产数据源原子性、真实导入流程、浏览器完整首屏及性能承诺 NOT VERIFIED。**
