# Holdings / quotes acceptance fixes

## Scope

负责任务 03 + 05 的 holdings、行情诊断和最小 workspace retry 接口；未编辑 `review-dashboard` 或 `quality-details`（R2 由 B 接线），未改成交导入/replay 规则，未写交易库，未提交或推送。

## 实证约束与展示修正

本轮按协调者只读核对的证据处理四个负仓：均没有 `source.positionEffect`、`source.openingPosition`、`source.statementPositions`；来源仅有 `formatRuleId=china-merchants/pdf/monthly-v1`，没有 `statementMonth` / `templateId`。具体已保留并按账户隔离：

- 000893：同账户仅有 sell 500。
- 159608：buy 20000、sell 15000、sell 15000，净差额 -10000。
- 512560：buy 20000、sell 42400。
- 513010 尾号 6476：仅 sell 92400；另一账户的 60000 往返没有串入。

这些数据只作为“负仓差额待核对”展示，不能证明真实空头，也不声称确定漏单。只有非推断的 `open-short` 标记或可信期初负仓才支持 verified-short；没有这两类证据时方向为 unknown。没有 `positionEffectEvidence` 的既有明确 `positionEffect` 仍保留兼容；`positionEffectEvidence.kind=inferred`（即使 confidence=high）不升级为明确开空证据。保留原始负数量和来源规则，但屏蔽不可信成本/浮盈亏。

证据判断先计算显式开空/可信期初负仓，再以当前数量为准：当前数量为正或零时不会被历史开空标为 short；正数标为 verified-long，零数方向 unknown。新增了历史 open-short 后当前转正的反例回归。

质量层现在以持仓 row 的 `diagnostic/statusReason` 作为主因。负仓同时遇到缺行情、过期或 source failure 时，主原因仍是持仓证据缺口，行情仅作为“行情次级状态”；动作是 `open-data-check`，不进入行情 retry 队列，不暗示更新行情可以修复成本/方向。pre-trade、future、currency-mismatch、invalid 等真实估值原因同样不会被源状态覆盖；与首页一致，缺行情/过期/源失败/更新中/存储失败走 retry，其余估值问题走查看数据。daily status 按标的使用 `daily[id] ?? merged[id]`。

行情主行只保留一个简短动作/状态；日期、来源、抓取时间和长诊断放进 details。retry 会显示进行中，并区分成功、仍不可用、失败；Promise resolve 本身不等同报价可用，只有行模型实际变为 `available` 才显示成功。

## dashboard 接入契约

B 接入 `RoomHoldingsPanel` 的最小输入保持为 `qualityInput` 中的：

`marketDataStatuses`、`marketDataDailyStatuses`、`marketDataLabels`、`marketDataJobs`。

回调契约为：

```ts
onRetryDataQuality?: (
  dimension: TradingRoomQualityDimensionId,
  instrumentIds: readonly string[],
) => void | Promise<void>;
```

持仓面板把单标的行情重试接成 `onRetryDataQuality("holdings", [instrumentId])`；workspace 的 `retryDataQuality` 返回 `Promise<void>`，继续沿用 `startMarketDataUpdate`。刷新锁未取得会返回未启动并 reject，不会读取旧终态 job；holdings 只检查本次日线 `1D` 终态，独立的 `1h` 失败留给 historical，但 job 级 `storage-error/error` 仍会 reject。只有 Promise 成功且行模型变为 available 时，面板才显示成功。

## 修改路径

- `app/lib/reviews/trading-room-holdings.ts`
- `app/lib/reviews/trading-room-holdings.test.ts`
- `app/components/dashboard/room-holdings.tsx`
- `app/components/dashboard/room-holdings.module.css`
- `app/components/dashboard/room-holdings.test.tsx`
- `app/lib/reviews/trading-room-quality.ts`
- `app/lib/reviews/trading-room-quality.test.ts`
- `app/components/trade-review-workspace.tsx`
- `app/components/trade-review-workspace.refresh.test.tsx`
- `app/lib/market/retry-market-data.ts`
- `app/lib/market/retry-market-data.test.ts`

## 实际验证

定向测试（协调者负责的 typecheck/build 未运行）：

```text
npx vitest run app/lib/market/retry-market-data.test.ts app/lib/reviews/trading-room-holdings.test.ts app/components/dashboard/room-holdings.test.tsx app/lib/reviews/trading-room-quality.test.ts app/components/trade-review-workspace.refresh.test.tsx --maxWorkers=1 --reporter=verbose
5 files passed, 61 tests passed
```

```text
npx eslint app/lib/market/retry-market-data.ts app/lib/market/retry-market-data.test.ts app/lib/reviews/trading-room-holdings.ts app/lib/reviews/trading-room-holdings.test.ts app/components/dashboard/room-holdings.tsx app/components/dashboard/room-holdings.test.tsx app/lib/reviews/trading-room-quality.ts app/lib/reviews/trading-room-quality.test.ts app/components/trade-review-workspace.tsx app/components/trade-review-workspace.refresh.test.tsx && git diff --check
exit 0
```

ESLint 无 error；workspace 保留 5 条既有 warning（未使用符号、effect cleanup/dependency），未在本任务范围处理。`room-holdings.module.css` 没有纳入 ESLint，因为仓库配置忽略 CSS。

最后的 TS2790 测试清理错误已改用 `Reflect.deleteProperty`，未降低编译配置。

## 待协调者集中验证 / 已知问题

- 未运行全量 typecheck/build，未独立进行浏览器验收；请在现有 3003 服务上验证首页接线、主行/展开详情和 retry 四种状态。
- `review-dashboard` 接线由 B 负责，本任务未编辑该文件；需确认上述四个 `qualityInput` 字段和 Promise-capable callback 在实际页面完整传递，且 failed/source-unavailable 不按旧 `available` 误判成功。
- 本报告依据协调者提供的只读证据和当前 holdings 层回归，不声称四个负仓的真实持仓或漏单已被证明；后续若要改底层 replay/import 规则需另行协调。
