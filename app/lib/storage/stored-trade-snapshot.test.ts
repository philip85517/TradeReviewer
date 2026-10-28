import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite";
import { readStoredTradeSnapshot, copyStoredTradeSnapshotRows, materializeStoredTradeSnapshot } from "./stored-trade-snapshot";
import { readBookVersion, rotateBookEpoch } from "./trade-book-version";

const opened: DatabaseSync[] = [], dirs: string[] = [];
afterEach(() => { for (const db of opened.splice(0)) if (db.isOpen) db.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function database(path = ":memory:") { const db = new DatabaseSync(path); opened.push(db); initializeSqlite(db); return db; }
function seed(db: DatabaseSync) {
  db.exec("insert into instruments(id,symbol,name,market,currency) values('US:X','X','X','US','USD'),('HK:700','700','700','HK','HKD')");
  const insert = db.prepare("insert into executions(id,instrument_id,account,side,executed_at,quantity,price,fee) values(?,'US:X','A','buy',?,'1.00000000000000000001','0',null)");
  insert.run("prior", "2025-01-01"); insert.run("d1", "2026-02-01"); insert.run("d2", "2026-02-28T23:59:59.999Z"); insert.run("future", "2026-03-01");
  db.exec("insert into executions(id,instrument_id,account,side,executed_at,quantity,price) values('other','HK:700','B','buy','2026-02-01','1','1')");
}

describe("stored trade snapshot", () => {
  it("returns exact decimal/null facts with all prior dependencies and a distinct display page", () => {
    const db = database(); seed(db);
    const snapshot = readStoredTradeSnapshot(db, { accounts: ["A"], period: { from: "2026-02-01", to: "2026-02-28" }, pageSize: 1 });
    expect(snapshot.facts.map(f => f.id)).toEqual(["prior", "d1"]);
    expect(snapshot.displayExecutionIds).toEqual(["d1"]);
    expect(snapshot.dependencyExecutionIds).toEqual(["prior"]);
    expect(snapshot.facts[0].quantity).toBe("1.00000000000000000001");
    expect(snapshot.facts[0].fee).toBeNull(); expect(snapshot.facts[0].evidence).toBeNull();
    expect(snapshot.scope.predecessors).toBe("all-prior-facts");
    expect(snapshot.scope.coverage).toBe("not-proven"); expect(snapshot.receipt.totalDisplayFacts).toBe(2);
    const next = readStoredTradeSnapshot(db, { accounts: ["A"], period: { from: "2026-02-01", to: "2026-02-28" }, pageSize: 1, cursor: snapshot.nextCursor! });
    expect(next.displayExecutionIds).toEqual(["d2"]); expect(next.dependencyExecutionIds).toEqual(["prior"]);
    expect(next.nextCursor).toBeNull(); expect(db.isTransaction).toBe(false);
  });

  it("requires exact identity/epoch/sequence and same-epoch atLeast without claiming historical reads", () => {
    const db = database(); seed(db); const original = readBookVersion(db);
    expect(readStoredTradeSnapshot(db, { version: { exact: original } }).bookVersion).toEqual(original);
    db.exec("update executions set price='2' where id='d1'"); const current = readBookVersion(db);
    expect(() => readStoredTradeSnapshot(db, { version: { exact: original } })).toThrow(/version changed/i);
    expect(readStoredTradeSnapshot(db, { version: { atLeast: original } }).bookVersion).toEqual(current);
    expect(() => readStoredTradeSnapshot(db, { version: { atLeast: { ...current, sequence: current.sequence + 1 } } })).toThrow(/version changed/i);
    expect(() => readStoredTradeSnapshot(db, { version: { atLeast: { ...current, databaseId: "other" } } })).toThrow(/version changed/i);
    rotateBookEpoch(db);
    expect(() => readStoredTradeSnapshot(db, { version: { atLeast: current } })).toThrow(/version changed/i);
  });

  it("rejects pagination across a second connection write and across selections", () => {
    const dir = mkdtempSync(join(tmpdir(), "task4-snapshot-")); dirs.push(dir);
    const db = database(join(dir, "test.sqlite")); db.exec("pragma journal_mode=wal"); seed(db);
    const next = database(join(dir, "test.sqlite"));
    const first = readStoredTradeSnapshot(db, { accounts: ["A"], pageSize: 1 });
    expect(() => readStoredTradeSnapshot(db, { accounts: ["B"], pageSize: 1, cursor: first.nextCursor! })).toThrow(/cursor.*selection/i);
    next.exec("update executions set quantity='3' where id='d2'");
    expect(() => readStoredTradeSnapshot(db, { accounts: ["A"], pageSize: 1, cursor: first.nextCursor! })).toThrow(/version changed/i);
  });

  it("copies one transaction and materializes independently of later writes or connection lifetime", () => {
    const db = database(); seed(db); db.exec("begin deferred");
    const raw = copyStoredTradeSnapshotRows(db); const version = raw.bookVersion; db.exec("commit");
    db.exec("delete from executions where id='d1'"); db.close();
    const snapshot = materializeStoredTradeSnapshot(raw, { accounts: ["A"] });
    expect(snapshot.bookVersion).toEqual(version); expect(snapshot.facts.some(f => f.id === "d1")).toBe(true);
  });

  it("keeps caller transactions intact and propagates copy and post-commit materialization failures", () => {
    const db = database(); seed(db); db.exec("begin immediate");
    expect(() => readStoredTradeSnapshot(db, {})).toThrow(/transaction/i); expect(db.isTransaction).toBe(true); db.exec("rollback");
    db.exec("drop table source_material_account_mappings");
    expect(() => readStoredTradeSnapshot(db, {})).toThrow(/no such table/i); expect(db.isTransaction).toBe(false);
    const malformed = database(); seed(malformed);
    malformed.exec("insert into source_materials values('M',null,'now'); insert into source_material_versions(id,material_id,parser_version,source_kind,locator_json,scope_json,diagnostics_json,content_json,recorded_at) values('V','M','p','s','{}','{}','[]','{}','now'); update source_materials set current_version_id='V' where id='M'");
    expect(() => readStoredTradeSnapshot(malformed, {})).toThrow(/scope/i); expect(malformed.isTransaction).toBe(false);
  });

  it("excludes withdrawn facts from display and dependencies, retaining raw fact, state and real audit", () => {
    const db = database(); seed(db);
    db.prepare("insert into trade_revisions(id,instrument_id,account_id,request_json,revision_json,recorded_at) values('R','US:X','A',?,'{}','2026-03-02')").run('{ "changes": [{"before":{"id":"d1"},"after":null}] }');
    db.exec("insert into execution_fact_states values('d1','withdrawn','R','reviewed','2026-03-02')");
    const snapshot = readStoredTradeSnapshot(db, { accounts: ["A"], period: { from: "2026-02-01", to: "2026-02-28" } });
    expect(snapshot.displayExecutionIds).toEqual(["d2"]);
    expect(snapshot.withdrawnFacts.map(f => f.fact.id)).toEqual(["d1"]);
    expect(snapshot.withdrawnFacts[0].state.revisionId).toBe("R");
    expect(snapshot.withdrawnFacts[0].audit.requestJson).toContain('"before":{"id":"d1"}');
    expect(snapshot.facts.some(f => f.id === "d1")).toBe(false);
    db.exec("update execution_fact_states set state='active',reason='' where execution_id='d1'");
    expect(readStoredTradeSnapshot(db, {}).displayExecutionIds).toContain("d1");
  });

  it("rejects malformed dates, cursors and empty/invalid page limits", () => {
    const db = database(); seed(db);
    expect(() => readStoredTradeSnapshot(db, { period: { from: "2026-02-30", to: "2026-03-01" } })).toThrow(/period/i);
    expect(() => readStoredTradeSnapshot(db, { cursor: "not-json" })).toThrow(/cursor/i);
    expect(() => readStoredTradeSnapshot(db, { pageSize: 0 })).toThrow(/page/i);
  });
});

import { copySourceMaterialRows, materializeSourceMaterialContext, prepareMaterialChanges, _applyPreparedMaterialChangesInTransaction, type MaterialVersionInput } from "./source-materials";

describe("snapshot source history", () => {
  it("retains old observation history for kept and withdrawn display facts despite a now unrelated current scope", () => {
    const db = database(); seed(db);
    const input = (versionId: string, account: string, ids: string[]): MaterialVersionInput => ({ materialId: "M", versionId, parserVersion: "p", sourceKind: "s", locator: {}, fileFingerprint: null, recordedAt: "now", scope: { accounts: { values: [account], unknown: false }, markets: { values: [], unknown: true }, instruments: { values: [], unknown: true }, periods: { values: [], unknown: true } }, diagnostics: [{ code: "UNRELATED_CURRENT_GAP" }], content: {}, observations: ids.map(id => ({ id: `${versionId}:${id}`, key: id, locator: {}, raw: { id }, executionIds: [id], linkReason: "observed" })) });
    const apply = (value: MaterialVersionInput, decisions: { executionId: string; action: "keep" }[]) => {
      const change = prepareMaterialChanges(materializeSourceMaterialContext(copySourceMaterialRows(db)), value);
      db.exec("begin immediate"); _applyPreparedMaterialChangesInTransaction(db, change, decisions); db.exec("commit");
    };
    apply(input("V1", "A", ["d1", "d2"]), []);
    apply(input("V2", "B", []), [{ executionId: "d1", action: "keep" }, { executionId: "d2", action: "keep" }]);
    db.exec("insert into trade_revisions(id,instrument_id,account_id,request_json,revision_json,recorded_at) values('R','US:X','A','{}','{}','now'); insert into execution_fact_states values('d2','withdrawn','R','reviewed','now')");
    const snapshot = readStoredTradeSnapshot(db, { accounts: ["A"], period: { from: "2026-02-01", to: "2026-02-28" } });
    expect(snapshot.materials).toEqual([]);
    expect(snapshot.diagnostics.some(d => d.code === "UNRELATED_CURRENT_GAP")).toBe(false);
    expect(snapshot.materialHistory.map(m => m.id)).toEqual(["M"]);
    expect(snapshot.materialHistory[0].versions[0].observations.flatMap(o => o.executionIds)).toEqual(["d1", "d2"]);
  });
});

describe("zero-trade predecessor materials", () => {
  it("copies prior materials without execution links, excludes known unrelated/future scopes and never declares opening coverage", () => {
    const db = database(); seed(db);
    for (const [id, account, month] of [["old", "A", "2026-01"], ["unrelated", "B", "2026-01"], ["future-material", "A", "2026-04"]]) {
      const input: MaterialVersionInput = { materialId: id, versionId: `${id}:v`, parserVersion: "p", sourceKind: "s", locator: {}, fileFingerprint: null, recordedAt: "now", scope: { accounts: { values: [account], unknown: false }, markets: { values: [], unknown: true }, instruments: { values: [], unknown: true }, periods: { values: [{ from: `${month}-01`, to: `${month}-28` }], unknown: false } }, diagnostics: [], content: {}, observations: [] };
      const change = prepareMaterialChanges(materializeSourceMaterialContext(copySourceMaterialRows(db)), input);
      db.exec("begin immediate"); _applyPreparedMaterialChangesInTransaction(db, change, []); db.exec("commit");
    }
    const snapshot = readStoredTradeSnapshot(db, { accounts: ["A"], period: { from: "2026-02-01", to: "2026-02-28" } });
    expect(snapshot.materials).toEqual([]);
    expect(snapshot.dependencyMaterials.map(m => m.id)).toEqual(["old"]);
    expect(snapshot.materialHistory.map(m => m.id)).toEqual(["old"]);
    expect(snapshot.scope.coverage).toBe("not-proven");
  });
});

describe("legacy stored fact boundaries", () => {
  it.each(["2026-02-30", "2026-02-30T12:00:00Z", "2026-02-01T12:00:00", "2026-02-01T24:00:00Z"])("rejects invalid stored execution time %s with the execution ID", executedAt => {
    const db = database(); seed(db);
    db.prepare("update executions set executed_at=? where id='d1'").run(executedAt);
    expect(() => readStoredTradeSnapshot(db, { period: { from: "2026-02-01", to: "2026-03-31" } })).toThrow(/execution.*d1/i);
    expect(db.prepare("select executed_at from executions where id='d1'").get()?.executed_at).toBe(executedAt);
    expect(db.isTransaction).toBe(false);
  });

  it("preserves valid date-only and explicitly zoned timestamp precision across period boundaries", () => {
    const db = database(); seed(db);
    db.prepare("update executions set executed_at=? where id='d2'").run("2026-03-01T00:30:00+01:00");
    const result = readStoredTradeSnapshot(db, { accounts: ["A"], period: { from: "2026-02-01", to: "2026-02-28" } });
    expect(result.displayExecutionIds).toEqual(["d1", "d2"]);
    expect(result.facts.find(f => f.id === "d1")?.executedAt).toBe("2026-02-01");
    expect(result.facts.find(f => f.id === "d2")?.executedAt).toBe("2026-03-01T00:30:00+01:00");
  });

  it("retains NULL accounts as unknown with prior dependencies and excludes them from explicit account selections", () => {
    const db = database(); seed(db);
    const insert = db.prepare("insert into executions(id,instrument_id,account,side,executed_at,quantity,price) values(?,'US:X',null,'buy',?,'1','0')");
    insert.run("unknown-prior", "2025-06-01"); insert.run("unknown-display", "2026-02-05"); insert.run("unknown-future", "2026-03-01");
    const period = { from: "2026-02-01", to: "2026-02-28" };
    const all = readStoredTradeSnapshot(db, { period });
    expect(all.dependencyExecutionIds).toEqual(["prior", "unknown-prior"]);
    expect(all.displayExecutionIds).toEqual(["d1", "other", "unknown-display", "d2"]);
    expect(all.facts.filter(f => f.id.startsWith("unknown")).map(f => ({ id: f.id, account: f.accountId }))).toEqual([{ id: "unknown-prior", account: null }, { id: "unknown-display", account: null }]);
    const accountA = readStoredTradeSnapshot(db, { accounts: ["A"], period });
    expect(accountA.dependencyExecutionIds).toEqual(["prior"]);
    expect(accountA.displayExecutionIds).toEqual(["d1", "d2"]);
    expect(accountA.facts.every(f => f.accountId === "A")).toBe(true);
    const accountB = readStoredTradeSnapshot(db, { accounts: ["B"], period });
    expect(accountB.dependencyExecutionIds).toEqual([]);
    expect(accountB.displayExecutionIds).toEqual(["other"]);
    expect(db.prepare("select account from executions where id='unknown-display'").get()?.account).toBeNull();
  });
});
