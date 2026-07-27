import type {
  DailyCandleRequest,
  MarketDataProvider,
  ProviderDailyCandle,
  ProviderResult,
} from "../contracts";
import { providerSymbolCandidates } from "../symbol-map";
import { validateProviderCandles } from "../validation";
import { MarketDataProviderError, readProviderJson } from "./errors";

type TencentEnvelope = {
  data?: Record<
    string,
    {
      day?: unknown;
    }
  >;
};

export function parseTencentDaily(
  value: unknown,
  providerSymbol: string,
): ProviderDailyCandle[] {
  const rows = (value as TencentEnvelope)?.data?.[providerSymbol]?.day;
  if (!Array.isArray(rows)) {
    throw new Error("腾讯行情响应格式已变化");
  }

  return rows.map((row) => {
    if (
      !Array.isArray(row) ||
      row.length < 6 ||
      !row.slice(0, 6).every((item) => typeof item === "string")
    ) {
      throw new Error("腾讯行情响应格式已变化");
    }
    const [tradingDate, open, close, high, low, volume] = row as string[];
    return { tradingDate, open, high, low, close, volume };
  });
}

export class TencentProvider implements MarketDataProvider {
  readonly id = "tencent" as const;

  supports() {
    return true;
  }

  async fetchDaily(
    request: DailyCandleRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<ProviderResult> {
    for (const providerSymbol of providerSymbolCandidates(
      this.id,
      request.market,
      request.symbol,
    )) {
      const params = [
        providerSymbol,
        "day",
        request.startDate,
        request.endDate,
        "500",
        "",
      ].join(",");
      const response = await fetcher(
        `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${encodeURIComponent(params)}`,
      );
      const value = await readProviderJson(response, "腾讯行情");
      let candles: ProviderDailyCandle[];
      try {
        candles = parseTencentDaily(value, providerSymbol);
        validateProviderCandles(
          candles,
          request.startDate,
          request.endDate,
        );
      } catch (error) {
        throw new MarketDataProviderError(
          "invalid-response",
          error instanceof Error ? error.message : "腾讯行情响应无效",
        );
      }
      if (candles.length === 0) continue;
      return {
        provider: this.id,
        providerSymbol,
        fetchedAt: new Date().toISOString(),
        candles,
        warnings: [],
      };
    }
    throw new MarketDataProviderError(
      "no-data",
      "腾讯行情未返回该股票数据",
    );
  }
}
