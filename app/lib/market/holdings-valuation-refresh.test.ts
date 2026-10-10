import { describe, expect, it } from "vitest";

import {
  buildHoldingsRefreshAttemptKey,
  createHoldingsRefreshCoalescer,
} from "./holdings-valuation-refresh";

describe("holdings valuation refresh coordination", () => {
  it("keys automatic attempts by range and latest completed session", () => {
    const key = buildHoldingsRefreshAttemptKey({
      scopeKey: "account:live|range:2026-01-01/2026-10-06",
      asOf: "2026-10-06T09:00:00.000Z",
      instruments: [
        { instrumentId: "US:AAPL", market: "US" },
        { instrumentId: "CN-SH:600000", market: "CN-SH" },
      ],
    });

    expect(key).toContain("account:live|range:2026-01-01/2026-10-06");
    expect(key).toContain("CN-SH:600000@2026-09-30");
    expect(key).toContain("US:AAPL@2026-10-05");
  });

  it("shares overlapping ids and queues only new ids", async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>(resolve => { resolveFirst = resolve; });
    const runs: string[][] = [];
    const coalescer = createHoldingsRefreshCoalescer(async ids => {
      runs.push([...ids]);
      if (runs.length === 1) await first;
    });

    const firstRequest = coalescer.request(["A", "B"]);
    const shared = coalescer.request(["B"]);
    const queued = coalescer.request(["B", "C"]);
    await Promise.resolve();
    expect(runs).toEqual([["A", "B"]]);
    expect(runs).toEqual([["A", "B"]]);
    resolveFirst();
    await firstRequest;
    expect((await shared).shared).toBe(true);
    await queued;
    expect(runs).toEqual([["A", "B"], ["C"]]);
  });

  it("uses a refreshed runner without replacing the coalescer queue", async () => {
    const calls: string[] = [];
    const coalescer = createHoldingsRefreshCoalescer(async ids => {
      calls.push(`old:${ids.join(",")}`);
      return true;
    });
    coalescer.setRunner(async ids => {
      calls.push(`new:${ids.join(",")}`);
      return true;
    });

    await coalescer.request(["A"]);

    expect(calls).toEqual(["new:A"]);
  });

  it("preserves the shared provider result and merges receipts for queued ids", async () => {
    const coalescer = createHoldingsRefreshCoalescer(async ids => ({
      ok: true as const,
      requestedAtByInstrument: Object.fromEntries(ids.map(id => [id, `${id}-fresh`])),
    }));
    const first = coalescer.request(["A", "B"]);
    const shared = coalescer.request(["B"]);
    const queued = coalescer.request(["B", "C"]);
    expect((await first).value?.requestedAtByInstrument).toEqual({ A: "A-fresh", B: "B-fresh" });
    expect((await shared).value?.requestedAtByInstrument).toEqual({ A: "A-fresh", B: "B-fresh" });
    expect((await queued).value?.requestedAtByInstrument).toEqual({ A: "A-fresh", B: "B-fresh", C: "C-fresh" });
  });

  it("merges daily receipts for the exact subscribed ids", async () => {
    const coalescer = createHoldingsRefreshCoalescer(async ids => ({
      ok: true as const,
      requestedAtByInstrument: Object.fromEntries(ids.map(id => [id, `${id}-fresh`])),
      dailyStatusByInstrument: Object.fromEntries(ids.map(id => [id, "complete"])),
    }));
    const result = await coalescer.request(["A", "B"]);
    expect(result.value).toEqual({
      ok: true,
      requestedAtByInstrument: { A: "A-fresh", B: "B-fresh" },
      dailyStatusByInstrument: { A: "complete", B: "complete" },
    });
  });

  it("keeps a cross-page busy result ahead of a queued receipt", async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>(resolve => { resolveFirst = resolve; });
    const coalescer = createHoldingsRefreshCoalescer(async ids => {
      if (ids.includes("A")) {
        await first;
        return false as const;
      }
      return { ok: true as const, requestedAtByInstrument: { C: "C-fresh" } };
    });
    const busy = coalescer.request(["A", "B"]);
    const queued = coalescer.request(["B", "C"]);
    resolveFirst();
    expect((await busy).value).toBe(false);
    expect((await queued).value).toBe(false);
  });

  it("keeps an explicit failed member ahead of another member's receipt", async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>(resolve => { resolveFirst = resolve; });
    const coalescer = createHoldingsRefreshCoalescer(async ids => {
      if (ids.includes("B")) {
        await first;
        return { ok: false as const, reason: "failed" as const };
      }
      return { ok: true as const, requestedAtByInstrument: { C: "C-fresh" } };
    });
    const failing = coalescer.request(["A", "B"]);
    const shared = coalescer.request(["B", "C"]);
    resolveFirst();
    expect((await failing).value).toEqual({ ok: false, reason: "failed" });
    expect((await shared).value).toEqual({ ok: false, reason: "failed" });
  });

  it("cancels a queued subscriber without starting its IDs", async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>(resolve => { resolveFirst = resolve; });
    const runs: string[][] = [];
    const coalescer = createHoldingsRefreshCoalescer(async ids => {
      runs.push([...ids]);
      if (runs.length === 1) await first;
    });
    const firstRequest = coalescer.request(["A"]);
    const queued = coalescer.request(["B"]);
    coalescer.cancel(["B"]);
    resolveFirst();
    await firstRequest;
    await queued;
    expect(runs).toEqual([["A"]]);
  });

  it("removes only the cancelled id from a queued multi-id task", async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>(resolve => { resolveFirst = resolve; });
    const runs: string[][] = [];
    const coalescer = createHoldingsRefreshCoalescer(async ids => {
      runs.push([...ids]);
      if (runs.length === 1) await first;
    });
    const firstRequest = coalescer.request(["A"]);
    const queued = coalescer.request(["B", "C"]);
    coalescer.cancel(["B"]);
    resolveFirst();
    await firstRequest;
    await queued;
    expect(runs).toEqual([["A"], ["C"]]);
  });

  it("keeps another subscriber's shared id when the first subscriber cancels", async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>(resolve => { resolveFirst = resolve; });
    const runs: string[][] = [];
    const coalescer = createHoldingsRefreshCoalescer(async ids => {
      runs.push([...ids]);
      if (runs.length === 1) await first;
    });
    const firstRequest = coalescer.request(["A"]);
    const firstSubscriber = coalescer.request(["B", "C"]);
    const secondSubscriber = coalescer.request(["C"]);
    coalescer.cancel(["B", "C"]);
    resolveFirst();
    await firstRequest;
    await firstSubscriber;
    await secondSubscriber;
    expect(runs).toEqual([["A"], ["C"]]);
  });
});
