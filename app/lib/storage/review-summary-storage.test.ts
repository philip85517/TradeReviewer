import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openSqliteDatabase } from "../../../db/sqlite";
import type { ReviewSummaryNote } from "../reviews/review-summary";
import { SqliteStore } from "./sqlite-store";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "review-summary-store-"));
  directories.push(directory);
  return new SqliteStore(openSqliteDatabase(join(directory, "store.sqlite")));
}

const note: ReviewSummaryNote = {
  version: 1,
  scopeId: "review-scope:v1:account-a:US:live::USD",
  rangeId: "all",
  updatedAt: "2026-09-10T00:00:00.000Z",
  keep: "保留耐心",
  change: "减少追价",
  next: "等待确认",
  evidenceEpisodeIds: ["episode-1"],
};

describe("SQLite review summaries", () => {
  it("persists independently by scope and range", () => {
    const store = createStore();

    expect(store.putReviewSummary(note)).toBe(true);
    expect(store.getReviewSummary(note.scopeId, note.rangeId)).toEqual(note);
    expect(store.getReviewSummary(note.scopeId, "other-range")).toBeUndefined();
  });

  it("rejects an older writer without overwriting the saved note", () => {
    const store = createStore();
    store.putReviewSummary(note);

    expect(
      store.putReviewSummary({
        ...note,
        updatedAt: "2026-09-09T00:00:00.000Z",
        keep: "stale",
      }),
    ).toBe(false);
    expect(store.getReviewSummary(note.scopeId, note.rangeId)?.keep).toBe(
      "保留耐心",
    );
  });
});
