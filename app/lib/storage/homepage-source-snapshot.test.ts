import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeSqlite } from "../../../db/sqlite";
import { SqliteStore } from "./sqlite-store";
import { readHomepageStoredCollection, readHomepageStoredSnapshot } from "./homepage-source-snapshot";
import { readBookVersion } from "./trade-book-version";
import { parseHomepageStoredCollection } from "./homepage-source-contract";
import * as sourceContract from "./homepage-source-contract";
import { createRecallDocument } from "../recall/document";
import { saveRecallDocument } from "../recall/server-repository";
import { buildTradeEpisodes } from "../trades/episodes";
import type { TradeExecution } from "../trades/types";
import type { ImportHistoryEntry } from "./import-history";
import { webcrypto } from "node:crypto";
import { createTradeChanges } from "./trade-changes";

const databases: DatabaseSync[] = [];
const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const database of databases.splice(0).reverse()) database.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function database(path = ":memory:") {
  const db = new DatabaseSync(path);
  databases.push(db);
  initializeSqlite(db);
  return db;
}
function fill(id = "fill-a"): TradeExecution {
  return {
    id, source: { platform: "broker", row: 1 }, accountId: "account", accountLabel: "account",
    instrument: { id: "HK:700", symbol: "700", name: "Old name", market: "HK", currency: "HKD" },
    side: "buy", executedAt: "2026-01-02T00:00:00.000Z", quantity: "1", price: "10", fee: "0",
  };
}
function history(id = "statement"): ImportHistoryEntry {
  return {
    id, fileName: "statement.pdf", sourceLabel: "broker", importedAt: "2026-10-01T00:00:00.000Z",
    tradeCount: 0, instrumentCount: 1, excludedInstrumentCount: 0, excludedRecordCount: 0,
    duplicateTradeCount: 0, unresolvedInstrumentCount: 0,
    monthly: {
      documentId: "document", templateIds: ["broker"], accountId: "account", reviewRequired: true,
      positions: [{ accountId: "account", market: "HK", symbol: "700", phase: "opening", date: "2026-01-01", quantity: "5", source: [{ page: 1, row: 1 }] }],
      events: [],
    },
  };
}
function seedRecall(db: DatabaseSync) {
  const store = new SqliteStore(db);
  store.mergeExecutions([fill()]);
  const document = createRecallDocument(buildTradeEpisodes(store.getExecutions())[0], "2026-01-03T00:00:00.000Z");
  saveRecallDocument(db, { document, expectedRevision: 0 });
  // saveRecallDocument stamps wall time; seed the literal persisted test clock explicitly.
  db.prepare("update recall_documents set draft_json = ?, updated_at = ? where episode_id = ?")
    .run(JSON.stringify(document), document.updatedAt, document.episodeId);
  return document;
}

function concurrentFixture() {
  const directory = mkdtempSync(join(tmpdir(), "homepage-source-snapshot-"));
  directories.push(directory);
  const path = join(directory, "isolated.sqlite");
  const reader = database(path);
  const writer = database(path);
  const document = seedRecall(reader);
  const original = SqliteStore.prototype.getExecutions;
  // Only the scheduling boundary is instrumented; every SELECT/commit is real SQLite.
  vi.spyOn(SqliteStore.prototype, "getExecutions").mockImplementationOnce(function (this: SqliteStore) {
    const executions = original.call(this);
    writer.exec("begin immediate");
    writer.prepare("update instruments set name = ? where id = ?").run("New name", "HK:700");
    const columns = writer.prepare("pragma table_info(executions)").all().map((row) => String(row.name));
    writer.prepare(`insert into executions (${columns.map((name) => `"${name}"`).join(",")}) select ${columns.map((name) => name === "id" ? "?" : `"${name}"`).join(",")} from executions where id = ?`).run("fill-b", "fill-a");
    document.updatedAt = "2026-01-04T00:00:00.000Z";
    writer.prepare("update recall_documents set draft_json = ?, updated_at = ?, finalized_json = ? where episode_id = ?")
      .run(JSON.stringify(document), document.updatedAt, JSON.stringify({ status: "completed", completedAt: document.updatedAt }), document.episodeId);
    writer.exec("commit");
    return executions;
  });
  return { reader, writer };
}

describe("homepage stored source", () => {
  it("keeps the version and raw unknowns while enumerating only active display facts after withdrawal", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const db = database();
    const changes = createTradeChanges(db);
    const candidate = fill();
    const plan = changes.prepare({ kind: "import", candidates: [candidate, fill("withdrawn")] });
    changes.commit({ requestId: "seed", planId: plan.planId, choices: {} });
    const revision = changes.prepare({ kind: "revision", revision: { id: "withdraw", instrumentId: candidate.instrument.id, accountId: candidate.accountId, reason: "corrected source", changes: [{ before: fill("withdrawn"), after: null }] } });
    changes.commit({ requestId: "withdraw", planId: revision.planId, choices: {} });
    db.prepare("update executions set account=null,fee=null where id=?").run(candidate.id);
    const current = readHomepageStoredCollection(db);
    expect(current.bookVersion).toEqual(readBookVersion(db));
    expect(current.receipt.counts.executions).toBe(1);
    expect(current.bootstrap.executions.map(e => e.id)).toEqual([candidate.id]);
    expect(current.tradeReadPages.flatMap(p => p.snapshot.facts)).toEqual(expect.arrayContaining([expect.objectContaining({ id: candidate.id, accountId: null, fee: null })]));
    expect(current.tradeReadPages.flatMap(p => p.snapshot.withdrawnFacts).map(item => item.fact.id)).toContain("withdrawn");
    await expect(parseHomepageStoredCollection(current)).resolves.toEqual(current);
  });
  it("releases the read transaction before content encoding", () => {
    const db = database();
    const encode = sourceContract.encodeHomepageSourceBinding;
    vi.spyOn(sourceContract, "encodeHomepageSourceBinding").mockImplementation((input) => {
      // This real BEGIN succeeds only if the collection's read transaction ended.
      db.exec("begin immediate");
      db.exec("rollback");
      return encode(input);
    });
    expect(() => readHomepageStoredCollection(db)).not.toThrow();
  });

  it("also releases its transaction before final structural validation", () => {
    const db = database();
    const validate: typeof sourceContract.assertHomepageSourceShape = sourceContract.assertHomepageSourceShape;
    vi.spyOn(sourceContract, "assertHomepageSourceShape").mockImplementation((input) => {
      db.exec("begin immediate");
      db.exec("rollback");
      validate(input);
    });
    expect(() => readHomepageStoredCollection(db)).not.toThrow();
  });

  it("returns the business version from the same snapshot while preserving the legacy receipt", () => {
    const { reader, writer } = concurrentFixture();
    const version = readBookVersion(reader);
    const old = readHomepageStoredSnapshot(reader);
    expect(old.bookVersion).toEqual(version);
    expect(old.collection.bootstrap.executions.map((execution) => execution.id)).toEqual(["fill-a"]);
    expect(readBookVersion(writer).sequence).toBeGreaterThan(version.sequence);
    const current = readHomepageStoredSnapshot(reader);
    expect(current.bookVersion).toEqual(readBookVersion(writer));
    expect(current.collection.bootstrap.executions).toHaveLength(2);
    expect(old.collection.receipt).not.toHaveProperty("bookVersion");
  });

  it("does not roll back a later caller transaction when post-copy encoding fails", () => {
    const db = database();
    const failure = new Error("content encoding failed");
    vi.spyOn(sourceContract, "encodeHomepageSourceBinding").mockImplementation(() => {
      db.exec("begin immediate");
      db.exec("insert into app_settings (key, value_json) values ('caller-write', 'true')");
      throw failure;
    });
    expect(() => readHomepageStoredCollection(db)).toThrow(failure);
    expect(() => db.exec("commit")).not.toThrow();
    expect(db.prepare("select value_json from app_settings where key = 'caller-write'").get())
      .toEqual({ value_json: "true" });
  });

  it("keeps bootstrap and current/formal Recall in the old snapshot during a second connection commit", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const { reader, writer } = concurrentFixture();
    const old = readHomepageStoredCollection(reader);
    expect(old.bootstrap.executions.map((execution) => execution.id)).toEqual(["fill-a"]);
    expect(old.bootstrap.instruments[0].name).toBe("Old name");
    expect(old.recallSummaries[0].updatedAt).toBe("2026-01-03T00:00:00.000Z");
    expect(old.bootstrap.reviews).toEqual([]);
    expect(old.receipt.counts).toMatchObject({ executions: 1, recallDocuments: 1 });
    expect(writer.prepare("select count(*) as count from executions").get()?.count).toBe(2);
    const current = readHomepageStoredCollection(reader);
    expect(current.bootstrap.executions.map((execution) => execution.id).sort()).toEqual(["fill-a", "fill-b"]);
    expect(current.bootstrap.instruments[0].name).toBe("New name");
    expect(current.recallSummaries[0].updatedAt).toBe("2026-01-04T00:00:00.000Z");
    expect(current.bootstrap.reviews[0].review.completed).toBe(true);
    expect(current.receipt.counts.executions).toBe(2);
    await expect(parseHomepageStoredCollection(JSON.parse(JSON.stringify(old)))).resolves.toEqual(old);
  });

  it("records that the unchanged legacy bootstrap can mix reads across that same commit", () => {
    const { reader } = concurrentFixture();
    const mixed = new SqliteStore(reader).getBootstrap();
    expect(mixed.executions).toHaveLength(1);
    expect(mixed.instruments[0].name).toBe("New name");
    expect(mixed.reviews[0].review.completed).toBe(true);
  });

  it("accepts a truly empty stored collection with actual clocks and distinct read identities", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const db = database();
    const before = Date.now();
    const first = readHomepageStoredCollection(db);
    const second = readHomepageStoredCollection(db);
    expect(Date.parse(first.receipt.knownAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(first.receipt.knownAt)).toBeLessThanOrEqual(Date.now());
    expect(first.receipt.receiptId).not.toBe(second.receipt.receiptId);
    expect(first.receipt.counts).toEqual({ executions: 0, instruments: 0, importHistory: 0, legacyReviewRows: 0, recallDocuments: 0 });
    await expect(parseHomepageStoredCollection(first)).resolves.toEqual(first);
    expect(first.receipt).not.toHaveProperty("universeCoverage");
    expect(first.receipt).not.toHaveProperty("coversInception");
  });

  it("rejects an INNER JOIN orphan and rolls back its own read transaction", () => {
    const db = database();
    const store = new SqliteStore(db);
    store.mergeExecutions([fill()]);
    db.exec("pragma foreign_keys = off");
    db.prepare("update executions set instrument_id = ?").run("missing");
    expect(store.getBootstrap().executions).toEqual([]);
    expect(() => readHomepageStoredCollection(db)).toThrow("orphan");
    db.exec("begin deferred"); db.exec("rollback");
  });

  it("does not roll back a transaction owned by its caller", () => {
    const db = database();
    db.exec("begin deferred");
    expect(() => readHomepageStoredCollection(db)).toThrow();
    expect(() => db.exec("commit")).not.toThrow();
  });

  it.each(["import", "recall", "execution"])("fails the whole envelope on corrupt %s JSON", (kind) => {
    const db = database();
    seedRecall(db);
    new SqliteStore(db).mergeTradeData({ executions: [], importHistory: [history()] });
    db.exec("pragma ignore_check_constraints = on");
    if (kind === "import") db.exec("update import_batches set reconciliation_json = '{'");
    if (kind === "recall") db.exec("update recall_documents set draft_json = '{'");
    if (kind === "execution") db.exec("update executions set evidence_json = '{'");
    expect(() => readHomepageStoredCollection(db)).toThrow();
    if (kind === "recall") expect(() => new SqliteStore(db).getBootstrap()).not.toThrow();
    db.exec("begin deferred"); db.exec("rollback");
  });

  it("rejects a syntactically valid but malformed Recall document without changing legacy bootstrap", () => {
    const db = database();
    seedRecall(db);
    db.exec("update recall_documents set draft_json = '{}'");
    expect(() => readHomepageStoredCollection(db)).toThrow();
    expect(() => new SqliteStore(db).getBootstrap()).not.toThrow();
  });

  it("reports monthly evidence actually omitted by the existing projection", () => {
    const database = new DatabaseSync(":memory:");
    databases.push(database);
    initializeSqlite(database);
    const entry = {
      id: "broken-monthly", fileName: "statement.pdf", sourceLabel: "broker",
      importedAt: "2026-10-01T00:00:00.000Z", tradeCount: 0, instrumentCount: 0,
      excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 0,
      unresolvedInstrumentCount: 0, monthly: { positions: "invalid" },
    };
    database.prepare("insert into import_batches (id, imported_at, reconciliation_json) values (?, ?, ?)")
      .run(entry.id, entry.importedAt, JSON.stringify(entry));
    const gaps: string[] = [];
    const projected = new SqliteStore(database).getImportHistory((id) => gaps.push(id));
    expect(projected[0]).not.toHaveProperty("monthly");
    expect(gaps).toEqual(["broken-monthly"]);
    expect(readHomepageStoredCollection(database).receipt.projectionGaps).toEqual(["broken-monthly"]);
  });

  it("reports unproven scoped supplements and reuses the existing recovery when the audit is present", () => {
    const db = database();
    const store = new SqliteStore(db);
    const entry = history("supplement:scoped");
    store.mergeTradeData({ executions: [fill()], importHistory: [entry] });
    expect(readHomepageStoredCollection(db).receipt.projectionGaps).toEqual([entry.id]);
    store.reviseTrades({
      id: entry.id, instrumentId: "HK:700", accountId: "account", reason: "attach evidence",
      changes: [{ before: fill(), after: { ...fill(), source: { ...fill().source, batchId: entry.id } } }],
      expectedScope: [fill()], importHistory: entry,
    });
    const snapshot = readHomepageStoredCollection(db);
    expect(snapshot.receipt.projectionGaps).toEqual([]);
    expect(snapshot.bootstrap.importHistory[0].monthly?.evidenceScope).toEqual({ instrumentId: "HK:700", accountId: "account" });
  });

  it("retains statement-only quantity 5 and missing metadata without asserting financial completeness", () => {
    const db = database();
    new SqliteStore(db).mergeTradeData({ executions: [], instruments: [fill().instrument], importHistory: [history()] });
    const result = readHomepageStoredCollection(db);
    expect(result.bootstrap.executions).toEqual([]);
    expect(result.bootstrap.importHistory[0].monthly?.positions[0].quantity).toBe("5");
    expect(result.bootstrap.instruments[0]).not.toHaveProperty("metadata");
    expect(result.receipt.enumeration).toBe("complete");
    expect(result.receipt.projectionGaps).toEqual([]);
    expect(result).not.toHaveProperty("current");
    expect(result.receipt).not.toHaveProperty("universeCoverage");
    expect(result.receipt).not.toHaveProperty("lifetimeSourceCoverage");
  });
});
