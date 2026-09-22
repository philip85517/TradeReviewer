import { writeFileSync } from "node:fs";
import type { DailyCandleRequest, IntradayCandleRequest, MarketDataProvider, SupportedMarket } from "../app/lib/market/contracts";
import { BaoStockProvider } from "../app/lib/market/providers/baostock";
import { BaiduProvider } from "../app/lib/market/providers/baidu";
import { EastmoneyProvider } from "../app/lib/market/providers/eastmoney";
import { SinaUsProvider } from "../app/lib/market/providers/sina-us";
import { TencentProvider } from "../app/lib/market/providers/tencent";
import { YahooProvider } from "../app/lib/market/providers/yahoo";
import { readTigerOpenApiConfig } from "../app/lib/market/tiger-config";
import { TigerProvider } from "../app/lib/market/providers/tiger";

type Item = { market: SupportedMarket; kind: "stock" | "etf"; symbol: string };
type Probe = { provider: string; market: SupportedMarket; kind: Item["kind"]; symbol: string; timeframe: "1D" | "1H"; status: "ok" | "no-data" | "error" | "not-configured"; candles: number; first?: string; last?: string; sample?: Record<string, string>; message?: string; supports: boolean; durationMs: number };
const items: Item[] = [
  { market: "US", kind: "stock", symbol: "AAPL" }, { market: "US", kind: "etf", symbol: "SPY" },
  { market: "HK", kind: "stock", symbol: "0700" }, { market: "HK", kind: "etf", symbol: "2800" },
  { market: "CN-SH", kind: "stock", symbol: "600519" }, { market: "CN-SH", kind: "etf", symbol: "510300" },
  { market: "CN-SZ", kind: "stock", symbol: "000001" }, { market: "CN-SZ", kind: "etf", symbol: "159919" },
];
const providers: Array<{ id: string; provider?: MarketDataProvider }> = [
  { id: "tencent", provider: new TencentProvider() }, { id: "eastmoney", provider: new EastmoneyProvider() }, { id: "yahoo", provider: new YahooProvider() },
  { id: "baidu", provider: new BaiduProvider() }, { id: "sina", provider: new SinaUsProvider() }, { id: "baostock", provider: new BaoStockProvider() },
];
const tiger = readTigerOpenApiConfig(); providers.push(tiger ? { id: "tiger", provider: new TigerProvider(tiger) } : { id: "tiger" });
const dailyWindow = { startDate: "2026-09-08", endDate: "2026-09-15" };
const hourlyWindow = { startTime: "2026-09-08T00:00:00.000Z", endTime: "2026-09-15T23:59:59.999Z" };

async function probe(id: string, provider: MarketDataProvider | undefined, item: Item, timeframe: Probe["timeframe"]): Promise<Probe> {
  const startedAt = performance.now();
  if (!provider) return { provider: id, ...item, timeframe, status: "not-configured", candles: 0, supports: false, message: "TIGER_OPENAPI_CONFIG 未配置或无效", durationMs: 0 };
  const supports = provider.supports(item.market);
  if (!supports) return { provider: id, ...item, timeframe, status: "no-data", candles: 0, supports, message: "provider 不支持该市场", durationMs: 0 };
  try {
    if (timeframe === "1D") {
      const r = await provider.fetchDaily({ instrumentId: `${item.market}:${item.symbol}`, market: item.market, symbol: item.symbol, ...dailyWindow } satisfies DailyCandleRequest);
      const first = r.candles[0], last = r.candles.at(-1);
      return { provider: id, ...item, timeframe, status: r.candles.length ? "ok" : "no-data", candles: r.candles.length, first: first?.tradingDate, last: last?.tradingDate, sample: first && { open: first.open, high: first.high, low: first.low, close: first.close, volume: first.volume }, supports, message: r.warnings.join(",") || undefined, durationMs: Math.round(performance.now() - startedAt) };
    }
    const r = await provider.fetchIntraday({ instrumentId: `${item.market}:${item.symbol}`, market: item.market, symbol: item.symbol, interval: "1h", ...hourlyWindow } satisfies IntradayCandleRequest);
    const first = r.candles[0], last = r.candles.at(-1);
    return { provider: id, ...item, timeframe, status: r.candles.length ? "ok" : "no-data", candles: r.candles.length, first: first?.timestamp, last: last?.timestamp, sample: first && { open: first.open, high: first.high, low: first.low, close: first.close, volume: first.volume }, supports, message: r.warnings.join(",") || undefined, durationMs: Math.round(performance.now() - startedAt) };
  } catch (error) { return { provider: id, ...item, timeframe, status: "error", candles: 0, supports, message: error instanceof Error ? error.message : String(error), durationMs: Math.round(performance.now() - startedAt) }; }
}

const jobs = providers.flatMap(({ id, provider }) => items.flatMap(item => [() => probe(id, provider, item, "1D"), () => probe(id, provider, item, "1H")]));
const results: Probe[] = [];
let cursor = 0;
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    results.push(await job());
  }
}
await Promise.all(Array.from({ length: 4 }, () => worker()));
writeFileSync(".scratch/source-probe-results.json", JSON.stringify({ generatedAt: new Date().toISOString(), dailyWindow, hourlyWindow, results }, null, 2));
console.log(JSON.stringify(results));
