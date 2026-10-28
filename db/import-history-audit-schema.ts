/** Derived evidence only. No original plan, receipt, material or history is rewritten. */
export const IMPORT_HISTORY_AUDIT_SCHEMA = `
create table import_history_audit_state (
 singleton integer primary key check(singleton=1), rule integer not null,
 database_id text not null, epoch text not null, generation integer not null,
 ready integer not null check(ready in (0,1)), trigger_digest text not null
);
create table import_history_plan_proofs (
 plan_id text primary key, body_digest text not null, kind text,
 consumed integer not null check(consumed in (0,1)), receipt_id text,
 scope_json text check(scope_json is null or json_valid(scope_json))
);
create table import_history_memberships (
 batch_id text not null, plan_id text not null references import_history_plan_proofs(plan_id) on delete cascade,
 duplicate_count integer check(duplicate_count is null or duplicate_count>=0), history_digest text,
 primary key(batch_id,plan_id)
);
create index import_history_memberships_plan on import_history_memberships(plan_id);
create table import_history_material_refs (
 version_id text not null, material_id text not null, plan_id text not null references import_history_plan_proofs(plan_id) on delete cascade,
 primary key(version_id,material_id,plan_id)
);
create index import_history_material_refs_plan on import_history_material_refs(plan_id);
create table import_history_audit_dirty (
 plan_id text primary key, body_changed integer not null check(body_changed in (0,1))
);
create trigger import_audit_plan_insert after insert on trade_change_plans begin
 insert into import_history_audit_dirty values(new.id,1) on conflict(plan_id) do update set body_changed=1;
end;
create trigger import_audit_plan_body after update of body_json,body_digest,id on trade_change_plans begin
 insert into import_history_audit_dirty values(old.id,1) on conflict(plan_id) do update set body_changed=1;
 insert into import_history_audit_dirty values(new.id,1) on conflict(plan_id) do update set body_changed=1;
end;
create trigger import_audit_plan_consumption after update of receipt_id,choices_digest on trade_change_plans begin
 insert into import_history_audit_dirty values(new.id,0) on conflict(plan_id) do nothing;
end;
create trigger import_audit_plan_delete after delete on trade_change_plans begin
 insert into import_history_audit_dirty values(old.id,1) on conflict(plan_id) do update set body_changed=1;
end;
create trigger import_audit_receipt_insert after insert on trade_change_receipts begin
 insert into import_history_audit_dirty values(new.plan_id,0) on conflict(plan_id) do nothing;
end;
create trigger import_audit_receipt_update after update on trade_change_receipts begin
 insert into import_history_audit_dirty values(old.plan_id,0) on conflict(plan_id) do nothing;
 insert into import_history_audit_dirty values(new.plan_id,0) on conflict(plan_id) do nothing;
end;
create trigger import_audit_receipt_delete after delete on trade_change_receipts begin
 insert into import_history_audit_dirty values(old.plan_id,0) on conflict(plan_id) do nothing;
end;
${["insert","update","delete"].map(action => `
create trigger import_audit_batch_${action} after ${action} on import_batches begin
 ${action==="update" ? "insert into import_history_audit_dirty select plan_id,0 from import_history_memberships where batch_id=old.id on conflict(plan_id) do nothing;" : ""}
 insert into import_history_audit_dirty select plan_id,0 from import_history_memberships where batch_id=${action==="delete"?"old":"new"}.id
 on conflict(plan_id) do nothing;
end;`).join("\n")}
${["insert","update","delete"].map(action => `
create trigger import_audit_material_${action} after ${action} on source_material_versions begin
 ${action==="update" ? "insert into import_history_audit_dirty select plan_id,0 from import_history_material_refs where version_id=old.id on conflict(plan_id) do nothing;" : ""}
 insert into import_history_audit_dirty select plan_id,0 from import_history_material_refs where version_id=${action==="delete"?"old":"new"}.id
 on conflict(plan_id) do nothing;
end;`).join("\n")}
-- Exact whole-file restore/clone preserves evidence and proofs together. Epoch
-- rotation rebinds only that identity; it never marks a pending generation ready.
create trigger import_audit_epoch after update of database_id,epoch on trade_book_state begin
 update import_history_audit_state set database_id=new.database_id,epoch=new.epoch,generation=generation+1
 where singleton=1 and database_id=old.database_id and epoch=old.epoch;
end;
`;
