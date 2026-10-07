import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync, linkSync, rmSync, existsSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dirname } from "node:path";
import { acquireDebugLock, assertDebugPreflight, prepareDebugDatabase, resolveDebugPaths, startDebugServer } from "./debug-local.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tradereview-debug-"));
  const source = join(root, "source.sqlite");
  mkdirSync(join(root, "conf"), { recursive: true });
  writeFileSync(join(root, "conf", "runtime.json"), JSON.stringify({ databasePath: source, port: 3022, hostname: "127.0.0.1" }));
  const db = new DatabaseSync(source);
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES ('wal-value');");
  db.close();
  return { root, source, paths: resolveDebugPaths({ root }) };
}

test("copies committed WAL content and isolates writes", async (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const lock = await prepareDebugDatabase(f.paths);
  const copy = new DatabaseSync(f.paths.target);
  assert.deepEqual(copy.prepare("SELECT value FROM sample").all().map((r) => r.value), ["wal-value"]);
  copy.exec("INSERT INTO sample VALUES ('debug-only')"); copy.close();
  const source = new DatabaseSync(f.source, { readOnly: true });
  assert.deepEqual(source.prepare("SELECT value FROM sample").all().map((r) => r.value), ["wal-value"]); source.close();
  lock.release();
});

test("backs up a live uncheckpointed WAL and removes stale destination sidecars", async (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const live = new DatabaseSync(f.source);
  live.exec("PRAGMA journal_mode=WAL; INSERT INTO sample VALUES ('live-wal');");
  mkdirSync(join(f.root, ".data"), { recursive: true });
  writeFileSync(f.paths.target, "old");
  writeFileSync(`${f.paths.target}-wal`, "stale-wal");
  writeFileSync(`${f.paths.target}-shm`, "stale-shm");
  const lock = await prepareDebugDatabase(f.paths, { isOpen: () => false, isPortOccupied: () => false });
  assert.equal(existsSync(`${f.paths.target}-wal`), false);
  assert.equal(existsSync(`${f.paths.target}-shm`), false);
  const copy = new DatabaseSync(f.paths.target, { readOnly: true });
  assert.deepEqual(copy.prepare("SELECT value FROM sample ORDER BY rowid").all().map((r) => r.value), ["wal-value", "live-wal"]);
  copy.close(); live.close(); lock.release();
});

test("failed backup keeps the previous copy and never publishes a temporary file", async (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  mkdirSync(join(f.root, ".data"), { recursive: true });
  writeFileSync(f.paths.target, "old-copy");
  await assert.rejects(() => prepareDebugDatabase(f.paths, { backup: async () => { throw new Error("backup failed"); } }), /backup failed/);
  assert.equal(readFileSync(f.paths.target, "utf8"), "old-copy");
  assert.equal(existsSync(f.paths.target + ".debug.lock"), false);
});

test("occupied port is rejected before copying", async (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  await assert.rejects(() => prepareDebugDatabase(f.paths, { isPortOccupied: () => true }), /occupied/);
  assert.equal(existsSync(f.paths.target), false);
});

test("rejects same path, symlink, hard link, open target, and concurrent lock", async (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const same = { ...f.paths, target: f.source }; assert.throws(() => assertDebugPreflight(same), /alias/);
  mkdirSync(join(f.root, ".data"), { recursive: true });
  symlinkSync(f.source, f.paths.target); assert.throws(() => assertDebugPreflight(f.paths), /alias|symlink/); rmSync(f.paths.target);
  linkSync(f.source, f.paths.target); assert.throws(() => assertDebugPreflight(f.paths), /alias|hard-linked/); rmSync(f.paths.target);
  const unrelated = join(f.root, "unrelated.sqlite"); writeFileSync(unrelated, "target"); linkSync(unrelated, f.paths.target);
  assert.throws(() => assertDebugPreflight(f.paths), /hard-linked/); rmSync(f.paths.target); rmSync(unrelated);
  assert.throws(() => assertDebugPreflight(f.paths, { isOpen: () => true }), /open/);
  const held = acquireDebugLock(f.paths.lockPath);
  assert.throws(() => acquireDebugLock(f.paths.lockPath), /another debug launcher/); held.release();
});

test("standard launcher rejects redirecting environment and forwards fixed child contract", async (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const calls = [];
  const child = { kill(signal) { calls.push(["kill", signal]); }, once(event, fn) { if (event === "close") this.close = fn; return this; } };
  const result = await startDebugServer({ root: f.root, env: { TRADEREVIEW_DB_PATH: "/tmp/wrong.sqlite" }, assertNativeEnvironment() {}, spawn() { return child; } }).catch((error) => error);
  assert.match(result.message, /TRADEREVIEW_DB_PATH/);
  const started = await startDebugServer({ root: f.root, env: {}, assertNativeEnvironment() {}, spawn(command, args, opts) { calls.push([command, args, opts]); return child; } });
  assert.equal(calls[0][0], process.execPath); assert.deepEqual(calls[0][1].slice(-5), ["--dev", "--hostname", "127.0.0.1", "--port", "3333"]);
  assert.equal(calls[0][2].env.PATH.startsWith(`${dirname(process.execPath)}:${join(f.root, "node_modules", ".bin")}:`), true);
  child.close?.(0, null); started.lock.release();
});

test("native mismatch is rejected before config/database filesystem access", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "tradereview-debug-mismatch-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  await assert.rejects(() => startDebugServer({ root, assertNativeEnvironment() { throw new Error("runtime mismatch"); }, env: {} }), /runtime mismatch/);
  assert.equal(existsSync(join(root, "conf")), false);
  assert.equal(existsSync(join(root, ".data")), false);
});

test("corrupt/failed quick check and synchronous spawn failure preserve copy and release lock", async (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  mkdirSync(join(f.root, ".data"), { recursive: true });
  writeFileSync(f.paths.target, "previous");
  await assert.rejects(() => prepareDebugDatabase(f.paths, { backup: async (_db, target) => writeFileSync(target, "corrupt") }), /file is not a database|not a database/);
  assert.equal(readFileSync(f.paths.target, "utf8"), "previous");
  assert.equal(existsSync(f.paths.lockPath), false);
  const started = await startDebugServer({ root: f.root, env: {}, assertNativeEnvironment() {}, spawn() { throw new Error("spawn failed"); } }).catch((error) => error);
  assert.match(started.message, /spawn failed/);
  assert.equal(existsSync(f.paths.lockPath), false);
});

test("cancellation during an awaited backup releases lock and cannot publish", async (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const controller = new AbortController();
  let releaseBackup;
  const pending = new Promise((resolve) => { releaseBackup = resolve; });
  const operation = prepareDebugDatabase(f.paths, { signal: controller.signal, backup: async () => pending });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort(); releaseBackup();
  await assert.rejects(operation, /cancelled|unable to open database/);
  assert.equal(existsSync(f.paths.lockPath), false);
  assert.equal(existsSync(f.paths.target), false);
});

test("rename failure restores quarantined old sidecars and previous main copy", async (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  mkdirSync(join(f.root, ".data"), { recursive: true });
  writeFileSync(f.paths.target, "previous-main");
  writeFileSync(`${f.paths.target}-wal`, "previous-wal");
  writeFileSync(`${f.paths.target}-shm`, "previous-shm");
  await assert.rejects(() => prepareDebugDatabase(f.paths, {
    isOpen: () => false,
    isPortOccupied: () => false,
    rename(from, to) { if (from.includes(".tmp-")) throw new Error("rename failed"); return renameSync(from, to); },
  }), /rename failed/);
  assert.equal(readFileSync(f.paths.target, "utf8"), "previous-main");
  assert.equal(readFileSync(`${f.paths.target}-wal`, "utf8"), "previous-wal");
  assert.equal(readFileSync(`${f.paths.target}-shm`, "utf8"), "previous-shm");
});

test("post-publication quarantine cleanup failure never restores old sidecars over new main", async (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  mkdirSync(join(f.root, ".data"), { recursive: true });
  writeFileSync(f.paths.target, "previous-main");
  writeFileSync(`${f.paths.target}-wal`, "previous-wal");
  writeFileSync(`${f.paths.target}-shm`, "previous-shm");
  await assert.rejects(() => prepareDebugDatabase(f.paths, {
    isOpen: () => false, isPortOccupied: () => false,
    remove(path, options) { if (path.includes("quarantine-")) throw new Error("cleanup failed"); return rmSync(path, options); },
  }), /cleanup failed/);
  const refreshed = new DatabaseSync(f.paths.target, { readOnly: true });
  assert.deepEqual(refreshed.prepare("SELECT value FROM sample").all().map((r) => r.value), ["wal-value"]);
  refreshed.close();
});
