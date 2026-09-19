import Decimal from "decimal.js";

import {
  BOC_FX_SOURCE_URL,
  emptyFxState,
  FX_SETTINGS_KEY,
  FX_BASE_CURRENCY,
  FX_SOURCE,
  fxStatusForRates,
  REQUIRED_FOREIGN_CURRENCIES,
  type FxState,
} from "./room-contracts";
import { parseBocRates, type ParsedBocRate } from "./boc-parser";

export type FxSettingsStore = {
  getSettings: () => Record<string, unknown>;
  putSettings: (settings: Record<string, unknown>) => void;
};

export type FxFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type FxServiceOptions = {
  store: FxSettingsStore;
  fetcher?: FxFetcher;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
  maxAttempts?: number;
};

export type FxService = {
  read: () => FxState;
  refresh: () => Promise<FxState>;
  ensureDaily: () => Promise<FxState>;
};

const SHANGHAI_TIME_ZONE = "Asia/Shanghai";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_ATTEMPTS = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validDateOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) return undefined;
  return value;
}

function readPersistedState(value: unknown): FxState {
  if (!isRecord(value)) return emptyFxState();
  const id = typeof value.id === "string" && value.id.trim() ? value.id : undefined;
  const publishedAt = validDateOrNull(value.publishedAt);
  const fetchedAt = validDateOrNull(value.fetchedAt);
  const lastAttemptDay = value.lastAttemptDay === null
    ? null
    : typeof value.lastAttemptDay === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value.lastAttemptDay)
      ? value.lastAttemptDay
      : undefined;
  const status = value.status === "complete" || value.status === "partial" || value.status === "missing"
    ? value.status
    : undefined;
  if (!id || publishedAt === undefined || fetchedAt === undefined || lastAttemptDay === undefined || !status) return emptyFxState();
  if (value.baseCurrency !== FX_BASE_CURRENCY || value.source !== FX_SOURCE) return emptyFxState();
  if (!isRecord(value.rates) || !isRecord(value.publishedAtByCurrency)) return emptyFxState();
  const rates: Record<string, string> = {};
  for (const [currency, rate] of Object.entries(value.rates)) {
    if (typeof rate !== "string" || !rate.trim()) return emptyFxState();
    try {
      const parsed = new Decimal(rate);
      if (!parsed.isFinite() || parsed.lte(0)) return emptyFxState();
    } catch {
      return emptyFxState();
    }
    rates[currency] = rate;
  }
  const publishedAtByCurrency: Record<string, string> = {};
  for (const [currency, timestamp] of Object.entries(value.publishedAtByCurrency)) {
    if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))) return emptyFxState();
    publishedAtByCurrency[currency] = timestamp;
  }
  return {
    id,
    baseCurrency: FX_BASE_CURRENCY,
    source: FX_SOURCE,
    publishedAt,
    publishedAtByCurrency,
    fetchedAt,
    rates,
    lastAttemptDay,
    status,
    error: value.error === null ? null : typeof value.error === "string" ? value.error : null,
  };
}

function storedState(store: FxSettingsStore): FxState {
  return readPersistedState(store.getSettings()[FX_SETTINGS_KEY]);
}

function shanghaiDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function failureMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 240);
  return "汇率更新失败";
}

function publishedAtFor(rows: Iterable<ParsedBocRate>): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    if (!latest || Date.parse(row.publishedAt) > Date.parse(latest)) latest = row.publishedAt;
  }
  return latest;
}

function successState(rows: Map<string, ParsedBocRate>, fetchedAt: Date, day: string): FxState {
  const rates: Record<string, string> = {};
  const publishedAtByCurrency: Record<string, string> = {};
  for (const [currency, row] of rows) {
    rates[currency] = row.rate;
    publishedAtByCurrency[currency] = row.publishedAt;
  }
  if (Object.keys(rates).length === 0) throw new Error("未找到可用汇率");
  const status = fxStatusForRates(rates);
  const missing = REQUIRED_FOREIGN_CURRENCIES.filter((currency) => !rates[currency]);
  const currencyNames: Record<string, string> = { USD: "美元", HKD: "港币" };
  const error = missing.length
    ? `缺少${missing.map((currency) => currencyNames[currency] ?? currency).join("、")}汇率`
    : null;
  return {
    id: `boc:${fetchedAt.toISOString()}`,
    baseCurrency: FX_BASE_CURRENCY,
    source: FX_SOURCE,
    publishedAt: publishedAtFor(rows.values()),
    publishedAtByCurrency,
    fetchedAt: fetchedAt.toISOString(),
    rates,
    lastAttemptDay: day,
    status,
    error,
  };
}

async function fetchBocHtml(options: Required<Pick<FxServiceOptions, "fetcher" | "sleep" | "timeoutMs" | "maxAttempts">>): Promise<string> {
  let lastError: unknown = new Error("汇率更新失败");
  for (let attempt = 0; attempt < options.maxAttempts; attempt += 1) {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error("汇率源请求超时"));
        }, options.timeoutMs);
      });
      const response = await Promise.race([
        options.fetcher(BOC_FX_SOURCE_URL, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
          headers: { accept: "text/html" },
        }),
        timeout,
      ]);
      if (!response.ok) throw new Error(`汇率源响应 ${response.status}`);
      return await Promise.race([response.text(), timeout]);
    } catch (error) {
      lastError = error;
      if (attempt + 1 < options.maxAttempts) await options.sleep(50 * (attempt + 1));
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }
  throw lastError;
}

export function createFxService(options: FxServiceOptions): FxService {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS));
  let inFlight: Promise<FxState> | null = null;

  const read = () => storedState(options.store);

  const persistFailure = (previous: FxState, error: unknown, attemptedAt: Date, day: string): FxState => {
    const next: FxState = {
      ...previous,
      id: previous.fetchedAt ? previous.id : `fx:missing:${attemptedAt.toISOString()}`,
      lastAttemptDay: day,
      error: `更新失败：${failureMessage(error)}`,
    };
    options.store.putSettings({ [FX_SETTINGS_KEY]: next });
    return next;
  };

  const runRefresh = async (): Promise<FxState> => {
    const attemptedAt = new Date(now());
    const day = shanghaiDayKey(attemptedAt);
    const previous = read();
    try {
      const html = await fetchBocHtml({ fetcher, sleep, timeoutMs, maxAttempts });
      const rows = parseBocRates(html);
      const next = successState(rows, attemptedAt, day);
      options.store.putSettings({ [FX_SETTINGS_KEY]: next });
      return next;
    } catch (error) {
      return persistFailure(previous, error, attemptedAt, day);
    }
  };

  const refresh = (): Promise<FxState> => {
    if (inFlight) return inFlight;
    const promise = runRefresh();
    inFlight = promise;
    void promise.then(() => {
      if (inFlight === promise) inFlight = null;
    }, () => {
      if (inFlight === promise) inFlight = null;
    });
    return promise;
  };

  const ensureDaily = async (): Promise<FxState> => {
    const current = read();
    if (current.lastAttemptDay === shanghaiDayKey(new Date(now()))) return current;
    return refresh();
  };

  return { read, refresh, ensureDaily };
}
