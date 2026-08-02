import { openSqliteDatabase } from "../../../../db/sqlite";
import type { EpisodeReviewRecord } from "../../../lib/reviews/types";
import type { TagSuggestionRecord } from "../../../lib/insights/types";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";

export const runtime = "nodejs";
function response(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function error(code: "invalid-request" | "not-found" | "conflict" | "storage-unavailable", status: number) { return response({ error: { code, message: code.replaceAll("-", " ") } }, status); }
function nonEmpty(value: string | null) { return value !== null && value.trim().length > 0; }
function isReview(value: unknown): value is EpisodeReviewRecord { return Boolean(value && typeof value === "object" && (value as { version?: unknown }).version === 1 && "plan" in value && "review" in value); }
function isSuggestion(value: unknown): value is TagSuggestionRecord { return Boolean(value && typeof value === "object" && (value as { version?: unknown }).version === 1 && "tagId" in value && !("plan" in value)); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const episodeId = url.searchParams.get("episodeId");
  const suggestionsFor = url.searchParams.get("suggestionsFor");
  if ((episodeId && suggestionsFor) || (episodeId !== null && !nonEmpty(episodeId)) || (suggestionsFor !== null && !nonEmpty(suggestionsFor))) return error("invalid-request", 400);
  try {
    const store = getSqliteStore(openSqliteDatabase());
    if (episodeId) { const review = store.getReview(episodeId); return review ? response(review) : error("not-found", 404); }
    const suggestions = store.getTagSuggestions();
    if (suggestionsFor) return response(suggestions.filter((item) => item.episodeId === suggestionsFor || item.instrumentId === suggestionsFor));
    return response({ reviews: store.getReviews(), tagSuggestions: suggestions });
  } catch { return error("storage-unavailable", 503); }
}
export async function PUT(request: Request) {
  let body: unknown; try { body = await request.json(); } catch { return error("invalid-request", 400); }
  try {
    const store = getSqliteStore(openSqliteDatabase());
    if (isReview(body)) return store.putReview(body) ? response(body) : error("conflict", 409);
    if (isSuggestion(body)) { store.putTagSuggestion(body); return response(body); }
    return error("invalid-request", 400);
  } catch (caught) {
    if (caught instanceof Error && caught.message.startsWith("Unknown instrument:")) return error("not-found", 404);
    if (caught instanceof Error && caught.message.startsWith("Invalid ")) return error("invalid-request", 400);
    return error("storage-unavailable", 503);
  }
}
