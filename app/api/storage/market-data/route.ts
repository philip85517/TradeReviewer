import { openSqliteDatabase } from "../../../../db/sqlite";
import type { CoverageSegment, DailyCandleRecord, IntervalCoverageSegment, MarketCandleRecord } from "../../../lib/market/contracts";
import type { MarketDataJob } from "../../../lib/storage/market-data-jobs";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";

export const runtime = "nodejs";
const intervals = new Set(["15m", "1D"]);
const coverageStatuses = new Set(["not-requested", "syncing", "complete", "partial", "stale", "source-rate-limited", "source-forbidden", "source-unavailable", "invalid-response", "storage-error"]);
function response(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function invalid() { return response({ error: { code: "invalid-request", message: "invalid request" } }, 400); }
function validId(value: string | null) { return Boolean(value?.trim()); }
function record(value: unknown): Record<string, unknown> | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function providerSymbol(value: unknown): { provider: string; symbol: string } | undefined { const item = record(value); return item && typeof item.provider === "string" && typeof item.symbol === "string" ? { provider: item.provider, symbol: item.symbol } : undefined; }
function validCoverage(value: unknown): value is CoverageSegment { const item = record(value); return Boolean(item && typeof item.startDate === "string" && typeof item.endDate === "string" && typeof item.status === "string" && coverageStatuses.has(item.status) && Array.isArray(item.missingTradingDates) && item.missingTradingDates.every((date) => typeof date === "string")); }
function parseDailyCommit(value: unknown) { const item = record(value); if (!item || typeof item.instrumentId !== "string" || !Array.isArray(item.candles) || !Array.isArray(item.coverage)) return undefined; const symbol = providerSymbol(item.providerSymbol); if (!symbol || !item.coverage.every(validCoverage) || !item.candles.every((candle) => { const c = record(candle); return c && c.instrumentId === item.instrumentId && typeof c.tradingDate === "string" && typeof c.open === "string" && typeof c.high === "string" && typeof c.low === "string" && typeof c.close === "string" && typeof c.volume === "string" && typeof c.currency === "string" && typeof c.provider === "string" && typeof c.providerSymbol === "string" && c.adjustmentMode === "raw" && typeof c.fetchedAt === "string"; })) return undefined; return { instrumentId: item.instrumentId, candles: item.candles as DailyCandleRecord[], coverage: item.coverage as CoverageSegment[], providerSymbol: symbol }; }
function parseIntervalCommit(value: unknown) { const item = record(value); if (!item || typeof item.instrumentId !== "string" || (item.interval !== "15m" && item.interval !== "1D") || !Array.isArray(item.candles) || !Array.isArray(item.coverage)) return undefined; const interval = item.interval as "15m" | "1D"; const symbol = item.providerSymbol === undefined ? undefined : providerSymbol(item.providerSymbol); if (item.providerSymbol !== undefined && !symbol) return undefined; if (!item.coverage.every((coverage) => { const c = record(coverage); return c && c.interval === interval && typeof c.requestedStart === "string" && typeof c.requestedEnd === "string" && typeof c.status === "string" && coverageStatuses.has(c.status); }) || !item.candles.every((candle) => { const c = record(candle); return c && c.instrumentId === item.instrumentId && c.interval === interval && typeof c.timestamp === "string" && typeof c.open === "string" && typeof c.high === "string" && typeof c.low === "string" && typeof c.close === "string" && typeof c.volume === "string" && typeof c.currency === "string" && typeof c.provider === "string" && typeof c.providerSymbol === "string" && c.adjustmentMode === "raw" && typeof c.fetchedAt === "string"; })) return undefined; return { instrumentId: item.instrumentId, interval, candles: item.candles as MarketCandleRecord[], coverage: item.coverage as IntervalCoverageSegment[], ...(symbol ? { providerSymbol: symbol } : {}) }; }
function parseJob(value: unknown): MarketDataJob | undefined { const item = record(value); return item && typeof item.instrumentId === "string" && typeof item.symbol === "string" && typeof item.market === "string" && typeof item.requestedAt === "string" && typeof item.status === "string" && Array.isArray(item.intervals) ? item as MarketDataJob : undefined; }
export async function GET(request: Request) {
  const url = new URL(request.url);
  const instrumentId = url.searchParams.get("instrumentId");
  const provider = url.searchParams.get("provider");
  const interval = url.searchParams.get("interval");
  const start = url.searchParams.get("start") ?? undefined;
  const end = url.searchParams.get("end") ?? undefined;
  const dailyOnly = url.searchParams.get("dailyOnly");
  if (!validId(instrumentId) || (start && end && start > end)) return invalid();
  try {
    const store = getSqliteStore(openSqliteDatabase());
    if (!store.getInstruments().some((item) => item.id === instrumentId)) {
      return response({ error: { code: "not-found", message: "not found" } }, 404);
    }
    if (provider !== null) {
      if (!provider.trim() || interval || start || end || dailyOnly) return invalid();
      return response({ providerSymbol: store.getProviderSymbol(instrumentId!, provider) ?? null });
    }
    if (!interval || !intervals.has(interval) || (dailyOnly !== null && dailyOnly !== "true")) return invalid();
    const from = start ?? "0000-01-01T00:00:00.000Z";
    const to = end ?? "9999-12-31T23:59:59.999Z";
    const intervalCoverage = store.getIntervalCoverage().filter(
      (item) => item.instrumentId === instrumentId && item.interval === interval,
    );
    if (dailyOnly === "true") {
      if (interval !== "1D") return invalid();
      return response({
        dailyCandles: store.getDailyCandles(instrumentId!, from.slice(0, 10), to.slice(0, 10)),
        intervalCoverage,
        coverage: store.getCoverageSegments(instrumentId!),
      });
    }
    return response({
      candles: store.getCandles(instrumentId!, interval as MarketCandleRecord["interval"], from, to),
      intervalCoverage,
      ...(interval === "1D" ? { coverage: store.getCoverageSegments(instrumentId!) } : {}),
    });
  } catch (caught) {
    if (caught instanceof Error && caught.message.startsWith("Unknown instrument:")) {
      return response({ error: { code: "not-found", message: "not found" } }, 404);
    }
    return response({ error: { code: "storage-unavailable", message: "storage unavailable" } }, 503);
  }
}
export async function PUT(request: Request) {
  let value: unknown; try { value = await request.json(); } catch { return invalid(); }
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid(); const body = value as Record<string, unknown>;
  if (body.kind === "daily") { const result = parseDailyCommit(body.result); if (!result) return invalid(); try { getSqliteStore(openSqliteDatabase()).commitMarketData(result); return response({ ok: true }); } catch (caught) { if (caught instanceof Error && caught.message.startsWith("Unknown instrument:")) return response({ error: { code: "not-found", message: "not found" } }, 404); if (caught instanceof Error && caught.message.startsWith("Invalid ")) return invalid(); return response({ error: { code: "storage-unavailable", message: "storage unavailable" } }, 503); } }
  if (body.kind === "interval") { const result = parseIntervalCommit(body.result); if (!result) return invalid(); try { getSqliteStore(openSqliteDatabase()).commitIntervalMarketData(result); return response({ ok: true }); } catch (caught) { if (caught instanceof Error && caught.message.startsWith("Unknown instrument:")) return response({ error: { code: "not-found", message: "not found" } }, 404); if (caught instanceof Error && caught.message.startsWith("Invalid ")) return invalid(); return response({ error: { code: "storage-unavailable", message: "storage unavailable" } }, 503); } }
  if (body.kind === "job") { const job = parseJob(body.job); if (!job) return invalid(); try { getSqliteStore(openSqliteDatabase()).putMarketDataJob(job); return response(job); } catch (caught) { if (caught instanceof Error && caught.message.startsWith("Unknown instrument:")) return response({ error: { code: "not-found", message: "not found" } }, 404); if (caught instanceof Error && caught.message.startsWith("Invalid ")) return invalid(); return response({ error: { code: "storage-unavailable", message: "storage unavailable" } }, 503); } }
  return invalid();
}
