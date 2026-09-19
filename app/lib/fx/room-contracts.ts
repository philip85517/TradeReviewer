import type { RoomFxSnapshot } from "../reviews/trading-room-scope";

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

export function fxStatusForRates(rates: Readonly<Record<string, unknown>>): FxStatus {
  const count = REQUIRED_FOREIGN_CURRENCIES.filter((currency) => {
    const value = rates[currency];
    return typeof value === "string" && value.trim().length > 0;
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
    if (typeof rate !== "string" || !rate.trim()) return undefined;
    rates[`${currency}/CNY`] = rate;
  }
  return {
    id: state.id,
    baseCurrency: FX_BASE_CURRENCY,
    asOf: state.publishedAt ?? state.fetchedAt ?? "",
    source: state.source,
    status: state.status,
    rates,
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
