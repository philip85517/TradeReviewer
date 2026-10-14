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

const presentFxSnapshot = {
  id: "fx:2026-09-26",
  baseCurrency: "CNY",
  asOf: "2026-09-26T00:00:00.000Z",
  source: "BOC",
  status: "complete",
  rates: { "USD/CNY": "7.123456", "HKD/CNY": "0.912345" },
  publishedAt: "2026-09-26T00:00:00.000Z",
  publishedAtByCurrency: {
    USD: "2026-09-26T00:00:00.000Z",
    HKD: "2026-09-26T00:00:00.000Z",
  },
  fetchedAt: "2026-09-26T01:00:00.000Z",
  error: null,
  lastAttemptDay: "2026-09-26",
} as const;

const summaryWithPresentFx = (overrides: Record<string, unknown> = {}) => {
  const money = {
    ...summary.cashTotal,
    originalByCurrency: { USD: "10" },
    convertedCny: "71.23456",
    converted: "71.23456",
    conversion: "complete",
    fxSnapshotId: presentFxSnapshot.id,
  };
  return {
    ...summary,
    cashTotal: money,
    todayProceeds: { ...money },
    fxSnapshot: presentFxSnapshot,
    ...overrides,
  };
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

  it("validates present FX snapshots and requires both money views to use that snapshot", async () => {
    const read = (body: unknown) => createCashClient(async () => new Response(JSON.stringify(body)))
      .readSummary({ nature: "live", simulationRunId: null });

    await expect(read(summaryWithPresentFx())).resolves.toMatchObject({
      fxSnapshot: presentFxSnapshot,
      cashTotal: { fxSnapshotId: presentFxSnapshot.id },
      todayProceeds: { fxSnapshotId: presentFxSnapshot.id },
    });

    const malformedSnapshots = [
      ["missing id", { ...presentFxSnapshot, id: "" }],
      ["missing source", { ...presentFxSnapshot, source: null }],
      ["missing asOf", { ...presentFxSnapshot, asOf: null }],
      ["invalid base currency", { ...presentFxSnapshot, baseCurrency: "USD" }],
      ["invalid status", { ...presentFxSnapshot, status: "ready" }],
      ["missing rates map", { ...presentFxSnapshot, rates: null }],
      ["array rates map", { ...presentFxSnapshot, rates: [] }],
      ["empty rates map", { ...presentFxSnapshot, rates: {} }],
      ["non-positive rate", { ...presentFxSnapshot, rates: { ...presentFxSnapshot.rates, "USD/CNY": "0" } }],
      ["non-finite rate", { ...presentFxSnapshot, rates: { ...presentFxSnapshot.rates, "USD/CNY": "NaN" } }],
      ["numeric rate", { ...presentFxSnapshot, rates: { ...presentFxSnapshot.rates, "USD/CNY": 7.123456 } }],
      ["non-string publication date", { ...presentFxSnapshot, publishedAt: 42 }],
      ["non-string per-currency publication date", { ...presentFxSnapshot, publishedAtByCurrency: { USD: null } }],
      ["non-string fetched date", { ...presentFxSnapshot, fetchedAt: 42 }],
      ["non-string refresh error", { ...presentFxSnapshot, error: 42 }],
      ["non-string attempt day", { ...presentFxSnapshot, lastAttemptDay: 42 }],
    ] as const;
    for (const [label, fxSnapshot] of malformedSnapshots) {
      await expect(read(summaryWithPresentFx({ fxSnapshot })), label).rejects.toMatchObject({ code: "invalid-response" });
    }

    await expect(read(summaryWithPresentFx({
      cashTotal: { ...summaryWithPresentFx().cashTotal, fxSnapshotId: "fx:other" },
    }))).rejects.toMatchObject({ code: "invalid-response" });
    await expect(read(summaryWithPresentFx({
      todayProceeds: { ...summaryWithPresentFx().todayProceeds, fxSnapshotId: null },
    }))).rejects.toMatchObject({ code: "invalid-response" });

    const requiredFxShape = {
      id: presentFxSnapshot.id,
      baseCurrency: presentFxSnapshot.baseCurrency,
      asOf: presentFxSnapshot.asOf,
      source: presentFxSnapshot.source,
      status: presentFxSnapshot.status,
      rates: presentFxSnapshot.rates,
    };
    await expect(read(summaryWithPresentFx({ fxSnapshot: requiredFxShape }))).resolves.toMatchObject({
      fxSnapshot: { id: presentFxSnapshot.id },
    });

    await expect(read(summaryWithPresentFx({
      fxSnapshot: {
        ...presentFxSnapshot,
        asOf: "provider-as-of:unparsed",
        publishedAt: "provider-publication:unparsed",
        publishedAtByCurrency: { USD: "provider-publication:unparsed" },
        fetchedAt: "provider-fetch:unparsed",
        lastAttemptDay: "provider-day:unparsed",
      },
    }))).resolves.toMatchObject({ fxSnapshot: { asOf: "provider-as-of:unparsed" } });

    await expect(read(summary)).resolves.toEqual(summary);
  });

  it.each([
    ["same ghost id", "fx:ghost", "fx:ghost"],
    ["different ghost ids", "fx:ghost-a", "fx:ghost-b"],
  ] as const)("rejects missing FX snapshots when money views carry %s", async (_label, cashTotalId, todayProceedsId) => {
    const read = (body: unknown) => createCashClient(async () => new Response(JSON.stringify(body)))
      .readSummary({ nature: "live", simulationRunId: null });

    const body = summaryWithPresentFx({
      cashTotal: { ...summaryWithPresentFx().cashTotal, fxSnapshotId: cashTotalId },
      todayProceeds: { ...summaryWithPresentFx().todayProceeds, fxSnapshotId: todayProceedsId },
    });
    const { fxSnapshot: _fxSnapshot, ...withoutSnapshot } = body;

    await expect(read(withoutSnapshot)).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("accepts a legacy no-snapshot CNY same-currency summary with finite converted values", async () => {
    const legacyCnySummary = {
      ...summary,
      todayProceeds: {
        ...summary.todayProceeds,
        originalByCurrency: { CNY: "4.25" },
        convertedCny: "4.25",
        converted: "4.25",
        conversion: "same-currency",
        fxSnapshotId: null,
      },
      cashTotal: {
        ...summary.cashTotal,
        originalByCurrency: { CNY: "100.50" },
        convertedCny: "100.50",
        converted: "100.50",
        conversion: "same-currency",
        fxSnapshotId: null,
      },
      todayProceedsStatus: "available",
      cashTotalStatus: "available",
    };
    const client = createCashClient(async () => new Response(JSON.stringify(legacyCnySummary)));

    await expect(client.readSummary({ nature: "live", simulationRunId: null })).resolves.toEqual(legacyCnySummary);
  });
});
