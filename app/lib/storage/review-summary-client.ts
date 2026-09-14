import { isReviewSummaryNote, type ReviewSummaryNote } from "../reviews/review-summary";
import { StorageHttpError } from "./sqlite-http-client";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type ReviewSummaryClient = {
  get(scopeId: string, rangeId: string): Promise<ReviewSummaryNote | undefined>;
  put(note: ReviewSummaryNote): Promise<ReviewSummaryNote>;
};

async function responseBody(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new StorageHttpError(
      response.status,
      "invalid-response",
      "Storage response was not valid JSON",
    );
  }
}

function responseError(response: Response, body: unknown) {
  const detail =
    body && typeof body === "object" && "error" in body
      ? (body as { error?: unknown }).error
      : undefined;
  const code =
    detail &&
    typeof detail === "object" &&
    typeof (detail as { code?: unknown }).code === "string"
      ? (detail as { code: string }).code
      : "storage-request-failed";
  const message =
    detail &&
    typeof detail === "object" &&
    typeof (detail as { message?: unknown }).message === "string"
      ? (detail as { message: string }).message
      : `Storage request failed (${response.status})`;
  return new StorageHttpError(response.status, code, message);
}

export function createReviewSummaryClient(
  fetcher: Fetcher = fetch,
): ReviewSummaryClient {
  return {
    async get(scopeId, rangeId) {
      const params = new URLSearchParams({ scopeId, rangeId });
      const response = await fetcher(
        `/api/storage/review-summaries?${params.toString()}`,
        { cache: "no-store" },
      );
      const body = await responseBody(response);
      if (response.status === 404) return undefined;
      if (!response.ok) throw responseError(response, body);
      if (!isReviewSummaryNote(body) || body.scopeId !== scopeId || body.rangeId !== rangeId) throw new StorageHttpError(response.status, "invalid-response", "Invalid review summary response");
      return body;
    },
    async put(note) {
      const response = await fetcher("/api/storage/review-summaries", {
        method: "PUT",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(note),
      });
      const body = await responseBody(response);
      if (!response.ok) throw responseError(response, body);
      if (!isReviewSummaryNote(body) || body.scopeId !== note.scopeId || body.rangeId !== note.rangeId) throw new StorageHttpError(response.status, "invalid-response", "Invalid review summary response");
      return body;
    },
  };
}
