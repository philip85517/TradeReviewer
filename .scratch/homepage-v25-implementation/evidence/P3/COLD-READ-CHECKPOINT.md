# 直达交易库 owned read 有限修复：冻结 checkpoint

2026-10-23 03:34:20 CST 冻结。仅本次 root 明确授权的冷直达 owned read 与失败恢复；不是 P1 第3候选，也不是 P3 implementation-ready。P1 第2/3轮 FAIL 历史保留，P3 其余 UI 保持冻结，等待 root 独立真实浏览器复验。

## 根因与最小改动

原始确定性 RED 见 `FROZEN-DIRECT-TRADES-DIAGNOSIS.md`、`09-frozen-direct-trades-red-settled-control.log`：ready 之后 legacy bootstrap 已加载，但 `/trades` 首次 owned read 为0，owned entries为0。`/home` 同数据对照完成一次 owned read。新的 strict ordinary 入口消费 owned data，故冷直达实际为空；不能恢复任意 external latest bundle 覆盖。

只修改两个产品文件：

- `app/components/homepage-v25/use-homepage-host.ts`：有效 `/home` 与 scoped/global `/trades` 首次 ready 使用同一 tagged navigation read。首个 accepted 完整 bundle 与 callback 发布前，`initialized=false`，集合不得打开。失败/超时发布明确错误并结束初始 loading gate；重试仍走 owned read。成功后清理交易库 route error。交易库 read/retry 将合法来源首页 bytes 独立传给恢复流程，不能以库的日期/证券覆盖来源 UI。`readOnInitialize=false` 原语义保留；invalid URL 不触发 owned read；请求ID/代次校验、source UI-only、外部整包拒绝覆盖保持。
- `app/components/trade-review-workspace.tsx`：先按 `route.page=trades` 展示库的加载/错误壳，再仅在 initialized且无错误时建立同代 catalog/collection 投影。原 effect 在 route.error 时提前退出，导致冷失败仍停留首页通用提示，是新增组件 RED 的确定根因。库错误提供“重新读取目标交易集合”，pending禁用并显示“正在重试…”，保留“返回首页选择范围”。删除本次新引入但未使用的 TradeLibraryEntry import。

`COLD-READ-PRODUCT.diff` 是相对03:21冻结版的精确产品差异：两份 before 由本次逆向变换还原，**SHA256与原 `frozen-ui-0321-manifest.jsonl` 完全一致**；证明在 `COLD-READ-DIFF-BASELINE-PROOF.json`。不是拿其他历史版本作基线。当前 frozen source 副本在 `cold-read-frozen-source/`。

三个测试文件改动：host新增冷 scoped/global延迟ready、失败重试/返回来源；Workspace新增真实组件失败→可见库错误→重试→正确单证券单回合；catalog test仅按 root 授权补必填 accountId/accountLabel，原断言未改。session/surface/CSS/catalog产品未变，manifest可与03:21对照。

## RED/GREEN 与检查

所有命令在工作树根，以固定 Node 执行；未启动服务、访问浏览器或读取/写入业务/隔离数据库。组件 storage client 是内存 fixture，生产链测试用生产 HTTP client解析内存中seed同形bootstrap，不是已存DB导出。

固定前缀：

```text
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node
```

| 日志 | 精确命令（固定前缀之后） | 结果 |
| --- | --- | --- |
| 10-cold-trades-source-red.log | `node_modules/vitest/vitest.mjs run app/components/homepage-v25/use-homepage-host.test.tsx app/components/homepage-v25/session-model.test.ts` | 新增3项 RED，旧项保留 |
| 12-cold-trades-retry-source-red.log | 同上 | retry丢独立来源的 RED，随后修 reload 传递来源 |
| 13-cold-trades-host-session-green.log | 同上 | 26 PASS，exit0；含原guard/代次/URL/source断言 |
| 14-direct-trades-production-chain-green.log | `node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P3/frozen-direct-trades.vitest.config.ts` | 3 PASS，exit0；生产bootstrap→summary→catalog→host→strict集合 |
| 15-cold-trades-workspace-retry.log | `node_modules/vitest/vitest.mjs run app/components/trade-review-workspace.test.tsx -t 'retries a failed cold scoped collection\|keeps bare global browsing\|keeps the homepage navigation'` | 1FAIL/1PASS；首个alert是首页通用错误，不是库错误 |
| 18-cold-trades-workspace-retry-settled.log | 同15命令 | 等待仍失败，确定 Workspace error gate 阻止库可见；不是只调整等待就通过 |
| 19-cold-trades-workspace-visible-recovery.log | `node_modules/vitest/vitest.mjs run app/components/trade-review-workspace.test.tsx -t 'retries a failed cold scoped collection\|keeps bare global browsing\|keeps homepage navigation\|connects the production homepage holding'` | 3 PASS/96SKIP，exit0 |
| 20-cold-trades-workspace-regression.log | `node_modules/vitest/vitest.mjs run app/components/trade-review-workspace.test.tsx -t 'retries a failed cold scoped collection\|keeps bare global browsing\|carries a nondefault homepage navigation\|connects the production homepage holding\|moves a homepage-origin collection'` | 6 PASS/93SKIP，exit0；错误必须visible且位于library-page-shell，成功后严格只含explicit-live；含live→simulation/unknown→source return |
| 21-cold-trades-strict-types-green.log | `node_modules/typescript/bin/tsc --noEmit --incremental false` | exit0，无错误 |
| 22-cold-trades-targeted-lint-green.log | `node_modules/eslint/bin/eslint.js app/components/homepage-v25/use-homepage-host.ts app/components/homepage-v25/use-homepage-host.test.tsx app/components/trade-review-workspace.tsx app/components/trade-review-workspace.test.tsx app/components/homepage-v25/catalog-model.test.ts` | exit0，0error/10既有warning；不是全量lint PASS |
| 23-catalog-fixture-regression.log | `node_modules/vitest/vitest.mjs run app/components/homepage-v25/catalog-model.test.ts` | 4 PASS，exit0 |

`11-cold-trades-host-green.log` 的旧文件名不表示GREEN：当时25PASS/1FAIL，因为新增fixture错误假设requestId从1开始。改为按调用次数控制失败后，12仍保留真实来源覆盖RED，再到13全绿。`16-cold-trades-strict-types.log` 原TS2739保留，21是补必填fixture后的GREEN。17原lint11warnings保留，22删除本次unused import后回到10既有warnings。

## 冻结与复验入口

完整11文件SHA/mtime见 `COLD-READ-FREEZE-MANIFEST.json`，包括实际消费的S/F源码。S为已接受的 `fd8f36e859fca9567f52fbd17acebc6f403af733ff4ff3e2ac0144073f9f643e`；F当前源 `637f07933247a6d4dbcea5336e946e68b98e3ff5fe7ddc39e24ff194d79e8c4b` 是 root 当前性能候选事实，不将其写成已独立接受。

- host：`74d765fe938aaa126ef115a683dea7f96181aab67c24de6e33e3e51fde08d2f2`
- Workspace：`6d255f0e1ed1a0af1d094cedb769cfe7fd33c6164c87b46a8ba8f57944581d22`

root独占3333服务/浏览器/隔离DB。无需重启或seed修改。本次请求真实完整reload入口：

1. `http://127.0.0.1:3333/trades?scope=live&market=a&accounts=p1-count-09&rangeMode=all&symbol=SSE%3A600100`，从加载壳到准确1标的/1回合；加载期间不能先开Recall。
2. 裸 `http://127.0.0.1:3333/trades`，保全局shared scope和既有legacy性质可达性，不强加首页explicit-live。
3. 保留非默认首页query/search/scroll来源，直达库刷新后返回首页，重读并恢复来源UI；交易库目标与来源首页可有不同market/date/symbol。
4. root如注入首次owned读取失败，应出现库内明确错误、可见retry，不能伪空或无限loading。重试成功后target/来源不变。

## 门槛状态与未解决项

本次定向功能：PASS（自动化范围）。真实浏览器冷直达/错误恢复/持久化/视觉：NOT VERIFIED，交root独立验收；不使用DOM click冒充鼠标或touch证据。超时恢复分支已有实现，但本次未单独新增超时模拟测试，不把拒绝型重试当成超时实测。

Recall自动切换至其他证券：根因仍未确定，独立NOT VERIFIED；不能认为owned cold read修复已解决。`07-owned-directory-green.log` 旧search journey尾部bootstrap调用次数3期望/实际4的FAIL保持，其他旅程断言当时通过；不在本次有限修复中改计数。P3 search slice尚待root真实/视觉复验及明确后续授权，附件/四区source资格/33反例未扩展。P1全票与95回归不在本checkpoint重复，原FAIL和依赖保留。
