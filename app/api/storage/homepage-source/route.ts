import { openSqliteDatabase } from "../../../../db/sqlite";
import { readHomepageStoredCollection } from "../../../lib/storage/homepage-source-snapshot";

export const runtime = "nodejs";

import { invalidTradeRequest, tradeFailure, tradeResponse } from "../trades/http";
import { validBookVersion } from "../../../lib/storage/trade-read-contract";
import type { StoredTradeSelection } from "../../../lib/storage/trade-read-contract";

export async function GET(request?: Request) {
  let version: StoredTradeSelection["version"];
  const value = request ? new URL(request.url).searchParams.get("version") : null;
  if (value !== null) {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || ("exact" in parsed) === ("atLeast" in parsed) || !validBookVersion(parsed.exact ?? parsed.atLeast)) return invalidTradeRequest();
      version = parsed;
    } catch { return invalidTradeRequest(); }
  }
  try {
    return tradeResponse(readHomepageStoredCollection(openSqliteDatabase(), version));
  } catch (error) { return tradeFailure(error); }
}
