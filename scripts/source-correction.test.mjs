import { afterEach, expect, test } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync, chmodSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sourceDigest, applySourceCorrection, rollbackSourceCorrection } from './source-correction.mjs';

const cleanups = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'source-correction-'));
  chmodSync(dir, 0o700);
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'isolated.sqlite');
  let db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE instruments(id TEXT PRIMARY KEY, symbol TEXT NOT NULL, metadata_json TEXT CHECK(metadata_json IS NULL OR json_valid(metadata_json)));
    CREATE TABLE import_batches(id TEXT PRIMARY KEY, record_count INTEGER NOT NULL CHECK(record_count>=0), evidence_json TEXT, reconciliation_json TEXT);
    CREATE TABLE executions(id TEXT PRIMARY KEY, import_batch_id TEXT REFERENCES import_batches(id), instrument_id TEXT NOT NULL REFERENCES instruments(id), account TEXT, quantity TEXT NOT NULL, price TEXT NOT NULL, evidence_json TEXT, updated_at TEXT);
    CREATE TABLE reviews(id TEXT PRIMARY KEY, body TEXT);
    INSERT INTO instruments VALUES('i1','OLD',NULL);
    INSERT INTO import_batches VALUES('b1',2,NULL,NULL);
    INSERT INTO executions VALUES('e1','b1','i1','old-account','2','10',NULL,'old'),('e2','b1','i1','old-account','3','20',NULL,'old');
    INSERT INTO reviews VALUES('review','human review');`);
  cleanups.push(() => { if (db.isOpen) db.close(); });
  const row = (table, id) => ({ ...db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id) });
  const e1 = row('executions', 'e1'); const e2 = row('executions', 'e2'); const batch = row('import_batches', 'b1');
  const plan = {
    id: 'test-operation', reason: 'verified original source', baselineDigest: sourceDigest(db),
    evidence: [{ sha256: 'a'.repeat(64), page: 1, description: 'synthetic source' }],
    changes: [
      { table: 'executions', id: 'e1', before: e1, after: { ...e1, account: 'correct-account', evidence_json: '{}', updated_at: 'new' } },
      { table: 'import_batches', id: 'b1', before: batch, after: { ...batch, record_count: 3, evidence_json: '{}', reconciliation_json: '{}' } },
      { table: 'executions', id: 'e2', before: e2, after: { ...e2, instrument_id: 'i2' } },
      { table: 'executions', id: 'e3', before: null, after: { ...e1, id: 'e3', instrument_id: 'i2', account: 'new-account' } },
      { table: 'instruments', id: 'i2', before: null, after: { id: 'i2', symbol: 'NEW', metadata_json: '{}' } },
    ],
  };
  return { dir, path, get db() { return db; }, row, plan, reopen() { db.close(); db = new DatabaseSync(path); db.exec('PRAGMA foreign_keys=ON'); } };
}
const copy = value => structuredClone(value);
function cli(f, ...args) {
  return spawnSync(process.execPath, [resolve('scripts/source-correction.mjs'), '--db', f.path, ...args], { encoding: 'utf8' });
}
function journalExists(db) { return !!db.prepare("SELECT 1 FROM sqlite_master WHERE name='source_correction_runs'").get(); }

test('persists correction and new batch with child execution across reopen, then rolls back exactly once', () => {
  const f = fixture(); const before = sourceDigest(f.db);
  // Deliberately list the child before its catalog and batch: execution order must honor FKs.
  f.plan.changes.unshift({ table: 'executions', id: 'e4', before: null, after: { ...f.plan.changes[3].after, id: 'e4', import_batch_id: 'b2' } });
  f.plan.changes.push({ table: 'import_batches', id: 'b2', before: null, after: { id: 'b2', record_count: 1, evidence_json: '{"scope":"new-security"}', reconciliation_json: '{}' } });
  expect(applySourceCorrection(f.db, f.plan).status).toBe('applied');
  f.reopen();
  expect(f.row('executions', 'e1')).toMatchObject({ account: 'correct-account', quantity: '2', price: '10' });
  expect(f.row('executions', 'e2').instrument_id).toBe('i2');
  expect(f.row('executions', 'e3').id).toBe('e3');
  expect(f.row('executions', 'e4')).toMatchObject({ import_batch_id: 'b2', instrument_id: 'i2', quantity: '2', price: '10' });
  expect(f.row('import_batches', 'b2')).toMatchObject({ record_count: 1, evidence_json: '{"scope":"new-security"}' });
  expect(f.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  expect(f.row('import_batches', 'b1').record_count).toBe(3);
  expect(f.row('reviews', 'review').body).toBe('human review');
  const journal = f.db.prepare('SELECT * FROM source_correction_runs').get();
  expect(JSON.parse(journal.plan_json)).toEqual(f.plan);
  const reordered = Object.fromEntries(Object.entries(f.plan).reverse());
  expect(applySourceCorrection(f.db, reordered).status).toBe('already-applied');
  expect(() => f.db.exec("UPDATE source_correction_runs SET plan_json='{}'")).toThrow();
  expect(() => f.db.exec('DELETE FROM source_correction_runs')).toThrow();
  expect(rollbackSourceCorrection(f.db, f.plan.id).status).toBe('rolled-back');
  expect(sourceDigest(f.db)).toBe(before);
  expect(f.db.prepare('SELECT count(*) AS n FROM executions').get().n).toBe(2);
  expect(f.db.prepare("SELECT * FROM import_batches WHERE id='b2'").get()).toBeUndefined();
  expect(f.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  expect(rollbackSourceCorrection(f.db, f.plan.id).status).toBe('already-rolled-back');
  expect(() => applySourceCorrection(f.db, f.plan)).toThrow();
});

test('whole-source CAS rejects unrelated imports and edits with no journal or partial writes', () => {
  for (const mutation of ["INSERT INTO instruments VALUES('external','EXTERNAL',NULL)", "UPDATE executions SET account='external' WHERE id='e2'"]) {
    const f = fixture(); f.db.exec(mutation); const digest = sourceDigest(f.db);
    expect(() => applySourceCorrection(f.db, f.plan)).toThrow();
    expect(sourceDigest(f.db)).toBe(digest); expect(journalExists(f.db)).toBe(false);
  }
});

test('rejects reused IDs with different plans and refuses rollback/repeat after later source writes', () => {
  const f = fixture(); applySourceCorrection(f.db, f.plan);
  const different = copy(f.plan); different.reason = 'different';
  expect(() => applySourceCorrection(f.db, different)).toThrow();
  f.db.exec("UPDATE executions SET account='later' WHERE id='e1'");
  const digest = sourceDigest(f.db);
  expect(() => rollbackSourceCorrection(f.db, f.plan.id)).toThrow();
  expect(() => applySourceCorrection(f.db, f.plan)).toThrow();
  expect(sourceDigest(f.db)).toBe(digest);
});

test('rejects economic edits, incomplete/unknown row keys, invalid evidence/JSON/integer, delete/catalog updates', () => {
  const mutations = [
    p => { p.changes[0].after.price = '99'; },
    p => { delete p.changes[0].after.price; },
    p => { p.changes[0].after.extra = 'injection'; },
    p => { p.evidence[0].sha256 = 'bad'; },
    p => { p.evidence[0].page = 0; },
    p => { p.changes[0].after.evidence_json = '{'; },
    p => { p.changes[1].after.record_count = 2.5; },
    p => { p.changes[0].after = null; },
    p => { p.changes[4].before = { ...p.changes[4].after, symbol: 'OLD' }; },
    p => { p.changes.push(copy(p.changes[0])); },
    p => { p.changes[0].table = 'reviews'; },
    p => { p.changes[0].after.id = 'wrong'; },
  ];
  for (const mutate of mutations) {
    const f = fixture(); const p = copy(f.plan); mutate(p);
    expect(() => applySourceCorrection(f.db, p)).toThrow();
    expect(sourceDigest(f.db)).toBe(f.plan.baselineDigest);
    expect(journalExists(f.db)).toBe(false);
  }
});

test('validates each before snapshot and rolls back journal creation on real FK failure', () => {
  for (const mode of ['before', 'fk']) {
    const f = fixture(); const p = copy(f.plan);
    if (mode === 'before') p.changes[0].before.account = 'wrong';
    else { p.changes[2].after.instrument_id = 'missing'; f.db.exec('PRAGMA foreign_keys=OFF'); }
    expect(() => applySourceCorrection(f.db, p)).toThrow();
    expect(sourceDigest(f.db)).toBe(f.plan.baselineDigest);
    expect(journalExists(f.db)).toBe(false);
  }
});

test('CLI checks read-only, takes WAL-aware private backups, applies and rolls back without leaking row details', () => {
  const f = fixture(); const planPath = join(f.dir, 'plan.json');
  writeFileSync(planPath, JSON.stringify(f.plan));
  const initial = readFileSync(f.path);
  const check = cli(f, '--plan', planPath, '--check');
  expect(check.status, check.stderr).toBe(0); expect(JSON.parse(check.stdout).status).toBe('checked');
  expect(readFileSync(f.path)).toEqual(initial); expect(journalExists(f.db)).toBe(false);
  const backupPath = join(f.dir, 'before.sqlite');
  const result = cli(f, '--plan', planPath, '--apply', '--backup', backupPath);
  expect(result.status, result.stderr).toBe(0); expect(result.stdout).not.toContain('correct-account');
  expect(statSync(backupPath).mode & 0o777).toBe(0o600);
  const backup = new DatabaseSync(backupPath, { readOnly: true });
  expect(sourceDigest(backup)).toBe(f.plan.baselineDigest); backup.close();
  const rollback = cli(f, '--rollback', f.plan.id, '--backup', join(f.dir, 'applied.sqlite'));
  expect(rollback.status, rollback.stderr).toBe(0); expect(sourceDigest(f.db)).toBe(f.plan.baselineDigest);
});

test('CLI rejects missing/existing/unsafe backups, implicit creation and sensitive errors', () => {
  const f = fixture(); const planPath = join(f.dir, 'plan.json'); writeFileSync(planPath, JSON.stringify(f.plan));
  const existing = join(f.dir, 'existing.sqlite'); writeFileSync(existing, 'keep');
  const attempts = [[], ['--backup', existing], ['--backup', f.path]];
  for (const args of attempts) expect(cli(f, '--plan', planPath, '--apply', ...args).status).not.toBe(0);
  expect(readFileSync(existing, 'utf8')).toBe('keep');
  chmodSync(f.dir, 0o755);
  expect(cli(f, '--plan', planPath, '--apply', '--backup', join(f.dir, 'unsafe.sqlite')).status).not.toBe(0);
  chmodSync(f.dir, 0o700);
  const missing = join(f.dir, 'missing.sqlite');
  const result = spawnSync(process.execPath, [resolve('scripts/source-correction.mjs'), '--db', missing, '--plan', planPath, '--check'], { encoding: 'utf8' });
  expect(result.status).not.toBe(0); expect(result.stderr).not.toContain(f.dir);
  expect(journalExists(f.db)).toBe(false);
});


test('failed CLI SQL constraints leave source and audit untouched, with redacted errors and an original backup', () => {
  const f = fixture(); const p = copy(f.plan);
  p.changes[2].after.instrument_id = 'private-missing-instrument';
  const planPath = join(f.dir, 'private-plan.json'); writeFileSync(planPath, JSON.stringify(p));
  const backupPath = join(f.dir, 'failed-before.sqlite');
  const result = cli(f, '--plan', planPath, '--apply', '--backup', backupPath);
  expect(result.status).not.toBe(0);
  expect(result.stderr).not.toMatch(/private-missing-instrument|old-account|private-plan/);
  expect(sourceDigest(f.db)).toBe(p.baselineDigest);
  expect(journalExists(f.db)).toBe(false);
  const backup = new DatabaseSync(backupPath, { readOnly: true });
  expect(sourceDigest(backup)).toBe(p.baselineDigest); backup.close();
});

test('rollback rejects later SET NULL or CASCADE references before deleting any source rows', () => {
  for (const [action, reference, referencedValue] of [
    ['SET NULL', 'instruments(id)', 'i2'],
    ['CASCADE', 'instruments', 'i2'], // Implicit parent primary key.
    ['SET NULL', 'instruments(symbol)', 'NEW'], // Match the FK target column, not id.
  ]) {
    const f = fixture(); applySourceCorrection(f.db, f.plan);
    f.db.exec(`CREATE UNIQUE INDEX instruments_symbol_unique ON instruments(symbol);
      CREATE TABLE later_manual(id TEXT PRIMARY KEY, instrument_id TEXT REFERENCES ${reference} ON DELETE ${action}, body TEXT);`);
    f.db.prepare('INSERT INTO later_manual VALUES(?,?,?)').run('later-review', referencedValue, 'later human work');
    const beforeRollback = sourceDigest(f.db);
    expect(() => rollbackSourceCorrection(f.db, f.plan.id)).toThrow();
    expect(sourceDigest(f.db)).toBe(beforeRollback);
    expect(f.row('later_manual', 'later-review')).toEqual({ id: 'later-review', instrument_id: referencedValue, body: 'later human work' });
    expect(f.db.prepare('SELECT status FROM source_correction_runs').get().status).toBe('applied');
    expect(f.row('executions', 'e3').instrument_id).toBe('i2');
  }
});
