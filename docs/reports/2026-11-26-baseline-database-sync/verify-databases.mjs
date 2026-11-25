// Read-only logical comparison. Run with the project's pinned native Node.
// Usage: ./scripts/native-node.sh docs/reports/2026-11-26-baseline-database-sync/verify-databases.mjs source=/absolute/source.sqlite target=/absolute/target.sqlite
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const hash = text => createHash('sha256').update(text).digest('hex');
const quote = name => `"${name.replaceAll('"', '""')}"`;
const encode = value => value === null ? ['null']
  : typeof value === 'bigint' ? ['integer', value.toString()]
  : value instanceof Uint8Array ? ['blob', Buffer.from(value).toString('base64')]
  : [typeof value, value];

function manifest(path) {
  assert(isAbsolute(path) && statSync(path).isFile(), 'Existing absolute database path required');
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    assert.equal(db.prepare('SELECT sqlite_version() version').get().version, '3.53.0');
    db.exec('BEGIN');
    const integrity = db.prepare('PRAGMA integrity_check').all();
    assert.deepEqual(integrity.map(row => Object.values(row)[0]), ['ok']);
    const foreignKeyErrors = db.prepare('PRAGMA foreign_key_check').all();
    assert.equal(foreignKeyErrors.length, 0, 'Foreign key violations');
    const schema = db.prepare('SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name').all();
    const tables = [];
    for (const { name } of schema.filter(row => row.type === 'table')) {
      const statement = db.prepare(`SELECT * FROM ${quote(name)}`);
      statement.setReadBigInts(true);
      const rows = [];
      for (const row of statement.iterate()) {
        rows.push(hash(JSON.stringify(Object.entries(row).map(([column, value]) => [column, encode(value)]))));
      }
      // A multiset digest preserves duplicate rows while ignoring physical row order.
      rows.sort();
      tables.push({ name, rows: rows.length, sha256: hash(rows.join('\n')) });
    }
    tables.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    const state = {
      applicationId: db.prepare('PRAGMA application_id').get().application_id,
      userVersion: db.prepare('PRAGMA user_version').get().user_version,
      encoding: db.prepare('PRAGMA encoding').get().encoding,
      schemaSha256: hash(JSON.stringify(schema)),
      tables,
    };
    db.exec('ROLLBACK');
    return {
      integrity: 'ok', foreignKeyViolations: 0,
      tableCount: tables.length, rowCount: tables.reduce((sum, table) => sum + table.rows, 0),
      logicalSha256: hash(JSON.stringify(state)), ...state,
    };
  } finally { db.close(); }
}

const entries = process.argv.slice(2).map(argument => {
  const separator = argument.indexOf('=');
  assert(separator > 0, 'Use role=/absolute/database.sqlite');
  const role = argument.slice(0, separator);
  assert(/^[a-z][a-z0-9-]*$/.test(role), 'Role must be a simple label');
  return [role, manifest(argument.slice(separator + 1))];
});
assert(entries.length >= 1 && new Set(entries.map(([role]) => role)).size === entries.length);
const databases = Object.fromEntries(entries);
const identical = entries.every(([, value]) => value.logicalSha256 === entries[0][1].logicalSha256);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), identical, databases }, null, 2));
// One database produces a manifest; two or more also act as an equality gate.
if (!identical) process.exitCode = 2;
