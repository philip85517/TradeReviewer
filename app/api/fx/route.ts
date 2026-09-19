import { openSqliteDatabase } from "../../../db/sqlite";
import {
  readFxSnapshot,
} from "../../lib/fx/storage";
import { refreshFxSnapshot } from "../../lib/fx/service";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    return json({ snapshot: readFxSnapshot(openSqliteDatabase()) });
  } catch {
    return json(
      { error: { code: "database-unavailable", message: "汇率快照存储不可用" } },
      503,
    );
  }
}

export async function POST(request?: Request) {
  void request;
  try {
    const result = await refreshFxSnapshot(openSqliteDatabase());
    return json(result, result.status === "unavailable" ? 503 : 200);
  } catch {
    return json(
      { error: { code: "database-unavailable", message: "汇率快照存储不可用" } },
      503,
    );
  }
}
