import Decimal from "decimal.js";

import { marketTradingDate } from "../market/trading-date";
import {
  buildRoomMoneyView,
  roomTodayKey,
  type RoomFxSnapshot,
  type RoomMoneyView,
  type RoomTargetCurrency,
} from "../reviews/trading-room-scope";
import {
  isCanonicalTradingViewAccountExecution,
  TRADINGVIEW_CANONICAL_ACCOUNT_ID,
} from "../trades/tradingview-account-identity";
import { tradeNatureOf, type TradeExecution, type TradeNature } from "../trades/types";

export const CASH_SCHEMA_VERSION = 1 as const;
export const CASH_SETTINGS_KEY = "trading-room.cash.v1" as const;
export const CASH_CURRENCIES = ["CNY", "USD", "HKD"] as const;
export type CashCurrency = (typeof CASH_CURRENCIES)[number];
export type CashNature = "live" | "simulation";

export type CashScope = {
  nature: CashNature;
  simulationRunId: string | null;
};

/**
 * Cash is keyed by business account and currency.  A simulation run is kept
 * on legacy records for source filtering, but the canonical TradingView
 * account deliberately uses a null run to aggregate all source reports.
 */
export type CashBusinessKey = {
  nature: CashNature;
  accountId: string;
  currency: CashCurrency;
  simulationRunId: string | null;
};

export type CashBaselineRecord = {
  id: string;
  scope: CashScope;
  accountId: string;
  currency: CashCurrency;
  balance: string;
  asOf: string;
  updatedAt: string;
  /** Explicit confirmation/source metadata. Legacy rows omit these fields. */
  source?: string;
  revision?: number;
};

export type CashBaselineDraft = Omit<CashBaselineRecord, "id" | "updatedAt"> & {
  id?: string;
  /** Required by the CAS/API path; omitted legacy drafts are normalized for compatibility. */
  expectedRevision?: number | null;
};

export type CashBaselineState = {
  version: typeof CASH_SCHEMA_VERSION;
  records: CashBaselineRecord[];
};

export type CashInstrumentMetadata = {
  market: string;
  symbol: string;
  assetType: "stock" | "etf";
};

export type CashExecutionContext = {
  id: string;
  accountId: string;
  instrumentId: string;
  symbol: string;
  market: string;
  scope: CashScope;
  assetType: "stock" | "etf" | "unknown";
  quantity: string;
  currency: string;
  quoteCurrency: string;
  settlementCurrency: string;
  side: "buy" | "sell";
  executedAt: string;
  tradingDate: string | null;
  grossAmount: string | null;
  netAmount: string | null;
  fee: string | null;
  feeCurrency: string | null;
  feeStatus: "reported" | "allocated" | "unknown";
  platform: string;
  source: "settlement" | "cashChange" | "priceTimesQuantity" | "unknown";
  dateOnly?: boolean;
};

export type CashFeeResolution = {
  amount: string | null;
  currency: string | null;
  availability: "available" | "unavailable";
  source: "reported" | "allocated" | "rule" | "unknown";
  reason: string | null;
  ruleId: string | null;
  ruleVersion: string | null;
};

export type CashFeeResolver = (context: CashExecutionContext) => CashFeeResolution;

export type CashSummaryStatus = "available" | "zero" | "partial" | "unavailable";

export type CashSummary = {
  todayProceeds: RoomMoneyView;
  cashTotal: RoomMoneyView;
  todayProceedsStatus: CashSummaryStatus;
  cashTotalStatus: Exclude<CashSummaryStatus, "zero">;
  coverage: { included: number; excluded: number; missing: number };
  asOf: string | null;
  missingReasons: string[];
  byScope: Readonly<Record<string, { currency: string; amount: string; status: CashSummaryStatus }>>;
  updatedAt: string | null;
};

export type BuildCashSummaryInput = {
  executions: readonly TradeExecution[];
  baselines: readonly CashBaselineRecord[];
  scope: CashScope;
  accountIds: readonly string[];
  today?: string;
  targetCurrency?: RoomTargetCurrency;
  fxSnapshot?: RoomFxSnapshot;
  instrumentMetadata: ReadonlyMap<string, CashInstrumentMetadata | undefined> | Readonly<Record<string, CashInstrumentMetadata | undefined>>;
  feeResolver?: CashFeeResolver;
};

type DecimalValue = Decimal | null;

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const COMPACT_DATE = /^(\d{4})(\d{2})(\d{2})$/;
const TEXT_DATE = /^(\d{4})[-/]?(\d{2})[-/]?(\d{2})/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decimal(value: unknown): DecimalValue {
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function normalizedCurrency(value: string | undefined): string {
  const currency = value?.trim().toUpperCase() ?? "";
  if (currency === "人民币" || currency === "RMB") return "CNY";
  if (currency === "港币" || currency === "HK$") return "HKD";
  if (currency === "美元" || currency === "US$") return "USD";
  return currency;
}

function normalizedSymbol(value: string | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function validCurrency(value: unknown): value is CashCurrency {
  return typeof value === "string" && (CASH_CURRENCIES as readonly string[]).includes(value);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validInstant(value: unknown): value is string {
  return typeof value === "string" && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}

function dateFromText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const compact = COMPACT_DATE.exec(text);
  const parts = compact ?? TEXT_DATE.exec(text);
  if (!parts) return null;
  const candidate = `${parts[1]}-${parts[2]}-${parts[3]}`;
  return validDate(candidate) ? candidate : null;
}

function normalizeScope(value: unknown): CashScope | null {
  if (!isRecord(value) || (value.nature !== "live" && value.nature !== "simulation")) return null;
  if (value.nature === "live") return value.simulationRunId === null ? { nature: "live", simulationRunId: null } : null;
  if (value.simulationRunId === null) return { nature: "simulation", simulationRunId: null };
  return typeof value.simulationRunId === "string" && value.simulationRunId.trim().length > 0
    ? { nature: "simulation", simulationRunId: value.simulationRunId.trim() }
    : null;
}

function normalizeBalance(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = decimal(value);
  return parsed ? parsed.toString() : null;
}

function normalizedRecord(value: unknown): CashBaselineRecord | null {
  if (!isRecord(value)) return null;
  const scope = normalizeScope(value.scope);
  const balance = normalizeBalance(value.balance);
  if (
    !scope ||
    typeof value.id !== "string" || !value.id.trim() ||
    typeof value.accountId !== "string" || !value.accountId.trim() ||
    (scope.nature === "simulation" && scope.simulationRunId === null && value.accountId.trim() !== TRADINGVIEW_CANONICAL_ACCOUNT_ID) ||
    !validCurrency(value.currency) ||
    balance === null ||
    !validInstant(value.asOf) ||
    !validInstant(value.updatedAt)
  ) return null;
  const record: CashBaselineRecord = {
    id: value.id.trim(),
    scope,
    accountId: value.accountId.trim(),
    currency: value.currency,
    balance,
    asOf: new Date(value.asOf).toISOString(),
    updatedAt: new Date(value.updatedAt).toISOString(),
  };
  if (typeof value.source === "string" && value.source.trim()) record.source = value.source.trim();
  if (Number.isInteger(value.revision) && Number(value.revision) >= 0) record.revision = Number(value.revision);
  return record;
}

export function emptyCashBaselineState(): CashBaselineState {
  return { version: CASH_SCHEMA_VERSION, records: [] };
}

export function normalizeCashBaselineState(value: unknown): CashBaselineState {
  if (!isRecord(value) || value.version !== CASH_SCHEMA_VERSION || !Array.isArray(value.records)) {
    return emptyCashBaselineState();
  }
  const records: CashBaselineRecord[] = [];
  const keys = new Set<string>();
  const ids = new Set<string>();
  for (const item of value.records) {
    const record = normalizedRecord(item);
    if (!record) continue;
    const key = cashBaselineKey(record);
    if (keys.has(key) || ids.has(record.id)) continue;
    keys.add(key);
    ids.add(record.id);
    records.push(record);
  }
  return { version: CASH_SCHEMA_VERSION, records };
}

/** Read persisted state strictly so a corrupt settings row cannot look like an empty ledger. */
export function parseCashBaselineState(value: unknown): CashBaselineState {
  if (value === undefined) return emptyCashBaselineState();
  if (!isRecord(value) || value.version !== CASH_SCHEMA_VERSION || !Array.isArray(value.records)) {
    throw new Error("Invalid cash baseline state");
  }
  const records: CashBaselineRecord[] = [];
  const keys = new Set<string>();
  const ids = new Set<string>();
  for (const item of value.records) {
    const record = normalizedRecord(item);
    if (!record) throw new Error("Invalid cash baseline state");
    const key = cashBaselineKey(record);
    if (keys.has(key) || ids.has(record.id)) throw new Error("Duplicate cash baseline state");
    keys.add(key);
    ids.add(record.id);
    records.push(record);
  }
  return { version: CASH_SCHEMA_VERSION, records };
}

export function normalizeCashBaselineDraft(value: unknown): CashBaselineDraft | null {
  if (!isRecord(value)) return null;
  const scope = normalizeScope(value.scope);
  const balance = normalizeBalance(value.balance);
  const source = value.source === undefined
    ? undefined
    : typeof value.source === "string" && value.source.trim()
      ? value.source.trim()
      : null;
  const expectedRevision = value.expectedRevision === undefined
    ? undefined
    : value.expectedRevision === null
      ? null
      : Number.isInteger(value.expectedRevision) && Number(value.expectedRevision) >= 0
        ? Number(value.expectedRevision)
        : NaN;
  if (
    !scope ||
    typeof value.accountId !== "string" || !value.accountId.trim() ||
    (scope.nature === "simulation" && scope.simulationRunId === null && value.accountId.trim() !== TRADINGVIEW_CANONICAL_ACCOUNT_ID) ||
    !validCurrency(value.currency) ||
    balance === null ||
    !validInstant(value.asOf) ||
    source === null ||
    (typeof expectedRevision === "number" && !Number.isFinite(expectedRevision))
  ) return null;
  const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : undefined;
  return {
    ...(id ? { id } : {}),
    scope,
    accountId: value.accountId.trim(),
    currency: value.currency,
    balance,
    asOf: new Date(value.asOf).toISOString(),
    ...(source ? { source } : {}),
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
  };
}

export function cashScopeKey(scope: CashScope): string {
  return scope.nature === "live"
    ? "live"
    : scope.simulationRunId === null
      ? "simulation"
      : `simulation:${scope.simulationRunId}`;
}

export function cashBaselineKey(value: Pick<CashBaselineRecord, "scope" | "accountId" | "currency">): string {
  return `${cashScopeKey(value.scope)}:${value.accountId}:${value.currency}`;
}

/** Stable key for consumers that need to persist/compare the business scope. */
export function cashBusinessKey(value: Pick<CashBaselineRecord, "scope" | "accountId" | "currency">): string {
  return cashBaselineKey(value);
}

export function upsertCashBaseline(
  state: CashBaselineState,
  draft: CashBaselineDraft,
  now: string = new Date().toISOString(),
): CashBaselineState {
  const normalized = normalizeCashBaselineDraft(draft);
  if (!normalized || !validInstant(now)) throw new Error("Invalid cash baseline");
  const key = cashBaselineKey(normalized);
  const targetIndex = state.records.findIndex((record) => cashBaselineKey(record) === key);
  const idIndex = normalized.id
    ? state.records.findIndex((record) => record.id === normalized.id)
    : -1;
  if (normalized.id && idIndex < 0 && targetIndex >= 0) {
    throw new Error("Unknown cash baseline id");
  }
  if (idIndex >= 0 && targetIndex >= 0 && idIndex !== targetIndex) {
    throw new Error("Cash baseline scope already exists");
  }
  const duplicateIdIndex = state.records.findIndex((record) => record.id === normalized.id);
  if (normalized.id && duplicateIdIndex >= 0 && duplicateIdIndex !== (idIndex >= 0 ? idIndex : targetIndex)) {
    throw new Error("Duplicate cash baseline id");
  }
  const existingIndex = idIndex >= 0 ? idIndex : targetIndex;
  const record: CashBaselineRecord = {
    id: state.records[existingIndex]?.id ?? normalized.id ?? `cash:${key}`,
    scope: normalized.scope,
    accountId: normalized.accountId,
    currency: normalized.currency,
    balance: normalized.balance,
    asOf: normalized.asOf,
    updatedAt: new Date(now).toISOString(),
  };
  const records = [...state.records];
  if (existingIndex >= 0) records[existingIndex] = record;
  else records.push(record);
  return { version: CASH_SCHEMA_VERSION, records };
}

export function removeCashBaseline(state: CashBaselineState, id: string): CashBaselineState {
  return { version: CASH_SCHEMA_VERSION, records: state.records.filter((record) => record.id !== id) };
}

function metadataFor(
  input: BuildCashSummaryInput["instrumentMetadata"],
  id: string,
): CashInstrumentMetadata | undefined {
  const value = input instanceof Map
    ? input.get(id)
    : (input as Readonly<Record<string, CashInstrumentMetadata | undefined>>)[id];
  if (!value || (value.assetType !== "stock" && value.assetType !== "etf")) return undefined;
  return value;
}

function feeStatusOf(execution: TradeExecution): CashExecutionContext["feeStatus"] {
  return execution.source.feeStatus === "reported" || execution.source.feeStatus === "allocated"
    ? execution.source.feeStatus
    : execution.source.feeStatus === "unknown"
      ? "unknown"
      : decimal(execution.fee) !== null
        ? "reported"
        : "unknown";
}

/**
 * Cash may only be bucketed when the source explicitly identifies its
 * settlement currency. The instrument quote is deliberately not a fallback:
 * an HK quote can settle in CNY through Stock Connect, and a cash change with
 * no currency evidence cannot be assigned to an account bucket.
 */
function explicitSettlementCurrency(execution: TradeExecution): CashCurrency | null {
  const currency = normalizedCurrency(execution.source.settlement?.currency);
  return validCurrency(currency) ? currency : null;
}

function dateOnlyOf(execution: TradeExecution): boolean {
  return execution.source.timePrecision === "date-only" ||
    execution.source.sourceTimeKind === "order" ||
    execution.source.sourceTimeKind === "date" ||
    ISO_DATE.test(execution.executedAt);
}

function sourceDate(execution: TradeExecution): string | null {
  for (const candidate of [
    execution.source.tradingDate,
    execution.source.marketCalendarDate,
    execution.source.sourceTimestampText,
  ]) {
    const date = dateFromText(candidate);
    if (date) return date;
  }
  try {
    return marketTradingDate(execution.executedAt, execution.instrument.market);
  } catch {
    return null;
  }
}

type BaselineRelation = "before" | "after" | "ambiguous";

function relationToBaseline(
  dateOnly: boolean,
  executionDate: string | null,
  executedAt: string,
  market: string,
  baseline: CashBaselineRecord,
): BaselineRelation {
  if (dateOnly) {
    let baselineDate: string;
    try {
      baselineDate = marketTradingDate(baseline.asOf, market);
    } catch {
      return "ambiguous";
    }
    if (!executionDate || executionDate === baselineDate) return "ambiguous";
    return executionDate < baselineDate ? "before" : "after";
  }
  const executionInstant = Date.parse(executedAt);
  const baselineInstant = Date.parse(baseline.asOf);
  if (!Number.isFinite(executionInstant) || !Number.isFinite(baselineInstant)) return "ambiguous";
  return executionInstant <= baselineInstant ? "before" : "after";
}

function relationForExecution(execution: TradeExecution, baseline: CashBaselineRecord): BaselineRelation {
  return relationToBaseline(
    dateOnlyOf(execution),
    sourceDate(execution),
    execution.executedAt,
    execution.instrument.market,
    baseline,
  );
}

function relationForContext(context: CashExecutionContext, baseline: CashBaselineRecord): BaselineRelation {
  return relationToBaseline(
    context.dateOnly === true,
    context.tradingDate,
    context.executedAt,
    context.market,
    baseline,
  );
}

function contextFor(
  execution: TradeExecution,
  metadataInput: BuildCashSummaryInput["instrumentMetadata"],
): { context: CashExecutionContext | null; reason: string | null } {
  const metadata = metadataFor(metadataInput, execution.instrument.id);
  if (!metadata) return { context: null, reason: `交易 ${execution.id} 缺少可信资产类型 metadata` };
  if (
    normalizedSymbol(metadata.symbol) !== normalizedSymbol(execution.instrument.symbol) ||
    normalizedSymbol(metadata.market) !== normalizedSymbol(execution.instrument.market)
  ) return { context: null, reason: `交易 ${execution.id} 的资产 metadata 身份不匹配` };
  const scope = cashScopeFromExecution(execution);
  if (!scope) return { context: null, reason: `交易 ${execution.id} 缺少可审计的现金业务范围` };
  const settlement = execution.source.settlement;
  const settlementCurrency = explicitSettlementCurrency(execution);
  if (!settlementCurrency) {
    return {
      context: null,
      reason: `交易 ${execution.id} 缺少可审计的结算币种证据，不能用报价币种作为现金币种`,
    };
  }
  const quantity = decimal(execution.quantity);
  const price = decimal(execution.price);
  const computedGross = !settlement && quantity !== null && price !== null
    ? quantity.abs().times(price).toString()
    : null;
  const grossAmount = settlement?.grossAmount ?? execution.source.grossAmount ?? computedGross;
  const netAmount = settlement?.netAmount ?? execution.source.cashChange ?? null;
  const fee = execution.fee?.trim() || null;
  const source = settlement?.netAmount ? "settlement" : execution.source.cashChange ? "cashChange" : grossAmount ? "priceTimesQuantity" : "unknown";
  return {
    context: {
      id: execution.id,
      accountId: execution.accountId,
      instrumentId: execution.instrument.id,
      symbol: execution.instrument.symbol,
      market: execution.instrument.market,
      scope,
      assetType: metadata.assetType,
      quantity: execution.quantity,
      currency: settlementCurrency,
      quoteCurrency: normalizedCurrency(execution.instrument.currency),
      settlementCurrency,
      side: execution.side,
      executedAt: execution.executedAt,
      tradingDate: sourceDate(execution),
      grossAmount,
      netAmount,
      fee,
      feeCurrency: settlementCurrency,
      feeStatus: feeStatusOf(execution),
      platform: execution.source.platform,
      source,
      dateOnly: dateOnlyOf(execution),
    },
    reason: null,
  };
}

function sameScope(left: CashScope, right: CashScope): boolean {
  return left.nature === right.nature && left.simulationRunId === right.simulationRunId;
}

function defaultFeeResolution(context: CashExecutionContext): CashFeeResolution {
  const amount = decimal(context.fee);
  if (amount !== null && context.feeStatus !== "unknown") {
    return {
      amount: amount.abs().toString(),
      currency: context.feeCurrency,
      availability: "available",
      source: context.feeStatus,
      reason: null,
      ruleId: null,
      ruleVersion: null,
    };
  }
  return {
    amount: null,
    currency: context.feeCurrency,
    availability: "unavailable",
    source: "unknown",
    reason: "缺少可信费用证据且未配置费用规则",
    ruleId: null,
    ruleVersion: null,
  };
}

function deltaFor(
  context: CashExecutionContext,
  resolver: CashFeeResolver,
): { amount: Decimal | null; reason: string | null } {
  const net = decimal(context.netAmount);
  if (net !== null) {
    if ((context.side === "buy" && net.gt(0)) || (context.side === "sell" && net.lt(0))) {
      return { amount: null, reason: "原始净额方向与买卖方向不一致" };
    }
    return { amount: net, reason: null };
  }
  const gross = decimal(context.grossAmount);
  if (gross === null || gross.lt(0)) return { amount: null, reason: "缺少可信成交金额" };
  const resolution = context.feeStatus === "unknown"
    ? resolver(context)
    : defaultFeeResolution(context);
  if (resolution.availability !== "available") return { amount: null, reason: resolution.reason ?? "费用不可用" };
  const fee = decimal(resolution.amount);
  if (fee === null || fee.lt(0)) return { amount: null, reason: "费用金额无效" };
  const feeCurrency = normalizedCurrency(resolution.currency ?? context.settlementCurrency);
  if (feeCurrency !== normalizedCurrency(context.settlementCurrency)) return { amount: null, reason: "费用与结算币种不一致" };
  const raw = context.side === "buy" ? gross.plus(fee).negated() : gross.minus(fee);
  return { amount: raw, reason: null };
}

function emptyMoney(targetCurrency: RoomTargetCurrency, fxSnapshot?: RoomFxSnapshot): RoomMoneyView {
  return buildRoomMoneyView([], fxSnapshot, targetCurrency);
}

function keyFor(scope: CashScope, accountId: string, currency: string): string {
  return `${cashScopeKey(scope)}:${accountId}:${currency}`;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

export function buildCashSummary(input: BuildCashSummaryInput): CashSummary {
  const targetCurrency = input.targetCurrency ?? "CNY";
  const today = input.today && validDate(input.today) ? input.today : roomTodayKey();
  const resolver = input.feeResolver ?? defaultFeeResolution;
  const selectedAccounts = new Set(input.accountIds.filter((id) => id.trim()));
  const baselines = input.baselines.filter((record) =>
    sameScope(record.scope, input.scope) &&
    (input.scope.nature !== "simulation" || input.scope.simulationRunId !== null || record.accountId === TRADINGVIEW_CANONICAL_ACCOUNT_ID) &&
    (selectedAccounts.size === 0 || selectedAccounts.has(record.accountId)),
  );
  const uniqueExecutions = [...new Map(input.executions.map((execution) => [execution.id, execution])).values()];
  const reasons: string[] = [];
  const contexts: CashExecutionContext[] = [];
  let evidenceGaps = 0;
  let coveredEvidenceGaps = 0;
  let todayEvidenceGap = false;
  const baselineForExecution = (execution: TradeExecution): CashBaselineRecord | undefined => {
    const executionScope = cashScopeFromExecution(execution);
    if (!executionScope || !sameScope(executionScope, input.scope)) return undefined;
    const currency = explicitSettlementCurrency(execution);
    if (!currency) return undefined;
    const baseline = baselines.find((record) =>
      record.accountId === execution.accountId &&
      record.currency === currency &&
      sameScope(record.scope, executionScope),
    );
    if (!baseline) return undefined;
    return relationForExecution(execution, baseline) === "before" ? baseline : undefined;
  };
  for (const execution of uniqueExecutions) {
    const rawNature = tradeNatureOf(execution);
    if (rawNature !== "unknown" && rawNature !== input.scope.nature) continue;
    if (selectedAccounts.size > 0 && !selectedAccounts.has(execution.accountId)) continue;
    const executionScope = cashScopeFromExecution(execution);
    if (rawNature === "simulation" && (!executionScope || !sameScope(executionScope, input.scope))) continue;
    if (rawNature === "unknown") {
      reasons.push(`交易 ${execution.id} 的实盘/模拟运行未知`);
      if (execution.side === "sell" && sourceDate(execution) === today) todayEvidenceGap = true;
      evidenceGaps += 1;
      continue;
    }
    if (rawNature === "simulation" && !execution.source.simulationRunId?.trim()) {
      reasons.push(`交易 ${execution.id} 缺少模拟运行 id`);
      if (execution.side === "sell" && sourceDate(execution) === today) todayEvidenceGap = true;
      evidenceGaps += 1;
      continue;
    }
    const result = contextFor(execution, input.instrumentMetadata);
    if (!result.context) {
      if (baselineForExecution(execution)) {
        coveredEvidenceGaps += 1;
        if (execution.side === "sell" && sourceDate(execution) === today) todayEvidenceGap = true;
        continue;
      }
      reasons.push(result.reason ?? `交易 ${execution.id} 无法纳入现金计算`);
      if (execution.side === "sell" && sourceDate(execution) === today) todayEvidenceGap = true;
      evidenceGaps += 1;
      continue;
    }
    if (!sameScope(result.context.scope, input.scope)) continue;
    contexts.push(result.context);
  }

  const todayAmounts: Array<{ currency: string; amount: string }> = [];
  for (const context of contexts) {
    if (context.side !== "sell" || context.tradingDate !== today) continue;
    const delta = deltaFor(context, resolver);
    if (delta.amount === null) {
      todayEvidenceGap = true;
      if (delta.reason) reasons.push(`今日卖出 ${context.id}：${delta.reason}`);
      continue;
    }
    todayAmounts.push({ currency: context.currency, amount: delta.amount.toString() });
  }

  const baselineByKey = new Map<string, CashBaselineRecord>();
  for (const baseline of baselines) baselineByKey.set(cashBaselineKey(baseline), baseline);
  const knownAccounts = sortedUnique([
    ...baselines.map((record) => record.accountId),
    ...contexts.map((context) => context.accountId),
    ...selectedAccounts,
  ]);
  if (knownAccounts.length === 0) reasons.push("当前范围没有账户现金基准");
  const currenciesByAccount = new Map<string, Set<string>>();
  for (const baseline of baselines) {
    const currencies = currenciesByAccount.get(baseline.accountId) ?? new Set<string>();
    currencies.add(baseline.currency);
    currenciesByAccount.set(baseline.accountId, currencies);
  }
  for (const context of contexts) {
    const currencies = currenciesByAccount.get(context.accountId) ?? new Set<string>();
    currencies.add(context.currency);
    currenciesByAccount.set(context.accountId, currencies);
  }

  const totalAmounts: Array<{ currency: string; amount: string }> = [];
  const byScope: Record<string, { currency: string; amount: string; status: CashSummaryStatus }> = {};
  let included = 0;
  let excluded = 0;
  let missing = 0;
  let totalPartial = evidenceGaps > 0;
  excluded += evidenceGaps + coveredEvidenceGaps;
  const requiredAccounts = selectedAccounts.size > 0 ? [...selectedAccounts] : knownAccounts;
  for (const accountId of requiredAccounts) {
    const currencies = currenciesByAccount.get(accountId);
    if (!currencies || currencies.size === 0) {
      missing += 1;
      reasons.push(`账户 ${accountId} 缺少现金基准`);
      continue;
    }
    for (const currency of currencies) {
      const baseline = baselineByKey.get(keyFor(input.scope, accountId, currency));
      if (!baseline) {
        missing += 1;
        reasons.push(`账户 ${accountId} 缺少 ${currency} 现金基准`);
        continue;
      }
      const amounts = [new Decimal(baseline.balance)];
      let status: CashSummaryStatus = "available";
      for (const context of contexts.filter((item) => item.accountId === accountId && normalizedCurrency(item.currency) === currency)) {
        const relation = relationForContext(context, baseline);
        if (relation === "before") continue;
        if (relation === "ambiguous") {
          status = "partial";
          totalPartial = true;
          excluded += 1;
          reasons.push(`现金成交 ${context.id} 与基准处于同一自然日但日期级先后不明`);
          continue;
        }
        const delta = deltaFor(context, resolver);
        if (delta.amount === null) {
          status = "partial";
          totalPartial = true;
          excluded += 1;
          if (delta.reason) reasons.push(`现金成交 ${context.id}：${delta.reason}`);
        } else {
          amounts.push(delta.amount);
          included += 1;
        }
      }
      const total = amounts.reduce((sum, amount) => sum.plus(amount), new Decimal(0));
      totalAmounts.push({ currency, amount: total.toString() });
      byScope[keyFor(input.scope, accountId, currency)] = { currency, amount: total.toString(), status };
    }
  }
  if (missing > 0) totalPartial = true;
  if (baselines.length === 0) totalPartial = true;
  const cashTotalView = totalAmounts.length === 0
    ? emptyMoney(targetCurrency, input.fxSnapshot)
    : buildRoomMoneyView(totalAmounts, input.fxSnapshot, targetCurrency);
  const todayView = todayAmounts.length === 0
    ? emptyMoney(targetCurrency, input.fxSnapshot)
    : buildRoomMoneyView(todayAmounts, input.fxSnapshot, targetCurrency);
  const conversionNeedsAttention = (view: RoomMoneyView) => view.conversion === "missing" || view.conversion === "partial";
  const todayConversionGap = todayAmounts.length > 0 && conversionNeedsAttention(todayView);
  const todayProceedsStatus: CashSummaryStatus = todayAmounts.length === 0
    ? todayEvidenceGap ? "unavailable" : "zero"
    : todayEvidenceGap || todayConversionGap
      ? "partial"
      : "available";
  if (todayConversionGap) reasons.push(todayView.note);
  if (conversionNeedsAttention(cashTotalView) && totalAmounts.length > 0) {
    totalPartial = true;
    reasons.push(cashTotalView.note);
  }
  const cashTotalStatus: Exclude<CashSummaryStatus, "zero"> = totalAmounts.length === 0
    ? "unavailable"
    : totalPartial
      ? "partial"
      : "available";
  const updatedAt = baselines.map((record) => record.updatedAt).sort().at(-1) ?? null;
  const asOfValues = sortedUnique(baselines.map((record) => record.asOf));
  return {
    todayProceeds: todayView,
    cashTotal: cashTotalView,
    todayProceedsStatus,
    cashTotalStatus,
    coverage: { included, excluded, missing },
    asOf: asOfValues.length === 1 ? asOfValues[0] : null,
    missingReasons: sortedUnique(reasons),
    byScope,
    updatedAt,
  };
}

export function cashScopeFromExecution(execution: TradeExecution): CashScope | null {
  const nature: TradeNature = tradeNatureOf(execution);
  if (nature === "live") return { nature: "live", simulationRunId: null };
  // Canonical TradingView rows are one business simulation account.  Their
  // source run remains available on the execution for provenance, but must
  // never become the cash/principal scope or be inferred from the first row.
  if (nature === "simulation" && isCanonicalTradingViewAccountExecution(execution)) {
    return { nature: "simulation", simulationRunId: null };
  }
  if (nature === "simulation" && execution.source.simulationRunId?.trim()) {
    return { nature: "simulation", simulationRunId: execution.source.simulationRunId.trim() };
  }
  return null;
}
