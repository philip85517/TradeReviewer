import { createElement, StrictMode, useEffect, useRef, useState } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InstrumentLookup } from "../instruments/metadata-contracts";
import type { StoredInstrument } from "../storage/sqlite-contracts";
import {
  chunkLocalizedMetadataLookups,
  LocalizedMetadataHydrationQueue,
  missingLocalizedMetadataLookups,
} from "./localized-metadata-hydration";

const localizedName = {
  name: "闪迪",
  locale: "zh-CN" as const,
  source: "tencent",
  resolvedAt: "2026-09-12T00:00:00.000Z",
};

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function waitFor(assertion: () => void) {
  for (let i = 0; i < 150; i += 1) {
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    try { assertion(); return; } catch { /* Advance virtual time until settled. */ }
  }
  assertion();
}

function instrument(
  overrides: Partial<StoredInstrument> = {},
): StoredInstrument {
  return {
    id: "US:SNDK",
    market: "US",
    symbol: "SNDK",
    name: "SanDisk Corporation",
    currency: "USD",
    ...overrides,
  };
}

describe("localized metadata hydration selection", () => {
  it("selects legacy US/HK rows, skips Chinese names and cached overlays, and deduplicates IDs", () => {
    expect(missingLocalizedMetadataLookups([
      instrument(),
      instrument({ name: "腾讯控股", symbol: "0700", id: "HK:0700", market: "HK", currency: "HKD" }),
      instrument({ symbol: "AAPL", id: "US:AAPL", name: "Apple Inc." }),
      instrument({ symbol: "MSFT", id: "US:MSFT", name: "Microsoft", localizedName }),
      instrument({ symbol: "NVDA", id: "US:NVDA", name: "NVIDIA", metadata: {
        market: "US",
        symbol: "NVDA",
        name: "NVIDIA Corporation",
        localizedName,
        assetType: "stock",
        source: "nasdaq",
        confidence: "official",
        resolvedAt: "2026-09-12T00:00:00.000Z",
      } }),
      instrument(),
    ])).toEqual([
      { market: "US", symbol: "SNDK" },
      { market: "US", symbol: "AAPL" },
    ]);
  });

  it("chunks hydration so a large legacy set is progressively refreshable", () => {
    const lookups = Array.from({ length: 25 }, (_, index) => ({
      market: "US" as const,
      symbol: `T${index}`,
    }));
    expect(chunkLocalizedMetadataLookups(lookups, 12).map((chunk) => chunk.length)).toEqual([12, 12, 1]);
  });

  it("dispatches every legacy row through a real effect, records one failed batch, and does not retry it", async () => {
    const instruments = Array.from({ length: 25 }, (_, index) => instrument({
      id: `US:T${index}`,
      symbol: `T${index}`,
      name: `Ticker ${index}`,
    }));
    const attempted = new Set<string>();
    const queue = new LocalizedMetadataHydrationQueue(attempted);
    const calls: string[][] = [];
    let reloadCount = 0;
    const resolver = vi.fn(async (batch: InstrumentLookup[]) => {
      calls.push(batch.map(({ symbol }) => symbol));
      if (batch.some(({ symbol }) => symbol === "T12")) throw new Error("lookup failed");
      return {
        resolved: new Map(),
        unresolved: new Map(),
        cacheHits: 0,
        backgroundRefresh: Promise.resolve(),
      };
    });

    function EffectHarness() {
      const [current, setCurrent] = useState(instruments);
      const queueRef = useRef(queue);
      useEffect(() => {
        queueRef.current.enqueue(current);
      }, [current]);
      useEffect(() => {
        const controller = new AbortController();
        void queueRef.current.run({
          repository: {} as never,
          signal: controller.signal,
          reload: async () => {
            reloadCount += 1;
            return current;
          },
          onProgress: setCurrent,
          resolver,
        });
        return () => controller.abort();
      }, []);
      return null;
    }

    render(createElement(EffectHarness));
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(3));
    expect(calls.map((batch) => batch.length)).toEqual([12, 12, 1]);
    expect(calls.flat()).toHaveLength(25);
    expect(new Set(calls.flat()).size).toBe(25);
    expect(queue.pendingCount).toBe(0);
    expect(reloadCount).toBe(2);

    queue.enqueue(instruments);
    await queue.run({
      repository: {} as never,
      signal: new AbortController().signal,
      reload: async () => instruments,
      onProgress: () => undefined,
      resolver,
    });
    expect(resolver).toHaveBeenCalledTimes(3);
  });

  it("requeues an aborted in-flight batch so unmount cancellation does not lose work", async () => {
    const instruments = Array.from({ length: 25 }, (_, index) => instrument({
      id: `US:U${index}`,
      symbol: `U${index}`,
      name: `Unfinished ${index}`,
    }));
    const attempted = new Set<string>();
    const queue = new LocalizedMetadataHydrationQueue(attempted);
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const firstResolver = vi.fn(async () => {
      await blocked;
      return {
        resolved: new Map(),
        unresolved: new Map(),
        cacheHits: 0,
        backgroundRefresh: Promise.resolve(),
      };
    });
    function EffectHarness() {
      const [current] = useState(instruments);
      useEffect(() => {
        queue.enqueue(current);
        const controller = new AbortController();
        void queue.run({
          repository: {} as never,
          signal: controller.signal,
          reload: async () => current,
          onProgress: () => undefined,
          resolver: firstResolver,
        });
        return () => controller.abort();
      }, [current]);
      return null;
    }
    const view = render(createElement(EffectHarness));
    await waitFor(() => expect(firstResolver).toHaveBeenCalledOnce());
    view.unmount();
    release();
    await waitFor(() => expect(queue.pendingCount).toBe(25));
    expect(attempted.size).toBe(0);

    const resumedCalls: string[][] = [];
    const resumed = queue.run({
      repository: {} as never,
      signal: new AbortController().signal,
      reload: async () => instruments,
      onProgress: () => undefined,
      resolver: async (batch) => {
        resumedCalls.push(batch.map(({ symbol }) => symbol));
        return {
          resolved: new Map(),
          unresolved: new Map(),
          cacheHits: 0,
          backgroundRefresh: Promise.resolve(),
        };
      },
    });
    await vi.advanceTimersByTimeAsync(120_000);
    await resumed;
    expect(resumedCalls.map((batch) => batch.length)).toEqual([12, 12, 1]);
    expect(queue.pendingCount).toBe(0);
  });

  it("wakes an idle runner when a later effect enqueues a new legacy row", async () => {
    const initial = Array.from({ length: 12 }, (_, index) => instrument({
      id: `US:I${index}`,
      symbol: `I${index}`,
      name: `Initial ${index}`,
    }));
    const extra = instrument({ id: "US:I12", symbol: "I12", name: "Added later" });
    const queue = new LocalizedMetadataHydrationQueue(new Set());
    const calls: string[][] = [];
    const starts: number[] = [];
    const resolver = vi.fn(async (batch: InstrumentLookup[]) => {
      starts.push(Date.now());
      calls.push(batch.map(({ symbol }) => symbol));
      return {
        resolved: new Map(),
        unresolved: new Map(),
        cacheHits: 0,
        backgroundRefresh: Promise.resolve(),
      };
    });
    let addExtra!: () => void;
    function EffectHarness() {
      const [current, setCurrent] = useState(initial);
      addExtra = () => setCurrent([...initial, extra]);
      useEffect(() => {
        queue.enqueue(current);
      }, [current]);
      useEffect(() => {
        const controller = new AbortController();
        void queue.run({
          repository: {} as never,
          signal: controller.signal,
          reload: async () => current,
          onProgress: setCurrent,
          resolver,
        });
        return () => controller.abort();
      }, []);
      return null;
    }

    render(createElement(EffectHarness));
    await waitFor(() => expect(resolver).toHaveBeenCalledOnce());
    expect(queue.pendingCount).toBe(0);
    act(() => addExtra());
    expect(resolver).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(2));
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(30_000);
    expect(calls).toEqual([initial.map(({ symbol }) => symbol), ["I12"]]);
    expect(queue.pendingCount).toBe(0);
  });

  it("does not lose work enqueued between an empty run and its finally", async () => {
    const row = instrument({ id: "US:EMPTY", symbol: "EMPTY", name: "Queued after empty run" });
    const queue = new LocalizedMetadataHydrationQueue(new Set());
    const resolver = vi.fn(async () => ({
      resolved: new Map(),
      unresolved: new Map(),
      cacheHits: 0,
      backgroundRefresh: Promise.resolve(),
    }));
    const options = {
      repository: {} as never,
      signal: new AbortController().signal,
      reload: async () => [row],
      onProgress: () => undefined,
      resolver,
    };

    const emptyRun = queue.run(options);
    queue.enqueue([row]);
    await emptyRun;
    await waitFor(() => expect(resolver).toHaveBeenCalledOnce());
    expect(queue.pendingCount).toBe(0);
  });

  it("starts a distinct follow-up run when StrictMode cleanup aborts an in-flight run", async () => {
    const instruments = Array.from({ length: 25 }, (_, index) => instrument({
      id: `US:R${index}`,
      symbol: `R${index}`,
      name: `Restart ${index}`,
    }));
    const queue = new LocalizedMetadataHydrationQueue(new Set());
    const calls: string[][] = [];
    const starts: number[] = [];
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const resolver = vi.fn(async (batch: InstrumentLookup[]) => {
      starts.push(Date.now());
      calls.push(batch.map(({ symbol }) => symbol));
      await blocked;
      return {
        resolved: new Map(),
        unresolved: new Map(),
        cacheHits: 0,
        backgroundRefresh: Promise.resolve(),
      };
    });
    function EffectHarness() {
      useEffect(() => {
        queue.enqueue(instruments);
        const controller = new AbortController();
        void queue.run({
          repository: {} as never,
          signal: controller.signal,
          reload: async () => instruments,
          onProgress: () => undefined,
          resolver,
        });
        return () => controller.abort();
      }, []);
      return null;
    }

    render(createElement(StrictMode, null, createElement(EffectHarness)));
    await waitFor(() => expect(resolver).toHaveBeenCalledOnce());
    release();
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(4));
    expect(calls.map((batch) => batch.length)).toEqual([12, 12, 12, 1]);
    for (let i = 1; i < starts.length; i += 1) {
      expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(30_000);
    }
    expect(queue.pendingCount).toBe(0);
  });

  it("paces more than 30 jobs within a rolling 60-second budget", async () => {
    const queue = new LocalizedMetadataHydrationQueue(new Set());
    queue.enqueue(Array.from({ length: 37 }, (_, i) => instrument({ id: `US:B${i}`, symbol: `B${i}` })));
    const starts: { time: number; count: number }[] = [];
    const running = queue.run({
      repository: {} as never, signal: new AbortController().signal,
      reload: async () => [], onProgress: () => undefined,
      resolver: async batch => {
        starts.push({ time: Date.now(), count: batch.length });
        return { resolved: new Map(), unresolved: new Map(), cacheHits: 0, backgroundRefresh: Promise.resolve() };
      },
    });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(starts).toEqual([{ time: 0, count: 12 }]);
    await vi.advanceTimersByTimeAsync(60_001);
    await running;
    expect(starts.map(s => s.time)).toEqual([0, 30_000, 60_000, 90_000]);
    expect(starts.reduce((n, s) => n + s.count, 0)).toBe(37);
    for (const start of starts) {
      expect(starts.filter(s => s.time >= start.time && s.time < start.time + 60_000)
        .reduce((n, s) => n + s.count, 0)).toBeLessThanOrEqual(24);
    }
  });

  it("cancels a waiting batch without losing jobs or resetting restart pacing", async () => {
    const attempted = new Set<string>();
    const queue = new LocalizedMetadataHydrationQueue(attempted);
    queue.enqueue(Array.from({ length: 13 }, (_, i) => instrument({ id: `US:C${i}`, symbol: `C${i}` })));
    const resolver = vi.fn(async () => ({ resolved: new Map(), unresolved: new Map(), cacheHits: 0, backgroundRefresh: Promise.resolve() }));
    const controller = new AbortController();
    const options = { repository: {} as never, signal: controller.signal, reload: async () => [], onProgress: () => undefined, resolver };
    const first = queue.run(options);
    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    await first;
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(attempted.size).toBe(12);
    expect(queue.pendingCount).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    const resumed = queue.run({ ...options, signal: new AbortController().signal });
    await vi.advanceTimersByTimeAsync(28_999);
    expect(resolver).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await resumed;
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it("defers only rate-limited rows once and never retries permanent failures", async () => {
    const attempted = new Set<string>();
    const queue = new LocalizedMetadataHydrationQueue(attempted);
    const rows = [instrument(), instrument({ id: "US:BAD", symbol: "BAD" })];
    queue.enqueue(rows);
    const batches: string[][] = [];
    const options = {
      repository: {} as never, signal: new AbortController().signal,
      reload: async () => rows, onProgress: () => undefined,
      resolver: async (batch: InstrumentLookup[]) => {
        batches.push(batch.map(row => row.symbol));
        return {
          resolved: new Map(), cacheHits: 0, backgroundRefresh: Promise.resolve(),
          unresolved: new Map(batch.map(lookup => [`US:${lookup.symbol}`, {
            ...lookup, attempts: [{ source: "nasdaq" as const,
              code: lookup.symbol === "SNDK" ? "rate-limited" : "no-data", message: "unavailable" }],
          }])),
        };
      },
    };
    const running = queue.run(options);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(batches).toEqual([["SNDK", "BAD"]]);
    await vi.advanceTimersByTimeAsync(1);
    await running;
    expect(batches).toEqual([["SNDK", "BAD"], ["SNDK"]]);
    queue.enqueue(rows);
    await queue.run(options);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(batches).toHaveLength(2);
    expect(queue.pendingCount).toBe(0);
    expect(attempted.size).toBe(2);
  });
});
