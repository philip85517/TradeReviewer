import { afterEach, describe, expect, it, vi } from "vitest";
const { listRecallReviewSummaries, openSqliteDatabase } = vi.hoisted(() => ({ listRecallReviewSummaries: vi.fn(), openSqliteDatabase: vi.fn() }));
vi.mock("../../../../lib/recall/server-repository", () => ({ listRecallReviewSummaries }));
vi.mock("../../../../../db/sqlite", () => ({ openSqliteDatabase }));
import { GET } from "./route";
afterEach(() => vi.resetAllMocks());

describe("recall summary route", () => {
  it("returns only summary data and disables stale HTTP caching", async () => {
    const summaries = [{ episodeId: "episode", status: "completed", updatedAt: "2026-09-25", completedAt: "2026-09-25", text: "真实记录", snapshotCount: 1 }];
    listRecallReviewSummaries.mockReturnValue(summaries);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ summaries });
  });
  it("reports storage failures without leaking document or SQL details", async () => {
    openSqliteDatabase.mockImplementation(() => { throw new Error("SECRET SQL"); });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("SECRET");
  });
});
