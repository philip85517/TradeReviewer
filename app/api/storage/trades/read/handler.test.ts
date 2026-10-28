import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeSqlite } from "../../../../../db/sqlite-initialization";
import { createTradeReadHandler } from "./handler";

const owned: DatabaseSync[] = [];
afterEach(() => { for (const db of owned.splice(0)) db.close(); });
describe("injected production trade read handler", () => {
  it("rejects invalid JSON/selections before acquiring a database", async () => {
    const getDatabase = vi.fn((): DatabaseSync => { throw new Error("must not acquire"); });
    const handler = createTradeReadHandler(getDatabase);
    for (const body of ["invalid-json", JSON.stringify({ pageSize: 0 }), JSON.stringify({ cursor: "broken" }), JSON.stringify({ unexpected: true })]) {
      const response = await handler(new Request("http://workspace.invalid/api/storage/trades/read", { method: "POST", body }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "INVALID_INPUT", category: "input" } });
    }
    expect(getDatabase).not.toHaveBeenCalled();
  });
  it("reads initialized injected storage and leaves its connection ownership with the caller", async () => {
    const db = new DatabaseSync(":memory:"); owned.push(db); initializeSqlite(db);
    const getDatabase = vi.fn(() => db);
    const response = await createTradeReadHandler(getDatabase)(new Request("http://workspace.invalid/api/storage/trades/read", { method: "POST", body: "{}" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ snapshot: { facts: [], displayExecutionIds: [], receipt: { totalDisplayFacts: 0 } }, display: { executions: [], instruments: [], importHistory: [] } });
    expect(getDatabase).toHaveBeenCalledTimes(1);
    expect(db.isTransaction).toBe(false);
    expect(db.prepare("select 1 as alive").get()).toMatchObject({ alive: 1 });
  });
});
