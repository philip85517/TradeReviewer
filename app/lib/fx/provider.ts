import {
  type FxSnapshot,
  type FxRates,
  isFxRates,
  isIsoDate,
} from "./contracts";

export const FX_PROVIDER_ENDPOINT =
  "https://api.frankfurter.dev/v2/providers/ecb/rates?base=CNY&quotes=HKD,USD";

export const FX_SOURCE = {
  id: "frankfurter-ecb",
  label: "Frankfurter（ECB 参考汇率）",
  url: FX_PROVIDER_ENDPOINT,
  attributionUrl:
    "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
} as const;

export type FxProviderErrorCode =
  | "source-unavailable"
  | "invalid-response"
  | "timeout";

export class FxProviderError extends Error {
  constructor(
    readonly code: FxProviderErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "FxProviderError";
  }
}

type ProviderRate = {
  base?: unknown;
  quote?: unknown;
  rate?: unknown;
  date?: unknown;
};

export type FxFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type FetchLatestOptions = {
  fetcher?: FxFetcher;
  now?: () => Date;
  timeoutMs?: number;
};

function providerMessage(error: unknown) {
  return error instanceof Error ? error.message : "汇率源暂时不可用";
}

function parseProviderRates(value: unknown): { date: string; rates: FxRates } {
  if (!Array.isArray(value) || value.length === 0) {
    throw new FxProviderError("invalid-response", "汇率源返回了空数据");
  }

  const rates = { CNY: 1 } as Record<keyof FxRates, number>;
  let date: string | undefined;
  const seen = new Set<"HKD" | "USD">();
  for (const rawRow of value) {
    if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) {
      throw new FxProviderError("invalid-response", "汇率源返回了无法识别的数据");
    }
    const row = rawRow as ProviderRate;
    if (row.base !== "CNY" || !isIsoDate(row.date)) {
      throw new FxProviderError("invalid-response", "汇率源返回了无法识别的数据");
    }
    if (date && date !== row.date) {
      throw new FxProviderError("invalid-response", "汇率源返回了不同日期的数据");
    }
    date = row.date;
    if (row.quote !== "HKD" && row.quote !== "USD") {
      throw new FxProviderError("invalid-response", "汇率源返回了意外的货币报价");
    }
    if (seen.has(row.quote)) {
      throw new FxProviderError("invalid-response", `汇率源重复返回 ${row.quote} 报价`);
    }
    seen.add(row.quote);
    if (typeof row.rate !== "number" || !Number.isFinite(row.rate) || row.rate <= 0) {
      throw new FxProviderError("invalid-response", `汇率源返回了无效的 ${row.quote} 汇率`);
    }
    // Frankfurter reports quote units per one CNY here. The library
    // contract deliberately exposes CNY per one source currency.
    rates[row.quote] = 1 / row.rate;
  }

  if (!date || !isFxRates(rates)) {
    throw new FxProviderError("invalid-response", "汇率源缺少 CNY、HKD 或 USD 完整报价");
  }
  return { date, rates };
}

export async function fetchLatestFxSnapshot({
  fetcher = fetch,
  now = () => new Date(),
  timeoutMs = 10_000,
}: FetchLatestOptions = {}): Promise<FxSnapshot> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const body = await new Promise<unknown>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        callback();
      };
      timer = setTimeout(() => {
        finish(() => {
          controller.abort();
          reject(new FxProviderError("timeout", "汇率源响应超时"));
        });
      }, timeoutMs);
      Promise.resolve()
        .then(() => fetcher(FX_PROVIDER_ENDPOINT, {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        }))
        .then(async (response) => {
          if (!response.ok) {
            finish(() => reject(new FxProviderError(
              "source-unavailable",
              `汇率源返回 HTTP ${response.status}`,
            )));
            return;
          }
          try {
            const parsed = await response.json();
            finish(() => resolve(parsed));
          } catch (error) {
            finish(() => reject(new FxProviderError(
              "invalid-response",
              "汇率源返回了无法解析的 JSON",
              { cause: error },
            )));
          }
        })
        .catch((error: unknown) => finish(() => reject(error)));
    });
    const parsed = parseProviderRates(body);
    const fetchedAt = now().toISOString();
    return {
      version: 1,
      baseCurrency: "CNY",
      rates: parsed.rates,
      source: FX_SOURCE,
      rateDate: parsed.date,
      fetchedAt,
      lastAttemptedAt: fetchedAt,
      cacheStatus: "fresh",
    };
  } catch (error) {
    if (error instanceof FxProviderError) throw error;
    throw new FxProviderError("source-unavailable", providerMessage(error), {
      cause: error,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
