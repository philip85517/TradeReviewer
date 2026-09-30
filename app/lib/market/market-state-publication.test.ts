import { describe, expect, it } from "vitest";

import { createMarketStatePublication } from "./market-state-publication";

describe("createMarketStatePublication", () => {
  it("coalesces synchronous background completions into one bounded flush", () => {
    let now = 0;
    let nextTimerId = 0;
    const timers = new Map<number, { at: number; callback: () => void }>();
    const published: Array<readonly { instrumentId: string; state: string; generation: number }[]> = [];
    const publication = createMarketStatePublication<string>({
      windowMs: 50,
      clock: () => now,
      timer: {
        set(callback, delayMs) {
          const id = ++nextTimerId;
          timers.set(id, { at: now + delayMs, callback });
          return id;
        },
        clear(handle) {
          timers.delete(handle as number);
        },
      },
      onFlush(items) {
        published.push(items);
      },
    });

    for (let index = 0; index < 100; index += 1) {
      publication.publish({
        instrumentId: `instrument-${index}`,
        generation: 1,
        state: `ready-${index}`,
      });
    }

    expect(published).toEqual([]);
    expect(timers.size).toBe(1);

    now = 49;
    expect(published).toEqual([]);
    now = 50;
    for (const [id, timer] of [...timers.entries()]) {
      if (timer.at <= now) {
        timers.delete(id);
        timer.callback();
      }
    }

    expect(published).toHaveLength(1);
    expect(published[0]).toHaveLength(100);
    expect(published[0]?.[0]).toEqual({
      instrumentId: "instrument-0",
      generation: 1,
      state: "ready-0",
    });
  });

  it("uses the first pending completion as the window deadline", () => {
    let now = 0;
    let nextTimerId = 0;
    const timers = new Map<number, { at: number; callback: () => void }>();
    const published: string[][] = [];
    const publication = createMarketStatePublication<string>({
      windowMs: 50,
      clock: () => now,
      timer: {
        set(callback, delayMs) {
          const id = ++nextTimerId;
          timers.set(id, { at: now + delayMs, callback });
          return id;
        },
        clear(handle) {
          timers.delete(handle as number);
        },
      },
      onFlush(items) {
        published.push(items.map((item) => item.instrumentId));
      },
    });

    publication.publish({ instrumentId: "first", generation: 1, state: "ready" });
    now = 40;
    publication.publish({ instrumentId: "second", generation: 1, state: "ready" });
    now = 49;
    publication.publish({ instrumentId: "third", generation: 1, state: "ready" });

    expect(timers.size).toBe(1);
    now = 50;
    for (const [id, timer] of [...timers.entries()]) {
      if (timer.at <= now) {
        timers.delete(id);
        timer.callback();
      }
    }

    expect(published).toEqual([["first", "second", "third"]]);
  });

  it("flushes pending background results with an interactive holding or selected result", () => {
    let now = 0;
    let nextTimerId = 0;
    const timers = new Map<number, { at: number; callback: () => void }>();
    const published: string[][] = [];
    const publication = createMarketStatePublication<string>({
      windowMs: 50,
      clock: () => now,
      timer: {
        set(callback, delayMs) {
          const id = ++nextTimerId;
          timers.set(id, { at: now + delayMs, callback });
          return id;
        },
        clear(handle) {
          timers.delete(handle as number);
        },
      },
      onFlush(items) {
        published.push(items.map((item) => item.instrumentId));
      },
    });

    publication.publish({ instrumentId: "background", generation: 1, state: "ready" });
    now = 1;
    publication.publish({
      instrumentId: "holding",
      generation: 1,
      state: "ready",
      priority: "holding",
    });
    expect(published).toEqual([["background", "holding"]]);
    expect(timers).toEqual(new Map());

    publication.publish({
      instrumentId: "selected",
      generation: 1,
      state: "ready",
      priority: "selected",
    });
    expect(published).toEqual([["background", "holding"], ["selected"]]);
  });

  it("flushes a final partial batch once and rejects callbacks after finish", () => {
    const published: string[][] = [];
    const publication = createMarketStatePublication<string>({
      onFlush(items) {
        published.push(items.map((item) => item.instrumentId));
      },
    });

    publication.publish({ instrumentId: "last", generation: 1, state: "failed" });
    publication.finish();

    expect(published).toEqual([["last"]]);
    expect(publication.publish({ instrumentId: "late", generation: 1, state: "ready" })).toBe(false);
    publication.flush();
    expect(published).toEqual([["last"]]);
  });

  it("keeps only the newest accepted generation for an instrument", () => {
    const published: Array<readonly { instrumentId: string; generation: number; state: string }[]> = [];
    const publication = createMarketStatePublication<string>({
      onFlush(items) {
        published.push(items);
      },
    });

    expect(publication.publish({ instrumentId: "same", generation: 2, state: "new" })).toBe(true);
    expect(publication.publish({ instrumentId: "same", generation: 1, state: "old" })).toBe(false);
    expect(publication.publish({ instrumentId: "same", generation: 3, state: "newest" })).toBe(true);
    publication.flush();

    expect(published).toEqual([[{
      instrumentId: "same",
      generation: 3,
      state: "newest",
    }]]);
  });

  it("filters a stale pending result when another caller has already published newer state", () => {
    let currentGeneration = 1;
    const published: number[] = [];
    const publication = createMarketStatePublication<string>({
      isCurrent: (item) => item.generation >= currentGeneration,
      onFlush(items) {
        published.push(...items.map((item) => item.generation));
      },
    });

    publication.publish({ instrumentId: "same", generation: 1, state: "background" });
    currentGeneration = 2;
    publication.flush();
    expect(published).toEqual([]);

    expect(publication.publish({ instrumentId: "same", generation: 2, state: "interactive" })).toBe(true);
    publication.flush();
    expect(published).toEqual([2]);
  });

  it("drops pending results and ignores a timer callback after dispose", () => {
    let timerCallback: (() => void) | undefined;
    let clearCount = 0;
    const published: string[][] = [];
    const publication = createMarketStatePublication<string>({
      timer: {
        set(callback) {
          timerCallback = callback;
          return "timer";
        },
        clear() {
          clearCount += 1;
        },
      },
      onFlush(items) {
        published.push(items.map((item) => item.instrumentId));
      },
    });

    publication.publish({ instrumentId: "old", generation: 1, state: "ready" });
    publication.dispose();
    timerCallback?.();

    expect(clearCount).toBe(1);
    expect(published).toEqual([]);
    expect(publication.publish({ instrumentId: "late", generation: 2, state: "ready" })).toBe(false);
  });
});
