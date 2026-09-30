import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it, vi } from "vitest";

import { initializeSqlite } from "../../../../../db/sqlite";

import {
  CASH_SETTINGS_KEY,
  emptyCashBaselineState,
  type CashBaselineRecord,
  type CashBaselineState,
} from "../../../../lib/cash/cash-model";
import { CashBaselineStore } from "../../../../lib/cash/cash-baseline-store";
import type { CashBaselineStorageState } from "../../../../lib/cash/cash-baseline-contracts";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../../../../lib/trades/tradingview-account-identity";
import { createCashBaselineHandlers, type CashSettingsStore } from "./route";

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function memoryStore(initial: CashBaselineState = emptyCashBaselineState()): CashSettingsStore & { settings: Record<string, unknown> } {
  let settings: Record<string, unknown> = { [CASH_SETTINGS_KEY]: initial };
  const store = {
    getSettings: vi.fn(() => settings),
    putSettings: vi.fn((next: Record<string, unknown>) => { settings = { ...settings, ...next }; }),
  } satisfies CashSettingsStore;
  return { ...store, get settings() { return settings; } };
}

const live = {
  scope: { nature: "live", simulationRunId: null },
  accountId: "account-a",
  currency: "CNY",
  balance: "-10.50",
  asOf: "2026-09-01T00:00:00.000Z",
  source: "test",
  expectedRevision: null,
} as const;

describe("/api/trading-room/cash/baselines", () => {
  it("exposes the persistent CAS/history contract and returns current on a stale write", async () => {
    const database = new DatabaseSync(":memory:");
    databases.push(database);
    initializeSqlite(database);
    let tick = 0;
    const store = new CashBaselineStore(database, () => `2026-09-26T00:00:0${tick++}.000Z`);
    const handlers = createCashBaselineHandlers(store);
    const body = {
      scope: { nature: "simulation", simulationRunId: null },
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      currency: "CNY",
      balance: "100000",
      asOf: "2026-09-01T00:00:00.000Z",
      source: "user-default",
      expectedRevision: null,
    };

    const created = await handlers.PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify(body) }));
    expect(created.status).toBe(200);
    const first = await created.json() as CashBaselineStorageState;
    const firstRecord = first.records[0];
    if (!firstRecord) throw new Error("cash baseline create did not return a record");
    expect(first).toMatchObject({ records: [expect.objectContaining({ balance: "100000", revision: 0, source: "user-default" })], history: [] });

    const updated = await handlers.PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ ...body, id: firstRecord.id, balance: "101000", source: "user-confirmed", expectedRevision: 0 }),
    }));
    expect(updated.status).toBe(200);
    const second = await updated.json() as CashBaselineStorageState;
    expect(second).toMatchObject({ records: [expect.objectContaining({ balance: "101000", revision: 1 })], history: [expect.objectContaining({ balance: "100000", revision: 0 })] });

    const stale = await handlers.PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ ...body, id: firstRecord.id, balance: "999", expectedRevision: 0 }),
    }));
    expect(stale.status).toBe(409);
    const currentRecord = second.records[0];
    if (!currentRecord) throw new Error("cash baseline update did not return a record");
    expect(await stale.json()).toMatchObject({ error: { code: "revision-conflict" }, current: currentRecord });
  });

  it("persists a baseline and reads the edited value back by its account/currency scope", async () => {
    const store = memoryStore();
    const handlers = createCashBaselineHandlers(store);

    const saved = await handlers.PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify(live),
    }));
    expect(saved.status).toBe(200);
    const first = await saved.json() as CashBaselineState;
    expect(first.records).toHaveLength(1);
    expect(first.records[0]).toMatchObject({
      scope: live.scope,
      accountId: live.accountId,
      currency: live.currency,
      balance: "-10.5",
      asOf: live.asOf,
    });

    const edited = await handlers.PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ ...live, id: first.records[0].id, balance: "99.25", asOf: "2026-09-02T00:00:00.000Z" }),
    }));
    expect(edited.status).toBe(200);
    const state = await edited.json() as CashBaselineState;
    expect(state.records).toHaveLength(1);
    expect(state.records[0]).toMatchObject({ id: first.records[0].id, balance: "99.25", asOf: "2026-09-02T00:00:00.000Z" });
    expect(store.putSettings).toHaveBeenCalledWith({ [CASH_SETTINGS_KEY]: state });

    const reopened = await handlers.GET(new Request("http://localhost"));
    expect(await reopened.json()).toEqual(state);
  });

  it("keeps legacy simulation runs separate and accepts the canonical whole-account scope", async () => {
    const store = memoryStore();
    const handlers = createCashBaselineHandlers(store);
    const simulation = await handlers.PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ ...live, scope: { nature: "simulation", simulationRunId: "run-a" }, balance: "5" }),
    }));
    expect(simulation.status).toBe(200);
    const invalid = await handlers.PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify({
        ...live,
        accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
        scope: { nature: "simulation", simulationRunId: null },
        source: "user-default",
        expectedRevision: null,
      }),
    }));
    expect(invalid.status).toBe(200);
    const state = await (await handlers.GET(new Request("http://localhost"))).json() as CashBaselineState;
    expect(state.records).toHaveLength(2);
    expect(state.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: { nature: "simulation", simulationRunId: "run-a" }, accountId: "account-a" }),
      expect.objectContaining({ scope: { nature: "simulation", simulationRunId: null }, accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID }),
    ]));
  });

  it("applies an account filter even when nature is omitted", async () => {
    const store = memoryStore({
      version: 1,
      records: [
        { id: "a", ...live, balance: "1", updatedAt: "2026-09-26T00:00:00.000Z" },
        { id: "b", ...live, accountId: "account-b", balance: "2", updatedAt: "2026-09-26T00:00:00.000Z" },
      ],
    });
    const response = await createCashBaselineHandlers(store).GET(new Request("http://localhost?accountId=account-b"));
    expect(await response.json()).toMatchObject({ records: [{ id: "b", accountId: "account-b" }] });
  });

  it("keeps an edited id unique across an identity change and rejects a target collision", async () => {
    const original: CashBaselineRecord = { ...live, id: "a", currency: "CNY", balance: "1", updatedAt: "2026-09-26T00:00:00.000Z" };
    const movedStore = memoryStore({ version: 1, records: [original] });
    const moved = await createCashBaselineHandlers(movedStore).PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ ...original, currency: "USD", balance: "2" }),
    }));
    expect(moved.status).toBe(200);
    expect((await moved.json() as CashBaselineState).records).toEqual([expect.objectContaining({ id: "a", currency: "USD", balance: "2" })]);

    const collisionStore = memoryStore({
      version: 1,
      records: [
        original,
        { ...original, id: "b", currency: "USD", balance: "3" },
      ],
    });
    const collision = await createCashBaselineHandlers(collisionStore).PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ ...original, currency: "USD", balance: "4" }),
    }));
    expect(collision.status).toBe(400);
  });

  it("rejects malformed values and maps storage errors without mutating settings", async () => {
    const store = memoryStore();
    const handlers = createCashBaselineHandlers(store);
    for (const body of [
      { ...live, currency: "EUR" },
      { ...live, balance: "NaN" },
      { ...live, asOf: "2026-09-01" },
      { ...live, accountId: "" },
    ]) {
      expect((await handlers.PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify(body) }))).status).toBe(400);
    }
    expect(store.putSettings).not.toHaveBeenCalled();
    expect((await handlers.PUT(new Request("http://localhost", { method: "PUT", body: "{" }))).status).toBe(400);

    const failing = memoryStore();
    if (!failing.getSettings) throw new Error("memory cash settings store must expose getSettings");
    vi.mocked(failing.getSettings).mockImplementation(() => { throw new Error("db unavailable"); });
    expect((await createCashBaselineHandlers(failing).GET(new Request("http://localhost"))).status).toBe(503);

    const malformed = memoryStore({ version: 1, records: [{ ...live, id: "bad", balance: "NaN", updatedAt: "2026-09-26T00:00:00.000Z" }] });
    expect((await createCashBaselineHandlers(malformed).GET(new Request("http://localhost"))).status).toBe(503);
  });
});
