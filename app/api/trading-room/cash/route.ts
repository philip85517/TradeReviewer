import { openSqliteDatabase } from "../../../../db/sqlite";
import { FX_SETTINGS_KEY, toRoomFxSnapshot, type FxState } from "../../../lib/fx/room-contracts";
import {
  CASH_SETTINGS_KEY,
  buildCashSummary,
  parseCashBaselineState,
  type CashScope,
  type CashInstrumentMetadata,
} from "../../../lib/cash/cash-model";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";
import type { StoredInstrument } from "../../../lib/storage/sqlite-contracts";
import type { TradeExecution } from "../../../lib/trades/types";
import type { RoomTargetCurrency } from "../../../lib/reviews/trading-room-scope";

export const runtime = "nodejs";

export type CashReadStore = {
  getSettings: () => Record<string, unknown>;
  putSettings: (settings: Record<string, unknown>) => void;
  getExecutions: () => TradeExecution[];
  getInstruments: () => StoredInstrument[];
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function error(code: "invalid-request" | "storage-unavailable", message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseScope(url: URL): CashScope | Response {
  const nature = url.searchParams.get("nature");
  const simulationRunId = url.searchParams.get("simulationRunId");
  if (nature !== "live" && nature !== "simulation") return error("invalid-request", "现金范围无效", 400);
  if (nature === "live") {
    if (simulationRunId !== null) return error("invalid-request", "实盘范围不能指定模拟运行", 400);
    return { nature: "live", simulationRunId: null };
  }
  if (!simulationRunId?.trim()) return error("invalid-request", "模拟范围必须指定运行", 400);
  return { nature: "simulation", simulationRunId: simulationRunId.trim() };
}

function parseAccountIds(url: URL): string[] {
  return [...new Set([
    ...url.searchParams.getAll("accountId"),
    ...(url.searchParams.get("accountIds")?.split(",") ?? []),
  ].map((value) => value.trim()).filter(Boolean))];
}

function parseTargetCurrency(url: URL): RoomTargetCurrency | Response {
  const value = url.searchParams.get("targetCurrency") ?? "CNY";
  if (value !== "CNY" && value !== "HKD") return error("invalid-request", "现金计价币种无效", 400);
  return value;
}

function readFxSnapshot(store: CashReadStore) {
  const raw = store.getSettings()[FX_SETTINGS_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  try { return toRoomFxSnapshot(raw as FxState); } catch { return undefined; }
}

function metadataFrom(instruments: readonly StoredInstrument[]): ReadonlyMap<string, CashInstrumentMetadata | undefined> {
  return new Map(instruments.map((instrument) => {
    const metadata = instrument.metadata;
    if (!metadata || (metadata.assetType !== "stock" && metadata.assetType !== "etf")) return [instrument.id, undefined] as const;
    return [instrument.id, { market: metadata.market, symbol: metadata.symbol, assetType: metadata.assetType }] as const;
  }));
}

export function createCashHandlers(store: CashReadStore) {
  return {
    async GET(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const scope = parseScope(url);
      if (scope instanceof Response) return scope;
      const targetCurrency = parseTargetCurrency(url);
      if (targetCurrency instanceof Response) return targetCurrency;
      const today = url.searchParams.get("today");
      if (today !== null && !validDate(today)) return error("invalid-request", "现金日期无效", 400);
      try {
        const settings = store.getSettings();
        const baselineState = parseCashBaselineState(settings[CASH_SETTINGS_KEY]);
        const summary = buildCashSummary({
          executions: store.getExecutions(),
          baselines: baselineState.records,
          scope,
          accountIds: parseAccountIds(url),
          today: today ?? undefined,
          targetCurrency,
          fxSnapshot: readFxSnapshot(store),
          instrumentMetadata: metadataFrom(store.getInstruments()),
        });
        return json(summary);
      } catch {
        return error("storage-unavailable", "现金数据暂时不可用", 503);
      }
    },
  };
}

function defaultStore(): CashReadStore {
  return getSqliteStore(openSqliteDatabase());
}

export async function GET(request: Request): Promise<Response> {
  try { return await createCashHandlers(defaultStore()).GET(request); }
  catch { return error("storage-unavailable", "现金数据暂时不可用", 503); }
}
