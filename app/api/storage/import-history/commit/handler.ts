import { ensureImportHistoryAudit } from "../../../../lib/storage/import-history-audit";
import type { DatabaseSync } from "node:sqlite";
import { getSqliteStore } from "../../../../lib/storage/sqlite-store";
import { assertBookVersion, readBookVersion, type BookVersion } from "../../../../lib/storage/trade-book-version";
import { validBookVersion } from "../../../../lib/storage/trade-read-contract";
import { invalidTradeRequest, tradeFailure, tradeResponse } from "../../trades/http";

function validRequest(value: unknown): value is { batchId: string; version: BookVersion } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return Object.keys(input).every(key => key === "batchId" || key === "version") &&
    typeof input.batchId === "string" && !!input.batchId.trim() && input.batchId.length <= 1024 &&
    validBookVersion(input.version) && Object.keys(input.version).every(key => ["databaseId", "epoch", "sequence"].includes(key));
}

/** Read only one server-owned batch in the same exact-version transaction. */
export function createImportHistoryCommitHandler(getDatabase: () => DatabaseSync) {
  return async (request: Request): Promise<Response> => {
    let input: unknown;
    try { input = await request.json(); } catch { return invalidTradeRequest(); }
    if (!validRequest(input)) return invalidTradeRequest();
    try {
      const db = getDatabase();
      ensureImportHistoryAudit(db);
      db.exec("begin deferred");
      try {
        assertBookVersion(db, input.version);
        const entry = getSqliteStore(db).getImportHistoryCommit(input.batchId);
        const bookVersion = readBookVersion(db);
        db.exec("commit");
        if (!entry) return tradeResponse({ error: { code: "IMPORT_HISTORY_NOT_FOUND", message: "导入批次不存在。" } }, 404);
        return tradeResponse({ batchId: input.batchId, bookVersion, ...(entry.committedDuplicateTradeCount !== undefined ? { committedDuplicateTradeCount: entry.committedDuplicateTradeCount } : {}) });
      } catch (error) { db.exec("rollback"); throw error; }
    } catch (error) { return tradeFailure(error); }
  };
}
