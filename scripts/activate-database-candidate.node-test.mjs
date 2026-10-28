import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { backup, DatabaseSync } from "node:sqlite";
import { existsSync, linkSync, mkdtempSync, readFileSync, rmSync, symlinkSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeSqlite, UnsupportedSqliteSchemaError } from "../db/sqlite-initialization.ts";
import { SQLITE_MIGRATIONS } from "../db/sqlite-schema.ts";
import { assertBookVersion, readBookVersion } from "../app/lib/storage/trade-book-version.ts";
import { activateDatabaseCandidate } from "./activate-database-candidate.mjs";

async function fixture(t, { legacy = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "tradereview-candidate-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "source.sqlite"), candidate = join(root, "candidate.sqlite");
  const db = new DatabaseSync(source);
  if (legacy) {
    db.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT,checksum TEXT,applied_at TEXT DEFAULT current_timestamp)");
    for (const migration of SQLITE_MIGRATIONS.filter((m) => m.version <= 14)) {
      db.exec(migration.sql); db.prepare("INSERT INTO schema_migrations(version,name,checksum) VALUES(?,?,?)").run(migration.version,migration.name,migration.checksum);
    }
  } else initializeSqlite(db);
  db.exec("CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES('preserved');");
  await backup(db, candidate); db.close();
  return { root, source, candidate };
}

function version(path) { const db = new DatabaseSync(path, { readOnly: true }); try { return readBookVersion(db); } finally { db.close(); } }

test("offline clone invalidates the old plan token, preserves its source, and ordinary restart stays stable", async (t) => {
  const f = await fixture(t); const before = version(f.source), bytes = readFileSync(f.source);
  const result = activateDatabaseCandidate(f.candidate, f.source);
  assert.deepEqual(result.before, before); assert.equal(result.after.databaseId, before.databaseId);
  assert.notEqual(result.after.epoch, before.epoch); assert.equal(result.after.sequence, 0);
  const db = new DatabaseSync(f.candidate); assert.throws(() => assertBookVersion(db, before), { code: "BOOK_VERSION_CHANGED" });
  initializeSqlite(db); assert.deepEqual(readBookVersion(db), result.after); db.close();
  assert.deepEqual(version(f.candidate), result.after); assert.deepEqual(readFileSync(f.source), bytes);
});

test("a genuine migration-14 backup upgrades through the one initializer before rotation", async (t) => {
  const f = await fixture(t, { legacy: true }); const bytes = readFileSync(f.source);
  const result = activateDatabaseCandidate(f.candidate, f.source);
  assert.notEqual(result.before.epoch, result.after.epoch);
  const db = new DatabaseSync(f.candidate); assert.equal(db.prepare("SELECT max(version) AS version FROM schema_migrations").get().version, SQLITE_MIGRATIONS.at(-1).version);
  assert.equal(db.prepare("SELECT value FROM sentinel").get().value, "preserved"); db.close();
  assert.deepEqual(readFileSync(f.source), bytes);
});

test("future schemas are rejected without modifying either file", async (t) => {
  const f = await fixture(t); const db = new DatabaseSync(f.candidate);
  db.prepare("INSERT INTO schema_migrations(version,name,checksum) VALUES(9999,'future','future')").run(); db.close();
  const sourceBytes = readFileSync(f.source), bytes = readFileSync(f.candidate);
  assert.throws(() => activateDatabaseCandidate(f.candidate,f.source), UnsupportedSqliteSchemaError);
  assert.deepEqual(readFileSync(f.candidate), bytes); assert.deepEqual(readFileSync(f.source), sourceBytes);
});

test("missing state, corrupt state, and migration checksum mismatch cannot become activatable", async (t) => {
  for (const sql of ["DELETE FROM trade_book_state", "PRAGMA ignore_check_constraints=ON; UPDATE trade_book_state SET sequence=-1", "UPDATE schema_migrations SET checksum='wrong' WHERE version=14"]) {
    const f = await fixture(t); const db = new DatabaseSync(f.candidate); db.exec(sql); db.close();
    const before = readFileSync(f.source);
    assert.throws(() => activateDatabaseCandidate(f.candidate, f.source), sql.includes("sequence=-1") ? /quick_check failed/ : /version state|checksum/);
    assert.deepEqual(readFileSync(f.source), before);
  }
});

test("an actual epoch update error rolls back the maintenance transaction", async (t) => {
  const f = await fixture(t); const db = new DatabaseSync(f.candidate);
  db.exec("CREATE TRIGGER reject_epoch BEFORE UPDATE OF epoch ON trade_book_state BEGIN SELECT RAISE(ABORT,'synthetic rotation failure'); END"); db.close();
  const before = version(f.candidate), sourceBytes = readFileSync(f.source);
  assert.throws(() => activateDatabaseCandidate(f.candidate, f.source), /synthetic rotation failure/);
  assert.deepEqual(version(f.candidate), before); assert.deepEqual(readFileSync(f.source), sourceBytes);
});

test("candidate/source alias, hard links, symlinks, and absent candidates fail before writes", async (t) => {
  const f = await fixture(t); const bytes = readFileSync(f.source);
  assert.throws(() => activateDatabaseCandidate(f.source,f.source), /alias/);
  assert.throws(() => activateDatabaseCandidate("relative.sqlite", f.source), /absolute/);
  assert.throws(() => activateDatabaseCandidate(join(f.root,"absent.sqlite"), f.source), /ENOENT/);
  assert.equal(existsSync(join(f.root,"absent.sqlite")), false);
  const link = join(f.root, "link.sqlite"); symlinkSync(f.source, link);
  assert.throws(() => activateDatabaseCandidate(link,f.source), /symlink/); rmSync(link);
  linkSync(f.candidate,link); assert.throws(() => activateDatabaseCandidate(link,f.source), /hard links/); rmSync(link);
  assert.deepEqual(readFileSync(f.source), bytes);
});

test("a held candidate is rejected", async (t) => {
  const f = await fixture(t);
  const held = spawn(process.execPath,["--input-type=module","-e","import{openSync}from'node:fs';openSync(process.argv[1],'r');console.log('ready');setInterval(()=>{},1000)",f.candidate], { stdio: ["ignore","pipe","pipe"] });
  t.after(() => held.kill("SIGTERM")); await new Promise((resolveReady) => held.stdout.once("data",resolveReady));
  assert.throws(() => activateDatabaseCandidate(f.candidate,f.source), /still in use/); held.kill("SIGTERM");
});

test("the CLI rejects missing arguments and does not consult an external database environment", async (t) => {
  const f = await fixture(t), bytes = readFileSync(f.source);
  const bad = spawnSync(process.execPath,["scripts/activate-database-candidate.mjs"], { encoding: "utf8", env: { ...process.env,TRADEREVIEW_DB_PATH:f.source } });
  assert.equal(bad.status,1); assert.match(bad.stderr,/usage/); assert.deepEqual(readFileSync(f.source),bytes);
  const result = spawnSync(process.execPath,["scripts/activate-database-candidate.mjs","--candidate",f.candidate,"--source",f.source], { encoding:"utf8", env: { ...process.env,TRADEREVIEW_DB_PATH:f.source } });
  assert.equal(result.status,0,result.stderr); assert.notEqual(JSON.parse(result.stdout).after.epoch,version(f.source).epoch);
  assert.deepEqual(readFileSync(f.source),bytes);
});


test("a failed consumer checker blocks activation and leaves the source intact", async (t) => {
  for (const checker of ["exit 2", "echo incomplete-consumer-check >&2; exit 0"]) {
    const f = await fixture(t); const bytes = readFileSync(f.source); const bin = join(f.root,"bin"); mkdirSync(bin);
    writeFileSync(join(bin,"lsof"),`#!/bin/sh\n${checker}\n`); chmodSync(join(bin,"lsof"),0o755);
    const result = spawnSync(process.execPath,["scripts/activate-database-candidate.mjs","--candidate",f.candidate,"--source",f.source], { encoding:"utf8", env: { ...process.env,PATH:bin } });
    assert.equal(result.status,1); assert.match(result.stderr,/cannot verify candidate consumers/);
    assert.deepEqual(readFileSync(f.source),bytes);
  }
});

test("a runtime mismatch fails before either database is opened for mutation", async (t) => {
  const f = await fixture(t); const sourceBytes = readFileSync(f.source), bytes = readFileSync(f.candidate);
  const program = "Object.defineProperty(process.versions,'node',{value:'22.0.0'});const {activateDatabaseCandidate}=await import('./scripts/activate-database-candidate.mjs');activateDatabaseCandidate(process.argv[1],process.argv[2]);";
  const result = spawnSync(process.execPath,["--input-type=module","-e",program,f.candidate,f.source], { encoding:"utf8" });
  assert.notEqual(result.status,0); assert.match(result.stderr,/Node.js 26.0.0 is required/);
  assert.deepEqual(readFileSync(f.source),sourceBytes); assert.deepEqual(readFileSync(f.candidate),bytes);
});
