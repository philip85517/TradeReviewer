import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initializeSqlite } from "../../../db/sqlite-initialization";
import { SqliteStore } from "./sqlite-store";
import { createTradeChanges, TradeChangeError } from "./trade-changes";
import { readBookVersion } from "./trade-book-version";
import type { TradeExecution } from "../trades/types";
const databases: DatabaseSync[] = [], directories: string[] = [];
afterEach(() => {
  for (const db of databases.splice(0))
    db.close();
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});
function setup(path = ":memory:") {
  const db = new DatabaseSync(path);
  databases.push(db);
  initializeSqlite(db);
  return { db, store: new SqliteStore(db), changes: createTradeChanges(db) };
}
const instrument = { id: "US:AAPL", symbol: "AAPL", market: "US", currency: "USD", name: "Apple" };
const fact = {
  id: "E1",
  instrument,
  accountId: "A",
  accountLabel: "A",
  side: "buy" as const,
  quantity: "1",
  price: "123.45",
  fee: "0",
  executedAt: "2026-10-01",
  source: { platform: "broker", row: 1, fileFingerprint: "file1" }
};
function imported(changes: ReturnType<typeof createTradeChanges>, records: TradeExecution[] = [fact], requestId = "first") {
  const plan = changes.prepare({ kind: "import", candidates: records });
  return changes.commit({ requestId, planId: plan.planId, choices: {} });
}
describe("durable trade changes", () => {
  it("persists a receipt across restart and aliases consumed plans before expiration", () => {
    const path = mkdtempSync(join(tmpdir(), "trade-changes-"));
    directories.push(path);
    let now = 1000;
    const first = setup(join(path, "test.sqlite"));
    const changes = createTradeChanges(first.db, { now: () => now, ttlMs: 10 });
    const plan = changes.prepare({ kind: "import", candidates: [fact] });
    const receipt = changes.commit({ requestId: "original", planId: plan.planId, choices: {} });
    now = 2000;
    const second = setup(join(path, "test.sqlite"));
    expect(second.changes.commit({ requestId: "alias", planId: plan.planId, choices: {} })).toEqual(receipt);
    expect(second.changes.getCommit("alias")).toEqual(receipt);
    expect(() => second.changes.commit({ requestId: "original", planId: "other", choices: {} })).toThrowError(expect.objectContaining({ code: "REQUEST_CONFLICT" }));
    expect(second.store.getExecutions()).toHaveLength(1);
  });
  it("rejects stale inputs after a reviewed price revision instead of restoring the old price", () => {
    const { store, changes } = setup();
    imported(changes);
    const stale = changes.prepare({ kind: "import", candidates: [fact] });
    const revision = changes.prepare({
      kind: "revision",
      revision: {
        id: "R1",
        instrumentId: instrument.id,
        accountId: "A",
        reason: "confirmed",
        changes: [{ before: fact, after: { ...fact, price: "130" } }]
      }
    });
    changes.commit({ requestId: "revise", planId: revision.planId, choices: {} });
    expect(() => changes.commit({ requestId: "stale", planId: stale.planId, choices: {} })).toThrowError(expect.objectContaining({ code: "BOOK_VERSION_CHANGED" }));
    expect(store.getExecutions()[0].price).toBe("130");
  });
  it("rolls back facts, audit, version and receipt together on a late SQLite failure", () => {
    const { db, store, changes } = setup();
    const before = readBookVersion(db);
    const plan = changes.prepare({ kind: "import", candidates: [fact] });
    db.exec("create trigger refuse_receipt before insert on trade_change_receipts begin select raise(abort,'late failure'); end");
    expect(() => changes.commit({ requestId: "retry", planId: plan.planId, choices: {} })).toThrowError(expect.objectContaining({ code: "UNEXPECTED_FAILURE", cause: expect.objectContaining({ message: "late failure" }) }));
    expect(store.getExecutions()).toEqual([]);
    expect(readBookVersion(db)).toEqual(before);
    expect(changes.getCommit("retry")).toBeNull();
    db.exec("drop trigger refuse_receipt");
    expect(changes.commit({ requestId: "retry", planId: plan.planId, choices: {} }).bookVersion.sequence).toBeGreaterThan(before.sequence);
  });
  it("refuses same-ID keep-both without overwriting either price", () => {
    const { store, changes } = setup();
    imported(changes);
    const plan = changes.prepare({ kind: "import", candidates: [{ ...fact, price: "130" }] });
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].allowed).not.toContain("keep-both");
    expect(() => changes.commit({
      requestId: "bad",
      planId: plan.planId,
      choices: { conflicts: [{ conflictId: plan.conflicts[0].id, decision: "keep-both" }] }
    })).toThrowError(expect.objectContaining({ code: "INVALID_CHOICES" }));
    expect(store.getExecutions()[0].price).toBe("123.45");
  });
  it("bounds plans and rejects invalid candidates without opening a write transaction", () => {
    const { db } = setup();
    const changes = createTradeChanges(db, { maxCandidates: 1 });
    const before = readBookVersion(db);
    expect(() => changes.prepare({ kind: "import", candidates: [fact, { ...fact, id: "E2" }] })).toThrowError(expect.objectContaining({ code: "PLAN_CAPACITY" }));
    expect(() => changes.prepare({ kind: "import", candidates: [{ ...fact, quantity: "0" }] })).toThrow();
    expect(readBookVersion(db)).toEqual(before);
  });
  it("rejects bare replacement and updates only an existing instrument name without a book change", () => {
    const { db, store, changes } = setup();
    imported(changes);
    const version = readBookVersion(db);
    expect(() => store.mergeTradeData({ executions: [{ ...fact, price: "130" }], replaceExecutionIds: [fact.id] })).toThrowError(expect.objectContaining({ code: "VERSION_REQUIRED" }));
    store.putInstrumentName({ instrumentId: instrument.id, name: "苹果" });
    expect(store.getInstruments()[0].name).toBe("苹果");
    expect(readBookVersion(db)).toEqual(version);
    expect(() => store.putInstrumentName({ instrumentId: "missing", name: "X" })).toThrowError(expect.objectContaining({ code: "INSTRUMENT_NOT_FOUND" }));
  });
});
import type { MaterialVersionInput } from "./source-materials";
import { SQLITE_MIGRATIONS } from "../../../db/sqlite-schema";
function material(versionId: string, ids: string[] = ["E1"]): MaterialVersionInput {
  return {
    materialId: "M",
    versionId,
    parserVersion: "test",
    sourceKind: "statement",
    locator: {},
    fileFingerprint: null,
    recordedAt: "2026-10-26",
    scope: {
      accounts: { values: [], unknown: true },
      markets: { values: [], unknown: true },
      instruments: { values: [], unknown: true },
      periods: { values: [], unknown: true }
    },
    diagnostics: [],
    content: {},
    observations: ids.map(id => ({ id: `${versionId}:${id}`, locator: {}, raw: { id }, executionIds: [id], linkReason: "source" }))
  };
}
function saveMaterial(changes: ReturnType<typeof createTradeChanges>, input: MaterialVersionInput) {
  const plan = changes.prepare({ kind: "material", materials: [input] });
  return changes.commit({ requestId: input.versionId, planId: plan.planId, choices: {} });
}
describe("reviewed fact state and audit", () => {
  for (const account of ["A", null])
    it(`withdraws and restores an ${account === null ? "unknown" : "known"} account fact without deleting evidence`, () => {
      const { db, store, changes } = setup();
      imported(changes);
      if (account === null)
        db.exec("update executions set account=null where id='E1'");
      saveMaterial(changes, material("V1"));
      const original = db.prepare("select * from executions where id='E1'").get();
      const plan = changes.prepare({ kind: "material", materials: [material("V2", [])] });
      expect(plan.missingExecutions[0].executionId).toBe("E1");
      expect(() => changes.commit({ requestId: "missing", planId: plan.planId, choices: {} })).toThrowError(expect.objectContaining({ code: "INVALID_CHOICES" }));
      changes.commit({
        requestId: "withdraw",
        planId: plan.planId,
        choices: { missingExecutions: [{ executionId: "E1", action: "withdraw", reason: "source correction" }] }
      });
      expect(store.getExecutions()).toHaveLength(0);
      expect(store.getStatus().counts.executions).toBe(0);
      expect(store.getBootstrap().executions).toHaveLength(0);
      expect(db.prepare("select * from executions where id='E1'").get()).toEqual(original);
      expect(db.prepare("select * from source_execution_links").all()).toHaveLength(1);
      const audits = store.getFactStateAudits("E1");
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({ kind: "fact-state-audit-v1", accountId: account, action: "withdraw", before: { accountId: account } });
      expect(store.getTradeRevisions(instrument.id).some(r => r.id === audits[0].id)).toBe(false);
      const restore = changes.prepare({ kind: "material", materials: [], reactivateExecutionIds: ["E1"] });
      expect(restore.reactivateExecutionIds).toEqual(["E1"]);
      changes.commit({
        requestId: "restore",
        planId: restore.planId,
        choices: { reactivateExecutions: [{ executionId: "E1", action: "activate", reason: "explicit review" }] }
      });
      expect(store.getExecutions()).toHaveLength(1);
      expect(store.getFactStateAudits("E1")).toHaveLength(2);
      expect(db.prepare("select * from executions where id='E1'").get()).toEqual(original);
      expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);
    });
  it("rejects forged unknown encoding, preserves schema16 checksums and survives restart", () => {
    const directory = mkdtempSync(join(tmpdir(), "trade-state-upgrade-"));
    directories.push(directory);
    const path = join(directory, "test.sqlite"), db = new DatabaseSync(path);
    databases.push(db);
    db.exec("pragma foreign_keys=on;create table schema_migrations(version integer primary key,name text not null,checksum text not null)");
    for (const m of SQLITE_MIGRATIONS.filter(m => m.version <= 16)) {
      db.exec(m.sql);
      db.prepare("insert into schema_migrations values(?,?,?)").run(m.version, m.name, m.checksum);
    }
    const checksums = db.prepare("select * from schema_migrations").all();
    initializeSqlite(db);
    expect(db.prepare("select * from schema_migrations where version<=16").all()).toEqual(checksums);
    const store = new SqliteStore(db), changes = createTradeChanges(db);
    imported(changes);
    db.exec("update executions set account=null where id='E1'");
    saveMaterial(changes, material("V1"));
    const plan = changes.prepare({ kind: "material", materials: [material("V2", [])] });
    changes.commit({
      requestId: "withdraw",
      planId: plan.planId,
      choices: { missingExecutions: [{ executionId: "E1", action: "withdraw", reason: "corrected source" }] }
    });
    const audit = store.getFactStateAudits("E1")[0];
    expect(() => db.prepare("update trade_revisions set scope_account_unknown=0 where id=?").run(audit.id)).toThrow();
    expect(() => db.prepare("insert into trade_revisions(id,instrument_id,account_id,request_json,revision_json,recorded_at) values('fake','US:AAPL','','{}','{}','2026-10-26')").run()).toThrow();
    const forged = { ...audit, id: "forged", before: { ...audit.before, price: "999" } };
    expect(() => db.prepare("insert into trade_revisions(id,instrument_id,account_id,request_json,revision_json,recorded_at,scope_account_unknown) values(?,?,?,?,?,?,1)").run(forged.id, instrument.id, "", JSON.stringify(forged), JSON.stringify(forged), forged.recordedAt)).toThrow();
    const restarted = setup(path);
    expect(restarted.store.getFactStateAudits("E1")).toEqual([audit]);
    expect(restarted.store.getExecutions()).toHaveLength(0);
  });
});
import { existsSync } from "node:fs";
import { createStatementMarketRepairPlan, applyStatementMarketRepairPlan } from "./statement-market-repair";
it("refuses offline legacy JSON repair after the material authority exists, before journaling", () => {
  const directory = mkdtempSync(join(tmpdir(), "trade-repair-protocol-"));
  directories.push(directory);
  const path = join(directory, "test.sqlite");
  const db = new DatabaseSync(path);
  databases.push(db);
  db.exec("pragma foreign_keys=on;create table schema_migrations(version integer primary key,name text not null,checksum text not null)");
  for (const m of SQLITE_MIGRATIONS.filter(m => m.version <= 15)) {
    db.exec(m.sql);
    db.prepare("insert into schema_migrations values(?,?,?)").run(m.version, m.name, m.checksum);
  }
  const legacyPlan = createStatementMarketRepairPlan(path);
  initializeSqlite(db);
  expect(() => createStatementMarketRepairPlan(path)).toThrowError(expect.objectContaining({ code: "SOURCE_MATERIAL_PROTOCOL_REQUIRED" }));
  const auditPath = join(directory, "audit.json");
  expect(() => applyStatementMarketRepairPlan(path, legacyPlan, auditPath)).toThrowError(expect.objectContaining({ code: "SOURCE_MATERIAL_PROTOCOL_REQUIRED" }));
  expect(existsSync(auditPath)).toBe(false);
});
describe("plan boundaries and independent dependencies", () => {
  it("rechecks copied versions before persisting a plan, using two file connections", () => {
    const directory = mkdtempSync(join(tmpdir(), "trade-concurrency-"));
    directories.push(directory);
    const first = setup(join(directory, "test.sqlite"));
    const second = setup(join(directory, "test.sqlite"));
    let changed = false;
    const changes = createTradeChanges(first.db, { now: () => {
        if (!changed) {
          changed = true;
          imported(second.changes, [{ ...fact, id: "parallel", source: { ...fact.source, row: 2 } }]);
        }
        return Date.now();
      } });
    expect(() => changes.prepare({ kind: "import", candidates: [fact] }))
      .toThrowError(expect.objectContaining({ code: "BOOK_VERSION_CHANGED" }));
    expect(first.db.prepare("select * from trade_change_plans").all()).toHaveLength(1);
    expect(first.store.getExecutions().map(row => row.id)).toEqual(["parallel"]);
    const stale = first.changes.prepare({ kind: "import", candidates: [fact] });
    imported(second.changes, [{ ...fact, id: "later", source: { ...fact.source, row: 3 } }], "later");
    expect(() => first.changes.commit({ requestId: "stale-parallel", planId: stale.planId, choices: {} }))
      .toThrowError(expect.objectContaining({ code: "BOOK_VERSION_CHANGED" }));
    expect(first.changes.getCommit("stale-parallel")).toBeNull();
  });
  it("expires unused bodies while retaining consumed aliases and immutable receipts", () => {
    const { db } = setup();
    let now = 1000;
    const changes = createTradeChanges(db, { now: () => now, ttlMs: 10 });
    const unused = changes.prepare({ kind: "import", candidates: [] });
    const consumed = changes.prepare({ kind: "import", candidates: [fact] });
    const receipt = changes.commit({ requestId: "lost-response", planId: consumed.planId, choices: {} });
    now = 2000;
    expect(changes.cleanupExpired()).toBe(1);
    expect(() => changes.commit({ requestId: "expired", planId: unused.planId, choices: {} }))
      .toThrowError(expect.objectContaining({ code: "PLAN_EXPIRED" }));
    expect(changes.getCommit("lost-response")).toEqual(receipt);
    expect(changes.commit({ requestId: "recovered-alias", planId: consumed.planId, choices: {} })).toEqual(receipt);
    expect(changes.commit({ requestId: "lost-response", planId: consumed.planId, choices: {} })).toEqual(receipt);
    expect(() => changes.commit({
      requestId: "other-choice",
      planId: consumed.planId,
      choices: { missingExecutions: [{ executionId: "extra", action: "keep" }] }
    }))
      .toThrowError(expect.objectContaining({ code: "PLAN_CONSUMED" }));
    expect(() => changes.commit({
      requestId: "lost-response",
      planId: consumed.planId,
      choices: { missingExecutions: [{ executionId: "extra", action: "keep" }] }
    }))
      .toThrowError(expect.objectContaining({ code: "REQUEST_CONFLICT" }));
    expect(() => db.prepare("update trade_change_plans set body_json='{}' where id=?").run(consumed.planId)).toThrow();
    expect(() => db.prepare("delete from trade_change_receipts where id=?").run(receipt.receiptId)).toThrow();
    expect(() => db.prepare("delete from trade_change_requests where request_id=?").run("lost-response")).toThrow();
  });
  it("invalidates a previous plan after material-only and new-link-only changes", () => {
    const { changes } = setup();
    imported(changes);
    let stale = changes.prepare({ kind: "import", candidates: [] });
    saveMaterial(changes, material("material-only", []));
    expect(() => changes.commit({ requestId: "stale-material", planId: stale.planId, choices: {} }))
      .toThrowError(expect.objectContaining({ code: "BOOK_VERSION_CHANGED" }));
    stale = changes.prepare({ kind: "import", candidates: [] });
    saveMaterial(changes, material("link-added"));
    expect(() => changes.commit({ requestId: "stale-link", planId: stale.planId, choices: {} }))
      .toThrowError(expect.objectContaining({ code: "BOOK_VERSION_CHANGED" }));
  });
  it("validates all server choices and reasons without consuming the plan", () => {
    const { store, changes } = setup();
    imported(changes);
    const plan = changes.prepare({ kind: "import", candidates: [{ ...fact, price: "130" }] });
    const conflictId = plan.conflicts[0].id;
    for (const selection of [
      {},
      { conflicts: [{ conflictId: "invented", decision: "keep-existing" as const }] },
      { conflicts: [{ conflictId, decision: "keep-existing" as const }, { conflictId, decision: "keep-existing" as const }] },
      { conflicts: [{ conflictId, decision: "use-incoming" as const, reason: "  " }] },
    ]) {
      expect(() => changes.commit({ requestId: "invalid-selection", planId: plan.planId, choices: selection }))
        .toThrowError(expect.objectContaining({ code: "INVALID_CHOICES" }));
      expect(changes.getCommit("invalid-selection")).toBeNull();
      expect(store.getExecutions()[0].price).toBe("123.45");
    }
    changes.commit({
      requestId: "valid-selection",
      planId: plan.planId,
      choices: { conflicts: [{ conflictId, decision: "use-incoming", reason: "confirmed statement" }] }
    });
    expect(store.getExecutions()[0].price).toBe("130");
  });
  it("bounds serialized bytes and validates clock limits before any durable plan", () => {
    const { db } = setup();
    expect(() => createTradeChanges(db, { maxPlanBytes: 10 }).prepare({ kind: "import", candidates: [fact] }))
      .toThrowError(expect.objectContaining({ code: "PLAN_CAPACITY" }));
    expect(() => createTradeChanges(db, { ttlMs: Infinity })).toThrowError(expect.objectContaining({ code: "INVALID_OPTIONS" }));
    expect(() => createTradeChanges(db, { now: () => 8.64e15 }).prepare({ kind: "import", candidates: [] }))
      .toThrowError(expect.objectContaining({ code: "INVALID_OPTIONS" }));
    expect(db.prepare("select * from trade_change_plans").all()).toEqual([]);
  });
  it("inserts real batch/fact FKs before material application and inserts audit afterward", () => {
    const { db, store, changes } = setup();
    const candidate = { ...fact, source: { ...fact.source, batchId: "new-batch" } };
    const plan = changes.prepare({ kind: "import", candidates: [candidate], materials: [material("new-source")] });
    changes.commit({ requestId: "new-fk", planId: plan.planId, choices: {} });
    expect(store.getExecutions()).toHaveLength(1);
    expect(db.prepare("select id from import_batches where id='new-batch'").get()).toBeDefined();
    expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);
    const next = changes.prepare({
      kind: "revision",
      revision: {
        id: "with-material",
        instrumentId: instrument.id,
        accountId: "A",
        reason: "reviewed with source",
        changes: [{ before: candidate, after: { ...candidate, price: "130" } }]
      },
      materials: [material("next-source", [])]
    });
    expect(next.missingExecutions[0].revisionIds.length).toBeGreaterThan(0);
    changes.commit({
      requestId: "with-material",
      planId: next.planId,
      choices: { missingExecutions: [{ executionId: "E1", action: "keep", reason: "retain reviewed fact" }] }
    });
    expect(store.getExecutions()[0].price).toBe("130");
    expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);
  });
  it("requires withdrawal reasons and retains other-source and manual-audit dependencies", () => {
    const { db, store, changes } = setup();
    imported(changes);
    saveMaterial(changes, material("original-source"));
    saveMaterial(changes, { ...material("other-source"), materialId: "other-material" });
    const plan = changes.prepare({ kind: "material", materials: [material("missing-source", [])] });
    expect(plan.missingExecutions[0].otherSourceObservationIds).toContain("other-source:E1");
    expect(plan.missingExecutions[0].revisionIds.length).toBeGreaterThan(0);
    expect(() => changes.commit({
      requestId: "no-reason",
      planId: plan.planId,
      choices: { missingExecutions: [{ executionId: "E1", action: "withdraw", reason: " " }] }
    }))
      .toThrowError(expect.objectContaining({ code: "INVALID_CHOICES" }));
    changes.commit({
      requestId: "withdraw-dependencies",
      planId: plan.planId,
      choices: { missingExecutions: [{ executionId: "E1", action: "withdraw", reason: "explicit source review" }] }
    });
    saveMaterial(changes, { ...material("new-association"), materialId: "third-material" });
    expect(store.getExecutions()).toEqual([]);
    expect(store.getFactStateAudits("E1")).toHaveLength(1);
    expect(db.prepare("select * from source_observations").all()).toHaveLength(3);
    const restore = changes.prepare({ kind: "material", materials: [], reactivateExecutionIds: ["E1"] });
    expect(() => changes.commit({
      requestId: "no-activation-reason",
      planId: restore.planId,
      choices: { reactivateExecutions: [{ executionId: "E1", action: "activate", reason: " " }] }
    }))
      .toThrowError(expect.objectContaining({ code: "INVALID_CHOICES" }));
  });
});
import type { BrowserStatePayload, CommitReceipt, ReviewPlan, TradeChangeCommit } from "./sqlite-contracts";
import type { InternalIntent } from "./trade-changes-engine.internal";
function browserPayload(): BrowserStatePayload {
  return {
    version: 1,
    sourceClientId: "browser",
    sourceFingerprint: "browser-source",
    executions: [fact],
    importHistory: [],
    instruments: [instrument],
    reviews: [],
    reviewStates: [],
    tagSuggestions: [],
    marketDataJobs: [],
    settings: { theme: "dark" },
    dailyCandles: [],
    marketCandles: [],
    coverage: [],
    intervalCoverage: [],
    providerSymbols: []
  };
}
function internalChanges(store: SqliteStore) {
  return (store as unknown as {
    tradeChanges(): {
      prepare(intent: InternalIntent): ReviewPlan;
      commit(input: TradeChangeCommit): CommitReceipt;
    };
  }).tradeChanges();
}
describe("atomic browser ancillary application", () => {
  it("rolls back trade/source/audit/version/settings and migration marker on a late ancillary failure", () => {
    const { db, store } = setup();
    const before = readBookVersion(db);
    db.exec("create trigger ancillary_failure before insert on data_migrations begin select raise(abort,'ancillary failure'); end");
    expect(() => store.mergeBrowserState(browserPayload())).toThrowError(expect.objectContaining({ code: "UNEXPECTED_FAILURE", cause: expect.objectContaining({ message: "ancillary failure" }) }));
    for (const table of ["executions", "instruments", "source_materials", "trade_revisions", "app_settings", "data_migrations", "trade_change_receipts", "trade_change_requests"]) {
      expect(db.prepare(`select * from ${table}`).all(), table).toEqual([]);
    }
    expect(readBookVersion(db)).toEqual(before);
    db.exec("drop trigger ancillary_failure");
    expect(store.mergeBrowserState(browserPayload()).inserted).toBeGreaterThan(0);
    expect(store.getSettings().theme).toBe("dark");
  });
  it("checks settings independently of BookVersion in the same commit transaction", () => {
    const { db, store } = setup();
    const changes = internalChanges(store);
    const plan = changes.prepare({ kind: "browser-migration", payload: browserPayload() });
    const before = readBookVersion(db);
    store.putSettings({ theme: "light" });
    expect(readBookVersion(db)).toEqual(before);
    expect(() => changes.commit({ requestId: "stale-browser", planId: plan.planId, choices: {} }))
      .toThrowError(expect.objectContaining({ code: "DEPENDENCIES_CHANGED" }));
    expect(store.getExecutions()).toEqual([]);
    expect(store.getSettings().theme).toBe("light");
  });
});
it("freezes server review differences and reports the actual selected writes", () => {
  const { changes, store } = setup();
  const input = { ...fact };
  const plan = changes.prepare({ kind: "import", candidates: [input], materials: [material("summary-source")] });
  expect(plan.summary.candidateCount).toBe(1);
  expect(plan.summary.inputDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(plan.summary.changes).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: "add",
      executionId: "E1",
      before: null,
      after: expect.objectContaining({ price: "123.45", accountId: "A" })
    }),
    expect.objectContaining({ kind: "material-version", materialId: "M", versionId: "summary-source" }),
    expect.objectContaining({ kind: "link", executionId: "E1", materialId: "M", observationId: "summary-source:E1" }),
  ]));
  expect(Object.isFrozen(plan.summary.changes)).toBe(true);
  input.price = "999";
  const receipt = changes.commit({ requestId: "summary-add", planId: plan.planId, choices: {} });
  expect(receipt.result.appliedChanges).toEqual(plan.summary.changes);
  expect(receipt.result.appliedChanges.filter(change => change.kind === "add")).toHaveLength(receipt.result.report.inserted);
  expect(store.getExecutions()[0].price).toBe("123.45");
  const conflict = changes.prepare({ kind: "import", candidates: [{ ...fact, price: "130" }] });
  expect(conflict.summary.changes).toContainEqual(expect.objectContaining({
    kind: "replace",
    executionId: "E1",
    before: expect.objectContaining({ price: "123.45" }),
    after: expect.objectContaining({ price: "130" }),
    when: { conflictId: conflict.conflicts[0].id, decisions: ["use-incoming"] }
  }));
  const kept = changes.commit({
    requestId: "summary-keep",
    planId: conflict.planId,
    choices: { conflicts: [{ conflictId: conflict.conflicts[0].id, decision: "keep-existing" }] }
  });
  expect(kept.result.appliedChanges).toEqual([]);
  expect(kept.result.report.inserted).toBe(0);
  const revision = changes.prepare({
    kind: "revision",
    revision: {
      id: "summary-revision",
      instrumentId: instrument.id,
      accountId: "A",
      reason: "price review",
      changes: [{ before: fact, after: { ...fact, price: "130" } }]
    }
  });
  expect(revision.summary.changes[0]).toMatchObject({ kind: "revise", executionId: "E1", before: { price: "123.45" }, after: { price: "130" } });
  expect(changes.commit({ requestId: "summary-revision", planId: revision.planId, choices: {} }).result.appliedChanges).toEqual(revision.summary.changes);
});
it("rejects malformed state-audit JSON and preserves raw unknown nullable fields", () => {
  const { db, store, changes } = setup();
  imported(changes);
  db.exec("update executions set account=null,fee=null,currency=null,evidence_json=null where id='E1'");
  saveMaterial(changes, material("unknown-nullable"));
  const plan = changes.prepare({ kind: "material", materials: [material("unknown-missing", [])] });
  expect(plan.summary.changes.find(change => change.kind === "withdraw")?.before).toMatchObject({ accountId: null, fee: null, currency: null });
  changes.commit({
    requestId: "unknown-nullable-withdraw",
    planId: plan.planId,
    choices: { missingExecutions: [{ executionId: "E1", action: "withdraw", reason: "explicit" }] }
  });
  const audit = store.getFactStateAudits("E1")[0];
  expect(audit.before).toMatchObject({ accountId: null, fee: null, currency: null, rawEvidenceJson: null, evidence: null });
  for (const makeInvalid of [
    () => ({ ...audit, before: { ...audit.before, fee: undefined } }),
    () => ({ ...audit, changes: [{ before: { ...audit.before, price: "999" }, after: null }] }),
    () => ({
      ...audit,
      action: "activate",
      changes: [{ before: audit.before, after: { ...audit.before, price: "999" } }]
    }),
    () => ({ ...audit, kind: "ordinary-revision" }),
  ]) {
    const forged = { ...makeInvalid(), id: "forged-state" };
    expect(() => db.prepare("insert into trade_revisions(id,instrument_id,account_id,request_json,revision_json,recorded_at,scope_account_unknown) values(?,?,?,?,?,?,1)").run(forged.id, instrument.id, "", JSON.stringify(forged), JSON.stringify(forged), forged.recordedAt)).toThrow();
  }
  const ordinary = db.prepare("select id from trade_revisions where scope_account_unknown=0 limit 1").get()!;
  expect(() => db.prepare("update trade_revisions set account_id='' where id=?").run(ordinary.id)).toThrow();
});
it("keeps a failed name-only update atomic and returns a typed error", () => {
  const { db, store, changes } = setup();
  imported(changes);
  const before = db.prepare("select * from instruments").all();
  const version = readBookVersion(db);
  for (const name of [" ", "bad\u0000name", "x".repeat(201)]) {
    expect(() => store.putInstrumentName({ instrumentId: instrument.id, name })).toThrowError(expect.objectContaining({ code: "INVALID_INSTRUMENT_NAME", phase: "name" }));
  }
  db.exec("create trigger reject_name before update of name on instruments begin select raise(abort,'name disk failure'); end");
  expect(() => store.putInstrumentName({ instrumentId: instrument.id, name: "Changed" })).toThrowError(expect.objectContaining({ code: "INSTRUMENT_NAME_SAVE_FAILED", phase: "name", correlationId: expect.any(String) }));
  expect(db.prepare("select * from instruments").all()).toEqual(before);
  expect(readBookVersion(db)).toEqual(version);
});
it.each([
  ["evidence", "update executions set evidence_json='{' where id='E1'"],
  ["metadata", "update instruments set metadata_json='{' where id='US:AAPL'"],
  ["correction", "update executions set evidence_json=json_set(evidence_json,'$.accountCorrection',json('{}')) where id='E1'"],
  ["amount", "update executions set quantity='NaN' where id='E1'"],
  ["time", "update executions set executed_at='2026-02-30' where id='E1'"],
] as const)("isolates unrelated legacy %s without changing its raw row or weakening collisions", (_kind, corruption) => {
  const { db, changes } = setup();
  imported(changes);
  // Model pre-existing corruption in this disposable database only. Restore
  // constraints before exercising the formal writer.
  db.exec("pragma ignore_check_constraints=on");
  db.exec(corruption);
  db.exec("pragma ignore_check_constraints=off");
  const beforeFacts = db.prepare("select * from executions where id='E1'").all();
  const beforeInstruments = db.prepare("select * from instruments where id='US:AAPL'").all();
  const next = {
    ...fact,
    id: "E2",
    instrument: { ...instrument, id: "US:MSFT", symbol: "MSFT", name: "Microsoft" },
    // Bad JSON has no provable fingerprint. A source-less incoming record
    // proves there is no source-only intersection; other corruptions retain
    // their parseable, distinct fingerprints.
    source: { ...fact.source, fileFingerprint: _kind === "evidence" ? undefined : "independent" }
  };
  const plan = changes.prepare({ kind: "import", candidates: [next] });
  expect(plan).toMatchObject({ diagnostics: expect.arrayContaining([expect.objectContaining({ code: expect.stringMatching(/^LEGACY_/), locator: expect.any(String) })]) });
  expect(changes.commit({ requestId: `legacy-${_kind}`, planId: plan.planId, choices: {} }).result.report.inserted).toBe(1);
  expect(db.prepare("select * from executions where id='E1'").all()).toEqual(beforeFacts);
  expect(db.prepare("select * from instruments where id='US:AAPL'").all()).toEqual(beforeInstruments);
  const version = readBookVersion(db);
  for (const candidate of [
    { ...fact, id: "related" },
    { ...next, id: "E1" },
    { ...next, instrument: { ...next.instrument, id: "US:AAPL" } },
  ]) {
    expect(() => changes.prepare({ kind: "import", candidates: [candidate] })).toThrowError(expect.objectContaining({
      code: expect.stringMatching(/^LEGACY_.*_REQUIRES_REVIEW$/),
      locators: expect.arrayContaining([expect.any(String)])
    }));
  }
  expect(readBookVersion(db)).toEqual(version);
  expect(db.prepare("select * from executions where id='E1'").all()).toEqual(beforeFacts);
});
it.each([null, "", " ", "NaN", "bad-fee", "-1"])("preserves a historical fee %s and distinguishes real unknown from invalid", fee => {
  const { db, changes } = setup();
  imported(changes);
  db.prepare("update executions set fee=? where id='E1'").run(fee);
  const before = db.prepare("select * from executions where id='E1'").get();
  const next = {
    ...fact,
    id: "fee-independent",
    instrument: { ...instrument, id: "US:MSFT", symbol: "MSFT" },
    source: { ...fact.source, fileFingerprint: "other" }
  };
  const plan = changes.prepare({ kind: "import", candidates: [next] });
  if (fee === null || fee === "")
    expect(plan.diagnostics).toEqual([]);
  else
    expect(plan.diagnostics).toContainEqual(expect.objectContaining({ code: "LEGACY_FACT", locator: "executions:E1" }));
  changes.commit({ requestId: "fee-independent", planId: plan.planId, choices: {} });
  expect(db.prepare("select * from executions where id='E1'").get()).toEqual(before);
  if (fee !== null && fee !== "") {
    expect(() => changes.prepare({ kind: "import", candidates: [{ ...fact, id: "fee-related" }] })).toThrowError(expect.objectContaining({ code: "LEGACY_FACT_REQUIRES_REVIEW", locators: ["executions:E1"] }));
  }
});
it("does not treat an explicitly reported missing historical fee as unknown", () => {
  const { db, changes } = setup();
  imported(changes, [{ ...fact, source: { ...fact.source, feeStatus: "reported" as const } }]);
  db.exec("update executions set fee=null where id='E1'");
  const version = readBookVersion(db);
  expect(() => changes.prepare({ kind: "material", materials: [], reactivateExecutionIds: ["E1"] })).toThrowError(expect.objectContaining({ code: "LEGACY_FACT_REQUIRES_REVIEW" }));
  expect(readBookVersion(db)).toEqual(version);
});
it.each(["keep-existing", "use-incoming", "keep-both"] as const)("reviews material links to a conflict candidate before %s is chosen", decision => {
  const { db, store, changes } = setup();
  imported(changes);
  const candidate = { ...fact, id: "E2", price: "130" };
  const input = material("conflict-material", [candidate.id]);
  const plan = changes.prepare({ kind: "import", candidates: [candidate], materials: [input] });
  expect(plan.conflicts).toHaveLength(1);
  expect(plan.summary.changes.filter(change => change.kind === "link")).toEqual([
    expect.objectContaining({
      materialId: "M",
      versionId: "conflict-material",
      observationId: "conflict-material:E2",
      executionId: "E2",
      when: { conflictId: plan.conflicts[0].id, decisions: ["use-incoming", "keep-both"] },
    }),
  ]);
  const receipt = changes.commit({
    requestId: decision,
    planId: plan.planId,
    choices: { conflicts: [{ conflictId: plan.conflicts[0].id, decision, reason: "reviewed candidate" }] },
  });
  const linked = decision !== "keep-existing";
  expect(db.prepare("select execution_id from source_execution_links where observation_id=?").all("conflict-material:E2"))
    .toEqual(linked ? [{ execution_id: "E2" }] : []);
  expect(JSON.parse(String(db.prepare("select raw_json from source_observations where id=?").get("conflict-material:E2")!.raw_json))).toEqual({ id: "E2" });
  expect(receipt.result.appliedChanges.filter(change => change.kind === "link").map(change => change.executionId)).toEqual(linked ? ["E2"] : []);
  expect(store.getExecutions().map(execution => execution.id).sort()).toEqual(decision === "keep-existing" ? ["E1"] : decision === "use-incoming" ? ["E2"] : ["E1", "E2"]);
});
it("applies independent conflict links while retaining missing dependencies, rollback and idempotency", () => {
  const { db, store, changes } = setup();
  const second = { ...fact, id: "E3", instrument: { ...instrument, id: "US:MSFT", symbol: "MSFT" } };
  imported(changes, [fact, second]);
  saveMaterial(changes, material("prior", ["E1", "E3"]));
  saveMaterial(changes, { ...material("other", ["E1"]), materialId: "other-source" });
  const candidates = [{ ...fact, id: "E2", price: "130" }, { ...second, id: "E4", price: "140" }];
  const input = material("independent", ["E2", "E4"]);
  const plan = changes.prepare({ kind: "import", candidates, materials: [input] });
  expect(plan.conflicts).toHaveLength(2);
  expect(plan.missingExecutions).toEqual(expect.arrayContaining([
    expect.objectContaining({ executionId: "E1", otherSourceObservationIds: ["other:E1"], revisionIds: expect.any(Array) }),
    expect.objectContaining({ executionId: "E3" }),
  ]));
  expect(plan.missingExecutions.find(item => item.executionId === "E1")!.revisionIds.length).toBeGreaterThan(0);
  const choices = {
    conflicts: plan.conflicts.map(conflict => ({
      conflictId: conflict.id,
      decision: conflict.incoming.some(item => item.id === "E2") ? "keep-existing" as const : "use-incoming" as const,
      reason: "independent review"
    })),
    missingExecutions: plan.missingExecutions.map(item => ({ executionId: item.executionId, action: "keep" as const })),
  };
  const before = readBookVersion(db);
  const factsBefore = db.prepare("select * from executions order by id").all();
  const auditsBefore = db.prepare("select * from trade_revisions order by id").all();
  db.exec("create trigger fail_conditional_material before insert on source_observations when new.version_id='independent' begin select raise(abort,'conditional material failed'); end");
  expect(() => changes.commit({ requestId: "branch-retry", planId: plan.planId, choices })).toThrowError(expect.objectContaining({ code: "UNEXPECTED_FAILURE", cause: expect.objectContaining({ message: "conditional material failed" }) }));
  expect(readBookVersion(db)).toEqual(before);
  expect(db.prepare("select * from executions order by id").all()).toEqual(factsBefore);
  expect(db.prepare("select * from trade_revisions order by id").all()).toEqual(auditsBefore);
  expect(db.prepare("select * from source_material_versions where id='independent'").all()).toEqual([]);
  expect(changes.getCommit("branch-retry")).toBeNull();
  db.exec("drop trigger fail_conditional_material");
  const receipt = changes.commit({ requestId: "branch-retry", planId: plan.planId, choices });
  const links = db.prepare("select observation_id,execution_id from source_execution_links where observation_id like 'independent:%' order by observation_id").all();
  expect(links).toEqual([{ observation_id: "independent:E4", execution_id: "E4" }]);
  expect(db.prepare("select id from source_observations where version_id='independent' order by id").all()).toEqual([{ id: "independent:E2" }, { id: "independent:E4" }]);
  expect(receipt.result.appliedChanges.filter(item => item.kind === "link").map(item => item.executionId)).toEqual(["E4"]);
  expect(store.getExecutions().map(item => item.id).sort()).toEqual(["E1", "E4"]);
  expect(changes.commit({ requestId: "branch-alias", planId: plan.planId, choices })).toEqual(receipt);
  expect(db.prepare("select observation_id,execution_id from source_execution_links where observation_id like 'independent:%' order by observation_id").all()).toEqual(links);
  expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);
});


function capturedChangeError(work: () => unknown): TradeChangeError {
  try {
    work();
  } catch (error) {
    expect(error).toBeInstanceOf(TradeChangeError);
    return error as TradeChangeError;
  }
  throw new Error("Expected a trade-change failure");
}
function protocolRows(db: DatabaseSync) {
  return Object.fromEntries([
    "instruments", "executions", "trade_revisions", "execution_fact_states",
    "trade_change_plans", "trade_change_receipts", "trade_change_requests",
  ].map(table => [table, db.prepare(`select * from ${table} order by rowid`).all()]));
}
describe("typed trade-change failure boundaries", () => {
  it("classifies real two-connection write contention in prepare and commit without consuming the plan", () => {
    const path = mkdtempSync(join(tmpdir(), "trade-change-lock-"));
    directories.push(path);
    const { db, changes } = setup(join(path, "locked.sqlite"));
    const writer = new DatabaseSync(join(path, "locked.sqlite"));
    databases.push(writer);
    db.exec("pragma busy_timeout=0");
    writer.exec("pragma busy_timeout=0");
    const plan = changes.prepare({ kind: "import", candidates: [fact] });
    const rows = protocolRows(db), version = readBookVersion(db);
    writer.exec("begin immediate");
    try {
      for (const [phase, work] of [
        ["prepare", () => changes.prepare({ kind: "import", candidates: [fact] })],
        ["commit", () => changes.commit({ requestId: "locked", planId: plan.planId, choices: {} })],
      ] as const) {
        const error = capturedChangeError(work);
        expect(error).toMatchObject({ code: "STORAGE_BUSY", category: "storage-busy", phase, retryable: true });
        expect(error.cause).toMatchObject({ code: "ERR_SQLITE_ERROR", errcode: 5 });
        expect(JSON.stringify(error)).not.toContain("database is locked");
        expect(db.isTransaction).toBe(false);
        expect(protocolRows(db)).toEqual(rows);
        expect(readBookVersion(db)).toEqual(version);
      }
    } finally {
      writer.exec("rollback");
    }
    const committed = changes.commit({ requestId: "locked", planId: plan.planId, choices: {} });
    expect(committed.result.report.inserted).toBe(1);
    expect(changes.getCommit("locked")).toEqual(committed);
  });
  it.each(["prepare", "commit"] as const)("classifies a real read-only connection as unavailable during %s", phase => {
    const path = mkdtempSync(join(tmpdir(), "trade-change-readonly-"));
    directories.push(path);
    const first = setup(join(path, "readonly.sqlite"));
    const plan = first.changes.prepare({ kind: "import", candidates: [fact] });
    const db = new DatabaseSync(join(path, "readonly.sqlite"), { readOnly: true });
    databases.push(db);
    const changes = createTradeChanges(db);
    const rows = protocolRows(first.db), version = readBookVersion(first.db);
    const error = capturedChangeError(() => phase === "prepare"
      ? changes.prepare({ kind: "import", candidates: [fact] })
      : changes.commit({ requestId: "readonly", planId: plan.planId, choices: {} }));
    expect(error).toMatchObject({ code: "STORAGE_UNAVAILABLE", category: "storage-unavailable", phase, retryable: false });
    expect(error.cause).toMatchObject({ code: "ERR_SQLITE_ERROR", errcode: 8 });
    expect(db.isTransaction).toBe(false);
    expect(protocolRows(first.db)).toEqual(rows);
    expect(readBookVersion(first.db)).toEqual(version);
    expect(first.changes.commit({ requestId: "readonly", planId: plan.planId, choices: {} }).result.report.inserted).toBe(1);
  });
  it.each(["prepare", "commit"] as const)("classifies a closed connection as unavailable during %s", phase => {
    const { db, changes } = setup();
    const plan = changes.prepare({ kind: "import", candidates: [fact] });
    db.close();
    databases.splice(databases.indexOf(db), 1);
    const error = capturedChangeError(() => phase === "prepare"
      ? changes.prepare({ kind: "import", candidates: [fact] })
      : changes.commit({ requestId: "closed", planId: plan.planId, choices: {} }));
    expect(error).toMatchObject({ code: "STORAGE_UNAVAILABLE", category: "storage-unavailable", phase, retryable: false });
    expect(error.cause).toMatchObject({ code: "ERR_INVALID_STATE" });
  });
  it("classifies internal SQL failure in prepare and sanitizes its public response", () => {
    const { db, changes } = setup();
    const version = readBookVersion(db);
    db.exec("drop table trade_change_plans");
    const error = capturedChangeError(() => changes.prepare({ kind: "import", candidates: [fact] }));
    expect(error).toMatchObject({ code: "UNEXPECTED_FAILURE", category: "unexpected", phase: "prepare", retryable: false });
    expect(error.cause).toMatchObject({ code: "ERR_SQLITE_ERROR", errcode: 1 });
    expect(error.message).not.toContain("trade_change_plans");
    expect(JSON.stringify(error)).not.toContain("trade_change_plans");
    expect(db.prepare("select * from executions").all()).toEqual([]);
    expect(readBookVersion(db)).toEqual(version);
    expect(db.isTransaction).toBe(false);
  });
  it("rolls back a late internal SQL failure in commit and permits the same request retry", () => {
    const { db, changes } = setup();
    const plan = changes.prepare({ kind: "import", candidates: [fact] });
    const rows = protocolRows(db), version = readBookVersion(db);
    db.exec("create trigger invalid_receipt before insert on trade_change_receipts begin select * from private_account_secret; end");
    const error = capturedChangeError(() => changes.commit({ requestId: "internal", planId: plan.planId, choices: {} }));
    expect(error).toMatchObject({ code: "UNEXPECTED_FAILURE", category: "unexpected", phase: "commit", retryable: false });
    expect(error.cause).toMatchObject({ code: "ERR_SQLITE_ERROR", errcode: 1 });
    expect(error.message).not.toContain("private_account_secret");
    expect(JSON.stringify(error)).not.toContain("private_account_secret");
    expect(protocolRows(db)).toEqual(rows);
    expect(readBookVersion(db)).toEqual(version);
    expect(db.isTransaction).toBe(false);
    db.exec("drop trigger invalid_receipt");
    expect(changes.commit({ requestId: "internal", planId: plan.planId, choices: {} }).result.report.inserted).toBe(1);
  });
  it.each([
    ["prepare", 6, "STORAGE_BUSY", "storage-busy", true],
    ["commit", 6, "STORAGE_BUSY", "storage-busy", true],
    ["prepare", 517, "STORAGE_BUSY", "storage-busy", true],
    ["commit", 517, "STORAGE_BUSY", "storage-busy", true],
    ["prepare", 266, "STORAGE_UNAVAILABLE", "storage-unavailable", false],
    ["commit", 266, "STORAGE_UNAVAILABLE", "storage-unavailable", false],
  ] as const)("preserves injected SQLite result %s/%s through a late failure", (phase, errcode, code, category, retryable) => {
    const { db, changes } = setup();
    const plan = changes.prepare({ kind: "import", candidates: [fact] });
    const rows = protocolRows(db), version = readBookVersion(db);
    const failure = Object.assign(new Error("private SQL / account / IO path"), { code: "ERR_SQLITE_ERROR", errcode });
    const prepare = db.prepare.bind(db);
    const spy = vi.spyOn(db, "prepare").mockImplementation(sql => {
      if (sql.includes(phase === "prepare" ? "insert into trade_change_plans" : "insert into trade_change_receipts")) throw failure;
      return prepare(sql);
    });
    let error: TradeChangeError;
    try {
      error = capturedChangeError(() => phase === "prepare"
        ? changes.prepare({ kind: "import", candidates: [fact] })
        : changes.commit({ requestId: "injected", planId: plan.planId, choices: {} }));
    } finally {
      spy.mockRestore();
    }
    expect(error).toMatchObject({ code, category, phase, retryable });
    expect(error.cause).toBe(failure);
    expect(JSON.stringify(error)).not.toContain("private");
    expect(protocolRows(db)).toEqual(rows);
    expect(readBookVersion(db)).toEqual(version);
    expect(db.isTransaction).toBe(false);
    expect(changes.commit({ requestId: "injected", planId: plan.planId, choices: {} }).result.report.inserted).toBe(1);
  });
  it("types malformed material collection framing before raw projection", () => {
    const { db, changes } = setup();
    const rows = protocolRows(db), version = readBookVersion(db);
    for (const invalid of [
      { kind: "material", materials: {} },
      { kind: "material", materials: [null] },
      { kind: "material", materials: [{}] },
      { kind: "material", materials: [{ observations: [null] }] },
      { kind: "material", materials: [{ observations: [{ executionIds: [1] }] }] },
    ]) {
      expect(() => changes.prepare(invalid as never)).toThrowError(expect.objectContaining({ code: "INVALID_INPUT", category: "input" }));
    }
    expect(protocolRows(db)).toEqual(rows);
    expect(readBookVersion(db)).toEqual(version);
  });
  it("keeps explicit validation/domain errors distinct from an unexpected non-SQL exception", () => {
    const { db, changes } = setup();
    const input = capturedChangeError(() => changes.prepare({ kind: "import", candidates: [{ ...fact, quantity: "0" }] }));
    expect(input).toMatchObject({ code: "INVALID_INPUT", category: "input", retryable: false });
    const domain = capturedChangeError(() => changes.prepare({ kind: "material", materials: [], reactivateExecutionIds: ["missing"] }));
    expect(domain).toMatchObject({ code: "INVALID_ACTIVATION", category: "domain", retryable: false });
    const unexpected = createTradeChanges(db, { now: () => { throw new Error("account=private; SQL=secret"); } });
    const error = capturedChangeError(() => unexpected.prepare({ kind: "import", candidates: [fact] }));
    expect(error).toMatchObject({ code: "UNEXPECTED_FAILURE", category: "unexpected", retryable: false });
    expect(error.cause).toMatchObject({ message: "account=private; SQL=secret" });
    expect(error.message).not.toContain("private");
    expect(JSON.stringify(error)).not.toContain("private");
    expect(db.prepare("select * from trade_change_plans").all()).toEqual([]);
  });
});
it.each(["file1", "possibly-independent"])("refuses malformed broker source evidence that cannot exclude fingerprint %s across accounts", fileFingerprint => {
  const { db, changes } = setup();
  imported(changes);
  db.exec("pragma ignore_check_constraints=on");
  db.exec("update executions set evidence_json='{' where id='E1'");
  db.exec("pragma ignore_check_constraints=off");
  const rows = protocolRows(db), version = readBookVersion(db);
  const incoming = {
    ...fact, id: "different-fact", accountId: "unrelated-account", accountLabel: "unrelated-account",
    instrument: { ...instrument, id: "US:MSFT", symbol: "MSFT" },
    source: { ...fact.source, fileFingerprint },
  };
  expect(() => changes.prepare({ kind: "import", candidates: [incoming] })).toThrowError(expect.objectContaining({
    code: "LEGACY_FACT_REQUIRES_REVIEW", category: "domain", locators: ["executions:E1"]
  }));
  expect(protocolRows(db)).toEqual(rows);
  expect(readBookVersion(db)).toEqual(version);
  expect(db.isTransaction).toBe(false);
});
