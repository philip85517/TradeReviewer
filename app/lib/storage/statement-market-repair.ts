/** Explicit operator tool only: never imported by startup, storage migrations, or request handlers. */
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseStatementCashIdentity } from "../import/statement-cash-identity.ts";

type Cell = null | string | number | { integer: string } | { bytes: string };
type TableSnapshot = { schema: Array<{ type: string; name: string; sql: string | null }>; columns: string[]; rows: Cell[][] };
type Snapshot = { importBatches: TableSnapshot; executions: TableSnapshot; instruments: TableSnapshot };
type Change = { importId: string; eventId: string; eventIndex: number; market: string; symbol: string; fields: Array<"market" | "symbol"> };
type Skipped = { importId: string; eventId?: string; reason: string };
export class StatementMarketRepairProtocolError extends Error {
  readonly code = "SOURCE_MATERIAL_PROTOCOL_REQUIRED";
  readonly correlationId = randomUUID();
  readonly phase: "prepare" | "apply";
  constructor(phase: "prepare" | "apply") {
    super("Source material databases require a reviewed material change; legacy JSON repair is unavailable");
    this.name = "StatementMarketRepairProtocolError";
    this.phase = phase;
  }
}
function assertLegacyRepairDatabase(database: DatabaseSync, phase: "prepare" | "apply"): void {
  if (database.prepare("select 1 from sqlite_master where type='table' and name in ('source_material_versions','trade_change_plans') limit 1").get()) {
    throw new StatementMarketRepairProtocolError(phase);
  }
}
export type StatementMarketRepairPlan = {
  version: 1;
  kind: "statement-market-repair";
  databasePath: string;
  createdAt: string;
  before: Snapshot;
  targetImportBatches: TableSnapshot;
  changes: Change[];
  skipped: Skipped[];
  digest: string;
};
type Audit = {
  version: 1;
  kind: "statement-market-repair-audit";
  status: "prepared" | "applied";
  preparedAt: string;
  appliedAt?: string;
  plan: StatementMarketRepairPlan;
  digest: string;
};
type ApplyResult = { status: "applied" | "already-applied" | "unchanged"; changedEvents: number; auditPath: string };
const serialized = (value: unknown) => JSON.stringify(value);
const same = (left: unknown, right: unknown) => serialized(left) === serialized(right);
function checksum(value: { digest?: string }): string {
  const body = { ...value, digest: undefined };
  return createHash("sha256").update(serialized(body)).digest("hex");
}
function seal<T extends { digest: string }>(value: T): T { return { ...value, digest: checksum(value) }; }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function validCell(value: unknown): value is Cell {
  return value === null || typeof value === "string" || (typeof value === "number" && Number.isFinite(value))
    || (object(value) && Object.keys(value).length === 1 && ((typeof value.integer === "string" && /^-?\d+$/.test(value.integer)) || (typeof value.bytes === "string" && /^(?:[a-f0-9]{2})*$/.test(value.bytes))));
}
function validateTable(value: unknown): asserts value is TableSnapshot {
  if (!object(value)) throw new Error("Invalid plan table snapshot");
  const { columns, rows, schema } = value;
  if (!Array.isArray(columns) || !columns.every(c => typeof c === "string") || new Set(columns).size !== columns.length
    || !columns.includes("id") || !Array.isArray(rows) || !rows.every(r => Array.isArray(r) && r.length === columns.length && r.every(validCell))
    || !Array.isArray(schema) || !schema.every(s => object(s) && typeof s.type === "string" && typeof s.name === "string" && (s.sql === null || typeof s.sql === "string"))) throw new Error("Invalid plan table snapshot");
  const ids = rows.map(row => row[columns.indexOf("id")]);
  if (!ids.every(id => typeof id === "string") || new Set(ids).size !== ids.length) throw new Error("Invalid plan row identities");
}
function encodeCell(value: unknown): Cell {
  if (typeof value === "bigint") return { integer: value.toString() };
  if (value instanceof Uint8Array) return { bytes: Buffer.from(value).toString("hex") };
  if (validCell(value)) return value;
  throw new Error("Unsupported SQLite snapshot value");
}
function readTable(database: DatabaseSync, name: "import_batches" | "executions" | "instruments"): TableSnapshot {
  const columns = database.prepare(`pragma table_info(${name})`).all().map(c => String(c.name));
  if (!columns.includes("id")) throw new Error(`Missing required table: ${name}`);
  const schema = database.prepare("select type, name, sql from sqlite_master where tbl_name = ? order by type, name").all(name)
    .map(s => ({ type: String(s.type), name: String(s.name), sql: s.sql === null ? null : String(s.sql) }));
  const statement = database.prepare(`select * from ${name} order by id`);
  statement.setReadBigInts(true);
  return { schema, columns, rows: statement.all().map(row => columns.map(column => encodeCell(row[column]))) };
}
function readSnapshot(database: DatabaseSync): Snapshot {
  return { importBatches: readTable(database, "import_batches"), executions: readTable(database, "executions"), instruments: readTable(database, "instruments") };
}
function targets(imports: TableSnapshot): Pick<StatementMarketRepairPlan, "targetImportBatches" | "changes" | "skipped"> {
  const targetImportBatches: TableSnapshot = structuredClone(imports);
  const changes: Change[] = [];
  const skipped: Skipped[] = [];
  const idIndex = imports.columns.indexOf("id");
  const rawIndex = imports.columns.indexOf("reconciliation_json");
  if (rawIndex < 0) throw new Error("Invalid plan: missing reconciliation_json");
  for (const [rowIndex, row] of imports.rows.entries()) {
    const importId = String(row[idIndex]);
    if (!importId.startsWith("import:futu:")) continue;
    let entry: unknown;
    try { entry = typeof row[rawIndex] === "string" ? JSON.parse(row[rawIndex]) : undefined; } catch { /* Retain damaged evidence for manual review. */ }
    if (!object(entry) || !object(entry.monthly) || !Array.isArray(entry.monthly.events) || entry.monthly.documentId !== importId.slice("import:".length)) {
      skipped.push({ importId, reason: "invalid-reconciliation" });
      continue;
    }
    let changed = false;
    for (const [eventIndex, event] of entry.monthly.events.entries()) {
      if (!object(event) || typeof event.id !== "string" || typeof event.description !== "string") {
        skipped.push({ importId, reason: "invalid-event" });
        continue;
      }
      const fields = (["market", "symbol"] as const).filter(key => event[key] === undefined || event[key] === "");
      if (!fields.length) continue;
      if (event.documentId !== undefined && event.documentId !== entry.monthly.documentId) {
        skipped.push({ importId, eventId: event.id, reason: "different-source-document" });
        continue;
      }
      const identity = parseStatementCashIdentity(event.description);
      if (!identity) {
        skipped.push({ importId, eventId: event.id, reason: "no-explicit-identity" });
        continue;
      }
      if ((["market", "symbol"] as const).some(key => !fields.includes(key) && event[key] !== identity[key])) {
        skipped.push({ importId, eventId: event.id, reason: "conflicting-identity" });
        continue;
      }
      for (const field of fields) event[field] = identity[field];
      changes.push({ importId, eventId: event.id, eventIndex, ...identity, fields });
      changed = true;
    }
    // Unchanged raw JSON stays byte-for-byte intact. Changed documents retain every parsed field.
    if (changed) targetImportBatches.rows[rowIndex][rawIndex] = serialized(entry);
  }
  return { targetImportBatches, changes, skipped };
}
function validatePlan(value: unknown): asserts value is StatementMarketRepairPlan {
  if (!object(value) || value.version !== 1 || value.kind !== "statement-market-repair" || typeof value.databasePath !== "string" || !value.databasePath
    || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.digest !== "string" || checksum(value) !== value.digest || !object(value.before)) throw new Error("Invalid or damaged statement market repair plan");
  validateTable(value.before.importBatches);
  validateTable(value.before.executions);
  validateTable(value.before.instruments);
  validateTable(value.targetImportBatches);
  const derived = targets(value.before.importBatches);
  if (!same(value.targetImportBatches, derived.targetImportBatches) || !same(value.changes, derived.changes) || !same(value.skipped, derived.skipped)) throw new Error("Invalid plan: targets exceed authorized identity-only repair");
}
/** Canonicalize an output without following an existing output symlink. */
export function statementMarketRepairOutputPath(path: string): string {
  if (!path.trim()) throw new Error("An explicit output path is required");
  const target = join(fs.realpathSync(dirname(resolve(path))), basename(path));
  if (fs.existsSync(target) && (!fs.lstatSync(target).isFile() || fs.lstatSync(target).isSymbolicLink())) throw new Error("Output must be a regular file, not a symlink");
  return target;
}
function databasePath(path: string): string {
  if (!path.trim()) throw new Error("An explicit database path is required");
  const canonical = fs.realpathSync(path);
  if (!fs.lstatSync(canonical).isFile()) throw new Error("Database must be an existing regular file");
  return canonical;
}
function protectDatabaseOutput(dbPath: string, output: string): void {
  if ([dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`].includes(output)) throw new Error("Output path overlaps database or its journal");
}
function durableWrite(path: string, value: unknown): void {
  const target = statementMarketRepairOutputPath(path);
  const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
  let fd: number | undefined;
  try {
    fd = fs.openSync(temporary, "wx", 0o600);
    const bytes = Buffer.from(`${serialized(value)}\n`, "utf8");
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.writeSync(fd, bytes, offset, bytes.length - offset);
      if (!Number.isInteger(count) || count <= 0 || count > bytes.length - offset) throw new Error("Invalid short write while persisting audit");
      offset += count;
    }
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, target);
    const directory = fs.openSync(dirname(target), "r");
    try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
export function createStatementMarketRepairPlan(path: string): StatementMarketRepairPlan {
  const canonical = databasePath(path);
  const database = new DatabaseSync(canonical, { readOnly: true });
  try {
    database.exec("begin");
    assertLegacyRepairDatabase(database, "prepare");
    const before = readSnapshot(database);
    const plan = seal({ version: 1 as const, kind: "statement-market-repair" as const, databasePath: canonical, createdAt: new Date().toISOString(), before, ...targets(before.importBatches), digest: "" });
    database.exec("commit");
    return plan;
  } finally { database.close(); }
}
export function writeStatementMarketRepairPlan(plan: StatementMarketRepairPlan, path: string): void {
  validatePlan(plan);
  const output = statementMarketRepairOutputPath(path);
  protectDatabaseOutput(plan.databasePath, output);
  if (fs.existsSync(output)) throw new Error("Plan output already exists; retain it and choose a new path");
  durableWrite(output, plan);
}
export function readStatementMarketRepairPlan(path: string): StatementMarketRepairPlan {
  let value: unknown;
  try { value = JSON.parse(fs.readFileSync(path, "utf8")); } catch { throw new Error("Invalid or unreadable statement market repair plan"); }
  validatePlan(value);
  return value;
}
function readAudit(path: string, plan: StatementMarketRepairPlan): Audit | undefined {
  if (!fs.existsSync(path)) return undefined;
  let audit: unknown;
  try { audit = JSON.parse(fs.readFileSync(path, "utf8")); } catch { throw new Error("Invalid or damaged audit journal"); }
  if (!object(audit) || audit.version !== 1 || audit.kind !== "statement-market-repair-audit" || !["prepared", "applied"].includes(String(audit.status))
    || typeof audit.preparedAt !== "string" || !Number.isFinite(Date.parse(audit.preparedAt)) || typeof audit.digest !== "string" || checksum(audit) !== audit.digest
    || !same(audit.plan, plan) || (audit.status === "applied" && (typeof audit.appliedAt !== "string" || !Number.isFinite(Date.parse(audit.appliedAt))))) throw new Error("Invalid audit journal or different repair plan");
  return audit as Audit;
}
export function applyStatementMarketRepairPlan(path: string, inputPlan: StatementMarketRepairPlan, auditPath: string): ApplyResult {
  // Clone to avoid caller mutation while validating and writing the journal.
  const plan: StatementMarketRepairPlan = structuredClone(inputPlan);
  validatePlan(plan);
  const canonical = databasePath(path);
  if (canonical !== plan.databasePath) throw new Error("Plan database path does not match explicit --db");
  const output = statementMarketRepairOutputPath(auditPath);
  protectDatabaseOutput(canonical, output);
  const audit = readAudit(output, plan);
  const database = new DatabaseSync(canonical);
  let inTransaction = false;
  try {
    database.exec("begin immediate");
    inTransaction = true;
    assertLegacyRepairDatabase(database, "apply");
    const current = readSnapshot(database);
    const target = { ...plan.before, importBatches: plan.targetImportBatches };
    const isOriginal = same(current, plan.before);
    const isTarget = same(current, target);
    if (!isOriginal && !isTarget) throw new Error("Stale plan: exact database snapshots no longer match");
    if (isTarget && !isOriginal && !audit) throw new Error("Already-target data requires its original audit journal");
    if (audit?.status === "applied" && !isTarget) throw new Error("Applied audit does not match current database snapshot");
    const prepared: Audit = audit ?? seal({ version: 1 as const, kind: "statement-market-repair-audit" as const, status: "prepared" as const, preparedAt: new Date().toISOString(), plan, digest: "" });
    // fsync of the original/target journal and its directory must succeed before SQL writes.
    // A prior preparation may have failed its directory fsync after rename. Re-persist
    // a prepared journal before retrying original data; mere file presence is insufficient.
    if (!audit || (isOriginal && prepared.status === "prepared")) durableWrite(output, prepared);
    if (!isTarget) {
      const idIndex = plan.before.importBatches.columns.indexOf("id");
      const rawIndex = plan.before.importBatches.columns.indexOf("reconciliation_json");
      const update = database.prepare("update import_batches set reconciliation_json = ? where id = ? and reconciliation_json = ?");
      for (const [index, row] of plan.before.importBatches.rows.entries()) {
        const after = plan.targetImportBatches.rows[index];
        if (same(row, after)) continue;
        const result = update.run(String(after[rawIndex]), String(row[idIndex]), String(row[rawIndex]));
        if (Number(result.changes) !== 1) throw new Error("Snapshot update conflict");
      }
      if (!same(readSnapshot(database), target)) throw new Error("Repair invariant failed: unexpected database snapshot after update");
    }
    database.exec("commit");
    inTransaction = false;
    // A crash here leaves a prepared receipt with both snapshots. A rerun verifies target and finalizes it.
    if (prepared.status !== "applied") durableWrite(output, seal({ ...prepared, status: "applied", appliedAt: new Date().toISOString() }));
    return { status: isTarget ? (plan.changes.length ? "already-applied" : "unchanged") : "applied", changedEvents: isTarget ? 0 : plan.changes.length, auditPath: output };
  } finally {
    if (inTransaction) database.exec("rollback");
    database.close();
  }
}
