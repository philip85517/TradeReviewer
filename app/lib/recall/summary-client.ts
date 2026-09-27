import { RecallRepositoryError } from "./repository";
import type { RecallReviewSummary } from "./summary";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function parseSummary(value: unknown): RecallReviewSummary {
  if (!value || typeof value !== "object") throw new Error("Invalid recall summary");
  const item = value as Record<string, unknown>;
  const status = item.status;
  if (
    typeof item.episodeId !== "string" || !item.episodeId.trim() ||
    typeof item.updatedAt !== "string" || !item.updatedAt.trim() ||
    typeof item.text !== "string" ||
    typeof item.snapshotCount !== "number" || !Number.isInteger(item.snapshotCount) || item.snapshotCount < 0 ||
    status !== "in-progress" && status !== "completed" && status !== "needs-confirmation" ||
    item.completedAt !== undefined && typeof item.completedAt !== "string" ||
    status === "completed" && (typeof item.completedAt !== "string" || !item.completedAt.trim())
  ) throw new Error("Invalid recall summary");
  // Explicit whitelist also prevents future server additions from bringing
  // screenshots or candle arrays into the homepage state by accident.
  return {
    episodeId: item.episodeId,
    status,
    updatedAt: item.updatedAt,
    ...(typeof item.completedAt === "string" ? { completedAt: item.completedAt } : {}),
    text: item.text,
    snapshotCount: item.snapshotCount,
  };
}

export async function fetchRecallReviewSummaries(fetcher: Fetcher = fetch): Promise<RecallReviewSummary[]> {
  const response = await fetcher("/api/storage/recall/summaries", { cache: "no-store" });
  if (!response.ok) {
    throw new RecallRepositoryError(response.status, "storage-request-failed", `Recall summary request failed (${response.status})`);
  }
  try {
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("summaries" in body) || !Array.isArray(body.summaries)) {
      throw new Error("Invalid recall summary response");
    }
    return body.summaries.map(parseSummary);
  } catch {
    throw new RecallRepositoryError(response.status, "invalid-response", "Recall storage returned invalid summaries");
  }
}
