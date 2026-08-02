import { openSqliteDatabase } from "../../../../db/sqlite";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";

export const runtime = "nodejs";

const STORAGE_DATABASE_LABEL = "tradereview.sqlite";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    const status = getSqliteStore(openSqliteDatabase()).getStatus();
    return json({ ...status, databasePath: STORAGE_DATABASE_LABEL });
  } catch {
    return json(
      { error: { code: "database-unavailable", message: "Storage database is unavailable" } },
      503,
    );
  }
}
