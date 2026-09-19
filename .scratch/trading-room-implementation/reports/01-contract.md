# 01 交易室范围与输入契约

状态：已冻结，供 02 接线及 03/04/05/06 消费。维护者：01（dashboard / scope）。

## metadata 投影

交易室不修改 `Instrument`、`TradeExecution` 或交易回合的证券身份。`ReviewDashboard` 接受可选的 `instrumentMetadata` prop：

```ts
type TradingRoomInstrumentMetadata = {
  market: string;
  symbol: string;
  assetType: "stock" | "etf";
};

type ReviewDashboardProps = {
  // existing props...
  instrumentMetadata?:
    | ReadonlyMap<string, TradingRoomInstrumentMetadata>
    | Readonly<Record<string, TradingRoomInstrumentMetadata | undefined>>;
};
```

键必须是原始 `Instrument.id`（例如 `US:AAPL`、`CN-SH:510300`）。映射缺失、键值字段不完整或资产类型不在两个允许值中时，投影为 `unknown`，不会根据名称、代码前缀或市场强行猜成股票。`StoredInstrument.metadata` 可直接转换为该映射；`metadata.market` / `metadata.symbol` 仅用于证据校验和显示，不替换交易里的 `Instrument`。

分类是正交市场和资产类型的展示投影，互斥集合为：

| category | 归入条件 | 参与四类合计 |
| --- | --- | --- |
| `a-share-stock` | 市场 `CN-SH` / `CN-SZ`，metadata `stock` | 是 |
| `us-stock` | 市场 `US`，metadata `stock` | 是 |
| `hk-stock` | 市场 `HK`，metadata `stock` | 是 |
| `etf` | 任意已支持市场，metadata `etf` | 是（只计一次） |
| `unknown` | metadata 缺失/无效或市场不受支持 | 否，单列并提示 |

ETF 不会因为属于 A 股、港股或美股而重复进入对应股票类别。未知资产类型保留计数与排除原因，不能用零替代。

## RoomScope

```ts
type RoomTradeNature = "live" | "simulation" | "unknown";
type RoomAssetCategory =
  | "all"
  | "a-share-stock"
  | "us-stock"
  | "hk-stock"
  | "etf"
  | "unknown";
type RoomPeriodPreset = "month" | "last-3-months" | "ytd" | "custom";

type RoomDateRange = {
  preset: RoomPeriodPreset;
  startDate: string;
  endDate: string;
};

type RoomScope = {
  nature: RoomTradeNature;
  assetCategory: RoomAssetCategory;
  period: RoomDateRange;
  simulationRunId: string | null;
  query?: string;
  accountIds: readonly string[];
  instrumentIds: readonly string[];
  markets: readonly string[];
  currencies: readonly string[];
  reviewStatuses: readonly ("pending" | "completed" | "deferred")[];
};
```

`startDate` / `endDate` 是来源交易日（含首尾），不是 UTC 截断日。内置期间以今天为结束日：本月为当月 1 日至今天，近 3 个自然月为前两个月 1 日至今天，今年至今为当年 1 月 1 日至今天。自定义期间必须提供合法 ISO 日期且起点不晚于终点。

默认 scope 为实盘、全部分类、本月；模拟盘不能跨运行合并。`markets` 是可选的规范市场细筛，当前 UI 在选择 ETF 后提供沪市、深市、美股、港股等市场选项；ETF 仍只进入 ETF 类别，不改变其证券市场身份。切换性质、运行、分类、市场或期间时，消费同一 `RoomScope` 的摘要、趋势、日历与后续模块；未知来源不会混入实盘。

`filterRoomRows(rows, scope, { ignorePerformanceDates: true })` 是持仓入口可复用的过滤方法：它仍应用性质、运行、分类、市场、账户、标的和币种条件，但忽略业绩日期并只返回未平仓回合。默认业绩过滤只按回合最后平仓的来源交易日判断。

## RoomMoneyView / FxSnapshot

金额模块只接受同一 scope 的原币数据和一个可选汇率快照；它不自行拉取汇率。

```ts
type RoomFxSnapshot = {
  id: string;
  baseCurrency: "CNY";
  asOf: string;
  source: string;
  status: "complete" | "partial" | "missing";
  rates: Readonly<Record<string, string>>; // `USD/CNY` -> CNY per USD; source-normalized decimal text
};

type RoomMoneyView = {
  baseCurrency: "CNY";
  originalByCurrency: Readonly<Record<string, string>>;
  convertedCny: string | null;
  conversion: "same-currency" | "complete" | "partial" | "missing";
  fxSnapshotId: string | null;
  note: string;
};
```

没有快照或缺少任一币对时，保留 `originalByCurrency`，`convertedCny` 为 `null`，展示按币种小计；不能拼接不可比币种，也不能伪造完整人民币合计。金额输入缺失或无效时也只能保留已知币种小计，并标记 `partial`，不能称为完整换算。纯 CNY 不依赖外部 FX，即使快照为 partial 也可直接显示。使用快照时，摘要、趋势、日历必须传递同一个 `fxSnapshotId`，原币盈亏始终保留。

## model / rows

`buildTradingRoomModel(entries, options)` 输出：

```ts
type TradingRoomRow = {
  row: DashboardRow;
  assetCategory: Exclude<RoomAssetCategory, "all">;
  assetType: "stock" | "etf" | "unknown";
  sourceNature: RoomTradeNature;
  closeDate: string | null;
  trustedPnl: string | null;
  exclusionReason: string | null;
  assetReason: string | null;
};

type TradingRoomSummary = {
  range: RoomDateRange;
  money: RoomMoneyView;
  trustedClosedCount: number;
  excludedCount: number;
  wins: number;
  losses: number;
  breakEven: number;
  unknownAssetCount: number;
  unknownAssetEpisodeCount: number;
};
```

`TradingRoomRow` 仅使用已有可信回合净盈亏（不重写财务算法）。open、费用未知、历史不完整、估值/盈亏不可用的样本计入 `excludedCount` 及原因。`unknownAssetCount` / `unknownAssetEpisodeCount` 只说明被排除的来源质量，四类合计不包含它们。

## 当前事实

截至 2026-09-19 的隔离 `acceptance.sqlite` metadata 覆盖核查：HK stock 57 / ETF 3 / unknown 1；US stock 105 / ETF 12 / unknown 2；CN-SH stock 22 / ETF 13；CN-SZ stock 15 / ETF 6。共 236 个标的、3 个 unknown。未知不能默认归为 stock；验收需保留未知计数并解释其不参与四类合计。
