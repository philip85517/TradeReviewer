# 08 数据质量摘要与可执行问题明细

日期：2026-09-19

状态：08 scope 模型、首页摘要和 dashboard 接线已完成，交由协调者做最终导航与浏览器验收。

## 交付内容

- 新增 `app/lib/reviews/trading-room-quality.ts`，以当前 `RoomScope` 和 `roomModel.rows` 构造四个独立质量维度：交易盈亏可信度、持仓估值行情、历史复盘 K 线、人民币估算汇率。
- 交易质量按已平仓回合计数。`trustedPnl === null` 的费用未知、历史证据不完整或盈亏不可用回合保持受影响状态，即使历史行情完整也不会被覆盖为可用。
- 持仓质量使用 dashboard 在当前 scope 内构造的 `TradingRoomHoldingsModel`，按未平仓回合计数。报价缺失/过期进入 retry 或源不支持动作；成本、数量或准确性证据缺失进入补充动作，不会以当前报价伪造浮盈亏。
- 历史行情按标的计数，并合并当前 holdings 的标的。只有显式 `complete`/`ready` coverage status 且存在 candle 缓存时才标记覆盖；仅有一根或跨范围 candle、没有 status 时视为覆盖未知并需检查，不做隐含完整性推断；缺 provider 不进入 retry 队列。历史 K 线问题的影响文案明确不会使可信已平仓盈亏失效。
- FX 按需要换算的外币已平仓回合计数。纯 CNY scope 不需要 FX；旧汇率仍可用但本次更新失败时显示失败信息和沿用日期，状态为部分可用并保留 retry 动作。
- 未知资产不计入股票/ETF 四类质量分母；unknown-only scope 进入需检查，mixed scope 进入部分可用，并保留未知资产标的和回合数量。
- 新增 `RoomDataQuality` 首页摘要与 CSS，四维显示可用/总数、受影响数量、影响/原因和明确单位（回合或标的），动作连接 `onOpenDataManagement`、`onRetryDataQuality`、`onOpenDataCheck`。
- `ReviewDashboard` 新增可选 `qualityInput` 与质量动作 props。dashboard 在当前本地 scope 内调用 `buildTradingRoomHoldings`，强制以此作为质量模型 holdings；workspace 只需提供行情 map、job 状态、label 与 `FxState`。新增 `onQualityModelChange` effect 将最新 scope 模型交给导航层，供数据管理明细展示，避免 render 期间直接 setState。

## 接线契约

```ts
type ReviewDashboardProps = {
  qualityInput?: Omit<TradingRoomQualityBuildOptions, "scope" | "rows">;
  onOpenDataManagement?: (model: TradingRoomQualityModel) => void;
  onRetryDataQuality?: (
    dimension: TradingRoomQualityDimensionId,
    instrumentIds: readonly string[],
  ) => void;
  onOpenDataCheck?: (
    dimension: TradingRoomQualityDimensionId,
    ids: readonly string[],
  ) => void;
  onQualityModelChange?: (model: TradingRoomQualityModel) => void;
};
```

导航层传入：

```tsx
qualityInput={{
  marketDataStatuses,
  marketDataLabels,
  marketDataJobs,
  marketDataCandles,
  fxState: fxRates.state,
  fxSnapshot,
}}
```

模型动作队列分别为 `retryQueue`、`supplementQueue`、`sourceUnsupportedQueue`；源不支持的标的不会混入 retry。`TradingRoomQualityDimension` 还保留 `affectedInstrumentIds`、`affectedEpisodeIds` 和不暴露完整账户 ID 的 `accountSuffix`，便于数据管理明细定位。

## TDD 与验证

- `npx vitest run app/lib/reviews/trading-room-quality.test.ts app/components/dashboard/room-data-quality.test.tsx app/components/dashboard/review-dashboard.test.tsx`：3 个测试文件、23 个测试通过。
- 模型测试覆盖费用未知与完整历史互不遮蔽、当前 holdings 分母、源不支持与 retry 分离、持仓并入历史标的、complete 空 candle、缺 status 单根/跨范围 candle、FX 失败沿用旧汇率、纯 CNY、空 scope、unknown-only 和 mixed scope。
- `npx eslint app/lib/reviews/trading-room-quality.ts app/lib/reviews/trading-room-quality.test.ts app/components/dashboard/room-data-quality.tsx app/components/dashboard/room-data-quality.test.tsx app/components/dashboard/review-dashboard.tsx app/components/dashboard/review-dashboard.test.tsx`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `git diff --check`：通过。

未运行全量套件、未启动或验收真实浏览器、未提交代码或修改正式数据库。`quality-details` 属导航所有文件；其现有测试若仍断言 `onRetryDataQuality("fx")` 的单参数，需要与已收紧的 `(dimension, ids?)` 契约同步，dashboard 本票未改该文件。
