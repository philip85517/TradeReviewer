import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID as target } from "../trades/tradingview-account-identity";
import { canonicalMigrationPlanDigest } from "./tradingview-account-migration-plan";
import { readBookVersion } from "./trade-book-version";
import * as source from "./source-materials";

const opened: DatabaseSync[] = [], directories: string[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) if (db.isOpen) db.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function database(path = ":memory:") {
  const db = new DatabaseSync(path); opened.push(db); initializeSqlite(db);
  db.exec("insert into instruments(id,symbol,name,market,currency) values('US:X','X','X','US','USD')");
  for (const id of ["E1", "E2", "OUT"]) db.prepare("insert into executions(id,instrument_id,account,side,executed_at,quantity,price) values(?,'US:X','A','buy','2026-02-02','1','1')").run(id);
  return db;
}
function version(db: DatabaseSync, materialId = "M", id = "V1") {
  db.prepare("insert into source_materials(id,created_at) values(?,'old-time') on conflict do nothing").run(materialId);
  db.prepare("insert into source_material_versions(id,material_id,parser_version,source_kind,locator_json,scope_json,diagnostics_json,content_json,recorded_at) values(?,?,'p1','statement','{ \"file\": 1 }','{\"accounts\":{\"values\":[\"A\"],\"unknown\":false},\"markets\":{\"values\":[],\"unknown\":true},\"instruments\":{\"values\":[],\"unknown\":true},\"periods\":{\"values\":[],\"unknown\":true}}','[]','{ \"original\": true }','old-time')").run(id, materialId);
  db.prepare("update source_materials set current_version_id=? where id=?").run(id, materialId);
}
function observation(db: DatabaseSync, id = "O1", versionId = "V1", executionIds = ["E1"], originalAccountId: string | null = "A") {
  db.prepare("insert into source_observations(id,version_id,observation_key,identity_status,locator_json,raw_json,original_account_id) values(?,? ,?,'located','{ \"row\": 1 }','{ \"amount\": \"1.00\" }',?)").run(id, versionId, id, originalAccountId);
  for (const executionId of executionIds) db.prepare("insert into source_execution_links values(?,?,'parsed','old-time')").run(id, executionId);
}
function seed(db: DatabaseSync) { version(db); observation(db); }
function mapping(db: DatabaseSync, materialId = "M", canonical = "A") {
  db.prepare("insert into source_material_account_mappings values(?,'A',?,'original reason','original audit','original time')").run(materialId, canonical);
}
function input(ids = ["E1"]) {
  return { kind: "tradingview-account-migration" as const, operationId: "OP", recordedAt: "2026-10-26T12:00:00Z",
    executions: ids.map(executionId => ({ executionId, beforeAccountId: "A", afterAccountId: target })) };
}
function prepare(db: DatabaseSync, ids = ["E1"]) { return source._prepareSourceMaterialAccountCorrection(source.copySourceMaterialRows(db), input(ids)); }
function commit(db: DatabaseSync, prepared: source.PreparedSourceAccountCorrection) {
  db.exec("begin immediate");
  try {
    const ledger = source._applyPreparedSourceMaterialAccountCorrectionInTransaction(db, prepared);
    source._assertPreparedSourceMaterialAccountCorrectionInTransaction(db, prepared, "after");
    db.exec("commit"); return ledger;
  } catch (error) { db.exec("rollback"); throw error; }
}
function restoreInput(prepared: source.PreparedSourceAccountCorrection, appliedMappings: readonly source.MaterialAccountMappingChange[]) {
  if (prepared.input.kind !== "tradingview-account-migration") throw new Error("Expected forward fixture");
  return { kind: "tradingview-account-migration-rollback" as const, operationId: "ROLLBACK", recordedAt: "2026-10-27T12:00:00Z",
    original: { prepared: prepared as source.PreparedForwardSourceAccountCorrection, appliedMappings } };
}
function rows(db: DatabaseSync) { return source.copySourceMaterialRows(db); }
function maps(db: DatabaseSync) { return db.prepare("select * from source_material_account_mappings order by material_id,original_account_id").all(); }
function error(action: () => unknown, code: string, table?: string, primaryKey?: string) {
  let caught: unknown; try { action(); } catch (failure) { caught = failure; }
  expect(caught).toBeInstanceOf(source.SourceMaterialAccountCorrectionError);
  expect(caught).toMatchObject({ code, ...(table ? { table } : {}), ...(primaryKey ? { primaryKey } : {}) });
}
function rehash<T extends { digest: string }>(value: T): T {
  const unbound = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "digest"));
  const stable = (v: unknown): string => Array.isArray(v) ? `[${v.map(stable).join(",")}]`
    : v !== null && typeof v === "object" ? `{${Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`).join(",")}}` : JSON.stringify(v);
  return { ...value, digest: `sha256:${createHash("sha256").update(stable(unbound)).digest("hex")}` };
}

describe("source account correction fixed internal authority", () => {
  it("provides pure preparation and fixed transaction hooks", () => {
    expect(source._prepareSourceMaterialAccountCorrection).toBeTypeOf("function");
    expect(source._assertPreparedSourceMaterialAccountCorrectionInTransaction).toBeTypeOf("function");
    expect(source._applyPreparedSourceMaterialAccountCorrectionInTransaction).toBeTypeOf("function");
  });
  it("prepares detached immutable JSON without changing source or business version", () => {
    const db = database(); seed(db); const original = rows(db), book = readBookVersion(db), request = input();
    const p = source._prepareSourceMaterialAccountCorrection(original, request);
    request.executions[0].beforeAccountId = "changed";
    original.observations[0].raw_json = "{}";
    expect(p.input).toEqual(input()); expect(Object.isFrozen(p.changes[0].after)).toBe(true);
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
    expect(rows(db).observations[0].raw_json).toBe('{ "amount": "1.00" }');
    expect(readBookVersion(db)).toEqual(book);
    expect(p.changes[0]).toMatchObject({ before: null, after: { material_id: "M", original_account_id: "A", canonical_account_id: target, reason: "tradingview-account-migration", audit_reference: "OP", recorded_at: input().recordedAt } });
    expect(p.changes[0].afterDigest).toBe(canonicalMigrationPlanDigest(p.changes[0].after));
  });
  it("maps all materials and every version once while preserving raw evidence, facts and audits", () => {
    const db = database(); seed(db); version(db, "M", "V2"); observation(db, "O2", "V2", ["E2"]);
    version(db, "OTHER", "W"); observation(db, "O3", "W", ["E1", "E2"]); mapping(db);
    const before = rows(db), facts = db.prepare("select * from executions").all(), book = readBookVersion(db);
    const p = prepare(db, ["E1", "E2"]), ledger = commit(db, p);
    expect(ledger).toHaveLength(2); expect(ledger.map(c => c.primaryKey)).toEqual(['["M","A"]', '["OTHER","A"]']);
    expect(ledger[0].before).toEqual({ material_id: "M", original_account_id: "A", canonical_account_id: "A", reason: "original reason", audit_reference: "original audit", recorded_at: "original time" });
    expect(rows(db)).toEqual({ ...before, mappings: maps(db) });
    expect(db.prepare("select * from executions").all()).toEqual(facts);
    expect(db.prepare("select * from trade_revisions").all()).toEqual([]);
    expect(readBookVersion(db)).not.toEqual(book);
    expect(source.materializeSourceMaterialContext(rows(db)).versions.every(v => v.scope.accounts.values.includes(target))).toBe(true);
  });
  it.each([
    ["old version outside execution", (db: DatabaseSync) => { version(db, "M", "V2"); observation(db, "OUTSIDE", "V1", ["OUT"]); }, "source_execution_links", '["OUTSIDE","OUT"]'],
    ["mixed inside/outside link", (db: DatabaseSync) => db.prepare("insert into source_execution_links values('O1','OUT','other','time')").run(), "source_execution_links", '["O1","OUT"]'],
    ["unlinked same-original observation", (db: DatabaseSync) => observation(db, "UNLINKED", "V1", []), "source_observations", '["UNLINKED"]'],
    ["unknown original", (db: DatabaseSync) => observation(db, "UNKNOWN", "V1", ["E1"], null), "source_observations", '["UNKNOWN"]'],
    ["conflicting projected account", (db: DatabaseSync) => mapping(db, "M", "different"), "source_material_account_mappings", '["M","A"]'],
  ])("blocks %s before any mapping write", (_label, change, table, key) => {
    const db = database(); seed(db); change(db); const before = rows(db);
    error(() => prepare(db), "source-account-correction-blocked", table, key); expect(rows(db)).toEqual(before);
  });
  it("blocks conflicting before accounts for executions sharing a material/original account", () => {
    const db = database(); seed(db); observation(db, "O2", "V1", ["E2"]); const request = input(["E1", "E2"]); request.executions[1].beforeAccountId = "B";
    error(() => source._prepareSourceMaterialAccountCorrection(rows(db), request), "source-account-correction-blocked", "source_material_account_mappings", '["M","A"]');
  });
  it("checks missing ownership rather than silently dropping a selected link", () => {
    const db = database(); seed(db); const detached = rows(db); detached.versions = [];
    error(() => source._prepareSourceMaterialAccountCorrection(detached, input()), "source-account-correction-blocked", "source_material_versions", '["V1"]');
  });
  it("keeps no-op metadata and still proves every same-original association", () => {
    const db = database(); seed(db); mapping(db, "M", target); const before = maps(db), p = prepare(db);
    expect(p.changes).toEqual([]); commit(db, p); expect(maps(db)).toEqual(before);
    observation(db, "LATE", "V1", []);
    error(() => prepare(db), "source-account-correction-blocked", "source_observations", '["LATE"]');
  });
  it("does not manufacture source for executions without material and guards empty membership", () => {
    const db = database(), p = prepare(db); expect(p.changes).toEqual([]);
    expect(p.beforeDependencies.filter(d => d.rowKey === "@membership")).toHaveLength(5);
    seed(db); db.exec("begin immediate");
    error(() => source._applyPreparedSourceMaterialAccountCorrectionInTransaction(db, p), "source-account-correction-stale");
    expect(maps(db)).toEqual([]); db.exec("rollback");
  });
  it.each([
    ["new material", (db: DatabaseSync) => { version(db, "NEW", "NV"); observation(db, "NO", "NV"); }],
    ["new version", (db: DatabaseSync) => version(db, "M", "V2")],
    ["new observation", (db: DatabaseSync) => observation(db, "NEW", "V1", [], "OTHER")],
    ["new link", (db: DatabaseSync) => db.prepare("insert into source_execution_links values('O1','OUT','late','time')").run()],
    ["absent mapping becomes present", (db: DatabaseSync) => mapping(db)],
    ["another original mapping", (db: DatabaseSync) => db.prepare("insert into source_material_account_mappings values('M','OTHER','B','x','y','z')").run()],
  ])("rejects concurrent %s before first write", (_label, change) => {
    const db = database(); seed(db); const p = prepare(db); change(db); const before = rows(db);
    db.exec("begin immediate"); error(() => source._applyPreparedSourceMaterialAccountCorrectionInTransaction(db, p), "source-account-correction-stale");
    expect(rows(db)).toEqual(before); db.exec("rollback");
  });
  it.each(["canonical_account_id", "reason", "audit_reference", "recorded_at"])("checks the exact mapping old-value column %s", column => {
    const db = database(); seed(db); mapping(db); const p = prepare(db);
    db.prepare(`update source_material_account_mappings set ${column}='changed' where material_id='M'`).run();
    db.exec("begin immediate"); error(() => source._applyPreparedSourceMaterialAccountCorrectionInTransaction(db, p), "source-account-correction-stale", "source_material_account_mappings", '["M","A"]'); db.exec("rollback");
  });
  it("rebuilds actual closure in a second connection and rejects a trimmed detached graph", () => {
    const directory = mkdtempSync(join(tmpdir(), "source-account-correction-")); directories.push(directory);
    const db = database(join(directory, "test.sqlite")); seed(db); const detached = rows(db), p = prepare(db);
    const other = new DatabaseSync(join(directory, "test.sqlite")); opened.push(other);
    version(other, "NEW", "NV"); observation(other, "NO", "NV");
    const trimmed = source._prepareSourceMaterialAccountCorrection(detached, input());
    expect(trimmed).toEqual(p); db.exec("begin immediate");
    error(() => source._applyPreparedSourceMaterialAccountCorrectionInTransaction(db, trimmed), "source-account-correction-stale"); db.exec("rollback");
  });
  it.each([false, true])("restores exact persisted ledger before/null (existing=%s) without new metadata", existing => {
    const db = database(); seed(db); if (existing) mapping(db); const before = rows(db);
    const p = prepare(db), ledger = commit(db, p);
    const undo = source._prepareSourceMaterialAccountCorrection(rows(db), restoreInput(p, ledger));
    expect(undo.changes[0]).toMatchObject({ before: ledger[0].after, after: ledger[0].before });
    commit(db, undo); expect(rows(db)).toEqual(before);
  });
  it("preserves schema-valid empty historical metadata exactly through recovery", () => {
    const db = database(); seed(db); mapping(db);
    db.exec("update source_material_account_mappings set reason='',audit_reference='',recorded_at=''");
    const before = maps(db), p = prepare(db), ledger = commit(db, p);
    const undo = source._prepareSourceMaterialAccountCorrection(rows(db), restoreInput(p, ledger));
    commit(db, undo); expect(maps(db)).toEqual(before);
  });
  it.each(["material_id", "original_account_id", "removed mapping", "raw material field", "link moved out"])("detects dependency identity or raw-value drift: %s", variant => {
    const db = database(); seed(db); mapping(db); version(db, "UNRELATED", "UV"); const p = prepare(db);
    if (variant === "material_id") db.exec("update source_material_account_mappings set material_id='UNRELATED'");
    if (variant === "original_account_id") db.exec("update source_material_account_mappings set original_account_id='OTHER'");
    if (variant === "removed mapping") db.exec("delete from source_material_account_mappings");
    if (variant === "raw material field") db.exec("update source_materials set created_at='changed' where id='M'");
    if (variant === "link moved out") db.exec("drop trigger source_execution_links_immutable_update; update source_execution_links set execution_id='OUT'");
    db.exec("begin immediate"); error(() => source._applyPreparedSourceMaterialAccountCorrectionInTransaction(db, p), "source-account-correction-stale"); db.exec("rollback");
  });
  it.each([
    ["new material", (db: DatabaseSync) => { version(db, "NEW", "NV"); observation(db, "NO", "NV"); }],
    ["new version", (db: DatabaseSync) => version(db, "M", "V2")],
    ["new observation", (db: DatabaseSync) => observation(db, "NEW", "V1", [], "OTHER")],
    ["new link", (db: DatabaseSync) => db.prepare("insert into source_execution_links values('O1','OUT','late','time')").run()],
    ["mapping overwrite", (db: DatabaseSync) => db.exec("update source_material_account_mappings set reason='later owner'")],
  ])("refuses rollback after %s using the original forward baseline", (_label, change) => {
    const db = database(); seed(db); const p = prepare(db), ledger = commit(db, p); change(db);
    error(() => source._prepareSourceMaterialAccountCorrection(rows(db), restoreInput(p, ledger)), "source-account-correction-stale");
  });
  it("allows unrelated materials to change without blocking exact recovery", () => {
    const db = database(); seed(db); const p = prepare(db), ledger = commit(db, p);
    version(db, "UNRELATED", "UV"); observation(db, "UO", "UV", ["OUT"], "OTHER");
    const undo = source._prepareSourceMaterialAccountCorrection(rows(db), restoreInput(p, ledger)); commit(db, undo); expect(maps(db)).toEqual([]);
  });
  it.each(["omitted", "extra", "duplicate", "before", "after", "digest", "extra column"])("rejects %s original persisted ledger evidence", variant => {
    const db = database(); seed(db); mapping(db); const p = prepare(db), ledger = commit(db, p);
    const request = JSON.parse(JSON.stringify(restoreInput(p, ledger)));
    const changes = request.original.appliedMappings;
    if (variant === "omitted") changes.splice(0);
    if (variant === "extra" || variant === "duplicate") changes.push({ ...changes[0], ...(variant === "extra" ? { primaryKey: '["X","A"]' } : {}) });
    if (variant === "before") changes[0].before.reason = "forged";
    if (variant === "after") changes[0].after.reason = "forged";
    if (variant === "digest") changes[0].afterDigest = "sha256:wrong";
    if (variant === "extra column") changes[0].before.unauthorized = "x";
    error(() => source._prepareSourceMaterialAccountCorrection(rows(db), request), "source-account-correction-invalid");
  });
  it.each(["target", "duplicate scope", "nonfinite", "undefined", "date", "extra input"])("rejects %s input rather than accepting a free patch", variant => {
    const db = database(); seed(db); const request = JSON.parse(JSON.stringify(input()));
    if (variant === "target") request.executions[0].afterAccountId = "unapproved";
    if (variant === "duplicate scope") request.executions.push(request.executions[0]);
    if (variant === "nonfinite") request.recordedAt = Infinity;
    if (variant === "undefined") request.recordedAt = undefined;
    if (variant === "date") request.recordedAt = new Date();
    if (variant === "extra input") request.sql = "delete from executions";
    error(() => source._prepareSourceMaterialAccountCorrection(rows(db), request), "source-account-correction-invalid");
  });
  it("rejects rehashed arbitrary forward changes and restore-of-restore", () => {
    const db = database(); seed(db); const p = prepare(db), forged = JSON.parse(JSON.stringify(p)); forged.changes[0].after.reason = "forged";
    db.exec("begin immediate"); error(() => source._applyPreparedSourceMaterialAccountCorrectionInTransaction(db, rehash(forged)), "source-account-correction-invalid"); db.exec("rollback");
    const ledger = commit(db, p), undo = source._prepareSourceMaterialAccountCorrection(rows(db), restoreInput(p, ledger));
    const request = JSON.parse(JSON.stringify(restoreInput(p, ledger))); request.original.prepared = undo;
    error(() => source._prepareSourceMaterialAccountCorrection(rows(db), request), "source-account-correction-invalid");
  });
  it("reconstructs the original forward dependencies even if a forged original and ledger have matching rehashed images", () => {
    const db = database(); seed(db); mapping(db); const p = prepare(db), ledger = commit(db, p);
    const request = JSON.parse(JSON.stringify(restoreInput(p, ledger)));
    const original = request.original.prepared;
    original.changes[0].before.reason = "forged historical reason";
    original.changes[0].beforeDigest = canonicalMigrationPlanDigest(original.changes[0].before);
    request.original.prepared = rehash(original);
    request.original.appliedMappings = JSON.parse(JSON.stringify(original.changes));
    error(() => source._prepareSourceMaterialAccountCorrection(rows(db), request), "source-account-correction-invalid");
  });
  it("rejects drift between rollback preparation and its transaction without overwriting the new owner", () => {
    const db = database(); seed(db); const p = prepare(db), ledger = commit(db, p);
    const undo = source._prepareSourceMaterialAccountCorrection(rows(db), restoreInput(p, ledger));
    db.exec("update source_material_account_mappings set audit_reference='new owner'"); const current = maps(db);
    expect(() => commit(db, undo)).toThrow(source.SourceMaterialAccountCorrectionError); expect(maps(db)).toEqual(current);
  });
  it("requires the caller transaction and leaves its lifetime and late failure rollback to the caller", () => {
    const db = database(); seed(db); const p = prepare(db), before = rows(db), book = readBookVersion(db);
    error(() => source._applyPreparedSourceMaterialAccountCorrectionInTransaction(db, p), "source-account-correction-transaction-required");
    error(() => source._assertPreparedSourceMaterialAccountCorrectionInTransaction(db, p, "before"), "source-account-correction-transaction-required");
    db.exec("begin immediate"); source._assertPreparedSourceMaterialAccountCorrectionInTransaction(db, p, "before"); source._applyPreparedSourceMaterialAccountCorrectionInTransaction(db, p);
    expect(db.isTransaction).toBe(true);
    expect(() => db.exec("insert into instruments(id,symbol,name,market,currency) values('US:X','X','X','US','USD')")).toThrow();
    db.exec("rollback"); expect(rows(db)).toEqual(before); expect(readBookVersion(db)).toEqual(book);
  });
  it.each(["corrupt earlier mapping", "extra mapping", "new observation"])("detects a mapping trigger that causes %s and rolls back all changes", variant => {
    const db = database(); seed(db); version(db, "N", "NV"); observation(db, "NO", "NV"); const p = prepare(db), before = rows(db), book = readBookVersion(db);
    const effect = variant === "corrupt earlier mapping" ? "update source_material_account_mappings set reason='corrupt' where material_id='M';"
      : variant === "extra mapping" ? "insert into source_material_account_mappings values('M','EXTRA','x','x','x','x');"
        : "insert into source_observations values('LATE','V1','LATE','located','{}','{}','A');";
    db.exec(`create trigger corrupt_source after insert on source_material_account_mappings when new.material_id='N' begin ${effect} end;`);
    expect(() => commit(db, p)).toThrow(source.SourceMaterialAccountCorrectionError);
    expect(rows(db)).toEqual(before); expect(readBookVersion(db)).toEqual(book);
  });
  it("propagates native SQLite failure and rolls back the first mapping too", () => {
    const db = database(); seed(db); version(db, "N", "NV"); observation(db, "NO", "NV"); const p = prepare(db), before = rows(db);
    db.exec("create trigger fail_mapping before insert on source_material_account_mappings when new.material_id='N' begin select raise(abort,'late source failure'); end;");
    expect(() => commit(db, p)).toThrow(/late source failure/); expect(rows(db)).toEqual(before);
  });
  it("final assert after a receipt-like late write catches corruption and the outer rollback restores everything", () => {
    const db = database(); seed(db); const p = prepare(db), before = rows(db), book = readBookVersion(db);
    db.exec("create table test_receipts(id text primary key); create trigger late_receipt after insert on test_receipts begin update source_material_account_mappings set audit_reference='late corruption'; end;");
    db.exec("begin immediate"); source._applyPreparedSourceMaterialAccountCorrectionInTransaction(db, p);
    db.exec("insert into test_receipts values('receipt')");
    error(() => source._assertPreparedSourceMaterialAccountCorrectionInTransaction(db, p, "after"), "source-account-correction-stale", "source_material_account_mappings", '["M","A"]');
    db.exec("rollback"); expect(rows(db)).toEqual(before); expect(readBookVersion(db)).toEqual(book); expect(db.prepare("select * from test_receipts").all()).toEqual([]);
  });
  it("guards rollback writes against a trigger that replaces exact restored metadata", () => {
    const db = database(); seed(db); mapping(db); const p = prepare(db), ledger = commit(db, p), current = rows(db);
    const undo = source._prepareSourceMaterialAccountCorrection(rows(db), restoreInput(p, ledger));
    db.exec("create trigger corrupt_restore after update on source_material_account_mappings when new.reason='original reason' begin update source_material_account_mappings set recorded_at='corrupt'; end;");
    expect(() => commit(db, undo)).toThrow(source.SourceMaterialAccountCorrectionError); expect(rows(db)).toEqual(current);
  });
});
