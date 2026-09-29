import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { initializeSqlite } from "../../../db/sqlite";
import {
  type CashBaselineMutation,
} from "./cash-baseline-contracts";
import { CASH_SETTINGS_KEY } from "./cash-model";
import { CashBaselineRevisionConflictError, CashBaselineStore } from "./cash-baseline-store";

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function openStore() {
  const database = new DatabaseSync(":memory:");
  databases.push(database);
  initializeSqlite(database);
  let tick = 0;
  const store = new CashBaselineStore(database, () => `2026-09-26T00:00:0${tick++}.000Z`);
  return { database, store };
}

const canonicalMutation = (overrides: Partial<CashBaselineMutation> = {}): CashBaselineMutation => ({
  scope: { nature: "simulation", simulationRunId: null },
  accountId: "tradingview:simulation:default",
  currency: "CNY",
  balance: "100000",
  asOf: "2026-09-01T00:00:00.000Z",
  source: "user-default",
  expectedRevision: null,
  ...overrides,
});

describe("CashBaselineStore", () => {
  it("creates a canonical baseline at revision zero and reads no history", () => {
    const { store } = openStore();

    expect(store.read()).toEqual({ version: 1, records: [], history: [] });
    const saved = store.save(canonicalMutation());

    expect(saved.previous).toBeNull();
    expect(saved.record).toMatchObject({
      accountId: "tradingview:simulation:default",
      balance: "100000",
      source: "user-default",
      revision: 0,
    });
    expect(saved.state.records).toEqual([saved.record]);
    expect(saved.state.history).toEqual([]);
  });

  it("uses CAS for revisions and appends the previous record in the same settings value", () => {
    const { database, store } = openStore();
    const first = store.save(canonicalMutation());
    const second = store.save(canonicalMutation({
      balance: "101000",
      asOf: "2026-09-02T00:00:00.000Z",
      source: "user-confirmed",
      expectedRevision: first.record.revision,
    }));

    expect(second.record).toMatchObject({ balance: "101000", source: "user-confirmed", revision: 1 });
    expect(second.previous).toEqual(first.record);
    expect(second.state.history).toEqual([expect.objectContaining({
      balance: "100000",
      asOf: "2026-09-01T00:00:00.000Z",
      source: "user-default",
      revision: 0,
      recordedAt: "2026-09-26T00:00:01.000Z",
    })]);

    expect(() => store.save(canonicalMutation({ balance: "999", expectedRevision: 0 }))).toThrow(CashBaselineRevisionConflictError);
    expect(store.read().records).toEqual([second.record]);
    const row = database.prepare("select value_json from app_settings where key = ?").get(CASH_SETTINGS_KEY) as { value_json: string };
    expect(JSON.parse(row.value_json)).toMatchObject({ records: [second.record], history: second.state.history });
  });

  it("maps legacy records to source legacy and revision zero without merging their run scope", () => {
    const { database, store } = openStore();
    database.prepare("insert into app_settings (key, value_json) values (?, ?)").run(CASH_SETTINGS_KEY, JSON.stringify({
      version: 1,
      records: [{
        id: "legacy-run",
        scope: { nature: "simulation", simulationRunId: "run-a" },
        accountId: "legacy-account",
        currency: "CNY",
        balance: "8",
        asOf: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      }],
    }));

    expect(store.read()).toMatchObject({ records: [expect.objectContaining({ source: "legacy", revision: 0 })], history: [] });
    expect(store.read({ nature: "simulation", simulationRunId: null }).records).toEqual([]);
    expect(store.read({ nature: "simulation", simulationRunId: "run-a" }).records).toHaveLength(1);
  });

  it("does not silently drop a corrupt append-only history", () => {
    const { database, store } = openStore();
    database.prepare("insert into app_settings (key, value_json) values (?, ?)").run(CASH_SETTINGS_KEY, JSON.stringify({ version: 1, records: [], history: [{ revision: "bad" }] }));

    expect(() => store.read()).toThrow("现金基准历史内容无效");
  });
});
