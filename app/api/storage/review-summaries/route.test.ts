import { afterEach, describe, expect, it, vi } from "vitest";

const { getReviewSummary, putReviewSummary, openSqliteDatabase } = vi.hoisted(
  () => ({
    getReviewSummary: vi.fn(),
    putReviewSummary: vi.fn(),
    openSqliteDatabase: vi.fn(),
  }),
);

vi.mock("../../../lib/storage/sqlite-store", () => ({
  getSqliteStore: vi.fn(() => ({ getReviewSummary, putReviewSummary })),
}));
vi.mock("../../../../db/sqlite", () => ({ openSqliteDatabase }));

import { GET, PUT } from "./route";

const note = {
  version: 1,
  scopeId: "review-scope:v1:account-a:US:live::USD",
  rangeId: "all",
  updatedAt: "2026-09-10T00:00:00.000Z",
  keep: "保留耐心",
  change: "减少追价",
  next: "等待确认",
  evidenceEpisodeIds: ["episode-1"],
};

afterEach(() => vi.clearAllMocks());

describe("review summary storage route", () => {
  it("reads and writes only one scope and range", async () => {
    openSqliteDatabase.mockReturnValue({});
    getReviewSummary.mockReturnValue(note);
    putReviewSummary.mockReturnValue(true);

    const response = await GET(
      new Request(
        `http://localhost/api/storage/review-summaries?scopeId=${encodeURIComponent(note.scopeId)}&rangeId=all`,
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getReviewSummary).toHaveBeenCalledWith(note.scopeId, "all");

    const saved = await PUT(
      new Request("http://localhost/api/storage/review-summaries", {
        method: "PUT",
        body: JSON.stringify(note),
      }),
    );
    expect(saved.status).toBe(200);
    expect(putReviewSummary).toHaveBeenCalledWith(note);
  });

  it("rejects malformed versions and stale writes", async () => {
    expect(
      (
        await PUT(
          new Request("http://localhost/api/storage/review-summaries", {
            method: "PUT",
            body: JSON.stringify({ ...note, version: 2 }),
          }),
        )
      ).status,
    ).toBe(400);
    expect(putReviewSummary).not.toHaveBeenCalled();

    putReviewSummary.mockReturnValue(false);
    expect(
      (
        await PUT(
          new Request("http://localhost/api/storage/review-summaries", {
            method: "PUT",
            body: JSON.stringify(note),
          }),
        )
      ).status,
    ).toBe(409);
  });
});
