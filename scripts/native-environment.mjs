import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import process from "node:process";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const profilePath = existsSync(join(moduleDir, "native-environment.json"))
  ? join(moduleDir, "native-environment.json")
  : join(moduleDir, "..", "conf", "native-environment.json");

function fail(message) {
  throw new Error(`Invalid native environment: ${message}`);
}

function readProfile(path) {
  let value;
  try { value = JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { fail(`cannot read profile ${path}: ${error instanceof Error ? error.message : String(error)}`); }
  if (!value || typeof value !== "object") fail("profile must be a JSON object");
  for (const key of ["nodeVersion", "sqliteVersion", "nodeExecutable"]) {
    if (typeof value[key] !== "string" || !value[key].trim()) fail(`profile.${key} is required`);
  }
  return value;
}

function getSqliteVersion() {
  const database = new DatabaseSync(":memory:");
  try {
    const row = database.prepare("SELECT sqlite_version() AS version").get();
    return String(row?.version ?? "");
  } finally {
    database.close();
  }
}

/** Synchronously verify and report the exact runtime used by source or installed tooling. */
export function assertNativeEnvironment(options = {}) {
  const profile = readProfile(options.profilePath ?? profilePath);
  const versions = options.versions ?? process.versions;
  const nodeVersion = String(versions.node ?? "").replace(/^v/, "");
  const nodeExecutable = options.execPath ?? process.execPath;
  if (nodeVersion !== profile.nodeVersion) fail(`Node.js ${profile.nodeVersion} is required; measured ${nodeVersion || "unknown"}`);
  if (nodeExecutable !== profile.nodeExecutable) fail(`configured executable ${profile.nodeExecutable} is required; measured ${nodeExecutable}`);
  const sqliteVersion = String((options.getSqliteVersion ?? getSqliteVersion)());
  if (sqliteVersion !== profile.sqliteVersion) fail(`SQLite ${profile.sqliteVersion} is required; measured ${sqliteVersion || "unknown"}`);
  return { nodeVersion, sqliteVersion, nodeExecutable };
}

export function nativeEnvironmentProfilePath() { return profilePath; }
