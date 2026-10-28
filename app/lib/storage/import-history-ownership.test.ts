import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite-initialization";
import { createTradeChanges } from "./trade-changes";
import { getSqliteStore } from "./sqlite-store";
import { createImportHistoryCommitHandler } from "../../api/storage/import-history/commit/handler";
import { readBookVersion } from "./trade-book-version";
import { csv } from "../import/__fixtures__/tradingview";
import { parseTradingViewSimulationCsv } from "../import/tradingview-simulation";

const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
const history = { id: "A", fileName: "A.csv", sourceLabel: "fixture", importedAt: "2026-10-27T00:00:00Z", tradeCount: 2, instrumentCount: 1, excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 1, unresolvedInstrumentCount: 0 };
const execution = { id: "E", accountId: "account", accountLabel: "Fixture account", instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" }, side: "buy" as const, quantity: "1", price: "1", fee: "0", executedAt: "2026-10-27", source: { platform: "fixture", row: 1, batchId: "A" } };
function database() { const db = new DatabaseSync(":memory:"); databases.push(db); initializeSqlite(db); return db; }
function baseline(existing = false) {
  const db = database(), changes = createTradeChanges(db);
  if (existing) {
    const plan = changes.prepare({ kind: "import", candidates: [{ ...execution, source: { ...execution.source, batchId: "B" } }] });
    changes.commit({ planId: plan.planId, requestId: "seed", choices: {} });
  }
  const plan = changes.prepare({ kind: "import", candidates: existing ? [execution] : [execution, execution], importHistory: [history] });
  const receipt = changes.commit({ planId: plan.planId, requestId: "A", choices: {} });
  const row = db.prepare("select body_json from trade_change_plans where id=?").get(plan.planId)!;
  return { db, body: JSON.parse(String(row.body_json)), receipt: structuredClone(receipt) };
}
function retained(mutate: (v: ReturnType<typeof baseline>) => void, existing = false) {
  const v = baseline(existing); mutate(v);
  const db = database();
  db.prepare("insert into import_batches(id,source_name,source_type,imported_at,record_count,reconciliation_json) values(?,?,?,?,?,?)").run("A", "A.csv", "statement", history.importedAt, 2, JSON.stringify(history));
  for (const row of v.db.prepare("select * from source_material_versions").all()) {
    db.prepare("insert into source_materials(id,created_at) values(?,?)").run(row.material_id, history.importedAt);
    db.prepare("insert into source_material_versions(id,material_id,parser_version,source_kind,locator_json,scope_json,diagnostics_json,content_json,recorded_at) values(?,?,?,?,?,?,?,?,?)")
      .run(row.id, row.material_id, row.parser_version, row.source_kind, row.locator_json, row.scope_json, row.diagnostics_json, row.content_json, row.recorded_at);
  }
  const body = JSON.stringify(v.body);
  db.prepare("insert into trade_change_plans(id,policy,created_at,expires_at,body_json,body_digest) values(?,?,?,?,?,?)").run(v.receipt.planId, "trade-changes-v1", history.importedAt, "2026-10-28", body, createHash("sha256").update(body).digest("hex"));
  db.prepare("insert into trade_change_receipts(id,plan_id,receipt_json) values(?,?,?)").run(v.receipt.receiptId, v.receipt.planId, JSON.stringify(v.receipt));
  db.prepare("update trade_change_plans set receipt_id=?,choices_digest='fixture' where id=?").run(v.receipt.receiptId, v.receipt.planId);
  return db;
}
function appendChange(v: ReturnType<typeof baseline>, change: object) {
  v.body.prepared.reviewChanges.push(change);
  v.body.review.summary.changes.push(change);
  v.receipt.result.appliedChanges.push(change as never);
}

describe("single-batch actual count requires complete execution ownership", () => {
  it("keeps real same-batch and existing-batch duplicate receipts readable", () => {
    for (const existing of [false, true]) {
      const db = retained(() => {}, existing);
      expect(getSqliteStore(db).getImportHistoryCommit("A")).toMatchObject({ committedDuplicateTradeCount: 1 });
    }
  });
  it.each([false, true])("reads ordinary TradingView and legitimate cross-batch duplicate receipts (decoded evidence %s)", decoded => {
    for (const existing of [false, true]) {
      const db = database(), changes = createTradeChanges(db);
      const parsed = parseTradingViewSimulationCsv(new TextEncoder().encode(csv), { fileName: "回放交易_SSE_600330_2026-09-03.csv", sourceFileId: "history-tv-fixture" });
      const candidates = parsed.records.map(row => ({ ...row, source: { ...row.source, batchId: "A" } }));
      if (existing) {
        const seed = changes.prepare({ kind: "import", candidates: [{ ...candidates[0], source: { ...candidates[0].source, batchId: "B" } }] });
        changes.commit({ planId: seed.planId, requestId: "seed", choices: {} });
      }
      const plan = changes.prepare({ kind: "import", candidates, importHistory: [{ ...history, sourceKind: "tradingview" }], ...(decoded ? { tradingViewImport: { policy: "tv-import-v1", material: { kind: "reuse-exact-or-propose" }, evidence: parsed.tradingViewEvidence } } : {}) });
      const receipt = changes.commit({ planId: plan.planId, requestId: "tv", choices: {} });
      expect(receipt.result.report.duplicate).toBe(existing ? 1 : 0);
      expect(getSqliteStore(db).getImportHistoryCommit("A")).toMatchObject({ committedDuplicateTradeCount: receipt.result.report.duplicate });
    }
  });
  it("does not let an unconsumed retained receipt create ambiguity beside a consumed receipt", () => {
    const db = retained(() => {}), value = { body: JSON.parse(String(db.prepare("select body_json from trade_change_plans").get()!.body_json)), receipt: JSON.parse(String(db.prepare("select receipt_json from trade_change_receipts").get()!.receipt_json)) };
    value.body.review.planId = "unconsumed";
    value.receipt.planId = "unconsumed";
    value.receipt.receiptId = "unconsumed-receipt";
    const body = JSON.stringify(value.body);
    db.prepare("insert into trade_change_plans(id,policy,created_at,expires_at,body_json,body_digest) values(?,?,?,?,?,?)").run("unconsumed", "trade-changes-v1", history.importedAt, "2026-10-28", body, createHash("sha256").update(body).digest("hex"));
    db.prepare("insert into trade_change_receipts(id,plan_id,receipt_json) values(?,?,?)").run("unconsumed-receipt", "unconsumed", JSON.stringify(value.receipt));
    expect(getSqliteStore(db).getImportHistoryCommit("A")).toMatchObject({ committedDuplicateTradeCount: 1 });
  });
  it("keeps a separately reviewed TradingView fact-ID binding explicitly unknown instead of assigning an ordinary count", () => {
    const db = database(), changes = createTradeChanges(db);
    const parsed = parseTradingViewSimulationCsv(new TextEncoder().encode(csv), { fileName: "回放交易_SSE_600330_2026-09-03.csv", sourceFileId: "history-tv-fixture" });
    const candidates = parsed.records.map(row => ({ ...row, source: { ...row.source, batchId: "A" } }));
    const seed = changes.prepare({ kind: "import", candidates: [{ ...candidates[0], accountId: "tradingview:legacy", source: { ...candidates[0].source, batchId: "B" } }] });
    changes.commit({ planId: seed.planId, requestId: "seed", choices: {} });
    const input = { kind: "import" as const, candidates, importHistory: [{ ...history, sourceKind: "tradingview" as const }], tradingViewImport: { policy: "tv-import-v1" as const, material: { kind: "reuse-exact-or-propose" as const } } };
    const original = changes.prepare(input);
    expect(original.status).toBe("review-required");
    const reviewed = changes.prepare({ ...input, tradingViewImport: { policy: "tv-import-v1", material: { kind: "reuse-exact-or-propose" }, identity: { kind: "keep-independent", reviewPlanId: original.planId, inputDigest: original.summary.inputDigest, candidateIds: original.identityReviews!.flatMap(review => review.incomingIds) } } });
    const receipt = changes.commit({ planId: reviewed.planId, requestId: "reviewed", choices: {} });
    expect(receipt.result.report.duplicate).toBe(0);
    expect(getSqliteStore(db).getImportHistoryCommit("A")).toMatchObject({ id: "A" });
    expect(getSqliteStore(db).getImportHistoryCommit("A")).not.toHaveProperty("committedDuplicateTradeCount");
  });
  it("keeps a carried account correction explicitly unknown when ordinary reconciliation cannot reproduce its duplicate", () => {
    const db = database(), changes = createTradeChanges(db);
    const incoming = { ...execution, source: { ...execution.source, fileName: "account-correction.csv" } };
    const seed = changes.prepare({ kind: "import", candidates: [{ ...incoming, accountId: "canonical", source: { ...incoming.source, batchId: "B" } }] });
    changes.commit({ planId: seed.planId, requestId: "seed", choices: {} });
    // Isolated retained-correction fixture; prepare and commit still use the real Store.
    const row = db.prepare("select evidence_json from executions where id=?").get(execution.id)!;
    const evidence = { ...JSON.parse(String(row.evidence_json)), accountCorrection: { originalAccountId: execution.accountId, canonicalAccountId: "canonical", reason: "reviewed fixture" } };
    db.prepare("update executions set evidence_json=? where id=?").run(JSON.stringify(evidence), execution.id);
    const plan = changes.prepare({ kind: "import", candidates: [incoming], importHistory: [history] });
    const receipt = changes.commit({ planId: plan.planId, requestId: "corrected", choices: {} });
    expect(receipt.result.report.duplicate).toBe(1);
    const before = db.prepare("select reconciliation_json from import_batches").all();
    expect(getSqliteStore(db).getImportHistoryCommit("A")).not.toHaveProperty("committedDuplicateTradeCount");
    expect(db.prepare("select reconciliation_json from import_batches").all()).toEqual(before);
  });
  const abnormal: [string, (v: ReturnType<typeof baseline>) => void][] = [
    ["add declares a foreign batch even when copied into both retained reviews", v => {
      const after = { ...v.receipt.result.appliedChanges.find(c => c.kind === "add")!.after!, source: { batchId: "B" } };
      appendChange(v, { kind: "add", executionId: "foreign", before: null, after });
    }],
    ["replace claims an execution outside the candidates", v => appendChange(v, { kind: "replace", executionId: "foreign", before: null, after: v.receipt.result.appliedChanges.find(c => c.kind === "add")!.after })],
    ["add changes candidate values", v => {
      const change = v.receipt.result.appliedChanges.find(c => c.kind === "add")!;
      change.after!.price = "99";
      v.body.prepared.reviewChanges.find((c: {kind:string}) => c.kind === "add").after.price = "99";
      v.body.review.summary.changes.find((c: {kind:string}) => c.kind === "add").after.price = "99";
    }],
    ["link lacks its material/observation ownership", v => appendChange(v, { kind: "link", executionId: "foreign" })],
    ["link names a foreign execution despite a matching material", v => {
      const c = v.receipt.result.appliedChanges.find(c => c.kind === "link")!;
      appendChange(v, { ...c, executionId: "foreign" });
    }],
    ["withdraw is outside the current snapshot", v => appendChange(v, { kind: "withdraw", executionId: "foreign", before: null, after: null })],
    ["reactivate lacks a withdrawn snapshot member", v => appendChange(v, { kind: "reactivate", executionId: "foreign", before: null, after: null })],
    ["revise is not an import branch", v => appendChange(v, { kind: "revise", executionId: "foreign", before: null, after: null })],
    ["duplicate metadata is a foreign flat source", v => { v.body.prepared.reconciliation.duplicates = [{ source: { batchId: "B" } }]; }],
    ["duplicate skipped is not any input or retained current row", v => { v.body.prepared.reconciliation.duplicates[0].skipped.source.batchId = "B"; }],
    ["duplicate kept is not any input or retained current row", v => { v.body.prepared.reconciliation.duplicates[0].kept.source.batchId = "B"; }],
    ["duplicate pair carries extra unrecognized source metadata", v => { v.body.prepared.reconciliation.duplicates[0].source = { batchId: "B" }; }],
    ["accepted row is from another source", v => { v.body.prepared.reconciliation.acceptedIncoming[0].source.batchId = "B"; }],
    ["receipt contains a change absent from the immutable review", v => { v.receipt.result.appliedChanges.push({ kind: "link", executionId: "foreign" }); }],
    ["receipt omits an unconditional candidate write", v => { v.receipt.result.appliedChanges = v.receipt.result.appliedChanges.filter(change => change.kind !== "add"); }],
    ["receipt inserted count disagrees with its writes", v => { v.receipt.result.report.inserted = 0; }],
    ["receipt conflict count disagrees with its reconciliation", v => { v.receipt.result.report.conflict = 1; }],
  ];
  it.each(abnormal)("returns unknown when %s without changing retained rows", (_name, mutate) => {
    const db = retained(mutate);
    const before = db.prepare("select reconciliation_json from import_batches").all();
    expect(getSqliteStore(db).getImportHistoryCommit("A")).not.toHaveProperty("committedDuplicateTradeCount");
    expect(db.prepare("select reconciliation_json from import_batches").all()).toEqual(before);
  });
  it.each(["null", "[]", '"unsupported"'])("keeps malformed selected original %s unknown at the HTTP boundary without rewriting it", async json => {
    const db = database();
    db.prepare("insert into import_batches(id,source_name,source_type,imported_at,record_count,reconciliation_json) values(?,?,?,?,?,?)").run("A", "A.csv", "statement", history.importedAt, 2, json);
    const response = await createImportHistoryCommitHandler(() => db)(new Request("http://local/history", { method: "POST", body: JSON.stringify({ batchId: "A", version: readBookVersion(db) }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ batchId: "A", bookVersion: readBookVersion(db) });
    expect(db.prepare("select reconciliation_json from import_batches").get()?.reconciliation_json).toBe(json);
  });
});
