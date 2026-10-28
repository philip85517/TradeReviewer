import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getSqliteStore } from "../../../../lib/storage/sqlite-store";
import { copyStoredTradeSnapshotRows, materializeStoredTradeSnapshot, type StoredTradeSelection } from "../../../../lib/storage/stored-trade-snapshot";
import { periodBounds } from "../../../../lib/storage/source-materials";
import { encodeTradeRead, tradeDisplayProjection, validBookVersion } from "../../../../lib/storage/trade-read-contract";
import { invalidTradeRequest, tradeFailure, tradeResponse } from "../http";

function validSelection(value: unknown): value is StoredTradeSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as StoredTradeSelection;
  if (Object.keys(value).some(k => !["accounts", "markets", "instruments", "period", "version", "cursor", "pageSize"].includes(k))) return false;
  if ([s.accounts, s.markets, s.instruments].some(a => a !== undefined && (!Array.isArray(a) || a.some(v => typeof v !== "string" || !v.trim())))) return false;
  if (s.pageSize !== undefined && (!Number.isSafeInteger(s.pageSize) || s.pageSize < 1 || s.pageSize > 1000)) return false;
  if (s.cursor !== undefined && typeof s.cursor !== "string") return false;
  if (s.period !== undefined) { try { periodBounds(s.period); } catch { return false; } }
  if (s.version !== undefined) {
    if (!s.version || typeof s.version !== "object" || ("exact" in s.version) === ("atLeast" in s.version)) return false;
    const v = "exact" in s.version ? s.version.exact : s.version.atLeast;
    if (!v || typeof v.databaseId !== "string" || !v.databaseId.trim() || typeof v.epoch !== "string" || !v.epoch.trim() || !Number.isSafeInteger(v.sequence) || v.sequence < 0) return false;
  }
  // Cursor syntax belongs to the read contract, not exception-message classification.
  if (s.cursor !== undefined) {
    try {
      const c = JSON.parse(Buffer.from(s.cursor, "base64url").toString("utf8"));
      if (c.policy !== "stored-trades-page-v1" || !validBookVersion(c.bookVersion) || typeof c.selectionDigest !== "string" || !Number.isSafeInteger(c.offset) || c.offset < 1) return false;
    } catch { return false; }
  }
  return true;
}

export function createTradeReadHandler(getDatabase: () => DatabaseSync): (request: Request) => Promise<Response> {
  return async function POST(request: Request) {
  let selection: unknown;
  try { selection = await request.json(); } catch { return invalidTradeRequest(); }
  if (!validSelection(selection)) return invalidTradeRequest();
  try {
    const db = getDatabase();
    const store = getSqliteStore(db);
    db.exec("begin deferred");
    let raw, instruments, importHistory, executions;
    try {
      raw = copyStoredTradeSnapshotRows(db);
      instruments = store.getInstruments();
      importHistory = store.getImportHistory();
      executions = store.getExecutions();
      db.exec("commit");
    } catch (error) { db.exec("rollback"); throw error; }
    if (selection.cursor) {
      const cursor = JSON.parse(Buffer.from(selection.cursor, "base64url").toString("utf8"));
      const first = materializeStoredTradeSnapshot(raw, { ...selection, cursor: undefined });
      if (cursor.selectionDigest !== first.receipt.selectionDigest || cursor.offset > first.receipt.totalDisplayFacts) return invalidTradeRequest();
    }
    const snapshot = materializeStoredTradeSnapshot(raw, selection);
    const display = tradeDisplayProjection(snapshot, { instruments, importHistory, executions });
    const payloadDigest = `sha256:${createHash("sha256").update(encodeTradeRead({ snapshot, display })).digest("hex")}`;
    return tradeResponse({ snapshot, display, payloadDigest });
  } catch (error) { return tradeFailure(error); }
};
}
