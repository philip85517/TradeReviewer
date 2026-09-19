# Tickets 05/06 — 复盘库绩效计算模块

日期：2026-09-19\
负责人：Luna metrics\
范围：纯计算层；股票分组、列表展示和复盘导航仍由 UI 负责人处理。

## 交付

新增：

- `app/lib/reviews/library-performance.ts`
- `app/lib/reviews/library-performance.test.ts`

公开入口为：

```ts
summarizeLibraryPerformance(
  rows: ReviewQueueItem[],
  fxSnapshot?: FxSnapshot,
): LibraryPerformanceSummary
```

结果包含 `sample` 覆盖信息、按原币/交易性质/模拟运行分隔的 `rawCurrencyGroups`、按交易性质/模拟运行分隔的 `comparableGroups`、单一可比范围下的 `cny` 以及独立的 `open` 浮盈亏信息。`buildLibraryPerformance` 是同一入口的别名。

每个绩效组均明确区分：

- `netPnl` 与 `netPnlSampleCount`：可信、已平仓、有限数值净盈亏样本；
- `returnSampleNetPnl`、`grossExposure`、`weightedReturn` 与 `returnSampleCount`：同时有正开仓金额的收益率样本；
- `wins`、`losses`、`breakEven`、带分母的 `winRate`、平均盈利/亏损、盈亏比和利润因子；
- `exclusionReasons` 与 `returnExclusionReasons`，避免把成本未知、持仓中、缺少 FX 或无效开仓金额当成 0。

模块直接消费 `summarizeTradeEpisode` 生成的 `TradeLibraryEpisode.metrics`，不重算费用、做空库存、配售成本或 IPO 证据。`pnlAvailable: false`、非 closed、空/非有限净盈亏都会从可信净盈亏样本排除；非有限、零或负开仓金额只会再排除该行的收益率样本。

人民币结果对全部行使用同一传入快照。CNY 固定按 1 计算，即使没有快照；外币没有有效快照汇率时，净盈亏和开仓金额不会分别进入 CNY 收益率，原币组仍保留并通过 `missing-fx`/`invalid-fx` 披露。多种交易性质或模拟运行不会在顶层 `cny` 合并，调用方应展示 `comparableGroups` 的独立卡片。

## 验证

先按 TDD 约定运行缺少实现的目标测试，导入模块失败，测试数为 0；实现后运行：

```bash
npx vitest run app/lib/reviews/library-performance.test.ts
```

结果：1 个文件、8 个测试通过。覆盖：

- `10000` 开仓赚 `1000` 与 `90000` 开仓亏 `900`，结果为 `100` / `100000` = `0.1%`；
- CNY `1000/10000` 加 USD `-100/1000`，USD/CNY 为 7 时，人民币加权收益率为 `1.7647058823529411765%`；
- 没有 FX 时 CNY 仍按 1，外币保留原币且 CNY 净盈亏与收益率样本同时排除；
- 可信净盈亏样本与收益率样本覆盖不同（零开仓金额不进入分母）；
- `pnlAvailable: false` 的持仓回合浮盈亏不进入可用浮盈亏合计；
- 做空及带 IPO 配售现金证据的回合沿用 episode metrics 的可信净盈亏/开仓金额，未重复计算；
- 同一证券的不同模拟运行保持独立，全部运行时顶层 CNY 金额不跨运行相加；
- 全部可信样本亏损时利润因子为数学上的 `0`，而非不可用。

```bash
npx tsc --noEmit
npx eslint app/lib/reviews/library-performance.ts app/lib/reviews/library-performance.test.ts
```

结果：typecheck exit 0；两个新增文件 lint exit 0。

## 边界与交接

`comparableGroups` 是 UI 需要的跨币种可比边界；`cny` 只在输入包含一个交易性质/模拟运行范围时提供顶层指标。`sample.cnyNetPnlEligible` 与 `sample.cnyReturnEligible` 在多范围输入下只汇总覆盖数量，不代表金额已跨运行合并，具体金额须读取每个 comparable group。

本切片没有修改既有交易、复盘或 FX 持久化文件，没有启动服务，也没有进行浏览器验收。ticket 05/06 的 UI 集成需等待 ticket 03 的股票展开回合接口，由协调者在集成后独立验收。
