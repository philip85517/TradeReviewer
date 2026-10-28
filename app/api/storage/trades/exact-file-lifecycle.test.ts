import { webcrypto } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openSqliteDatabase } from "../../../../db/sqlite";
import type { ImportCompletionEvidence } from "../../../lib/import/import-completion";
import { createSqliteHttpClient } from "../../../lib/storage/sqlite-http-client";
import type { StandardTradeChangeIntent } from "../../../lib/storage/sqlite-contracts";
import { submitReviewedTrade, type ReviewedTradeSubmission } from "../../../lib/storage/trade-change-submission";
import { createTradeChanges } from "../../../lib/storage/trade-changes";
import { POST as prepare } from "./plans/route";
import { POST as commit } from "./commit/route";
import { GET as receipt } from "./receipts/route";
import { POST as read } from "./read/route";

type ImportIntent = Extract<StandardTradeChangeIntent, { kind: "import" }>;
const identity = { sha256: "a".repeat(64), byteLength: 123 };
const fact = {
  id: "file-lifecycle-E0", accountId: "A", accountLabel: "测试账户",
  instrument: { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" },
  side: "buy" as const, executedAt: "2026-10-01", quantity: "1", price: "123", fee: "0",
  source: { platform: "futu", fileName: "original.xlsx", fileFingerprint: "1234567890abcdef", row: 1, timePrecision: "date-only" as const },
};
const completeEvidence: ImportCompletionEvidence = {
  broker: "futu", blocked: false, unresolvedInstrumentCount: 0, exclusions: [],
};
function importIntent(overrides: Partial<ImportIntent> = {}): ImportIntent {
  return { kind: "import", candidates: [structuredClone(fact)], fileImport: { ...identity, complete: true }, ...overrides };
}
async function dispatch(input: string, init?: RequestInit) {
  const request = new Request(`http://localhost${input}`, init);
  if (input === "/api/storage/trades/plans") return prepare(request);
  if (input === "/api/storage/trades/commit") return commit(request);
  if (input.startsWith("/api/storage/trades/receipts?")) return receipt(request);
  if (input === "/api/storage/trades/read") return read(request);
  throw new Error(`Unexpected URL ${input}`);
}

let directory: string;
let path: string;
let database: DatabaseSync;
const peers: DatabaseSync[] = [];
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  const isolatedRoot = resolve(".scratch/import-exact-file-block-2026-10-27/browser-isolated");
  mkdirSync(isolatedRoot, { recursive: true });
  directory = mkdtempSync(join(isolatedRoot, "api-lifecycle-"));
  path = join(directory, "isolated.sqlite");
  // The real routes use their normal database opener, bound to this test's own file.
  vi.stubEnv("TRADEREVIEW_DB_PATH", path);
  database = openSqliteDatabase();
});
afterEach(() => {
  for (const peer of peers.splice(0)) if (peer.isOpen) peer.close();
  if (database?.isOpen) database.close();
  rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function reopen() {
  database.close();
  database = openSqliteDatabase();
}
function persistenceSnapshot() {
  const tables = database.prepare("select name from sqlite_schema where type = 'table' and name not glob 'sqlite_*' order by name").all();
  return Object.fromEntries(tables.map(({ name }) => {
    const identifier = `"${String(name).replaceAll('"', '""')}"`;
    const statement = database.prepare(`select * from ${identifier}`);
    statement.setReadBigInts(true);
    const rows = statement.all().map(row => JSON.stringify(
      Object.entries(row).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
      (_key, value: unknown) => typeof value === "bigint" ? { integer: value.toString() }
        : value instanceof Uint8Array ? { blob: Buffer.from(value).toString("hex") } : value,
    )).sort();
    return [String(name), rows];
  }));
}

describe("exact-file import lifecycle through real HTTP routes and isolated SQLite", () => {
  it.each([
    { name: "short digest", fileImport: { ...identity, sha256: "a".repeat(63), complete: true } },
    { name: "non-hex digest", fileImport: { ...identity, sha256: "g".repeat(64), complete: true } },
    { name: "empty content", fileImport: { ...identity, byteLength: 0, complete: true } },
    { name: "fractional byte count", fileImport: { ...identity, byteLength: 1.5, complete: true } },
    { name: "unsafe byte count", fileImport: { ...identity, byteLength: Number.MAX_SAFE_INTEGER + 1, complete: true } },
    { name: "missing completion decision", fileImport: { ...identity } },
    { name: "malformed completion evidence", fileImport: { ...identity, complete: true, evidence: { ...completeEvidence, unresolvedInstrumentCount: -1 } } },
  ])("rejects $name before any saved result and permits a corrected retry", async ({ fileImport }) => {
    const client = createSqliteHttpClient(dispatch);
    const response = await prepare(new Request("http://localhost/api/storage/trades/plans", {
      method: "POST", body: JSON.stringify({ ...importIntent(), fileImport }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_INPUT", category: "input" } });
    expect((await client.readTradeBook()).facts).toEqual([]);
    reopen();
    const plan = await client.prepareTradeChanges(importIntent());
    const saved = await client.commitTradeChanges({ requestId: "corrected", planId: plan.planId, choices: {} });
    expect(saved.result.importedFile).toEqual({ sha256: "a".repeat(64), byteLength: 123 });
    expect((await client.readTradeBook()).facts).toHaveLength(1);
  });

  it("blocks identical original bytes even if the retry changes its name, legacy fingerprint and candidate ID", async () => {
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges(importIntent({
      candidates: [{ ...fact, source: { ...fact.source, batchId: "lifecycle-history" } }],
      importHistory: [{ id: "lifecycle-history", fileName: "original.xlsx", sourceLabel: "富途", importedAt: "2026-10-01T00:00:00Z", tradeCount: 1, instrumentCount: 1, unresolvedInstrumentCount: 0, excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 0 }],
    }));
    await client.commitTradeChanges({ requestId: "saved-original", planId: plan.planId, choices: {} });
    reopen();
    const before = persistenceSnapshot();
    expect(Object.keys(before)).toEqual(expect.arrayContaining([
      "trade_book_state", "trade_change_plans", "trade_change_receipts", "trade_change_requests",
      "import_batches", "import_history_audit_state", "import_history_plan_proofs", "import_history_memberships",
    ]));
    expect(before.trade_book_state).toHaveLength(1);
    expect(before.trade_change_plans).toHaveLength(1);
    expect(before.trade_change_receipts).toHaveLength(1);
    expect(before.trade_change_requests).toHaveLength(1);
    expect(before.import_batches).toHaveLength(1);
    expect(JSON.parse(String(database.prepare("select receipt_json from trade_change_receipts").get()!.receipt_json))).toMatchObject({
      result: { importedFile: { sha256: "a".repeat(64), byteLength: 123 } },
    });
    await expect(client.prepareTradeChanges(importIntent({ candidates: [{
      ...fact, id: "renamed-candidate", source: { ...fact.source, fileName: "改名.xlsx", fileFingerprint: "fedcba0987654321" },
    }] }))).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED", phase: "prepare", status: 409 });
    expect(persistenceSnapshot()).toEqual(before);
    expect((await client.readTradeBook()).facts.map(value => value.id)).toEqual(["file-lifecycle-E0"]);
    database.close();
    // Inspect persisted rows without startup migration/audit repair hiding a write.
    database = new DatabaseSync(path, { readOnly: true });
    expect(persistenceSnapshot()).toEqual(before);
  });

  it("requires both digest and byte length to match a saved file identity", async () => {
    const client = createSqliteHttpClient(dispatch);
    for (const [index, fileImport] of [
      { ...identity, complete: true },
      { ...identity, byteLength: 124, complete: true },
      { ...identity, sha256: "b".repeat(64), complete: true },
    ].entries()) {
      const plan = await client.prepareTradeChanges(importIntent({ fileImport, candidates: [{
        ...fact, id: `identity-${index}`, executedAt: `2026-10-0${index + 1}`, source: { ...fact.source, row: index + 1 },
      }] }));
      const saved = await client.commitTradeChanges({ requestId: `identity-${index}`, planId: plan.planId, choices: {} });
      expect(saved.result.importedFile).toEqual({ sha256: fileImport.sha256, byteLength: fileImport.byteLength });
    }
    reopen();
    for (const fileImport of [
      { ...identity, complete: true },
      { ...identity, byteLength: 124, complete: true },
      { ...identity, sha256: "b".repeat(64), complete: true },
    ]) await expect(client.prepareTradeChanges(importIntent({ fileImport }))).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED" });
    expect((await client.readTradeBook()).facts).toHaveLength(3);
  });

  it("recovers a file success receipt after a lost commit response without submitting another write", async () => {
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges(importIntent());
    const state: ReviewedTradeSubmission = { envelope: { requestId: "lost-file-response", planId: plan.planId, choices: {} } };
    let writes = 0;
    const interruptedClient = {
      ...client,
      commitTradeChanges: async (input: Parameters<typeof client.commitTradeChanges>[0]) => {
        writes++;
        await client.commitTradeChanges(input);
        throw new TypeError("response lost after persistence");
      },
    };
    await expect(submitReviewedTrade(interruptedClient, state)).rejects.toMatchObject({ phase: "outcome-unknown" });
    expect(state.receipt).toBeUndefined();
    reopen();
    const recovered = await submitReviewedTrade(interruptedClient, state);
    expect(state.receipt?.result.importedFile).toEqual({ sha256: "a".repeat(64), byteLength: 123 });
    expect(await client.getTradeCommit("lost-file-response")).toEqual(state.receipt);
    expect(recovered.facts.map(value => value.id)).toEqual(["file-lifecycle-E0"]);
    expect(writes).toBe(1);
    await expect(client.prepareTradeChanges(importIntent())).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED" });
  });

  it("leaves a cancelled preview retryable after reopening the database", async () => {
    const client = createSqliteHttpClient(dispatch);
    await client.prepareTradeChanges(importIntent());
    reopen();
    expect((await client.readTradeBook()).facts).toEqual([]);
    const retry = await client.prepareTradeChanges(importIntent());
    const saved = await client.commitTradeChanges({ requestId: "after-cancel", planId: retry.planId, choices: {} });
    expect(saved.result.importedFile).toEqual({ sha256: "a".repeat(64), byteLength: 123 });
    await expect(client.prepareTradeChanges(importIntent())).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED" });
  });

  it("rolls back file success and request binding when receipt persistence fails, then retries the same request after restart", async () => {
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges(importIntent());
    const request = { requestId: "retry-after-restart", planId: plan.planId, choices: {} };
    database.exec("create trigger reject_file_receipt before insert on trade_change_receipts begin select raise(abort, 'fixture failure'); end");
    await expect(client.commitTradeChanges(request)).rejects.toMatchObject({ code: "UNEXPECTED_FAILURE", status: 500 });
    reopen();
    expect(await client.getTradeCommit(request.requestId)).toBeNull();
    expect((await client.readTradeBook()).facts).toEqual([]);
    await expect(client.prepareTradeChanges(importIntent())).resolves.toMatchObject({ status: "ready" });
    database.exec("drop trigger reject_file_receipt");
    const saved = await client.commitTradeChanges(request);
    expect(saved.result.importedFile).toEqual({ sha256: "a".repeat(64), byteLength: 123 });
    reopen();
    expect(await client.getTradeCommit(request.requestId)).toEqual(saved);
    expect((await client.readTradeBook()).facts).toHaveLength(1);
    await expect(client.prepareTradeChanges(importIntent())).rejects.toMatchObject({ code: "FILE_ALREADY_IMPORTED" });
  });

  it.each([false, true])("prevents two independent connections committing the same file (existing trades: %s)", async existing => {
    const client = createSqliteHttpClient(dispatch);
    if (existing) {
      const seed = await client.prepareTradeChanges({ kind: "import", candidates: [fact] });
      await client.commitTradeChanges({ requestId: "legacy-seed", planId: seed.planId, choices: {} });
    }
    const peer = new DatabaseSync(path);
    peers.push(peer);
    const competitor = createTradeChanges(peer);
    const first = await client.prepareTradeChanges(importIntent());
    const racing = competitor.prepare(importIntent());
    await client.commitTradeChanges({ requestId: "race-winner", planId: first.planId, choices: {} });
    expect(() => competitor.commit({ requestId: "race-loser", planId: racing.planId, choices: {} })).toThrowError(expect.objectContaining({
      code: existing ? "FILE_ALREADY_IMPORTED" : "BOOK_VERSION_CHANGED",
    }));
    expect(competitor.getCommit("race-loser")).toBeNull();
    expect(() => competitor.prepare(importIntent())).toThrowError(expect.objectContaining({ code: "FILE_ALREADY_IMPORTED" }));
    peer.close();
    reopen();
    expect((await client.readTradeBook()).facts.map(value => value.id)).toEqual(["file-lifecycle-E0"]);
    expect(await client.getTradeCommit("race-loser")).toBeNull();
    expect((await client.getTradeCommit("race-winner"))?.result.importedFile).toEqual({ sha256: "a".repeat(64), byteLength: 123 });
  });

  it.each([
    { name: "blocked parser", evidence: { ...completeEvidence, blocked: true }, candidates: [fact] },
    { name: "unresolved security", evidence: { ...completeEvidence, unresolvedInstrumentCount: 1 }, candidates: [fact] },
    { name: "broker mismatch", evidence: { ...completeEvidence, broker: "tiger" as const }, candidates: [fact] },
    { name: "multiple source files", evidence: completeEvidence, candidates: [fact, { ...fact, id: "other-file", executedAt: "2026-10-02", source: { ...fact.source, fileFingerprint: "fedcba0987654321" } }] },
    { name: "unrecognized ignored exclusion", evidence: { ...completeEvidence, exclusions: [{ category: "cash" as const, label: "未核对项目", count: 1, disposition: "ignored" as const, ruleId: "unrecognized@1" }] }, candidates: [fact] },
  ])("does not persist a success proof for $name despite an optimistic completion flag", async ({ evidence, candidates }) => {
    const client = createSqliteHttpClient(dispatch);
    const input = importIntent({ candidates, fileImport: { ...identity, complete: true, evidence } });
    const plan = await client.prepareTradeChanges(input);
    const saved = await client.commitTradeChanges({ requestId: "pending-evidence", planId: plan.planId, choices: {} });
    expect(saved.result).not.toHaveProperty("importedFile");
    reopen();
    expect((await client.getTradeCommit("pending-evidence"))?.result).not.toHaveProperty("importedFile");
    expect((await client.readTradeBook()).facts).toHaveLength(candidates.length);
    await expect(client.prepareTradeChanges(input)).resolves.toMatchObject({ status: "ready" });
  });
});
