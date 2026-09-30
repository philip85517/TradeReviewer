import { describe, expect, it } from "vitest";

import {
  createAccountPrincipalProvisionalClient,
} from "./account-principal-provisional-client";
import type { AccountPrincipalProvisional } from "./account-principal-provisional-contracts";

const record = {
  accountId: "tradingview:simulation:default",
  currency: "CNY",
  amount: "100000",
  asOf: null,
  status: "provisional",
  source: "user-default",
  revision: 0,
  updatedAt: "2026-09-26T00:00:00.000Z",
} satisfies AccountPrincipalProvisional;

describe("account principal provisional client", () => {
  it("reads the default account and keeps the public M1 shape", async () => {
    const calls: string[] = [];
    const client = createAccountPrincipalProvisionalClient(async (input) => {
      calls.push(input);
      return new Response(JSON.stringify(record));
    });

    await expect(client.read()).resolves.toEqual(record);
    expect(calls).toEqual(["/api/trading-room/account-principal"]);
  });

  it("returns the server current record on a CAS conflict", async () => {
    const current = { ...record, amount: "101000", revision: 1, source: "user-confirmed" };
    const client = createAccountPrincipalProvisionalClient(async () => new Response(JSON.stringify({
      error: { code: "revision-conflict", message: "stale" },
      current,
      currentRecord: current,
    }), { status: 409 }));

    await expect(client.revise({ ...record, expectedRevision: 0 })).rejects.toMatchObject({
      status: 409,
      code: "revision-conflict",
      current,
    });
  });

  it("rejects a successful response that cannot be a positive public record", async () => {
    const client = createAccountPrincipalProvisionalClient(async () => new Response(JSON.stringify({ ...record, amount: "0" })));

    await expect(client.read()).rejects.toMatchObject({ status: 200, code: "invalid-response" });
  });

  it("binds read and save responses to the requested account", async () => {
    const mismatched = { ...record, accountId: "other-account" };
    const client = createAccountPrincipalProvisionalClient(async () => new Response(JSON.stringify(mismatched)));

    await expect(client.read("requested-account")).rejects.toMatchObject({ code: "invalid-response" });
    await expect(client.save({
      ...record,
      accountId: "requested-account",
      expectedRevision: null,
    })).rejects.toMatchObject({ code: "invalid-response" });
  });
});
