import { openSqliteDatabase } from "../../../../db/sqlite";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    return json(getSqliteStore(openSqliteDatabase()).getBootstrap());
  } catch {
    return json(
      { error: { code: "database-unavailable", message: "Storage database is unavailable" } },
      503,
    );
  }
}
