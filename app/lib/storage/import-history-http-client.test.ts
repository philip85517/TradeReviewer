import { expect, it, vi } from "vitest";
import { createSqliteHttpClient } from "./sqlite-http-client";

const version = { databaseId: "db", epoch: "epoch", sequence: 1 };
it("forwards one batch and exact version with cancellation and no-store", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ batchId: "A", bookVersion: version, committedDuplicateTradeCount: 1 }));
  const controller = new AbortController();
  expect(await createSqliteHttpClient(fetcher).readImportHistoryCommit("A", version, controller.signal)).toEqual({ batchId: "A", bookVersion: version, committedDuplicateTradeCount: 1 });
  expect(fetcher).toHaveBeenCalledWith("/api/storage/import-history/commit", expect.objectContaining({ method: "POST", cache: "no-store", signal: controller.signal, body: JSON.stringify({ batchId: "A", version }) }));
});
it.each([
  { batchId: "B", bookVersion: version, committedDuplicateTradeCount: 1 },
  { batchId: "A", bookVersion: { ...version, sequence: 2 }, committedDuplicateTradeCount: 1 },
  { batchId: "A", bookVersion: version, committedDuplicateTradeCount: -1 },
  { batchId: "A", bookVersion: version, committedDuplicateTradeCount: 0.5 },
  { batchId: "A", bookVersion: version, committedDuplicateTradeCount: "1" },
  { batchId: "A", committedDuplicateTradeCount: 1 },
  { batchId: "A", bookVersion: version, duplicateTradeCount: 99 },
])("rejects a mismatched or unsupported response: %j", async body => {
  const client = createSqliteHttpClient(async () => Response.json(body));
  await expect(client.readImportHistoryCommit("A", version)).rejects.toMatchObject({ code: "invalid-response" });
});
it("preserves version conflicts and unknown evidence as distinct results", async () => {
  const unknown = createSqliteHttpClient(async () => Response.json({ batchId: "A", bookVersion: version }));
  expect(await unknown.readImportHistoryCommit("A", version)).not.toHaveProperty("committedDuplicateTradeCount");
  const stale = createSqliteHttpClient(async () => Response.json({ error: { code: "BOOK_VERSION_CHANGED", message: "stale" } }, { status: 409 }));
  await expect(stale.readImportHistoryCommit("A", version)).rejects.toMatchObject({ code: "BOOK_VERSION_CHANGED", status: 409 });
});
