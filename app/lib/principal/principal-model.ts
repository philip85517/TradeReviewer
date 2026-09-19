import Decimal from "decimal.js";

import {
  buildCostReturnSummary,
  type CostReturnSummary,
} from "../reviews/trading-room-metrics";
import {
  buildRoomMoneyView,
  type RoomFxSnapshot,
  type RoomMoneyView,
  type RoomScope,
  type TradingRoomRow,
  type RoomAssetCategory,
} from "../reviews/trading-room-scope";

export const PRINCIPAL_SCHEMA_VERSION = 1 as const;
export const PRINCIPAL_SETTINGS_KEY = "trading-room.principal.v1" as const;

export const PRINCIPAL_CATEGORIES = [
  "a-share-stock",
  "us-stock",
  "hk-stock",
  "etf",
] as const;

export type PrincipalCategory = (typeof PRINCIPAL_CATEGORIES)[number];
export type PrincipalCurrency = "CNY" | "USD" | "HKD";

export type PrincipalValue = {
  amount: string;
  currency: PrincipalCurrency;
};

export type PrincipalConfig = Partial<Record<PrincipalCategory, PrincipalValue>>;

export type PrincipalState = {
  version: typeof PRINCIPAL_SCHEMA_VERSION;
  scopes: Readonly<Record<string, PrincipalConfig>>;
};

export type PrincipalScope = Pick<RoomScope, "nature" | "simulationRunId">;

export type PrincipalMutation = {
  version: typeof PRINCIPAL_SCHEMA_VERSION;
  scope: PrincipalScope;
  category: PrincipalCategory;
  value: PrincipalValue | null;
};

export type PrincipalReturnMode = "principal" | "cost";

export type PrincipalReferenceSummary = {
  mode: PrincipalReturnMode;
  principalReturnPercent: string | null;
  costReturn: CostReturnSummary;
  netPnl: RoomMoneyView;
  principal: RoomMoneyView;
  principalByCategory: Readonly<Partial<Record<PrincipalCategory, PrincipalValue>>>;
  requiredCategories: readonly PrincipalCategory[];
  configuredCategories: readonly PrincipalCategory[];
  missingCategories: readonly PrincipalCategory[];
  fallbackReason: string | null;
};

export const PRINCIPAL_CATEGORY_LABELS: Record<PrincipalCategory, string> = {
  "a-share-stock": "A股股票",
  "us-stock": "美股股票",
  "hk-stock": "港股股票",
  etf: "ETF",
};

export const DEFAULT_PRINCIPAL_CURRENCIES: Record<PrincipalCategory, PrincipalCurrency> = {
  "a-share-stock": "CNY",
  "us-stock": "USD",
  "hk-stock": "HKD",
  etf: "CNY",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decimal(value: string | number | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
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

function isPrincipalCategory(value: string): value is PrincipalCategory {
  return (PRINCIPAL_CATEGORIES as readonly string[]).includes(value);
}

function isPrincipalCurrency(value: unknown): value is PrincipalCurrency {
  return value === "CNY" || value === "USD" || value === "HKD";
}

export function normalizePrincipalValue(value: unknown): PrincipalValue | undefined {
  if (!isRecord(value) || typeof value.amount !== "string" || !isPrincipalCurrency(value.currency)) return undefined;
  const amount = decimal(value.amount);
  if (!amount || !amount.gt(0)) return undefined;
  return { amount: amount.toString(), currency: value.currency };
}

export function principalScopeKey(scope: PrincipalScope): string {
  if (scope.nature === "live") return "live";
  if (scope.nature === "simulation" && scope.simulationRunId?.trim()) {
    return `simulation:${scope.simulationRunId.trim()}`;
  }
  return "unknown";
}

export function emptyPrincipalState(): PrincipalState {
  return { version: PRINCIPAL_SCHEMA_VERSION, scopes: {} };
}

export function normalizePrincipalState(value: unknown): PrincipalState {
  if (!isRecord(value) || value.version !== PRINCIPAL_SCHEMA_VERSION || !isRecord(value.scopes)) {
    return emptyPrincipalState();
  }
  const scopes: Record<string, PrincipalConfig> = {};
  for (const [scopeKey, rawConfig] of Object.entries(value.scopes)) {
    if (!(scopeKey === "live" || (scopeKey.startsWith("simulation:") && scopeKey.slice("simulation:".length).trim().length > 0)) || !isRecord(rawConfig)) continue;
    const config: PrincipalConfig = {};
    for (const [category, rawValue] of Object.entries(rawConfig)) {
      if (!isPrincipalCategory(category)) continue;
      const normalized = normalizePrincipalValue(rawValue);
      if (normalized) config[category] = normalized;
    }
    if (Object.keys(config).length > 0) scopes[scopeKey] = config;
  }
  return { version: PRINCIPAL_SCHEMA_VERSION, scopes };
}

export function principalConfigForScope(state: PrincipalState, scope: PrincipalScope): PrincipalConfig {
  return state.scopes[principalScopeKey(scope)] ?? {};
}

export function setPrincipalValue(
  state: PrincipalState,
  scope: PrincipalScope,
  category: PrincipalCategory,
  value: PrincipalValue | null,
): PrincipalState {
  const scopeKey = principalScopeKey(scope);
  if (scopeKey === "unknown") return state;
  const current = { ...(state.scopes[scopeKey] ?? {}) };
  if (value === null) delete current[category];
  else current[category] = value;
  const scopes = { ...state.scopes };
  if (Object.keys(current).length === 0) delete scopes[scopeKey];
  else scopes[scopeKey] = current;
  return { version: PRINCIPAL_SCHEMA_VERSION, scopes };
}

function validCategory(value: RoomAssetCategory): value is PrincipalCategory {
  return isPrincipalCategory(value);
}

function categoryLabel(category: PrincipalCategory): string {
  return PRINCIPAL_CATEGORY_LABELS[category];
}

function hasFineFilter(scope: RoomScope): boolean {
  return Boolean(
    scope.query?.trim() ||
    scope.accountIds.length > 0 ||
    scope.instrumentIds.length > 0 ||
    scope.markets.length > 0 ||
    scope.currencies.length > 0 ||
    scope.reviewStatuses.length > 0,
  );
}

function requiredCategories(rows: readonly TradingRoomRow[], scope: RoomScope): PrincipalCategory[] {
  if (validCategory(scope.assetCategory)) return [scope.assetCategory];
  if (scope.assetCategory !== "all") return [];
  return PRINCIPAL_CATEGORIES.filter(category => rows.some(row => row.assetCategory === category));
}

function ratioPercent(netPnl: RoomMoneyView, principal: RoomMoneyView): string | null {
  const netCurrencies = Object.keys(netPnl.originalByCurrency);
  const principalCurrencies = Object.keys(principal.originalByCurrency);
  if (netCurrencies.length === 1 && principalCurrencies.length === 1 && netCurrencies[0] === principalCurrencies[0]) {
    const numerator = decimal(netPnl.originalByCurrency[netCurrencies[0]]);
    const denominator = decimal(principal.originalByCurrency[principalCurrencies[0]]);
    if (numerator && denominator?.gt(0)) return numerator.div(denominator).times(100).toDecimalPlaces(16).toString();
  }
  if (netPnl.convertedCny === null || principal.convertedCny === null) return null;
  const numerator = decimal(netPnl.convertedCny);
  const denominator = decimal(principal.convertedCny);
  if (!numerator || !denominator || !denominator.gt(0)) return null;
  return numerator.div(denominator).times(100).toDecimalPlaces(16).toString();
}

function usableFxSnapshot(
  snapshot: RoomFxSnapshot | undefined,
  currencies: readonly string[],
): RoomFxSnapshot | undefined {
  if (!snapshot) return undefined;
  const foreignCurrencies = [...new Set(currencies.map(normalizedCurrency).filter(currency => currency && currency !== snapshot.baseCurrency))];
  const hasRates = foreignCurrencies.every(currency => {
    const value = decimal(snapshot.rates[`${currency}/${snapshot.baseCurrency}`] ?? snapshot.rates[`${currency}:${snapshot.baseCurrency}`]);
    return value !== null && value.gt(0);
  });
  if (!hasRates) return snapshot;
  if (snapshot.status === "complete") return snapshot;
  return { ...snapshot, status: "complete" };
}

function principalRows(rows: readonly TradingRoomRow[]): TradingRoomRow[] {
  return rows.filter(row => row.assetCategory !== "unknown" && row.trustedPnl !== null && row.row.item.episode.status === "closed");
}

function netPnlView(rows: readonly TradingRoomRow[], fxSnapshot?: RoomFxSnapshot): RoomMoneyView {
  return buildRoomMoneyView(
    principalRows(rows).flatMap(row => row.trustedPnl === null
      ? []
      : [{ currency: row.row.item.episode.instrument.currency, amount: row.trustedPnl }]),
    fxSnapshot,
  );
}

function principalValuesForScope(
  config: PrincipalConfig,
  scope: RoomScope,
): Partial<Record<PrincipalCategory, PrincipalValue>> {
  if (validCategory(scope.assetCategory)) {
    const value = config[scope.assetCategory];
    return value ? { [scope.assetCategory]: value } : {};
  }
  if (scope.assetCategory !== "all") return {};
  return Object.fromEntries(
    PRINCIPAL_CATEGORIES.flatMap(category => config[category] ? [[category, config[category]]] : []),
  ) as Partial<Record<PrincipalCategory, PrincipalValue>>;
}

function needsForeignExchange(
  rows: readonly TradingRoomRow[],
  values: Readonly<Partial<Record<PrincipalCategory, PrincipalValue>>>,
): boolean {
  return Object.values(values).some(value => value?.currency !== "CNY") || principalRows(rows).some(row => normalizedCurrency(row.row.item.episode.instrument.currency) !== "CNY");
}

export function buildPrincipalReferenceSummary(
  rows: readonly TradingRoomRow[],
  scope: RoomScope,
  state: PrincipalState,
  fxSnapshot?: RoomFxSnapshot,
): PrincipalReferenceSummary {
  const config = principalConfigForScope(normalizePrincipalState(state), scope);
  const required = requiredCategories(rows, scope);
  const values = principalValuesForScope(config, scope);
  const calculationCurrencies = [
    ...principalRows(rows).map(row => row.row.item.episode.instrument.currency),
    ...Object.values(values).map(value => value!.currency),
  ];
  const calculationFxSnapshot = usableFxSnapshot(fxSnapshot, calculationCurrencies);
  const costReturn = buildCostReturnSummary(rows, calculationFxSnapshot);
  const netPnl = netPnlView(rows, calculationFxSnapshot);
  const configuredCategories = PRINCIPAL_CATEGORIES.filter(category => Boolean(values[category]));
  const missingCategories = required.filter(category => !values[category]);
  const scopeUnavailable = scope.nature === "unknown" || (scope.nature === "simulation" && !scope.simulationRunId?.trim());
  const narrowed = hasFineFilter(scope);
  const principalAmounts = Object.values(values).map(value => ({ currency: value!.currency, amount: value!.amount }));
  const principal = buildRoomMoneyView(principalAmounts, calculationFxSnapshot);
  const directRatio = ratioPercent(netPnl, principal);
  const exchangeUnavailable = directRatio === null && needsForeignExchange(rows, values) && (principal.convertedCny === null || netPnl.convertedCny === null);

  let mode: PrincipalReturnMode = "principal";
  let fallbackReason: string | null = null;
  if (scopeUnavailable) {
    mode = "cost";
    fallbackReason = "当前范围没有可用的本金配置";
  } else if (narrowed) {
    mode = "cost";
    fallbackReason = "当前筛选无对应本金";
  } else if (missingCategories.length > 0) {
    mode = "cost";
    fallbackReason = `本金未填完整：缺少${missingCategories.map(categoryLabel).join("、")}`;
  } else if (exchangeUnavailable) {
    mode = "cost";
    fallbackReason = "本金参考收益率需要完整汇率快照";
  } else if (principalAmounts.length === 0) {
    mode = "cost";
    fallbackReason = "当前范围没有已填本金";
  }
  const principalReturnPercent = mode === "principal" ? directRatio : null;
  return {
    mode,
    principalReturnPercent,
    costReturn,
    netPnl,
    principal,
    principalByCategory: values,
    requiredCategories: required,
    configuredCategories,
    missingCategories,
    fallbackReason,
  };
}
