import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite-initialization";
import { createTradeChanges } from "./trade-changes";
import { getSqliteStore } from "./sqlite-store";
import { createImportHistoryCommitHandler } from "../../api/storage/import-history/commit/handler";
import { readBookVersion } from "./trade-book-version";
import type { TradingViewMigrationPreview } from "./tradingview-account-migration-contracts";

const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
const history = { id: "A", fileName: "A.csv", sourceLabel: "fixture", importedAt: "2026-10-27T00:00:00Z", tradeCount: 2, instrumentCount: 1, excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 1, unresolvedInstrumentCount: 0 };
const execution = { id: "E", accountId: "account", accountLabel: "Fixture account", instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" }, side: "buy" as const, quantity: "1", price: "1", fee: "0", executedAt: "2026-10-27", source: { platform: "fixture", row: 1, batchId: "A" } };
function baseline() {
  const db = new DatabaseSync(":memory:"); databases.push(db); initializeSqlite(db);
  const changes = createTradeChanges(db);
  const plan = changes.prepare({ kind: "import", candidates: [execution, execution], importHistory: [history] });
  const receipt = changes.commit({ planId: plan.planId, requestId: "baseline", choices: {} });
  const body = JSON.parse(String(db.prepare("select body_json from trade_change_plans where id=?").get(plan.planId)!.body_json));
  return { db, body, receipt: structuredClone(receipt) };
}
function clone(source: ReturnType<typeof baseline>, options: { mutate?: (receipt: any) => unknown; consumed?: boolean; body?: object | null; reverse?: boolean; badDigest?: boolean } = {}) {
  const { db } = source, planId = "sibling-plan", receiptId = "sibling-receipt";
  const body = options.body === undefined ? structuredClone(source.body) : structuredClone(options.body);
  if (body?.review) body.review.planId = planId;
  let receipt: any = structuredClone(source.receipt);
  receipt.planId = planId; receipt.receiptId = receiptId;
  if (options.mutate) receipt = options.mutate(receipt) ?? receipt;
  const json = body === null ? null : JSON.stringify(body);
  db.prepare("insert into trade_change_plans(id,policy,created_at,expires_at,body_json,body_digest) values(?,?,?,?,?,?)")
    .run(planId, "trade-changes-v1", history.importedAt, "2026-10-28", json, options.badDigest ? "bad" : createHash("sha256").update(json ?? "").digest("hex"));
  db.prepare("insert into trade_change_receipts(id,plan_id,receipt_json) values(?,?,?)").run(receiptId, planId, JSON.stringify(receipt));
  if (options.reverse) {
    expect(() => db.prepare("update trade_change_plans set receipt_id=?,choices_digest='fixture' where id=?").run(source.receipt.receiptId, planId)).toThrow();
    db.exec("drop trigger trade_change_plan_immutable"); // Isolated pre-trigger/restore fixture only.
  }
  if (options.consumed !== false) db.prepare("update trade_change_plans set receipt_id=?,choices_digest='fixture' where id=?").run(options.reverse ? source.receipt.receiptId : receiptId, planId);
}
async function count(db: DatabaseSync) {
  const before = db.prepare("select reconciliation_json from import_batches order by id").all();
  const version = readBookVersion(db);
  const response = await createImportHistoryCommitHandler(() => db)(new Request("http://local/history", { method: "POST", body: JSON.stringify({ batchId: "A", version }) }));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({ batchId: "A", bookVersion: version });
  expect(db.prepare("select reconciliation_json from import_batches order by id").all()).toEqual(before);
  expect(readBookVersion(db)).toEqual(version);
  return result;
}
function maintenance(source: ReturnType<typeof baseline>) {
  const changes = createTradeChanges(source.db);
  const plan = changes.prepare({ kind: "tradingview-account-migration", operationId: "history-read-maintenance" });
  const preview = plan.tradingView as TradingViewMigrationPreview;
  expect(preview.status).toBe("ready");
  const receipt = changes.commit({ planId: plan.planId, requestId: "maintenance", choices: {}, maintenanceRequest: {
    operationId: preview.operationId, idempotencyKey: "history-read-maintenance:commit", planDigest: preview.planDigest, baseSnapshotDigest: preview.baseSnapshotDigest,
    expectedAffectedRows: [...preview.executionPlan.map(row => ({ table: "executions", key: row.executionId, beforeDigest: row.beforeDigest })), ...preview.referencePlan.map(row => ({ table: row.table, key: row.primaryKey, beforeDigest: row.beforeDigest }))],
    provisionalPrincipalAction: preview.provisionalPrincipal.action === "no-op" ? "no-op" : "create-if-absent",
  } });
  const body = JSON.parse(String(source.db.prepare("select body_json from trade_change_plans where id=?").get(plan.planId)!.body_json));
  return { db: source.db, receipt, body };
}

describe("historical receipt ambiguity through the exact-version public read", () => {
  it("excludes a complete real no-material account maintenance receipt from import counts", async () => {
    const source = baseline(), retained = maintenance(source);
    expect(retained.receipt.result.appliedChanges).toEqual([]);
    expect(retained.receipt.result.report).toEqual({ inserted: 0, duplicate: 0, conflict: 0 });
    expect(await count(source.db)).toHaveProperty("committedDuplicateTradeCount", 1);
  });
  it("excludes a complete real maintenance rollback from import counts", async () => {
    const source = baseline(), retained = maintenance(source), changes = createTradeChanges(source.db);
    const committed = retained.receipt.result.tradingView!;
    const request = { operationId: committed.operationId, rollbackOperationId: "history-read-maintenance:rollback", expectedAfterSnapshotDigest: committed.afterSnapshotDigest };
    const plan = changes.prepare({ kind: "tradingview-account-migration-rollback", ...request });
    expect(plan.tradingView?.status).toBe("ready");
    const receipt = changes.commit({ planId: plan.planId, requestId: "rollback", choices: {}, maintenanceRequest: request });
    expect(receipt.result.appliedChanges).toEqual([]);
    expect(await count(source.db)).toHaveProperty("committedDuplicateTradeCount", 1);
  });
  it.each(["missing appliedChanges", "digest", "input summary", "mixed standard material", "reverse", "import changes", "outcome"])("cannot exclude maintenance with inconsistent %s", async defect => {
    const source = baseline(), retained = maintenance(source), body = structuredClone(retained.body);
    if (defect === "input summary") body.review.summary.inputDigest = "invalid";
    if (defect === "mixed standard material") body.prepared.materials = source.body.prepared.materials;
    clone(retained, { body, badDigest: defect === "digest", reverse: defect === "reverse", mutate: r => {
      if (defect === "missing appliedChanges") delete r.result.appliedChanges;
      if (defect === "import changes") r.result.appliedChanges = source.receipt.result.appliedChanges;
      if (defect === "outcome") r.result.tradingView.status = "unsupported";
    } });
    expect(await count(source.db)).not.toHaveProperty("committedDuplicateTradeCount");
  });
  const malformed: [string, (receipt: any) => unknown][] = [
    ["missing appliedChanges", r => { delete r.result.appliedChanges; }],
    ["null appliedChanges", r => { r.result.appliedChanges = null; }],
    ["object appliedChanges", r => { r.result.appliedChanges = { malformed: true }; }],
    ["string appliedChanges", r => { r.result.appliedChanges = "unsupported"; }],
    ["missing result", r => { delete r.result; }],
    ["empty appliedChanges", r => { r.result.appliedChanges = []; }],
    ["material change omitted", r => { r.result.appliedChanges = r.result.appliedChanges.filter((c: any) => c.kind !== "material-version"); }],
  ];
  it.each(malformed)("keeps consumed same-batch %s unknown beside a valid receipt", async (_name, mutate) => {
    const source = baseline(); clone(source, { mutate });
    expect(await count(source.db)).not.toHaveProperty("committedDuplicateTradeCount");
  });
  it.each(malformed)("excludes unconsumed %s from actual commits", async (_name, mutate) => {
    const source = baseline(); clone(source, { mutate, consumed: false });
    expect(await count(source.db)).toHaveProperty("committedDuplicateTradeCount", 1);
  });
  it("keeps a reverse consumed mismatch unknown rather than dropping its same-batch evidence", async () => {
    const source = baseline(); clone(source, { reverse: true });
    expect(await count(source.db)).not.toHaveProperty("committedDuplicateTradeCount");
  });
  it.each([null, {}])("keeps an unscoped consumed malformed receipt with body %s unknown", async body => {
    const source = baseline(); clone(source, { body, mutate: r => { r.result.appliedChanges = null; } });
    expect(await count(source.db)).not.toHaveProperty("committedDuplicateTradeCount");
  });
  it("does not trust a bad body digest to exclude a malformed receipt from this batch", async () => {
    const source = baseline(); clone(source, { body: { review: { kind: "revision" }, prepared: { intent: { kind: "revision" }, materials: [] } }, badDigest: true, mutate: r => { r.result.appliedChanges = null; } });
    expect(await count(source.db)).not.toHaveProperty("committedDuplicateTradeCount");
  });
  it("keeps an ordinary committed revision with no materials from poisoning import history", async () => {
    const source = baseline(), changes = createTradeChanges(source.db);
    const plan = changes.prepare({ kind: "revision", revision: { id: "revision", accountId: execution.accountId, instrumentId: execution.instrument.id, reason: "reviewed price", changes: [{ before: execution, after: { ...execution, price: "2" } }] } });
    const receipt = changes.commit({ planId: plan.planId, requestId: "revision", choices: {} });
    expect(await count(source.db)).toHaveProperty("committedDuplicateTradeCount", 1);
    const body = JSON.parse(String(source.db.prepare("select body_json from trade_change_plans where id=?").get(plan.planId)!.body_json));
    clone({ db: source.db, body, receipt }, { mutate: r => { r.result.appliedChanges = null; } });
    expect(await count(source.db)).toHaveProperty("committedDuplicateTradeCount", 1);
  });
  it("can exclude a malformed consumed receipt whose complete retained import inputs prove another batch", async () => {
    const source = baseline(), changes = createTradeChanges(source.db);
    const other = { ...execution, id: "EB", accountId: "other-account", source: { ...execution.source, batchId: "B" } };
    const plan = changes.prepare({ kind: "import", candidates: [other, other], importHistory: [{ ...history, id: "B", fileName: "B.csv" }] });
    const receipt = changes.commit({ planId: plan.planId, requestId: "other", choices: {} });
    const body = JSON.parse(String(source.db.prepare("select body_json from trade_change_plans where id=?").get(plan.planId)!.body_json));
    clone({ db: source.db, body, receipt }, { mutate: r => { r.result.appliedChanges = null; } });
    expect(await count(source.db)).toHaveProperty("committedDuplicateTradeCount", 1);
    expect(getSqliteStore(source.db).getImportHistoryCommit("B")).not.toHaveProperty("committedDuplicateTradeCount");
  });
  it.each([{}, { batchId: "B" }])("does not treat incomplete material history identity %s as proof of exclusion", async projection => {
    const source = baseline();
    // New isolated sibling evidence; the original material/history stays intact.
    source.db.prepare(`insert into source_material_versions(id,material_id,parser_version,source_kind,locator_json,scope_json,diagnostics_json,content_json,recorded_at)
      select 'incomplete-version',material_id,parser_version,source_kind,locator_json,scope_json,diagnostics_json,json_set(content_json,'$.historyProjection',json(?)),recorded_at from source_material_versions limit 1`).run(JSON.stringify(projection));
    clone(source, { mutate: r => { r.result.appliedChanges.find((c: any) => c.kind === "material-version").versionId = "incomplete-version"; } });
    expect(await count(source.db)).not.toHaveProperty("committedDuplicateTradeCount");
  });
});
