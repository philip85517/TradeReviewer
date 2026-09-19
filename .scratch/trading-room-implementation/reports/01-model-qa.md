# 01 模型独立预审

范围：只读审查 `app/lib/reviews/trading-room-scope.ts`、`app/lib/reviews/trading-room-scope.test.ts` 和 `reports/01-contract.md`，对照首页规格的资产分类去重、单 scope 日期/模拟隔离、金额缺失与 FX 投影。未审正在重写的 dashboard 组件，未修改产品代码，未运行全量套件。

## 结论

**未通过，暂有 2 个 P1 缺陷；资产分类/ETF 去重和已覆盖的模拟运行隔离用例通过。** 01 模型不应在这两个问题关闭前作为 05 持仓或 03/04 金额消费契约的完整实现交付。

## 重要缺陷

### P1 — `ignorePerformanceDates` 没有限制为未平仓回合

位置：`app/lib/reviews/trading-room-scope.ts:443-446`、`481-503`。

`reports/01-contract.md` 将 `filterRoomRows(..., { ignorePerformanceDates: true })` 定义为当前持仓入口，并明确“只允许未平仓回合进入当前持仓结果”。当前实现只对 open row 放宽日期判断：

```ts
if (ignorePerformanceDates && row.item.episode.status === "open") return true;
```

业绩期间内的 closed row 仍会继续通过后面的日期判断。因此同时传入一个期间内已平仓回合和一个期前仍持仓回合时，结果会包含两者。05 若直接消费该方法，当前持仓区会混入历史已平仓回合，且可能出现重复复盘入口。

修复要求：持仓模式先限定 `episode.status === "open"`，然后再忽略业绩日期；补一个“期间内 closed + 期前 open，结果只含 open”的回归测试。当前测试 `trading-room-scope.test.ts:276-281` 只验证旧 open 会被纳入，没有验证 closed 会被排除。

### P1 — 缺失/无效金额被丢弃后仍可能报告完整人民币合计

位置：`app/lib/reviews/trading-room-scope.ts:351-417`。

`buildRoomMoneyView` 会把 `amount === null` 或无法解析的金额从 `original` 中跳过，但 `missingAmount` 只有在没有任何可用币种时才影响返回 note。只要还有一项可用金额，完整 FX 快照就会返回 `conversion: "complete"`，隐藏缺失金额。例如：

```ts
buildRoomMoneyView(
  [{ currency: "CNY", amount: "100" }, { currency: "USD", amount: null }],
  completeSnapshot,
)
```

当前结果是 `originalByCurrency: { CNY: "100" }`、`convertedCny: "100"`、`conversion: "complete"`。这违反了契约中“金额缺失保留不可用语义、不能伪造完整人民币合计”的要求，也会让摘要看起来覆盖了未计入的币种。

修复要求：只要 scope 金额集合中存在缺失/无效金额，就返回可见的 partial/missing 状态和说明；不得把缺失项当作零或将剩余小计标成完整总额。补充 complete FX + 一个 null/invalid amount 的测试，以及同一快照下 summary/trend/calendar 的一致性测试。

### P2 观察 — 仅有 CNY 金额时不应受不完整 FX 快照阻断（需与消费方确认）

同一函数在 `[{ currency: "CNY", amount: "100" }]` 配合 `snapshot.status === "partial"` 时返回 `convertedCny: null`、`conversion: "partial"`。CNY 本身无需汇率；若本次消费契约允许原币为基准币继续展示，应保留 `100` 并标注无需换算。当前 spec 对“无快照/缺币对”强调跨币种不可合计，未明确是否要阻断纯 CNY，因此列为需在 03 接线前确认的 P2，而非独立放行阻塞。

## 已核对通过与测试缺口

- 资产分类是单行单投影：A股/美股/港股股票与跨市场 ETF 互斥，ETF 不会按市场重复进入股票分类；缺 metadata、代码或市场不一致会进入 `unknown`。现有分类测试通过。
- `buildRoomMoneyView` 的完整 USD/HKD → CNY 快照换算和无快照跨币种分币种保留测试通过。
- simulation scope 需要显式 `simulationRunId`，run-a 不会混入 run-b；范围日期边界按来源交易日包含首尾。现有测试通过。
- 定向命令：`node_modules/.bin/vitest run app/lib/reviews/trading-room-scope.test.ts`，9 个测试全部通过（约 2.86 秒）。这些通过不能覆盖上述两个未测试反例。
- 当前测试没有覆盖：持仓模式排除 closed、缺失金额与 complete FX、partial FX + 纯 CNY、无效 metadata market 与 instrument market 不一致后的 summary/exclusion 计数。

最终 UI QA 前，先由 01 负责人修复 P1 并补测试，再由 05/03 消费方按最终契约复验；本报告不把独立模型通过当作页面完成。
