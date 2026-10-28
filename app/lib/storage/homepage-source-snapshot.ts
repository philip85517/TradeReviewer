import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { listRecallReviewSummaries } from "../recall/server-repository";
import { getSqliteStore } from "./sqlite-store";
import { assertHomepageSourceShape, encodeHomepageSourceBinding, type HomepageStoredCollection } from "./homepage-source-contract";
import { type BookVersion } from "./trade-book-version";

import { copyStoredTradeSnapshotRows, materializeStoredTradeSnapshot, type StoredTradeSelection } from "./stored-trade-snapshot";
import { encodeTradeRead, tradeDisplayProjection, type TradeReadPage } from "./trade-read-contract";

function readCount(database: DatabaseSync, query: string): number {
  const row = database.prepare(query).get();
  const value = row?.count;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid stored source count");
  return value;
}

export type HomepageStoredSnapshot = Readonly<{ bookVersion: BookVersion; collection: HomepageStoredCollection }>;

/** One synchronous input-copy transaction, including Recall and monthly diagnostics. */
export function readHomepageStoredSnapshot(database: DatabaseSync, version?: StoredTradeSelection["version"]): HomepageStoredSnapshot {
  // BEGIN is outside the catch: a caller-owned transaction must never be rolled back.
  database.exec("begin deferred");
  let copied;
  try {
    const raw = copyStoredTradeSnapshotRows(database);
    const bookVersion = raw.bookVersion;
    const counts = {
      executions: readCount(database, "select count(*) as count from executions e where not exists (select 1 from execution_fact_states s where s.execution_id=e.id and s.state='withdrawn')"),
      instruments: readCount(database, "select count(*) as count from instruments"),
      importHistory: readCount(database, "select count(*) as count from import_batches"),
      legacyReviewRows: readCount(database, "select count(*) as count from reviews where review_json is not null"),
      recallDocuments: readCount(database, "select count(*) as count from recall_documents"),
    };
    if (readCount(database, "select count(*) as count from executions e left join instruments i on i.id = e.instrument_id where i.id is null") !== 0) {
      throw new Error("Stored source contains orphan executions");
    }
    const projectionGaps: string[] = [];
    const bootstrap = getSqliteStore(database).getBootstrap({ onImportHistoryProjectionGap: (id) => projectionGaps.push(id) });
    const recallSummaries = listRecallReviewSummaries(database);
    const unbound = {
      bootstrap,
      recallSummaries,
      receipt: {
        policy: "homepage-stored-collection-v1" as const,
        scope: "all-persisted-records" as const,
        enumeration: "complete" as const,
        receiptId: randomUUID(),
        knownAt: new Date().toISOString(),
        counts,
        projectionGaps,
      },
    };
    copied = { bookVersion, raw, unbound };
    database.exec("commit");
  } catch (error) {
    database.exec("rollback");
    throw error;
  }
  // Encoding and shape checks cannot hold a read lock or roll back a transaction
  // subsequently opened by the caller. All inputs above are detached JS values.
  const { bookVersion, raw, unbound: legacy } = copied;
  const tradeReadPages: TradeReadPage[] = [];
  let cursor: string | undefined;
  do {
    const snapshot = materializeStoredTradeSnapshot(raw, { ...(version ? { version } : {}), pageSize: 1000, ...(cursor ? { cursor } : {}) });
    const display = tradeDisplayProjection(snapshot, { executions: legacy.bootstrap.executions, instruments: legacy.bootstrap.instruments, importHistory: legacy.bootstrap.importHistory });
    const payloadDigest = `sha256:${createHash("sha256").update(encodeTradeRead({ snapshot, display }), "utf8").digest("hex")}`;
    tradeReadPages.push({ snapshot, display, payloadDigest });
    cursor = snapshot.nextCursor ?? undefined;
  } while (cursor);
  const projected = new Map(tradeReadPages.flatMap(page => page.display.executions).map(e => [e.id, e]));
  const unbound = { ...legacy, bootstrap: { ...legacy.bootstrap, executions: legacy.bootstrap.executions.map(e => projected.get(e.id)!) }, bookVersion, tradeReadPages };
  const payloadDigest = `sha256:${createHash("sha256").update(encodeHomepageSourceBinding(unbound), "utf8").digest("hex")}`;
  const collection = { ...unbound, receipt: { ...unbound.receipt, payloadDigest } };
  assertHomepageSourceShape(collection);
  return { bookVersion, collection };
}

/** Existing HTTP/receipt contract is retained through the same safe read path. */
export function readHomepageStoredCollection(database: DatabaseSync, version?: StoredTradeSelection["version"]): HomepageStoredCollection {
  return readHomepageStoredSnapshot(database, version).collection;
}
