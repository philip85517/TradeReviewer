import { openSqliteDatabase } from "../../../../db/sqlite";
import type { EpisodeReviewRecord } from "../../../lib/reviews/types";
import type { TagSuggestionRecord } from "../../../lib/insights/types";
import type { EpisodeReviewState } from "../../../lib/storage/review-storage";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";

export const runtime = "nodejs";
function response(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function error(code: "invalid-request" | "not-found" | "conflict" | "storage-unavailable", status: number) { return response({ error: { code, message: code.replaceAll("-", " ") } }, status); }
function nonEmpty(value: string | null) { return value !== null && value.trim().length > 0; }
function isReview(value: unknown): value is EpisodeReviewRecord { return Boolean(value && typeof value === "object" && (value as { version?: unknown }).version === 1 && "plan" in value && "review" in value); }
function isSuggestion(value: unknown): value is TagSuggestionRecord { return Boolean(value && typeof value === "object" && (value as { version?: unknown }).version === 1 && "tagId" in value && !("plan" in value)); }
function isReviewState(value: unknown): value is EpisodeReviewState { return Boolean(value && typeof value === "object" && (value as { version?: unknown }).version === 2 && "drawings" in value && "replayCursor" in value); }
function isSuggestionDecision(value: unknown): value is { kind: "suggestion-decision"; suggestion: TagSuggestionRecord; review: EpisodeReviewRecord } {
  return Boolean(value && typeof value === "object" && (value as { kind?: unknown }).kind === "suggestion-decision" && isSuggestion((value as { suggestion?: unknown }).suggestion) && isReview((value as { review?: unknown }).review));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const episodeId = url.searchParams.get("episodeId");
  const suggestionsFor = url.searchParams.get("suggestionsFor");
  const stateFor = url.searchParams.get("stateFor");
  if ((episodeId && suggestionsFor) || (episodeId && stateFor) || (suggestionsFor && stateFor) || (episodeId !== null && !nonEmpty(episodeId)) || (suggestionsFor !== null && !nonEmpty(suggestionsFor)) || (stateFor !== null && !nonEmpty(stateFor))) return error("invalid-request", 400);
  try {
    const store = getSqliteStore(openSqliteDatabase());
    if (episodeId) { const review = store.getReview(episodeId); return review ? response(review) : error("not-found", 404); }
    if (stateFor) { const state = store.getReviewStates().find((item) => item.episodeId === stateFor); return state ? response(state) : error("not-found", 404); }
    const suggestions = store.getTagSuggestions();
    if (suggestionsFor) return response(suggestions.filter((item) => item.episodeId === suggestionsFor || item.instrumentId === suggestionsFor));
    return response({ reviews: store.getReviews(), reviewStates: store.getReviewStates(), tagSuggestions: suggestions });
  } catch { return error("storage-unavailable", 503); }
}
export async function PUT(request: Request) {
  let body: unknown; try { body = await request.json(); } catch { return error("invalid-request", 400); }
  try {
    const store = getSqliteStore(openSqliteDatabase());
    if (isReview(body)) return store.putReview(body) ? response(body) : error("conflict", 409);
    if (isReviewState(body)) { store.putReviewState(body); return response(body); }
    if (isSuggestionDecision(body)) return store.putSuggestionDecision(body) ? response({ suggestion: body.suggestion, review: body.review }) : error("conflict", 409);
    if (isSuggestion(body)) { store.putTagSuggestion(body); return response(body); }
    return error("invalid-request", 400);
  } catch (caught) {
    if (caught instanceof Error && caught.message.startsWith("Unknown instrument:")) return error("not-found", 404);
    if (caught instanceof Error && caught.message.startsWith("Invalid ")) return error("invalid-request", 400);
    return error("storage-unavailable", 503);
  }
}
