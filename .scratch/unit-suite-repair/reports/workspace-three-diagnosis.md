# R01 workspace 三例集中诊断

日期：2026-10-06。只读范围为集中探针剩下的三个用例；没有改产品、测试、timeout、skip 或断言。

## 重现

按要求以单 worker、原 timeout 一次运行三个精确用例：

```text
npm run test:unit -- app/components/trade-review-workspace.test.tsx --maxWorkers=1 -t 'retains a Recall drawing draft per episode|keeps the latest Recall drawing draft while completion is gated|keeps library context through a confirmed import with failed market refresh'
```

结果：3 failed / 88 skipped，测试阶段 15.26s；三个用例分别为 5098ms、5066ms、5090ms，均是 5000ms timeout。`/usr/bin/time -p` 的进程墙钟为 real 26.98s（transform/import/setup 约 14.45s，测试约 15.26s）。原始输出保存在 [workspace-three-red.log](/Users/zhoulin/.codex/worktrees/afc8/TradeReview/.scratch/unit-suite-repair/reports/workspace-three-red.log)。

三个失败都发生在 `trade-review-workspace.test.tsx`，集中探针的其它 270 个测试通过；因此不是三个不同的业务断言同时失败，而是这三个路径都消耗超过默认测试预算。

## 精确路径与实际计时来源

前两个用例从 `renderGoldReplay(...)` 开始。这个 helper 会保存行情与回合到 fake IndexedDB，挂载 workspace，经过 dashboard → library → episode → readiness → RecallWorkspace，并最终等待真实 `图表工具栏`。随后每个测试都执行：下一根 K 线、Text pointer/输入、图层重命名、等待“自动保存将在 1 秒后执行”、再等待“已保存”（测试注释明确写着 1 秒 debounce），然后继续快照/完成门槛或重新打开回合。它们在失败输出中分别贴近 5.0s 上限，而代码明确包含至少 1s 的真实 debounce；中间还有多次全文档 `screen.getByRole/getByText`、`userEvent` 和异步 IndexedDB/React 更新。因此这两个是“真实墙钟 + 查询/交互开销超过 5s”的测试时序问题，当前失败点没有显示保存数据错误或产品断言错误。

Recall 的保存实现确实在 `app/components/recall/recall-workspace.tsx` 用 `window.setTimeout(..., 1000)` 调用 `saveNow`；保存队列随后等待 repository.save，再把状态改为“已保存”。这是可控的确定性计时点。测试通过 `findByText("已保存", timeout 2500)` 等待它，属于把固定 debounce 当作真实墙钟的一部分。

第三个用例在同一组件文件的 library 流程中先搜索/展开/打开 XPEV，再上传、确认导入，等待 `mergeExecutions` 收到三条执行，等待 toolbar，返回交易库并检查搜索值。它把所有非 metadata 请求 mock 为立即返回 502；代码中的 `refreshMarketData` 使用 `Promise.allSettled`，失败会保留缓存并记录终态，未发现测试 fixture 提供了实际 provider sleep/backoff。`sync-service` 的 `retryUnavailable` 是覆盖/计划策略，不是等待重试定时器。故第三例的最强解释仍是完整 library→replay→confirmed-import 异步链和宽范围可访问性查询叠加超过 5s；目前没有证据表明失败市场刷新会错误清空 library context。

## 假设验证

1. **Recall 保存/完成逻辑是产品回归。** 不支持。失败均为测试 timeout，没有 `expect` 失败；实现保留 dirty 草稿、串行 save queue 和 completion gate，测试也明确先等“已保存”再检查持久化。当前只读证据无法证明业务结果错误。

2. **前两个用例由 1s autosave 真实计时和重复全局查询超出预算。** 支持度最高。两个结构几乎相同且都约 5.0s；唯一明确的固定等待就是 debounce。`screen.getByRole` 在 workspace 大 DOM 上重复执行，尤其 `openMoreRecords`、图层、按钮和回合重开路径；`within` 已有可用的 workspace/更多记录区域边界。测试不应提高 timeout。

3. **第三例由 provider retry timer 卡住。** 证据不足且偏弱。失败 mock 立即返回 502；相关刷新层使用 `Promise.allSettled`，没有看到固定延迟重试。更可能是确认导入后的 metadata/market readiness 回调与全局 accessibility query 共同耗时。要进一步确认应在测试内临时计数/标记等待点，但这超出本轮不改测试的诊断范围。

## 最小允许的测试修复建议

如协调者批准小范围修复，建议只改 `app/components/trade-review-workspace.test.tsx`：

* 前两个 autosave 专用用例在完成初始真实入口后，使用 fake timers 仅控制 1s debounce，并通过 `act` 推进该定时器；`userEvent.setup({ advanceTimers })` 保留真实键盘/pointer 旅程，仍等待 repository 保存、重开后的绘图内容及完成门槛。不能用 fake timers 包住整个 bootstrap/market hydration。
* 将已定位的 Recall workspace、更多记录区域和图层区域保存为 `within(...)` 查询根，减少全文档可访问性遍历；保留所有可见性和真实点击/输入断言。
* 第三例先不改 provider 或产品逻辑；若独立标记显示确实卡在确认后的 refresh callback，再只在该测试控制已 mock 的失败请求完成边界，保留 merge、toolbar、返回 library 和搜索值断言。

不建议修改 `trade-review-workspace.tsx`、`recall-workspace.tsx`、默认 timeout、全局 setup 或 provider 实现。批准规格要求真实图表与回放边界，当前失败是时间预算/测试同步问题的证据，不足以授权绕过 readiness 或改变产品行为。
