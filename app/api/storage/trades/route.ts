import { openSqliteDatabase } from "../../../../db/sqlite";
import type { ImportHistoryEntry } from "../../../lib/storage/import-history";
import type { TradeExecution } from "../../../lib/trades/types";
import type { StoredInstrument } from "../../../lib/storage/sqlite-contracts";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";

export const runtime = "nodejs";

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function failure(code: "invalid-request" | "not-found" | "conflict" | "storage-unavailable", status: number) {
  return response({ error: { code, message: code.replaceAll("-", " ") } }, status);
}
function validation(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.startsWith("Invalid ") || error.message.startsWith("Unknown instrument:");
}
function parseMerge(value: unknown): { instruments?: StoredInstrument[]; executions: TradeExecution[]; importHistory?: ImportHistoryEntry[] } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.executions) || (body.instruments !== undefined && !Array.isArray(body.instruments)) || (body.importHistory !== undefined && !Array.isArray(body.importHistory))) return undefined;
  return { executions: body.executions as TradeExecution[], ...(body.instruments ? { instruments: body.instruments as StoredInstrument[] } : {}), ...(body.importHistory ? { importHistory: body.importHistory as ImportHistoryEntry[] } : {}) };
}

export async function GET() {
  try {
    const store = getSqliteStore(openSqliteDatabase());
    return response({ executions: store.getExecutions(), importHistory: store.getImportHistory(), instruments: store.getInstruments() });
  } catch { return failure("storage-unavailable", 503); }
}
export async function PUT(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return failure("invalid-request", 400); }
  const input = parseMerge(body);
  if (!input) return failure("invalid-request", 400);
  try { return response(getSqliteStore(openSqliteDatabase()).mergeTradeData(input)); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("Unknown instrument:")) return failure("not-found", 404);
    if (validation(error)) return failure("invalid-request", 400);
    return failure("storage-unavailable", 503);
  }
}
