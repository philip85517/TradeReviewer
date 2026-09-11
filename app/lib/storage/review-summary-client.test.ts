import { describe, expect, it, vi } from "vitest";

import type { ReviewSummaryNote } from "../reviews/review-summary";
import { createReviewSummaryClient } from "./review-summary-client";

const note: ReviewSummaryNote = {
  version: 1,
  scopeId: "review-scope:v1:account-a:US:live::USD",
  rangeId: "all",
  updatedAt: "2026-09-10T00:00:00.000Z",
  keep: "保留耐心",
  change: "减少追价",
  next: "只做确认后的入场",
  evidenceEpisodeIds: ["episode-1"],
};

describe("review summary client", () => {
  it("uses the narrow endpoint and treats a missing note as empty", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        { error: { code: "not-found", message: "not found" } },
        { status: 404 },
      ),
    );
    const client = createReviewSummaryClient(fetcher);

    await expect(client.get(note.scopeId, note.rangeId)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/api/storage/review-summaries?"),
      { cache: "no-store" },
    );
  });

  it("round trips a saved note and surfaces stale conflicts", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(note))
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "conflict", message: "conflict" } },
          { status: 409 },
        ),
      );
    const client = createReviewSummaryClient(fetcher);

    await expect(client.put(note)).resolves.toEqual(note);
    await expect(client.put(note)).rejects.toMatchObject({
      status: 409,
      code: "conflict",
    });
  });
  it("rejects malformed and mismatched responses before rendering them", async () => {
    const client = createReviewSummaryClient(vi.fn()
      .mockResolvedValueOnce(Response.json({ status: "ok" }))
      .mockResolvedValueOnce(Response.json({ ...note, scopeId: "review-scope:v1:another:US:live::USD" })));
    await expect(client.get(note.scopeId, note.rangeId)).rejects.toMatchObject({code: "invalid-response"});
    await expect(client.put(note)).rejects.toMatchObject({code: "invalid-response"});
  });

});
