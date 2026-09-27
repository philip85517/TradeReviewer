# R5 targeted unit-failure diagnosis

日期：2026-09-26。执行模型：Luna 5.6 max。范围只覆盖 root full-unit 结果中 `scripts/deploy.test.mjs`、`app/lib/market/baostock-client.test.ts` 和 `app/components/trade-review-workspace.test.tsx` 的定向复现；没有改 R4 产品文件，没有重跑 full unit，也没有改 BaoStock/deploy tests。

## Root full-unit evidence

Root session 15664 的原始结果保留在 `R5-full-unit.txt`：257 个文件通过、3 个跳过；21 个测试失败、2406 个通过、6 个跳过。失败文件为：

- `scripts/deploy.test.mjs`：3 个 SQLite 操作用例；
- `app/lib/market/baostock-client.test.ts`：5 个 Node transport 用例；
- `app/components/trade-review-workspace.test.tsx`：13 个用例。

## Environment failures

Deploy 的单个代表用例：

```text
npx vitest run scripts/deploy.test.mjs -t 'backup and restore resolve the quoted external SQLite directory' --maxWorkers=1
```

在当前受限沙箱中，测试初始化阶段即报 `Error: listen EPERM: operation not permitted 127.0.0.1`，尚未进入 SQLite 路径断言。使用允许本地监听的相同命令定向复验后为 `1 passed | 57 skipped`（18.64s）。因此这 3 个 deploy 失败属于监听权限环境阻断；`scripts/deploy.test.mjs` 未改。

BaoStock 的单个代表用例：

```text
npx vitest run app/lib/market/baostock-client.test.ts -t 'logs in anonymously, sends the documented query and decodes compressed pages' --maxWorkers=1
```

在相同受限沙箱中同样于测试初始化阶段报 `listen EPERM ... 127.0.0.1`。root full-unit 的 5 个 BaoStock stack 都落在同一监听失败路径；没有进入协议、压缩页、分页、abort 或 deadline 断言。该类保留给 root 使用允许本地监听的同文件定向复验，未改 BaoStock 产品或测试。

## Parent workspace selector failures

第一个代表用例原始失败：

```text
npx vitest run app/components/trade-review-workspace.test.tsx -t 'gold replay explains missing historical bars when stepping its first available day' --maxWorkers=1
```

原 stack 指向 `trade-review-workspace.test.tsx:953`，查询 `/可知截止 2026-06-26/`。当前 imported episode 进入统一 Recall 工作区；`RecallWorkspace` 的单一回放栏实际输出 `行情时间 …`，完整日期、秒和时区保存在 `aria-label`，源码已没有 `可知截止`。这是迁移后的过时测试 selector，不是回放状态或 chart 行为回归。

消费者修正保留了原行为检查：日期类断言改为 `getByLabelText(/行情时间 YYYY-MM-DD/)`，并在跨周期断言中检查完整 `aria-label` 的 `YYYY-MM-DD HH:MM:SS · Asia/Hong_Kong`；只比较游标稳定性的断言继续比较当前可见的 `行情时间` 文本。该文件中所有剩余 `可知截止` 查询都已同步，未删除断言、未降低 timeout、未添加产品兼容文本。

修正后的定向结果：

```text
npx vitest run app/components/trade-review-workspace.test.tsx -t 'gold replay explains missing historical bars|does not advance the training cursor|preserves the review timeframe and cursor|starts before entry and advances|uses the unified replay workspace|reveals the next execution|preserves cached intervals|reveals an imported provider candle|restores the selected episode replay context|opens stock entries in the shared workbench' --maxWorkers=1
```

结果为 `11 passed | 65 skipped`。`git diff --check -- app/components/trade-review-workspace.test.tsx` 通过。

## Timing failures

Root full-unit 中另外两个 Workspace 用例是 5 秒 timeout：`keeps library context through cancelled and confirmed imports with failed market refresh` 与 `opens a library queue entry directly in the shared history workbench`。两者以原 timeout、`--maxWorkers=1` 单独复现后分别通过（约 4.87s、2.08s）；`opens stock entries in the shared workbench and preserves library browsing state` 的单独复现也通过（约 4.81s）。没有稳定 stack 指向产品断言，且不允许用延长 timeout 掩盖问题，因此没有修改 timeout 或产品代码。它们应在 root 获得监听权限后仅复跑三个失败文件时再观察；若仍在整文件负载下超过 5 秒，按新的 stack 再归属。

## Changed files and pending verification

- Changed: `app/components/trade-review-workspace.test.tsx` — only the stale Recall cutoff selectors; existing date/timezone and state assertions remain.
- Unchanged: `scripts/deploy.test.mjs`, all R4 domain/storage/export files, `recall-workspace.tsx`, `recall.css`, and chart code.
- Pending root action: with local-listener permission, rerun the two environment failure files and then the three failed files from the full-unit result; this report does not claim the full suite green.
