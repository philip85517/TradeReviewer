export const FX_CURRENCIES = ["CNY", "HKD", "USD"] as const;

export type FxCurrency = (typeof FX_CURRENCIES)[number];

export type FxRates = Readonly<Record<FxCurrency, number>>;

export type FxSource = Readonly<{
  id: "frankfurter-ecb";
  label: string;
  url: string;
  attributionUrl: string;
}>;

export type FxSnapshot = {
  version: 1;
  baseCurrency: "CNY";
  rates: FxRates;
  source: FxSource;
  rateDate: string;
  fetchedAt: string;
  lastAttemptedAt: string;
  cacheStatus: "fresh" | "cached";
  lastError?: string;
};

export type FxRefreshStatus = "fresh" | "cached" | "unavailable";

export type FxProblem = {
  code: string;
  message: string;
};

export type FxReadResponse = {
  snapshot: FxSnapshot | null;
};

export type FxRefreshResponse = FxReadResponse & {
  status: FxRefreshStatus;
  error?: FxProblem;
};

export function isFxCurrency(value: unknown): value is FxCurrency {
  return typeof value === "string" && (FX_CURRENCIES as readonly string[]).includes(value);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

export function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function isFxRates(value: unknown): value is FxRates {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rates = value as Record<string, unknown>;
  return FX_CURRENCIES.every((currency) => {
    const rate = rates[currency];
    return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
  }) && rates.CNY === 1;
}

export function isFxSnapshot(value: unknown): value is FxSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  const source = snapshot.source;
  return snapshot.version === 1 &&
    snapshot.baseCurrency === "CNY" &&
    isFxRates(snapshot.rates) &&
    Boolean(source) &&
    typeof source === "object" &&
    !Array.isArray(source) &&
    (source as Record<string, unknown>).id === "frankfurter-ecb" &&
    typeof (source as Record<string, unknown>).label === "string" &&
    typeof (source as Record<string, unknown>).url === "string" &&
    typeof (source as Record<string, unknown>).attributionUrl === "string" &&
    isIsoDate(snapshot.rateDate) &&
    isIsoTimestamp(snapshot.fetchedAt) &&
    isIsoTimestamp(snapshot.lastAttemptedAt) &&
    (snapshot.cacheStatus === "fresh" || snapshot.cacheStatus === "cached") &&
    (snapshot.lastError === undefined || typeof snapshot.lastError === "string");
}

export function assertFxSnapshot(value: unknown): asserts value is FxSnapshot {
  if (!isFxSnapshot(value)) {
    throw new Error("FX snapshot is incomplete or invalid");
  }
}
