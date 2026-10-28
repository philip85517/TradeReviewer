import { webcrypto } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../db/sqlite", async original => ({ ...await original<typeof import("../../../../db/sqlite")>(), openSqliteDatabase: vi.fn() }));
import { openSqliteDatabase } from "../../../../db/sqlite";
import { createSqliteHttpClient } from "../../../lib/storage/sqlite-http-client";
import { tradeReadDigest, type TradeReadPage } from "../../../lib/storage/trade-read-contract";
import { POST as prepare } from "./plans/route";
import { POST as commit } from "./commit/route";
import { GET as receipt } from "./receipts/route";
import { POST as read } from "./read/route";
import { PUT as rename } from "../instruments/name/route";
import { POST as revise } from "../trade-revisions/route";
import { POST as migrate } from "../migrate/route";
import { submitReviewedTrade, type ReviewedTradeSubmission } from "../../../lib/storage/trade-change-submission";
import { readHomepageStoredCollection } from "../../../lib/storage/homepage-source-snapshot";
import { parseHomepageStoredCollection } from "../../../lib/storage/homepage-source-contract";

const original = await vi.importActual<typeof import("../../../../db/sqlite")>("../../../../db/sqlite");
let directory: string, path: string, db: DatabaseSync;
const instrument = { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" };
const fact = { id: "E0", accountId: "A", accountLabel: "A", instrument, side: "buy" as const, executedAt: "2026-10-01", quantity: "1.0000000000000001", price: "123.456789012345678901", fee: "0.0000000000000001", source: { platform: "broker", row: 1, feeStatus: "reported" as const, timePrecision: "date-only" as const } };
async function dispatch(input: string, init?: RequestInit) {
  const request = new Request(`http://localhost${input}`, init);
  if (input === "/api/storage/trades/plans") return prepare(request);
  if (input === "/api/storage/trades/commit") return commit(request);
  if (input.startsWith("/api/storage/trades/receipts?")) return receipt(request);
  if (input === "/api/storage/trades/read") return read(request);
  if (input === "/api/storage/instruments/name") return rename(request);
  throw new Error(`Unexpected URL ${input}`);
}
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  directory = mkdtempSync(join(tmpdir(), "trade-http-protocol-")); path = join(directory, "isolated.sqlite");
  db = original.openSqliteDatabase(path); vi.mocked(openSqliteDatabase).mockImplementation(() => db);
});
afterEach(() => { db.close(); rmSync(directory, { recursive: true, force: true }); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("formal trade HTTP and client journey", () => {
  it("enumerates more than 1000 persisted facts in complete same-version client and homepage collections", async () => {
    const client = createSqliteHttpClient(dispatch);
    const candidates = Array.from({ length: 1001 }, (_, index) => ({ ...fact, id: `large-${index}`, source: { ...fact.source, row: index } }));
    const plan = await client.prepareTradeChanges({ kind: "import", candidates });
    const receipt = await client.commitTradeChanges({ requestId: "large-seed", planId: plan.planId, choices: {} });
    const book = await client.readTradeBook({ pageSize: 1000, version: { exact: receipt.bookVersion } });
    expect(book.pages.map(page => page.snapshot.displayExecutionIds.length)).toEqual([1000, 1]);
    expect(new Set(book.executions.map(execution => execution.id)).size).toBe(1001);
    expect(book.pages.every(page => JSON.stringify(page.snapshot.bookVersion) === JSON.stringify(receipt.bookVersion))).toBe(true);
    const home = await parseHomepageStoredCollection(readHomepageStoredCollection(db));
    expect(home.bookVersion).toEqual(receipt.bookVersion);
    expect(home.tradeReadPages).toHaveLength(2);
    expect(new Set(home.bootstrap.executions.map(execution => execution.id)).size).toBe(1001);
  }, 20000);
  it("classifies a validly encoded but incompatible or out-of-range cursor as input", async () => {
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges({ kind: "import", candidates: [fact, { ...fact, id: "E1", executedAt: "2026-10-02" }] });
    await client.commitTradeChanges({ requestId: "seed-cursor", planId: plan.planId, choices: {} });
    const page = await client.readTradeSnapshot({ pageSize: 1 });
    const cursor = JSON.parse(Buffer.from(page.snapshot.nextCursor!, "base64url").toString("utf8"));
    const request = (value: unknown) => read(new Request("http://localhost", { method: "POST", body: JSON.stringify(value) }));
    for (const selection of [
      { pageSize: 2, cursor: page.snapshot.nextCursor },
      { pageSize: 1, cursor: Buffer.from(JSON.stringify({ ...cursor, offset: 100 })).toString("base64url") },
      { pageSize: 1, cursor: Buffer.from(JSON.stringify({ ...cursor, bookVersion: {} })).toString("base64url") },
    ]) {
      const response = await request(selection);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { category: "input" } });
    }
  });
  it("rejects correctly digested malformed page partitions and inconsistent metadata", async () => {
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges({ kind: "import", candidates: [fact] });
    await client.commitTradeChanges({ requestId: "seed", planId: plan.planId, choices: {} });
    const mutations: Array<(page: TradeReadPage) => void> = [
      page => { page.snapshot.dependencyExecutionIds = [fact.id, fact.id]; },
      page => { page.snapshot.dependencyExecutionIds = [fact.id]; page.snapshot.receipt.totalDependencyFacts = 1; },
      page => { page.display.instruments[0].currency = "HKD"; },
      page => { page.display.executions[0].instrument.name = "Different name"; },
      page => { page.snapshot.facts.push({ ...page.snapshot.facts[0], id: "unclassified" }); },
    ];
    for (const mutate of mutations) {
      const malformed = createSqliteHttpClient(async (url, init) => {
        const response = await dispatch(url, init);
        const page = await response.json() as TradeReadPage;
        if (url.endsWith("/read")) {
          mutate(page);
          const { receipt: oldReceipt, ...payload } = page.snapshot;
          page.snapshot.receipt = { ...oldReceipt, payloadDigest: await tradeReadDigest(payload) };
          page.payloadDigest = await tradeReadDigest({ snapshot: page.snapshot, display: page.display });
        }
        return Response.json(page);
      });
      await expect(malformed.readTradeBook()).rejects.toMatchObject({ code: "invalid-response" });
    }
  });
  it("never accepts a receipt for a different reviewed plan during recovery", async () => {
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges({ kind: "import", candidates: [fact] });
    const other = await client.commitTradeChanges({ requestId: "other", planId: plan.planId, choices: {} });
    const state: ReviewedTradeSubmission = { envelope: { requestId: "pending", planId: "different-plan", choices: {} }, attempted: true };
    await expect(submitReviewedTrade({ ...client, getTradeCommit: async () => other }, state)).rejects.toMatchObject({ phase: "outcome-unknown" });
    expect(state.receipt).toBeUndefined();
  });
  it("recovers the same persisted revision after a lost response and retries only a failed read", async () => {
    const client = createSqliteHttpClient(dispatch);
    const seed = await client.prepareTradeChanges({ kind: "import", candidates: [fact] });
    await client.commitTradeChanges({ requestId: "seed", planId: seed.planId, choices: {} });
    const plan = await client.prepareTradeChanges({ kind: "revision", revision: { id: "revision-loss", instrumentId: instrument.id, accountId: "A", reason: "核对原始成交后修订价格", changes: [{ before: fact, after: { ...fact, price: "0" } }], expectedScope: [fact] } });
    const state: ReviewedTradeSubmission = { envelope: { requestId: "revision-request", planId: plan.planId, choices: {} } };
    let commitCalls = 0, failRead = true;
    const unreliable = { ...client,
      commitTradeChanges: async (input: Parameters<typeof client.commitTradeChanges>[0]) => { commitCalls++; await client.commitTradeChanges(input); throw new TypeError("response lost"); },
      readTradeBook: async (input: Parameters<typeof client.readTradeBook>[0]) => { if (failRead) throw new TypeError("read lost"); return client.readTradeBook(input); },
    };
    await expect(submitReviewedTrade(unreliable, state)).rejects.toMatchObject({ phase: "outcome-unknown" });
    db.close(); db = original.openSqliteDatabase(path);
    await expect(submitReviewedTrade(unreliable, state)).rejects.toMatchObject({ phase: "saved-awaiting-read", receipt: { planId: plan.planId } });
    expect(state.receipt?.bookVersion).toBeDefined();
    failRead = false;
    const result = await submitReviewedTrade(unreliable, state);
    expect(result.executions[0].price).toBe("0");
    expect(result.executions[0].quantity).toBe(fact.quantity);
    expect(commitCalls).toBe(1);
    expect(db.prepare("select count(*) n from trade_revisions where id='revision-loss'").get()).toMatchObject({ n: 1 });
  });
  it("preserves typed input and conflict errors through compatibility consumers", async () => {
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges({ kind: "import", candidates: [fact] });
    await client.commitTradeChanges({ requestId: "seed", planId: plan.planId, choices: {} });
    const req = (body: unknown) => new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
    const invalid = await revise(req({ id: "invalid", instrumentId: instrument.id, accountId: "other", reason: "test", changes: [{ before: fact, after: { ...fact, quantity: "2" } }] }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { category: "input", code: "INVALID_INPUT" } });
    const payload = { version: 1, sourceClientId: "browser", sourceFingerprint: "fp", executions: [{ ...fact, quantity: "bad" }], importHistory: [], instruments: [], reviews: [], reviewStates: [], tagSuggestions: [], marketDataJobs: [], settings: {}, dailyCandles: [], marketCandles: [], coverage: [], intervalCoverage: [], providerSymbols: [] };
    const rejected = await migrate(req(payload));
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({ error: { category: "input", code: "INVALID_INPUT" } });
    expect(db.prepare("select id,quantity from executions").all()).toEqual([expect.objectContaining({ id: "E0", quantity: fact.quantity })]);
  });
  it("updates only an existing display name without rewriting executions or advancing the book", async () => {
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges({ kind: "import", candidates: [fact] });
    const saved = await client.commitTradeChanges({ requestId: "seed", planId: plan.planId, choices: {} });
    const before = db.prepare("select * from executions order by id").all();
    await client.putInstrumentName({ instrumentId: instrument.id, name: "Apple 新名称" });
    const result = await client.readTradeBook({ version: { exact: saved.bookVersion } });
    expect(result.instruments[0].name).toBe("Apple 新名称");
    expect(result.executions[0].instrument.name).toBe("Apple 新名称");
    expect(db.prepare("select * from executions order by id").all()).toEqual(before);
    await expect(client.putInstrumentName({ instrumentId: "US:MISSING", name: "Missing" })).rejects.toMatchObject({ status: 404, code: "INSTRUMENT_NOT_FOUND" });
    expect((await client.readTradeBook()).instruments[0].name).toBe("Apple 新名称");
  });
  it("appends only the current candidates, refreshes every page at the receipt version and survives reopen", async () => {
    const client = createSqliteHttpClient(dispatch);
    const seed = await client.prepareTradeChanges({ kind: "import", candidates: [fact] });
    await client.commitTradeChanges({ requestId: "seed", planId: seed.planId, choices: {} });
    const incoming = [{ ...fact, id: "E1", executedAt: "2026-10-02", source: { ...fact.source, row: 2 } }, { ...fact, id: "E2", executedAt: "2026-10-03", source: { ...fact.source, row: 3 } }];
    const plan = await client.prepareTradeChanges({ kind: "import", candidates: incoming });
    expect(plan.summary.candidateCount).toBe(2);
    const saved = await client.commitTradeChanges({ requestId: "import", planId: plan.planId, choices: {} });
    db.close(); db = original.openSqliteDatabase(path);
    expect(await client.getTradeCommit("import")).toEqual(saved);
    const result = await client.readTradeBook({ version: { atLeast: saved.bookVersion }, pageSize: 1 });
    expect(result.pages).toHaveLength(3);
    expect(result.facts.map(f => f.id)).toEqual(["E0", "E1", "E2"]);
    expect(result.executions.map(e => e.id)).toEqual(["E0", "E1", "E2"]);
    expect(result.facts[0]).toMatchObject({ quantity: fact.quantity, price: fact.price, executedAt: fact.executedAt, fee: fact.fee });
    expect(result.executions[0]).toMatchObject({ fee: fact.fee, source: { feeStatus: "reported", timePrecision: "date-only" } });
    expect(result.pages.every(p => p.snapshot.bookVersion.sequence >= saved.bookVersion.sequence)).toBe(true);
  });

  it("keeps unknown account and fee in the authoritative snapshot", async () => {
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges({ kind: "import", candidates: [fact] });
    await client.commitTradeChanges({ requestId: "seed", planId: plan.planId, choices: {} });
    // A legitimate historical unknown is a stored fact, not a fabricated incoming account.
    db.prepare("update executions set account=null,fee=null,evidence_json=? where id=?").run(JSON.stringify({ accountLabel: "", source: { ...fact.source, feeStatus: "unknown" } }), fact.id);
    const readback = await client.readTradeBook();
    expect(readback.facts[0]).toMatchObject({ accountId: null, fee: null });
    expect(readback.executions).toHaveLength(1);
    expect(readback.executions[0].accountId).toBe("");
    expect(readback.executions[0]).toMatchObject({ fee: "", source: { feeStatus: "unknown" } });
  });

  it("keeps strict incoming fee validation while accepting the parser's unknown flag", async () => {
    for (const fee of ["", null]) {
      const response = await prepare(new Request("http://localhost", { method: "POST", body: JSON.stringify({ kind: "import", candidates: [{ ...fact, fee, source: { ...fact.source, feeStatus: "unknown" } }] }) }));
      expect(response.status).toBe(400);
      expect(db.prepare("select count(*) as count from executions").get()).toMatchObject({ count: 0 });
    }
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges({ kind: "import", candidates: [{ ...fact, fee: "0", source: { ...fact.source, feeStatus: "unknown" } }] });
    await client.commitTradeChanges({ requestId: "parser-unknown", planId: plan.planId, choices: {} });
    expect((await client.readTradeBook()).executions[0]).toMatchObject({ fee: "0", source: { feeStatus: "unknown" } });
  });

  it("preserves stable typed failures and never exposes internal causes", async () => {
    expect((await prepare(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
    const client = createSqliteHttpClient(dispatch);
    const stale = await client.prepareTradeChanges({ kind: "import", candidates: [fact] });
    const other = await client.prepareTradeChanges({ kind: "import", candidates: [{ ...fact, id: "other" }] });
    await client.commitTradeChanges({ requestId: "other", planId: other.planId, choices: {} });
    await expect(client.commitTradeChanges({ requestId: "stale", planId: stale.planId, choices: {} })).rejects.toMatchObject({ status: 409, code: "BOOK_VERSION_CHANGED", category: "conflict", retryable: false });
    expect(await client.getTradeCommit("stale")).toBeNull();
    db.exec("create trigger refuse_receipt before insert on trade_change_receipts begin select raise(abort,'private sql path'); end");
    const plan = await client.prepareTradeChanges({ kind: "import", candidates: [{ ...fact, id: "late", executedAt: "2026-10-04" }] });
    const response = await commit(new Request("http://localhost", { method: "POST", body: JSON.stringify({ requestId: "late", planId: plan.planId, choices: {} }) }));
    expect(response.status).toBe(500);
    const body = await response.json() as { error: unknown };
    expect(body.error).toMatchObject({ code: "UNEXPECTED_FAILURE", category: "unexpected", retryable: false, savedState: "Previous saved data is unchanged." });
    expect(JSON.stringify(body)).not.toContain("private sql path");
  });

  it("rejects tampered or mixed-version pages before publishing any collection", async () => {
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges({ kind: "import", candidates: [fact, { ...fact, id: "E1", executedAt: "2026-10-02" }] });
    await client.commitTradeChanges({ requestId: "seed", planId: plan.planId, choices: {} });
    const tampered = createSqliteHttpClient(async (url, init) => {
      const response = await dispatch(url, init); const body = await response.json() as { snapshot: { facts: { price: string }[] } };
      if (url.endsWith("/read")) body.snapshot.facts[0].price = "0";
      return Response.json(body);
    });
    await expect(tampered.readTradeBook()).rejects.toMatchObject({ code: "invalid-response" });
    let readCount = 0;
    const changing = createSqliteHttpClient(async (url, init) => {
      if (url.endsWith("/read") && ++readCount === 2) {
        const next = await client.prepareTradeChanges({ kind: "import", candidates: [{ ...fact, id: "E2", executedAt: "2026-10-03" }] });
        await client.commitTradeChanges({ requestId: "concurrent", planId: next.planId, choices: {} });
      }
      return dispatch(url, init);
    });
    await expect(changing.readTradeBook({ pageSize: 1 })).rejects.toMatchObject({ status: 409, code: "BOOK_VERSION_CHANGED" });
  });

  it("rejects a correctly signed display projection that duplicates one fact and omits another", async () => {
    const client = createSqliteHttpClient(dispatch);
    const plan = await client.prepareTradeChanges({ kind: "import", candidates: [fact, { ...fact, id: "E1", executedAt: "2026-10-02" }] });
    await client.commitTradeChanges({ requestId: "seed", planId: plan.planId, choices: {} });
    const duplicateDisplay = createSqliteHttpClient(async (url, init) => {
      const response = await dispatch(url, init);
      const body = await response.json() as TradeReadPage;
      if (url.endsWith("/read")) {
        body.display.executions[1] = body.display.executions[0];
        body.payloadDigest = await tradeReadDigest({ snapshot: body.snapshot, display: body.display });
      }
      return Response.json(body);
    });
    await expect(duplicateDisplay.readTradeBook()).rejects.toMatchObject({ code: "invalid-response" });
  });
});
