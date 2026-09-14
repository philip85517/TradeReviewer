import { createEmptyEpisodeReviewRecord } from "../reviews/review-metrics";
import { parseBrokerStatement } from "../import/dispatcher";
import { csv, fileFor } from "../import/__fixtures__/tradingview";
import { buildTradeEpisodes } from "../trades/episodes";
import { columnStatement } from "../import/__fixtures__/china-merchants-columns";
import { enrichStatementImport } from "../import/enrich-import";
import { createImportPreview } from "../import/import-preview";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { openSqliteDatabase } from "../../../db/sqlite";
import type { BrowserStatePayload } from "./sqlite-contracts";
import { SqliteStore } from "./sqlite-store";

const directories: string[] = [];

it("persists focused answers and rule evidence, and rejects malformed extensions", () => {
  const store = createStore();
  store.mergeExecutions([execution]);
  const record = createEmptyEpisodeReviewRecord("focused-store", instrument.id);
  record.review.keyDecision = "离场确认";
  record.review.planAdherence = "no-plan";
  record.review.ruleChecks = [{sourceEpisodeId:"prior", sourceUpdatedAt:"2026-09-01T00:00:00Z", ruleText:"等待确认", result:"followed"}];
  store.putReview(record);
  expect(store.getReview(record.episodeId)?.review).toMatchObject({keyDecision:"离场确认", planAdherence:"no-plan", ruleChecks:[{ruleText:"等待确认", result:"followed"}]});
  const invalid = JSON.parse(JSON.stringify(record));
  invalid.review.ruleChecks[0].result = "guessed";
  expect(() => store.putReview(invalid)).toThrow("Invalid review");
  expect(store.getReview(record.episodeId)?.review.ruleChecks?.[0].result).toBe("followed");
});

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "tradereview-store-"));
  directories.push(directory);
  return new SqliteStore(openSqliteDatabase(join(directory, "store.sqlite")));
}

function databaseFor(store: SqliteStore) {
  return (store as unknown as {
    database: ReturnType<typeof openSqliteDatabase>;
  }).database;
}

function snapshotAllTables(store: SqliteStore) {
  const database = databaseFor(store);
  const tables = database.prepare(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
  ).all() as Array<{ name: string }>;

  return Object.fromEntries(
    tables.map(({ name }) => [
      name,
      database.prepare(`select * from "${name}" order by rowid`).all(),
    ]),
  );
}

function expectBrowserStateRejectionBeforeTransaction(
  store: SqliteStore,
  browserState: BrowserStatePayload,
) {
  const database = databaseFor(store);
  const before = snapshotAllTables(store);
  const exec = vi.spyOn(database, "exec");

  expect(() => store.mergeBrowserState(browserState)).toThrow();
  expect(exec).not.toHaveBeenCalledWith("begin immediate");
  expect(snapshotAllTables(store)).toEqual(before);
}

const instrument = {
  id: "HK:700",
  symbol: "700",
  name: "腾讯控股",
  market: "HK",
  currency: "HKD",
};

const execution = {
  id: "execution-1",
  source: { platform: "broker", row: 1, fileName: "trades.csv" },
  accountId: "account-1",
  accountLabel: "主账户",
  instrument,
  side: "buy" as const,
  executedAt: "2026-01-02T03:04:05.000Z",
  quantity: "100.000000000000000001",
  price: "123.450000000000000001",
  fee: "0.01",
};

function payload(overrides: Partial<BrowserStatePayload> = {}): BrowserStatePayload {
  return {
    version: 1,
    sourceClientId: "browser-a",
    sourceFingerprint: "migration-1",
    executions: [execution],
    importHistory: [],
    instruments: [instrument],
    reviews: [],
    reviewStates: [],
    tagSuggestions: [],
    marketDataJobs: [],
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
    dailyCandles: [],
    marketCandles: [],
    coverage: [],
    intervalCoverage: [],
    providerSymbols: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("A股招商银行 import persistence",()=>{
  it("rejects malformed settlement evidence before saving a trade",async()=>{
    const parsed=await parseBrokerStatement({name:"test.pdf",arrayBuffer:async()=>new TextEncoder().encode("%PDF-test").buffer},{extractPdfPages:async()=>columnStatement()});
    const record=parsed.records[0];
    const store=createStore();
    const malformed={...record,source:{...record.source,settlement:{...record.source.settlement!,grossAmount:"NaN"}}};
    expect(()=>store.mergeExecutions([malformed])).toThrow();
    expect(store.getExecutions()).toEqual([]);
    databaseFor(store).close();
  });

  it("dispatches, previews and persists settlement and format evidence without duplicate rows",async()=>{
    const pages=columnStatement();
    const parsed=await parseBrokerStatement({name:"statement.pdf",arrayBuffer:async()=>new TextEncoder().encode("%PDF-test").buffer},{extractPdfPages:async()=>pages});
    if (parsed.broker==='unknown') throw new Error('Expected recognized format');
    const enriched=await enrichStatementImport(parsed,{resolver:async()=>{throw new Error('No external lookup needed');}});
    const preview=createImportPreview("statement.pdf",enriched);
    const store=createStore();
    expect(preview.sourceLabel).toBe("A股招商银行");
    store.mergeExecutions(preview.records);
    expect(store.getExecutions()).toEqual(preview.records);
    store.mergeExecutions(preview.records);
    expect(store.getExecutions()).toHaveLength(2);
    expect(store.getExecutions()[0].source.settlement?.grossAmount).toBe("4000");
    databaseFor(store).close();
  });
});

describe("SqliteStore", () => {
  it("preserves a confirmed account correction when a richer duplicate reimport replaces the row", () => {
    const store = createStore();
    const correction = {
      originalAccountId: "account-1",
      canonicalAccountId: "account-canonical",
      reason: "User confirmed the account identity",
      confirmedOn: "2026-09-12",
      confirmedBy: "user",
    };
    const corrected = { ...execution, accountId: correction.canonicalAccountId };
    store.mergeExecutions([corrected]);
    databaseFor(store).prepare("update executions set evidence_json = ? where id = ?").run(
      JSON.stringify({
        source: corrected.source,
        accountLabel: corrected.accountLabel,
        accountCorrection: correction,
        importAudit: { sourceVersion: "original-parser" },
      }),
      corrected.id,
    );

    const reimport = {
      ...execution,
      source: { ...execution.source, inputKind: "statement" as const, feeStatus: "reported" as const },
    };
    expect(store.mergeExecutions([reimport])).toEqual({ inserted: 1, duplicate: 1, conflict: 0 });
    expect(store.getExecutions()[0]).toMatchObject({
      id: execution.id,
      accountId: correction.canonicalAccountId,
      source: reimport.source,
    });
    expect(databaseFor(store).prepare("select evidence_json from executions where id = ?").get(execution.id)).toEqual({
      evidence_json: JSON.stringify({
        source: reimport.source,
        accountLabel: reimport.accountLabel,
        accountCorrection: correction,
        importAudit: { sourceVersion: "original-parser" },
      }),
    });
    expect(store.mergeExecutions([reimport])).toEqual({ inserted: 0, duplicate: 1, conflict: 0 });
    expect(databaseFor(store).prepare("select evidence_json from executions where id = ?").get(execution.id)).toEqual({
      evidence_json: JSON.stringify({
        source: reimport.source,
        accountLabel: reimport.accountLabel,
        accountCorrection: correction,
        importAudit: { sourceVersion: "original-parser" },
      }),
    });
  });

  it("fails closed when a same-id reimport changes the corrected trade quantity", () => {
    const store = createStore();
    const correction = {
      originalAccountId: "account-1",
      canonicalAccountId: "account-canonical",
      reason: "User confirmed the account identity",
      confirmedOn: "2026-09-12",
    };
    const corrected = { ...execution, accountId: correction.canonicalAccountId };
    store.mergeExecutions([corrected]);
    const evidence = {
      source: corrected.source,
      accountLabel: corrected.accountLabel,
      accountCorrection: correction,
    };
    databaseFor(store).prepare("update executions set evidence_json = ? where id = ?").run(
      JSON.stringify(evidence),
      corrected.id,
    );

    const changedQuantity = {
      ...execution,
      quantity: "101",
      source: { ...execution.source, inputKind: "statement" as const },
    };
    expect(() => store.mergeExecutions([changedQuantity])).toThrow(
      "Account correction replacement identity conflict",
    );
    expect(store.getExecutions()[0]).toMatchObject({
      id: execution.id,
      accountId: correction.canonicalAccountId,
      quantity: corrected.quantity,
    });
    expect(databaseFor(store).prepare("select evidence_json from executions where id = ?").get(execution.id)).toEqual({
      evidence_json: JSON.stringify(evidence),
    });
  });

  it("carries a confirmed account correction through an explicit execution replacement", () => {
    const store = createStore();
    const correction = {
      originalAccountId: "account-1",
      canonicalAccountId: "account-canonical",
      reason: "User confirmed the account identity",
      confirmedOn: "2026-09-12",
      evidenceVersion: 1,
    };
    const oldExecution = { ...execution, id: "old-execution", accountId: correction.canonicalAccountId };
    store.mergeExecutions([oldExecution]);
    const oldEvidence = {
      source: oldExecution.source,
      accountLabel: oldExecution.accountLabel,
      accountCorrection: correction,
      importAudit: { sourceVersion: "original-parser" },
    };
    databaseFor(store).prepare("update executions set evidence_json = ? where id = ?").run(
      JSON.stringify(oldEvidence),
      oldExecution.id,
    );

    const replacement = {
      ...execution,
      id: "replacement-execution",
      source: { ...execution.source, inputKind: "screenshot" as const },
    };
    expect(store.mergeTradeData({ executions: [replacement], replaceExecutionIds: [oldExecution.id] })).toEqual({
      inserted: 1,
      duplicate: 0,
      conflict: 0,
    });
    expect(store.getExecutions()).toHaveLength(1);
    expect(store.getExecutions()[0]).toMatchObject({
      id: replacement.id,
      accountId: correction.canonicalAccountId,
      source: replacement.source,
    });
    expect(databaseFor(store).prepare("select evidence_json from executions where id = ?").get(replacement.id)).toEqual({
      evidence_json: JSON.stringify({
        ...oldEvidence,
        source: replacement.source,
        accountLabel: replacement.accountLabel,
      }),
    });
  });

  it("fails closed instead of inheriting a correction across different documents with the same trade values", () => {
    const store = createStore();
    const correction = {
      originalAccountId: "account-1",
      canonicalAccountId: "account-canonical",
      reason: "User confirmed the account identity",
      confirmedOn: "2026-09-12",
    };
    const oldExecution = { ...execution, id: "automatic-old", accountId: correction.canonicalAccountId };
    store.mergeExecutions([oldExecution]);
    const oldEvidence = {
      source: oldExecution.source,
      accountLabel: oldExecution.accountLabel,
      accountCorrection: correction,
    };
    databaseFor(store).prepare("update executions set evidence_json = ? where id = ?").run(
      JSON.stringify(oldEvidence),
      oldExecution.id,
    );

    const replacement = {
      ...execution,
      id: "automatic-new",
      source: { ...execution.source, fileName: "different-document.csv", inputKind: "statement" as const },
    };
    expect(() => store.mergeExecutions([replacement])).toThrow(
      "Account correction replacement identity conflict",
    );
    expect(store.getExecutions()).toEqual([
      expect.objectContaining({ id: oldExecution.id, accountId: correction.canonicalAccountId }),
    ]);
    expect(databaseFor(store).prepare("select evidence_json from executions where id = ?").get(oldExecution.id)).toEqual({
      evidence_json: JSON.stringify(oldEvidence),
    });
  });

  it("fails closed when source platform, currency, trade scope, simulation run, or row provenance changes", () => {
    const cases = [
      {
        name: "platform",
        incoming: {
          ...execution,
          source: { ...execution.source, platform: "other-broker", inputKind: "statement" as const },
        },
      },
      {
        name: "currency",
        incoming: {
          ...execution,
          instrument: { ...instrument, currency: "USD" },
          source: { ...execution.source, inputKind: "statement" as const },
        },
      },
      {
        name: "trade scope",
        incoming: {
          ...execution,
          source: { ...execution.source, tradeNature: "live" as const, inputKind: "statement" as const },
        },
      },
      {
        name: "row provenance",
        incoming: {
          ...execution,
          source: { ...execution.source, row: 2, inputKind: "statement" as const },
        },
      },
    ];

    for (const { name, incoming } of cases) {
      const store = createStore();
      const correction = {
        originalAccountId: "account-1",
        canonicalAccountId: "account-canonical",
        reason: `User confirmed the account identity for ${name}`,
        confirmedOn: "2026-09-12",
      };
      const corrected = { ...execution, accountId: correction.canonicalAccountId };
      store.mergeExecutions([corrected]);
      const evidence = {
        source: corrected.source,
        accountLabel: corrected.accountLabel,
        accountCorrection: correction,
      };
      databaseFor(store).prepare("update executions set evidence_json = ? where id = ?").run(
        JSON.stringify(evidence),
        corrected.id,
      );

      expect(() => store.mergeExecutions([incoming])).toThrow(
        "Account correction replacement identity conflict",
      );
      expect(store.getExecutions()).toMatchObject([
        expect.objectContaining({ id: corrected.id, accountId: correction.canonicalAccountId }),
      ]);
    }

    const simulationStore = createStore();
    const simulationSource = {
      platform: "tradingview",
      row: 1,
      fileName: "simulation.csv",
      fileFingerprint: "simulation-file",
      inputKind: "tradingview" as const,
      tradingNature: "simulated" as const,
      tradeNature: "simulation" as const,
      simulationRunId: "run-a",
      simulationTradeId: "1",
      simulationRole: "entry" as const,
      timePrecision: "date-only" as const,
      sourceTimezone: "Asia/Shanghai",
    };
    const simulationExecution = {
      ...execution,
      id: "simulation-corrected",
      executedAt: "2026-01-02",
      accountId: "account-canonical",
      source: simulationSource,
    };
    simulationStore.mergeExecutions([simulationExecution]);
    const simulationEvidence = {
      source: simulationSource,
      accountLabel: simulationExecution.accountLabel,
      accountCorrection: {
        originalAccountId: "account-1",
        canonicalAccountId: "account-canonical",
        reason: "User confirmed the simulated account identity",
        confirmedOn: "2026-09-12",
      },
    };
    databaseFor(simulationStore).prepare("update executions set evidence_json = ? where id = ?").run(
      JSON.stringify(simulationEvidence),
      simulationExecution.id,
    );
    const differentRun = {
      ...simulationExecution,
      accountId: "account-1",
      source: { ...simulationSource, simulationRunId: "run-b", inputKind: "statement" as const },
    };
    expect(() => simulationStore.mergeExecutions([differentRun])).toThrow(
      "Account correction replacement identity conflict",
    );
    expect(simulationStore.getExecutions()).toMatchObject([
      expect.objectContaining({ id: simulationExecution.id, accountId: "account-canonical" }),
    ]);
  });

  it("fails closed in ordinary mergeExecutions when a canonical same-id source changes", () => {
    const store = createStore();
    const correction = {
      originalAccountId: "account-1",
      canonicalAccountId: "account-canonical",
      reason: "User confirmed the account identity",
      confirmedOn: "2026-09-12",
    };
    const corrected = { ...execution, accountId: correction.canonicalAccountId };
    store.mergeExecutions([corrected]);
    const evidence = {
      source: corrected.source,
      accountLabel: corrected.accountLabel,
      accountCorrection: correction,
    };
    databaseFor(store).prepare("update executions set evidence_json = ? where id = ?").run(
      JSON.stringify(evidence),
      corrected.id,
    );

    const changedSource = {
      ...corrected,
      source: { ...corrected.source, platform: "other-broker", row: 2, inputKind: "statement" as const },
    };
    expect(() => store.mergeExecutions([changedSource])).toThrow(
      "Account correction identity conflict",
    );
    expect(store.getExecutions()).toMatchObject([
      expect.objectContaining({ id: corrected.id, accountId: correction.canonicalAccountId, source: corrected.source }),
    ]);
    expect(databaseFor(store).prepare("select evidence_json from executions where id = ?").get(corrected.id)).toEqual({
      evidence_json: JSON.stringify(evidence),
    });
  });

  it("fails closed in mergeTradeData without replacements when a canonical same-id scope changes", () => {
    const store = createStore();
    const correction = {
      originalAccountId: "account-1",
      canonicalAccountId: "account-canonical",
      reason: "User confirmed the account identity",
      confirmedOn: "2026-09-12",
    };
    const corrected = { ...execution, accountId: correction.canonicalAccountId };
    store.mergeExecutions([corrected]);
    const evidence = {
      source: corrected.source,
      accountLabel: corrected.accountLabel,
      accountCorrection: correction,
    };
    databaseFor(store).prepare("update executions set evidence_json = ? where id = ?").run(
      JSON.stringify(evidence),
      corrected.id,
    );

    const changedScope = {
      ...corrected,
      source: { ...corrected.source, tradeNature: "live" as const, inputKind: "statement" as const },
    };
    expect(() => store.mergeTradeData({ executions: [changedScope] })).toThrow(
      "Account correction identity conflict",
    );
    expect(store.getExecutions()).toMatchObject([
      expect.objectContaining({ id: corrected.id, accountId: correction.canonicalAccountId, source: corrected.source }),
    ]);
    expect(databaseFor(store).prepare("select evidence_json from executions where id = ?").get(corrected.id)).toEqual({
      evidence_json: JSON.stringify(evidence),
    });
  });

  it("preserves a confirmed account correction when reviseTrades rewrites the same execution", () => {
    const store = createStore();
    const correction = {
      originalAccountId: "account-1",
      canonicalAccountId: "account-canonical",
      reason: "User confirmed the account identity",
      confirmedOn: "2026-09-12",
    };
    const corrected = { ...execution, accountId: correction.canonicalAccountId };
    store.mergeExecutions([corrected]);
    const evidence = {
      source: corrected.source,
      accountLabel: corrected.accountLabel,
      accountCorrection: correction,
      importAudit: { sourceVersion: "original-parser" },
    };
    databaseFor(store).prepare("update executions set evidence_json = ? where id = ?").run(
      JSON.stringify(evidence),
      corrected.id,
    );

    const after = { ...corrected, quantity: "101" };
    store.reviseTrades({
      id: "revision-preserves-correction",
      instrumentId: instrument.id,
      accountId: correction.canonicalAccountId,
      reason: "Correct the reported quantity",
      changes: [{ before: corrected, after }],
    });

    expect(store.getExecutions()[0]).toMatchObject({
      id: corrected.id,
      accountId: correction.canonicalAccountId,
      quantity: "101",
    });
    expect(databaseFor(store).prepare("select evidence_json from executions where id = ?").get(corrected.id)).toEqual({
      evidence_json: JSON.stringify({
        ...evidence,
        source: after.source,
        accountLabel: after.accountLabel,
      }),
    });
  });

  it("does not inherit a correction for a different explicit replacement trade", () => {
    const store = createStore();
    const correction = {
      originalAccountId: "account-1",
      canonicalAccountId: "account-canonical",
      reason: "User confirmed the account identity",
      confirmedOn: "2026-09-12",
    };
    const oldExecution = { ...execution, id: "old-corrected-execution", accountId: correction.canonicalAccountId };
    store.mergeExecutions([oldExecution]);
    const oldEvidence = {
      source: oldExecution.source,
      accountLabel: oldExecution.accountLabel,
      accountCorrection: correction,
    };
    databaseFor(store).prepare("update executions set evidence_json = ? where id = ?").run(
      JSON.stringify(oldEvidence),
      oldExecution.id,
    );

    const differentTrade = {
      ...execution,
      id: "different-replacement-execution",
      quantity: "101",
      source: { ...execution.source, inputKind: "screenshot" as const },
    };
    expect(() => store.mergeTradeData({ executions: [differentTrade], replaceExecutionIds: [oldExecution.id] })).toThrow(
      "Account correction replacement identity conflict",
    );
    expect(store.getExecutions()[0]).toMatchObject({
      id: oldExecution.id,
      accountId: correction.canonicalAccountId,
      quantity: oldExecution.quantity,
    });
    expect(databaseFor(store).prepare("select evidence_json from executions where id = ?").get(oldExecution.id)).toEqual({
      evidence_json: JSON.stringify(oldEvidence),
    });
  });

  it("persists monthly provenance and auxiliary evidence including no-trade months", () => {
    const store = createStore();
    const monthly = {
      documentId: "statement-a", templateIds: ["futu-combined"], month: "2025-06", accountId: "account-1", timePolicy: "原件香港时间",
      positions: [{ accountId: "account-1", market: "HK", symbol: "700", phase: "opening" as const, date: "2025-06-01", quantity: "100", source: [{ page: 2, row: 3 }] }],
      events: [], reviewRequired: true,
    };
    const history = { id: "import:statement-a", fileName: "2025-06.pdf", sourceLabel: "富途", importedAt: "2025-07-01T00:00:00Z", tradeCount: 0, instrumentCount: 0, excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 0, unresolvedInstrumentCount: 0, monthly };
    store.mergeTradeData({ executions: [], importHistory: [history] });
    expect(store.getBootstrap().importHistory[0].monthly).toEqual(monthly);
    store.mergeTradeData({ executions: [{ ...execution, source: { ...execution.source, timeEvidence: "user", templateId: "futu-legacy", openingPosition: monthly.positions[0] } }] });
    expect(store.getExecutions()[0].source).toMatchObject({ timeEvidence: "user", templateId: "futu-legacy", openingPosition: monthly.positions[0] });
    expect(() => store.mergeTradeData({ executions: [], importHistory: [{ ...history, monthly: { ...monthly, positions: [{ ...monthly.positions[0], quantity: 123 as unknown as string }] } }] })).toThrow("Invalid monthly statement evidence");
  });
  it("roundtrips simulated source evidence and isolates reimports and runs", async () => {
    const store = createStore();
    const {records} = await parseBrokerStatement(fileFor());
    const other = await parseBrokerStatement(fileFor(csv.replaceAll('signal, quoted','new run')));
    store.mergeExecutions(records);
    store.mergeExecutions(records);
    store.mergeExecutions(other.records);
    const restored=store.getBootstrap().executions;
    expect(restored).toHaveLength(4);
    expect(restored.find(r=>r.id===records[1].id)?.source).toEqual(records[1].source);
    expect(buildTradeEpisodes(restored)).toHaveLength(2);
  });

  it("restores simulation notes and drawings for the exact episode after reopening SQLite", async () => {
    const directory=mkdtempSync(join(tmpdir(), 'simulation-reopen-'));
    directories.push(directory);
    const path=join(directory,'store.sqlite');
    const first=new SqliteStore(openSqliteDatabase(path));
    const {records}=await parseBrokerStatement(fileFor());
    first.mergeExecutions(records);
    const episode=buildTradeEpisodes(records)[0];
    const review=createEmptyEpisodeReviewRecord(episode.id,episode.instrument.id,'2026-09-07T00:00:00Z');
    review.plan.thesis='等待突破后再入场';
    first.putReview(review);
    const state={version:2 as const,episodeId:episode.id,replayCursor:episode.startedAt,timeframe:'1D' as const,activePanelTab:'notes' as const,drawings:[{version:2 as const,id:'simulation-line',episodeId:episode.id,name:'风险线',tool:'horizontal-line' as const,anchors:[{time:episode.startedAt,price:9}],style:{color:'#fff',lineWidth:1,opacity:1},zIndex:0,hidden:false,locked:false,visibleOn:'all' as const,stage:'during-replay' as const,createdAtCursor:episode.startedAt}]};
    first.putReviewState(state);
    const other=await parseBrokerStatement(fileFor(csv.replaceAll('signal, quoted','another run')));
    first.mergeExecutions(other.records);
    databaseFor(first).close();
    const reopened=new SqliteStore(openSqliteDatabase(path));
    expect(reopened.getBootstrap().reviews).toEqual([review]);
    expect(reopened.getBootstrap().reviewStates).toEqual([state]);
    const restoredEpisodes=buildTradeEpisodes(reopened.getExecutions());
    expect(restoredEpisodes.map(e=>e.id)).toContain(episode.id);
    expect(restoredEpisodes).toHaveLength(2);
    databaseFor(reopened).close();
  });

  it("rejects stale-client CSV security conflicts against persisted and incoming records", async () => {
    const store=createStore();
    const a=await parseBrokerStatement(fileFor());
    const b=await parseBrokerStatement(fileFor(csv,'回放交易_SSE_600869.csv'));
    store.mergeExecutions(a.records);
    expect(()=>store.mergeExecutions(b.records)).toThrow(/simulation.*context/i);
    expect(store.getExecutions()).toEqual(a.records);
    const empty=createStore();
    expect(()=>empty.mergeExecutions([...a.records,...b.records])).toThrow(/simulation.*context/i);
    expect(empty.getExecutions()).toHaveLength(0);
  });

  it("rejects invalid simulation evidence atomically", async () => {
    const store=createStore();
    const {records}=await parseBrokerStatement(fileFor());
    const invalid={...records[0], source:{...records[0].source,simulationRunId:undefined}};
    expect(()=>store.mergeExecutions([records[1],invalid])).toThrow(/simulation/i);
    expect(store.getExecutions()).toHaveLength(0);
  });
  it("returns a complete bootstrap with empty production data", () => {
    const bootstrap = createStore().getBootstrap();

    expect(bootstrap).toMatchObject({
      schemaVersion: 6,
      executions: [], importHistory: [], instruments: [], reviews: [],
      tagSuggestions: [], marketDataJobs: [], settings: {},
    });
    expect(bootstrap.migration).toBeNull();
  });

  it("upserts an instrument and execution in one transaction", () => {
    const store = createStore();
    expect(store.mergeExecutions([execution])).toEqual({ inserted: 1, duplicate: 0, conflict: 0 });
    expect(store.getExecutions()).toEqual([execution]);
    expect(store.getInstruments()).toEqual([instrument]);
  });

  it("round-trips simulated trade scope and import history", () => {
    const store = createStore();
    const simulated = {
      ...execution,
      id: "simulation-execution-1",
      source: {
        ...execution.source,
        platform: "tradingview",
        inputKind: "tradingview" as const,
        tradeNature: "simulation" as const,
        simulationRunId: "tradingview:run-a",
        sourceTradeId: "1",
      },
    };
    const history = {
      id: "tradingview:run-a",
      fileName: "回放交易_SSE_600330_2026-09-03.csv",
      sourceLabel: "TradingView · 模拟盘",
      importedAt: "2026-09-09T00:00:00.000Z",
      tradeCount: 2,
      instrumentCount: 1,
      excludedInstrumentCount: 0,
      excludedRecordCount: 0,
      duplicateTradeCount: 0,
      unresolvedInstrumentCount: 0,
      sourceKind: "tradingview" as const,
      tradeNature: "simulation" as const,
      simulationRunId: "tradingview:run-a",
    };

    store.mergeTradeData({
      instruments: [instrument],
      executions: [simulated],
      importHistory: [history],
    });

    expect(store.getExecutions()).toEqual([simulated]);
    expect(store.getImportHistory()).toEqual([history]);
    expect(
      databaseFor(store)
        .prepare("select trade_nature, simulation_run_id from executions")
        .all(),
    ).toEqual([
      { trade_nature: "simulation", simulation_run_id: "tradingview:run-a" },
    ]);
  });

  it("preserves an explicitly confirmed grey-market session across reopening storage", () => {
    const directory = mkdtempSync(join(tmpdir(), "tradereview-session-"));
    directories.push(directory);
    const path = join(directory, "store.sqlite");
    const fill = { ...execution, source: { ...execution.source, tradingSession: "grey-market" as const } };
    const first = new SqliteStore(openSqliteDatabase(path));
    first.mergeExecutions([fill]);
    databaseFor(first).close();
    const reopened = new SqliteStore(openSqliteDatabase(path));
    expect(reopened.getExecutions()).toEqual([fill]);
    databaseFor(reopened).close();
  });

  it("persists trade, market data, and refresh jobs across a database reopen", () => {
    const directory = mkdtempSync(join(tmpdir(), "tradereview-reopen-"));
    directories.push(directory);
    const databasePath = join(directory, "store.sqlite");
    const firstStore = new SqliteStore(openSqliteDatabase(databasePath));
    const candle = {
      instrumentId: instrument.id,
      tradingDate: "2026-01-02",
      open: "120",
      high: "125",
      low: "119",
      close: "123.45",
      volume: "1000",
      currency: instrument.currency,
      provider: "eastmoney" as const,
      providerSymbol: "116.00700",
      adjustmentMode: "raw" as const,
      fetchedAt: "2026-01-03T00:00:00.000Z",
    };
    const job = {
      instrumentId: instrument.id,
      symbol: instrument.symbol,
      market: instrument.market,
      requestedAt: "2026-01-03T00:00:00.000Z",
      status: "complete" as const,
      intervals: [
        { interval: "1D" as const, status: "complete" as const },
        { interval: "15m" as const, status: "partial" as const, message: "部分区间无数据" },
      ],
    };

    firstStore.mergeExecutions([execution]);
    firstStore.commitMarketData({
      instrumentId: instrument.id,
      candles: [candle],
      coverage: [{ startDate: "2026-01-02", endDate: "2026-01-02", status: "complete", missingTradingDates: [] }],
      providerSymbol: { provider: "eastmoney", symbol: candle.providerSymbol },
    });
    firstStore.putMarketDataJob(job);
    databaseFor(firstStore).close();

    const reopenedStore = new SqliteStore(openSqliteDatabase(databasePath));
    expect(reopenedStore.getExecutions()).toEqual([execution]);
    expect(reopenedStore.getDailyCandles(instrument.id)).toEqual([candle]);
    expect(reopenedStore.getCoverageSegments(instrument.id)).toEqual([
      expect.objectContaining({ startDate: "2026-01-02", endDate: "2026-01-02", status: "complete" }),
    ]);
    expect(reopenedStore.getMarketDataJobs()).toEqual([job]);
  });

  it("persists refresh jobs that track the native 1h interval", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const job = {
      instrumentId: instrument.id,
      symbol: instrument.symbol,
      market: instrument.market,
      requestedAt: "2026-01-03T00:00:00.000Z",
      status: "partial" as const,
      intervals: [
        { interval: "1D" as const, status: "complete" as const },
        { interval: "1h" as const, status: "partial" as const },
      ],
    };

    store.putMarketDataJob(job);

    expect(store.getMarketDataJobs()).toEqual([job]);
  });

  it("persists the latest provider error both in the job payload and diagnostic column", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const job = {
      instrumentId: instrument.id,
      symbol: instrument.symbol,
      market: instrument.market,
      requestedAt: "2026-01-03T00:00:00.000Z",
      status: "source-unavailable" as const,
      error: {
        code: "source-unavailable",
        message: "百度行情源未返回该股票数据",
      },
      intervals: [
        { interval: "1D" as const, status: "complete" as const },
        {
          interval: "1h" as const,
          status: "source-unavailable" as const,
          error: {
            code: "source-unavailable",
            message: "百度行情源未返回该股票数据",
          },
        },
      ],
    };

    store.putMarketDataJob(job);

    expect(store.getMarketDataJobs()).toEqual([job]);
    expect(
      databaseFor(store)
        .prepare("select error_json from market_data_jobs where id = ?")
        .get(instrument.id),
    ).toEqual({
      error_json: JSON.stringify(job.error),
    });
  });

  it("preserves resolved instrument metadata when later executions upsert the core instrument", () => {
    const store = createStore();
    const metadata = {
      market: "HK" as const,
      symbol: "700",
      name: "腾讯控股",
      assetType: "stock" as const,
      source: "hkex" as const,
      confidence: "official" as const,
      resolvedAt: "2026-01-01T00:00:00.000Z",
    };

    store.mergeTradeData({ instruments: [{ ...instrument, metadata }], executions: [] });
    store.mergeExecutions([execution]);

    expect(store.getInstruments()).toEqual([{ ...instrument, metadata }]);
    expect(store.getBootstrap().instruments).toEqual([{ ...instrument, metadata }]);
  });

  it("preserves an incoming screenshot replacement when the old conflicting id is removed atomically", () => {
    const store = createStore();
    const existing = { ...execution, id: "existing-conflict" };
    const incoming = { ...execution, id: "incoming-conflict", price: "999" };
    store.mergeExecutions([existing]);

    expect(store.mergeTradeData({ executions: [incoming], replaceExecutionIds: [existing.id] })).toEqual({ inserted: 1, duplicate: 0, conflict: 0 });
    expect(store.getExecutions().map((item) => item.id)).toEqual([incoming.id]);
    expect(store.getExecutions()[0]?.price).toBe("999");
  });

  it("retains both monthly conflict rows after an explicit keep-both replacement", () => {
    const store = createStore();
    const existing = { ...execution, id: "monthly-old", source: { ...execution.source, fileFingerprint: "old", statementMonth: "2026-01" } };
    const incoming = { ...existing, id: "monthly-new", price: "999", source: { ...existing.source, fileFingerprint: "new" } };
    store.mergeExecutions([existing]);
    expect(store.mergeTradeData({ executions: [existing, incoming], replaceExecutionIds: [existing.id] })).toEqual({ inserted: 2, duplicate: 0, conflict: 0 });
    expect(store.getExecutions().map(e => e.id).sort()).toEqual(["monthly-new", "monthly-old"]);
  });

  it("persists date-only monthly evidence without inventing a midnight instant", () => {
    const store = createStore();
    store.mergeExecutions([{ ...execution, executedAt: "2016-01-04", source: { ...execution.source, timePrecision: "date-only", sourceTimeKind: "date", statementMonth: "2016-01" } }]);
    expect(store.getBootstrap().executions[0].executedAt).toBe("2016-01-04");
  });

  it("creates a placeholder review for a suggestion-only migration payload", () => {
    const store = createStore();
    const suggestion = {
      version: 1 as const, tagDictionaryVersion: 1, id: "orphan-suggestion", episodeId: "orphan-episode", instrumentId: instrument.id,
      tagId: "entry-20d-breakout" as const, finalTagId: null, ruleId: "entry-20d-breakout" as const, ruleVersion: 1 as const,
      status: "suggested" as const, suggestedAt: "2026-01-02T03:04:05.000Z", decidedAt: null, evidence: [],
    };

    expect(() => store.mergeBrowserState(payload({ sourceFingerprint: "suggestion-only", executions: [], tagSuggestions: [suggestion] }))).not.toThrow();
    expect(store.getTagSuggestions()).toEqual([suggestion]);
    expect(store.getReview("orphan-episode")).toMatchObject({ episodeId: "orphan-episode", instrumentId: instrument.id });
  });

  it("does not persist a suggestion when its combined review decision conflicts", () => {
    const store = createStore();
    store.mergeTradeData({ instruments: [instrument], executions: [] });
    const newerReview = {
      version: 1 as const, tagDictionaryVersion: 1, episodeId: "decision-episode", instrumentId: instrument.id, updatedAt: "2026-02-01T00:00:00.000Z",
      plan: { thesis: "new", expectedPath: "", invalidationCondition: "", targetRange: "", plannedRiskAmount: "", confidence: null },
      review: { decisionQuality: null, executionQuality: null, riskManagement: "", psychology: "", reusableRule: "", completed: false }, confirmedTagIds: [],
    };
    store.putReview(newerReview);
    const staleReview = { ...newerReview, updatedAt: "2026-01-01T00:00:00.000Z", confirmedTagIds: ["entry-20d-breakout"] };
    const suggestion = { version: 1 as const, tagDictionaryVersion: 1, id: "atomic-suggestion", episodeId: "decision-episode", instrumentId: instrument.id, tagId: "entry-20d-breakout" as const, finalTagId: "entry-20d-breakout" as const, ruleId: "entry-20d-breakout" as const, ruleVersion: 1 as const, status: "confirmed" as const, suggestedAt: "2026-01-01T00:00:00.000Z", decidedAt: "2026-01-01T00:00:00.000Z", evidence: [] };

    expect(store.putSuggestionDecision({ suggestion, review: staleReview })).toBe(false);
    expect(store.getTagSuggestions()).toEqual([]);
    expect(store.getReview("decision-episode")?.plan.thesis).toBe("new");
  });

  it("migrates resolved instrument metadata from browser state into bootstrap", () => {
    const store = createStore();
    const metadata = {
      market: "HK" as const,
      symbol: "700",
      name: "腾讯控股",
      assetType: "stock" as const,
      source: "hkex" as const,
      confidence: "official" as const,
      resolvedAt: "2026-01-01T00:00:00.000Z",
    };

    store.mergeBrowserState(payload({
      sourceFingerprint: "metadata-migration",
      instruments: [{ ...instrument, metadata }],
    }));

    expect(store.getBootstrap().instruments).toEqual([{ ...instrument, metadata }]);
  });

  it("projects localized metadata through bootstrap without changing the canonical instrument name", () => {
    const store = createStore();
    const localizedName = {
      name: "苹果公司",
      locale: "zh-CN" as const,
      source: "tencent",
      resolvedAt: "2026-01-01T00:00:00.000Z",
    };
    const original = {
      ...instrument,
      id: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      currency: "USD",
      name: "Apple Inc.",
    };
    const metadata = {
      market: "US" as const,
      symbol: "AAPL",
      name: "Apple Inc.",
      localizedName,
      assetType: "stock" as const,
      source: "nasdaq" as const,
      confidence: "official" as const,
      resolvedAt: "2026-01-01T00:00:00.000Z",
    };

    store.mergeTradeData({ instruments: [{ ...original, metadata }], executions: [] });

    expect(store.getBootstrap().instruments).toEqual([
      { ...original, localizedName, metadata },
    ]);
    store.mergeExecutions([{ ...execution, instrument: original }]);
    expect(store.getExecutions()[0]?.instrument).toEqual({
      ...original,
      localizedName,
    });
  });

  it("restores the localized projection after reopening the SQLite database", () => {
    const directory = mkdtempSync(join(tmpdir(), "localized-reopen-"));
    directories.push(directory);
    const databasePath = join(directory, "store.sqlite");
    const localizedName = {
      name: "苹果公司",
      locale: "zh-CN" as const,
      source: "tencent",
      resolvedAt: "2026-01-01T00:00:00.000Z",
    };
    const original = {
      ...instrument,
      id: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      currency: "USD",
      name: "Apple Inc.",
      localizedName,
    };

    const first = new SqliteStore(openSqliteDatabase(databasePath));
    first.mergeTradeData({ instruments: [original], executions: [] });
    databaseFor(first).close();

    const reopened = new SqliteStore(openSqliteDatabase(databasePath));
    expect(reopened.getBootstrap().instruments).toEqual([original]);
    databaseFor(reopened).close();
  });

  it("deduplicates a repeated browser migration by source fingerprint", () => {
    const store = createStore();
    expect(store.mergeBrowserState(payload())).toMatchObject({ inserted: 8, duplicate: 0, conflict: 0, failed: 0 });
    expect(store.mergeBrowserState(payload())).toMatchObject({ inserted: 0, duplicate: 8, conflict: 0, failed: 0 });
    expect(store.getExecutions()).toEqual([execution]);
  });

  it("reports duplicates for an overlapping migration with a new fingerprint", () => {
    const store = createStore();
    store.mergeBrowserState(payload());

    expect(store.mergeBrowserState(payload({ sourceFingerprint: "migration-2" }))).toMatchObject({ inserted: 0, duplicate: 8, conflict: 0 });
  });

  it("preserves a newer review when an older payload is retried", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const newer = {
      version: 1 as const, episodeId: "episode-1", instrumentId: instrument.id,
      updatedAt: "2026-02-01T00:00:00.000Z",
      plan: { thesis: "new", expectedPath: "up", invalidationCondition: "down", targetRange: "200", plannedRiskAmount: "10", confidence: 4 as const },
      review: { decisionQuality: 4 as const, executionQuality: 4 as const, riskManagement: "ok", psychology: "ok", reusableRule: "wait", completed: true },
      confirmedTagIds: [],
    };
    const older = { ...newer, updatedAt: "2026-01-01T00:00:00.000Z", plan: { ...newer.plan, thesis: "old" } };

    expect(store.putReview(newer)).toBe(true);
    expect(store.mergeBrowserState(payload({ sourceFingerprint: "migration-old", reviews: [older] }))).toMatchObject({ conflict: 1 });
    expect(store.getReview("episode-1")?.plan.thesis).toBe("new");
  });

  it("round-trips review UI state including drawings", () => {
    const store = createStore();
    const state = {
      version: 2 as const,
      episodeId: "episode-state",
      replayCursor: "2026-01-02T00:00:00.000Z",
      timeframe: "1D" as const,
      activePanelTab: "notes" as const,
      drawings: [{ version: 2 as const, id: "drawing-1", episodeId: "episode-state", name: "Line", tool: "horizontal-line" as const, anchors: [{ time: "2026-01-02T00:00:00.000Z", price: 1 }], style: { color: "#fff", lineWidth: 1, opacity: 1 }, zIndex: 0, hidden: false, locked: false, visibleOn: "all" as const, stage: "during-replay" as const, createdAtCursor: "2026-01-02T00:00:00.000Z" }],
    };

    store.mergeBrowserState(payload({ sourceFingerprint: "migration-state", reviewStates: [state] }));

    expect(store.getReviewStates()).toEqual([state]);
    expect(store.getBootstrap().reviewStates).toEqual([state]);
  });

  it("stores and reads decimal fields without numeric coercion", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const [stored] = store.getExecutions();

    expect(stored.quantity).toBe("100.000000000000000001");
    expect(stored.price).toBe("123.450000000000000001");
  });

  it("round-trips candle provenance and full interval coverage without provider joins", () => {
    const store = createStore();
    const daily = { instrumentId: instrument.id, tradingDate: "2026-01-02", open: "1.01", high: "2.02", low: "1.00", close: "2.00", volume: "3", currency: "HKD", provider: "yahoo" as const, providerSymbol: "0700.HK", adjustmentMode: "raw" as const, fetchedAt: "2026-01-03T00:00:00.000Z" };
    const intervalCoverage = { instrumentId: instrument.id, interval: "15m" as const, requestedStart: "2026-01-02T00:00:00.000Z", requestedEnd: "2026-01-02T04:00:00.000Z", actualStart: "2026-01-02T00:15:00.000Z", actualEnd: "2026-01-02T03:45:00.000Z", status: "partial" as const, provider: "yahoo" as const, fetchedAt: "2026-01-03T00:00:00.000Z", reason: "holiday" };

    store.mergeBrowserState(payload({ sourceFingerprint: "market-state", executions: [], instruments: [instrument], dailyCandles: [daily], intervalCoverage: [intervalCoverage], providerSymbols: [{ instrumentId: instrument.id, provider: "tencent", providerSymbol: "hk00700" }] }));

    expect(store.getDailyCandles()).toEqual([daily]);
    expect(store.getIntervalCoverage()).toEqual([{ ...intervalCoverage, adjustmentMode: "raw" }]);
    expect(store.mergeBrowserState(payload({ sourceFingerprint: "market-state-repeat", executions: [], instruments: [instrument], dailyCandles: [daily], intervalCoverage: [intervalCoverage], providerSymbols: [{ instrumentId: instrument.id, provider: "tencent", providerSymbol: "hk00700" }] }))).toMatchObject({ inserted: 0, duplicate: 10, conflict: 0 });
  });

  it("preserves complete daily coverage evidence from a browser-state migration", () => {
    const store = createStore();
    const segments = [{ startDate: "2026-01-02", endDate: "2026-01-04", status: "partial" as const, provider: "tencent" as const, fetchedAt: "2026-01-05T00:00:00.000Z", missingTradingDates: ["2026-01-03"], reason: "market holiday" }];

    store.mergeBrowserState(payload({
      sourceFingerprint: "daily-coverage-state",
      executions: [],
      instruments: [instrument],
      coverage: [{ instrumentId: instrument.id, adjustmentMode: "raw", startDate: "2026-01-02", endDate: "2026-01-04", segments }],
    }));

    expect(store.getCoverage()).toEqual([{ instrumentId: instrument.id, adjustmentMode: "raw", startDate: "2026-01-02", endDate: "2026-01-04", segments }]);
    expect(store.getCoverageSegments(instrument.id)).toEqual(segments);
  });

  it("commits repository market-data contracts atomically and returns daily 1D candles", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const daily = { instrumentId: instrument.id, tradingDate: "2026-01-02", open: "1", high: "2", low: "1", close: "2", volume: "3", currency: "HKD", provider: "tencent" as const, providerSymbol: "700", adjustmentMode: "raw" as const, fetchedAt: "2026-01-03T00:00:00.000Z" };
    store.commitMarketData({ instrumentId: instrument.id, candles: [daily], coverage: [{ startDate: "2026-01-02", endDate: "2026-01-02", status: "complete", missingTradingDates: [] }], providerSymbol: { provider: "tencent", symbol: "700" } });
    expect(store.getCandles(instrument.id, "1D", "2026-01-01T00:00:00.000Z", "2026-01-03T00:00:00.000Z")).toMatchObject([{ interval: "1D", timestamp: "2026-01-02T00:00:00.000Z", close: "2" }]);
    expect(store.getCoverageSegments(instrument.id)).toHaveLength(1);
    expect(() => store.commitMarketData({ instrumentId: instrument.id, candles: [daily], coverage: [{ startDate: "bad", endDate: "bad", status: "complete", missingTradingDates: "bad" as never }], providerSymbol: { provider: "tencent", symbol: "700" } })).toThrow("Invalid coverage");
    expect(store.getDailyCandles(instrument.id)).toEqual([daily]);
  });

  it("commits daily coverage without inventing a provider symbol", () => {
    const store = createStore();
    store.mergeExecutions([execution]);

    store.commitMarketData({
      instrumentId: instrument.id,
      candles: [],
      coverage: [{
        startDate: "2024-01-02",
        endDate: "2024-01-02",
        status: "partial",
        missingTradingDates: [],
        reason: "no-data",
      }],
    });

    expect(store.getCoverageSegments(instrument.id)).toEqual([
      expect.objectContaining({
        startDate: "2024-01-02",
        endDate: "2024-01-02",
        reason: "no-data",
      }),
    ]);
  });

  it("persists native 1h candles and interval coverage", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const candle = {
      instrumentId: instrument.id,
      interval: "1h" as never,
      timestamp: "2026-01-02T01:30:00.000Z",
      open: "1",
      high: "2",
      low: "1",
      close: "2",
      volume: "3",
      currency: "HKD",
      provider: "yahoo" as const,
      providerSymbol: "00700.HK",
      adjustmentMode: "raw" as const,
      fetchedAt: "2026-01-03T00:00:00.000Z",
    };
    const coverage = {
      interval: "1h" as never,
      requestedStart: "2026-01-02T01:30:00.000Z",
      requestedEnd: "2026-01-02T02:30:00.000Z",
      actualStart: "2026-01-02T01:30:00.000Z",
      actualEnd: "2026-01-02T01:30:00.000Z",
      status: "complete" as const,
    };

    store.commitIntervalMarketData({
      instrumentId: instrument.id,
      interval: "1h" as never,
      candles: [candle],
      coverage: [coverage],
      providerSymbol: { provider: "yahoo", symbol: "00700.HK" },
    });

    expect(
      store.getCandles(
        instrument.id,
        "1h" as never,
        "2026-01-02T01:00:00.000Z",
        "2026-01-02T03:00:00.000Z",
      ),
    ).toEqual([candle]);
    expect(store.getIntervalCoverage()).toEqual([
      expect.objectContaining({ instrumentId: instrument.id, interval: "1h" }),
    ]);
  });

  it("persists every interval coverage segment instead of only the last upsert", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const first = {
      interval: "1h" as const,
      requestedStart: "2026-01-02T01:30:00.000Z",
      requestedEnd: "2026-01-02T02:30:00.000Z",
      actualStart: "2026-01-02T01:30:00.000Z",
      actualEnd: "2026-01-02T01:30:00.000Z",
      status: "complete" as const,
    };
    const second = {
      interval: "1h" as const,
      requestedStart: "2026-01-03T01:30:00.000Z",
      requestedEnd: "2026-01-03T02:30:00.000Z",
      actualStart: "2026-01-03T01:30:00.000Z",
      actualEnd: "2026-01-03T01:30:00.000Z",
      status: "complete" as const,
    };

    store.commitIntervalMarketData({
      instrumentId: instrument.id,
      interval: "1h",
      candles: [],
      coverage: [first, second],
    });

    expect(store.getIntervalCoverage()).toEqual([
      expect.objectContaining(first),
      expect.objectContaining(second),
    ]);
  });

  it("rejects malformed API market-data batches without partial writes", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const candle = { instrumentId: instrument.id, interval: "15m" as const, timestamp: "2026-01-02T01:00:00.000Z", open: "1", high: "2", low: "1", close: "2", volume: "3", currency: "HKD", provider: "tencent" as const, providerSymbol: "700", adjustmentMode: "raw" as const, fetchedAt: "2026-01-03T00:00:00.000Z" };
    const intervalCoverage = { interval: "15m" as const, requestedStart: "2026-01-02T00:00:00.000Z", requestedEnd: "2026-01-02T02:00:00.000Z", status: "complete" as const };
    store.commitIntervalMarketData({ instrumentId: instrument.id, interval: "15m", candles: [candle], coverage: [intervalCoverage], providerSymbol: { provider: "tencent", symbol: "700" } });
    store.commitIntervalMarketData({ instrumentId: instrument.id, interval: "15m", candles: [candle], coverage: [intervalCoverage], providerSymbol: { provider: "tencent", symbol: "700" } });
    expect(store.getCandles(instrument.id, "15m", "2026-01-02T00:00:00.000Z", "2026-01-02T02:00:00.000Z")).toHaveLength(1);
    expect(() => store.commitIntervalMarketData({ instrumentId: instrument.id, interval: "1D", candles: [candle], coverage: [intervalCoverage], providerSymbol: { provider: "tencent", symbol: "700" } })).toThrow("Invalid market data");
    expect(() => store.commitIntervalMarketData({ instrumentId: instrument.id, interval: "15m", candles: [candle], coverage: [{ ...intervalCoverage, interval: "1D" }], providerSymbol: { provider: "tencent", symbol: "700" } })).toThrow("Invalid market data");
    expect(() => store.commitMarketData({ instrumentId: "missing", candles: [], coverage: [], providerSymbol: { provider: "tencent", symbol: "missing" } })).toThrow("Unknown instrument: missing");
    const before = snapshotAllTables(store);
    expect(() => store.commitIntervalMarketData({ instrumentId: instrument.id, interval: "15m", candles: [candle, { ...candle, instrumentId: "other" }], coverage: [intervalCoverage], providerSymbol: { provider: "tencent", symbol: "700" } })).toThrow("Invalid market data");
    expect(snapshotAllTables(store)).toEqual(before);
  });

  it("rolls back all tables when one browser-state record is invalid", () => {
    const store = createStore();
    expect(() => store.mergeBrowserState(payload({ reviews: [{ episodeId: "invalid" } as never] }))).toThrow("Invalid review");

    expect(store.getBootstrap()).toMatchObject({ executions: [], instruments: [], reviews: [] });
  });

  it("rolls back data when recording the migration marker fails", () => {
    const store = createStore();
    const database = (store as unknown as { database: ReturnType<typeof openSqliteDatabase> }).database;
    database.exec("create trigger fail_marker before insert on data_migrations begin select raise(abort, 'marker failed'); end");

    expect(() => store.mergeBrowserState(payload())).toThrow("marker failed");
    expect(store.getBootstrap()).toMatchObject({ executions: [], instruments: [] });
  });

  it("rejects invalid nested browser state before any table is written", () => {
    const store = createStore();
    const invalidJob = { instrumentId: instrument.id, symbol: "700", market: "HK", requestedAt: "2026-01-01T00:00:00.000Z", status: "complete", intervals: [{ interval: "15m", status: 42 }] };

    expect(() => store.mergeBrowserState(payload({ marketDataJobs: [invalidJob as never] }))).toThrow("Invalid market data job");
    expect(store.getStatus().counts).toMatchObject({ instruments: 0, executions: 0, market_data_jobs: 0 });
  });

  it("rejects an unknown market-data job status before migration", () => {
    const store = createStore();
    const job = { instrumentId: instrument.id, symbol: "700", market: "HK", requestedAt: "2026-01-01T00:00:00.000Z", status: "unknown", intervals: [] };

    expect(() => store.mergeBrowserState(payload({ marketDataJobs: [job as never] }))).toThrow("Invalid market data job");
    expect(store.getStatus().counts.instruments).toBe(0);
  });

  it("rejects an unknown market-data interval status before migration", () => {
    const store = createStore();
    const job = { instrumentId: instrument.id, symbol: "700", market: "HK", requestedAt: "2026-01-01T00:00:00.000Z", status: "complete", intervals: [{ interval: "15m", status: "unknown" }] };

    expect(() => store.mergeBrowserState(payload({ marketDataJobs: [job as never] }))).toThrow("Invalid market data job");
    expect(store.getStatus().counts.instruments).toBe(0);
  });

  it("rejects malformed drawing anchors and nested undefined JSON values", () => {
    const store = createStore();
    const drawing = { version: 2, id: "drawing", episodeId: "episode", name: "bad", tool: "horizontal-line", anchors: [{ time: "", price: Number.NaN }], style: { color: "#fff", lineWidth: 1, opacity: 1 }, zIndex: 0, hidden: false, locked: false, visibleOn: "all", stage: "during-replay", createdAtCursor: "2026-01-01T00:00:00.000Z" };
    const state = { version: 2, episodeId: "episode", replayCursor: "2026-01-01T00:00:00.000Z", timeframe: "1D", activePanelTab: "notes", drawings: [drawing] };

    expect(() => store.mergeBrowserState(payload({ reviewStates: [state as never] }))).toThrow();
    expect(() => store.mergeBrowserState(payload({ sourceFingerprint: "nested-undefined", providerSymbols: [{ instrumentId: instrument.id, provider: "yahoo", providerSymbol: "700", metadata: { invalid: undefined } }] }))).toThrow("Invalid provider metadata");
    expect(store.getStatus().counts.instruments).toBe(0);
  });

  it("rejects nested undefined in a market-data job before any table changes", () => {
    const store = createStore();
    const job = {
      instrumentId: instrument.id,
      symbol: instrument.symbol,
      market: instrument.market,
      requestedAt: "2026-01-01T00:00:00.000Z",
      status: "complete",
      intervals: [{
        interval: "15m",
        status: "complete",
        metadata: { invalid: undefined },
      }],
    };

    expectBrowserStateRejectionBeforeTransaction(
      store,
      payload({ marketDataJobs: [job as never] }),
    );
  });

  it("rejects nested undefined in settings before any table changes", () => {
    const store = createStore();

    expectBrowserStateRejectionBeforeTransaction(
      store,
      payload({ settings: { nested: { invalid: undefined } } }),
    );
  });

  it("rejects nested undefined in coverage before any table changes", () => {
    const store = createStore();
    const coverage = {
      instrumentId: instrument.id,
      adjustmentMode: "raw",
      metadata: { invalid: undefined },
    };

    expectBrowserStateRejectionBeforeTransaction(
      store,
      payload({ coverage: [coverage as never] }),
    );
  });
});
