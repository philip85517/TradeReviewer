import { openSqliteDatabase } from "../../../../db/sqlite";
import { readHomepageStoredCollection } from "../../../lib/storage/homepage-source-snapshot";
import { tradeFailure, tradeResponse } from "../trades/http";
export const runtime = "nodejs";
export async function GET() {
  try { return tradeResponse(readHomepageStoredCollection(openSqliteDatabase())); }
  catch (error) { return tradeFailure(error); }
}
