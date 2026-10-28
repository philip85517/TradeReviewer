import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openSqliteDatabase } from "../../../db/sqlite";
import { fileFor } from "../import/__fixtures__/tradingview";
import { parseBrokerStatement } from "../import/dispatcher";
import type { TradeExecution } from "../trades/types";
import { SqliteStore } from "./sqlite-store";

const directories: string[] = [];
const databases: ReturnType<typeof openSqliteDatabase>[] = [];

function openStore(path?: string) {
  if (!path) {
    const directory = mkdtempSync(join(tmpdir(), "broker-order-id-"));
    directories.push(directory);
    path = join(directory, "store.sqlite");
  }
  const database = openSqliteDatabase(path);
  databases.push(database);
  return { path, database, store: new SqliteStore(database) };
}

afterEach(() => {
  for (const database of databases.splice(0)) {
    if (database.isOpen) database.close();
  }
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const brokerExecution: TradeExecution = {
  id: "verified-ipo:futu:account:6049:5653048",
  accountId: "futu:account",
  accountLabel: "富途账户",
  instrument: { id: "HK:6049", market: "HK", symbol: "6049", name: "保利物业", currency: "HKD" },
  side: "buy",
  executedAt: "2019-12-18T01:30:00.000Z",
  quantity: "200",
  price: "35.4537",
  fee: "50",
  source: {
    platform: "futu",
    row: 18,
    page: 1,
    fileName: "futu-statement.pdf",
    fileFingerprint: "broker-statement-fingerprint",
    tradingDate: "2019-12-18",
    positionEffect: "open-long",
    displayTimePolicy: "session-open",
    sourceTradeId: "5653048",
    grossAmount: "7090.74",
  },
};

describe("broker order IDs in trade imports", () => {
  it.each([
    { name: "number", value: 5653048 },
    { name: "null", value: null },
    { name: "array", value: ["5653048"] },
    { name: "object", value: { id: "5653048" } },
  ])("rejects a $name broker order ID without persisting any part of the batch", ({ value }) => {
    const { store, database } = openStore();
    store.mergeTradeData({ executions: [brokerExecution] });
    const originalRows = database.prepare("select * from executions order by id").all();
    const originalInstruments = store.getInstruments();
    const originalHistory = store.getImportHistory();
    const newInstrument = { id: "HK:5", market: "HK", symbol: "5", name: "汇丰控股", currency: "HKD" };
    const valid = { ...brokerExecution, id: "valid-new-broker-order", instrument: newInstrument };
    const invalid = {
      ...valid, id: "invalid-new-broker-order", executedAt: "2019-12-19T01:30:00.000Z",
      source: { ...valid.source, sourceTradeId: value },
    };
    // JSON transport can supply values outside the TypeScript source contract.
    const payload = JSON.parse(JSON.stringify({
      instruments: [newInstrument],
      executions: [valid, invalid],
      importHistory: [{
        id: "rejected-broker-import", fileName: "broker.csv", sourceLabel: "券商成交",
        importedAt: "2026-10-24T00:00:00.000Z", tradeCount: 2, instrumentCount: 1,
      }],
    }));

    expect(() => store.mergeTradeData(payload)).toThrow(/source trade id/i);
    expect(database.prepare("select * from executions order by id").all()).toEqual(originalRows);
    expect(store.getInstruments()).toEqual(originalInstruments);
    expect(store.getImportHistory()).toEqual(originalHistory);
  });

  const validBrokerOrderIds: Array<{ name: string; source: Partial<TradeExecution["source"]> }> = [
    { name: "numeric text with leading zeros", source: { sourceTradeId: "0005653048" } },
    { name: "general text with surrounding whitespace", source: { sourceTradeId: " broker-001 " } },
    { name: "empty string", source: { sourceTradeId: "" } },
    { name: "whitespace-only string", source: { sourceTradeId: "   " } },
    { name: "missing order ID", source: {} },
  ];

  it.each(validBrokerOrderIds)("preserves a broker's $name after reopening", ({ source }) => {
    const first = openStore();
    const { sourceTradeId: _orderId, ...baseSource } = brokerExecution.source;
    const execution = { ...brokerExecution, source: { ...baseSource, ...source } };
    expect(first.store.mergeTradeData({ executions: [execution] })).toEqual({
      inserted: 1, duplicate: 0, conflict: 0,
    });
    first.database.close();

    const reopened = openStore(first.path);
    expect(reopened.store.getExecutions()).toStrictEqual([execution]);
  });

  it("resends a broker order alongside a TradingView pair and preserves its evidence after reopening", async () => {
    const first = openStore();
    expect(first.store.mergeTradeData({ executions: [brokerExecution] })).toEqual({
      inserted: 1, duplicate: 0, conflict: 0,
    });
    const originalRow = first.database.prepare("select * from executions where id = ?").get(brokerExecution.id);
    const { records } = await parseBrokerStatement(fileFor());
    expect(records).toHaveLength(2);

    expect(first.store.mergeTradeData({ executions: [...first.store.getExecutions(), ...records] })).toEqual({
      inserted: 2, duplicate: 1, conflict: 0,
    });
    expect(first.database.prepare("select * from executions where id = ?").get(brokerExecution.id)).toEqual(originalRow);
    first.database.close();

    const reopened = openStore(first.path);
    const restored = reopened.store.getExecutions();
    expect(restored).toHaveLength(3);
    expect(restored.find(record => record.id === brokerExecution.id)).toEqual(brokerExecution);
    for (const record of records) {
      expect(restored.find(candidate => candidate.id === record.id)).toEqual(record);
    }
    expect(reopened.store.mergeTradeData({ executions: restored })).toEqual({
      inserted: 0, duplicate: 3, conflict: 0,
    });
  });

  const explicitSimulationEvidence: Array<{ name: string; source: Partial<TradeExecution["source"]> }> = [
    { name: "legacy simulated nature", source: { tradingNature: "simulated" } },
    { name: "simulation nature", source: { tradeNature: "simulation" } },
    { name: "simulation run", source: { simulationRunId: "run-1" } },
    { name: "legacy simulation trade ID", source: { simulationTradeId: "1" } },
    { name: "simulation role", source: { simulationRole: "entry" } },
    { name: "simulation signal", source: { simulationSignal: "buy" } },
    { name: "legacy simulation report", source: { simulationReport: { netProfit: "10" } } },
    { name: "TradingView report", source: { sourceReport: {
      netPnl: "10", returnPercent: "1", favorableExcursion: "20", favorableExcursionPercent: "2",
      adverseExcursion: "-5", adverseExcursionPercent: "-0.5", cumulativePnl: "10",
      cumulativeReturnPercent: "1", durationBars: 3,
    } } },
  ];

  it.each(explicitSimulationEvidence)("rejects a broker carrying $name without writing any part of the batch", ({ source }) => {
    const { store } = openStore();
    const invalid = { ...brokerExecution, id: "invalid-simulation", source: { ...brokerExecution.source, ...source } };
    expect(() => store.mergeTradeData({ executions: [brokerExecution, invalid] })).toThrow(/simulation/i);
    expect(store.getExecutions()).toEqual([]);
    expect(store.getInstruments()).toEqual([]);
    expect(store.getImportHistory()).toEqual([]);
  });

  it("rejects a TradingView order ID without the required simulation evidence", () => {
    const { store } = openStore();
    const invalid = { ...brokerExecution, source: { ...brokerExecution.source, platform: "tradingview" } };
    expect(() => store.mergeTradeData({ executions: [invalid] })).toThrow(/simulation/i);
    expect(store.getExecutions()).toEqual([]);
  });
});
