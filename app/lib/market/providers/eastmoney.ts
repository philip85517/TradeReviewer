import type {
  DailyCandleRequest,
  MarketDataProvider,
  ProviderDailyCandle,
  ProviderResult,
  SupportedMarket,
} from "../contracts";
import { providerSymbolCandidates } from "../symbol-map";
import { validateProviderCandles } from "../validation";
import { MarketDataProviderError, readProviderJson } from "./errors";

type EastmoneyEnvelope = {
  data?: {
    klines?: unknown;
  };
};

export function parseEastmoneyDaily(
  value: unknown,
): ProviderDailyCandle[] {
  const rows = (value as EastmoneyEnvelope)?.data?.klines;
  if (!Array.isArray(rows)) {
    throw new Error("东方财富行情响应格式已变化");
  }

  return rows.map((row) => {
    if (typeof row !== "string") {
      throw new Error("东方财富行情响应格式已变化");
    }
    const [tradingDate, open, close, high, low, volume] = row.split(",");
    if (![tradingDate, open, close, high, low, volume].every(Boolean)) {
      throw new Error("东方财富行情响应格式已变化");
    }
    return { tradingDate, open, high, low, close, volume };
  });
}

export class EastmoneyProvider implements MarketDataProvider {
  readonly id = "eastmoney" as const;

  supports(market: SupportedMarket) {
    return market === "CN-SH" || market === "CN-SZ";
  }

  async fetchDaily(
    request: DailyCandleRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<ProviderResult> {
    const providerSymbol = providerSymbolCandidates(
      this.id,
      request.market,
      request.symbol,
    )[0];
    if (!providerSymbol) {
      throw new MarketDataProviderError("no-data", "东方财富不支持该市场");
    }
    const query = new URLSearchParams({
      secid: providerSymbol,
      klt: "101",
      fqt: "0",
      beg: request.startDate.replaceAll("-", ""),
      end: request.endDate.replaceAll("-", ""),
      fields1: "f1,f2,f3,f4,f5,f6",
      fields2: "f51,f52,f53,f54,f55,f56",
    });
    const response = await fetcher(
      `https://push2his.eastmoney.com/api/qt/stock/kline/get?${query}`,
    );
    const value = await readProviderJson(response, "东方财富行情");
    try {
      const candles = parseEastmoneyDaily(value);
      validateProviderCandles(
        candles,
        request.startDate,
        request.endDate,
      );
      if (candles.length === 0) {
        throw new MarketDataProviderError(
          "no-data",
          "东方财富未返回该股票数据",
        );
      }
      return {
        provider: this.id,
        providerSymbol,
        fetchedAt: new Date().toISOString(),
        candles,
        warnings: [],
      };
    } catch (error) {
      if (error instanceof MarketDataProviderError) throw error;
      throw new MarketDataProviderError(
        "invalid-response",
        error instanceof Error ? error.message : "东方财富行情响应无效",
      );
    }
  }
}
