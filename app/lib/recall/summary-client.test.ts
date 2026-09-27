import { describe, expect, it, vi } from "vitest";
import { fetchRecallReviewSummaries } from "./summary-client";

describe("recall summary client", () => {
  it("fetches a fresh lightweight summary list and strips unexpected response fields", async () => {
    const summary = { episodeId: "episode", status: "in-progress", updatedAt: "2026-09-25", text: "note", snapshotCount: 1 };
    const fetcher = vi.fn(async () => Response.json({ summaries: [{ ...summary, snapshots: [{ imageDataUrl: "SECRET" }] }] }));
    expect(await fetchRecallReviewSummaries(fetcher)).toEqual([summary]);
    expect(fetcher).toHaveBeenCalledWith("/api/storage/recall/summaries", { cache: "no-store" });
  });
  it("does not convert a failure or malformed status to an empty successful list", async () => {
    await expect(fetchRecallReviewSummaries(async () => Response.json({ error: { code: "storage-unavailable", message: "offline" } }, { status: 503 }))).rejects.toThrow();
    await expect(fetchRecallReviewSummaries(async () => Response.json({ summaries: [{ episodeId: "episode", status: "invented" }] }))).rejects.toThrow();
  });
});
