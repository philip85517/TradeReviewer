# Luna 6 Max 独立审查：Task 2 当前组结果

审查日期：2026-11-06。范围仅限 Task 2 的当前组结果持久化模块，不是整页或后台发布功能验收。

## 结论

- **Spec：PASS（Task 2 范围）**。持久化的是唯一生产当前组计算结果；公开 prepare 入口保留原计算作为 miss/failure 回退；两处 financial source prepare 都传递同一端口；全库资格、FX、复杂组和其他投影仍由原链路新鲜计算。
- **Quality：Approved（Task 2 范围）**。本次独立静态审查及 41 项专属、356 项定向回归均通过，未发现剩余 Task 2 阻断。该结论不接受 Task 1 集成，也不代表完整页面性能已达标。
- **完整页面 ≤1000ms：NOT VERIFIED**。协调者配对数据显示所测完整同步 builder 仍约 17.9 秒；不据缓存命中推论整页达标。
- **95% 覆盖率：NOT VERIFIED**。本轮未安装覆盖率 provider。

原 `HOME-DB-COLD` 阶段计数与开放状态不变；本审查不修改或关闭它。

## 审查版本和基线

候选绑定到 `review-candidate-manifest.json`：1198 个文件，product hash `f58e0cfa909635925e75f1a8e2e04331c1f102dc47f26391bb15a41913f12247`。我用 pinned Node 对本次 7 个 Task 2 文件逐项重算 SHA-256 与字节数，全部和候选清单匹配。完整基线清单有 1183 项、head `8c8c66c715be46e1e8a53d61d02b82f4fa13b22c`；Task 2 两个原有产品文件在 `baseline-files/` 的原始字节与其基线 SHA 匹配，并以这些原始文件直接检查差异，没有使用空的 HEAD diff。原始字节目录按 root 核实是源文件子集：973 项存在且哈希匹配，210 项为资产/映射等未复制字节；root 的候选清单对全部 1198 文件和资产重新哈希，无资产漂移。

Task 2 文件的候选 SHA：

| 文件 | SHA-256 |
| --- | --- |
| `app/lib/reviews/homepage-v25-performance.ts` | `48a17d0651d163340e1fdc0b67eca0b8353775af4fda6d7bff5def47d190d1b1` |
| `app/lib/reviews/homepage-current-group-results.ts` | `6424544107a9a775c1eaa0f33fd1d97442fa0be1066f023b1a5f6b1600e75a16` |
| `app/components/homepage-v25/financial-source-model.ts` | `5858ab030431ff8c634c0561bcb58c659e00394c2640111ef0e83c3a42b13f05` |
| `app/lib/storage/homepage-current-group-store.ts` | `36551a61e2938da2d6cffd009390b25b1cb4bbf615cc42d9b3e2f326b8521457` |
| `app/lib/reviews/homepage-current-group-results.test.ts` | `aa4e9239ca9c5a4db084e8401f7d7114a874a4141447cfc46b987a3c0520cc0b` |
| `app/lib/reviews/homepage-current-group-version.test.ts` | `ee10711694f5f8f9d5d6ad8a728bf0b32d0983faa2de9b6595ab0cb4174af608` |
| `app/lib/storage/homepage-current-group-store.test.ts` | `4c23a7a35c8ecd6a751cc4822ce008a6c8f0b57a684f70b2425860cec83bf8d7` |

## 规格核对

| 检查项 | 结果 | 依据 |
| --- | --- | --- |
| 唯一公式源，miss 使用原体 | PASS | 与原始 `homepage-v25-performance.ts` 比对，原 `projectedState → indexedQuote/quoteFor → amount/fee/evidence` 表达式移入 `evaluateCurrentGroup`，miss 调用该函数；没有第二份公式，也未把 FX/资格收入缓存。见性能文件 993–998、1014–1035 行。 |
| 完整依赖和时钟证书 | PASS | 每个可缓存普通组在 prepare 时生成一次依赖摘要，纳入完整组、全量原始 candles 顺序及保守 account event evidence；请求时另用业务日、可见成交 ID、已完成 session 和 market local day 生成证书。见性能文件 701–710、980–990 行。 |
| 原生 digest provider | PASS；v1 阻断已消除 | v2 实现版本为 `/2`；prepare 的 `options.digest` 被保存并用于依赖、cache key、payload 保存和恢复。独立专属测试确认 provider 实际调用且数据库命中。见性能文件 654–660、710、990、1015、1023 行；结果模块 17、52–53、71–88 行。版本锁测试锁定 58 个传递依赖文件和 `a2960f792a94f8e947820bb620fbc3308fbfa1f93be0f1dda85eb94886fd10ea`。 |
| 全库资格与 FX | PASS | 当前组 native payload 只恢复原币金额、证据和 quote coverage；FX 转换及 freshness、全库来源/资格在 cache miss/hit 后仍走原投影组合。独立测试覆盖 B 全库缺口仍令 aggregate unknown、FX/币种/知识时点新鲜。 |
| 复杂组合与异常回退 | PASS | 有 position/statement/opening 证据、冲突、非 ordinary/不支持市场或不能证明时不保存；坏 JSON、schema、implementation、policy、clock、identity、dependency、摘要、金额形状及 get/put I/O 失败都会恢复原计算。 |
| 新鲜 cursor | PASS | cache 不保存旧 `knowledgeCursor`；恢复时绑定当前 cursor。真实 SQLite 关闭并重新打开连接的测试中命中一次，原币精度保留，cursor 更新。测试记录 SQLite 3.53.0。 |
| 存储容量和事务边界 | PASS | durable 与 pending 各自限制 2048 条 / 64MiB 实际 key+JSON UTF-8 payload；没有将该数值称为 RSS。put 只暂存；flush 在已有输入事务时拒绝并丢弃候选，成功路径使用独立短 `BEGIN IMMEDIATE`。236 条容量、FIFO、Unicode 字节、只读数据库、表删除、关闭连接均有用例。 |
| 两个 prepare 消费点 | PASS | `ownHomepageFinancialSource` 的 openOnly candidate 与 selected-source 两次 prepare 都传递相同 options；专属测试实际验证此路径。见 source model 157–188 行。 |

## 独立验证证据

所有测试均通过 `./scripts/native-node.sh` 运行，未启动服务、未访问业务库或 `acceptance-real.sqlite`，专属存储用临时合成 SQLite。

- Task 2 专属 3 文件：**41/41 通过**。原始 stdout：`luna-native-task2-41tests-20261106.log`。
- 定向回归 5 文件（performance、financial source model、series、holding facts、native digest）：**356/356 通过**。原始 stdout：`luna-native-task2-regression-356-20261106.log`。
- 专属日志核实 digest provider calls=5、static dependency constructed=1；重开连接 diskHits=1 / restored=1 / evaluated=0；存储容量用例 236 条、14884 字节、无拒绝/淘汰。
- 协调者保存的真实业务 oracle `real-equivalence-v2-candidate.json` 两轮 business SHA 均为 `49bf8948bedaa0ce698e1ce7f4ebea0cdebdcddd93535c6d81e8354e0ed32e5e`，与 `real-equivalence-baseline.json` 相同；这是协调者证据，不是我读取数据库或重跑业务库。
- 协调者同候选 off/on 记录 `cache-cost-v2.json`：177 次 disk hit、0 次写入/错误；`project-view` 2127.83→1387.23ms，完整同步 builder 17875.21→17898.33ms。单轮样本且不是完整页面实测；只能说明缓存 projection 的局部变化，不能证明端到端显著加速或 1 秒目标。

## 未验项与边界

- Task 1 worker、发布/丢弃调用者和实际 HTTP / 页面读路径不属于本审查范围，尚不能据此接受完整集成；root 仍需独立验收。
- 未运行全仓测试、全量 typecheck 或构建。当前共享工作区另有 Task 1 新 route 测试的 8 个 `unknown` 类型错误报告，故不把全量类型检查写作通过；未把这些错误归为 Task 2。
- 全页面冷/热、重启首读、真实写后首读 ≤1000ms、桌面浏览器/视觉和 95% 覆盖率均未由本轮验证。
- 缓存 payload bytes 不包含 SQLite 文件、运行时对象或 RSS；实际测量值不能外推总内存。

**最终范围意见：Task 2 可接受；完整产品、原 HOME-DB-COLD 最终 5/5 和性能目标仍须按主计划单独验收。**
