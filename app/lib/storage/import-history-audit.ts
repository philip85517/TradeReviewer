import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { IMPORT_HISTORY_AUDIT_SCHEMA } from "../../../db/import-history-audit-schema";
import type { ImportHistoryEntry } from "./import-history-contract";
import { historyEvidenceDigest, inspectImportHistoryPlan, type ImportPlanProof } from "./import-history-commit-projection";
import { readBookVersion } from "./trade-book-version";
import { parseTradeCommitReceipt } from "./trade-change-response";

const RULE=1;
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const normalize=(sql:string)=>sql.trim().replace(/;$/," ").replace(/\s+/g," ").trim().toLowerCase();
const expectedTriggers=[...IMPORT_HISTORY_AUDIT_SCHEMA.matchAll(/create trigger\s+(\w+)[\s\S]*?end;/g)].map(match=>[match[1],normalize(match[0])]).sort(([a],[b])=>a.localeCompare(b));
const EXPECTED_TRIGGER_DIGEST=hash(JSON.stringify(expectedTriggers));
function triggerDigest(database: DatabaseSync): string {
  const rows=database.prepare("select name,sql from sqlite_master where type='trigger' and name like 'import_audit_%' order by name").all();
  return hash(JSON.stringify(rows.map(row=>[String(row.name),normalize(String(row.sql))])));
}
function assertTriggers(database: DatabaseSync) {
  if (triggerDigest(database)!==EXPECTED_TRIGGER_DIGEST) throw new Error("Import history audit protection is unavailable; initialization/recovery required");
}

/** A receipt-only defect can reuse an unchanged certified ordinary input scope.
 * Maintenance exclusion requires its intact outcome and cannot use this shortcut. */
function scopedMalformedReceipt(database: DatabaseSync, id: string): ImportPlanProof | undefined {
  const prior=database.prepare("select * from import_history_plan_proofs where plan_id=?").get(id);
  if (!prior || prior.kind!=="import" && prior.kind!=="revision" && prior.kind!=="material" && prior.kind!=="browser-migration" || typeof prior.scope_json!=="string") return;
  const plan=database.prepare("select receipt_id,body_digest,body_json is not null as body_present from trade_change_plans where id=?").get(id);
  if (!plan || plan.body_digest!==prior.body_digest || !plan.body_present || plan.receipt_id===null) return;
  const receipt=database.prepare("select id,receipt_json from trade_change_receipts where plan_id=?").get(id);
  if (!receipt) return;
  let raw: unknown;
  try { raw=JSON.parse(String(receipt.receipt_json)); parseTradeCommitReceipt(raw,id); return; } catch (error) {
    if (error && typeof error==="object" && "code" in error && String(error.code).startsWith("ERR_")) throw error;
  }
  const result=raw && typeof raw==="object" && "result" in raw ? raw.result : undefined;
  const changes=result && typeof result==="object" && "appliedChanges" in result ? result.appliedChanges : undefined;
  // Nonempty material claims require normal complete verification and scope union.
  if (Array.isArray(changes) && changes.length) return;
  const scope: string[]=JSON.parse(prior.scope_json);
  return {scope,consumed:true,kind:String(prior.kind),bodyDigest:String(prior.body_digest),receiptId:String(plan.receipt_id),memberships:scope.map(batchId=>({batchId})),materialRefs:database.prepare("select material_id,version_id from import_history_material_refs where plan_id=?").all(id).map(row=>({materialId:String(row.material_id),versionId:String(row.version_id)}))};
}

/** Publishes only a complete generation. A caller's write transaction owns rollback.
 * Initial/legacy build is deliberately synchronous and included in startup/read cost.
 * There is no process cache, rowid watermark, or background readiness shortcut. */
export function ensureImportHistoryAudit(database: DatabaseSync): void {
  assertTriggers(database);
  const currentBook=readBookVersion(database), current=database.prepare("select * from import_history_audit_state where singleton=1").get();
  if (current && current.rule===RULE && current.ready===1 && current.database_id===currentBook.databaseId && current.epoch===currentBook.epoch && current.trigger_digest===EXPECTED_TRIGGER_DIGEST &&
      !database.prepare("select 1 from import_history_audit_dirty limit 1").get() &&
      !database.prepare("select 1 from trade_change_plans p where not exists(select 1 from import_history_plan_proofs a where a.plan_id=p.id) limit 1").get()) return;
  const ownTransaction=!database.isTransaction;
  if (ownTransaction) database.exec("begin immediate");
  try {
    const book=readBookVersion(database);
    const state=database.prepare("select * from import_history_audit_state where singleton=1").get();
    const rebuild=!state || state.rule!==RULE || state.database_id!==book.databaseId || state.epoch!==book.epoch || state.trigger_digest!==EXPECTED_TRIGGER_DIGEST || state.ready!==1;
    if (rebuild) {
      database.exec("delete from import_history_memberships; delete from import_history_material_refs; delete from import_history_plan_proofs;");
      database.exec("insert into import_history_audit_dirty select id,1 from trade_change_plans where true on conflict(plan_id) do update set body_changed=1;");
    }
    // Stable IDs, not rowids. A new uncovered row cannot disappear behind a watermark.
    database.exec("insert into import_history_audit_dirty select p.id,1 from trade_change_plans p where not exists(select 1 from import_history_plan_proofs a where a.plan_id=p.id) on conflict(plan_id) do update set body_changed=1;");
    const dirty=database.prepare("select plan_id,body_changed from import_history_audit_dirty order by plan_id").all();
    for (const row of dirty) {
      const id=String(row.plan_id);
      const exists=database.prepare("select 1 from trade_change_plans where id=?").get(id);
      const proof=exists ? (!row.body_changed && scopedMalformedReceipt(database,id)) || inspectImportHistoryPlan(database,id) : undefined;
      database.prepare("delete from import_history_memberships where plan_id=?").run(id);
      database.prepare("delete from import_history_material_refs where plan_id=?").run(id);
      database.prepare("delete from import_history_plan_proofs where plan_id=?").run(id);
      if (proof) {
        database.prepare("insert into import_history_plan_proofs(plan_id,body_digest,kind,consumed,receipt_id,scope_json) values(?,?,?,?,?,?)").run(id,proof.bodyDigest,proof.kind,Number(proof.consumed),proof.receiptId,proof.scope===null ? null : JSON.stringify(proof.scope));
        for (const member of proof.memberships) database.prepare("insert into import_history_memberships(batch_id,plan_id,duplicate_count,history_digest) values(?,?,?,?)").run(member.batchId,id,member.count??null,member.historyDigest??null);
        for (const ref of proof.materialRefs) database.prepare("insert or ignore into import_history_material_refs(version_id,material_id,plan_id) values(?,?,?)").run(ref.versionId,ref.materialId,id);
      }
      database.prepare("delete from import_history_audit_dirty where plan_id=?").run(id);
    }
    database.prepare(`insert into import_history_audit_state values(1,?,?,?,?,1,?)
      on conflict(singleton) do update set rule=excluded.rule,database_id=excluded.database_id,epoch=excluded.epoch,generation=import_history_audit_state.generation+1,ready=1,trigger_digest=excluded.trigger_digest`)
      .run(RULE,book.databaseId,book.epoch,Number(state?.generation??0)+1,EXPECTED_TRIGGER_DIGEST);
    if (ownTransaction) database.exec("commit");
  } catch (error) { if (ownTransaction && database.isTransaction) database.exec("rollback"); throw error; }
}

/** Read only certified small rows from the caller's exact-version snapshot. */
export function readImportHistoryCommits(database: DatabaseSync, entries: ImportHistoryEntry[]): ImportHistoryEntry[] {
  const originals=entries.map(({committedDuplicateTradeCount:_untrusted,...entry})=>entry);
  assertTriggers(database);
  const book=readBookVersion(database), state=database.prepare("select * from import_history_audit_state where singleton=1").get();
  const unsafe=!state || state.rule!==RULE || state.ready!==1 || state.database_id!==book.databaseId || state.epoch!==book.epoch || state.trigger_digest!==EXPECTED_TRIGGER_DIGEST ||
    !!database.prepare("select 1 from import_history_audit_dirty limit 1").get() ||
    !!database.prepare("select 1 from trade_change_plans p where not exists(select 1 from import_history_plan_proofs a where a.plan_id=p.id) limit 1").get() ||
    !!database.prepare("select 1 from import_history_plan_proofs where consumed=1 and scope_json is null limit 1").get() ||
    !!database.prepare("select 1 from trade_change_receipts r where not exists(select 1 from trade_change_plans p where p.id=r.plan_id) limit 1").get() ||
    !!database.prepare("select 1 from trade_change_requests q where not exists(select 1 from trade_change_receipts r where r.id=q.receipt_id) limit 1").get();
  if (unsafe) return originals;
  const members=database.prepare(`select m.duplicate_count,m.history_digest,
    exists(select 1 from trade_change_requests q where q.receipt_id=p.receipt_id and (length(trim(q.request_id))=0 or length(q.request_digest)<>64 or q.request_digest glob '*[^0-9a-f]*')) as bad_alias
    from import_history_memberships m join import_history_plan_proofs p on p.plan_id=m.plan_id where m.batch_id=?`);
  return originals.map(entry=>{
    const rows=members.all(entry.id);
    return rows.length===1 && !rows[0].bad_alias && typeof rows[0].duplicate_count==="number" && rows[0].history_digest===historyEvidenceDigest(entry)
      ? {...entry,committedDuplicateTradeCount:rows[0].duplicate_count} : entry;
  });
}
