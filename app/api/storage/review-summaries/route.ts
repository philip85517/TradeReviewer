import { openSqliteDatabase } from "../../../../db/sqlite";
import { isReviewSummaryNote } from "../../../lib/reviews/review-summary";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";

export const runtime = "nodejs";

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function error(
  code: "invalid-request" | "not-found" | "conflict" | "storage-unavailable",
  status: number,
) {
  return response(
    { error: { code, message: code.replaceAll("-", " ") } },
    status,
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scopeId = url.searchParams.get("scopeId");
  const rangeId = url.searchParams.get("rangeId");
  if (!scopeId?.trim() || !rangeId?.trim()) return error("invalid-request", 400);
  try {
    const note = getSqliteStore(openSqliteDatabase()).getReviewSummary(
      scopeId,
      rangeId,
    );
    return note ? response(note) : error("not-found", 404);
  } catch {
    return error("storage-unavailable", 503);
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("invalid-request", 400);
  }
  if (!isReviewSummaryNote(body)) return error("invalid-request", 400);
  try {
    return getSqliteStore(openSqliteDatabase()).putReviewSummary(body)
      ? response(body)
      : error("conflict", 409);
  } catch (caught) {
    if (
      caught instanceof Error &&
      caught.message.startsWith("Invalid review summary")
    ) {
      return error("invalid-request", 400);
    }
    return error("storage-unavailable", 503);
  }
}
