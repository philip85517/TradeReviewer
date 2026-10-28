import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite-initialization";
import { getSqliteStore } from "./sqlite-store";
import { readBookVersion } from "./trade-book-version";
import type { ImportHistoryEntry } from "./import-history-contract";

const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
const original: ImportHistoryEntry = { id: "A", fileName: "A.csv", sourceLabel: "fixture", importedAt: "2026-10-27T00:00:00Z", tradeCount: 1, instrumentCount: 1, excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 0, unresolvedInstrumentCount: 0 };
const input = (id: string) => ({ materialId: `material:${id}`, versionId: `version:${id}`, observations: [], historyProjection: { batchId: id, reconciliation: { ...original, id } } });
const change = (id: string) => ({ kind: "material-version", materialId: `material:${id}`, versionId: `version:${id}` });
function evidence() {
  const execution = { id: "E", accountId: "account", accountLabel: "Fixture account", instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" }, side: "buy", quantity: "1", price: "1", fee: "0", executedAt: "2026-10-27", source: { platform: "fixture", row: 1, batchId: "A" } };
  const changes = [{ kind: "add", executionId: "E", before: null, after: { instrumentId: "US:TEST", accountId: "account", side: "buy", quantity: "1", price: "1", fee: "0", executedAt: "2026-10-27", currency: "USD" } }, change("A")];
  return {
    body: { review: { planId: "plan", kind: "import", policy: "trade-changes-v1", baseVersion: { databaseId: "test", epoch: "test", sequence: 0 }, createdAt: original.importedAt, expiresAt: "2026-10-28T00:00:00Z", diagnostics: [], conflicts: [], summary: { candidateCount: 2, inputDigest: "fixture", changes: structuredClone(changes) }, missingExecutions: [], reactivateExecutionIds: [] }, prepared: { intent: { kind: "import", candidates: [execution, execution] }, stateFacts: [], inheritedUnknownFees: [], current: [], withdrawnIds: [], reviewChanges: structuredClone(changes), materials: [{ input: input("A"), missingExecutions: [] }], reconciliation: { acceptedIncoming: [execution], automaticReplacementIds: [], duplicates: [{ kept: execution, skipped: execution }], conflicts: [] } } },
    receipt: { receiptId: "receipt", planId: "plan", policy: "trade-changes-v1", committedAt: "2026-10-27T00:00:00Z", bookVersion: { databaseId: "test", epoch: "test", sequence: 1 }, result: { report: { inserted: 1, duplicate: 1, conflict: 0 }, appliedChanges: changes } },
    persisted: [input("A"), input("B")],
    digestValid: true,
  };
}
type Evidence = ReturnType<typeof evidence>;
function seed(mutate: (value: Evidence) => void = () => {}, retainedHistory: ImportHistoryEntry = original) {
  const db = new DatabaseSync(":memory:"); databases.push(db); initializeSqlite(db);
  const value = evidence(); mutate(value);
  db.prepare("insert into import_batches(id,source_name,source_type,imported_at,record_count,reconciliation_json) values(?,?,?,?,?,?)")
    .run(original.id, original.fileName, "statement", original.importedAt, original.tradeCount, JSON.stringify(retainedHistory));
  for (const material of value.persisted) {
    db.prepare("insert into source_materials(id,created_at) values(?,?)").run(material.materialId, original.importedAt);
    db.prepare("insert into source_material_versions(id,material_id,parser_version,source_kind,locator_json,scope_json,diagnostics_json,content_json,recorded_at) values(?,?,?,?,?,?,?,?,?)")
      .run(material.versionId, material.materialId, "retained-fixture", "statement", "{}", "{}", "[]", JSON.stringify({ historyProjection: material.historyProjection }), original.importedAt);
  }
  const body = JSON.stringify(value.body);
  db.prepare("insert into trade_change_plans(id,policy,created_at,expires_at,body_json,body_digest) values(?,?,?,?,?,?)")
    .run("plan", "trade-changes-v1", original.importedAt, "2026-10-28", body, value.digestValid ? createHash("sha256").update(body).digest("hex") : "wrong");
  db.prepare("insert into trade_change_receipts(id,plan_id,receipt_json) values(?,?,?)").run("receipt", "plan", JSON.stringify(value.receipt));
  db.prepare("update trade_change_plans set receipt_id=?,choices_digest=? where id=?").run("receipt", "fixture", "plan");
  return db;
}

describe("retained import history evidence association", () => {
  const abnormal: [string, (value: Evidence) => void][] = [
    ["receipt contains an extra history material", v => { v.receipt.result.appliedChanges.push(change("B")); }],
    ["receipt contains an extra non-history material", v => { Reflect.deleteProperty(v.persisted[1], "historyProjection"); v.receipt.result.appliedChanges.push(change("B")); }],
    ["plan has an extra material absent from receipt", v => { v.body.prepared.materials.push({ input: input("B"), missingExecutions: [] }); }],
    ["plan has an extra non-history material absent from receipt", v => { const extra = input("B"); Reflect.deleteProperty(extra, "historyProjection"); Reflect.deleteProperty(v.persisted[1], "historyProjection"); v.body.prepared.materials.push({ input: extra, missingExecutions: [] }); }],
    ["receipt repeats the same material tuple", v => { v.receipt.result.appliedChanges.push(change("A")); }],
    ["plan repeats the same material tuple", v => { v.body.prepared.materials.push({ input: input("A"), missingExecutions: [] }); }],
    ["receipt adds another version of the same material", v => { v.receipt.result.appliedChanges.push({ ...change("A"), versionId: "version:other" }); }],
    ["persisted history and prepared history disagree", v => { v.persisted[0].historyProjection.reconciliation.fileName = "different.csv"; }],
    ["persisted material has no matching version", v => { v.persisted = [input("B")]; }],
    ["persisted batch identity disagrees with its reconciliation", v => { v.persisted[0].historyProjection.batchId = "B"; }],
    ["candidate provenance belongs to another batch", v => { v.body.prepared.intent.candidates.push({ ...v.body.prepared.intent.candidates[0], source: { ...v.body.prepared.intent.candidates[0].source, batchId: "B" } }); }],
    ["positive duplicate report has no candidates", v => { v.body.prepared.intent.candidates = []; }],
    ["formal duplicate count disagrees with reconciliation", v => { v.receipt.result.report.duplicate = 2; }],
    ["plan digest disagrees with retained body", v => { v.digestValid = false; }],
    ["receipt identity disagrees with row", v => { v.receipt.receiptId = "other"; }],
    ["prepared material identifier is missing", v => { Reflect.deleteProperty(v.body.prepared.materials[0].input, "materialId"); }],
    ["prepared material collection is unsupported", v => { Reflect.set(v.body.prepared, "materials", {}); }],
    ["retained history projection is unsupported", v => { Reflect.set(v.persisted[0], "historyProjection", "{unsupported"); }],
    ["retained history projection is an encoded object string", v => { Reflect.set(v.persisted[0], "historyProjection", JSON.stringify(v.persisted[0].historyProjection)); }],
  ];
  it.each(abnormal)("returns unknown when %s", (_name, mutate) => {
    const db = seed(mutate);
    const before = db.prepare("select reconciliation_json from import_batches where id='A'").get()?.reconciliation_json;
    // The bounded read uses the same immutable evidence as the original history seam.
    expect(getSqliteStore(db).getImportHistoryCommit("A")).not.toHaveProperty("committedDuplicateTradeCount");
    expect(db.prepare("select reconciliation_json from import_batches where id='A'").get()?.reconciliation_json).toBe(before);
  });

  it("does not authorize another batch through a mismatched retained summary ID", () => {
    const retained = { ...original, id: "B" };
    const db = seed(v => {
      v.persisted[0].historyProjection = { batchId: "B", reconciliation: retained };
      v.body.prepared.materials[0].input.historyProjection = { batchId: "B", reconciliation: retained };
      v.body.prepared.intent.candidates = [{ ...v.body.prepared.intent.candidates[0], source: { ...v.body.prepared.intent.candidates[0].source, batchId: "B" } }];
    }, retained);
    expect(getSqliteStore(db).getImportHistoryCommit("A")).not.toHaveProperty("committedDuplicateTradeCount");
    expect(db.prepare("select reconciliation_json from import_batches where id='A'").get()?.reconciliation_json).toBe(JSON.stringify(retained));
  });
});


describe("bounded import history read HTTP", () => {
  it("reads one persisted batch, requires the exact book version and never changes its evidence", async () => {
    const db = seed();
    const { createImportHistoryCommitHandler } = await import("../../api/storage/import-history/commit/handler");
    const handler = createImportHistoryCommitHandler(() => db), version = readBookVersion(db);
    const send = (body: unknown) => handler(new Request("http://local/api/storage/import-history/commit", { method: "POST", body: JSON.stringify(body) }));
    const rowsBefore = db.prepare("select reconciliation_json from import_batches").all();
    const response = await send({ batchId: "A", version });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ batchId: "A", bookVersion: version, committedDuplicateTradeCount: 1 });
    const missing = await send({ batchId: "absent", version });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: "IMPORT_HISTORY_NOT_FOUND" } });
    const stale = await send({ batchId: "A", version: { ...version, epoch: "stale" } });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: { code: "BOOK_VERSION_CHANGED" } });
    for (const body of [null, [], "A", {}, { batchId: "", version }, { batchId: " ", version }, { batchId: ["A", "B"], version }, { batchId: "A", version, history: original }, { batchId: "A", version: { ...version, sequence: -1 } }, { batchId: "A", version: { ...version, extra: true } }, { batchId: "x".repeat(1025), version }]) {
      expect((await send(body)).status).toBe(400);
    }
    const invalidJson = await handler(new Request("http://local/history", { method: "POST", body: "{" }));
    expect(invalidJson.status).toBe(400);
    expect(await invalidJson.json()).toMatchObject({ error: { code: "INVALID_INPUT" } });
    expect(db.prepare("select reconciliation_json from import_batches").all()).toEqual(rowsBefore);
    expect(db.isTransaction).toBe(false);
  });

  it("keeps server failures distinct from unknown evidence and does not roll back a caller-owned transaction", async () => {
    const { createImportHistoryCommitHandler } = await import("../../api/storage/import-history/commit/handler");
    const db = seed(), version = readBookVersion(db);
    const request = () => new Request("http://local/history", { method: "POST", body: JSON.stringify({ batchId: "A", version }) });
    const unavailable = await createImportHistoryCommitHandler(() => { throw new Error("unavailable"); })(request());
    expect(unavailable.status).toBe(500);
    expect(await unavailable.json()).toMatchObject({ error: { code: "UNEXPECTED_FAILURE" } });
    db.exec("begin");
    const nested = await createImportHistoryCommitHandler(() => db)(request());
    expect(nested.status).toBe(500);
    expect(db.isTransaction).toBe(true);
    db.exec("rollback");
  });

  it("allows consistent ancillary materials and degrades inconsistent linked receipts beside valid evidence to unknown", async () => {
    const db = seed(v => { const extra = input("B"); Reflect.deleteProperty(extra, "historyProjection"); Reflect.deleteProperty(v.persisted[1], "historyProjection"); v.body.prepared.materials.push({ input: extra, missingExecutions: [] }); v.receipt.result.appliedChanges.push(change("B")); v.body.prepared.reviewChanges.push(change("B")); v.body.review.summary.changes.push(change("B")); });
    expect(getSqliteStore(db).getImportHistoryCommit("A")).toMatchObject({ committedDuplicateTradeCount: 1 });
    const conflicting = evidence();
    conflicting.body.review.planId = "other-plan";
    conflicting.receipt.planId = "other-plan";
    conflicting.receipt.receiptId = "other-receipt";
    conflicting.receipt.result.appliedChanges.push(change("B"));
    const body = JSON.stringify(conflicting.body);
    db.prepare("insert into trade_change_plans(id,policy,created_at,expires_at,body_json,body_digest) values(?,?,?,?,?,?)")
      .run("other-plan", "trade-changes-v1", original.importedAt, "2026-10-28", body, createHash("sha256").update(body).digest("hex"));
    db.prepare("insert into trade_change_receipts(id,plan_id,receipt_json) values(?,?,?)").run("other-receipt", "other-plan", JSON.stringify(conflicting.receipt));
    db.prepare("update trade_change_plans set receipt_id=?,choices_digest=? where id=?").run("other-receipt", "fixture", "other-plan");
    expect(getSqliteStore(db).getImportHistoryCommit("A")).not.toHaveProperty("committedDuplicateTradeCount");
  });

  it("isolates malformed evidence from summary reads and rejects unsupported body shapes without changing retained data", async () => {
    const db = seed(v => { Reflect.set(v, "body", null); });
    expect(getSqliteStore(db).getImportHistory()).toEqual([original]);
    expect(getSqliteStore(db).getImportHistoryCommit("A")).toEqual(original);
    const { createImportHistoryCommitHandler } = await import("../../api/storage/import-history/commit/handler");
    const handler = createImportHistoryCommitHandler(() => db);
    const response = await handler(new Request("http://local/history", { method: "POST", body: JSON.stringify({ batchId: "A", version: readBookVersion(db) }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ batchId: "A", bookVersion: readBookVersion(db) });
    expect(db.prepare("select body_json from trade_change_plans where id='plan'").get()?.body_json).toBe("null");
  });
});
