import type { DailyCandleRecord } from "../market/contracts";
import type { MarketDataSyncStatus } from "../market/sync-status";
import type { FxState } from "../fx/room-contracts";
import type { MarketDataJob } from "../storage/market-data-jobs";
import { dashboardStableShortId } from "./dashboard";
import type { TradingRoomHoldingRow, TradingRoomHoldingsModel } from "./trading-room-holdings";
import type { RoomFxSnapshot, RoomScope, TradingRoomRow } from "./trading-room-scope";

export type TradingRoomQualityDimensionId =
  | "transaction"
  | "holdings"
  | "historical"
  | "fx";

export type TradingRoomQualityStatus = "available" | "limited" | "needs-check";

export type TradingRoomQualityAction =
  | "none"
  | "retry"
  | "supplement"
  | "source-unsupported"
  | "investigate"
  | "open-data-management"
  | "open-data-check";

export type TradingRoomQualityIssue = {
  id: string;
  label: string;
  instrumentId?: string;
  episodeId?: string;
  status: TradingRoomQualityStatus;
  reason: string;
  action: Exclude<TradingRoomQualityAction, "none">;
  at?: string | null;
  /** A short, non-sensitive account discriminator for cross-account rows. */
  accountSuffix?: string;
};

export type TradingRoomQualityDimension = {
  id: TradingRoomQualityDimensionId;
  label: string;
  status: TradingRoomQualityStatus;
  totalCount: number;
  availableCount: number;
  affectedCount: number;
  impact: string;
  reason: string;
  asOf: string | null;
  action: TradingRoomQualityAction;
  actionLabel: string;
  affectedInstrumentIds: readonly string[];
  affectedEpisodeIds: readonly string[];
  retryableInstrumentIds: readonly string[];
  /** Items that need an import or evidence supplement instead of a retry. */
  supplementableInstrumentIds?: readonly string[];
  /** Items for which the configured provider cannot currently supply data. */
  sourceUnsupportedInstrumentIds?: readonly string[];
  issues: readonly TradingRoomQualityIssue[];
};

export type TradingRoomQualityModel = {
  scopeKey: string;
  scope: RoomScope;
  status: TradingRoomQualityStatus;
  summary: string;
  dimensions: readonly TradingRoomQualityDimension[];
  unknownAssetCount: number;
  unknownAssetEpisodeCount: number;
  retryQueue: readonly string[];
  supplementQueue: readonly string[];
  sourceUnsupportedQueue: readonly string[];
};

export type TradingRoomQualityBuildOptions = {
  scope: RoomScope;
  rows: readonly TradingRoomRow[];
  /** The current holdings model is already scoped by the caller. */
  holdings?: TradingRoomHoldingsModel;
  marketDataStatuses?: Readonly<Record<string, MarketDataSyncStatus | undefined>>;
  /** Daily coverage status used by holdings; 1H status must not mask it. */
  marketDataDailyStatuses?: Readonly<Record<string, MarketDataSyncStatus | undefined>>;
  marketDataCandles?: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>;
  marketDataLabels?: Readonly<Record<string, string | undefined>>;
  marketDataJobs?: Readonly<Record<string, MarketDataJob | undefined>>;
  fxState?: FxState | null;
  fxSnapshot?: RoomFxSnapshot;
};

const DIMENSION_LABELS: Record<TradingRoomQualityDimensionId, string> = {
  transaction: "交易盈亏可信度",
  holdings: "持仓估值行情",
  historical: "历史复盘 K 线",
  fx: "人民币估算汇率",
};

const STATUS_LABELS: Record<TradingRoomQualityStatus, string> = {
  available: "可用",
  limited: "部分可用",
  "needs-check": "需检查",
};

function scopeKey(scope: RoomScope): string {
  return [
    scope.nature,
    scope.assetCategory,
    scope.period.preset,
    scope.period.startDate,
    scope.period.endDate,
    scope.simulationRunId ?? "",
    scope.query ?? "",
    [...scope.accountIds].sort().join(","),
    [...scope.instrumentIds].sort().join(","),
    [...(scope.markets ?? [])].sort().join(","),
    [...scope.currencies].sort().join(","),
    [...scope.reviewStatuses].sort().join(","),
  ].join("|");
}

function normalizeCurrency(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "人民币" || normalized === "RMB") return "CNY";
  if (normalized === "港币" || normalized === "HK$") return "HKD";
  if (normalized === "美元" || normalized === "US$") return "USD";
  return normalized;
}

function validDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value));
}

function latestDate(values: readonly (string | null | undefined)[]): string | null {
  return values.filter(validDate).sort().at(-1) ?? null;
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isKnownAsset(row: TradingRoomRow): boolean {
  return row.assetCategory !== "unknown" && row.assetType !== "unknown";
}

function isClosed(row: TradingRoomRow): boolean {
  return row.row.item.episode.status === "closed";
}

function rowInstrumentId(row: TradingRoomRow): string {
  return row.row.item.episode.instrument.id;
}

function rowInstrument(row: TradingRoomRow) {
  return row.row.item.episode.instrument;
}

function instrumentLabel(row: TradingRoomRow): string {
  const instrument = rowInstrument(row);
  return `${instrument.name || instrument.symbol}（${instrument.symbol}）`;
}

function accountSuffix(row: TradingRoomRow | TradingRoomHoldingRow): string | undefined {
  const accountId = row.row.item.episode.accountId.trim();
  if (!accountId) return undefined;
  const digits = accountId.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return dashboardStableShortId(accountId);
}

function holdingAccountSuffix(row: TradingRoomHoldingRow): string | undefined {
  const accountId = row.accountId.trim();
  if (!accountId) return undefined;
  const digits = accountId.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return dashboardStableShortId(accountId);
}

function issueStatus(availableCount: number, totalCount: number): TradingRoomQualityStatus {
  if (totalCount === 0 || availableCount >= totalCount) return "available";
  return availableCount > 0 ? "limited" : "needs-check";
}

function actionLabel(action: TradingRoomQualityAction, dimension: TradingRoomQualityDimensionId): string {
  if (action === "retry") return dimension === "fx" ? "重试汇率" : `重试${DIMENSION_LABELS[dimension]}`;
  if (action === "supplement") return dimension === "transaction" ? "补充交易数据" : `补充${DIMENSION_LABELS[dimension]}`;
  if (action === "source-unsupported") return "查看数据源";
  if (action === "open-data-check") return "查看数据";
  if (action === "open-data-management") return "打开数据管理";
  return "";
}

function makeDimension(
  id: TradingRoomQualityDimensionId,
  values: Omit<TradingRoomQualityDimension, "id" | "label" | "actionLabel">,
): TradingRoomQualityDimension {
  return {
    id,
    label: DIMENSION_LABELS[id],
    ...values,
    actionLabel: actionLabel(values.action, id),
  };
}

function issueForRow(
  id: TradingRoomQualityDimensionId,
  row: TradingRoomRow,
  reason: string,
  action: Exclude<TradingRoomQualityAction, "none">,
  at?: string | null,
): TradingRoomQualityIssue {
  const episodeId = row.row.item.episode.id;
  return {
    id: `${id}:${episodeId}`,
    label: instrumentLabel(row),
    instrumentId: rowInstrumentId(row),
    episodeId,
    status: "needs-check",
    reason,
    action,
    at,
    accountSuffix: accountSuffix(row),
  };
}

function issueForHolding(
  id: TradingRoomQualityDimensionId,
  row: TradingRoomHoldingRow,
  reason: string,
  action: Exclude<TradingRoomQualityAction, "none">,
  at?: string | null,
): TradingRoomQualityIssue {
  return {
    id: `${id}:${row.episodeId}`,
    label: `${row.instrumentName || row.symbol}（${row.symbol}）`,
    instrumentId: row.instrumentId,
    episodeId: row.episodeId,
    status: "needs-check",
    reason,
    action,
    at,
    accountSuffix: holdingAccountSuffix(row),
  };
}

function transactionReason(row: TradingRoomRow): string {
  const reason = row.exclusionReason ?? "pnl-unavailable";
  switch (reason) {
    case "unknown-fees": return "费用未知，无法确认净盈亏";
    case "history-incomplete": return "历史证据不完整，无法确认净盈亏";
    case "accuracy": return "交易证据准确性待核对";
    case "missing-pnl": return "缺少净盈亏证据";
    case "pnl-unavailable": return "净盈亏不可用";
    default: return "交易证据待核对";
  }
}

function buildTransactionDimension(rows: readonly TradingRoomRow[]): TradingRoomQualityDimension {
  const closed = rows.filter(row => isClosed(row));
  const known = closed.filter(isKnownAsset);
  const available = known.filter(row => row.trustedPnl !== null && parseNumber(row.trustedPnl) !== null);
  const affected = known.filter(row => !available.includes(row));
  const issues = affected.map(row => issueForRow("transaction", row, transactionReason(row), "open-data-check", row.closeDate));
  const affectedInstrumentIds = [...new Set(affected.map(rowInstrumentId))];
  const affectedEpisodeIds = affected.map(row => row.row.item.episode.id);
  const action: TradingRoomQualityAction = affected.length > 0 ? "open-data-check" : "none";
  const reason = known.length === 0
    ? "当前范围暂无可核对的已平仓回合"
    : affected.length === 0
      ? "当前范围的已平仓交易盈亏均有可信证据"
      : `${affected.length} 个已平仓回合的费用、历史或盈亏证据待核对`;
  return makeDimension("transaction", {
    status: issueStatus(available.length, known.length),
    totalCount: known.length,
    availableCount: available.length,
    affectedCount: affected.length,
    impact: affected.length === 0
      ? "可信已平仓盈亏可用于本期统计（按已平仓回合计数）。"
      : "受影响回合不会被伪装成可信盈亏（按已平仓回合计数）；历史 K 线缺失不会改变可信已平仓盈亏。",
    reason,
    asOf: latestDate(known.map(row => row.closeDate)),
    action,
    affectedInstrumentIds,
    affectedEpisodeIds,
    retryableInstrumentIds: [],
    supplementableInstrumentIds: affectedInstrumentIds,
    sourceUnsupportedInstrumentIds: [],
    issues,
  });
}

function holdingReason(row: TradingRoomHoldingRow): string {
  if (row.costStatus !== "available" || row.quantityStatus !== "available") {
    return row.costStatus !== "available" ? "成本或持仓数量证据不可用" : "持仓数量证据不可用";
  }
  if (row.quoteStatus === "missing") return "缺少当前行情";
  if (row.quoteStatus === "stale") return "当前行情已过期";
  if (row.quote?.freshness === "future") return "行情日期晚于统计截点";
  if (row.quoteStatus !== "available") return row.statusReason ?? "当前行情不可用";
  return row.statusReason ?? "浮盈亏不可用";
}

function buildHoldingsDimension(
  holdings: TradingRoomHoldingsModel | undefined,
  statuses: TradingRoomQualityBuildOptions["marketDataStatuses"],
  dailyStatuses: TradingRoomQualityBuildOptions["marketDataDailyStatuses"],
  labels: TradingRoomQualityBuildOptions["marketDataLabels"],
): TradingRoomQualityDimension {
  const rows = holdings?.rows ?? [];
  const available = rows.filter(row =>
    row.unrealizedPnlStatus === "available" &&
    row.unrealizedPnl !== null,
  );
  const affected = rows.filter(row => !available.includes(row));
  const issues = affected.map(row => {
    const quoteIssue = row.quoteStatus !== "available";
    const useDailyStatus = dailyStatuses !== undefined;
    const marketStatus = (useDailyStatus ? dailyStatuses?.[row.instrumentId] : statuses?.[row.instrumentId]);
    const sourceUnsupported = quoteIssue && (
      marketStatus === "needs-provider" ||
      (!useDailyStatus && /源待连接|未连接|不支持/.test(labels?.[row.instrumentId] ?? ""))
    );
    const action: Exclude<TradingRoomQualityAction, "none"> = sourceUnsupported
      ? "source-unsupported"
      : quoteIssue
        ? "retry"
        : "supplement";
    return issueForHolding("holdings", row, holdingReason(row), action, row.quote?.fetchedAt ?? row.latestTradeDate);
  });
  const affectedInstrumentIds = [...new Set(affected.map(row => row.instrumentId))];
  const retryableInstrumentIds = [...new Set(issues
    .filter(issue => issue.action === "retry")
    .map(issue => issue.instrumentId)
    .filter((id): id is string => Boolean(id)))];
  const supplementableInstrumentIds = [...new Set(affected.filter(row => row.quoteStatus === "available").map(row => row.instrumentId))];
  const sourceUnsupportedInstrumentIds = [...new Set(issues
    .filter(issue => issue.action === "source-unsupported")
    .map(issue => issue.instrumentId)
    .filter((id): id is string => Boolean(id)))];
  const action: TradingRoomQualityAction = sourceUnsupportedInstrumentIds.length > 0
    ? "source-unsupported"
    : retryableInstrumentIds.length > 0
    ? "retry"
    : supplementableInstrumentIds.length > 0
      ? "supplement"
      : "none";
  const reason = rows.length === 0
    ? "当前范围暂无未平仓回合"
    : affected.length === 0
      ? "当前范围的持仓成本、数量和行情均可用"
      : `${affected.length} 个持仓回合的估值证据待核对`;
  return makeDimension("holdings", {
    status: issueStatus(available.length, rows.length),
    totalCount: rows.length,
    availableCount: available.length,
    affectedCount: affected.length,
    impact: affected.length === 0
      ? "持仓浮盈亏可用于当前截点估值（按未平仓回合计数）。"
      : "受影响持仓不显示浮盈亏（按未平仓回合计数）；成本或数量未知时不会被当前报价掩盖。",
    reason,
    asOf: holdings?.asOf ?? null,
    action,
    affectedInstrumentIds,
    affectedEpisodeIds: affected.map(row => row.episodeId),
    retryableInstrumentIds,
    supplementableInstrumentIds,
    sourceUnsupportedInstrumentIds,
    issues,
  });
}

function uniqueKnownInstrumentRows(rows: readonly TradingRoomRow[]): TradingRoomRow[] {
  const result: TradingRoomRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!isKnownAsset(row)) continue;
    const id = rowInstrumentId(row);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(row);
  }
  return result;
}

function historyAction(
  instrumentId: string,
  status: MarketDataSyncStatus | undefined,
  label: string | undefined,
  job: MarketDataJob | undefined,
  candles: readonly DailyCandleRecord[] | undefined,
): Exclude<TradingRoomQualityAction, "none"> {
  const sourcePending = status === "needs-provider" || /源待连接|未连接|不支持/.test(label ?? "");
  if (sourcePending) return "source-unsupported";
  if (job?.status === "needs-provider" || /源待连接|未连接|不支持/.test(job?.message ?? "")) return "source-unsupported";
  if (status === "source-forbidden" && (!candles || candles.length === 0)) return "source-unsupported";
  if (status === "source-unavailable" && (!candles || candles.length === 0) && /不支持/.test(job?.message ?? "")) return "source-unsupported";
  return "retry";
}

function buildHistoricalDimension(
  rows: readonly TradingRoomRow[],
  holdings: TradingRoomHoldingsModel | undefined,
  statuses: TradingRoomQualityBuildOptions["marketDataStatuses"],
  candlesByInstrument: TradingRoomQualityBuildOptions["marketDataCandles"],
  labels: TradingRoomQualityBuildOptions["marketDataLabels"],
  jobs: TradingRoomQualityBuildOptions["marketDataJobs"],
): TradingRoomQualityDimension {
  const holdingRows: TradingRoomRow[] = (holdings?.rows ?? []).map(row => ({
    row: row.row,
    assetCategory: row.assetCategory,
    assetType: row.assetType,
    sourceNature: row.sourceNature,
    closeDate: null,
    trustedPnl: null,
    exclusionReason: "open",
    assetReason: row.assetReason,
  }));
  const instruments = uniqueKnownInstrumentRows([...rows, ...holdingRows]);
  const issues: TradingRoomQualityIssue[] = [];
  const availableRows: TradingRoomRow[] = [];
  const retryable = new Set<string>();
  const unsupported = new Set<string>();
  const asOfValues: (string | null | undefined)[] = [];
  for (const row of instruments) {
    const instrumentId = rowInstrumentId(row);
    const status = statuses?.[instrumentId];
    const candles = candlesByInstrument?.[instrumentId] ?? [];
    const job = jobs?.[instrumentId];
    const label = labels?.[instrumentId];
    const usableComplete = (status === "complete" || status === "ready") && candles.length > 0;
    // Candles alone do not prove that the requested scope is covered. The
    // navigation layer must provide an explicit coverage status before this
    // dimension can be marked available.
    if (usableComplete) {
      availableRows.push(row);
      for (const candle of candles) asOfValues.push(candle.fetchedAt, candle.tradingDate);
      continue;
    }
    const action = historyAction(instrumentId, status, label, job, candles);
    const reason = action === "source-unsupported"
      ? "行情源不支持或尚未连接"
      : status === "stale" || status === "latest-available" || status === "partial"
        ? "历史 K 线覆盖不完整或可更新"
        : status === "source-unavailable"
          ? "历史行情源暂不可用"
          : "尚无当前范围所需的历史 K 线";
    const issue = issueForRow("historical", row, reason, action, job?.requestedAt ?? candles.at(-1)?.fetchedAt ?? row.closeDate);
    issues.push(issue);
    if (action === "source-unsupported") unsupported.add(instrumentId);
    else retryable.add(instrumentId);
    asOfValues.push(job?.requestedAt, candles.at(-1)?.fetchedAt);
  }
  const affectedInstrumentIds = issues.map(issue => issue.instrumentId).filter((id): id is string => Boolean(id));
  const action: TradingRoomQualityAction = unsupported.size > 0
    ? "source-unsupported"
    : retryable.size > 0
      ? "retry"
      : "none";
  const reason = instruments.length === 0
    ? "当前范围暂无历史复盘标的"
    : issues.length === 0
      ? "当前范围所需历史 K 线均有覆盖"
      : `${issues.length} 个标的的历史 K 线待检查；这不会使可信已平仓盈亏失效`;
  return makeDimension("historical", {
    status: issueStatus(availableRows.length, instruments.length),
    totalCount: instruments.length,
    availableCount: availableRows.length,
    affectedCount: issues.length,
    impact: issues.length === 0
      ? "历史复盘 K 线可用（按标的计数）。"
      : "只影响历史复盘 K 线（按标的计数）；可信已平仓盈亏仍按交易证据单独统计。",
    reason,
    asOf: latestDate(asOfValues),
    action,
    affectedInstrumentIds: [...new Set(affectedInstrumentIds)],
    affectedEpisodeIds: issues.map(issue => issue.episodeId).filter((id): id is string => Boolean(id)),
    retryableInstrumentIds: [...retryable],
    supplementableInstrumentIds: [],
    sourceUnsupportedInstrumentIds: [...unsupported],
    issues,
  });
}

function fxRate(
  currency: string,
  snapshot: RoomFxSnapshot | undefined,
  state: FxState | null | undefined,
): number | null {
  if (currency === "CNY") return 1;
  const candidates = [`${currency}/CNY`, `${currency}:CNY`, currency];
  for (const key of candidates) {
    const value = parseNumber(snapshot?.rates[key] ?? state?.rates[key]);
    if (value !== null && value > 0) return value;
  }
  return null;
}

function buildFxDimension(
  rows: readonly TradingRoomRow[],
  state: FxState | null | undefined,
  snapshot: RoomFxSnapshot | undefined,
): TradingRoomQualityDimension {
  const foreign = rows.filter(row => isClosed(row) && isKnownAsset(row) && row.trustedPnl !== null && normalizeCurrency(rowInstrument(row).currency) !== "CNY");
  const currencies = [...new Set(foreign.map(row => normalizeCurrency(rowInstrument(row).currency)).filter(Boolean))];
  const missingCurrencies = new Set(currencies.filter(currency => fxRate(currency, snapshot, state) === null));
  const available = foreign.filter(row => !missingCurrencies.has(normalizeCurrency(rowInstrument(row).currency)));
  const affected = foreign.filter(row => missingCurrencies.has(normalizeCurrency(rowInstrument(row).currency)));
  const issues = affected.map(row => issueForRow("fx", row, `缺少 ${normalizeCurrency(rowInstrument(row).currency)}/CNY 汇率`, "retry", state?.lastAttemptDay ?? snapshot?.asOf ?? row.closeDate));
  const usable = foreign.length > 0 && available.length === foreign.length;
  const staleFailure = Boolean(state?.error) || state?.status === "partial" || state?.status === "missing" || snapshot?.status === "partial";
  const status: TradingRoomQualityStatus = foreign.length === 0
    ? "available"
    : !usable
      ? "needs-check"
      : staleFailure
        ? "limited"
        : "available";
  const action: TradingRoomQualityAction = foreign.length === 0
    ? "none"
    : !usable
      ? "retry"
      : staleFailure
        ? "retry"
        : "none";
  const publicationDate = state?.publishedAt ?? snapshot?.asOf ?? state?.lastAttemptDay;
  const reason = foreign.length === 0
    ? "当前范围没有需要人民币换算的外币已平仓金额"
    : !usable
      ? `缺少 ${[...missingCurrencies].join("、")} 汇率，人民币估算待补齐`
      : staleFailure
        ? `本次更新失败${state?.error ? `：${state.error}` : ""}，沿用 ${publicationDate ?? "上次成功日期"} 汇率估算`
        : `当前范围外币金额可按 ${publicationDate ?? "最新"} 汇率估算`;
  return makeDimension("fx", {
    status,
    totalCount: foreign.length,
    availableCount: available.length,
    affectedCount: affected.length,
    impact: foreign.length === 0
      ? "纯人民币范围无需 FX。"
      : !usable
        ? "跨币种人民币总额不可完整计算；原币小计仍保留。"
        : staleFailure
          ? "人民币估算沿用旧汇率，原币金额不受影响。"
          : "跨币种人民币估算可用（按外币已平仓回合计数）。",
    reason,
    asOf: state?.fetchedAt ?? snapshot?.asOf ?? null,
    action,
    affectedInstrumentIds: [...new Set(affected.map(rowInstrumentId))],
    affectedEpisodeIds: affected.map(row => row.row.item.episode.id),
    retryableInstrumentIds: [],
    supplementableInstrumentIds: [],
    sourceUnsupportedInstrumentIds: [],
    issues,
  });
}

export function buildTradingRoomQuality(options: TradingRoomQualityBuildOptions): TradingRoomQualityModel {
  const dimensions = [
    buildTransactionDimension(options.rows),
    buildHoldingsDimension(options.holdings, options.marketDataStatuses, options.marketDataDailyStatuses, options.marketDataLabels),
    buildHistoricalDimension(
      options.rows,
      options.holdings,
      options.marketDataStatuses,
      options.marketDataCandles,
      options.marketDataLabels,
      options.marketDataJobs,
    ),
    buildFxDimension(options.rows, options.fxState, options.fxSnapshot),
  ] as const;
  const unknown = options.rows.filter(row => row.assetCategory === "unknown");
  const status: TradingRoomQualityStatus = unknown.length > 0 && dimensions.every(dimension => dimension.status === "available")
    ? unknown.length === options.rows.length ? "needs-check" : "limited"
    : dimensions.some(dimension => dimension.status === "needs-check")
    ? "needs-check"
    : dimensions.some(dimension => dimension.status === "limited")
      ? "limited"
      : "available";
  const retryQueue = [...new Set(dimensions.flatMap(dimension => dimension.retryableInstrumentIds))];
  const supplementQueue = [...new Set(dimensions.flatMap(dimension => dimension.supplementableInstrumentIds ?? []))];
  const sourceUnsupportedQueue = [...new Set(dimensions.flatMap(dimension => dimension.sourceUnsupportedInstrumentIds ?? []))];
  return {
    scopeKey: scopeKey(options.scope),
    scope: options.scope,
    status,
    summary: status === "available" ? "可用于本期统计" : status === "limited" ? "部分结果不可用" : "数据待检查",
    dimensions,
    unknownAssetCount: new Set(unknown.map(rowInstrumentId)).size,
    unknownAssetEpisodeCount: unknown.length,
    retryQueue,
    supplementQueue,
    sourceUnsupportedQueue,
  };
}

export const tradingRoomQualityStatusLabel = STATUS_LABELS;
