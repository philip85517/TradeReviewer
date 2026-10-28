import { openSqliteDatabase } from "../../../../../db/sqlite";
import { getSqliteStore } from "../../../../lib/storage/sqlite-store";
import { invalidTradeRequest, tradeFailure, tradeResponse } from "../../trades/http";

export const runtime = "nodejs";
export async function PUT(request: Request) {
  let value: unknown;
  try { value = await request.json(); } catch { return invalidTradeRequest(); }
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !["instrumentId", "name"].includes(key)) || !("instrumentId" in value) || !("name" in value) || typeof value.instrumentId !== "string" || typeof value.name !== "string") return invalidTradeRequest();
  try {
    getSqliteStore(openSqliteDatabase()).putInstrumentName({ instrumentId: value.instrumentId, name: value.name });
    return tradeResponse({ ok: true });
  } catch (error) { return tradeFailure(error); }
}
