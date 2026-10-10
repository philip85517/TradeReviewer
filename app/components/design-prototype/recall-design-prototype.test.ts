import { describe, expect, it } from "vitest";

import type { Candle } from "../../lib/market/types";
import type { TradeEpisode } from "../../lib/trades/types";
import { revealRecallDecision } from "../../lib/replay/recall-replay";
import {
  createRecallPrototypeFixture,
  createRecallPrototypeRepository,
  createRecallPrototypeDocument,
  isRecallPrototypeStorageAvailable,
  projectRecallPrototypeStage,
} from "./recall-design-prototype-data";
import { readPrototypeChartSettings } from "./recall-design-prototype";

const episode: TradeEpisode = {
  id: "prototype-episode",
  accountId: "prototype-account",
  accountLabel: "样板账户",
  instrument: { id: "CN-SH:DEMO", symbol: "DEMO", name: "样板标的", market: "CN-SH", currency: "CNY" },
  direction: "long",
  status: "closed",
  startedAt: "2026-01-03T10:00:00.000Z",
  endedAt: "2026-01-05T10:00:00.000Z",
  openingQuantity: "1000",
  remainingQuantity: "0",
  executions: [
    { id: "entry", source: { platform: "prototype", row: 1 }, accountId: "prototype-account", accountLabel: "样板账户", instrument: { id: "CN-SH:DEMO", symbol: "DEMO", name: "样板标的", market: "CN-SH", currency: "CNY" }, side: "buy", executedAt: "2026-01-03T10:00:00.000Z", quantity: "1000", price: "56", fee: "0" },
    { id: "exit-a", source: { platform: "prototype", row: 2 }, accountId: "prototype-account", accountLabel: "样板账户", instrument: { id: "CN-SH:DEMO", symbol: "DEMO", name: "样板标的", market: "CN-SH", currency: "CNY" }, side: "sell", executedAt: "2026-01-04T10:00:00.000Z", quantity: "600", price: "64", fee: "0" },
  ],
};

const candles: Candle[] = [
  { time: "2026-01-02T00:00:00.000Z", knowledgeAt: "2026-01-02T07:00:00.000Z", open: 53, high: 57, low: 52, close: 55, volume: 10 },
  { time: "2026-01-03T00:00:00.000Z", knowledgeAt: "2026-01-03T07:00:00.000Z", open: 55, high: 58, low: 54, close: 56, volume: 11 },
];

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  } satisfies Pick<Storage, "getItem" | "setItem" | "removeItem">;
}

describe("recall design prototype persistence", () => {
  it("reads chart settings from the current SQLite HTTP boundary", async () => {
    const settings = {
      version: 1 as const,
      showGrid: false,
      showVolume: true,
      showExecutions: true,
      showAverageCost: true,
      colorScheme: "blue-orange" as const,
    };
    const getSettings = async () => settings;

    await expect(readPrototypeChartSettings({ getSettings })).resolves.toEqual(settings);
  });

  it("surfaces a settings read failure to the prototype caller", async () => {
    const getSettings = async () => {
      throw new Error("storage unavailable");
    };

    await expect(readPrototypeChartSettings({ getSettings })).rejects.toThrow("storage unavailable");
  });

  it("round trips one sample key and reset removes only that key", async () => {
    const localStorage = storage();
    const key = "trade-review:prototype:recall:v1";
    const repository = createRecallPrototypeRepository(localStorage, key, episode);
    const initial = await repository.load(episode.id);
    expect(initial?.working.phase).toBe("pre-entry");
    expect(initial?.plans?.drafts[0]?.input).toMatchObject({ entry: "56", initialStop: "52", resolvedQuantity: "1000" });
    expect(initial?.working.drawings.find((drawing) => drawing.id === "prototype-pre-entry-note")?.text).toContain("原判断 · S0入场前 · 复盘补记");
    expect(initial?.working.drawings.find((drawing) => drawing.id === "prototype-pre-entry-note")?.text).toContain("不确定性：");
    expect(initial?.working.drawings.find((drawing) => drawing.id === "prototype-holding-note")?.text).toContain("当前补充 · S1持仓中 · 复盘补记");

    const edited = { ...initial!, revision: 1, updatedAt: "2026-01-01T00:00:00.000Z", working: { ...initial!.working, hasSeenFuture: true } };
    await repository.save(edited);
    expect((await repository.load(episode.id))?.working.hasSeenFuture).toBe(true);
    localStorage.setItem("other-key", "keep");
    await repository.reset();
    expect(localStorage.getItem(key)).toBeNull();
    expect((await repository.load(episode.id))?.plans?.drafts[0]?.input.entry).toBe("56");
    expect(localStorage.getItem("other-key")).toBe("keep");
  });

  it("projects only revealed market and execution facts at a stage cutoff", () => {
    const projection = projectRecallPrototypeStage({
      phase: "pre-entry",
      candles,
      executions: episode.executions,
      cursor: "2026-01-03T06:59:59.000Z",
      executionCursor: "__recall_before_first_execution__",
    });
    expect(projection.candles.map((candle) => candle.time)).toEqual([candles[0].time]);
    expect(projection.executions).toEqual([]);
    expect(projection.executionCutoff).toBeNull();
    expect("futureCount" in projection).toBe(false);
    expect("futureExecutions" in projection).toBe(false);
  });

  it("advances the real fixture chart to the first revealed fill", () => {
    const fixture = createRecallPrototypeFixture("recommended", storage());
    const document = createRecallPrototypeDocument(fixture.episode);
    const firstDecision = document.decisions[0];
    expect(firstDecision).toBeDefined();
    const before = projectRecallPrototypeStage({
      phase: document.working.phase ?? "pre-entry",
      candles: fixture.candles,
      executions: fixture.episode.executions,
      cursor: document.working.cursor,
      executionCursor: document.working.executionCursor,
    });
    expect(before.executions).toEqual([]);

    const after = revealRecallDecision({
      candles: fixture.candles,
      executions: fixture.episode.executions,
      decisions: document.decisions,
      decisionId: firstDecision!.id,
    });
    expect(after.revealedExecutions.map((execution) => execution.id)).toEqual(["prototype-entry-d60"]);
    expect(after.revealedCandles.some((candle) => candle.time === fixture.candles[59]?.time)).toBe(true);
  });

  it("reports blocked browser storage instead of claiming persistence", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => { throw new Error("storage blocked"); },
    });
    try {
      expect(isRecallPrototypeStorageAvailable()).toBe(false);
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
      else Object.defineProperty(window, "localStorage", { configurable: true, value: undefined });
    }
  });
});
