import { openSqliteDatabase } from "../../../../../db/sqlite";
import { listRecallReviewSummaries } from "../../../../lib/recall/server-repository";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return Response.json(
      { summaries: listRecallReviewSummaries(openSqliteDatabase()) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: { code: "storage-unavailable", message: "Recall summaries are unavailable" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
