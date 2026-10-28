import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { SQLITE_MIGRATIONS } from "../../../db/sqlite-schema";
import type { TradeExecution } from "../trades/types";
import { SqliteStore } from "./sqlite-store";

const base: TradeExecution = {
  id: "a", accountId: "account-a", accountLabel: "Account A",
  instrument: { id: "US:ABC", symbol: "ABC", market: "US", name: "ABC", currency: "USD" },
  side: "buy", executedAt: "2026-01-02T03:04:05Z", quantity: "10", price: "100", fee: "0",
  source: { platform: "futu", fileFingerprint: "file-a", row: 1, tradeNature: "live" },
};

function withStore(run: (store: SqliteStore) => void) {
  const db = new DatabaseSync(":memory:");
  db.exec("pragma foreign_keys=on");
  for (const migration of SQLITE_MIGRATIONS) db.exec(migration.sql);
  try { run(new SqliteStore(db)); } finally { db.close(); }
}

describe("real Store reconciliation scope, synthetic memory database", () => {
  it("persists equal fills from separate accounts", () => withStore(store => {
    store.mergeTradeData({ executions: [base] });
    const other = { ...base, id: "b", accountId: "account-b", source: { ...base.source, fileFingerprint: "file-b" } };
    expect(store.mergeTradeData({ executions: [other] })).toMatchObject({ inserted: 1, duplicate: 0, conflict: 0 });
    expect(store.getExecutions().map(row => row.accountId).sort()).toEqual(["account-a", "account-b"]);
  }));

  it("retains stable-row multiplicity and makes row-ID-changing retries idempotent", () => withStore(store => {
    const second = { ...base, id: "b", source: { ...base.source, row: 2 } };
    store.mergeTradeData({ executions: [base, second] });
    expect(store.mergeTradeData({ executions: [{ ...base, id: "retry-a" }, { ...second, id: "retry-b" }] })).toMatchObject({ inserted: 0, duplicate: 2, conflict: 0 });
    expect(store.getExecutions().map(row => row.id)).toEqual(["a", "b"]);
  }));

  it.each([-1, 1.5])("does not silently add a same-file retry of a persisted malformed row %s", row => withStore(store => {
    const existing = { ...base, source: { ...base.source, row } };
    store.mergeTradeData({ executions: [existing] });
    expect(store.getExecutions()[0].source.row).toBe(row);
    expect(store.mergeTradeData({ executions: [{ ...existing, id: "retry" }] })).toMatchObject({ inserted: 0, duplicate: 0, conflict: 1 });
    expect(store.getExecutions().map(row => row.id)).toEqual(["a"]);
  }));

  it.each([-1, 1.5])("keeps same-file incoming row %s reviewable against a valid stored row", row => withStore(store => {
    store.mergeTradeData({ executions: [base] });
    const incoming = { ...base, id: "retry", source: { ...base.source, row } };
    expect(store.mergeTradeData({ executions: [incoming] })).toMatchObject({ inserted: 0, duplicate: 0, conflict: 1 });
    expect(store.getExecutions().map(row => row.id)).toEqual(["a"]);
    expect(store.getExecutions()[0].source.row).toBe(1);
  }));

  it.each([Infinity,-Infinity,NaN])("rejects non-JSON incoming row %s without changing the original fact", row=>withStore(store=>{
    store.mergeTradeData({executions:[base]});
    const before=store.getExecutions();
    expect(()=>store.mergeTradeData({executions:[{...base,id:"retry",source:{...base.source,row}}]})).toThrowError(expect.objectContaining({code:"INVALID_INPUT"}));
    expect(store.getExecutions()).toEqual(before);
  }));

  it("reports cross-file ambiguity while preserving the stored execution", () => withStore(store => {
    store.mergeTradeData({ executions: [base] });
    expect(store.mergeTradeData({ executions: [{ ...base, id: "b", source: { ...base.source, fileFingerprint: "file-b" } }] })).toMatchObject({ inserted: 0, duplicate: 0, conflict: 1 });
    expect(store.getExecutions().map(row => row.id)).toEqual(["a"]);
  }));

  it("persists unresolved nature separately from explicit live nature", () => withStore(store => {
    store.mergeTradeData({ executions: [base] });
    const unresolved = { ...base, id: "b", source: { ...base.source, fileFingerprint: "file-b", tradeNature: "unknown" as const } };
    expect(store.mergeTradeData({ executions: [unresolved] })).toMatchObject({ inserted: 1, duplicate: 0, conflict: 0 });
    expect(store.getExecutions()).toHaveLength(2);
  }));
});
