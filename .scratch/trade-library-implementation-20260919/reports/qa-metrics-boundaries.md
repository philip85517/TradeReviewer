# QA — pure metrics 边界审计（05/06）

日期：2026-09-19\
审计人：Luna（独立 QA）\
范围：`app/lib/reviews/library-performance.ts` 及其直接输入契约。没有修改生产代码、既有 owner 测试、数据库或浏览器状态。

## 结论

在 R7 已确认的样本、币种、性质和模拟运行边界内，纯 metrics 模块通过本次独立边界审计，没有发现需要修改生产代码的新缺陷。原有 9 个测试覆盖了基本汇总，但没有把三个上游契约边界锁成可回归验收；新增的独立验收文件补上了这些缺口，且与原测试合计 12 个 focused tests 通过。

## 对照 R7 的检查结果

| 边界 | 独立证据 | 结果 |
| --- | --- | --- |
| 做空分母 | 用真实 `buildTradeEpisodes` 构造卖出 100 @ 10、买回 100 @ 8；`grossExposure=1000`、`netPnl=200`、`returnPercent=20` | 通过。使用名义开仓金额，没有把保证金替代分母。 |
| IPO 成本只计一次 | 用真实 IPO application/fee/refund/allocation `positionEvents` 构造配售卖出；重复传入同一证据数组后，`grossExposure=11378.61`、`netPnl=518.39`、`fees` 与基线完全相同 | 通过。上游 `summarizeTradeEpisode` 去重后，metrics 层只消费可信结果。 |
| 分子与分母样本可不同 | 原测试的正 PnL、零/负 exposure 和未可信样本覆盖净 PnL 与收益率分母差异；独立测试再确认真实上游回合仍提供正 exposure | 通过。净盈亏样本不会因为收益率分母无效而被填零。 |
| 缺 FX 对称排除 | 仅 USD、无 FX snapshot 的真实 `buildTradeLibraryEntries` 输入仍保留 USD 原币组；CNY `reason=missing-fx`，CNY 净盈亏/收益率样本均为 0，且 `missing-fx` 计数可见 | 通过。外币回合不会只进入分子或分母。 |
| explicit unknown 与 legacy entry live | 真实 `buildTradeLibraryEntries` 的 Futu 历史回合得到 `entry.tradeNature=live`，其旧 episode 仍为 `unknown`；手工来源回合保持 `unknown`；结果分成两个 comparable groups | 通过。模块按 queue row 的 entry nature 优先，保留显式未知范围隔离。 |
| 同币多模拟运行隔离 | 原测试以相同证券、`run-a`/`run-b` 验证每个 comparable group 独立，顶层 CNY 为 `multiple-scopes`；本次未重复实现测试 | 已覆盖，未发现跨 run 相加。 |

## 新增验收覆盖

文件：[library-performance.acceptance.test.ts](/Users/zhoulin/.codex/worktrees/e7ec/TradeReview/app/lib/reviews/library-performance.acceptance.test.ts)

新增 3 个测试，重点是旧测试没有完整证明的真实上游路径：

1. `buildTradeLibraryEntries` 推导 legacy live 与 explicit unknown 的性质边界；
2. 真实做空回合和重复 IPO 证据的分母/净盈亏稳定性；
3. foreign-only、无 FX 时的原币保留和 CNY 双侧排除。

## 验证命令

```text
npx vitest run app/lib/reviews/library-performance.acceptance.test.ts
1 file, 3 tests passed

npx vitest run app/lib/reviews/library-performance.test.ts app/lib/reviews/library-performance.acceptance.test.ts
2 files, 12 tests passed

npx eslint app/lib/reviews/library-performance.acceptance.test.ts
exit 0
```

本次没有运行全量测试、浏览器验收或数据库写入。纯模块通过不等于主页面集成完成：调用方仍需把筛选后的 queue slice、entry-first 性质、FX snapshot、open 原币组和多 run comparable groups 正确传入并展示；这些属于后续 UI/集成验收边界。
