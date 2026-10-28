import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite";
import type { TradeExecution } from "../trades/types";
import type { BrowserStatePayload } from "./sqlite-contracts";
import { SqliteStore, createTradeChanges } from "./sqlite-store";

const instrument = { id: "HK:700", symbol: "700", name: "Synthetic", market: "HK", currency: "HKD" };
const original: TradeExecution = {
  id: "original", instrument, accountId: "synthetic-account", accountLabel: "Synthetic",
  source: { platform: "broker", row: 1, fileName: "synthetic.csv" },
  side: "buy", executedAt: "2026-01-02T03:04:05Z", quantity: "100", price: "123.45", fee: "0.01",
};
const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach(database => database.close()));

function setup() {
  const database = new DatabaseSync(":memory:");
  databases.push(database);
  initializeSqlite(database);
  const store = new SqliteStore(database);
  store.mergeExecutions([original]);
  return { database, store };
}

function tables(database: DatabaseSync) {
  const names = database.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name").all() as { name: string }[];
  return Object.fromEntries(names.map(({ name }) => [name, database.prepare(`select * from "${name}" order by rowid`).all()]));
}

function browserState(executions: TradeExecution[], instruments: BrowserStatePayload["instruments"] = []): BrowserStatePayload {
  return {
    version: 1, sourceClientId: "synthetic-browser", sourceFingerprint: "synthetic-migration",
    executions, instruments, importHistory: [], reviews: [], reviewStates: [], tagSuggestions: [],
    marketDataJobs: [], dailyCandles: [], marketCandles: [], coverage: [], intervalCoverage: [],
    providerSymbols: [], settings: { synthetic: true },
  };
}

type Entry = { name: string; write: (store: SqliteStore, records: TradeExecution[]) => unknown };
const entries: Entry[] = [
  { name: "mergeExecutions", write: (store, records) => store.mergeExecutions(records) },
  { name: "versioned explicit replacement", write: (store, records) => reviewedReplace(store,records) },
  { name: "mergeBrowserState", write: (store, records) => store.mergeBrowserState(browserState(records)) },
  { name: "reviseTrades", write: (store, records) => store.reviseTrades({
    id: "synthetic-revision", instrumentId: instrument.id, accountId: original.accountId, reason: "Synthetic correction",
    changes: [{ before: original, after: null }, ...records.map(after => ({ before: null, after }))],
  }) },
];

function reviewedReplace(store: SqliteStore, records: TradeExecution[]) {
  const database = (store as unknown as {
    database: DatabaseSync;
  }).database;
  const changes = createTradeChanges(database);
  const plan = changes.prepare({
    kind: "revision",
    revision: {
      id: "versioned-replacement",
      instrumentId: original.instrument.id,
      accountId: original.accountId,
      reason: "Reviewed replacement",
      changes: [{ before: original, after: records.find(row => row.id === original.id) ?? null }, ...records.filter(row => row.id !== original.id).map(after => ({ before: null, after }))]
    }
  });
  return changes.commit({ requestId: "versioned-replacement", planId: plan.planId, choices: {} }).result.report;
}

const invalid: { name: string; patch: Partial<TradeExecution> }[] = [
  { name: "invalid time", patch: { executedAt: "not-a-date" } },
  { name: "invalid calendar day", patch: { executedAt: "2026-02-30" } },
  { name: "invalid instant day", patch: { executedAt: "2026-02-30T12:00:00Z" } },
  { name: "timezone missing", patch: { executedAt: "2026-01-02T12:00:00" } },
  ...["not-a-number", "NaN", "Infinity", "-Infinity", "0", "-1", "", " ", "0x10"].map(quantity => ({ name: `quantity ${JSON.stringify(quantity)}`, patch: { quantity } })),
  ...["not-a-number", "NaN", "Infinity", "-1", ""].map(price => ({ name: `price ${JSON.stringify(price)}`, patch: { price } })),
  ...["bad-fee", "NaN", "Infinity", "-1", "", " "].map(fee => ({ name: `fee ${JSON.stringify(fee)}`, patch: { fee } })),
];

describe.each(entries)("formal fact invariant: $name", ({ write }) => {
  it.each(invalid)("rejects $name and leaves every table unchanged", ({ patch }) => {
    const { database, store } = setup();
    const before = tables(database);
    const valid = { ...original, id: "valid-first", executedAt: "2026-01-03T03:04:05Z" };
    const bad = { ...original, id: "invalid-last", executedAt: "2026-01-04T03:04:05Z", ...patch };
    expect(() => write(store, [valid, bad])).toThrow();
    expect(tables(database)).toEqual(before);
    expect(store.getExecutions()).toEqual([original]);
  });

  it("round-trips zero price, date precision, unknown fees and decimal text exactly", () => {
    const { database, store } = setup();
    const record: TradeExecution = {
      ...original, id: "legal-date", executedAt: "2024-02-29", price: "0.000000000000000000000000000",
      quantity: "1000000000000000000.000000000000000001", fee: "0",
      source: { ...original.source, timePrecision: "date-only", sourceTimeKind: "date", feeStatus: "unknown", sourceOrder: 7 },
    };
    write(store, [record]);
    expect(store.getExecutions().find(execution => execution.id === record.id)).toEqual(record);
    expect(database.prepare("select quantity, price, fee, executed_at from executions where id = ?").get(record.id)).toEqual({
      quantity: "1000000000000000000.000000000000000001", price: "0.000000000000000000000000000", fee: "0", executed_at: "2024-02-29",
    });
  });

  it("preserves offset instants, exponent decimals and original settlement currency", () => {
    const { store } = setup();
    const record: TradeExecution = {
      ...original, id: "settlement", executedAt: "2026-01-05T09:30:00+08:00", quantity: "1e-400", price: "1e309", fee: "1e-3",
      source: { ...original.source, feeStatus: "reported", settlement: {
        currency: "CNY", quantity: "100.000000000000000001", grossAmount: "12345.000000000000000001", netAmount: "-12345.125000000000000001", fees: { commission: "0.125000000000000000" },
      } },
    };
    write(store, [record]);
    expect(store.getExecutions().find(execution => execution.id === record.id)).toEqual(record);
  });
});

describe("instrument identity protection", () => {
  for (const entry of [
    { name: "mergeExecutions", write: (store: SqliteStore, records: TradeExecution[]) => store.mergeExecutions(records) },
    { name: "mergeTradeData", write: (store: SqliteStore, records: TradeExecution[]) => store.mergeTradeData({ executions: records }) },
    { name: "mergeBrowserState", write: (store: SqliteStore, records: TradeExecution[]) => store.mergeBrowserState(browserState(records)) },
  ]) {
    it(`rejects ${entry.name} identity conflicts even when reconciliation would skip them`, () => {
      const { database, store } = setup();
      const before = tables(database);
      const unrelated = { ...original, id: "valid-first", executedAt: "2026-01-03T03:04:05Z" };
      const duplicate = { ...original, instrument: { ...instrument, symbol: "0700" } };
      expect(() => entry.write(store, [unrelated, duplicate])).toThrow();
      expect(tables(database)).toEqual(before);
    });
  }

  for (const [field, value] of [["symbol", "OTHER"], ["market", "US"], ["currency", "USD"]] as const) {
    it(`rejects instrument-only ${field} rewrite without changing the historical JOIN`, () => {
      const { database, store } = setup();
      const before = tables(database);
      expect(() => store.mergeTradeData({ instruments: [{ ...instrument, [field]: value }], executions: [] })).toThrow();
      expect(tables(database)).toEqual(before);
      expect(store.getExecutions()[0].instrument).toEqual(instrument);
      expect(database.prepare("select currency from executions where id = ?").get(original.id)).toEqual({ currency: "HKD" });
    });

    it(`rolls back browser migration when its ${field} conflicts`, () => {
      const { database, store } = setup();
      const before = tables(database);
      const newInstrument = { id: "US:NEW", symbol: "NEW", market: "US", currency: "USD", name: "New" };
      expect(() => store.mergeBrowserState(browserState([], [newInstrument, { ...instrument, [field]: value }]))).toThrow();
      expect(tables(database)).toEqual(before);
    });

    for (const entry of entries) {
      it(`rejects ${entry.name} with changed ${field} and no partial facts or audit`, () => {
        const { database, store } = setup();
        const before = tables(database);
        const changed = { ...original, id: "changed", executedAt: "2026-01-03T03:04:05Z", instrument: { ...instrument, [field]: value } };
        expect(() => entry.write(store, [changed])).toThrow();
        expect(tables(database)).toEqual(before);
      });
    }
  }

  it("allows display names and resolved metadata while preserving execution and instrument identity", () => {
    const { database, store } = setup();
    const before = database.prepare("select * from executions").all();
    store.mergeTradeData({ instruments: [{ ...instrument, name: "Updated display name" }], executions: [] });
    store.putInstrumentMetadata({ market: "HK", symbol: "700", name: "Official display", assetType: "stock", source: "hkex", confidence: "official", resolvedAt: "2026-10-25T00:00:00Z" });
    expect(store.getExecutions()[0].instrument).toMatchObject({ ...instrument, name: "Updated display name" });
    expect(store.getInstruments()[0].metadata?.name).toBe("Official display");
    expect(database.prepare("select * from executions").all()).toEqual(before);
  });

  it("does not let a metadata refresh silently correct a historical identity", () => {
    const { database, store } = setup();
    database.prepare("update instruments set symbol = ? where id = ?").run("HISTORICAL", instrument.id);
    const before = tables(database);
    expect(() => store.putInstrumentMetadata({ market: "HK", symbol: "700", name: "Official display", assetType: "stock", source: "hkex", confidence: "official", resolvedAt: "2026-10-25T00:00:00Z" })).toThrow();
    expect(tables(database)).toEqual(before);
    expect(store.getExecutions()[0].instrument.symbol).toBe("HISTORICAL");
  });
});

it("keeps historical invalid facts unchanged while accepting unrelated legal writes", () => {
  const { database, store } = setup();
  database.prepare("update executions set quantity = ?, price = ?, fee = ?, executed_at = ? where id = ?").run("invalid-legacy", "-1", "bad-legacy", "legacy-time", original.id);
  const before = database.prepare("select * from executions where id = ?").get(original.id);
  const legal = { ...original, id: "unrelated", executedAt: "2026-01-05T03:04:05Z" };
  store.mergeExecutions([legal]);
  expect(database.prepare("select * from executions where id = ?").get(original.id)).toEqual(before);
  expect(store.getExecutions().find(execution => execution.id === legal.id)).toEqual(legal);
});

describe("explicit replacement ID collision safety", () => {
  for (const corrected of [false, true]) {
    for (const sameContent of [true, false]) {
      it(`rejects an untouched ID with ${sameContent ? "same" : "different"} content in an ${corrected ? "audited-correction" : "ordinary"} replacement batch without changing any table`, () => {
        const { database, store } = setup();
        const untouched = { ...original, id: "untouched", quantity: sameContent ? original.quantity : "200" };
        store.reviseTrades({
          id: "existing-audit", instrumentId: instrument.id, accountId: original.accountId,
          reason: "Previously confirmed addition", changes: [{ before: null, after: untouched }],
        });
        const history = {
          id: "existing-import", fileName: "synthetic.csv", sourceLabel: "Synthetic",
          importedAt: "2026-01-02T04:00:00Z", tradeCount: 2, instrumentCount: 1,
          excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 0, unresolvedInstrumentCount: 0,
        };
        store.mergeTradeData({ executions: [], importHistory: [history] });
        if (corrected) {
          const accountCorrection = {
            originalAccountId: original.accountId, canonicalAccountId: "confirmed-canonical",
            reason: "User confirmed correction",
          };
          database.prepare("update executions set account = ?, evidence_json = ? where id = ?").run(
            accountCorrection.canonicalAccountId,
            JSON.stringify({ source: original.source, accountLabel: original.accountLabel, accountCorrection, importAudit: { retained: true } }),
            original.id,
          );
        }
        const before = tables(database);
        const beforeExecutions = store.getExecutions();
        const newInstrument = { id: "US:NEW", symbol: "NEW", name: "New", market: "US", currency: "USD" };
        expect.soft(() => store.mergeTradeData({
          instruments: [newInstrument, { ...instrument, name: "Changed display" }],
          executions: [
            { ...original, id: "valid-first", instrument: newInstrument, executedAt: "2026-01-04T03:04:05Z" },
            { ...original, id: untouched.id },
          ],
          replaceExecutionIds: [original.id],
          importHistory: [{ ...history, tradeCount: 99 }, { ...history, id: "new-import" }],
        })).toThrowError(expect.objectContaining({code:"VERSION_REQUIRED"}));
        expect.soft(store.getExecutions()).toEqual(beforeExecutions);
        expect(tables(database)).toEqual(before);
      });
    }
  }

  it.each([original.id, "new-replacement"])("allows a selected or absent incoming ID: %s", id => {
    const { store } = setup();
    const replacement = { ...original, id, quantity: "200" };
    expect(reviewedReplace(store,[replacement])).toEqual({ inserted: 1, duplicate: 0, conflict: 0 });
    expect(store.getExecutions()).toEqual([replacement]);
  });
});

describe("audited account correction compatibility", () => {
  function protect(database: DatabaseSync, source = original.source) {
    const accountCorrection = { originalAccountId: original.accountId, canonicalAccountId: "confirmed-canonical", reason: "User confirmed correction" };
    const evidence = { source, accountLabel: original.accountLabel, accountCorrection, importAudit: { retained: true } };
    database.prepare("update executions set account = ?, evidence_json = ? where id = ?").run(accountCorrection.canonicalAccountId, JSON.stringify(evidence), original.id);
    return evidence;
  }

  it("carries an existing correction to a uniquely trusted source row when its parser ID changes", () => {
    const { database, store } = setup();
    const source = { ...original.source, fileFingerprint: "synthetic-fingerprint" };
    const evidence = protect(database, source);
    const reimport = { ...original, id: "new-parser-id", source: { ...source, inputKind: "statement" as const, feeStatus: "reported" as const } };
    expect(store.mergeExecutions([reimport])).toEqual({ inserted: 1, duplicate: 1, conflict: 0 });
    expect(store.getExecutions()).toEqual([{ ...reimport, accountId: "confirmed-canonical" }]);
    expect(database.prepare("select evidence_json from executions where id = ?").get(reimport.id)).toEqual({
      evidence_json: JSON.stringify({ ...evidence, source: reimport.source }),
    });
  });

  it("rolls back a whole batch when equal values cannot inherit an audited correction", () => {
    const { database, store } = setup();
    protect(database);
    const before = tables(database);
    const valid = { ...original, id: "valid-first", executedAt: "2026-01-03T03:04:05Z" };
    const untrusted = { ...original, id: "different-document", source: { ...original.source, fileName: "different-document.csv" } };
    expect(() => store.mergeExecutions([valid, untrusted])).toThrow("Account correction replacement identity conflict");
    expect(tables(database)).toEqual(before);
  });
});
