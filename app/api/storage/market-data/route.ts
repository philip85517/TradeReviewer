import { openSqliteDatabase } from "../../../../db/sqlite";
import type { MarketCandleRecord } from "../../../lib/market/contracts";
import type { CoverageRecord, ProviderSymbolRecord } from "../../../lib/storage/sqlite-contracts";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";

export const runtime = "nodejs";
const intervals = new Set(["15m", "1D"]);
function response(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function invalid() { return response({ error: { code: "invalid-request", message: "invalid request" } }, 400); }
function validId(value: string | null) { return Boolean(value?.trim()); }
export async function GET(request: Request) {
  const url = new URL(request.url); const instrumentId = url.searchParams.get("instrumentId"); const interval = url.searchParams.get("interval"); const start = url.searchParams.get("start") ?? undefined; const end = url.searchParams.get("end") ?? undefined;
  if (!validId(instrumentId) || !interval || !intervals.has(interval) || (start && end && start > end)) return invalid();
  try { const store = getSqliteStore(openSqliteDatabase()); if (!store.getInstruments().some((item) => item.id === instrumentId)) return response({ error: { code: "not-found", message: "not found" } }, 404); return response({ candles: store.getMarketCandles(instrumentId!, interval as MarketCandleRecord["interval"], start, end), intervalCoverage: store.getIntervalCoverage().filter((item) => item.instrumentId === instrumentId && item.interval === interval) }); } catch (caught) { if (caught instanceof Error && caught.message.startsWith("Unknown instrument:")) return response({ error: { code: "not-found", message: "not found" } }, 404); return response({ error: { code: "storage-unavailable", message: "storage unavailable" } }, 503); }
}
export async function PUT(request: Request) {
  let value: unknown; try { value = await request.json(); } catch { return invalid(); }
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid(); const body = value as Record<string, unknown>;
  const collections = ["dailyCandles", "marketCandles", "coverage", "intervalCoverage", "providerSymbols"] as const;
  if (!collections.some((key) => body[key] !== undefined) || collections.some((key) => body[key] !== undefined && !Array.isArray(body[key]))) return invalid();
  try { getSqliteStore(openSqliteDatabase()).putMarketData({ dailyCandles: body.dailyCandles as never, marketCandles: body.marketCandles as MarketCandleRecord[] | undefined, coverage: body.coverage as CoverageRecord[] | undefined, intervalCoverage: body.intervalCoverage as never, providerSymbols: body.providerSymbols as ProviderSymbolRecord[] | undefined }); return response({ ok: true }); } catch (caught) { if (caught instanceof Error && caught.message.startsWith("Unknown instrument:")) return response({ error: { code: "not-found", message: "not found" } }, 404); if (caught instanceof Error && caught.message.startsWith("Invalid ")) return invalid(); return response({ error: { code: "storage-unavailable", message: "storage unavailable" } }, 503); }
}
