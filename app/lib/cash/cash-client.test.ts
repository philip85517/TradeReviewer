import { describe, expect, it } from "vitest";

import { createCashClient } from "./cash-client";

const summary = {
  todayProceeds: { baseCurrency: "CNY", originalByCurrency: {}, convertedCny: null, converted: null, conversion: "same-currency", fxSnapshotId: null, note: "" },
  cashTotal: { baseCurrency: "CNY", originalByCurrency: {}, convertedCny: null, converted: null, conversion: "same-currency", fxSnapshotId: null, note: "" },
  todayProceedsStatus: "zero",
  cashTotalStatus: "unavailable",
  coverage: { included: 0, excluded: 0, missing: 1 },
  asOf: null,
  missingReasons: ["缺少现金基准"],
  byScope: {},
  updatedAt: null,
};

const storage = {
  version: 1,
  records: [],
  history: [],
};

describe("cash client", () => {
  it("keeps canonical run-null queries whole-account and validates responses", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const client = createCashClient(async (input, init) => {
      calls.push({ input, init });
      if (input.startsWith("/api/trading-room/cash?")) return new Response(JSON.stringify(summary));
      return new Response(JSON.stringify(storage));
    });

    await client.readSummary({ nature: "simulation", simulationRunId: null }, { accountIds: ["tradingview:simulation:default"] });
    await client.readBaselines({ nature: "simulation", simulationRunId: null });

    expect(calls[0]?.input).toBe("/api/trading-room/cash?nature=simulation&accountId=tradingview%3Asimulation%3Adefault");
    expect(calls[1]?.input).toBe("/api/trading-room/cash/baselines?accountId=tradingview%3Asimulation%3Adefault&nature=simulation");
  });

  it("preserves a revision-conflict current record for the editor", async () => {
    const current = {
      id: "cash:simulation:tradingview:simulation:default:CNY",
      scope: { nature: "simulation", simulationRunId: null },
      accountId: "tradingview:simulation:default",
      currency: "CNY",
      balance: "101000",
      asOf: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-26T00:00:01.000Z",
      source: "user-confirmed",
      revision: 1,
    };
    const client = createCashClient(async (_input, _init) => new Response(JSON.stringify({
      error: { code: "revision-conflict", message: "stale" },
      current,
      currentRecord: current,
    }), { status: 409 }));

    await expect(client.saveBaseline({
      scope: { nature: "simulation", simulationRunId: null },
      accountId: "tradingview:simulation:default",
      currency: "CNY",
      balance: "100000",
      asOf: "2026-09-01T00:00:00.000Z",
      source: "user-default",
      expectedRevision: 0,
    })).rejects.toMatchObject({ status: 409, code: "revision-conflict", current });
  });

  it("rejects malformed money summaries and corrupted history instead of accepting shallow shapes", async () => {
    const summaryClient = createCashClient(async () => new Response(JSON.stringify({ ...summary, cashTotal: { originalByCurrency: {} } })));
    await expect(summaryClient.readSummary({ nature: "live", simulationRunId: null })).rejects.toMatchObject({ code: "invalid-response" });

    const historyClient = createCashClient(async () => new Response(JSON.stringify({ version: 1, records: [], history: [{ revision: "old" }] })));
    await expect(historyClient.readBaselines()).rejects.toMatchObject({ code: "invalid-response" });
  });
});
