import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSqliteWorkspaceHarness } from "./sqlite-workspace-harness";
import { createSqliteHttpClient } from "../../lib/storage/sqlite-http-client";
import { createTradingViewAccountMigrationClient } from "../../lib/storage/tradingview-account-migration-client";
import { encodeHomepageSourceBinding, type HomepageStoredCollection } from "../../lib/storage/homepage-source-contract";
import { createRecallRepository } from "../../lib/recall/repository";
import { fetchRecallReviewSummaries } from "../../lib/recall/summary-client";
import { createRecallDocument, retainRecallSnapshot } from "../../lib/recall/document";
import { buildTradeEpisodes } from "../../lib/trades/episodes";
import type { TradeExecution } from "../../lib/trades/types";
import type { RecallSnapshot } from "../../lib/recall/types";
import type { EpisodeReviewState } from "../../lib/storage/review-storage";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import * as browserExport from "../../lib/storage/browser-state-export";
import { createBrowserReviewStateWriter, readAliasedReviewStates, type BrowserReviewWriteResolution } from "../../lib/storage/migration-browser-alias";

const instrument = { id: "US:TEST", symbol: "TEST", name: "Original name", market: "US", currency: "USD" };
const settings: ChartSettings = { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" };
function fact(id: string, side: TradeExecution["side"], day: string, sourceTradeId = `new-pair-${id}`, sourceRow = 9): TradeExecution {
  return { id, accountId: "Broker A / sub-01", accountLabel: "Original account", instrument: { ...instrument }, side,
    executedAt: `${day}T00:00:00.000Z`, quantity: "1.0000000000000001", price: "123.456789012345678901", fee: "0.0000000000000001",
    source: { platform: "tradingview", row: sourceRow, fileFingerprint: "explicit-source-fingerprint", timePrecision: "date-only", sourceTimezone: "Asia/Shanghai", feeStatus: "reported", tradeNature: "simulation", simulationRunId: "explicit-run-01", sourceTradeId, simulationRole: side === "buy" ? "entry" : "exit" } };
}
const pair = [fact("original-buy", "buy", "2026-01-01", "original-pair-01", 7), fact("original-sell", "sell", "2026-01-02", "original-pair-01", 8)];
const owned: ReturnType<typeof createSqliteWorkspaceHarness>[] = [];
function workspace(executions = pair) {
  const h = createSqliteWorkspaceHarness({ tradeData: { executions: structuredClone(executions), instruments: [{ ...instrument }], importHistory: [] }, settings: { ...settings } });
  owned.push(h); return h;
}
async function importOne(h: ReturnType<typeof workspace>, id: string) {
  const plan = await h.client.prepareTradeChanges({ kind: "import", candidates: [fact(id, "buy", "2026-01-03")] });
  const envelope = { requestId: `request-${id}`, planId: plan.planId, choices: {} };
  return { plan, envelope, receipt: await h.client.commitTradeChanges(envelope) };
}
function snapshot(decisionId: string, id: string): RecallSnapshot {
  return { id, decisionId, timeframe: "1D", cursor: "2026-01-01T00:00:00.000Z", executionCursor: "2026-01-01T00:00:00.000Z",
    candles: [{ time: "2026-01-01T00:00:00.000Z", open: 10, high: 11, low: 9, close: 10, volume: 1 }], drawings: [],
    imageDataUrl: "data:image/png;base64,AAAA", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
}
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { for (const h of owned.splice(0)) h.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

describe("strict single-authority workspace transport contracts", () => {
  it("refuses a queued review write when browser conflict appears before dispatch", async () => {
    const h = workspace();
    const state: EpisodeReviewState = { version: 2, episodeId: "conflicted", replayCursor: "A", timeframe: "1D", activePanelTab: "stats", drawings: [] };
    let resolution: BrowserReviewWriteResolution = { ready: true, conflicts: [] };
    const write = createBrowserReviewStateWriter(() => resolution, value => h.client.putReviewState(value));
    let release!: () => void;
    const previous = new Promise<void>(resolve => { release = resolve; });
    const queued = previous.then(() => write(state));
    resolution = { ready: true, conflicts: [{ episodeId: "conflicted", sourceKeys: ["old", "canonical"] }] };
    const rejected = expect(queued).rejects.toThrow("浏览器复盘内容冲突");
    release(); await rejected;
    expect((await createSqliteHttpClient(h.fetcher).getBootstrap()).reviewStates).toEqual([]);
    expect(h.calls.journey.filter(call => call.operation === "putReviewState")).toEqual([]);
  });

  it("keeps unresolved hydration read-only, saves other episodes, and accepts SQLite authority", async () => {
    const h = workspace();
    const state: EpisodeReviewState = { version: 2, episodeId: "canonical", replayCursor: "SQLite", timeframe: "1D", activePanelTab: "stats", drawings: [] };
    let resolution: BrowserReviewWriteResolution = { ready: false, conflicts: [] };
    const write = createBrowserReviewStateWriter(() => resolution, value => h.client.putReviewState(value));
    await expect(write(state)).rejects.toThrow("复盘来源尚未核实");
    expect((await h.client.getBootstrap()).reviewStates).toEqual([]);
    resolution = { ready: true, conflicts: [{ episodeId: "canonical", sourceKeys: ["old", "canonical"] }] };
    const other = { ...state, episodeId: "unrelated", replayCursor: "other" };
    await write(other);
    expect((await createSqliteHttpClient(h.fetcher).getBootstrap()).reviewStates).toEqual([other]);
    // An explicit authoritative seed is preparation, not a browser recovery or UI save.
    await h.client.putReviewState(state);
    const authoritative = Object.fromEntries((await h.client.getBootstrap()).reviewStates.map(item => [item.episodeId, item]));
    const oldBytes = JSON.stringify({ version: 1, replayCursor: "old browser", timeframe: "1D", thesis: "old text", drawings: [] });
    const newBytes = JSON.stringify({ ...state, replayCursor: "new browser" });
    const values = new Map([["trade-reviewer:review:v1:old", oldBytes], ["trade-reviewer:review:v2:canonical", newBytes]]);
    const browser = { getItem: (key: string) => values.get(key) ?? null };
    const restored = readAliasedReviewStates(browser, [{ operationId: "test-authority", kind: "episode", oldId: "old", newId: "canonical" }], authoritative);
    expect(restored).toEqual({ states: [], conflicts: [] });
    resolution = { ready: true, conflicts: restored.conflicts };
    await write({ ...authoritative.canonical, replayCursor: "explicit update" });
    expect((await createSqliteHttpClient(h.fetcher).getBootstrap()).reviewStates).toContainEqual({ ...state, replayCursor: "explicit update" });
    expect([...values]).toEqual([["trade-reviewer:review:v1:old", oldBytes], ["trade-reviewer:review:v2:canonical", newBytes]]);
  });
  it("reads active migration aliases through the production client in an owned empty database and rejects unsupported queries", async () => {
    const h = workspace();
    const client = createTradingViewAccountMigrationClient(h.fetcher);
    const book = await h.client.readTradeBook();
    expect(await client.getActiveAliases()).toEqual({ aliases: [] });
    expect((await h.client.readTradeBook()).bookVersion).toEqual(book.bookVersion);
    expect(h.calls.journey.find(call => call.operation === "getMigrationAliases")).toMatchObject({ parameters: {}, invoked: true, delivered: true, status: 200, result: { aliases: [] } });
    await expect(h.fetcher("/api/storage/tradingview-account-migration/aliases?unknown=poison")).rejects.toThrow("Unsupported workspace operation");
    await expect(h.fetcher("/api/storage/tradingview-account-migration/aliases", { method: "POST", body: "{}" })).rejects.toThrow("Unsupported workspace operation");
  });

  it("reads nonempty committed aliases from the owned Store seed while a separate database remains empty", async () => {
    const h = createSqliteWorkspaceHarness({
      priorEmptyMigration: { sourceClientId: "owned-alias", sourceFingerprint: "owned-alias-empty" },
      tradeData: { executions: structuredClone(pair), instruments: [{ ...instrument }], importHistory: [] },
      committedAccountMigration: { operationId: "owned-alias-seed" },
    });
    owned.push(h);
    const client = createTradingViewAccountMigrationClient(h.fetcher);
    expect((await h.client.getBootstrap()).migration).toMatchObject({ sourceFingerprint: "owned-alias-empty" });
    expect((await client.getActiveAliases()).aliases).toContainEqual({
      operationId: "owned-alias-seed", kind: "account", oldId: "Broker A / sub-01", newId: "tradingview:simulation:default",
    });
    const book = await h.client.readTradeBook();
    expect(book.executions.map(row => row.accountId)).toEqual(["tradingview:simulation:default", "tradingview:simulation:default"]);
    const separate = workspace();
    expect(await createTradingViewAccountMigrationClient(separate.fetcher).getActiveAliases()).toEqual({ aliases: [] });
    expect(h.calls.seed.slice(-3).map(call => call.operation)).toEqual(["seed.accountMigration.preview", "seed.accountMigration.commit", "seed.accountMigration.aliasReadback"]);
    expect(h.calls.seed.slice(-3).every(call => call.invoked && call.delivered)).toBe(true);
    expect(h.calls.journey.filter(call => call.operation.startsWith("seed."))).toEqual([]);
    expect(h.calls.seed.slice(0, 4).map(call => call.operation)).toEqual(["seed.emptyMigration.write", "seed.emptyMigration.receipt", "seed.emptyMigration.readback", "seed.emptyMigration.status"]);
  });

  it("persists review state through the production client and bootstrap readback without changing trade facts", async () => {
    const h = workspace();
    const book = await h.client.readTradeBook();
    const state: EpisodeReviewState = {
      version: 2, episodeId: buildTradeEpisodes(pair)[0].id,
      replayCursor: "2026-01-01T00:00:00.000Z", timeframe: "1D", activePanelTab: "notes", drawings: [],
    };
    expect(await h.client.putReviewState(state)).toEqual(state);
    const rebuilt = createSqliteHttpClient(h.fetcher);
    expect((await rebuilt.getBootstrap()).reviewStates).toEqual([state]);
    expect(h.calls.journey.find(call => call.operation === "putReviewState")).toMatchObject({ parameters: state, invoked: true, delivered: true, status: 200 });
    const invalid = await h.fetcher("/api/storage/reviews", { method: "PUT", body: JSON.stringify({ ...state, timeframe: "invalid" }) });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: "invalid-request" } });
    expect((await rebuilt.getBootstrap()).reviewStates).toEqual([state]);
    expect((await h.client.readTradeBook()).executions).toEqual(book.executions);
    expect((await h.client.readTradeBook()).bookVersion).toEqual(book.bookVersion);
    expect((await workspace().client.getBootstrap()).reviewStates).toEqual([]);
    await expect(h.fetcher("/api/storage/reviews?unknown=poison", { method: "PUT", body: JSON.stringify(state) })).rejects.toThrow("Unsupported workspace operation");
    await expect(h.fetcher("/api/storage/reviews", { method: "POST", body: JSON.stringify(state) })).rejects.toThrow("Unsupported workspace operation");
  });

  it("S1: parses coherent Home/bootstrap/Recall carriers and preserves seed source facts without normalization", async () => {
    // This new incoming fact has unknown nature and an explicitly reported fee.
    // Historical null fees remain covered by the unchanged protocol and Home snapshot contracts.
    const unknownNature: TradeExecution = { ...fact("unknown-nature", "buy", "2026-01-03"), accountId: "separate-account", fee: "0.125000000000000001", source: { platform: "explicit-unknown", row: 9, timePrecision: "second", feeStatus: "reported", tradeNature: "unknown" } };
    const h = workspace([...pair, unknownNature]);
    const episode = buildTradeEpisodes(pair)[0];
    const saved = await h.recallRepository.save(createRecallDocument(episode, "2026-01-03T00:00:00.000Z"));
    const home = await h.client.getHomepageSource();
    const bootstrap = await h.client.getBootstrap();
    const status = await h.client.getStatus();
    const book = await h.client.readTradeBook({ pageSize: 1 });
    expect(home.receipt.counts).toEqual({ executions: 3, instruments: 1, importHistory: 0, legacyReviewRows: 0, recallDocuments: 1 });
    expect(status.counts.executions).toBe(3);
    expect(home.bootstrap.executions).toEqual(bootstrap.executions);
    expect(home.recallSummaries).toEqual(await fetchRecallReviewSummaries(h.fetcher));
    expect(await h.recallRepository.load(episode.id)).toEqual(saved);
    expect(home.receipt.payloadDigest).toBe(`sha256:${createHash("sha256").update(encodeHomepageSourceBinding(home)).digest("hex")}`);
    expect(book.pages).toHaveLength(3);
    expect(book.pages.every(page => JSON.stringify(page.snapshot.bookVersion) === JSON.stringify(home.bookVersion))).toBe(true);
    expect(home.tradeReadPages[0].snapshot.scope.selection.pageSize).toBe(1000);
    for (const original of [...pair, unknownNature]) {
      expect(book.executions.find(row => row.id === original.id)).toEqual(original);
      expect(book.facts.find(row => row.id === original.id)).toMatchObject({ accountId: original.accountId, quantity: original.quantity, price: original.price, fee: original.fee, tradeNature: original.source.tradeNature, simulationRunId: original.source.simulationRunId ?? null });
    }
    expect(h.calls.seed.map(call => call.operation)).toEqual(["seed.tradeData.compatibilityCommit", "seed.tradeData.readback", "seed.settings.write", "seed.settings.readback"]);
    expect(h.calls.journey.every(call => call.phase === "journey")).toBe(true);
    expect(Object.isFrozen(h.calls.seed[0].parameters)).toBe(true);
  });

  it("S1: real client rejects count/raw/bootstrap/Recall/binding corruption in actual Home responses", async () => {
    const h = workspace();
    const mutations: Array<(value: HomepageStoredCollection) => void> = [
      value => { Object.assign(value.receipt.counts, { executions: 999 }); },
      value => { value.tradeReadPages[0].snapshot.facts[0].quantity = "999"; },
      value => { value.bootstrap.executions[0].price = "999"; },
      value => { Object.assign(value, { recallSummaries: [{ episodeId: "poison", status: "in-progress", updatedAt: "2026-01-01", text: "poison", snapshotCount: 0 }] }); },
      value => { Object.assign(value.receipt, { payloadDigest: `sha256:${"0".repeat(64)}` }); },
    ];
    for (const mutate of mutations) {
      const client = createSqliteHttpClient(async (url, init) => {
        const response = await h.fetcher(url, init);
        const body = await response.json() as HomepageStoredCollection;
        mutate(body); return Response.json(body);
      });
      await expect(client.getHomepageSource()).rejects.toMatchObject({ code: "invalid-response" });
    }
  });

  it("S1: delays an already materialized real carrier while a later commit/read completes", async () => {
    const h = workspace();
    const initial = await h.client.getHomepageSource();
    const gate = h.faults.once({ operation: "getHomepageSource", ordinal: 2, parameters: {}, at: "afterInvokeBeforeDelivery", effect: "pause" });
    const late = h.client.getHomepageSource();
    await gate.reached;
    const observed = h.calls.journey.find(call => call.operation === "getHomepageSource" && call.ordinal === 2)!;
    expect(observed).toMatchObject({ invoked: true, delivered: false, status: 200 });
    const frozenPayload = JSON.stringify(observed.result);
    const write = await importOne(h, "new-after-old-read");
    const current = await h.client.getHomepageSource();
    expect(current.bookVersion).toEqual(write.receipt.bookVersion);
    expect(current.bookVersion.sequence).toBeGreaterThan(initial.bookVersion.sequence);
    expect(JSON.stringify(observed.result)).toBe(frozenPayload);
    gate.release();
    const old = await late;
    expect(old.bookVersion).toEqual(initial.bookVersion);
    expect(old).toStrictEqual(JSON.parse(frozenPayload));
    expect(old.receipt.payloadDigest).not.toBe(current.receipt.payloadDigest);
    expect(old.bootstrap.executions).toHaveLength(2);
    expect(current.bootstrap.executions).toHaveLength(3);
  });

  it("S2: prepare is read-only for facts, real receipts are idempotent, conflicting reuse and expired exact reads reject", async () => {
    const h = workspace();
    const old = await h.client.readTradeBook();
    const plan = await h.client.prepareTradeChanges({ kind: "import", candidates: [fact("planned-only", "buy", "2026-01-03")] });
    expect((await h.client.readTradeBook()).bookVersion).toEqual(old.bookVersion);
    expect((await h.client.readTradeBook()).executions).toHaveLength(2);
    const input = { requestId: "idempotent-request", planId: plan.planId, choices: {} };
    const receipt = await h.client.commitTradeChanges(input);
    expect(await h.client.commitTradeChanges(input)).toEqual(receipt);
    expect(await h.client.getTradeCommit(input.requestId)).toEqual(receipt);
    expect(await h.client.getTradeCommit("never-submitted")).toBeNull();
    await expect(h.client.commitTradeChanges({ ...input, planId: "different-plan" })).rejects.toMatchObject({ status: 409, code: "REQUEST_CONFLICT", category: "conflict" });
    const current = await h.client.readTradeBook({ pageSize: 1, version: { atLeast: receipt.bookVersion } });
    expect(current.executions).toHaveLength(3);
    expect(current.bookVersion).toEqual(receipt.bookVersion);
    await expect(h.client.readTradeBook({ version: { exact: old.bookVersion } })).rejects.toMatchObject({ status: 409, code: "BOOK_VERSION_CHANGED", phase: "book-version" });
    const rejected = h.calls.journey.find(call => call.operation === "commitTradeChanges" && call.ordinal === 3)!;
    expect(rejected).toMatchObject({ invoked: true, delivered: true, typedError: { code: "REQUEST_CONFLICT", category: "conflict" } });
  });

  it("S2: parameter-bound one-shot faults distinguish zero-write failure from saved response loss", async () => {
    const h = workspace();
    const old = await h.client.readTradeBook();
    const unmatched = h.faults.once({ operation: "getStatus", ordinal: 1, parameters: { wrongParameter: true }, at: "beforeInvoke", effect: { throw: new Error("must not match") } });
    let unmatchedReached = false; void unmatched.reached.then(() => { unmatchedReached = true; });
    expect((await h.client.getStatus()).counts.executions).toBe(2); expect(unmatchedReached).toBe(false);
    const plan = await h.client.prepareTradeChanges({ kind: "import", candidates: [fact("lost-response", "buy", "2026-01-03")] });
    const envelope = { requestId: "lost-request", planId: plan.planId, choices: {} };
    const original = structuredClone(envelope);
    const before = h.faults.once({ operation: "commitTradeChanges", ordinal: 1, parameters: original, at: "beforeInvoke", effect: { throw: new TypeError("before transport failure") } });
    await expect(h.client.commitTradeChanges(envelope)).rejects.toThrow("before transport failure");
    await before.reached;
    expect(await h.client.getTradeCommit(envelope.requestId)).toBeNull();
    expect((await h.client.readTradeBook()).bookVersion).toEqual(old.bookVersion);
    const after = h.faults.once({ operation: "commitTradeChanges", ordinal: 2, parameters: original, at: "afterInvokeBeforeDelivery", effect: { throw: new TypeError("response lost after commit") } });
    await expect(h.client.commitTradeChanges(envelope)).rejects.toThrow("response lost after commit");
    await after.reached;
    envelope.requestId = "caller-mutated-after-call";
    const recovered = await h.client.getTradeCommit(original.requestId);
    expect(recovered).toMatchObject({ planId: plan.planId });
    expect((await h.client.readTradeBook({ version: { atLeast: recovered!.bookVersion } })).executions).toHaveLength(3);
    expect(await h.client.commitTradeChanges(original)).toEqual(recovered);
    const commits = h.calls.journey.filter(call => call.operation === "commitTradeChanges");
    expect(commits[0]).toMatchObject({ invoked: false, delivered: false, transportError: { name: "TypeError", message: "before transport failure" } });
    expect(commits[1]).toMatchObject({ invoked: true, delivered: false, status: 200, result: { planId: plan.planId }, transportError: { name: "TypeError", message: "response lost after commit" } });
    expect(commits[1].parameters).toEqual(original);
    expect(commits[2]).toMatchObject({ invoked: true, delivered: true });
    expect(Object.isFrozen(commits[1].parameters)).toBe(true);
  });

  it("S3: name/settings/Recall round-trip without advancing BookVersion; a later import advances it", async () => {
    const h = workspace();
    const old = await h.client.readTradeBook();
    await h.client.putInstrumentName({ instrumentId: instrument.id, name: "User chosen name" });
    expect((await h.client.readTradeBook()).executions[0].instrument.name).toBe("User chosen name");
    await expect(h.client.putInstrumentName({ instrumentId: instrument.id, name: "" })).rejects.toMatchObject({ status: 400, category: "input" });
    expect((await h.client.getBootstrap()).instruments[0].name).toBe("User chosen name");
    const changedSettings = { ...settings, showVolume: false };
    expect(await h.client.putSettings(changedSettings)).toEqual(changedSettings);
    expect(await h.client.getSettings()).toEqual(changedSettings);
    const episode = buildTradeEpisodes(old.executions)[0];
    const saved = await h.recallRepository.save(createRecallDocument(episode));
    expect(await h.recallRepository.load(episode.id)).toEqual(saved);
    expect((await h.client.getHomepageSource()).bookVersion).toEqual(old.bookVersion);
    expect((await importOne(h, "real-following-import")).receipt.bookVersion.sequence).toBeGreaterThan(old.bookVersion.sequence);
  });

  it("S4: real CAS/finalization/revisions/summaries survive consumer reconstruction on the same memory database", async () => {
    const h = workspace();
    const book = await h.client.readTradeBook();
    const episode = buildTradeEpisodes(book.executions)[0];
    const draft = createRecallDocument(episode, "2026-01-03T00:00:00.000Z");
    const first = await h.recallRepository.save(draft, { expectedRevision: 0 });
    expect(first.revision).toBe(1);
    await expect(h.recallRepository.save(draft, { expectedRevision: 0 })).rejects.toMatchObject({ status: 409, code: "conflict" });
    let ready = first;
    for (const decision of first.decisions) ready = retainRecallSnapshot(ready, snapshot(decision.id, `snapshot-${decision.id}`));
    ready = retainRecallSnapshot(ready, snapshot("global", "global-snapshot"));
    const formal = await h.recallRepository.save(ready, { expectedRevision: 1, finalize: true });
    expect(formal).toMatchObject({ revision: 2, status: "completed", lastCompleted: { revision: 2, status: "completed" } });
    const edited = await h.recallRepository.save({ ...formal, working: { ...formal.working, cursor: "2026-01-05T00:00:00.000Z" } }, { expectedRevision: 2 });
    expect(edited.revision).toBe(3);
    expect(edited.lastCompleted).toEqual(formal.lastCompleted);
    const rebuilt = createRecallRepository(h.fetcher);
    expect(await rebuilt.load(episode.id)).toEqual(edited);
    const summaries = await fetchRecallReviewSummaries(h.fetcher);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ episodeId: episode.id, status: "completed", snapshotCount: 3 });
    const home = await h.client.getHomepageSource();
    expect(home.recallSummaries).toEqual(summaries);
    expect(home.receipt.counts.recallDocuments).toBe(1);
    expect(home.bookVersion).toEqual(book.bookVersion);
    expect(h.calls.journey.find(call => call.operation === "saveRecall" && call.ordinal === 2)).toMatchObject({ invoked: true, delivered: true, typedError: { code: "conflict" } });
  });

  it("seed Recall uses real writes/readback; separate harnesses own separate databases and disposal fails closed", async () => {
    const document = createRecallDocument(buildTradeEpisodes(pair)[0]);
    const h = createSqliteWorkspaceHarness({ tradeData: { executions: structuredClone(pair), instruments: [{ ...instrument }], importHistory: [] }, recall: [{ document, expectedRevision: 0 }] });
    owned.push(h);
    expect((await h.recallRepository.load(document.episodeId))?.revision).toBe(1);
    expect(h.calls.seed.slice(-2).map(call => call.operation)).toEqual(["seed.recall.write", "seed.recall.readback"]);
    const empty = workspace([]);
    expect((await empty.client.readTradeBook()).executions).toEqual([]);
    h.dispose();
    await expect(h.client.getStatus()).rejects.toThrow("disposed");
    expect((await empty.client.getStatus()).counts.executions).toBe(0);
  });

  it("S5 contract: exact poisoned business keys/IndexedDB/exporter stay untouched; old writes and unknown ports fail closed", async () => {
    const businessKeys = ["trade-reviewer:executions:v1", "trade-reviewer:import-history:v1", "trade-reviewer:chart-settings:v1", "trade-reviewer:market-data-jobs:v1", "trade-reviewer:review:v1:poison", "trade-reviewer:review:v2:poison", "trade-reviewer:sqlite-migration:client-id:v1"];
    const prefs = ["tradereview:shared-scope:v1:default", "tradereview:shared-scope:v2:default", "tradereview:homepage-v25:source-ui:v3", "tradereview:homepage-v25:source-ui:v2"];
    for (const storage of [localStorage, sessionStorage]) for (const key of [...businessKeys, ...prefs]) storage.setItem(key, `ui-owned-or-poison:${key}`);
    const originals = [localStorage, sessionStorage].map(storage => ({ storage, get: storage.getItem.bind(storage), set: storage.setItem.bind(storage), remove: storage.removeItem.bind(storage) }));
    const touched: string[] = [];
    const forbidden = (key: string) => businessKeys.includes(key) || key.startsWith("trade-reviewer:review:v1:") || key.startsWith("trade-reviewer:review:v2:");
    for (const original of originals) {
      vi.spyOn(original.storage, "getItem").mockImplementation(key => { touched.push(key); if (forbidden(key)) throw new Error(`business read ${key}`); return original.get(key); });
      vi.spyOn(original.storage, "setItem").mockImplementation((key, value) => { touched.push(key); if (forbidden(key)) throw new Error(`business write ${key}`); return original.set(key, value); });
      vi.spyOn(original.storage, "removeItem").mockImplementation(key => { touched.push(key); if (forbidden(key)) throw new Error(`business remove ${key}`); return original.remove(key); });
      vi.spyOn(original.storage, "clear").mockImplementation(() => { throw new Error("browser clear forbidden"); });
    }
    const indexedOpen = vi.fn(() => { throw new Error("IndexedDB forbidden"); });
    vi.stubGlobal("indexedDB", { open: indexedOpen });
    const exporter = vi.spyOn(browserExport, "exportLegacyBrowserState");
    const h = workspace();
    await h.client.getStatus(); await h.client.getBootstrap(); await h.client.getHomepageSource(); await h.client.readTradeBook({ pageSize: 1 });
    await h.client.putInstrumentName({ instrumentId: instrument.id, name: "SQLite only" });
    await h.client.putSettings({ ...settings, showVolume: false }); await h.client.getSettings();
    const write = await importOne(h, "sqlite-only-write"); await h.client.getTradeCommit(write.envelope.requestId);
    const doc = createRecallDocument(buildTradeEpisodes(pair)[0]); await h.recallRepository.save(doc); await h.recallRepository.load(doc.episodeId); await fetchRecallReviewSummaries(h.fetcher);
    await expect(h.client.mergeExecutions({ executions: [fact("legacy-poison", "buy", "2026-01-04")] })).rejects.toThrow("Unsupported workspace operation");
    await expect(h.fetcher("/api/storage/migrate", { method: "POST", body: "{}" })).rejects.toThrow("Unsupported workspace operation");
    await expect(h.fetcher("/api/storage/not-implemented")).rejects.toThrow("Unsupported workspace operation");
    expect((await h.client.readTradeBook()).executions.map(row => row.id)).not.toContain("legacy-poison");
    expect(h.calls.journey.filter(call => call.operation.startsWith("unsupported:")).every(call => !call.invoked && !call.delivered)).toBe(true);
    expect(touched).toEqual([]); expect(indexedOpen).not.toHaveBeenCalled(); expect(exporter).not.toHaveBeenCalled();
    for (const original of originals) for (const key of prefs) expect(original.get(key)).toBe(`ui-owned-or-poison:${key}`);
  });
});
