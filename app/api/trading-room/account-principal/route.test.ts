import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { initializeSqlite } from "../../../../db/sqlite";
import { createAccountPrincipalHandlers } from "./route";
import { AccountPrincipalProvisionalStore } from "../../../lib/principal/account-principal-provisional-store";

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function openHandlers() {
  const database = new DatabaseSync(":memory:");
  databases.push(database);
  initializeSqlite(database);
  let tick = 0;
  const store = new AccountPrincipalProvisionalStore(database, () => `2026-09-26T00:00:0${tick++}.000Z`);
  return createAccountPrincipalHandlers(store);
}

const createBody = {
  accountId: "tradingview:simulation:default",
  currency: "CNY",
  amount: "100000",
  asOf: null,
  status: "provisional",
  source: "user-default",
  expectedRevision: null,
};

describe("/api/trading-room/account-principal", () => {
  it("returns the M1 public shape and protects revisions with a current-value 409", async () => {
    const handlers = openHandlers();

    const missing = await handlers.GET(new Request("http://localhost/api/trading-room/account-principal"));
    expect(missing.status).toBe(404);

    const created = await handlers.PUT(new Request("http://localhost/api/trading-room/account-principal", {
      method: "PUT",
      body: JSON.stringify(createBody),
    }));
    expect(created.status).toBe(200);
    const first = await created.json() as Record<string, unknown>;
    expect(first).toEqual({
      accountId: "tradingview:simulation:default",
      currency: "CNY",
      amount: "100000",
      asOf: null,
      status: "provisional",
      source: "user-default",
      revision: 0,
      updatedAt: "2026-09-26T00:00:00.000Z",
    });

    const updated = await handlers.PUT(new Request("http://localhost/api/trading-room/account-principal", {
      method: "PUT",
      body: JSON.stringify({ ...createBody, amount: "120000", expectedRevision: 0, asOf: "2026-09-15T00:00:00.000Z", status: "confirmed", source: "user-confirmed" }),
    }));
    expect(updated.status).toBe(200);
    const second = await updated.json() as Record<string, unknown>;
    expect(second).toMatchObject({ amount: "120000", revision: 1, status: "confirmed" });

    const stale = await handlers.PUT(new Request("http://localhost/api/trading-room/account-principal", {
      method: "PUT",
      body: JSON.stringify({ ...createBody, amount: "999", expectedRevision: 0 }),
    }));
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      error: { code: "revision-conflict" },
      current: second,
      currentRecord: second,
    });

    const reloaded = await handlers.GET(new Request("http://localhost/api/trading-room/account-principal?accountId=tradingview%3Asimulation%3Adefault"));
    expect(await reloaded.json()).toEqual(second);
  });

  it("rejects unknown query keys and missing CAS fields before storage", async () => {
    const handlers = openHandlers();

    expect((await handlers.GET(new Request("http://localhost/api/trading-room/account-principal?run=x"))).status).toBe(400);
    expect((await handlers.PUT(new Request("http://localhost/api/trading-room/account-principal", {
      method: "PUT",
      body: JSON.stringify({ ...createBody, expectedRevision: undefined }),
    }))).status).toBe(400);
  });
});
