import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const [path, output] = process.argv.slice(2);
if (!path || !output) throw new Error('Usage: node db-fingerprint.mjs <database> <output>');
const db = new DatabaseSync(path, { readOnly: true });
db.exec('PRAGMA query_only=ON; BEGIN');
try {
  const schema = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const tables = schema.map(({name, sql}) => {
    const query = db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}"`);
    query.setReadBigInts(true);
    const rowHashes = [];
    for (const row of query.iterate()) {
      const serialized = JSON.stringify(row, (_key, value) => typeof value === 'bigint' ? {integer: String(value)} : value instanceof Uint8Array ? {blob: Buffer.from(value).toString('base64')} : value);
      rowHashes.push(createHash('sha256').update(serialized).digest('hex'));
    }
    rowHashes.sort();
    return {name, rows: rowHashes.length, schemaHash: createHash('sha256').update(sql ?? '').digest('hex'), contentHash: createHash('sha256').update(rowHashes.join('\n')).digest('hex')};
  });
  const result = {path, measuredAt: new Date().toISOString(), node: process.versions.node, sqlite: process.versions.sqlite, quickCheck: db.prepare('PRAGMA quick_check').get(), tables};
  writeFileSync(output, JSON.stringify(result,null,2)+'\n', {mode: 0o600});
  console.log(JSON.stringify({output, tables: tables.length, totalRows: tables.reduce((sum,t)=>sum+t.rows,0), quickCheck: result.quickCheck}));
} finally { db.exec('ROLLBACK'); db.close(); }
