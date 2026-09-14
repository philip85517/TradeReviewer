import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite";
import { SqliteStore } from "./sqlite-store";
import type { TradeExecution } from "../trades/types";
const instrument = { id: "US:CTVA", symbol: "CTVA", name: "Corteva", market: "US", currency: "USD" };
const execution: TradeExecution = { id: "original", instrument, accountId: "a", accountLabel: "账户A", source: { platform: "tiger", row: 0, sourceTimestampText: "原始凭证时间" }, executedAt: "2026-07-24T13:48:50Z", side: "buy", quantity: "100", price: "88.77", fee: "0" };
const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach((db) => db.close()));
function setup() { const db = new DatabaseSync(":memory:"); databases.push(db); initializeSqlite(db); const store = new SqliteStore(db); store.mergeTradeData({ executions: [execution] }); return { store, db }; }
it("atomically revises, records original evidence, and makes retries idempotent", () => {
  const { store } = setup();
  const input = { id: "request-1", instrumentId: instrument.id, accountId: "a", reason: "核对原凭证数量", changes: [{ before: execution, after: { ...execution, quantity: "200" } }] };
  store.reviseTrades(input); store.reviseTrades(input);
  expect(store.getExecutions()[0].quantity).toBe("200");
  expect(store.getTradeRevisions(instrument.id)).toHaveLength(1);
  expect(store.getTradeRevisions(instrument.id)[0].changes[0].before).toEqual(execution);
  expect(() => store.reviseTrades({ ...input, id: "stale" })).toThrow(/conflict/i);
  expect(() => store.reviseTrades({ ...input, reason: "重用请求号" })).toThrow(/conflict/i);
});
it("rejects off-scope, invalid, and mixed stale changes without partial writes", () => {
  const { store } = setup();
  const base = { id: "bad", instrumentId: instrument.id, accountId: "a", reason: "修正" };
  expect(() => store.reviseTrades({ ...base, changes: [{ before: execution, after: { ...execution, accountId: "b" } }] })).toThrow();
  expect(() => store.reviseTrades({ ...base, changes: [{ before: execution, after: { ...execution, quantity: "-1" } }] })).toThrow();
  expect(() => store.reviseTrades({ ...base, changes: [{ before: null, after: { ...execution, id: "new" } }, { before: { ...execution, price: "999" }, after: null }] })).toThrow();
  expect(store.getExecutions()).toEqual([execution]); expect(store.getTradeRevisions(instrument.id)).toEqual([]);
});
it("supports explicit additions and removals while retaining their audit trail", () => {
  const { store } = setup();
  store.reviseTrades({ id: "add", instrumentId: instrument.id, accountId: "a", reason: "补录", changes: [{ before: null, after: { ...execution, id: "added", side: "sell", executedAt: "2026-07-29T15:01:17Z" } }] });
  store.reviseTrades({ id: "remove", instrumentId: instrument.id, accountId: "a", reason: "重复记录", changes: [{ before: execution, after: null }] });
  expect(store.getExecutions().map((e) => e.id)).toEqual(["added"]); expect(store.getTradeRevisions(instrument.id)).toHaveLength(2);
});
it("rolls back the execution edit if recording the audit fails", () => {
  const { store, db } = setup();
  db.exec("create trigger reject_revision before insert on trade_revisions begin select raise(abort, 'audit unavailable'); end");
  expect(() => store.reviseTrades({ id: "atomic", instrumentId: instrument.id, accountId: "a", reason: "核对", changes: [{ before: execution, after: null }] })).toThrow();
  expect(store.getExecutions()).toEqual([execution]);
});
it("rejects a changed scope snapshot and forged instrument identity", () => {
  const { store } = setup();
  const input = { id:"scope", instrumentId:instrument.id, accountId:"a", reason:"补充文件", expectedScope:[], changes:[{before:null,after:{...execution,id:"supplement"}}] };
  expect(()=>store.reviseTrades(input)).toThrow(/conflict/i);
  expect(()=>store.reviseTrades({...input,expectedScope:[execution],changes:[{before:null,after:{...execution,id:"supplement",instrument:{...instrument,symbol:"AAPL"}}}]})).toThrow(/Invalid/);
  store.reviseTrades({...input,expectedScope:[execution]});
  store.reviseTrades({...input,expectedScope:[execution]});
  expect(store.getExecutions()).toHaveLength(2);
  expect(store.getTradeRevisions(instrument.id)).toHaveLength(1);
});
it("does not let localized display metadata create a revision conflict", () => {
  const { store } = setup();
  const localizedName = {
    name: "科尔特瓦",
    locale: "zh-CN" as const,
    source: "tencent",
    resolvedAt: "2026-07-29T00:00:00.000Z",
  };
  const displaySnapshot = {
    ...execution,
    instrument: { ...instrument, localizedName },
  };

  store.mergeTradeData({
    instruments: [{ ...instrument, localizedName }],
    executions: [],
  });

  expect(store.getExecutions()[0]?.instrument.localizedName).toEqual(localizedName);
  store.reviseTrades({
    id: "localized-display",
    instrumentId: instrument.id,
    accountId: "a",
    reason: "修正数量",
    expectedScope: [displaySnapshot],
    changes: [{
      before: displaySnapshot,
      after: { ...displaySnapshot, quantity: "200" },
    }],
  });
  expect(store.getExecutions()[0]?.quantity).toBe("200");

  expect(() => store.reviseTrades({
    id: "localized-stale",
    instrumentId: instrument.id,
    accountId: "a",
    reason: "使用旧交易快照",
    changes: [{
      before: displaySnapshot,
      after: { ...displaySnapshot, quantity: "300" },
    }],
  })).toThrow(/conflict/i);
});
