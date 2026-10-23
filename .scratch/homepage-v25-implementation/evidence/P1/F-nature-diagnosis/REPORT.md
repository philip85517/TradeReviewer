# F：普通库切换性质的动态 RED（只诊断）

仅新增本目录证据副本，产品和原测试零修改。使用现有 Workspace 测试的模块 mocks、mock SQLite HTTP client、fake-indexeddb；未访问服务/浏览器或真实数据库。

命令：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P1/F-nature-diagnosis/focused.vitest.config.ts
```

`01-product-red.log` exit1：2 项中 **1 FAIL / 1 PASS**。F-RED 先从非默认首页 a/live-account 进入 strict live 普通库，再真实调用性质 select 控件改 simulation：

```json
{"url":"/trades?scope=live&market=a&accounts=live-account&rangeMode=all","nature":"simulation","accounts":["all","live-account"],"runControl":false,"source":"普通交易库 · 成交日期 全部 · 包含未平仓成交"}
```

5 个软断言均失败：未变裸 /trades；来源摘要未变全局；没有 simulation-account；仍有 live-account；没有真实 run-f-probe 的模拟运行控件。最后返回首页的原 market/accounts/live 断言未新增失败。对照 F-control 初始裸 /trades 后同样选择 simulation，simulation-account/run-f-probe 可用且不含 live-account，**PASS**。区别只在首页来源 vs 裸全局入口，没有伪造记录性质：两记录分别明确 live 和 simulation，simulationRunId 是真实 fixture 来源字段。

原始 `00-harness-error.log` 因证据副本缺 productionStorageClient helper 而 ReferenceError，保留但**不算产品 RED**；补入原测试同一 helper 后才得到上述产品 RED。

前后消费源逐项 hash 在 before/after-manifest.json，7 项无变化。Workspace/host/session/library 均匹配 freeze2；本次 F/S 分别消费正在开发的 `3bdc3a35c4251f20fc271e1e81e63935e14c378c78d47303a849c48e9c734d4f` / `fd8f36e859fca9567f52fbd17acebc6f403af733ff4ff3e2ac0144073f9f643e`，所以这是新诊断探针，不能倒填原 02:28 freeze2 全量结果，也不是新 F/S 接受。

最小接口/guard 后原子提交顺序见父目录 ROOT-FULL-REGRESSION-DIAGNOSIS.md 最后一节。F 实施仍待 root 授权；本证据不代表浏览器或持久化通过。
