import { openSqliteDatabase } from "../../../../../db/sqlite";
import { createTradeChanges } from "../../../../lib/storage/trade-changes";
import { invalidTradeRequest, tradeFailure, tradeResponse } from "../http";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get("requestId");
  if (!requestId?.trim()) return invalidTradeRequest();
  try { return tradeResponse(createTradeChanges(openSqliteDatabase()).getCommit(requestId)); }
  catch (error) { return tradeFailure(error); }
}
