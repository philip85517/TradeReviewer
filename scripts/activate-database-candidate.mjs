import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join, parse, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { initializeSqlite } from "../db/sqlite-initialization.ts";
import { readBookVersion, rotateBookEpoch } from "../app/lib/storage/trade-book-version.ts";

function fail(message) { throw new Error(`Cannot activate database candidate: ${message}`); }

function safeFile(path, label) {
  if (typeof path !== "string" || !isAbsolute(path) || path.includes("\0") || path.split(sep).includes("..") || path.endsWith(sep) || path === parse(path).root) fail(`${label} must be an existing safe absolute file`);
  let current = parse(path).root;
  for (const part of path.slice(current.length).split(sep)) {
    current = join(current, part);
    // The macOS system alias is permitted; descendants are still inspected.
    if (current === "/var") continue;
    if (lstatSync(current).isSymbolicLink()) fail(`${label} has a symlink component: ${current}`);
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.nlink !== 1) fail(`${label} must be a regular file without hard links`);
  return stat;
}

function assertNotOpen(path) {
  if (!existsSync(path)) return;
  const result = spawnSync("lsof", ["-nP", "-t", "--", path], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error || ![0, 1].includes(result.status) || result.stderr?.trim()) {
    const diagnostic = result.error?.message || result.stderr?.trim() || `lsof status ${result.status}`;
    fail(`cannot verify candidate consumers: ${diagnostic}`);
  }
  if (result.stdout.trim()) fail(`candidate is still in use: ${path}`);
}

function assertRuntime() {
  const profile = JSON.parse(readFileSync(new URL("../conf/native-environment.json", import.meta.url), "utf8"));
  if (process.versions.node !== profile.nodeVersion) fail(`Node.js ${profile.nodeVersion} is required; measured ${process.versions.node}`);
  const db = new DatabaseSync(":memory:");
  try {
    const version = db.prepare("SELECT sqlite_version() AS version").get().version;
    if (version !== profile.sqliteVersion) fail(`SQLite ${profile.sqliteVersion} is required; measured ${version}`);
  } finally { db.close(); }
}

function assertIntegrity(database) {
  const row = database.prepare("PRAGMA quick_check").get();
  if (!row || Object.values(row)[0] !== "ok") fail("SQLite quick_check failed");
  if (database.prepare("PRAGMA foreign_key_check").all().length) fail("SQLite foreign_key_check failed");
}

/** Only an offline, unpublished copy is mutated. No runtime-config or default DB lookup. */
export function activateDatabaseCandidate(candidatePath, sourcePath) {
  assertRuntime();
  const candidate = safeFile(candidatePath, "candidate");
  const source = safeFile(sourcePath, "source");
  if (candidate.dev === source.dev && candidate.ino === source.ino) fail("candidate and source alias each other");
  for (const path of [candidatePath, `${candidatePath}-wal`, `${candidatePath}-shm`]) {
    if (existsSync(path)) safeFile(path, "candidate sidecar");
    assertNotOpen(path);
  }
  const database = new DatabaseSync(candidatePath);
  try {
    // The same initializer guards future schema/checksums and upgrades old backups.
    initializeSqlite(database);
    assertIntegrity(database);
    database.exec("BEGIN IMMEDIATE");
    let before, after;
    try {
      before = readBookVersion(database);
      after = rotateBookEpoch(database);
      assertIntegrity(database);
      database.exec("COMMIT");
    } catch (error) {
      if (database.isTransaction) database.exec("ROLLBACK");
      throw error;
    }
    const checkpoint = database.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
    if (checkpoint?.busy !== 0) fail("candidate WAL checkpoint is busy");
    return { before, after };
  } finally { database.close(); }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== "--candidate" || args[2] !== "--source") fail("usage: activate-database-candidate.mjs --candidate /absolute/copy.sqlite --source /absolute/source.sqlite");
    const result = activateDatabaseCandidate(args[1], args[3]);
    console.log(JSON.stringify(result));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
