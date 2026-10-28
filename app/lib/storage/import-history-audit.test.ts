import { createHash } from "node:crypto";
import { backup, DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite-initialization";
import { openSqliteDatabase } from "../../../db/sqlite";
import { createImportHistoryCommitHandler } from "../../api/storage/import-history/commit/handler";
import { createTradeChanges } from "./trade-changes";
import { readBookVersion, rotateBookEpoch } from "./trade-book-version";

const databases: DatabaseSync[] = [];
const directories: string[]=[];
afterEach(() => {
  databases.splice(0).forEach(database => {if(database.isOpen) database.close();});
  directories.splice(0).forEach(directory=>rmSync(directory,{recursive:true,force:true}));
});
const history = (id: string) => ({ id, fileName: `${id}.csv`, sourceLabel: "audit fixture", importedAt: "2026-10-27T00:00:00Z", tradeCount: 2, instrumentCount: 1, excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 0, unresolvedInstrumentCount: 0 });
const execution = (id: string) => ({ id: `execution:${id}`, accountId: "account", accountLabel: "Fixture", instrument: { id: `US:${id}`, symbol: id, name: id, market: "US", currency: "USD" }, side: "buy" as const, quantity: "1", price: "1", fee: "0", executedAt: "2026-10-27", source: { platform: "fixture", row: 1, batchId: id } });
function baseline(database=new DatabaseSync(":memory:")) {
  databases.push(database); initializeSqlite(database);
  const changes = createTradeChanges(database);
  const commit = (id: string) => {
    const incoming = execution(id);
    const plan = changes.prepare({ kind: "import", candidates: [incoming, incoming], importHistory: [history(id)] });
    const receipt = changes.commit({ planId: plan.planId, requestId: `request:${id}`, choices: {} });
    expect(receipt.result.report.duplicate).toBe(1);
    const body = JSON.parse(String(database.prepare("select body_json from trade_change_plans where id=?").get(plan.planId)!.body_json));
    return { body, receipt: structuredClone(receipt) };
  };
  return { database, a: commit("A"), b: commit("B") };
}
async function actual(database: DatabaseSync, batchId: string) {
  const bookVersion = readBookVersion(database);
  const response = await createImportHistoryCommitHandler(() => database)(new Request("http://local/history", { method: "POST", body: JSON.stringify({ batchId, version: bookVersion }) }));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({ batchId, bookVersion });
  return result;
}

describe("complete retained import audit through the public exact-version read", () => {
  it("keeps unrelated real imports known although B retains A in its current source snapshot", async () => {
    const { database, b } = baseline();
    expect(b.body.prepared.current.some((row: ReturnType<typeof execution>) => row.source.batchId === "A")).toBe(true);
    expect(await actual(database, "A")).toHaveProperty("committedDuplicateTradeCount", 1);
    expect(await actual(database, "B")).toHaveProperty("committedDuplicateTradeCount", 1);
  });

  it("preserves a real cross-batch duplicate whose kept execution belongs to A", async () => {
    const { database } = baseline(), changes = createTradeChanges(database);
    const incoming = { ...execution("A"), source: { ...execution("A").source, batchId: "C", row: 2 } };
    const plan = changes.prepare({ kind: "import", candidates: [incoming], importHistory: [{ ...history("C"), tradeCount: 1 }] });
    const receipt = changes.commit({ planId: plan.planId, requestId: "request:C", choices: {} });
    expect(receipt.result.report).toMatchObject({ inserted: 0, duplicate: 1 });
    expect(await actual(database, "A")).toHaveProperty("committedDuplicateTradeCount", 1);
    expect(await actual(database, "C")).toHaveProperty("committedDuplicateTradeCount", 1);
  });

  it("keeps A known when a malformed consumed receipt is completely scoped to B", async () => {
    const { database, b } = baseline();
    const planId = "malformed-B-plan", receiptId = "malformed-B-receipt";
    const body = structuredClone(b.body), receipt = structuredClone(b.receipt);
    body.review.planId = planId; receipt.planId = planId; receipt.receiptId = receiptId;
    Reflect.set(receipt.result, "appliedChanges", null);
    const json = JSON.stringify(body);
    database.prepare("insert into trade_change_plans(id,policy,created_at,expires_at,body_json,body_digest) values(?,?,?,?,?,?)")
      .run(planId, "trade-changes-v1", history("B").importedAt, "2026-10-28", json, createHash("sha256").update(json).digest("hex"));
    database.prepare("insert into trade_change_receipts(id,plan_id,receipt_json) values(?,?,?)").run(receiptId, planId, JSON.stringify(receipt));
    database.prepare("update trade_change_plans set receipt_id=?,choices_digest='fixture' where id=?").run(receiptId, planId);
    expect(await actual(database, "A")).toHaveProperty("committedDuplicateTradeCount", 1);
    expect(await actual(database, "B")).not.toHaveProperty("committedDuplicateTradeCount");
  });

  it("does not assign A a definite count when a complete-looking B receipt hides A in its plan input", async () => {
    const { database, b } = baseline();
    expect(await actual(database, "A")).toHaveProperty("committedDuplicateTradeCount", 1);
    const originals = database.prepare("select id,reconciliation_json from import_batches order by id").all();
    // An isolated, append-only old/abnormal evidence fixture. Its small receipt
    // claims only B's real material; A appears only inside the retained plan.
    const planId = "hidden-plan", receiptId = "hidden-receipt";
    const body = structuredClone(b.body), receipt = structuredClone(b.receipt);
    body.review.planId = planId;
    body.prepared.intent.candidates = body.prepared.intent.candidates.map((candidate: ReturnType<typeof execution>) => ({ ...candidate, source: { ...candidate.source, batchId: "A" } }));
    body.prepared.intent.importHistory = [history("A")];
    receipt.planId = planId; receipt.receiptId = receiptId;
    const json = JSON.stringify(body);
    database.prepare("insert into trade_change_plans(id,policy,created_at,expires_at,body_json,body_digest) values(?,?,?,?,?,?)")
      .run(planId, "trade-changes-v1", history("A").importedAt, "2026-10-28", json, createHash("sha256").update(json).digest("hex"));
    database.prepare("insert into trade_change_receipts(id,plan_id,receipt_json) values(?,?,?)").run(receiptId, planId, JSON.stringify(receipt));
    database.prepare("update trade_change_plans set receipt_id=?,choices_digest='fixture' where id=?").run(receiptId, planId);
    expect(await actual(database, "A")).not.toHaveProperty("committedDuplicateTradeCount");
    expect(database.prepare("select id,reconciliation_json from import_batches order by id").all()).toEqual(originals);
  });
});

it("publishes preparation/commit/alias proofs atomically and rolls all new evidence back on proof failure", async () => {
  const {database}=baseline(), changes=createTradeChanges(database);
  const incoming=execution("C"), plan=changes.prepare({kind:"import",candidates:[incoming,incoming],importHistory:[history("C")]});
  expect(database.prepare("select consumed from import_history_plan_proofs where plan_id=?").get(plan.planId)?.consumed).toBe(0);
  const counts=()=>database.prepare("select (select count(*) from executions) as facts,(select count(*) from source_material_versions) as versions,(select count(*) from trade_change_receipts) as receipts,(select count(*) from trade_change_requests) as aliases").get();
  const before=counts();
  database.exec("create trigger fail_audit_publish before insert on import_history_plan_proofs begin select raise(abort,'audit publish failed'); end;");
  expect(()=>changes.commit({planId:plan.planId,requestId:"C",choices:{}})).toThrow();
  expect(counts()).toEqual(before);
  expect(database.prepare("select receipt_id from trade_change_plans where id=?").get(plan.planId)?.receipt_id).toBeNull();
  expect(database.prepare("select 1 from import_history_audit_dirty limit 1").get()).toBeUndefined();
  database.exec("drop trigger fail_audit_publish");
  const receipt=changes.commit({planId:plan.planId,requestId:"C",choices:{}});
  expect(changes.commit({planId:plan.planId,requestId:"C-alias",choices:{}})).toEqual(receipt);
  expect(database.prepare("select count(*) as n from import_history_memberships where batch_id='C'").get()?.n).toBe(1);
  expect(await actual(database,"C")).toHaveProperty("committedDuplicateTradeCount",1);
});

it("does not reuse a count after raw batch evidence changes, and never writes the original back", async()=>{
  const {database}=baseline();
  const changed=JSON.stringify({...history("A"),fileName:"changed-original.csv"});
  database.prepare("update import_batches set reconciliation_json=? where id='A'").run(changed);
  expect(await actual(database,"A")).not.toHaveProperty("committedDuplicateTradeCount");
  expect(await actual(database,"B")).toHaveProperty("committedDuplicateTradeCount",1);
  expect(database.prepare("select reconciliation_json from import_batches where id='A'").get()?.reconciliation_json).toBe(changed);
});

it("certifies unconsumed and expired plans without treating them as formal receipts",async()=>{
  const {database}=baseline();
  const changes=createTradeChanges(database,{now:()=>Date.parse("2026-10-27"),ttlMs:1});
  const plan=changes.prepare({kind:"import",candidates:[execution("pending")],importHistory:[history("pending")]});
  expect(database.prepare("select consumed from import_history_plan_proofs where plan_id=?").get(plan.planId)?.consumed).toBe(0);
  createTradeChanges(database,{now:()=>Date.parse("2026-10-28")}).cleanupExpired();
  expect(database.prepare("select body_json from trade_change_plans where id=?").get(plan.planId)?.body_json).toBeNull();
  expect(await actual(database,"A")).toHaveProperty("committedDuplicateTradeCount",1);
});

it("detects a changed body even when the original immutability guard alone was bypassed",async()=>{
  const {database,b}=baseline();
  database.exec("drop trigger trade_change_plan_immutable");
  database.prepare("update trade_change_plans set body_json=null where id=?").run(b.receipt.planId);
  expect(await actual(database,"A")).not.toHaveProperty("committedDuplicateTradeCount");
});

it("reports missing protection as an operational error instead of a false unknown success",async()=>{
  const {database}=baseline();
  database.exec("drop trigger import_audit_receipt_insert");
  const response=await createImportHistoryCommitHandler(()=>database)(new Request("http://local/history",{method:"POST",body:JSON.stringify({batchId:"A",version:readBookVersion(database)})}));
  expect(response.status).toBe(500);
  expect(await response.json()).toHaveProperty("error");
});

it("invalidates a material proof by its old version identity when isolated recovery changes that identity",async()=>{
  const {database,a}=baseline();
  const material=a.receipt.result.appliedChanges.find(change=>change.kind==="material-version")!;
  if (!material.versionId) throw new Error("Fixture material version is missing");
  database.exec("pragma foreign_keys=off; drop trigger source_material_versions_immutable_update");
  database.prepare("update source_material_versions set id=? where id=?").run("recovered-version",material.versionId);
  expect(await actual(database,"A")).not.toHaveProperty("committedDuplicateTradeCount");
  expect(await actual(database,"B")).toHaveProperty("committedDuplicateTradeCount",1);
});

it("observes another connection's dirty evidence across reopen and allows a certified read-only connection",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"import-audit-")); directories.push(directory);
  const path=join(directory,"audit.sqlite"), first=openSqliteDatabase(path); baseline(first);
  const other=new DatabaseSync(path); databases.push(other); initializeSqlite(other);
  other.prepare("update import_batches set reconciliation_json=? where id='A'").run(JSON.stringify({...history("A"),fileName:"external.csv"}));
  expect(await actual(first,"A")).not.toHaveProperty("committedDuplicateTradeCount");
  expect(await actual(first,"B")).toHaveProperty("committedDuplicateTradeCount",1);
  first.close(); other.close();
  const reopened=openSqliteDatabase(path); databases.push(reopened);
  expect(await actual(reopened,"B")).toHaveProperty("committedDuplicateTradeCount",1);
  reopened.close();
  const readonly=new DatabaseSync(path,{readOnly:true}); databases.push(readonly);
  expect(await actual(readonly,"B")).toHaveProperty("committedDuplicateTradeCount",1);
});

it("restores a complete certified file and atomically rebinds recovery epoch without rewriting original evidence",async()=>{
  const {database}=baseline(), directory=mkdtempSync(join(tmpdir(),"import-audit-restore-")); directories.push(directory);
  const path=join(directory,"backup.sqlite");
  const originals=database.prepare("select id,body_json,body_digest,receipt_id from trade_change_plans order by id").all();
  const old=readBookVersion(database);
  await backup(database,path);
  const restored=new DatabaseSync(path); databases.push(restored); initializeSqlite(restored);
  const prior=restored.prepare("select generation from import_history_audit_state").get()!;
  const recovered=rotateBookEpoch(restored);
  expect(recovered.epoch).not.toBe(old.epoch);
  expect(restored.prepare("select epoch,generation,ready from import_history_audit_state").get()).toEqual({epoch:recovered.epoch,generation:Number(prior.generation)+1,ready:1});
  expect(await actual(restored,"A")).toHaveProperty("committedDuplicateTradeCount",1);
  const stale=await createImportHistoryCommitHandler(()=>restored)(new Request("http://local/history",{method:"POST",body:JSON.stringify({batchId:"A",version:old})}));
  expect(stale.status).toBe(409);
  expect(restored.prepare("select id,body_json,body_digest,receipt_id from trade_change_plans order by id").all()).toEqual(originals);
});

it("never publishes a partial first generation and retries cleanly after an interrupted build",async()=>{
  const {database}=baseline();
  database.exec("delete from import_history_audit_state; delete from import_history_plan_proofs;");
  database.exec("create trigger fail_initial_audit before insert on import_history_plan_proofs when (select count(*) from import_history_plan_proofs)>0 begin select raise(abort,'interrupted initial audit'); end;");
  const response=await createImportHistoryCommitHandler(()=>database)(new Request("http://local/history",{method:"POST",body:JSON.stringify({batchId:"A",version:readBookVersion(database)})}));
  expect(response.status).toBe(500);
  expect(database.prepare("select * from import_history_audit_state").all()).toEqual([]);
  expect(database.prepare("select * from import_history_plan_proofs").all()).toEqual([]);
  database.exec("drop trigger fail_initial_audit");
  expect(await actual(database,"A")).toHaveProperty("committedDuplicateTradeCount",1);
  expect(database.prepare("select count(*) n from import_history_plan_proofs").get()?.n).toBe(database.prepare("select count(*) n from trade_change_plans").get()?.n);
});
