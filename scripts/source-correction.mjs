import { createHash } from 'node:crypto';
import { DatabaseSync, backup } from 'node:sqlite';
import { closeSync, openSync, readFileSync, realpathSync, statSync, chmodSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TABLES = ['executions', 'import_batches', 'instruments'];
const EDITABLE = {
  executions: new Set(['instrument_id', 'account', 'evidence_json', 'updated_at']),
  import_batches: new Set(['evidence_json', 'reconciliation_json', 'record_count']),
  instruments: new Set(),
};
const JOURNAL = 'source_correction_runs';
class CorrectionError extends Error {}
const fail = code => { throw new CorrectionError(code); };
const requireThat = (condition, code = 'invalid-plan') => { if (!condition) fail(code); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const quote = name => `"${name.replaceAll('"', '""')}"`;
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const stable = value => JSON.stringify(canonical(value));
const hash = value => createHash('sha256').update(value).digest('hex');
const same = (left, right) => stable(left) === stable(right);
function exactKeys(value, keys) {
  requireThat(object(value) && same(Object.keys(value).sort(), [...keys].sort()));
}
function guarded(action) {
  try { return action(); } catch (error) {
    if (error instanceof CorrectionError) throw error;
    // SQLite error messages can contain values or schema details. Never relay them.
    throw new CorrectionError('source-correction-failed');
  }
}
function digest(database) {
  return hash(stable(TABLES.map(table => ({ table, rows: database.prepare(`SELECT * FROM ${quote(table)} ORDER BY id COLLATE BINARY`).all() }))));
}
/** Hash only the complete three source tables; journal and derived tables are excluded. */
export function sourceDigest(database) {
  return guarded(() => database.isTransaction
    ? digest(database)
    : transaction(database, 'BEGIN', () => digest(database)));
}

function columns(database, table) {
  const result = database.prepare(`PRAGMA table_info(${quote(table)})`).all();
  requireThat(result.length > 0 && result.some(column => column.name === 'id' && column.pk === 1), 'unsupported-schema');
  return result;
}
function validateRow(row, id, schema) {
  if (row === null) return;
  exactKeys(row, schema.map(column => column.name));
  requireThat(row.id === id);
  for (const column of schema) {
    const value = row[column.name];
    requireThat(value === null || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)));
    requireThat(!(column.notnull && value === null));
    if (value !== null && /INT/i.test(column.type)) requireThat(typeof value === 'number' && Number.isSafeInteger(value));
    if (value !== null && column.name.endsWith('_json')) {
      requireThat(typeof value === 'string');
      try { JSON.parse(value); } catch { fail('invalid-json'); }
    }
  }
}
function validate(database, plan) {
  exactKeys(plan, ['id', 'reason', 'baselineDigest', 'evidence', 'changes']);
  requireThat(nonempty(plan.id) && nonempty(plan.reason) && sha(plan.baselineDigest));
  requireThat(Array.isArray(plan.evidence) && plan.evidence.length > 0);
  for (const evidence of plan.evidence) {
    exactKeys(evidence, ['sha256', 'page', 'description']);
    requireThat(sha(evidence.sha256) && Number.isSafeInteger(evidence.page) && evidence.page > 0 && nonempty(evidence.description));
  }
  requireThat(Array.isArray(plan.changes) && plan.changes.length > 0 && plan.changes.length <= 500);
  const schemas = Object.fromEntries(TABLES.map(table => [table, columns(database, table)]));
  const seen = new Set();
  for (const change of plan.changes) {
    exactKeys(change, ['table', 'id', 'before', 'after']);
    requireThat(TABLES.includes(change.table) && nonempty(change.id));
    const key = stable([change.table, change.id]);
    requireThat(!seen.has(key)); seen.add(key);
    requireThat(change.after !== null); // No deletes, including null -> null.
    validateRow(change.before, change.id, schemas[change.table]);
    validateRow(change.after, change.id, schemas[change.table]);
    if (change.before !== null) {
      requireThat(change.table !== 'instruments');
      for (const column of schemas[change.table]) {
        if (!same(change.before[column.name], change.after[column.name])) requireThat(EDITABLE[change.table].has(column.name), 'forbidden-field-change');
      }
    }
  }
  return schemas;
}
function row(database, change) {
  return database.prepare(`SELECT * FROM ${quote(change.table)} WHERE id=?`).get(change.id) ?? null;
}
function assertRows(database, changes, snapshot) {
  for (const change of changes) requireThat(same(row(database, change), change[snapshot]), 'row-conflict');
}
function journalEntry(database, id) {
  const exists = database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(JOURNAL);
  return exists ? database.prepare(`SELECT * FROM ${JOURNAL} WHERE operation_id=?`).get(id) : null;
}
function inspect(database, plan) {
  const schemas = validate(database, plan);
  const planJson = stable(plan); const planHash = hash(planJson);
  const prior = journalEntry(database, plan.id);
  if (prior) {
    requireThat(prior.plan_hash === planHash && prior.plan_json === planJson, 'operation-id-conflict');
    requireThat(prior.status === 'applied', 'operation-already-rolled-back');
    requireThat(digest(database) === prior.after_digest, 'source-conflict');
    assertRows(database, plan.changes, 'after');
    return { schemas, planJson, planHash, prior };
  }
  requireThat(digest(database) === plan.baselineDigest, 'source-conflict');
  assertRows(database, plan.changes, 'before');
  return { schemas, planJson, planHash, prior: null };
}
function transaction(database, mode, action) {
  requireThat(!database.isTransaction, 'existing-transaction');
  database.exec('PRAGMA foreign_keys=ON');
  requireThat(database.prepare('PRAGMA foreign_keys').get().foreign_keys === 1, 'foreign-keys-required');
  database.exec(mode);
  try { const result = action(); database.exec('COMMIT'); return result; }
  catch (error) { if (database.isTransaction) database.exec('ROLLBACK'); throw error; }
}
function summary(status, operationId, changes) {
  const counts = {};
  for (const change of changes) counts[change.table] = (counts[change.table] ?? 0) + 1;
  return { status, operationId, counts };
}
function createJournal(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS ${JOURNAL} (
    operation_id TEXT PRIMARY KEY, plan_json TEXT NOT NULL CHECK(json_valid(plan_json)),
    plan_hash TEXT NOT NULL, before_digest TEXT NOT NULL, after_digest TEXT NOT NULL,
    applied_at TEXT NOT NULL, rolled_back_at TEXT,
    status TEXT NOT NULL CHECK(status IN ('applied','rolled-back'))
  );
  CREATE TRIGGER IF NOT EXISTS source_correction_runs_immutable BEFORE UPDATE OF operation_id,plan_json,plan_hash,before_digest,after_digest,applied_at ON ${JOURNAL}
  BEGIN SELECT RAISE(ABORT, 'immutable-correction-journal'); END;
  CREATE TRIGGER IF NOT EXISTS source_correction_runs_no_delete BEFORE DELETE ON ${JOURNAL}
  BEGIN SELECT RAISE(ABORT, 'immutable-correction-journal'); END;`);
}
function insertRow(database, table, snapshot, schema) {
  const names = schema.map(column => column.name);
  database.prepare(`INSERT INTO ${quote(table)} (${names.map(quote).join(',')}) VALUES (${names.map(() => '?').join(',')})`).run(...names.map(name => snapshot[name]));
}
function updateRow(database, table, id, snapshot, names) {
  if (!names.length) return;
  const result = database.prepare(`UPDATE ${quote(table)} SET ${names.map(name => `${quote(name)}=?`).join(',')} WHERE id=?`).run(...names.map(name => snapshot[name]), id);
  requireThat(result.changes === 1, 'row-conflict');
}
/** Apply a bounded, evidenced CAS plan atomically, keeping the original IDs and economics. */
export function applySourceCorrection(database, plan) {
  return guarded(() => transaction(database, 'BEGIN IMMEDIATE', () => {
    const { schemas, planJson, planHash, prior } = inspect(database, plan);
    if (prior) return summary('already-applied', plan.id, plan.changes);
    createJournal(database);
    const rank = { instruments: 0, import_batches: 1, executions: 2 };
    for (const change of [...plan.changes].sort((a, b) => rank[a.table] - rank[b.table])) {
      if (change.before === null) insertRow(database, change.table, change.after, schemas[change.table]);
      else updateRow(database, change.table, change.id, change.after, [...EDITABLE[change.table]].filter(name => !same(change.before[name], change.after[name])));
    }
    assertRows(database, plan.changes, 'after');
    const afterDigest = digest(database);
    database.prepare(`INSERT INTO ${JOURNAL}(operation_id,plan_json,plan_hash,before_digest,after_digest,applied_at,status) VALUES(?,?,?,?,?,?,?)`)
      .run(plan.id, planJson, planHash, plan.baselineDigest, afterDigest, new Date().toISOString(), 'applied');
    return summary('applied', plan.id, plan.changes);
  }));
}
// Check before any restore/delete: SQLite SET NULL/CASCADE can mutate tables outside
// the source digest, including human reviews. Only planned source references that
// rollback itself removes may remain. Composite references fail closed.
function assertNoUnplannedDeleteReferences(database, changes) {
  const deletions = changes.filter(change => change.before === null);
  if (!deletions.length) return;
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  for (const { name: childTable } of tables) {
    const groups = new Map();
    for (const fk of database.prepare(`PRAGMA foreign_key_list(${quote(childTable)})`).all()) {
      if (!groups.has(fk.id)) groups.set(fk.id, []);
      groups.get(fk.id).push(fk);
    }
    for (const group of groups.values()) {
      const targets = deletions.filter(change => change.table.toLowerCase() === group[0].table.toLowerCase());
      if (!targets.length) continue;
      requireThat(group.length === 1, 'unsupported-composite-delete-reference');
      const fk = group[0]; const targetTable = targets[0].table;
      const targetSchema = columns(database, targetTable);
      const primary = targetSchema.filter(column => column.pk > 0);
      requireThat(fk.to || primary.length === 1, 'unsupported-composite-delete-reference');
      const targetColumn = fk.to || primary[0].name;
      const childColumn = database.prepare(`PRAGMA table_info(${quote(childTable)})`).all()
        .find(column => column.name.toLowerCase() === fk.from.toLowerCase())?.name;
      requireThat(!!childColumn, 'unsupported-delete-reference');
      for (const target of targets) {
        // Parent column on the left preserves the FK's affinity/collation semantics.
        const dependents = database.prepare(`SELECT child.* FROM ${quote(childTable)} AS child JOIN ${quote(targetTable)} AS parent ON parent.${quote(targetColumn)}=child.${quote(childColumn)} WHERE parent.id=?`).all(target.id);
        for (const dependent of dependents) {
          const planned = changes.find(change => change.table.toLowerCase() === childTable.toLowerCase() && change.id === dependent.id);
          requireThat(!!planned, 'unplanned-delete-reference');
          if (planned.before === null) continue;
          const retained = database.prepare(`SELECT 1 FROM ${quote(targetTable)} WHERE id=? AND ${quote(targetColumn)}=?`).get(target.id, planned.before[childColumn]);
          requireThat(!retained, 'unplanned-delete-reference');
        }
      }
    }
  }
}
/** Restore journaled snapshots only while the entire source still matches that operation. */
export function rollbackSourceCorrection(database, operationId) {
  return guarded(() => transaction(database, 'BEGIN IMMEDIATE', () => {
    requireThat(nonempty(operationId));
    const prior = journalEntry(database, operationId);
    requireThat(!!prior, 'unknown-operation');
    requireThat(hash(prior.plan_json) === prior.plan_hash, 'journal-corrupt');
    const plan = JSON.parse(prior.plan_json);
    validate(database, plan);
    requireThat(plan.id === operationId && plan.baselineDigest === prior.before_digest, 'journal-corrupt');
    if (prior.status === 'rolled-back') return summary('already-rolled-back', operationId, plan.changes);
    requireThat(prior.status === 'applied' && digest(database) === prior.after_digest, 'source-conflict');
    assertRows(database, plan.changes, 'after');
    assertNoUnplannedDeleteReferences(database, plan.changes);
    // Restore/remove executions before catalog deletion, so FK enforcement stays active.
    const rank = { executions: 0, import_batches: 1, instruments: 2 };
    for (const change of [...plan.changes].sort((a, b) => rank[a.table] - rank[b.table])) {
      if (change.before === null) database.prepare(`DELETE FROM ${quote(change.table)} WHERE id=?`).run(change.id);
      else updateRow(database, change.table, change.id, change.before, [...EDITABLE[change.table]].filter(name => !same(change.before[name], change.after[name])));
    }
    assertRows(database, plan.changes, 'before');
    requireThat(digest(database) === prior.before_digest, 'rollback-digest-mismatch');
    database.prepare(`UPDATE ${JOURNAL} SET status='rolled-back',rolled_back_at=? WHERE operation_id=?`).run(new Date().toISOString(), operationId);
    return summary('rolled-back', operationId, plan.changes);
  }));
}

function parseArgs(args) {
  const values = {}; const flags = new Set(['--check', '--apply']);
  const options = new Set(['--db', '--plan', '--backup', '--rollback']);
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    requireThat(!(name in values), 'invalid-arguments');
    if (flags.has(name)) values[name] = true;
    else {
      requireThat(options.has(name) && index + 1 < args.length && !args[index + 1].startsWith('--'), 'invalid-arguments');
      values[name] = args[++index];
    }
  }
  requireThat(nonempty(values['--db']) && isAbsolute(values['--db']), 'absolute-db-required');
  requireThat([values['--check'], values['--apply'], values['--rollback']].filter(Boolean).length === 1, 'one-action-required');
  if (values['--rollback']) requireThat(!values['--plan'] && !values['--check'] && !values['--apply'], 'invalid-arguments');
  else requireThat(nonempty(values['--plan']) && isAbsolute(values['--plan']), 'absolute-plan-required');
  if (values['--check']) requireThat(!values['--backup'], 'invalid-arguments');
  else requireThat(nonempty(values['--backup']) && isAbsolute(values['--backup']), 'absolute-backup-required');
  return values;
}
async function privateBackup(database, dbPath, backupPath) {
  const parent = realpathSync(dirname(backupPath));
  const parentStat = statSync(parent);
  requireThat(parentStat.isDirectory() && (parentStat.mode & 0o077) === 0, 'private-backup-directory-required');
  requireThat(parentStat.uid === process.getuid(), 'private-backup-directory-required');
  requireThat(resolve(parent, backupPath.slice(dirname(backupPath).length + 1)) !== realpathSync(dbPath), 'invalid-backup-path');
  // Exclusive reservation prevents overwrites and symlink traversal at the target.
  const descriptor = openSync(backupPath, 'wx', 0o600); closeSync(descriptor);
  await backup(database, backupPath);
  chmodSync(backupPath, 0o600);
}
async function main() {
  let database;
  try {
    const args = parseArgs(process.argv.slice(2));
    const dbPath = args['--db'];
    requireThat(statSync(dbPath).isFile(), 'existing-db-required');
    database = new DatabaseSync(dbPath, { readOnly: !!args['--check'] });
    let result;
    if (args['--check']) {
      const plan = JSON.parse(readFileSync(args['--plan'], 'utf8'));
      result = transaction(database, 'BEGIN', () => {
        const { prior } = inspect(database, plan);
        return summary(prior ? 'already-applied' : 'checked', plan.id, plan.changes);
      });
    } else {
      const plan = args['--apply'] ? JSON.parse(readFileSync(args['--plan'], 'utf8')) : null;
      // Check structure before allocating the backup; the locked CAS still runs at apply.
      if (plan) validate(database, plan);
      await privateBackup(database, dbPath, args['--backup']);
      result = plan ? applySourceCorrection(database, plan) : rollbackSourceCorrection(database, args['--rollback']);
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: 'error', code: error instanceof CorrectionError ? error.message : 'source-correction-failed' })}\n`);
    process.exitCode = 1;
  } finally { if (database?.isOpen) database.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
