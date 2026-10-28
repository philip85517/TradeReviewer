import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";
import { initializeSqlite } from "../../../db/sqlite-initialization";
import { createTradeReadHandler } from "../../api/storage/trades/read/handler";
import { createImportHistoryCommitHandler } from "../../api/storage/import-history/commit/handler";
import { tradeFailure, tradeResponse } from "../../api/storage/trades/http";
import { createSqliteHttpClient, type MarketDataWrite, type MergeTradeDataInput } from "../../lib/storage/sqlite-http-client";
import { getSqliteStore, createTradeChanges } from "../../lib/storage/sqlite-store";
import { TradingViewAccountMigrationStore } from "../../lib/storage/tradingview-account-migration-store";
import { readHomepageStoredCollection } from "../../lib/storage/homepage-source-snapshot";
import type { StoredTradeSelection } from "../../lib/storage/stored-trade-snapshot";
import type { BrowserStatePayload, TradeChangeIntent, TradeChangeCommit } from "../../lib/storage/sqlite-contracts";
import type { EpisodeReviewState } from "../../lib/storage/review-storage";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import { createRecallRepository } from "../../lib/recall/repository";
import { RecallValidationError } from "../../lib/recall/document";
import { getRecallDocument, saveRecallDocument, listRecallReviewSummaries, RecallConflictError, RecallNotFoundError } from "../../lib/recall/server-repository";
import type { MarketDataJob } from "../../lib/storage/market-data-job-contract";
import type { ResolvedInstrument } from "../../lib/instruments/metadata-contracts";
import type { RecallSaveInput } from "../../lib/recall/types";

export type WorkspaceSeed = {
  tradeData?: MergeTradeDataInput;
  migratedEmpty?: { sourceClientId: string; sourceFingerprint: string };
  /** Explicit earlier empty migration, followed by tradeData preparation in this owned database. */
  priorEmptyMigration?: { sourceClientId: string; sourceFingerprint: string };
  /** Test preparation through the real Store, never an HTTP journey operation. */
  committedAccountMigration?: { operationId: string };
  settings?: ChartSettings;
  recall?: readonly RecallSaveInput[];
};
export type WorkspaceOperation = "getStatus" | "getBootstrap" | "getHomepageSource" | "prepareTradeChanges" | "commitTradeChanges" | "getTradeCommit" | "readTradeSnapshot" | "readImportHistoryCommit" | "putInstrumentName" | "getSettings" | "putSettings" | "loadRecall" | "saveRecall" | "getRecallSummaries" | "getMarketData" | "getProviderSymbol" | "putMarketData" | "putMarketDataJob" | "getInstrumentMetadata" | "putInstrumentMetadata" | "getTradeRevisions" | "getMigrationAliases" | "putReviewState";
type ErrorObservation = { name: string; message: string; status?: number; code?: string; category?: string; phase?: string; retryable?: boolean; correlationId?: string; savedState?: string };
export type WorkspaceCall = Readonly<{
  phase: "seed" | "journey";
  operation: string;
  ordinal: number;
  parameters: unknown;
  invoked: boolean;
  delivered: boolean;
  invocationOrder?: number;
  deliveryOrder?: number;
  status?: number;
  result?: unknown;
  typedError?: Readonly<ErrorObservation>;
  transportError?: Readonly<ErrorObservation>;
}>;
type MutableCall = { -readonly [K in keyof WorkspaceCall]: WorkspaceCall[K] };
export type WorkspaceFault = {
  operation: WorkspaceOperation;
  ordinal: number;
  parameters: unknown;
  at: "beforeInvoke" | "afterInvokeBeforeDelivery";
  effect: "pause" | { throw: Error };
};
type Gate = { reached: Promise<void>; release(): void };
type RegisteredFault = { specification: WorkspaceFault; gate: Gate; arrive(): void; released: Promise<void> };

/** Journal values are detached observations; they cannot mutate stored facts or earlier observations. */
function snapshot<T>(value: T): T {
  const copy: T = JSON.parse(JSON.stringify(value));
  const freeze = (item: unknown): void => {
    if (!item || typeof item !== "object") return;
    Object.values(item).forEach(freeze); Object.freeze(item);
  };
  freeze(copy); return copy;
}
function describeError(error: unknown): ErrorObservation {
  const item = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return {
    name: typeof item.name === "string" ? item.name : "Error",
    message: typeof item.message === "string" ? item.message : String(error),
    ...Object.fromEntries(["status", "code", "category", "phase", "retryable", "correlationId", "savedState"].filter(key => item[key] !== undefined).map(key => [key, item[key]])),
  };
}
function recallFailure(error: unknown): Response {
  const status = error instanceof RecallConflictError ? 409 : error instanceof RecallNotFoundError ? 404 : error instanceof RecallValidationError ? 400 : 503;
  const code = status === 409 ? "conflict" : status === 404 ? "not-found" : status === 400 ? "invalid-request" : "storage-unavailable";
  return tradeResponse({ error: { code, message: status === 503 ? "Recall storage is unavailable" : describeError(error).message } }, status);
}

/** In-process transport only: one owned SQLite authority, production clients and production read protocol. */
export function createSqliteWorkspaceHarness(seed: WorkspaceSeed) {
  if (seed.tradeData !== undefined && seed.migratedEmpty !== undefined) throw new Error("tradeData and migratedEmpty are mutually exclusive");
  const database = new DatabaseSync(":memory:");
  let disposed = false;
  const seedCalls: MutableCall[] = [], journeyCalls: MutableCall[] = [];
  const ordinals = new Map<string, number>();
  const pendingFaults: RegisteredFault[] = [];
  const gates: Gate[] = [];
  let invocationOrder = 0, deliveryOrder = 0;
  const seedObserve = (operation: string, parameters: unknown, work: () => unknown) => {
    const call: MutableCall = { phase: "seed", operation, ordinal: seedCalls.filter(item => item.operation === operation).length + 1, parameters: snapshot(parameters), invoked: true, delivered: false, invocationOrder: ++invocationOrder };
    seedCalls.push(call);
    try { call.result = snapshot(work()); call.delivered = true; call.deliveryOrder = ++deliveryOrder; }
    catch (error) { call.typedError = snapshot(describeError(error)); throw error; }
  };
  try {
    initializeSqlite(database);
    const store = getSqliteStore(database);
    const emptyMigration = seed.migratedEmpty ?? seed.priorEmptyMigration;
    if (emptyMigration !== undefined) {
      const payload: BrowserStatePayload = {
        version: 1, ...emptyMigration,
        executions: [], importHistory: [], instruments: [], reviews: [], reviewStates: [],
        tagSuggestions: [], marketDataJobs: [], settings: {}, dailyCandles: [],
        marketCandles: [], coverage: [], intervalCoverage: [], providerSymbols: [],
      };
      const requestId = `browser:${payload.sourceFingerprint}`;
      seedObserve("seed.emptyMigration.write", payload, () => store.mergeBrowserState(payload));
      seedObserve("seed.emptyMigration.receipt", { requestId }, () => createTradeChanges(database).getCommit(requestId));
      seedObserve("seed.emptyMigration.readback", {}, () => readHomepageStoredCollection(database));
      seedObserve("seed.emptyMigration.status", {}, () => store.getStatus());
    }
    if (seed.tradeData !== undefined) {
      seedObserve("seed.tradeData.compatibilityCommit", seed.tradeData, () => store.mergeTradeData(seed.tradeData!));
      seedObserve("seed.tradeData.readback", {}, () => store.getBootstrap());
    }
    if (seed.committedAccountMigration !== undefined) {
      const migration = new TradingViewAccountMigrationStore(database);
      let preview!: ReturnType<typeof migration.preview>;
      seedObserve("seed.accountMigration.preview", seed.committedAccountMigration, () => {
        preview = migration.preview(seed.committedAccountMigration);
        return preview;
      });
      const request = {
        operationId: preview.operationId, idempotencyKey: `${preview.operationId}:seed-commit`,
        baseSnapshotDigest: preview.baseSnapshotDigest, planDigest: preview.planDigest,
        expectedAffectedRows: [
          ...preview.executionPlan.map(row => ({ table: "executions", key: row.executionId, beforeDigest: row.beforeDigest })),
          ...preview.referencePlan.map(row => ({ table: row.table, key: row.primaryKey, beforeDigest: row.beforeDigest })),
        ],
        provisionalPrincipalAction: preview.provisionalPrincipal.action === "no-op" ? "no-op" as const : "create-if-absent" as const,
      };
      seedObserve("seed.accountMigration.commit", request, () => migration.commit(request));
      seedObserve("seed.accountMigration.aliasReadback", {}, () => migration.getCommittedAliases());
    }
    if (seed.settings !== undefined) {
      seedObserve("seed.settings.write", seed.settings, () => { store.putSettings(seed.settings!); return { ok: true }; });
      seedObserve("seed.settings.readback", {}, () => store.getSettings());
    }
    for (const input of seed.recall ?? []) {
      seedObserve("seed.recall.write", input, () => saveRecallDocument(database, input));
      seedObserve("seed.recall.readback", { episodeId: input.document.episodeId }, () => getRecallDocument(database, input.document.episodeId));
    }
  } catch (error) { database.close(); throw error; }
  const store = getSqliteStore(database);
  const changes = createTradeChanges(database);
  const read = createTradeReadHandler(() => database);
  const readImportHistoryCommit = createImportHistoryCommitHandler(() => database);
  const faults = {
    once(specification: WorkspaceFault): Gate {
      if (disposed) throw new Error("Workspace harness is disposed");
      if (!Number.isSafeInteger(specification.ordinal) || specification.ordinal < 1 || specification.parameters === undefined) throw new Error("Fault requires an operation ordinal and explicit parameters");
      const normalized = { ...specification, parameters: snapshot(specification.parameters) };
      if (pendingFaults.some(item => item.specification.operation === normalized.operation && item.specification.ordinal === normalized.ordinal)) throw new Error("Fault already registered for operation ordinal");
      let arrive!: () => void, release!: () => void;
      const reached = new Promise<void>(resolve => { arrive = resolve; });
      const released = new Promise<void>(resolve => { release = resolve; });
      const gate = { reached, release };
      pendingFaults.push({ specification: normalized, gate, arrive, released }); gates.push(gate);
      return gate;
    },
  };
  const applyFault = async (operation: string, ordinal: number, parameters: unknown, at: WorkspaceFault["at"]) => {
    const index = pendingFaults.findIndex(item => item.specification.operation === operation && item.specification.ordinal === ordinal && item.specification.at === at && isDeepStrictEqual(item.specification.parameters, parameters));
    if (index < 0) return;
    const [fault] = pendingFaults.splice(index, 1); // Consume before yielding: a retry cannot reuse this fault.
    fault.arrive();
    if (fault.specification.effect === "pause") await fault.released;
    else throw fault.specification.effect.throw;
    if (disposed) throw new Error("Workspace harness is disposed");
  };

  async function fetcher(input: string, init?: RequestInit): Promise<Response> {
    if (disposed) throw new Error("Workspace harness is disposed");
    // Request/Response bodies cross the same JSON boundary as the production clients, without opening a socket.
    const request = new Request(new URL(input, "http://workspace.invalid"), init);
    const url = new URL(request.url), key = `${request.method} ${url.pathname}`;
    const body: unknown = request.method === "GET" ? undefined : await request.clone().json();
    let operation: string, parameters: unknown, invoke: (() => Response | Promise<Response>) | undefined;
    const trade = (work: () => unknown): Response => { try { return tradeResponse(work()); } catch (error) { return tradeFailure(error); } };
    // These are typed client/repository ports, not a copy of the raw HTTP body parsers.
    const market = (work: () => unknown): Response => {
      try { return tradeResponse(work()); }
      catch (error) {
        const message = error instanceof Error ? error.message : "";
        const status = message.startsWith("Unknown instrument:") ? 404 : message.startsWith("Invalid ") ? 400 : 503;
        return tradeResponse({ error: { code: status === 404 ? "not-found" : status === 400 ? "invalid-request" : "storage-unavailable", message: status === 404 ? "not found" : status === 400 ? "invalid request" : "storage unavailable" } }, status);
      }
    };
    const recall = (work: () => unknown): Response => { try { return tradeResponse(work()); } catch (error) { return recallFailure(error); } };
    switch (key) {
      case "GET /api/storage/status": operation = "getStatus"; parameters = {}; invoke = () => trade(() => store.getStatus()); break;
      case "GET /api/storage/bootstrap": operation = "getBootstrap"; parameters = {}; invoke = () => trade(() => readHomepageStoredCollection(database)); break;
      case "GET /api/storage/homepage-source": {
        operation = "getHomepageSource";
        const version: StoredTradeSelection["version"] = url.searchParams.has("version") ? JSON.parse(url.searchParams.get("version")!) : undefined;
        parameters = version === undefined ? {} : { version };
        invoke = () => trade(() => readHomepageStoredCollection(database, version)); break;
      }
      case "POST /api/storage/trades/plans": operation = "prepareTradeChanges"; parameters = body; invoke = () => trade(() => changes.prepare(body as TradeChangeIntent)); break;
      case "POST /api/storage/trades/commit": operation = "commitTradeChanges"; parameters = body; invoke = () => trade(() => changes.commit(body as TradeChangeCommit)); break;
      case "GET /api/storage/trades/receipts": operation = "getTradeCommit"; parameters = { requestId: url.searchParams.get("requestId") }; invoke = () => trade(() => changes.getCommit(url.searchParams.get("requestId")!)); break;
      case "POST /api/storage/trades/read": operation = "readTradeSnapshot"; parameters = body; invoke = () => read(request); break;
      case "POST /api/storage/import-history/commit": operation = "readImportHistoryCommit"; parameters = body; invoke = () => readImportHistoryCommit(request); break;
      case "GET /api/storage/trade-revisions": {
        const instrumentId = url.searchParams.get("instrumentId");
        operation = "getTradeRevisions"; parameters = { instrumentId };
        if (!instrumentId?.trim() || url.searchParams.size !== 1 || url.searchParams.getAll("instrumentId").length !== 1) break;
        invoke = () => trade(() => store.getTradeRevisions(instrumentId)); break;
      }
      case "PUT /api/storage/instruments/name": operation = "putInstrumentName"; parameters = body; invoke = () => trade(() => { store.putInstrumentName(body as { instrumentId: string; name: string }); return { ok: true }; }); break;
      case "GET /api/storage/tradingview-account-migration/aliases": {
        operation = "getMigrationAliases"; parameters = {};
        if (url.searchParams.size !== 0) break;
        invoke = () => trade(() => ({ aliases: new TradingViewAccountMigrationStore(database).getCommittedAliases() })); break;
      }
      case "PUT /api/storage/reviews": {
        operation = "putReviewState"; parameters = body;
        if (url.searchParams.size !== 0) break;
        invoke = () => market(() => { store.putReviewState(body as EpisodeReviewState); return body; }); break;
      }
      case "GET /api/storage/settings": operation = "getSettings"; parameters = {}; invoke = () => trade(() => store.getSettings()); break;
      case "PUT /api/storage/settings": operation = "putSettings"; parameters = body; invoke = () => trade(() => { store.putSettings(body as ChartSettings); return store.getSettings(); }); break;
      case "GET /api/storage/market-data": {
        operation = "getMarketData"; parameters = Object.fromEntries(url.searchParams);
        const allowed = new Set(["instrumentId", "provider", "interval", "start", "end", "dailyOnly"]);
        if ([...url.searchParams.keys()].some(name => !allowed.has(name) || url.searchParams.getAll(name).length !== 1)) break;
        const instrumentId = url.searchParams.get("instrumentId"), provider = url.searchParams.get("provider");
        const interval = url.searchParams.get("interval"), dailyOnly = url.searchParams.get("dailyOnly");
        const start = url.searchParams.get("start"), end = url.searchParams.get("end");
        if (!instrumentId?.trim() || (start !== null && end !== null && start > end)) break;
        if (provider !== null) {
          operation = "getProviderSymbol";
          if (!provider.trim() || interval !== null || start !== null || end !== null || dailyOnly !== null) break;
          invoke = () => market(() => {
            if (!store.hasInstrument(instrumentId)) throw new Error(`Unknown instrument: ${instrumentId}`);
            return { providerSymbol: store.getProviderSymbol(instrumentId, provider) ?? null };
          }); break;
        }
        if (!(interval === "1D" || interval === "1h" || interval === "15m") || (dailyOnly !== null && (dailyOnly !== "true" || interval !== "1D"))) break;
        invoke = () => market(() => {
          if (!store.hasInstrument(instrumentId)) throw new Error(`Unknown instrument: ${instrumentId}`);
          const from = start ?? "0000-01-01T00:00:00.000Z", to = end ?? "9999-12-31T23:59:59.999Z";
          const intervalCoverage = store.getIntervalCoverage(instrumentId, interval);
          return dailyOnly === "true"
            ? { dailyCandles: store.getDailyCandles(instrumentId, from.slice(0, 10), to.slice(0, 10)), intervalCoverage, coverage: store.getCoverageSegments(instrumentId) }
            : { candles: store.getCandles(instrumentId, interval, from, to), intervalCoverage, ...(interval === "1D" ? { coverage: store.getCoverageSegments(instrumentId) } : {}) };
        }); break;
      }
      case "PUT /api/storage/market-data": {
        operation = "putMarketData"; parameters = body;
        if (url.searchParams.size !== 0) break;
        const input = body as MarketDataWrite | { kind: "job"; job: MarketDataJob };
        if (input?.kind === "daily") invoke = () => market(() => { store.commitMarketData(input.result); return { ok: true }; });
        else if (input?.kind === "interval") invoke = () => market(() => { store.commitIntervalMarketData(input.result); return { ok: true }; });
        else if (input?.kind === "job") {
          operation = "putMarketDataJob";
          invoke = () => market(() => { store.putMarketDataJob(input.job); return store.getBootstrap().marketDataJobs.find(job => job.instrumentId === input.job.instrumentId); });
        }
        break;
      }
      case "GET /api/storage/instruments/metadata": {
        operation = "getInstrumentMetadata"; parameters = { instrumentIds: url.searchParams.getAll("id") };
        if ([...url.searchParams.keys()].some(name => name !== "id") || url.searchParams.getAll("id").some(id => !id.trim())) break;
        invoke = () => trade(() => ({ instruments: store.getInstrumentMetadata(url.searchParams.getAll("id")) })); break;
      }
      case "PUT /api/storage/instruments/metadata": {
        operation = "putInstrumentMetadata"; parameters = body;
        if (url.searchParams.size !== 0) break;
        invoke = () => trade(() => { store.putInstrumentMetadata(body as ResolvedInstrument); return { ok: true }; }); break;
      }
      case "GET /api/storage/recall": {
        operation = "loadRecall"; parameters = { episodeId: url.searchParams.get("episodeId") };
        invoke = () => { try { const document = getRecallDocument(database, url.searchParams.get("episodeId")!); return document ? tradeResponse(document) : tradeResponse({ error: { code: "not-found", message: "Recall document not found" } }, 404); } catch (error) { return recallFailure(error); } }; break;
      }
      case "PUT /api/storage/recall": operation = "saveRecall"; parameters = body; invoke = () => recall(() => saveRecallDocument(database, body as RecallSaveInput).document); break;
      case "GET /api/storage/recall/summaries": operation = "getRecallSummaries"; parameters = {}; invoke = () => recall(() => ({ summaries: listRecallReviewSummaries(database) })); break;
      default: operation = `unsupported:${key}`; parameters = body ?? Object.fromEntries(url.searchParams);
    }
    const ordinal = (ordinals.get(operation) ?? 0) + 1; ordinals.set(operation, ordinal);
    const call: MutableCall = { phase: "journey", operation, ordinal, parameters: snapshot(parameters), invoked: false, delivered: false };
    journeyCalls.push(call);
    try {
      if (!invoke) throw new Error(`Unsupported workspace operation: ${key}`);
      await applyFault(operation, ordinal, call.parameters, "beforeInvoke");
      call.invoked = true; call.invocationOrder = ++invocationOrder;
      const response = await invoke();
      // Every production transaction has ended before the detached result or an after-invoke fault can be awaited.
      call.status = response.status; call.result = snapshot(await response.clone().json());
      if (!response.ok) {
        const value = call.result as { error?: Record<string, unknown> };
        call.typedError = snapshot({ name: url.pathname.startsWith("/api/storage/recall") ? "RecallRepositoryError" : "StorageHttpError", status: response.status, ...value.error } as ErrorObservation);
      }
      await applyFault(operation, ordinal, call.parameters, "afterInvokeBeforeDelivery");
      call.delivered = true; call.deliveryOrder = ++deliveryOrder;
      return response;
    } catch (error) { call.transportError = snapshot(describeError(error)); throw error; }
  }
  return {
    client: createSqliteHttpClient(fetcher),
    recallRepository: createRecallRepository(fetcher),
    fetcher,
    calls: { get seed(): readonly WorkspaceCall[] { return snapshot(seedCalls); }, get journey(): readonly WorkspaceCall[] { return snapshot(journeyCalls); } },
    faults,
    dispose() { if (disposed) return; disposed = true; gates.forEach(gate => gate.release()); pendingFaults.length = 0; database.close(); },
  };
}
