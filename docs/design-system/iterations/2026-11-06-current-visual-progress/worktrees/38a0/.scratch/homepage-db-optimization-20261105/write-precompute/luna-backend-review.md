# Luna 6 Max 独立验收：Task 1 写入到后台预计算闭环

日期：2026-11-06（Asia/Shanghai）  
审查对象：协调者冻结候选；产品整体指纹由协调者提供为 `f58e0cfa909635925e75f1a8e2e04331c1f102dc47f26391bb15a41913f12247`。本审查没有修改产品文件，也没有用 SQLite、测试进程或直接文件读取打开任何业务数据库；未读取、写入或删除数据库内容。

## 结论

**部分接受实现核心；Task 1 的完整 Spec 验收为 FAIL，不能标为整体验收通过。** 持久事务登记、固定快照、单一 builder、worker 恢复和原子版本发布、supervisor 生命周期及 202 客户端单元路径在静态审查和定向测试范围内成立。批量状态/取消有已知 Spec 缺口；另外生产页面调用没有把 AbortSignal 接到 client，页面超时或新读不会终止旧请求。这项端到端取消缺口尚未由 root 处理，应由首页数据流 owner 明确处置。

没有发现新的 Critical 数据安全问题。下述 Important 项阻止将 Task 1 写成完整 Spec PASS。全局保守重算、15 秒 host deadline 和完整页面 1 秒门槛继续按既定限制保留。

## Spec 审查

| 要求 | 结论 | 证据和边界 |
|---|---|---|
| 业务输入与持久待办同事务；回滚不留待办；生产读 miss 不同步完整计算 | **PASS（定向范围）** | `homepage-refresh-queue.ts:67-78` 的 AFTER trigger 与业务写事务共用数据库事务；`homepage-view-store.ts:133-157` 先结束读事务，再在 miss 时只排队并抛出 preparing；同步 builder 仅由显式 `background:false` 对照入口保留。worker 测试覆盖 rollback/late receipt、未打开首页前写入、read miss 不 build；本轮9文件定向测试通过。触发依赖覆盖范围经静态查看，没有发现漏掉首页读取所用持久表的新证据；真实旧库仍由 root 验收。
| 计算输入取同一固定时点快照，尽快释放读事务 | **PASS（合成库/代码路径）** | `homepage-view-builder.ts:120-137` 在一个 deferred transaction 内复制来源、日线/coverage、FX 状态与时间，再 COMMIT 后物化和运行 acquisition/财务链。`homepage-source-snapshot.ts:21-24,56-83` 把 SQL 复制与昂贵物化分开，并保留 caller-owned 事务语义。固定时点和后续行情写入不可混入的隔离测试通过。真实库运行时延及输入全字段对照 **NOT VERIFIED**。
| 独立原生 worker、重启恢复、有限重试、过时拒绝、原子发布和旧结果保留 | **PASS（进程与定向测试范围）** | worker 要求显式绝对 `TRADEREVIEW_DB_PATH` 并独立打开 SQLite（`scripts/homepage-precompute-worker.ts:4-7`）；启动恢复 abandoned claim（`homepage-refresh-worker.ts:13-16`），最多3次（`:82-83,118-121`）；发布事务复核输入版本/generation/业务日/有效期，原子写结果、catalog、任务状态（`:96-114`），过时结果被丢弃并保留新 generation。进程测试覆盖恢复、失败限次、stale candidate；supervisor 测试覆盖 worker 被 SIGKILL 后关闭 web。没有覆盖真实业务计算中每个可能的中断时点，记 **NOT VERIFIED**。
| HTTP 202、有界准备等待及取消 | **FAIL（集成取消）** | client 把可选 signal 传给 `fetch` 并在轮询等待时响应 abort（`homepage-view-client.ts:46-66,69-80`），client 单元测试对此直接路径通过。但生产三处读调用均未传 signal：`trade-review-workspace.ts:2368,2421,2458`。host 的 15 秒计时只更新 UI 并清空 pending（`use-homepage-host.ts:310-327`），没有取消已开始的请求。反例：缺失缓存的旧选择连续收到 202，host 15 秒后显示超时或用户已发起新选择，旧调用仍继续请求/轮询，直到 client 达到轮数上限或网络请求返回；generation 检查只丢弃迟到结果，不取消请求。`homepage-view-client.test.ts:88-99` 只证明直接传入 signal 时可取消，不能证明生产调用链已接通。要求首页数据流 owner 明确修复或记录用户批准的延期；当前记 Important。
| supervisor 先等 worker ready 再开 web；worker 异常退出关闭 web | **PASS（测试范围）** | `start-local.mjs:53-88` 先构建/启动 worker、等待 IPC `homepage-worker-ready`，之后才启动 web；意外 worker close 会置 exit 1 并停止子进程（`:70-72`）。跨进程 supervisor 测试包含真实 ready 顺序及 SIGKILL 情形。未运行服务或触碰业务端口，真实宿主行为由 root 负责。
| 批量扫描超过两批、进度粒度及取消语义 | **FAIL（两项已知 Important Spec gap）** | worker 测试以5个对象、`batchSize:2` 扫描三批，证明 cursor 分段可继续（`homepage-refresh-worker.test.ts:56-68`）。但同一 batch 完成扫描后只 enqueue `default` 与登记筛选共用的全局刷新（`homepage-refresh-worker.ts:40-55`）；GET 的 counts 统计全局 queue jobs，而不是此批 target/completed/failed（`[id]/route.ts:14-16`；batch schema 只有 scanned/target_generation，`homepage-refresh-queue.ts:46-49`）。DELETE 只将 scanning/pending batch 标 cancelled（`homepage-refresh-queue.ts:105-106`），worker 只选 scanning 批次，已排进全局 queue 的计算继续执行。现有取消测试在扫描开始前取消（`homepage-refresh-worker.test.ts:26-34`），没有覆盖“已排队后取消”。逐对象统计及已入队任务取消均不满足 spec。需保留 FAIL。
| 旧 builder 唯一且无财务公式改动 | **PASS（静态差异/固定时点比较）** | 实际 builder 相对 `baseline-files/app/lib/storage/homepage-view-builder.ts` 的字节 diff 仅变更输入读取事务、固定 clock、snapshot 输入和可选 current-group store 端口；原 acquisition → summaries → entries → acquisition.complete → source ownership → view projection → holdings 顺序保留。worker 调用该唯一 `buildHomepageViewPayload`（`homepage-refresh-worker.ts:92-94`）。固定 clock 单笔/批量等价测试通过。该项不表示真实业务数据库全字段对账通过。
| 完整页面 1 秒与 15 秒 host 生命周期 | **FAIL / root scope** | 仍全局保守刷新；批量后由全局 barrier 触发 builder。host 15 秒 deadline 未改变。完整页面 1 秒及交易库往返本轮没有独立实测；原失败状态继续，不能以 cache hit、202 或 worker 完成替代。

## Quality 审查

- **实字节审查，不使用 HEAD 同一性推断。** 以 `.scratch/homepage-db-optimization-20261105/write-precompute/product-baseline.json` 和 `baseline-files/` 作为输入，对 `backend-owned-files.txt` 23个文件逐个比较实际字节，确认 baseline copy SHA/字节数与 baseline 记录一致，实际候选 SHA/字节数与 `backend-final-manifest.json` 一致：13个既有文件真实变更，10个文件 baseline 不存在，0项 manifest/baseline mismatch。实际 builder diff 已逐行查看。协调者另提供的全产品 manifest 指纹没有在本报告中重新遍历全部产品文件；此处只对 Task1 的23项完成独立核验。
- **财务代码边界。** 未发现复制或改写现有财务公式；变更集中在调度、存储、读快照及同一 builder 的输入时点。全局保守刷新并没有实现 spec 期望的逐对象局部计算，不能把表中记录对象键称为局部预计算完成。
- **数据库隔离。** 定向9文件中，读写数据库测试使用 `:memory:` 或 `mkdtemp` 下临时 `TRADEREVIEW_DB_PATH` 并恢复原环境；跨进程 worker 显式传临时 sqlite 路径。`start-local.test.mjs` 出现 `.data`/固定路径仅作为传入函数的字符串断言，未打开这些路径。没有读取、写入或删除 `acceptance-real.sqlite`、`.data` 下数据库或现有业务库。
- **静态代码质量。** 未见新 Critical/Important 数据安全问题；队列触发器使用常量表名白名单、SQL 值使用参数绑定，管理 API 只接收受限 scope/requestId，拒绝任意 SQL/路径（`route.ts:7-14`）。builder 发布用短事务和 generation 条件阻止旧候选标新。实现者报告中的 TypeScript 与 lint 结果可见于 `backend-report.md`，本次未独立重跑；整合全量检查/build 由 root 接续。

## 独立定向复跑

运行时：`node v26.0.0`，SQLite `3.53.0`（`./scripts/native-node.sh -p 'process.version + " sqlite " + process.versions.sqlite'`）。测试命令：

```sh
./scripts/native-node.sh node_modules/vitest/vitest.mjs run \
  app/lib/storage/homepage-view-store.test.ts \
  app/lib/storage/homepage-view-builder.test.ts \
  app/lib/storage/homepage-source-snapshot.test.ts \
  app/lib/storage/homepage-refresh-worker.test.ts \
  app/components/homepage-v25/homepage-view-client.test.ts \
  app/api/storage/read-model-refresh/route.test.ts \
  scripts/homepage-precompute-worker.test.mjs \
  scripts/start-local.test.mjs \
  app/lib/storage/trade-changes.test.ts \
  --maxWorkers=1
```

观察结果：9 test files passed、125 tests passed，33.96s。Vitest 产生 Node `DEP0205`（`module.register()` deprecated）提示。worker/supervisor 相关测试构建到其既有临时目录或 `dist/homepage-worker`；没有启动 web 服务。未运行全仓测试、应用 build、覆盖率或旧冻结测量工具；根协调者现已开始整合全量回归。

## NOT VERIFIED 与后续冻结边界

- 95% 分支覆盖率：**NOT VERIFIED**；没有安装覆盖率依赖。
- 真实业务库旧记录与新结果逐字段对账、空白库真实导入：**NOT VERIFIED**，root 持有此项。
- 浏览器端真实写入→返回→刷新/重载持久化链，前端控件和视觉对照：**NOT VERIFIED**，root 持有此项。
- 完整页面≤1秒、写后首读、host 15秒 deadline 与交易库往返：继续 **FAIL / NOT VERIFIED**（按原 DESIGN-COVERAGE 和 FINAL-ACCEPTANCE 状态），本次125项不能改变此门槛。
- 批量逐对象 target/completed/failed 与已排队后取消：**FAIL**，属于已知实现限制。
- 生产 `AbortSignal` 未传入 `read()`：本报告新发现 Important；需 homepage 数据流 owner 明确处置后才可将端到端取消记 PASS。

**独立签署：接受 Task1 的核心后台闭环为部分实现证据；拒绝将 Task1 或整体功能标记为已满足全部 Spec。** 保留已知失败、未验证项和原5/5 性能轮次边界；root 的最终冻结仍待其真实进程、浏览器、性能和整合门槛。
