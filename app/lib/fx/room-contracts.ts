import type { RoomFxSnapshot } from "../reviews/trading-room-scope";
import Decimal from "decimal.js";

export const FX_SETTINGS_KEY = "trading-room.fx" as const;
export const BOC_FX_SOURCE_URL = "https://www.boc.cn/sourcedb/whpj/" as const;
export const FX_SOURCE = "BOC" as const;
export const FX_BASE_CURRENCY = "CNY" as const;
export const REQUIRED_FOREIGN_CURRENCIES = ["USD", "HKD"] as const;

export type RequiredForeignCurrency = (typeof REQUIRED_FOREIGN_CURRENCIES)[number];
export type FxStatus = "complete" | "partial" | "missing";

export type FxState = {
  id: string;
  baseCurrency: typeof FX_BASE_CURRENCY;
  source: typeof FX_SOURCE;
  publishedAt: string | null;
  publishedAtByCurrency: Readonly<Record<string, string>>;
  fetchedAt: string | null;
  rates: Readonly<Record<string, string>>;
  lastAttemptDay: string | null;
  status: FxStatus;
  error: string | null;
};

export type FxStateResponse = FxState;

export type CanonicalFxPublicationIdentity = {
  id: string;
  asOf: string;
  status: FxStatus;
  source: string;
  baseCurrency: typeof FX_BASE_CURRENCY;
  publishedAt: string | null;
  publishedAtByCurrency: Readonly<Record<string, string>>;
  rates: Readonly<Record<string, string>>;
};

function sortRecord<T>(record: Readonly<Record<string, T>> | undefined): Readonly<Record<string, T>> {
  const source = record ?? {};
  const sorted: Record<string, T> = {};
  for (const key of Object.keys(source).sort((left, right) => left < right ? -1 : left > right ? 1 : 0)) {
    sorted[key] = source[key];
  }
  return sorted;
}

/**
 * Returns the stable financial publication boundary for a room FX snapshot.
 * Fetch/attempt/error metadata is intentionally excluded: those fields do not
 * prove that a new rate publication is available.
 */
export function canonicalFxPublicationIdentity(
  snapshot: RoomFxSnapshot | null | undefined,
): CanonicalFxPublicationIdentity | null {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    asOf: snapshot.asOf,
    status: snapshot.status,
    source: snapshot.source,
    baseCurrency: snapshot.baseCurrency,
    publishedAt: snapshot.publishedAt ?? null,
    publishedAtByCurrency: sortRecord(snapshot.publishedAtByCurrency),
    rates: sortRecord(snapshot.rates),
  };
}

function isUsableRate(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = new Decimal(value.trim());
    return parsed.isFinite() && parsed.gt(0);
  } catch {
    return false;
  }
}

export function fxStatusForRates(rates: Readonly<Record<string, unknown>>): FxStatus {
  const count = REQUIRED_FOREIGN_CURRENCIES.filter((currency) => {
    return isUsableRate(rates[currency]);
  }).length;
  if (count === REQUIRED_FOREIGN_CURRENCIES.length) return "complete";
  if (count > 0) return "partial";
  return "missing";
}

export function toRoomFxSnapshot(state: FxState | null | undefined): RoomFxSnapshot | undefined {
  if (!state || !state.publishedAt && !state.fetchedAt) return undefined;
  if (state.status === "missing" || Object.keys(state.rates).length === 0) return undefined;
  const rates: Record<string, string> = {};
  for (const currency of REQUIRED_FOREIGN_CURRENCIES) {
    const rate = state.rates[currency];
    if (isUsableRate(rate)) rates[`${currency}/CNY`] = rate.trim();
  }
  if (Object.keys(rates).length === 0) return undefined;
  const status: FxStatus = state.status === "complete" && Object.keys(rates).length < REQUIRED_FOREIGN_CURRENCIES.length
    ? "partial"
    : state.status;
  return {
    id: state.id,
    baseCurrency: FX_BASE_CURRENCY,
    asOf: state.publishedAt ?? state.fetchedAt ?? "",
    source: state.source,
    status,
    rates,
    publishedAt: state.publishedAt,
    publishedAtByCurrency: { ...state.publishedAtByCurrency },
    fetchedAt: state.fetchedAt,
    error: state.error,
    lastAttemptDay: state.lastAttemptDay,
  };
}

export function emptyFxState(): FxState {
  return {
    id: "fx:empty",
    baseCurrency: FX_BASE_CURRENCY,
    source: FX_SOURCE,
    publishedAt: null,
    publishedAtByCurrency: {},
    fetchedAt: null,
    rates: {},
    lastAttemptDay: null,
    status: "missing",
    error: null,
  };
}
