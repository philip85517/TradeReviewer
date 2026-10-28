import { openSqliteDatabase } from "../../../../db/sqlite";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";
import { invalidTradeRequest, tradeFailure, tradeResponse as reply } from "../trades/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const instrumentId = new URL(request.url).searchParams.get("instrumentId");
  if (!instrumentId) return invalidTradeRequest();
  try { return reply(getSqliteStore(openSqliteDatabase()).getTradeRevisions(instrumentId)); }
  catch (error) { return tradeFailure(error); }
}
export async function POST(request: Request) {
  let input;
  try { input = await request.json(); } catch { return invalidTradeRequest(); }
  try { return reply(getSqliteStore(openSqliteDatabase()).reviseTrades(input)); }
  catch (error) { return tradeFailure(error); }
}
