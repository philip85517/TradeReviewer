import { webcrypto } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StatementParseResult } from "../import/contracts";
import type { EnrichedImportResult } from "../import/enrich-import";
import type { DemoReplayFrame } from "../demo/replay-frame";
import type { TradeBookRead } from "./trade-read-contract";
import type { HomepageStoredCollection } from "./homepage-source-contract";
import type { CommitReceipt, ReviewPlan, TradeChangeCommit } from "./sqlite-contracts";
import type { SyncMarketDataOptions } from "../market/sync-service";
import type { DailyCandleRecord, ProviderMarketCandle } from "../market/contracts";
import { ApiMarketDataRepository } from "./sqlite-repositories";
import { createSqliteWorkspaceHarness } from "../../components/test-support/sqlite-workspace-harness";
import { createHomepageState, encodeHomepageSnapshot, readHomepageSnapshot } from "../reviews/homepage-v25-state";
import { normalizeSharedScope, DEFAULT_SHARED_SCOPE, type SharedScope } from "../reviews/shared-scope";
import { emptyFxState, toRoomFxSnapshot } from "../fx/room-contracts";
import type { FxReadResponse } from "../fx/contracts";
import type { ReferenceCapitalState } from "../principal/reference-capital-model";
import { createCashClient, CashClientError } from "../cash/cash-client";
import type { TradeExecution } from "../trades/types";
import { TradeReviewWorkspace } from "../../components/trade-review-workspace";
import { parseStoredReviewState } from "./review-storage-parser";
import type { EpisodeReviewState } from "./review-storage-parser";
import { createActiveAliasLoader } from "./migration-browser-alias";
import { createTradingViewAccountMigrationClient, type TradingViewAccountMigrationAlias } from "./tradingview-account-migration-client";

const { mockDispatcher, mockEnrichment, mockMarketDataSync } = vi.hoisted(
  () => ({
    mockDispatcher: vi.fn(),
    mockEnrichment: vi.fn(),
    mockMarketDataSync: vi.fn(),
  }),
);

const recallBridge = vi.hoisted(() => ({
  target: null as ReturnType<typeof import("../recall/repository").createRecallRepository> | null,
  pending: new Set<Promise<unknown>>(),
}));

vi.mock("../recall/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../recall/repository")>();
  const current = () => {
    if (!recallBridge.target) throw new Error("Recall consumer has no active owned workspace");
    return recallBridge.target;
  };
  const track = <T,>(promise: Promise<T>) => {
    recallBridge.pending.add(promise);
    void promise.then(() => recallBridge.pending.delete(promise), () => recallBridge.pending.delete(promise));
    return promise;
  };
  return {
    ...actual,
    // The module-level UI consumer captures this delegate; each call resolves the current owner.
    createRecallRepository: (fetcher?: Parameters<typeof actual.createRecallRepository>[0]) => fetcher !== undefined
      ? actual.createRecallRepository(fetcher)
      : {
          load: (...args: Parameters<ReturnType<typeof actual.createRecallRepository>["load"]>) => track(current().load(...args)),
          fetch: (...args: Parameters<ReturnType<typeof actual.createRecallRepository>["fetch"]>) => track(current().fetch(...args)),
          save: (...args: Parameters<ReturnType<typeof actual.createRecallRepository>["save"]>) => track(current().save(...args)),
        },
  };
});

vi.mock("../import/dispatcher", () => ({
  parseBrokerStatement: mockDispatcher,
}));

vi.mock("../import/enrich-import", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../import/enrich-import")>()),
  enrichStatementImport: mockEnrichment,
}));

vi.mock("../market/sync-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../market/sync-service")>()),
  syncMarketData: mockMarketDataSync,
}));

const root = process.cwd();
const workspacePath = join(root, "app/components/trade-review-workspace.tsx");
const exporterPath = join(root, "app/lib/storage/browser-state-export.ts");
const legacyStoragePaths = [
  "chart-settings.ts",
  "import-history.ts",
  "import-library.ts",
  "import-transaction.ts",
  "market-data-jobs.ts",
  "review-storage.ts",
  "indexeddb-schema.ts",
  "indexeddb-episode-review-repository.ts",
  "indexeddb-instrument-metadata-repository.ts",
  "indexeddb-market-data-repository.ts",
  "indexeddb-suggestion-decision.ts",
  "indexeddb-tag-suggestion-repository.ts",
];

const initialFrame: DemoReplayFrame = {
  cursorIndex: 0,
  cursor: "2026-01-01T00:00:00.000Z",
  candles15m: [],
  executions: [],
  canGoBack: false,
  canGoForward: false,
};

const importedExecution: TradeExecution = {
  id: "boundary:trade:1",
  source: { platform: "china-merchants", page: 1, row: 1, tradeNature: "live" },
  accountId: "boundary-account",
  accountLabel: "边界测试账户",
  instrument: {
    id: "CN-SH:600938",
    symbol: "600938",
    name: "中国海油",
    market: "CN-SH",
    currency: "CNY",
  },
  side: "buy",
  executedAt: "2026-01-02T02:00:00.000Z",
  quantity: "100",
  price: "15.20",
  fee: "5",
};

const importParseResult: StatementParseResult = {
  broker: "china-merchants",
  records: [importedExecution],
  candidates: [{ market: "CN-SH", symbol: "600938", sourceAssetType: "stock" }],
  exclusions: [],
  diagnostics: [],
  blocked: false,
};

const enrichedImport: EnrichedImportResult = {
  broker: "china-merchants",
  importable: [importedExecution],
  unresolved: [],
  exclusions: [],
  diagnostics: [],
  cacheHits: 0,
};

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "test-support" ? [] : productionSourceFiles(path);
    }
    return /(?<!\.test)\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function importStatements(source: string) {
  const statements: string[] = [];
  const starts = source.matchAll(/^import\b/gm);
  for (const startMatch of starts) {
    const start = startMatch.index;
    if (start === undefined) continue;
    const end = source.indexOf(";", start);
    if (end === -1) throw new Error(`Unterminated import statement at offset ${start}`);
    statements.push(source.slice(start, end + 1));
  }
  return statements;
}

function allowsPureImportLibraryImport(statement: string) {
  if (!statement.includes("import-library")) return true;
  if (/^import\s+type\b/.test(statement)) return true;
  const named = statement.match(/import\s*\{([\s\S]*?)\}\s*from\s*["'][^"']*import-library["'];/);
  if (!named) return false;
  return named[1]
    .split(",")
    .map((specifier) => specifier.trim().split(/\s+as\s+/)[0])
    .filter(Boolean)
    .every((specifier) => specifier === "mergeExecutions");
}

type OwnedWorkspace = ReturnType<typeof createSqliteWorkspaceHarness>;
type BrowserAttempt = { storage: "local" | "session"; method: string; key?: string; value?: string; allowed: boolean };
type ExternalAttempt = { path: string; method: string; query: [string, string][]; status?: number; result?: unknown; error?: string };
const scopeV1 = "tradereview:shared-scope:v1:default";
const scopeV2 = "tradereview:shared-scope:v2:default";
const homeV2 = "tradereview:homepage-v25:source-ui:v2";
const homeV3 = "tradereview:homepage-v25:source-ui:v3";
const poisonKeys = [
  "trade-reviewer:executions:v1", "trade-reviewer:import-history:v1", "trade-reviewer:market-data-jobs:v1",
  "trade-reviewer:chart-settings:v1", "trade-reviewer:review:v1:boundary", "trade-reviewer:review:v2:boundary",
  "trade-reviewer:sqlite-migration:client-id:v1", "trade-reviewer:sqlite-migration:complete:v1",
];
const fetchedAt = "2026-01-03T08:00:00.000Z";
const dailyCandle: DailyCandleRecord = {
  instrumentId: importedExecution.instrument.id, tradingDate: "2026-01-02", open: "15.20", high: "15.60", low: "15.10", close: "15.40",
  volume: "10000", currency: "CNY", provider: "tencent", providerSymbol: "sh600938", adjustmentMode: "raw", fetchedAt,
};
type StorageJourney = {
  h: ReturnType<typeof createSqliteWorkspaceHarness>;
  browser: ReturnType<typeof installStorageBoundary>;
  external: ReturnType<typeof installExternalBoundary>;
  indexedDbOpen: () => never;
  exporter: () => Promise<never>;
  native?: ReturnType<typeof installNativeBrowserStorage>;
  expectedScope: SharedScope;
};
const activeJourneys: StorageJourney[] = [];

function persistedBook(book: TradeBookRead) {
  return { bookVersion: book.bookVersion, facts: book.facts, executions: book.executions, instruments: book.instruments, importHistory: book.importHistory,
    snapshots: book.pages.map(({ snapshot: { receipt: _receipt, ...snapshot } }) => snapshot) };
}
function homepagePreference(query: string, legacy: boolean) {
  const snapshot = createHomepageState({ live: true, market: "all", accounts: ["*"], rangeMode: "all" }).snapshot;
  snapshot.holdings = { ...snapshot.holdings, query };
  return legacy ? JSON.stringify({ ...snapshot, version: 2, attachments: { categories: [], openOnly: false, pendingReview: false } }) : encodeHomepageSnapshot(snapshot);
}
function installNativeBrowserStorage() {
  // A separate realm retains actual Web Storage despite the shared Map-based test setup.
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  const owner = frame.contentWindow as Window & typeof globalThis;
  const stores = [["local", owner.localStorage], ["session", owner.sessionStorage]] as const;
  const prototype = Object.getPrototypeOf(owner.localStorage);
  const descriptors = Object.getOwnPropertyDescriptors(prototype);
  const clear = stores.map(([, storage]) => storage.clear.bind(storage));
  const restoreGlobals: (() => void)[] = [];
  for (const target of new Set([globalThis, window])) {
    for (const property of ["localStorage", "sessionStorage"] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(target, property)!;
      Object.defineProperty(target, property, { configurable: true, value: owner[property] });
      restoreGlobals.push(() => Object.defineProperty(target, property, descriptor));
    }
  }
  return {
    stores,
    Storage: owner.Storage,
    restore() {
      Object.defineProperties(prototype, descriptors);
      clear.forEach(empty => empty());
      restoreGlobals.reverse().forEach(restore => restore());
      frame.remove();
    },
  };
}
type AliasReviewFixture = { aliases: readonly TradingViewAccountMigrationAlias[]; values: Readonly<Record<string, string>> };
function installStorageBoundary(homeBytes: string, legacy: boolean, reviews?: AliasReviewFixture) {
  const attempts: BrowserAttempt[] = [];
  const owners = [["local", localStorage], ["session", sessionStorage]] as const;
  const restoration: (() => void)[] = [];
  const raw = owners.map(([name, storage]) => ({ name, storage, get: storage.getItem.bind(storage), set: storage.setItem.bind(storage), clear: storage.clear.bind(storage) }));
  for (const entry of raw) {
    entry.clear();
    for (const key of poisonKeys) entry.set(key, `poison:${entry.name}:${key}`);
  }
  raw[0].set(scopeV1, JSON.stringify(DEFAULT_SHARED_SCOPE));
  raw[1].set(legacy ? homeV2 : homeV3, homeBytes);
  const readKeys = { local: new Set([scopeV1, scopeV2]), session: new Set([homeV2, homeV3]) };
  // The only compatibility exception is an exact key proved by active episode aliases.
  for (const alias of reviews?.aliases ?? []) if (alias.kind === "episode") {
    for (const id of [alias.oldId, alias.newId]) for (const version of [1, 2]) readKeys.local.add(`trade-reviewer:review:v${version}:${id}`);
  }
  for (const [key, value] of Object.entries(reviews?.values ?? {})) {
    if (!readKeys.local.has(key) || poisonKeys.includes(key)) throw new Error(`Uncovered review fixture: ${key}`);
    raw[0].set(key, value);
  }
  const targets = new Set(owners.map(([, storage]) => Object.hasOwn(storage, "getItem") ? storage : Object.getPrototypeOf(storage)));
  for (const target of targets) {
    for (const method of ["getItem", "setItem", "removeItem", "clear", "key"] as const) {
      const original = Object.getOwnPropertyDescriptor(target, method)!;
      const originalMethod = original.value as (...args: unknown[]) => unknown;
      Object.defineProperty(target, method, { ...original, value: function(this: Storage, ...args: unknown[]) {
        const name = owners.find(([, storage]) => storage === this)?.[0];
        if (!name) return originalMethod.apply(this, args);
        const key = args[0] === undefined ? undefined : String(args[0]), value = args[1] === undefined ? undefined : String(args[1]);
        let allowed = method === "getItem" && key !== undefined && readKeys[name].has(key);
        if (method === "setItem" && value !== undefined) {
          if (name === "local" && key === scopeV2) {
            try { const parsed: unknown = JSON.parse(value); allowed = JSON.stringify(normalizeSharedScope(parsed)) === JSON.stringify(parsed); } catch { allowed = false; }
          }
          if (name === "session" && key === homeV3) {
            const parsed = readHomepageSnapshot(value);
            allowed = parsed.ok && JSON.stringify(JSON.parse(encodeHomepageSnapshot(parsed.snapshot))) === JSON.stringify(JSON.parse(value));
          }
        }
        attempts.push({ storage: name, method, key, value, allowed });
        if (!allowed) throw new Error(`Forbidden browser storage operation: ${name}.${method} ${key ?? ""}`);
        return originalMethod.apply(this, args);
      } });
      restoration.push(() => Object.defineProperty(target, method, original));
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(target, "length")!;
    Object.defineProperty(target, "length", { ...lengthDescriptor, get(this: Storage) {
      const name = owners.find(([, storage]) => storage === this)?.[0];
      if (name) {
        attempts.push({ storage: name, method: "length", allowed: false });
        throw new Error(`Forbidden browser storage operation: ${name}.length`);
      }
      return lengthDescriptor.get!.call(this);
    } });
    restoration.push(() => Object.defineProperty(target, "length", lengthDescriptor));
  }
  return {
    attempts,
    readLocal: raw[0].get, readSession: raw[1].get,
    assertIntact(expectedScope: SharedScope = DEFAULT_SHARED_SCOPE) {
      expect(attempts.filter(attempt => !attempt.allowed)).toEqual([]);
      for (const entry of raw) for (const key of poisonKeys) expect(entry.get(key)).toBe(`poison:${entry.name}:${key}`);
      for (const [key, value] of Object.entries(reviews?.values ?? {})) expect(raw[0].get(key)).toBe(value);
      expect(raw[0].get(scopeV1)).toBe(JSON.stringify(DEFAULT_SHARED_SCOPE));
      if (legacy) expect(raw[1].get(homeV2)).toBe(homeBytes);
      expect(attempts.some(attempt => attempt.storage === "local" && attempt.method === "getItem" && attempt.key === scopeV1)).toBe(true);
      expect(attempts.some(attempt => attempt.storage === "session" && attempt.method === "getItem" && attempt.key === (legacy ? homeV2 : homeV3))).toBe(true);
      expect(raw[0].get(scopeV2)).toBe(JSON.stringify(expectedScope));
    },
    restore() { restoration.reverse().forEach(restore => restore()); raw.forEach(entry => entry.clear()); },
  };
}
function syntheticIntraday(interval: "1h" | "15m", start: string, end: string): ProviderMarketCandle[] {
  return ["01:30", "02:30", "05:00", "06:00"].map(time => {
    const timestamp = `2026-01-02T${time}:00.000Z`;
    return { timestamp, knowledgeAt: new Date(Date.parse(timestamp) + (interval === "1h" ? 3600000 : 900000)).toISOString(), open: "15.20", high: "15.60", low: "15.10", close: "15.40", volume: "1000" };
  }).filter(candle => candle.timestamp >= start && candle.timestamp <= end);
}
function installExternalBoundary(h: OwnedWorkspace) {
  const attempts: ExternalAttempt[] = [], pending = new Set<Promise<unknown>>();
  const router: typeof fetch = (input, init) => {
    const task = (async () => {
      const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(address, "http://workspace.invalid");
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (url.pathname.startsWith("/api/storage/")) return h.fetcher(url.pathname + url.search, init);
      const attempt: ExternalAttempt = { path: url.pathname, method, query: [...url.searchParams] }; attempts.push(attempt);
      const deliver = (result: unknown, status = 200) => { attempt.result = structuredClone(result); attempt.status = status; return Response.json(result, { status, headers: { "cache-control": "no-store" } }); };
      try {
        if (method !== "GET") throw new Error("Unsupported external method");
        if (url.pathname === "/api/trading-room/fx" && url.searchParams.size === 0) return deliver(emptyFxState());
        // Settings/library reads have no seeded capital or FX snapshot in these storage journeys.
        if (url.pathname === "/api/trading-room/reference-capital" && url.searchParams.size === 0) return deliver({ version: 2, records: [] } satisfies ReferenceCapitalState);
        if (url.pathname === "/api/fx" && url.searchParams.size === 0) return deliver({ snapshot: null } satisfies FxReadResponse);
        // The simulated library requests principal, which is explicitly unavailable in this storage-only acceptance.
        if (url.pathname === "/api/trading-room/account-principal" && url.searchParams.size === 1 && url.searchParams.getAll("accountId").length === 1 && url.searchParams.get("accountId") === "tradingview:simulation:default") {
          return deliver({ error: { code: "storage-unavailable", message: "SBUI account principal unavailable" } }, 503);
        }
        if (url.pathname === "/api/trading-room/cash" || url.pathname === "/api/trading-room/cash/baselines") {
          const allowed = new Set(url.pathname.endsWith("baselines") ? ["nature", "accountId", "simulationRunId"] : ["nature", "accountId", "simulationRunId", "targetCurrency", "today"]);
          if ([...url.searchParams.keys()].some(key => !allowed.has(key) || (key !== "accountId" && url.searchParams.getAll(key).length > 1))) throw new Error("Unsupported cash query");
          if (url.searchParams.get("nature") !== "live" || url.searchParams.has("simulationRunId") || url.searchParams.getAll("accountId").some(id => id !== importedExecution.accountId)) throw new Error("Unsupported cash scope");
          if (url.searchParams.has("targetCurrency") && !["CNY", "HKD"].includes(url.searchParams.get("targetCurrency")!)) throw new Error("Unsupported cash currency");
          if (url.searchParams.has("today") && !/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("today")!)) throw new Error("Unsupported cash date");
          return deliver({ error: { code: "storage-unavailable", message: "SBUI cash read unavailable" } }, 503);
        }
        if (url.pathname === "/api/market-data/intraday") {
          const expected = ["market", "symbol", "interval", "start", "end"];
          if (url.searchParams.size !== expected.length || expected.some(key => url.searchParams.getAll(key).length !== 1)) throw new Error("Unsupported intraday query");
          const interval = url.searchParams.get("interval"), start = url.searchParams.get("start")!, end = url.searchParams.get("end")!;
          if (url.searchParams.get("market") !== "CN-SH" || url.searchParams.get("symbol") !== "600938" || (interval !== "1h" && interval !== "15m") || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || start > end) throw new Error("Unsupported intraday fixture request");
          return deliver({ provider: "tencent", providerSymbol: "sh600938", fetchedAt, interval, adjustmentMode: "raw", candles: syntheticIntraday(interval, start, end), warnings: ["provider-history-limit"], request: { instrumentId: importedExecution.instrument.id, symbol: "600938", market: "CN-SH", interval, startTime: start, endTime: end } });
        }
        throw new Error("Unsupported external endpoint");
      } catch (error) { attempt.error = error instanceof Error ? error.message : String(error); throw error; }
    })();
    pending.add(task); void task.then(() => pending.delete(task), () => pending.delete(task)); return task;
  };
  vi.stubGlobal("fetch", router);
  return { attempts, pending, router };
}
function startJourney(name: string, legacyHome = false, query = "", options: { workspace?: OwnedWorkspace; native?: boolean; reviews?: AliasReviewFixture } = {}): StorageJourney {
  vi.stubGlobal("crypto", webcrypto);
  history.replaceState(null, "", "/home");
  const h = options.workspace ?? createSqliteWorkspaceHarness({ migratedEmpty: { sourceClientId: `sbui:${name}`, sourceFingerprint: `sbui:${name}:empty` } });
  const native = options.native ? installNativeBrowserStorage() : undefined;
  const browser = installStorageBoundary(homepagePreference(query, legacyHome), legacyHome, options.reviews);
  const external = installExternalBoundary(h);
  const indexedDbOpen = vi.fn(() => { throw new Error("Legacy IndexedDB access is forbidden"); });
  const exporter = vi.fn(async () => { throw new Error("Legacy browser export is forbidden after migration"); });
  vi.stubGlobal("indexedDB", { open: indexedDbOpen });
  recallBridge.target = h.recallRepository;
  const journey = { h, browser, external, indexedDbOpen, exporter, native, expectedScope: DEFAULT_SHARED_SCOPE };
  activeJourneys.push(journey);
  return journey;
}
function mountJourney(journey: ReturnType<typeof startJourney>) {
  return render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} storageClient={journey.h.client} legacyStateExporter={journey.exporter} activeAliasLoader={createActiveAliasLoader(journey.h.fetcher)} />);
}
async function settle(journey: ReturnType<typeof startJourney>) {
  // Let the production unmount save queue enter the tracked repository before checking it.
  await Promise.resolve();
  await waitFor(() => {
    expect(recallBridge.pending.size).toBe(0);
    expect(journey.external.pending.size).toBe(0);
    expect(journey.h.calls.journey.filter(call => call.invoked && !call.delivered && !call.transportError)).toEqual([]);
  }, { timeout: 15000 });
}
function assertBoundary(journey: ReturnType<typeof startJourney>) {
  journey.browser.assertIntact(journey.expectedScope);
  expect(journey.indexedDbOpen).not.toHaveBeenCalled();
  expect(journey.exporter).not.toHaveBeenCalled();
  expect(journey.external.attempts.filter(call => call.error)).toEqual([]);
  expect(journey.external.attempts.filter(call => call.path === "/api/trading-room/fx").map(call => call.result)).toEqual(expect.arrayContaining([emptyFxState()]));
  expect(toRoomFxSnapshot(emptyFxState())).toBeUndefined();
  expect(journey.h.calls.journey.filter(call => call.transportError || (call.typedError && !(call.operation === "loadRecall" && call.status === 404)))).toEqual([]);
}
async function observeCashFailure(journey: ReturnType<typeof startJourney>, user: ReturnType<typeof userEvent.setup>) {
  await expect(createCashClient(journey.external.router).readSummary({ nature: "live", simulationRunId: null })).rejects.toBeInstanceOf(CashClientError);
  await expect(createCashClient(journey.external.router).readBaselines({ nature: "live" })).rejects.toMatchObject({ status: 503, code: "storage-unavailable" });
  await user.click(await screen.findByRole("button", { name: "设置" }));
  expect(await screen.findByText("SBUI cash read unavailable")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "我的交易室" }));
  expect(journey.external.attempts.filter(call => call.path.startsWith("/api/trading-room/cash")).every(call => call.status === 503 && !call.error)).toBe(true);
}
async function openFirstEpisode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "交易库" }));
  await user.click(await screen.findByRole("tab", { name: "按标的浏览" }));
  await user.click(await screen.findByRole("button", { name: "展开中国海油交易回合" }));
  await user.click(await screen.findByRole("button", { name: /打开中国海油第1次交易/ }));
  return screen.findByRole("button", { name: "图表设置" }, { timeout: 15000 });
}
async function assertVolume(journey: ReturnType<typeof startJourney>, user: ReturnType<typeof userEvent.setup>, expected: boolean) {
  await user.click(await screen.findByRole("button", { name: "图表设置" }));
  const checkbox = screen.getByRole("checkbox", { name: "显示成交量" });
  expect(checkbox).toHaveProperty("checked", expected);
  expect(await journey.h.client.getSettings()).toMatchObject({ version: 1, showVolume: expected });
  await user.click(screen.getByRole("button", { name: "图表设置" }));
}

function aliasReview(episodeId: string, name: string): EpisodeReviewState {
  return {
    version: 2, episodeId, replayCursor: "2026-01-02T01:59:59.999Z", timeframe: "1D", activePanelTab: "stats",
    drawings: [{ version: 2, id: `drawing:${name}`, episodeId, tool: "horizontal-line", name,
      anchors: [{ time: "2026-01-02T00:00:00.000Z", price: 15.2 }],
      style: { color: "#f3ba2f", lineWidth: 1, opacity: 1 }, hidden: false, locked: false,
      visibleOn: "all", stage: "pre-trade", createdAtCursor: "2026-01-02T01:59:59.999Z", zIndex: 0 }],
  };
}
async function startAliasJourney(mode: "conflict" | "browser" | "sqlite", versions: readonly [1 | 2, 1 | 2] = [2, 2]) {
  vi.stubGlobal("crypto", webcrypto);
  const pair = (["buy", "sell"] as const).map((side, index): TradeExecution => ({
    ...importedExecution, id: `alias-${side}`, side, accountId: "old-alias-account", accountLabel: "旧模拟账户",
    executedAt: `2026-01-02T0${index ? 6 : 2}:00:00.000Z`,
    source: { platform: "tradingview", row: 7 + index, fileFingerprint: "alias-fixture", timePrecision: "date-only",
      sourceTimezone: "Asia/Shanghai", feeStatus: "reported", tradeNature: "simulation", simulationRunId: "alias-run",
      sourceTradeId: "alias-pair", simulationRole: side === "buy" ? "entry" : "exit" },
  }));
  // Explicit preparation uses real Store preview/commit; these seed operations are not HTTP journeys.
  const h = createSqliteWorkspaceHarness({ priorEmptyMigration: { sourceClientId: "native-alias", sourceFingerprint: "native-alias-empty" }, tradeData: { executions: pair, instruments: [importedExecution.instrument], importHistory: [] }, committedAccountMigration: { operationId: "native-alias-seed" } });
  try {
    const { aliases } = await createTradingViewAccountMigrationClient(h.fetcher).getActiveAliases();
    const episode = aliases.find(alias => alias.kind === "episode")!;
    expect(episode).toBeDefined();
    expect(episode.oldId).not.toBe(episode.newId);
    expect(aliases).toContainEqual({ operationId: "native-alias-seed", kind: "account", oldId: "old-alias-account", newId: "tradingview:simulation:default" });
    const oldKey = `trade-reviewer:review:v${versions[0]}:${episode.oldId}`, canonicalKey = `trade-reviewer:review:v${versions[1]}:${episode.newId}`;
    const bytes = (id: string, name: string, version: 1 | 2) => JSON.stringify(version === 1
      ? { version: 1, replayCursor: "2026-01-02T01:59:59.999Z", timeframe: "1D", thesis: name, drawings: [] }
      : aliasReview(id, name));
    const values: Record<string, string> = { [oldKey]: bytes(episode.oldId, "旧别名标注", versions[0]) };
    if (mode !== "browser") values[canonicalKey] = bytes(episode.newId, "浏览器另一个标注", versions[1]);
    if (mode === "sqlite") await h.client.putReviewState(aliasReview(episode.newId, "SQLite权威标注"));
    await new ApiMarketDataRepository(h.client).commitSyncResult({ instrumentId: importedExecution.instrument.id, candles: [dailyCandle], providerSymbol: { provider: "tencent", symbol: "sh600938" }, coverage: [] });
    const journey = startJourney(`native-alias-${mode}`, false, "", { workspace: h, native: true, reviews: { aliases, values } });
    for (const [, storage] of journey.native!.stores) expect(storage).toBeInstanceOf(journey.native!.Storage);
    return { journey, episode, oldKey, canonicalKey };
  } catch (error) { h.dispose(); throw error; }
}
async function openAliasEpisode(journey: StorageJourney, user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "交易库" }));
  const nature = await screen.findByRole("combobox", { name: "交易性质" });
  const selectedNature = nature instanceof window.HTMLSelectElement ? nature.value : null;
  if (selectedNature === null) throw new Error("交易性质 must be a select control");
  if (selectedNature !== "simulation") {
    await user.selectOptions(nature, "simulation");
    journey.expectedScope = { ...DEFAULT_SHARED_SCOPE, nature: "simulation" };
  }
  await user.click(await screen.findByRole("tab", { name: "按标的浏览" }));
  await user.click(await screen.findByRole("button", { name: "展开中国海油交易回合" }));
  await user.click(await screen.findByRole("button", { name: /打开中国海油第1次交易/ }));
  await screen.findByRole("button", { name: "图表设置" }, { timeout: 15000 });
}

describe("SQLite production storage boundary", () => {
  afterEach(async () => {
    cleanup();
    try {
      for (const journey of activeJourneys) {
        await settle(journey);
        assertBoundary(journey);
      }
    } finally {
      recallBridge.target = null;
      for (const journey of activeJourneys.splice(0)) { journey.h.dispose(); journey.browser.restore(); journey.native?.restore(); }
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      history.replaceState(null, "", "/home");
      mockDispatcher.mockReset();
      mockEnrichment.mockReset();
      mockMarketDataSync.mockReset();
    }
  });

  it.each([[1, 2], [2, 1]] as const)("keeps cross-format v%s/v%s browser conflicts visible and read-only after remount", async (oldVersion, canonicalVersion) => {
    const user = userEvent.setup();
    const { journey, oldKey, canonicalKey } = await startAliasJourney("conflict", [oldVersion, canonicalVersion]);
    mountJourney(journey);
    const alert = await screen.findByRole("alert", { name: "浏览器复盘恢复冲突" });
    expect(alert).toHaveTextContent("不同来源的浏览器复盘内容不同");
    expect(alert).toHaveTextContent(oldKey);
    expect(alert).toHaveTextContent(canonicalKey);
    await openAliasEpisode(journey, user);
    await user.click(screen.getByRole("button", { name: "返回交易库" }));
    cleanup(); await settle(journey);
    expect((await journey.h.client.getBootstrap()).reviewStates).toEqual([]);
    expect(journey.h.calls.journey.filter(call => call.operation === "putReviewState")).toEqual([]);
    mountJourney(journey);
    expect(await screen.findByRole("alert", { name: "浏览器复盘恢复冲突" })).toHaveTextContent(oldKey);
    expect((await journey.h.client.getBootstrap()).reviewStates).toEqual([]);
    assertBoundary(journey);
  }, 60000);

  it("shows unresolved browser review source keys without choosing a winner under native storage guards", async () => {
    const user = userEvent.setup();
    const { journey, episode, oldKey, canonicalKey } = await startAliasJourney("conflict");
    mountJourney(journey);
    const alert = await screen.findByRole("alert", { name: "浏览器复盘恢复冲突" });
    expect(alert).toHaveTextContent("已暂停自动恢复");
    expect(alert).toHaveTextContent("所有原始内容均已保留");
    expect(alert).toHaveTextContent(oldKey);
    expect(alert).toHaveTextContent(canonicalKey);
    expect((await journey.h.client.getBootstrap()).reviewStates).toEqual([]);
    await openAliasEpisode(journey, user);
    // Merely viewing a conflicted episode or changing chart UI must not create authority.
    await user.click(screen.getByRole("button", { name: "图表设置" }));
    await user.click(screen.getByRole("checkbox", { name: "显示成交量" }));
    await user.click(screen.getByRole("button", { name: "图表设置" }));
    await user.click(screen.getByRole("button", { name: "返回交易库" }));
    await user.click(screen.getByRole("button", { name: "我的交易室" }));
    cleanup(); await settle(journey);
    expect((await journey.h.client.getBootstrap()).reviewStates).toEqual([]);
    expect(journey.h.calls.journey.filter(call => call.operation === "putReviewState" && (call.parameters as EpisodeReviewState).episodeId === episode.newId)).toEqual([]);
    mountJourney(journey);
    expect(await screen.findByRole("alert", { name: "浏览器复盘恢复冲突" })).toHaveTextContent(oldKey);
    await openAliasEpisode(journey, user);
    expect(screen.getByRole("alert", { name: "浏览器复盘恢复冲突" })).toHaveTextContent(canonicalKey);
    expect((await journey.h.client.getBootstrap()).reviewStates).toEqual([]);
    assertBoundary(journey);
  }, 60000);

  it.each([["browser", 2, 2], ["sqlite", 2, 2], ["sqlite", 1, 2], ["sqlite", 2, 1]] as const)("restores %s review across v%s/v%s through real aliases and native guards after return and remount", async (mode, oldVersion, canonicalVersion) => {
    const user = userEvent.setup();
    const { journey, episode, oldKey } = await startAliasJourney(mode, [oldVersion, canonicalVersion]);
    const name = mode === "browser" ? "旧别名标注" : "SQLite权威标注";
    mountJourney(journey);
    await openAliasEpisode(journey, user);
    expect(screen.queryByRole("alert", { name: "浏览器复盘恢复冲突" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "图层" }));
    expect(await screen.findByRole("textbox", { name: `重命名${name}` })).toHaveValue(name);
    expect(screen.queryByRole("textbox", { name: "重命名浏览器另一个标注" })).toBeNull();
    await waitFor(async () => expect((await journey.h.client.getBootstrap()).reviewStates).toContainEqual(expect.objectContaining({ episodeId: episode.newId, drawings: [expect.objectContaining({ name, episodeId: episode.newId })] })));
    await user.click(screen.getByRole("button", { name: "返回交易库" }));
    await user.click(await screen.findByRole("button", { name: /打开中国海油第1次交易/ }));
    await user.click(await screen.findByRole("button", { name: "图层" }));
    expect(await screen.findByRole("textbox", { name: `重命名${name}` })).toHaveValue(name);
    cleanup(); await settle(journey);
    mountJourney(journey);
    await openAliasEpisode(journey, user);
    await user.click(screen.getByRole("button", { name: "图层" }));
    expect(await screen.findByRole("textbox", { name: `重命名${name}` })).toHaveValue(name);
    expect(screen.queryByRole("alert", { name: "浏览器复盘恢复冲突" })).toBeNull();
    expect(journey.h.calls.seed.filter(call => call.operation.startsWith("seed.accountMigration.")).map(call => call.operation)).toEqual(["seed.accountMigration.preview", "seed.accountMigration.commit", "seed.accountMigration.aliasReadback"]);
    expect(journey.h.calls.journey.filter(call => call.operation === "getMigrationAliases" && call.delivered).length).toBeGreaterThanOrEqual(3);
    expect(journey.browser.readLocal(oldKey)).toContain("旧别名标注");
    assertBoundary(journey);
  }, 60000);

  it("persists an explicit new Recall plan without resolving the browser drawing conflict", async () => {
    const user = userEvent.setup();
    const { journey, episode, oldKey } = await startAliasJourney("conflict");
    mountJourney(journey);
    await openAliasEpisode(journey, user);
    await user.click(screen.getByRole("button", { name: "买入前判断" }));
    const entry = await screen.findByRole("textbox", { name: "计划入场" });
    await user.clear(entry);
    await user.type(entry, "15.3");
    await waitFor(async () => expect((await journey.h.recallRepository.load(episode.newId))?.plans?.drafts)
      .toContainEqual(expect.objectContaining({ input: expect.objectContaining({ entry: "15.3" }) })), { timeout: 15000 });
    expect((await journey.h.client.getBootstrap()).reviewStates).toEqual([]);
    cleanup(); await settle(journey);
    mountJourney(journey);
    expect(await screen.findByRole("alert", { name: "浏览器复盘恢复冲突" })).toHaveTextContent(oldKey);
    expect((await journey.h.client.getBootstrap()).reviewStates).toEqual([]);
    await openAliasEpisode(journey, user);
    await user.click(screen.getByRole("button", { name: "买入前判断" }));
    expect(await screen.findByRole("textbox", { name: "计划入场" })).toHaveValue("15.3");
    assertBoundary(journey);
  }, 60000);

  it("blocks native browser storage key enumeration of legacy business keys", () => {
    const native = installNativeBrowserStorage();
    let browser: ReturnType<typeof installStorageBoundary> | undefined;
    try {
      browser = installStorageBoundary(homepagePreference("approved", false), false);
      for (const [name, storage] of native.stores) {
        expect(storage).toBeInstanceOf(native.Storage);
        expect.soft(() => storage.key(0), name).toThrow(`Forbidden browser storage operation: ${name}.key 0`);
      }
      expect(browser.attempts).toEqual([
        { storage: "local", method: "key", key: "0", value: undefined, allowed: false },
        { storage: "session", method: "key", key: "0", value: undefined, allowed: false },
      ]);
      for (const key of poisonKeys) {
        expect(browser.readLocal(key)).toBe(`poison:local:${key}`);
        expect(browser.readSession(key)).toBe(`poison:session:${key}`);
      }
    } finally {
      try { browser?.restore(); } finally { native.restore(); }
    }
  });

  it("blocks native browser storage length enumeration of legacy business keys", () => {
    const native = installNativeBrowserStorage();
    let browser: ReturnType<typeof installStorageBoundary> | undefined;
    try {
      browser = installStorageBoundary(homepagePreference("approved", false), false);
      for (const [name, storage] of native.stores) {
        expect(storage).toBeInstanceOf(native.Storage);
        expect.soft(() => storage.length, name).toThrow(`Forbidden browser storage operation: ${name}.length`);
      }
      expect(browser.attempts).toEqual([
        { storage: "local", method: "length", allowed: false },
        { storage: "session", method: "length", allowed: false },
      ]);
      for (const key of poisonKeys) {
        expect(browser.readLocal(key)).toBe(`poison:local:${key}`);
        expect(browser.readSession(key)).toBe(`poison:session:${key}`);
      }
    } finally {
      try { browser?.restore(); } finally { native.restore(); }
    }
  });

  it.each([false, true])("preserves approved native browser UI preferences and restores storage operations (legacy=%s)", (legacy) => {
    const native = installNativeBrowserStorage();
    const homeBytes = homepagePreference("approved-restored", legacy);
    try {
      const browser = installStorageBoundary(homeBytes, legacy);
      try {
        for (const [, storage] of native.stores) expect(storage).toBeInstanceOf(native.Storage);
        expect(localStorage.getItem(scopeV1)).toBe('{"nature":"live","accountIds":[],"reportCurrency":"original","simulationRunId":null}');
        expect(sessionStorage.getItem(legacy ? homeV2 : homeV3)).toBe(homeBytes);
        const scopeBytes = '{"nature":"live","accountIds":["approved-account"],"reportCurrency":"CNY","simulationRunId":null}';
        const changedHome = homepagePreference("approved-changed", false);
        localStorage.setItem(scopeV2, scopeBytes);
        sessionStorage.setItem(homeV3, changedHome);
        expect(localStorage.getItem(scopeV2)).toBe(scopeBytes);
        expect(sessionStorage.getItem(homeV3)).toBe(changedHome);
        expect(browser.attempts.every(attempt => attempt.allowed)).toBe(true);
        for (const [name, storage] of native.stores) {
          for (const key of poisonKeys) {
            expect(() => storage.getItem(key)).toThrow(`Forbidden browser storage operation: ${name}.getItem ${key}`);
          }
        }
        for (const key of poisonKeys) {
          expect(browser.readLocal(key)).toBe(`poison:local:${key}`);
          expect(browser.readSession(key)).toBe(`poison:session:${key}`);
        }
      } finally {
        browser.restore();
      }
      // These public operations also prove the shared native prototype was restored.
      for (const [, storage] of native.stores) {
        expect(storage.length).toBe(0);
        expect(storage.key(0)).toBeNull();
        storage.setItem("restored-operation", "available");
        expect(storage.getItem("restored-operation")).toBe("available");
        expect(storage.key(0)).toBe("restored-operation");
        expect(storage.length).toBe(1);
        storage.clear();
      }
    } finally {
      native.restore();
    }
  });

  it("keeps legacy and current review parsing pure with the same normalized state", () => {
    const replayCursor = "2025-01-10T00:00:00.000Z";
    const drawing = {
      id: "price-1",
      tool: "price-label",
      anchors: [{ time: "2025-01-06T00:00:00.000Z", price: 12.5 }],
      style: { color: "#f3ba2f", lineWidth: 1, opacity: 0.9 },
      hidden: false,
      locked: true,
      visibleOn: "all",
      stage: "pre-trade",
      text: "突破价",
    };
    const legacy = parseStoredReviewState("legacy", JSON.stringify({
      version: 1,
      replayCursor,
      timeframe: "1D",
      thesis: "保留旧计划",
      drawings: [drawing],
    }));
    expect(legacy).toMatchObject({
      version: 2,
      episodeId: "legacy",
      replayCursor,
      timeframe: "1D",
      activePanelTab: "stats",
      legacyThesis: "保留旧计划",
      drawings: [{
        version: 2,
        episodeId: "legacy",
        createdAtCursor: replayCursor,
        text: "突破价",
      }],
    });

    const current = parseStoredReviewState("current", JSON.stringify({
      version: 2,
      episodeId: "stored-episode",
      replayCursor,
      timeframe: "1W",
      activePanelTab: "notes",
      drawings: [{
        ...drawing,
        version: 2,
        episodeId: "stored-episode",
        name: "价格标注",
        zIndex: 0,
        createdAtCursor: replayCursor,
      }],
    }));
    expect(current).toMatchObject({
      version: 2,
      episodeId: "current",
      replayCursor,
      timeframe: "1W",
      activePanelTab: "notes",
      drawings: [{ episodeId: "current", name: "价格标注", zIndex: 0 }],
    });
    expect(parseStoredReviewState("broken", "{")).toBeNull();
  });

  it("renders the import-empty state from an empty SQLite bootstrap without legacy reads", async () => {
    const user = userEvent.setup();
    const journey = startJourney("empty", false, "sbui-restored");
    mountJourney(journey);
    const input = await screen.findByRole("searchbox", { name: "搜索持仓" });
    expect(input).toHaveValue("sbui-restored");
    await waitFor(() => expect(journey.h.calls.journey.some(call => call.operation === "getHomepageSource" && call.delivered)).toBe(true));
    expect(journey.h.calls.journey.filter(call => call.operation === "getBootstrap")).toHaveLength(1);
    const accountMenu = await screen.findByRole("button", { name: "全部账户" }, { timeout: 15000 });
    expect(accountMenu).toBeEnabled();
    await user.click(accountMenu);
    expect(await screen.findByText("暂无实盘账户")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "全部账户" }));
    await user.clear(input);
    await user.click(await screen.findByRole("button", { name: "搜索持仓" }));
    await user.type(await screen.findByRole("searchbox", { name: "搜索持仓" }), "sbui-changed");
    await waitFor(() => {
      const restored = readHomepageSnapshot(journey.browser.readSession(homeV3));
      expect(restored.ok && restored.snapshot.holdings.query).toBe("sbui-changed");
      expect(history.state.hpSource).toBe(journey.browser.readSession(homeV3));
    });
    await observeCashFailure(journey, user);
    await user.click(screen.getByRole("button", { name: "交易库" }));
    expect(await screen.findByRole("tab", { name: "按标的浏览" })).toBeVisible();
    await user.click(await screen.findByRole("button", { name: "返回首页" }));
    expect(await screen.findByRole("searchbox", { name: "搜索持仓" })).toHaveValue("sbui-changed");
    cleanup(); await settle(journey);
    history.replaceState(null, "", "/home");
    const remountStart = journey.h.calls.journey.length;
    mountJourney(journey);
    expect(await screen.findByRole("searchbox", { name: "搜索持仓" })).toHaveValue("sbui-changed");
    await waitFor(() => expect(journey.h.calls.journey.slice(remountStart).some(call => call.operation === "getHomepageSource" && call.delivered)).toBe(true));
    expect(journey.h.calls.journey.slice(remountStart).filter(call => call.operation === "getBootstrap")).toHaveLength(1);
    const book = await journey.h.client.readTradeBook();
    expect(book.facts).toEqual([]);
    expect(book.importHistory).toEqual([]);
    expect(book.pages[0].snapshot.materialHistory).toEqual([]);
    expect(journey.h.calls.seed[0].operation).toBe("seed.emptyMigration.write");
    expect(journey.h.calls.seed[1].operation).toBe("seed.emptyMigration.receipt");
    assertBoundary(journey);
  }, 30000);

  it("persists an imported trade and chart settings through SQLite without legacy browser writes", async () => {
    const user = userEvent.setup();
    const journey = startJourney("import", true);
    mockDispatcher.mockResolvedValue(importParseResult);
    mockEnrichment.mockResolvedValue(enrichedImport);
    mockMarketDataSync.mockImplementation(async (options: SyncMarketDataOptions) => {
      expect({ instrumentId: options.instrumentId, symbol: options.symbol, market: options.market }).toEqual({ instrumentId: importedExecution.instrument.id, symbol: "600938", market: "CN-SH" });
      const candles = [dailyCandle].filter(candle => candle.tradingDate >= options.required.startDate && candle.tradingDate <= options.required.endDate);
      await options.repository.commitSyncResult({ instrumentId: options.instrumentId, candles, providerSymbol: { provider: "tencent", symbol: "sh600938" }, coverage: [{ ...options.required, status: "partial", provider: "tencent", fetchedAt, missingTradingDates: [], reason: "provider-history-limit", ...(candles.length ? { actualEndDate: candles.at(-1)!.tradingDate } : {}) }] });
      const savedCandles = await options.repository.getDailyCandles(options.instrumentId, options.required.startDate, options.required.endDate);
      const savedCoverage = await options.repository.getCoverage(options.instrumentId);
      expect(savedCoverage.some(segment => segment.startDate === options.required.startDate && segment.endDate === options.required.endDate && segment.status === "partial")).toBe(true);
      return { source: "network", status: "partial", candles: savedCandles, requestedRanges: [options.required] };
    });
    mountJourney(journey);
    await waitFor(() => expect(journey.h.calls.journey.some(call => call.operation === "getHomepageSource" && call.delivered)).toBe(true));
    await observeCashFailure(journey, user);
    const beforePrepare = persistedBook(await journey.h.client.readTradeBook());
    await user.upload(await screen.findByLabelText("导入交易记录"), new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "boundary.pdf", { type: "application/pdf" }));
    await screen.findByRole("region", { name: "服务器审核计划" });
    const confirm = await screen.findByRole("button", { name: "确认导入并开始更新行情" });
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(persistedBook(await journey.h.client.readTradeBook())).toEqual(beforePrepare);
    expect(journey.h.calls.journey.some(call => call.operation === "prepareTradeChanges" && call.status === 200 && call.delivered)).toBe(true);
    expect(journey.h.calls.journey.filter(call => call.operation === "commitTradeChanges")).toEqual([]);
    await user.click(confirm);
    await waitFor(() => expect(journey.h.calls.journey.some(call => call.operation === "commitTradeChanges" && call.delivered && call.status === 200)).toBe(true));
    const committed = journey.h.calls.journey.find(call => call.operation === "commitTradeChanges" && call.delivered)!;
    const receipt = committed.result as CommitReceipt, request = committed.parameters as TradeChangeCommit;
    const prepared = journey.h.calls.journey.find(call => call.operation === "prepareTradeChanges" && call.delivered)!.result as ReviewPlan;
    expect(request.planId).toBe(prepared.planId);
    expect(receipt.planId).toBe(prepared.planId);
    const afterCommit = journey.h.calls.journey.findIndex(call => call.operation === committed.operation && call.ordinal === committed.ordinal) + 1;
    expect(afterCommit).toBeGreaterThan(0);
    await waitFor(() => expect(journey.h.calls.journey.slice(afterCommit).some(call => call.operation === "readTradeSnapshot" && call.delivered)).toBe(true));
    const confirmedRead = journey.h.calls.journey.slice(afterCommit).find(call => call.operation === "readTradeSnapshot" && call.delivered)!;
    expect(confirmedRead.parameters).toMatchObject({ version: { atLeast: receipt.bookVersion } });
    expect(await journey.h.client.getTradeCommit(request.requestId)).toEqual(receipt);
    const imported = await journey.h.client.readTradeBook({ version: { atLeast: receipt.bookVersion } });
    expect(imported.executions).toEqual([expect.objectContaining({ ...importedExecution, source: expect.objectContaining({ ...importedExecution.source, batchId: expect.any(String) }) })]);
    expect(imported.importHistory).toEqual([expect.objectContaining({ fileName: "boundary.pdf" })]);
    const batchId = imported.executions[0].source!.batchId;
    expect(imported.importHistory[0].id).toBe(batchId);
    expect(imported.bookVersion).toEqual(receipt.bookVersion);
    expect(imported.facts).toHaveLength(1);
    const materials = imported.pages[0].snapshot.materialHistory;
    expect(materials).toHaveLength(1);
    const material = materials[0], version = material.versions.find(item => item.id === material.currentVersionId)!;
    expect(version.materialId).toBe(material.id);
    const observation = version.observations.find(item => item.executionIds.includes(importedExecution.id))!;
    expect(observation).toMatchObject({ versionId: version.id, originalAccountId: importedExecution.accountId, raw: expect.objectContaining({ ...importedExecution.source, batchId }) });
    const market = new ApiMarketDataRepository(journey.h.client);
    await waitFor(async () => {
      const jobs = (await journey.h.client.getBootstrap()).marketDataJobs;
      expect(jobs).toHaveLength(1);
      expect(["partial", "complete", "ready", "latest-available"]).toContain(jobs[0].status);
      expect(jobs[0].intervals.some(part => part.interval === "1h" && ["partial", "complete", "ready", "latest-available"].includes(part.status))).toBe(true);
      expect(await market.getDailyCandles(importedExecution.instrument.id, "2026-01-02", "2026-01-02")).toEqual([dailyCandle]);
      expect((await market.getCandles(importedExecution.instrument.id, "1h", "2026-01-02T00:00:00.000Z", "2026-01-02T23:59:59.999Z")).length).toBeGreaterThan(0);
    }, { timeout: 15000 });
    await openFirstEpisode(user);
    await waitFor(() => expect(journey.h.calls.journey.slice(afterCommit).some(call => call.operation === "getHomepageSource" && call.delivered)).toBe(true));
    const refreshedHome = journey.h.calls.journey.slice(afterCommit).find(call => call.operation === "getHomepageSource" && call.delivered)!;
    expect(refreshedHome).toBeDefined();
    expect((refreshedHome.parameters as { version: { atLeast: CommitReceipt["bookVersion"] } }).version.atLeast).toEqual(receipt.bookVersion);
    expect((refreshedHome.result as HomepageStoredCollection).bookVersion).toEqual(receipt.bookVersion);
    expect((refreshedHome.result as HomepageStoredCollection).receipt.counts).toMatchObject({ executions: 1, instruments: 1, importHistory: 1 });
    expect(journey.h.calls.journey.some(call => call.operation === "loadRecall" && call.delivered)).toBe(true);
    await user.click(screen.getByRole("button", { name: "图表设置" }));
    const volume = screen.getByRole("checkbox", { name: "显示成交量" });
    expect(volume).toBeChecked();
    await user.click(volume);
    await waitFor(async () => expect(await journey.h.client.getSettings()).toMatchObject({ version: 1, showVolume: false }));
    expect(volume).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "图表设置" }));
    expect(journey.h.calls.journey.some(call => call.operation === "putSettings" && call.delivered && call.status === 200)).toBe(true);
    const stable = persistedBook(imported);
    expect(persistedBook(await journey.h.client.readTradeBook())).toEqual(stable);
    await user.click(screen.getByRole("button", { name: "返回交易库" }));
    await user.click(await screen.findByRole("button", { name: /打开中国海油第1次交易/ }));
    await assertVolume(journey, user, false);
    cleanup(); await settle(journey);
    history.replaceState(null, "", "/home");
    mountJourney(journey);
    await openFirstEpisode(user);
    await assertVolume(journey, user, false);
    expect(persistedBook(await journey.h.client.readTradeBook())).toEqual(stable);
    expect(journey.external.attempts.some(call => call.path === "/api/market-data/intraday" && call.status === 200)).toBe(true);
    assertBoundary(journey);
  }, 60000);

  it("marks legacy browser stores as migration-only and limits the exporter boundary", () => {
    const exporter = readFileSync(exporterPath, "utf8");
    expect(exporter).toContain("MIGRATION-ONLY");

    for (const file of legacyStoragePaths) {
      const source = readFileSync(join(root, "app/lib/storage", file), "utf8");
      expect(source, file).toContain("MIGRATION-ONLY");
    }

    const legacyModules = legacyStoragePaths
      .map((file) => file.replace(/\.ts$/, ""))
      .join("|");
    const legacyRuntimeImport = new RegExp(
      `^import(?!\\s+type\\b)\\s+[^;]*?from\\s+["'][^"']*(?:${legacyModules})["']`,
      "m",
    );
    for (const path of productionSourceFiles(join(root, "app"))) {
      const relative = path.slice(root.length + 1);
      if (relative === "app/lib/storage/browser-state-export.ts" || legacyStoragePaths.some((file) => relative === `app/lib/storage/${file}`)) continue;
      const statements = importStatements(readFileSync(path, "utf8"));
      const importLibraryStatements = statements.filter((item) => item.includes("import-library"));
      const otherRuntimeImports = statements.filter((item) => !item.includes("import-library"));
      expect(otherRuntimeImports.join("\n"), relative).not.toMatch(legacyRuntimeImport);
      for (const statement of importLibraryStatements) {
        expect(allowsPureImportLibraryImport(statement), `${relative}: ${statement}`).toBe(true);
      }
    }

    expect(allowsPureImportLibraryImport(
      'import { mergeExecutions } from "./import-library";',
    )).toBe(true);
    expect(allowsPureImportLibraryImport(
      'import { saveImportedExecutions } from "./import-library";',
    )).toBe(false);

    const forbiddenBeforeImportLibrary = [
      'import { saveChartSettings } from "./chart-settings";',
      'import { mergeExecutions } from "./import-library";',
    ].join("\n");
    const fixtureImports = importStatements(forbiddenBeforeImportLibrary);
    expect(
      fixtureImports
        .filter((statement) => !statement.includes("import-library"))
        .join("\n"),
    ).toMatch(legacyRuntimeImport);
  });
});
