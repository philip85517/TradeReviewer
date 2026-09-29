import { describe, expect, it, vi } from "vitest";

import type { DailyCandleRecord } from "../market/contracts";
import { buildInstrumentTradeSummaries } from "../trades/instruments";
import { buildTradeLibraryEntries, type TradeLibraryEntry } from "../trades/library";
import type { TradeExecution } from "../trades/types";
import {
  buildTagSuggestions,
  type TagSuggestionRecord,
} from "./tag-suggestions";
import { buildCachedTagSuggestions } from "./tag-suggestion-cache";

const GENERATED_AT = "2026-07-27T00:00:00.000Z";
const NEXT_GENERATED_AT = "2026-07-28T00:00:00.000Z";

const oracleState = vi.hoisted(() => ({ calls: 0 }));

vi.mock("./tag-suggestions", async () => {
  const actual = await vi.importActual<typeof import("./tag-suggestions")>("./tag-suggestions");
  return {
    ...actual,
    buildTagSuggestions: (...args: Parameters<typeof actual.buildTagSuggestions>) => {
      oracleState.calls += 1;
      return actual.buildTagSuggestions(...args);
    },
  };
});

function instrument(id: string): TradeExecution["instrument"] {
  const symbol = id.split(":")[1] ?? id;
  return {
    id,
    symbol,
    name: symbol,
    market: "US",
    currency: "USD",
  };
}

function execution(
  id: string,
  currentInstrument: TradeExecution["instrument"],
  accountId: string,
  runId: string,
  side: TradeExecution["side"],
  executedAt: string,
  quantity: string,
  price: string,
): TradeExecution {
  return {
    id,
    source: {
      platform: "fixture",
      row: 1,
      tradeNature: "simulation",
      simulationRunId: runId,
    },
    accountId,
    accountLabel: accountId,
    instrument: currentInstrument,
    side,
    executedAt,
    quantity,
    price,
    fee: "0",
  };
}

function entriesFor(
  specs: Array<{
    instrument: TradeExecution["instrument"];
    accountId: string;
    runId: string;
  }>,
): TradeLibraryEntry[] {
  const executions = specs.flatMap(({ instrument: currentInstrument, accountId, runId }, index) => [
    execution(`${runId}-open-1`, currentInstrument, accountId, runId, "buy", `2025-01-${String(index + 2).padStart(2, "0")}T15:00:00Z`, "50", "9"),
    execution(`${runId}-open-2`, currentInstrument, accountId, runId, "buy", `2025-01-${String(index + 3).padStart(2, "0")}T15:00:00Z`, "50", "9.5"),
    execution(`${runId}-close`, currentInstrument, accountId, runId, "sell", `2025-01-${String(index + 4).padStart(2, "0")}T15:00:00Z`, "100", "10"),
  ]);
  const summaries = buildInstrumentTradeSummaries(executions);
  const candles = Object.fromEntries(
    specs.map(({ instrument: currentInstrument }) => [currentInstrument.id, [] as DailyCandleRecord[]]),
  );
  const statuses = Object.fromEntries(
    specs.map(({ instrument: currentInstrument }) => [currentInstrument.id, "ready" as const]),
  );
  return buildTradeLibraryEntries(summaries, candles, statuses);
}

function candle(instrumentId: string, fetchedAt: string): DailyCandleRecord {
  return {
    instrumentId,
    tradingDate: "2025-01-01",
    open: "9",
    high: "10",
    low: "8",
    close: "9",
    volume: "1000",
    currency: "USD",
    provider: "yahoo",
    providerSymbol: instrumentId,
    adjustmentMode: "raw",
    fetchedAt,
  };
}

function resetOracleCalls() {
  oracleState.calls = 0;
}

function rejected(record: TagSuggestionRecord): TagSuggestionRecord {
  return {
    ...record,
    status: "rejected",
    finalTagId: null,
    decidedAt: "2026-07-27T01:00:00.000Z",
  };
}

describe("buildCachedTagSuggestions", () => {
  it("matches the oracle and only calls it for a changed instrument", () => {
    const xpev = instrument("US:XPEV");
    const msft = instrument("US:MSFT");
    const entries = entriesFor([
      { instrument: xpev, accountId: "account-x", runId: "run-x" },
      { instrument: msft, accountId: "account-m", runId: "run-m" },
    ]);
    const xpevCandles = [candle(xpev.id, "2026-07-27T00:00:00.000Z")];
    const msftCandles = [candle(msft.id, "2026-07-27T00:00:00.000Z")];
    const initialCandles = { [xpev.id]: xpevCandles, [msft.id]: msftCandles };

    const expectedFirst = buildTagSuggestions(entries, initialCandles, [], GENERATED_AT);
    resetOracleCalls();
    const first = buildCachedTagSuggestions(undefined, entries, initialCandles, [], GENERATED_AT);
    expect(first.suggestions).toEqual(expectedFirst);
    expect(first.recomputedEntryCount).toBe(2);
    expect(oracleState.calls).toBe(2);

    const changedMsftCandles = [candle(msft.id, "2026-07-28T00:00:00.000Z")];
    const changedCandles = { [xpev.id]: xpevCandles, [msft.id]: changedMsftCandles };
    const expectedSecond = buildTagSuggestions(entries, changedCandles, [], GENERATED_AT);
    resetOracleCalls();
    const second = buildCachedTagSuggestions(first.cache, entries, changedCandles, [], GENERATED_AT);
    expect(second.suggestions).toEqual(expectedSecond);
    expect(second.recomputedEntryCount).toBe(1);
    expect(oracleState.calls).toBe(1);
    const unchangedEntry = entries.find((entry) => entry.instrument.id === xpev.id)!;
    expect(second.cache.byEntry.get(unchangedEntry)?.candidates)
      .toBe(first.cache.byEntry.get(unchangedEntry)?.candidates);
  });

  it("recomputes both entries when same-instrument accounts share one candle input", () => {
    const shared = instrument("US:SHARED");
    const entries = entriesFor([
      { instrument: shared, accountId: "account-a", runId: "run-a" },
      { instrument: shared, accountId: "account-b", runId: "run-b" },
    ]);
    const firstCandles = { [shared.id]: [candle(shared.id, "2026-07-27T00:00:00.000Z")] };
    const expectedFirst = buildTagSuggestions(entries, firstCandles, [], GENERATED_AT);
    resetOracleCalls();
    const first = buildCachedTagSuggestions(undefined, entries, firstCandles, [], GENERATED_AT);
    expect(first.suggestions).toEqual(expectedFirst);
    expect(first.recomputedEntryCount).toBe(2);
    expect(oracleState.calls).toBe(2);
    expect(first.cache.byEntry.size).toBe(2);

    const changedCandles = { [shared.id]: [candle(shared.id, "2026-07-28T00:00:00.000Z")] };
    const expectedSecond = buildTagSuggestions(entries, changedCandles, [], GENERATED_AT);
    resetOracleCalls();
    const second = buildCachedTagSuggestions(first.cache, entries, changedCandles, [], GENERATED_AT);
    expect(second.suggestions).toEqual(expectedSecond);
    expect(second.recomputedEntryCount).toBe(2);
    expect(oracleState.calls).toBe(2);
    expect(new Set(second.suggestions.map(({ episodeId }) => episodeId)).size).toBe(2);
  });

  it("keeps prior decisions and applies changed confirmed tags without stale candidates", () => {
    const currentInstrument = instrument("US:XPEV");
    const entries = entriesFor([{ instrument: currentInstrument, accountId: "account-x", runId: "run-x" }]);
    const candles = { [currentInstrument.id]: [] as DailyCandleRecord[] };
    const first = buildCachedTagSuggestions(undefined, entries, candles, [], GENERATED_AT);
    const prior = first.suggestions.map(rejected);

    const expectedPrior = buildTagSuggestions(entries, candles, prior, GENERATED_AT);
    resetOracleCalls();
    const withPrior = buildCachedTagSuggestions(first.cache, entries, candles, prior, GENERATED_AT);
    expect(withPrior.suggestions).toEqual(expectedPrior);
    expect(withPrior.recomputedEntryCount).toBe(0);
    expect(oracleState.calls).toBe(0);

    const confirmedEntries = entries.map((entry) => ({
      ...entry,
      episodes: entry.episodes.map((item) => ({
        ...item,
        confirmedTagIds: ["scale-in"],
      })),
    }));
    const expectedConfirmed = buildTagSuggestions(confirmedEntries, candles, [], GENERATED_AT);
    resetOracleCalls();
    const withConfirmed = buildCachedTagSuggestions(first.cache, confirmedEntries, candles, [], GENERATED_AT);
    expect(withConfirmed.suggestions).toEqual(expectedConfirmed);
    expect(withConfirmed.suggestions).toEqual([]);
    expect(withConfirmed.recomputedEntryCount).toBe(1);
    expect(oracleState.calls).toBe(1);
  });

  it("invalidates generated time while leaving prior records unchanged", () => {
    const currentInstrument = instrument("US:XPEV");
    const entries = entriesFor([{ instrument: currentInstrument, accountId: "account-x", runId: "run-x" }]);
    const candles = { [currentInstrument.id]: [] as DailyCandleRecord[] };
    const first = buildCachedTagSuggestions(undefined, entries, candles, [], GENERATED_AT);
    const expected = buildTagSuggestions(entries, candles, [], NEXT_GENERATED_AT);
    resetOracleCalls();
    const second = buildCachedTagSuggestions(first.cache, entries, candles, [], NEXT_GENERATED_AT);
    expect(second.suggestions).toEqual(expected);
    expect(second.suggestions.every(({ suggestedAt }) => suggestedAt === NEXT_GENERATED_AT)).toBe(true);
    expect(second.recomputedEntryCount).toBe(1);
    expect(oracleState.calls).toBe(1);

    const prior = first.suggestions.map(rejected);
    const priorResult = buildCachedTagSuggestions(first.cache, entries, candles, prior, NEXT_GENERATED_AT);
    expect(priorResult.suggestions).toEqual(prior);
  });

  it("prunes removed entries while retaining their prior records and recomputes on re-add", () => {
    const xpev = instrument("US:XPEV");
    const msft = instrument("US:MSFT");
    const entries = entriesFor([
      { instrument: xpev, accountId: "account-x", runId: "run-x" },
      { instrument: msft, accountId: "account-m", runId: "run-m" },
    ]);
    const candles = {
      [xpev.id]: [] as DailyCandleRecord[],
      [msft.id]: [] as DailyCandleRecord[],
    };
    const first = buildCachedTagSuggestions(undefined, entries, candles, [], GENERATED_AT);
    const prior = first.suggestions.map(rejected);
    const expectedRemoved = buildTagSuggestions([entries[0]], candles, prior, GENERATED_AT);
    resetOracleCalls();
    const removed = buildCachedTagSuggestions(first.cache, [entries[0]], candles, prior, GENERATED_AT);
    expect(removed.suggestions).toEqual(expectedRemoved);
    expect(removed.suggestions).toEqual(prior);
    expect(removed.cache.byEntry.size).toBe(1);
    expect(removed.recomputedEntryCount).toBe(0);
    expect(oracleState.calls).toBe(0);

    const expectedReadded = buildTagSuggestions(entries, candles, prior, GENERATED_AT);
    resetOracleCalls();
    const readded = buildCachedTagSuggestions(removed.cache, entries, candles, prior, GENERATED_AT);
    expect(readded.suggestions).toEqual(expectedReadded);
    expect(readded.cache.byEntry.size).toBe(2);
    expect(readded.recomputedEntryCount).toBe(1);
    expect(oracleState.calls).toBe(1);
  });

  it("uses one stable empty-candle fallback for repeated empty inputs", () => {
    const currentInstrument = instrument("US:XPEV");
    const entries = entriesFor([{ instrument: currentInstrument, accountId: "account-x", runId: "run-x" }]);
    const firstCandles = { [currentInstrument.id]: [] as DailyCandleRecord[] };
    const first = buildCachedTagSuggestions(undefined, entries, firstCandles, [], GENERATED_AT);
    const secondCandles = { [currentInstrument.id]: [] as DailyCandleRecord[] };
    const expected = buildTagSuggestions(entries, secondCandles, [], GENERATED_AT);
    resetOracleCalls();
    const second = buildCachedTagSuggestions(first.cache, entries, secondCandles, [], GENERATED_AT);
    expect(second.suggestions).toEqual(expected);
    expect(second.recomputedEntryCount).toBe(0);
    expect(oracleState.calls).toBe(0);
  });
});
