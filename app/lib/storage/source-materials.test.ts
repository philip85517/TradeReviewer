import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite";
import { SQLITE_MIGRATIONS } from "../../../db/sqlite-schema";

const opened: DatabaseSync[] = [];
afterEach(() => { for (const db of opened.splice(0)) if (db.isOpen) db.close(); });
function database(prior = false) {
  const db = new DatabaseSync(":memory:"); opened.push(db);
  if (!prior) initializeSqlite(db);
  else {
    db.exec("pragma foreign_keys=on; create table schema_migrations(version integer primary key,name text not null,checksum text not null)");
    for (const migration of SQLITE_MIGRATIONS.filter(m => m.version <= 15)) {
      db.exec(migration.sql);
      db.prepare("insert into schema_migrations values (?,?,?)").run(migration.version, migration.name, migration.checksum);
    }
  }
  return db;
}
const rawHistory = '{ "id":"old", "fileName":"HKD-account-A.pdf", "monthly":{"documentId":"doc","accountId":"B","month":"2026-02","templateIds":[],"positions":[],"events":[],"reviewRequired":true}, "tradeCount":0 }';
function seedLegacy(db: DatabaseSync) {
  db.prepare("insert into import_batches(id,source_name,source_type,imported_at,reconciliation_json,evidence_json) values (?,?,?,?,?,?)")
    .run("old", "HKD-account-A.pdf", "statement", "2026-03-01", rawHistory, '{ "unparsed": true }');
  db.exec("insert into instruments(id,symbol,name,market,currency) values('HK:700','700','Name','HK','HKD')");
  db.prepare("insert into executions(id,import_batch_id,instrument_id,account,side,executed_at,quantity,price,evidence_json) values('E1','old','HK:700','A','buy','2026-02-02','1.00000000000000000001','0',?)")
    .run('{ "source": { "platform":"broker" } }');
}

describe("source material migration", () => {
  it("upgrades historical batches without altering original JSON, facts or prior checksums", () => {
    const db = database(true); seedLegacy(db);
    const before = db.prepare("select * from executions").all();
    const checksums = db.prepare("select version,checksum from schema_migrations order by version").all();
    initializeSqlite(db);
    expect(db.prepare("select name from sqlite_master where type='table' and name='source_material_versions'").get())
      .toEqual({ name: "source_material_versions" });
    const version = db.prepare("select * from source_material_versions where legacy_batch_id='old'").get()!;
    expect(version.raw_reconciliation_json).toBe(rawHistory);
    expect(version.raw_evidence_json).toBe('{ "unparsed": true }');
    expect(version.file_fingerprint).toBeNull();
    expect(db.prepare("select reconciliation_json from import_batches where id='old'").get()?.reconciliation_json).toBe(rawHistory);
    expect(db.prepare("select * from executions").all()).toEqual(before);
    expect(db.prepare("select version,checksum from schema_migrations where version<=15 order by version").all()).toEqual(checksums);
  });

  it("retains zero-trade materials and deterministic identities across repeated initialization", () => {
    const db = database(true); seedLegacy(db);
    db.exec("insert into import_batches(id,source_name,imported_at,record_count) values('empty','same.pdf','2026-03-01',0)");
    initializeSqlite(db);
    const first = db.prepare("select id,material_id,legacy_batch_id from source_material_versions order by id").all();
    expect(first).toHaveLength(2);
    expect(new Set(first.map(row => row.material_id)).size).toBe(2);
    initializeSqlite(db);
    expect(db.prepare("select id,material_id,legacy_batch_id from source_material_versions order by id").all()).toEqual(first);
  });

  it("marks unproven legacy observations unresolved without manufacturing row or fingerprint", () => {
    const db = database(true); seedLegacy(db); initializeSqlite(db);
    const observation = db.prepare("select * from source_observations").get()!;
    expect(observation.identity_status).toBe("unresolved");
    expect(observation.observation_key).toBeNull();
    expect(JSON.parse(String(observation.locator_json))).toEqual({});
    expect(observation.raw_json).toBe('{ "source": { "platform":"broker" } }');
    expect(db.prepare("select execution_id from source_execution_links").all()).toEqual([{ execution_id: "E1" }]);
  });
});

import {
  copySourceMaterialRows, materializeSourceMaterialContext, prepareMaterialChanges,
  projectEvidence, explainMaterial, _applyPreparedMaterialChangesInTransaction,
  type MaterialVersionInput,
} from "./source-materials";
import { readBookVersion } from "./trade-book-version";

const unknownAxis = () => ({ values: [] as string[], unknown: true });
function material(id = "M", versionId = "V1", executionIds = ["E1", "E2"]): MaterialVersionInput {
  return { materialId: id, versionId, parserVersion: "p1", sourceKind: "statement",
    locator: { fileName: "USD-A.pdf" }, fileFingerprint: null, recordedAt: "2026-03-01",
    scope: { accounts: { values: ["A"], unknown: false }, markets: unknownAxis(), instruments: unknownAxis(), periods: { values: [], unknown: true } },
    diagnostics: [{ code: "HISTORY_INCOMPLETE" }], content: {},
    observations: executionIds.map((executionId, index) => ({ id: `${versionId}:O${index}`, key: `row:${index + 1}`, locator: { row: index + 1 }, raw: { executionId }, executionIds: [executionId], linkReason: "parsed-row" })),
  };
}
function seedFacts(db: DatabaseSync) {
  db.exec("insert into instruments(id,symbol,name,market,currency) values('US:X','X','X','US','USD')");
  for (const id of ["E1", "E2"]) db.prepare("insert into executions(id,instrument_id,account,side,executed_at,quantity,price) values(?,'US:X','A','buy','2026-02-02','1','0')").run(id);
}
function context(db: DatabaseSync) { return materializeSourceMaterialContext(copySourceMaterialRows(db)); }
function apply(db: DatabaseSync, input: MaterialVersionInput) {
  const change = prepareMaterialChanges(context(db), input);
  db.exec("begin immediate");
  try { _applyPreparedMaterialChangesInTransaction(db, change, []); db.exec("commit"); }
  catch (error) { db.exec("rollback"); throw error; }
}

describe("source material authority", () => {
  it("prepares a serializable immutable description without writing and requires the caller transaction", () => {
    const db = database(); seedFacts(db); const version = readBookVersion(db);
    const input = material(); const change = prepareMaterialChanges(context(db), input);
    input.scope.accounts.values.push("B");
    expect(change.input.scope.accounts.values).toEqual(["A"]);
    expect(Object.isFrozen(change.input.scope.accounts.values)).toBe(true);
    expect(JSON.parse(JSON.stringify(change))).toEqual(change);
    expect(readBookVersion(db)).toEqual(version);
    expect(() => _applyPreparedMaterialChangesInTransaction(db, change, [])).toThrow(/transaction/i);
    db.exec("begin immediate");
    _applyPreparedMaterialChangesInTransaction(db, change, []);
    expect(db.isTransaction).toBe(true);
    db.exec("rollback");
    expect(db.prepare("select * from source_materials").all()).toEqual([]);
  });

  it("preserves old observations and exposes missing facts, other sources and manual revisions", () => {
    const db = database(); seedFacts(db); apply(db, material()); apply(db, material("other", "other:v", ["E2"]));
    db.prepare("insert into trade_revisions(id,instrument_id,account_id,request_json,revision_json,recorded_at) values('R','US:X','A',?,'{}','2026-03-02')").run(JSON.stringify({ changes: [{ before: { id: "E2" }, after: null }] }));
    const change = prepareMaterialChanges(context(db), material("M", "V2", ["E1"]));
    expect(change.missingExecutions).toEqual([{ executionId: "E2", previousObservationIds: ["V1:O1"], otherSourceObservationIds: ["other:v:O0"], revisionIds: ["R"] }]);
    db.exec("begin immediate");
    expect(() => _applyPreparedMaterialChangesInTransaction(db, change, [])).toThrow(/E2/);
    expect(() => _applyPreparedMaterialChangesInTransaction(db, change, [{ executionId: "E2", action: "withdraw", reason: " " }])).toThrow(/reason/i);
    const result = _applyPreparedMaterialChangesInTransaction(db, change, [{ executionId: "E2", action: "keep" }]);
    expect(result.decisions).toEqual([{ executionId: "E2", action: "keep", reason: "" }]);
    db.exec("commit");
    expect(db.prepare("select id from source_observations order by id").all()).toHaveLength(4);
    expect(db.prepare("select * from executions").all()).toHaveLength(2);
    expect(db.prepare("select * from execution_fact_states").all()).toEqual([]);
    expect(explainMaterial(context(db), "M").versions).toHaveLength(2);
  });

  it("rejects stale source dependencies, tampering and duplicate positions before mutation", () => {
    const db = database(); seedFacts(db); apply(db, material());
    const change = prepareMaterialChanges(context(db), material("M", "V2", ["E1"]));
    apply(db, material("other", "other:v", ["E2"]));
    db.exec("begin immediate");
    expect(() => _applyPreparedMaterialChangesInTransaction(db, change, [{ executionId: "E2", action: "keep" }])).toThrow(/dependenc/i);
    expect(() => _applyPreparedMaterialChangesInTransaction(db, { ...change, digest: "wrong" }, [])).toThrow(/digest/i);
    db.exec("rollback");
    const duplicate = material(); duplicate.observations[1].key = duplicate.observations[0].key;
    expect(() => prepareMaterialChanges(context(db), duplicate)).toThrow(/duplicate/i);
  });

  it("excludes a known unrelated account despite unknown market, retaining unknown axes conservatively", () => {
    const db = database(); seedFacts(db); apply(db, material());
    const unrelated = material("B", "B:v", []); unrelated.scope.accounts.values = ["B"]; apply(db, unrelated);
    const unassigned = material("unknown", "unknown:v", []); unassigned.scope.accounts = unknownAxis(); apply(db, unassigned);
    const result = projectEvidence(context(db), { accounts: ["A"], markets: ["US"] });
    expect(result.materials.map(m => m.id)).toEqual(["M", "unknown"]);
    expect(result.diagnostics.some(d => d.code === "SCOPE_UNKNOWN")).toBe(true);
    expect(result.coverage).toBe("not-proven");
  });

  it("rejects edits to immutable evidence and versions mapping and soft-state changes", () => {
    const db = database(); seedFacts(db); apply(db, material()); const before = readBookVersion(db);
    expect(() => db.exec("update source_observations set raw_json='{}' where id='V1:O0'")).toThrow(/immutable/i);
    db.exec("insert into source_material_account_mappings values('M','original','A','reviewed','audit','2026-03-02')");
    expect(readBookVersion(db).sequence).toBeGreaterThan(before.sequence);
    db.prepare("insert into trade_revisions(id,instrument_id,account_id,request_json,revision_json,recorded_at) values('R','US:X','A','{}','{}','2026-03-02')").run();
    const v = readBookVersion(db);
    db.exec("insert into execution_fact_states values('E2','withdrawn','R','duplicate','2026-03-02')");
    expect(readBookVersion(db).sequence).toBeGreaterThan(v.sequence);
    expect(() => db.exec("update execution_fact_states set revision_id='nonexistent' where execution_id='E2'")).toThrow(/foreign key/i);
  });
});

describe("legacy monthly evidence and mapping", () => {
  function migrated(batchId: string, monthly: Record<string, unknown>, audit?: Record<string, unknown>) {
    const db = database(true);
    db.exec("insert into instruments(id,symbol,name,market,currency) values('US:X','X','X','US','USD')");
    const history = { id: batchId, fileName: "account-Z-HKD.pdf", monthly, instrumentCount: 1, tradeCount: 0 };
    const raw = JSON.stringify(history);
    db.prepare("insert into import_batches(id,source_name,imported_at,reconciliation_json) values(?,?,?,?)").run(batchId, "account-Z-HKD.pdf", "2026-03-01", raw);
    if (audit) db.prepare("insert into trade_revisions(id,instrument_id,account_id,request_json,revision_json,recorded_at) values(?,'US:X','A',?,'{}','2026-03-01')").run(batchId, JSON.stringify(audit));
    initializeSqlite(db); return { db, history, raw };
  }
  const monthly = { documentId: "doc", accountId: "A", month: "2026-02", positions: [], events: [], templateIds: [], reviewRequired: true };

  it("uses explicit monthly account/month for zero-trade legacy material and never filename/currency", () => {
    const { db, raw } = migrated("empty", monthly);
    const ctx = context(db); const version = explainMaterial(ctx, "legacy:material:empty").versions[0];
    expect(version.scope.accounts).toEqual({ values: ["A"], unknown: false });
    expect(version.scope.markets).toEqual({ values: [], unknown: true });
    expect(version.scope.periods).toEqual({ values: [{ from: "2026-02-01", to: "2026-02-28" }], unknown: false });
    expect(version.legacy?.reconciliationJson).toBe(raw);
    expect(projectEvidence(ctx, { accounts: ["Z"] }).materials).toEqual([]);
    expect(projectEvidence(ctx, { accounts: ["A"], period: { from: "2026-04-01", to: "2026-04-30" } }).materials).toEqual([]);
  });

  it("recovers scoped supplements only from matching persisted revision proof", () => {
    const id = "supplement:one";
    const history = { id, instrumentCount: 1, monthly };
    const { db, raw } = migrated(id, monthly, { id, accountId: "A", instrumentId: "US:X", importHistory: history });
    const version = explainMaterial(context(db), `legacy:material:${id}`).versions[0];
    expect(version.monthly?.evidenceScope).toEqual({ accountId: "A", instrumentId: "US:X" });
    expect(version.scope.instruments).toEqual({ values: ["US:X"], unknown: false });
    expect(version.legacy?.reconciliationJson).toBe(raw);
    for (const audit of [undefined, { id, accountId: "B", instrumentId: "US:X", importHistory: history }, { id: "other", accountId: "A", instrumentId: "US:X", importHistory: history }]) {
      const invalid = migrated(id, monthly, audit); const ctx = context(invalid.db);
      expect(explainMaterial(ctx, `legacy:material:${id}`).versions[0].monthly).toBeUndefined();
      expect(projectEvidence(ctx, { accounts: ["B"] }).diagnostics.some(d => d.code === "SCOPED_SUPPLEMENT_UNPROVEN")).toBe(true);
    }
  });

  it("projects and reverses explicit account mapping while retaining original monthly JSON and observations", () => {
    const { db, raw } = migrated("empty", monthly);
    db.exec("insert into source_material_account_mappings values('legacy:material:empty','A','canonical','reviewed','audit','2026-03-02')");
    const mapped = explainMaterial(context(db), "legacy:material:empty").versions[0];
    expect(mapped.scope.accounts.values).toEqual(["canonical"]);
    expect(mapped.monthly?.accountId).toBe("canonical");
    expect(mapped.legacy?.reconciliationJson).toBe(raw);
    db.exec("delete from source_material_account_mappings where material_id='legacy:material:empty'");
    expect(explainMaterial(context(db), "legacy:material:empty").versions[0].monthly?.accountId).toBe("A");
  });

  it("keeps new monthly evidence and compatibility history inside the same rollback boundary", () => {
    const db = database(); seedFacts(db); const input = material("M", "V1", []);
    const history = { id: "batch", fileName: "real.pdf", sourceLabel: "statement", importedAt: "2026-03-01", tradeCount: 0, instrumentCount: 1, excludedInstrumentCount: 0, monthly };
    input.historyProjection = { batchId: "batch", reconciliation: history };
    const change = prepareMaterialChanges(context(db), input);
    db.exec("begin immediate"); _applyPreparedMaterialChangesInTransaction(db, change, []);
    expect(db.prepare("select reconciliation_json from import_batches where id='batch'").get()?.reconciliation_json).toBe(JSON.stringify(history));
    expect(explainMaterial(context(db), "M").versions[0].monthly).toEqual(monthly);
    db.exec("rollback");
    expect(db.prepare("select * from import_batches").all()).toEqual([]);
    expect(db.prepare("select * from source_material_versions").all()).toEqual([]);
  });

  it("preserves located duplicate multiplicity and never merges same-amount facts", () => {
    const db = database(true); seedLegacy(db);
    const evidence = JSON.stringify({ source: { fileFingerprint: "fingerprint", page: 1, row: 5 } });
    db.prepare("update executions set evidence_json=? where id='E1'").run(evidence);
    db.prepare("insert into executions(id,import_batch_id,instrument_id,account,side,executed_at,quantity,price,evidence_json) values('E2','old','HK:700','A','buy','2026-02-02','1.00000000000000000001','0',?)").run(evidence);
    initializeSqlite(db);
    expect(db.prepare("select identity_status,observation_key from source_observations order by id").all()).toEqual([{ identity_status: "unresolved", observation_key: null }, { identity_status: "unresolved", observation_key: null }]);
    expect(db.prepare("select * from source_execution_links").all()).toHaveLength(2);
    expect(db.prepare("select * from executions").all()).toHaveLength(2);
  });
});

describe("material mapping and compatibility ownership", () => {
  it("applies audited per-material mapping through the existing transaction and supports an explicit restoration", () => {
    const db = database(); seedFacts(db);
    const input = material("M", "V1", []);
    Object.assign(input, { accountMappings: [{ originalAccountId: "A", canonicalAccountId: "B", reason: "reviewed", auditReference: "R1", recordedAt: "now" }] });
    apply(db, input);
    expect(explainMaterial(context(db), "M").accountMappings).toHaveLength(1);
    expect(projectEvidence(context(db), { accounts: ["B"] }).materials.map(m => m.id)).toEqual(["M"]);
    const restored = material("M", "V2", []);
    Object.assign(restored, { accountMappings: [{ originalAccountId: "A", canonicalAccountId: "A", reason: "explicit restore", auditReference: "R2", recordedAt: "later" }] });
    apply(db, restored);
    expect(projectEvidence(context(db), { accounts: ["A"] }).materials.map(m => m.id)).toEqual(["M"]);
    expect(db.prepare("select * from executions").all()).toHaveLength(2);
  });

  it("does not let another material overwrite a compatibility batch owned by prior evidence", () => {
    const db = database(); seedFacts(db);
    const history = { id: "batch", fileName: "same.pdf", sourceLabel: "s", importedAt: "now", tradeCount: 0, instrumentCount: 0, excludedInstrumentCount: 0 };
    const first = material("M", "V1", []); first.historyProjection = { batchId: "batch", reconciliation: history }; apply(db, first);
    const other = material("other", "other:v", []); other.historyProjection = { batchId: "batch", reconciliation: history };
    expect(() => prepareMaterialChanges(context(db), other)).toThrow(/batch.*another material/i);
  });
});

describe("exact mapping rollback description", () => {
  it("can restore an absent mapping with immutable before/after evidence in the new version", () => {
    const db = database(); seedFacts(db);
    const first = material("M", "V1", []);
    Object.assign(first, { accountMappings: [{ originalAccountId: "A", canonicalAccountId: "B", reason: "reviewed", auditReference: "op1", recordedAt: "now" }] }); apply(db, first);
    const rollback = material("M", "V2", []);
    Object.assign(rollback, { accountMappings: [{ originalAccountId: "A", canonicalAccountId: null, reason: "restore absent before-image", auditReference: "rollback1", recordedAt: "later" }] });
    apply(db, rollback);
    const explained = explainMaterial(context(db), "M");
    expect(explained.accountMappings).toEqual([]);
    expect(explained.versions.find(v => v.id === "V2")?.content.accountMappingChanges).toEqual([{ before: { material_id: "M", original_account_id: "A", canonical_account_id: "B", reason: "reviewed", audit_reference: "op1", recorded_at: "now" }, after: null, reason: "restore absent before-image", auditReference: "rollback1" }]);
    expect(projectEvidence(context(db), { accounts: ["A"] }).materials.map(m => m.id)).toEqual(["M"]);
  });
});

describe("material raw input safety", () => {
  it("rejects non-JSON raw numbers instead of silently changing them to null", () => {
    const db = database(); seedFacts(db); const input = material(); input.observations[0].raw = { value: Number.NaN };
    expect(() => prepareMaterialChanges(context(db), input)).toThrow(/JSON/i);
  });

  const reservedContent = {
    historyProjection: { batchId: "batch", reconciliation: { id: "batch", fileName: "same.pdf", sourceLabel: "s", importedAt: "now", tradeCount: 0, instrumentCount: 0, excludedInstrumentCount: 0 } },
    accountMappingChanges: [{ before: null, after: { originalAccountId: "A", canonicalAccountId: "B" }, reason: "forged", auditReference: "forged" }],
  };

  it.each(["historyProjection", "accountMappingChanges"] as const)("rejects caller-owned content.%s before preparing any material changes", key => {
    const db = database(); seedFacts(db);
    const owner = material("owner", "owner:v", []); owner.historyProjection = reservedContent.historyProjection; apply(db, owner);
    const version = readBookVersion(db);
    const input = material("other", "other:v", []); input.content = { [key]: reservedContent[key] };
    expect(() => prepareMaterialChanges(context(db), input)).toThrow(/reserved.*content/i);
    expect(readBookVersion(db)).toEqual(version);
    expect(db.prepare("select id from source_materials order by id").all()).toEqual([{ id: "owner" }]);
  });

  it.each(["historyProjection", "accountMappingChanges"] as const)("rechecks reserved content.%s at apply even with a valid serialized descriptor checksum", key => {
    const db = database(); seedFacts(db);
    const change = prepareMaterialChanges(context(db), material("M", "V1", []));
    const input = { ...change.input, content: { [key]: reservedContent[key] } };
    const { digest: originalDigest, ...unbound } = { ...change, input };
    // This checksum is not an authorization signature: a serialized caller can
    // recompute it. Validate the input boundary independently at apply time.
    const keys = new Set<string>();
    JSON.stringify(unbound, (name, value) => { keys.add(name); return value; });
    const digest = `sha256:${createHash("sha256").update(JSON.stringify(unbound, [...keys].sort())).digest("hex")}`;
    expect(digest).not.toBe(originalDigest);
    const version = readBookVersion(db);
    db.exec("begin immediate");
    try {
      expect(() => _applyPreparedMaterialChangesInTransaction(db, { ...unbound, digest }, [])).toThrow(/reserved.*content/i);
      expect(db.prepare("select * from source_material_versions").all()).toEqual([]);
      expect(readBookVersion(db)).toEqual(version);
    } finally { db.exec("rollback"); }
  });
});
