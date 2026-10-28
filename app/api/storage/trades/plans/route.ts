import { openSqliteDatabase } from "../../../../../db/sqlite";
import { createTradeChanges } from "../../../../lib/storage/trade-changes";
import type { TradeChangeIntent } from "../../../../lib/storage/sqlite-contracts";
import { invalidTradeRequest, tradeFailure, tradeResponse } from "../http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let value: unknown;
  try { value = await request.json(); } catch { return invalidTradeRequest(); }
  if (!value || typeof value !== "object" || Array.isArray(value) || !("kind" in value) || !["import", "revision", "material"].includes(String(value.kind))) return invalidTradeRequest();
  try { return tradeResponse(createTradeChanges(openSqliteDatabase()).prepare(value as TradeChangeIntent)); }
  catch (error) { return tradeFailure(error); }
}
