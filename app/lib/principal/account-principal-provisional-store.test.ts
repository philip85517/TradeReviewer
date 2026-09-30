import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { initializeSqlite } from "../../../db/sqlite";
import {
  ACCOUNT_PRINCIPAL_PROVISIONAL_HISTORY_SETTINGS_KEY,
  type AccountPrincipalProvisionalDraft,
} from "./account-principal-provisional-contracts";
import {
  AccountPrincipalProvisionalConflictError,
  AccountPrincipalProvisionalStore,
} from "./account-principal-provisional-store";

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function openStore() {
  const database = new DatabaseSync(":memory:");
  databases.push(database);
  initializeSqlite(database);
  let tick = 0;
  const store = new AccountPrincipalProvisionalStore(database, () => `2026-09-26T00:00:0${tick++}.000Z`);
  return { database, store };
}

const canonicalDraft = (overrides: Partial<AccountPrincipalProvisionalDraft> = {}): AccountPrincipalProvisionalDraft => ({
  accountId: "tradingview:simulation:default",
  currency: "CNY",
  amount: "100000",
  asOf: null,
  status: "provisional",
  source: "user-default",
  expectedRevision: null,
  ...overrides,
});

describe("AccountPrincipalProvisionalStore", () => {
  it("stores one undated provisional principal without manufacturing a date", () => {
    const { store } = openStore();

    expect(store.read("tradingview:simulation:default")).toBeNull();
    const saved = store.save(canonicalDraft());

    expect(saved.record).toEqual({
      accountId: "tradingview:simulation:default",
      currency: "CNY",
      amount: "100000",
      asOf: null,
      status: "provisional",
      source: "user-default",
      revision: 0,
      updatedAt: "2026-09-26T00:00:00.000Z",
    });
    expect(saved.previous).toBeNull();
    expect(saved.history).toEqual([]);
    expect(store.history()).toEqual([]);
  });

  it("revises with CAS and appends the prior public record in app_settings", () => {
    const { database, store } = openStore();
    const first = store.save(canonicalDraft());
    const second = store.save(canonicalDraft({
      amount: "120000",
      asOf: "2026-09-15T00:00:00.000Z",
      status: "confirmed",
      source: "user-confirmed",
      expectedRevision: first.record.revision,
    }));

    expect(second.record).toMatchObject({ amount: "120000", asOf: "2026-09-15T00:00:00.000Z", status: "confirmed", revision: 1 });
    expect(second.previous).toEqual(first.record);
    expect(second.history).toEqual([expect.objectContaining({
      ...first.record,
      recordedAt: "2026-09-26T00:00:01.000Z",
    })]);
    expect(() => store.save(canonicalDraft({ amount: "999", expectedRevision: 0 }))).toThrow(AccountPrincipalProvisionalConflictError);
    expect(store.read("tradingview:simulation:default")).toEqual(second.record);

    const row = database.prepare("select value_json from app_settings where key = ?").get(ACCOUNT_PRINCIPAL_PROVISIONAL_HISTORY_SETTINGS_KEY) as { value_json: string };
    expect(JSON.parse(row.value_json)).toEqual(second.history);
  });

  it("rejects non-positive principal without creating a row", () => {
    const { database, store } = openStore();

    expect(() => store.save(canonicalDraft({ amount: "0" }))).toThrow();
    expect(database.prepare("select count(*) as count from account_principal_provisionals").get()).toEqual({ count: 0 });
  });
});
