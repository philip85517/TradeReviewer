import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyStatementMarketRepairPlan,
  createStatementMarketRepairPlan,
  readStatementMarketRepairPlan,
  writeStatementMarketRepairPlan,
} from "./statement-market-repair";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, writeSync: vi.fn(actual.writeSync), renameSync: vi.fn(actual.renameSync), fsyncSync: vi.fn(actual.fsyncSync) };
});
const realFs = await vi.importActual<typeof import("node:fs")>("node:fs");
const directories: string[] = [];
afterEach(() => {
  vi.mocked(fs.writeSync).mockImplementation(realFs.writeSync);
  vi.mocked(fs.renameSync).mockImplementation(realFs.renameSync);
  vi.mocked(fs.fsyncSync).mockImplementation(realFs.fsyncSync);
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});
function event(id: string, description: string, extra: Record<string, unknown> = {}) {
  return { id, documentId: "futu:a", accountId: "人工账户修正", date: "2021-08-06", kind: "fee", amount: "-0.50", currency: "HKD", description, source: [{ page: 1, row: 22, role: "cash" }], ...extra };
}
function fixture(events = [event("fee", "比亞迪股份 <HKEX 01211> 收費")]) {
  const directory = fs.mkdtempSync(join(tmpdir(), "statement-market-repair-"));
  directories.push(directory);
  const dbPath = join(directory, "独立验证.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec(`create table import_batches (id text primary key, source_type text, reconciliation_json text, evidence_json text, record_count integer);
    create table executions (id text primary key, instrument_id text, account_id text, quantity text, price text, fee text, evidence_json text);
    create table instruments (id text primary key, market text, symbol text);`);
  const reconciliation = JSON.stringify({ id: "import:futu:a", monthly: { documentId: "futu:a", positions: [], events, manualField: "申购补录💾" }, tradeCount: 1, untouched: "原始\n原文" }, null, 2);
  db.prepare("insert into import_batches values (?, 'statement', ?, ?, 1)").run("import:futu:a", reconciliation, '{"原始":"证据💾"}');
  db.prepare("insert into executions values ('fill', 'HK:01211', '人工账户修正', '100', '99.98', '4.22', ?)").run('{"money":"保持原始成交"}');
  db.exec("insert into instruments values ('HK:01211', 'HK', '01211')");
  db.close();
  return { directory, dbPath, auditPath: join(directory, "回滚审计.json"), planPath: join(directory, "修复计划.json"), reconciliation };
}
function readRows(dbPath: string, table: string) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try { return db.prepare(`select * from ${table} order by id`).all(); } finally { db.close(); }
}
function readEvents(dbPath: string) {
  return JSON.parse(String(readRows(dbPath, "import_batches")[0].reconciliation_json)).monthly.events;
}
function mutate(dbPath: string, sql: string) {
  const db = new DatabaseSync(dbPath);
  try { db.exec(sql); } finally { db.close(); }
}

describe("historical statement market repair", () => {
  it("plans only explicit missing identities without changing the database bytes", () => {
    const f = fixture([
      event("fee", "比亞迪股份 <HKEX 01211> 收費"),
      event("truncated", "存入現金 <HKEX 01211", { kind: "other", amount: "73.00" }),
      event("legacy", "<SEHK 700> 現金股息"),
      event("unknown", "NVIDIA CORP CASH DIVIDEND 123284"),
      event("option", "option <HKEX 01211>"),
      event("conflict", "<HKEX 01211>", { market: "US" }),
      event("partial", "#01211", { market: "HK" }),
      event("known", "#01211", { market: "HK", symbol: "01211" }),
    ]);
    const bytes = fs.readFileSync(f.dbPath);
    const plan = createStatementMarketRepairPlan(f.dbPath);
    expect(plan.changes.map(c => [c.eventId, c.market, c.symbol, c.fields])).toEqual([
      ["fee", "HK", "01211", ["market", "symbol"]], ["truncated", "HK", "01211", ["market", "symbol"]],
      ["legacy", "HK", "00700", ["market", "symbol"]], ["partial", "HK", "01211", ["symbol"]],
    ]);
    expect(plan.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventId: "conflict", reason: "conflicting-identity" }),
      expect.objectContaining({ eventId: "unknown", reason: "no-explicit-identity" }),
    ]));
    expect(fs.readFileSync(f.dbPath)).toEqual(bytes);
    expect(fs.readdirSync(f.directory)).toEqual(["独立验证.sqlite"]);
  });

  it("persists, reopens, and applies a plan while retaining originals and money exactly", () => {
    const f = fixture();
    const importsBefore = readRows(f.dbPath, "import_batches");
    const executionsBefore = readRows(f.dbPath, "executions");
    const instrumentsBefore = readRows(f.dbPath, "instruments");
    writeStatementMarketRepairPlan(createStatementMarketRepairPlan(f.dbPath), f.planPath);
    const plan = readStatementMarketRepairPlan(f.planPath);
    expect(applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toMatchObject({ status: "applied", changedEvents: 1 });
    const repaired = readEvents(f.dbPath)[0];
    expect(repaired).toEqual({ ...event("fee", "比亞迪股份 <HKEX 01211> 收費"), market: "HK", symbol: "01211" });
    expect(readRows(f.dbPath, "executions")).toEqual(executionsBefore);
    expect(readRows(f.dbPath, "instruments")).toEqual(instrumentsBefore);
    expect(readRows(f.dbPath, "import_batches")[0].evidence_json).toBe(importsBefore[0].evidence_json);
    const journal = JSON.parse(fs.readFileSync(f.auditPath, "utf8"));
    expect(journal.status).toBe("applied");
    expect(journal.plan.before.importBatches.rows[0]).toContain(f.reconciliation);
    expect(journal.plan.targetImportBatches.rows[0].some((v: unknown) => typeof v === "string" && v.includes('"market":"HK"'))).toBe(true);
    expect(applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toMatchObject({ status: "already-applied", changedEvents: 0 });
    expect(readRows(f.dbPath, "executions")).toEqual(executionsBefore);
  });

  it("leaves ambiguous or conflicting partial fields untouched and reports them", () => {
    const f = fixture([event("conflict", "<HKEX 01211>", { symbol: "00700" }), event("account", "USD 12345 NVIDIA"), event("fill", "#01211", { symbol: "01211" })]);
    const plan = createStatementMarketRepairPlan(f.dbPath);
    expect(plan.changes.map(c => c.eventId)).toEqual(["fill"]);
    applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath);
    expect(readEvents(f.dbPath).slice(0, 2)).toEqual([event("conflict", "<HKEX 01211>", { symbol: "00700" }), event("account", "USD 12345 NVIDIA")]);
    expect(readEvents(f.dbPath)[2]).toMatchObject({ symbol: "01211", market: "HK" });
  });

  it.each([
    ["evidence", "update import_batches set evidence_json = 'changed'"],
    ["raw reconciliation whitespace", "update import_batches set reconciliation_json = reconciliation_json || ' '"],
    ["executions", "update executions set quantity = '101'"],
    ["instrument markets", "update instruments set market = 'US'"],
  ])("rejects stale %s snapshots before touching any target", (_name, sql) => {
    const f = fixture();
    const plan = createStatementMarketRepairPlan(f.dbPath);
    mutate(f.dbPath, sql);
    const beforeAttempt = readRows(f.dbPath, "import_batches");
    expect(() => applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toThrow(/snapshot|stale/i);
    expect(readRows(f.dbPath, "import_batches")).toEqual(beforeAttempt);
    expect(fs.existsSync(f.auditPath)).toBe(false);
  });

  it("rolls back the batch when an update trigger alters an execution", () => {
    const f = fixture();
    mutate(f.dbPath, "create trigger alter_fill after update on import_batches begin update executions set fee = '0'; end");
    const plan = createStatementMarketRepairPlan(f.dbPath);
    expect(() => applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toThrow(/snapshot|invariant/i);
    expect(readEvents(f.dbPath)[0].market).toBeUndefined();
    expect(readRows(f.dbPath, "executions")[0].fee).toBe("4.22");
    expect(JSON.parse(fs.readFileSync(f.auditPath, "utf8")).status).toBe("prepared");
  });

  it("rejects corrupted plans, corrupted receipts, and receipts from another plan", () => {
    const f = fixture();
    const plan = createStatementMarketRepairPlan(f.dbPath);
    writeStatementMarketRepairPlan(plan, f.planPath);
    fs.writeFileSync(f.planPath, '{"version":1}');
    expect(() => readStatementMarketRepairPlan(f.planPath)).toThrow(/plan/i);
    fs.writeFileSync(f.auditPath, "{damaged");
    expect(() => applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toThrow(/audit/i);
    fs.unlinkSync(f.auditPath);
    const other = fixture();
    applyStatementMarketRepairPlan(other.dbPath, createStatementMarketRepairPlan(other.dbPath), f.auditPath);
    expect(() => applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toThrow(/audit|plan/i);
    expect(readEvents(f.dbPath)[0].market).toBeUndefined();
  });

  it.each(["write", "fsync", "rename"])("fails before any database update if the durable journal %s fails", (failure) => {
    const f = fixture();
    const plan = createStatementMarketRepairPlan(f.dbPath);
    const fail = () => { throw new Error("injected durable writer failure"); };
    if (failure === "write") vi.mocked(fs.writeSync).mockImplementationOnce(fail);
    if (failure === "fsync") vi.mocked(fs.fsyncSync).mockImplementationOnce(fail);
    if (failure === "rename") vi.mocked(fs.renameSync).mockImplementationOnce(fail);
    expect(() => applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toThrow(/writer failure/);
    expect(readEvents(f.dbPath)[0].market).toBeUndefined();
    expect(fs.readdirSync(f.directory).filter(name => name.endsWith(".tmp"))).toEqual([]);
  });

  it("handles repeated short byte writes without corrupting Unicode or the durable plan", () => {
    const f = fixture();
    vi.mocked(fs.writeSync).mockImplementation((fd, data, offset, length) => {
      if (typeof data === "string") throw new Error("writer must encode bytes before offsets");
      return realFs.writeSync(fd, data, Number(offset), Math.min(Number(length), 7));
    });
    writeStatementMarketRepairPlan(createStatementMarketRepairPlan(f.dbPath), f.planPath);
    const plan = readStatementMarketRepairPlan(f.planPath);
    applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath);
    expect(readEvents(f.dbPath)[0].accountId).toBe("人工账户修正");
    expect(JSON.parse(fs.readFileSync(f.auditPath, "utf8")).plan.before.importBatches.rows[0]).toContain(f.reconciliation);
  });

  it("recovers a prepared journal after commit interrupted the final receipt write", () => {
    const f = fixture();
    const plan = createStatementMarketRepairPlan(f.dbPath);
    let renames = 0;
    vi.mocked(fs.renameSync).mockImplementation((from, to) => {
      if (++renames === 2) throw new Error("interrupted after database commit");
      realFs.renameSync(from, to);
    });
    expect(() => applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toThrow(/after database commit/);
    expect(readEvents(f.dbPath)[0]).toMatchObject({ market: "HK", symbol: "01211" });
    expect(JSON.parse(fs.readFileSync(f.auditPath, "utf8")).status).toBe("prepared");
    vi.mocked(fs.renameSync).mockImplementation(realFs.renameSync);
    expect(applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toMatchObject({ status: "already-applied", changedEvents: 0 });
    expect(JSON.parse(fs.readFileSync(f.auditPath, "utf8")).status).toBe("applied");
  });

  it("re-persists a prepared journal after a directory fsync failure before retrying SQL", () => {
    const f = fixture();
    const plan = createStatementMarketRepairPlan(f.dbPath);
    let syncs = 0;
    vi.mocked(fs.fsyncSync).mockImplementation(fd => {
      if (++syncs === 2) throw new Error("directory sync failed");
      realFs.fsyncSync(fd);
    });
    expect(() => applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toThrow(/directory sync/);
    expect(readEvents(f.dbPath)[0].market).toBeUndefined();
    expect(JSON.parse(fs.readFileSync(f.auditPath, "utf8")).status).toBe("prepared");
    vi.mocked(fs.writeSync).mockImplementationOnce(() => { throw new Error("retry persist failed"); });
    expect(() => applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toThrow(/retry persist/);
    expect(readEvents(f.dbPath)[0].market).toBeUndefined();
    vi.mocked(fs.fsyncSync).mockImplementation(realFs.fsyncSync);
    expect(applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath).status).toBe("applied");
  });

  it("rejects checksummed money edits in plans and valid-JSON damaged audit receipts", () => {
    const f = fixture();
    const plan = createStatementMarketRepairPlan(f.dbPath);
    const tampered = structuredClone(plan);
    const rawIndex = tampered.targetImportBatches.columns.indexOf("reconciliation_json");
    const raw = JSON.parse(String(tampered.targetImportBatches.rows[0][rawIndex]));
    raw.monthly.events[0].amount = "1000";
    tampered.targetImportBatches.rows[0][rawIndex] = JSON.stringify(raw);
    const body = { ...tampered, digest: undefined };
    tampered.digest = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    expect(() => applyStatementMarketRepairPlan(f.dbPath, tampered, f.auditPath)).toThrow(/authorized|plan/i);
    expect(fs.existsSync(f.auditPath)).toBe(false);
    applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath);
    const receipt = JSON.parse(fs.readFileSync(f.auditPath, "utf8"));
    receipt.plan.before.executions.rows[0][0] = "damaged";
    fs.writeFileSync(f.auditPath, JSON.stringify(receipt));
    expect(() => applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toThrow(/audit/i);
    expect(readEvents(f.dbPath)[0].amount).toBe("-0.50");
  });

  it("rejects zero-progress short writes before changing data", () => {
    const f = fixture();
    const plan = createStatementMarketRepairPlan(f.dbPath);
    vi.mocked(fs.writeSync).mockImplementationOnce(() => 0);
    expect(() => applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toThrow(/short write/);
    expect(readEvents(f.dbPath)[0].market).toBeUndefined();
  });

  it("refuses to recreate a missing receipt when target data already exists", () => {
    const f = fixture();
    const plan = createStatementMarketRepairPlan(f.dbPath);
    applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath);
    fs.unlinkSync(f.auditPath);
    expect(() => applyStatementMarketRepairPlan(f.dbPath, plan, f.auditPath)).toThrow(/audit|journal/i);
  });

  it("runs native CLI help, explicit read-only planning, apply, and safe argument failures", () => {
    const f = fixture();
    const run = (...args: string[]) => spawnSync(process.execPath, ["scripts/repair-statement-market.ts", ...args], { cwd: process.cwd(), encoding: "utf8" });
    expect(run("--help").status).toBe(0);
    expect(run("--plan", f.planPath).status).not.toBe(0);
    expect(run("--db", f.dbPath, "--plan", f.dbPath).status).not.toBe(0);
    expect(run("--db", f.dbPath, "--plan", f.planPath).status).toBe(0);
    expect(readEvents(f.dbPath)[0].market).toBeUndefined();
    expect(run("--db", f.dbPath, "--apply", f.planPath, "--audit", f.auditPath).status).toBe(0);
    expect(readEvents(f.dbPath)[0]).toMatchObject({ market: "HK", symbol: "01211" });
    expect(run("--db", f.dbPath, "--apply", f.planPath, "--audit", f.auditPath).stdout).toMatch(/already-applied/);
  });
});
