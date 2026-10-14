import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { HoldingsHistoryWorkerInput } from "../../lib/reviews/holdings-history-worker";
import type { HoldingsHistoryModel, HoldingsHistoryPoint } from "../../lib/reviews/trading-room-history";
import type { CurrentPortfolioModel } from "../../lib/reviews/trading-room-portfolio";
import type { RoomFxSnapshot } from "../../lib/reviews/trading-room-scope";
import type { DailyCandleRecord } from "../../lib/market/contracts";
import type { TradingRoomQuote } from "../../lib/reviews/trading-room-holdings";
import { useAcceptedHoldingsSnapshot } from "./use-accepted-holdings-snapshot";
import type { HoldingsPublicationPermit } from "./holdings-publication-boundary";

afterEach(cleanup);

function portfolio(value: number): CurrentPortfolioModel {
  return {
    count: value,
    asOf: `2026-10-${String(value).padStart(2, "0")}`,
    holdings: { rows: [{ instrumentId: "usd", settlementCurrency: "USD", quote: { currency: "USD" } }] },
  } as unknown as CurrentPortfolioModel;
}

function history(value: number): HoldingsHistoryModel {
  return { points: [{ date: `2026-10-${String(value).padStart(2, "0")}` }] } as unknown as HoldingsHistoryModel;
}

function bundle(value: number) {
  return {
    portfolioModel: portfolio(value),
    holdingsHistoryModel: history(value),
    currentDayPoint: { date: `2026-10-${String(value).padStart(2, "0")}`, dailyPnl: { value } } as unknown as HoldingsHistoryPoint,
    fxSnapshot: { id: `fx-${value}`, baseCurrency: "CNY", asOf: `2026-10-${value}`, source: "test", status: "complete", rates: { "USD/CNY": String(value) } } as RoomFxSnapshot,
    quotesByInstrument: { usd: { price: String(value) } } as unknown as Readonly<Record<string, TradingRoomQuote | undefined>>,
    candlesByInstrument: { usd: [{ close: String(value) }] } as unknown as Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>,
  };
}

function expectBundle(value: number, snapshot: ReturnType<typeof useAcceptedHoldingsSnapshot>["displaySnapshot"]): void {
  expect(snapshot.portfolioModel.count).toBe(value);
  expect(snapshot.portfolioModel.asOf).toBe(`2026-10-${String(value).padStart(2, "0")}`);
  expect(snapshot.holdingsHistoryModel.points[0].date).toBe(`2026-10-${String(value).padStart(2, "0")}`);
  expect((snapshot.currentDayPoint as unknown as { dailyPnl: { value: number } }).dailyPnl.value).toBe(value);
  expect(snapshot.fxSnapshot?.id).toBe(`fx-${value}`);
  expect((snapshot.quotesByInstrument?.usd as unknown as { price: string }).price).toBe(String(value));
  expect((snapshot.candlesByInstrument?.usd?.[0] as unknown as { close: string }).close).toBe(String(value));
}

function expectUnavailable(snapshot: ReturnType<typeof useAcceptedHoldingsSnapshot>["displaySnapshot"]): void {
  expect(snapshot.portfolioModel.count).toBe(0);
  expect(snapshot.portfolioModel.rows).toHaveLength(0);
  expect(snapshot.portfolioModel.marketValue.convertedCny).toBeNull();
  expect(snapshot.portfolioModel.marketValue.originalByCurrency).toEqual({});
  expect(snapshot.holdingsHistoryModel.points).toHaveLength(0);
  expect(snapshot.currentDayPoint).toBeUndefined();
  expect(snapshot.fxSnapshot).toBeUndefined();
}

function workerInput(identity: string): HoldingsHistoryWorkerInput {
  return { identity } as unknown as HoldingsHistoryWorkerInput;
}

function input(overrides: Partial<Parameters<typeof useAcceptedHoldingsSnapshot>[0]> = {}) {
  const current = workerInput("initial");
  return {
    scopeKey: "scope-a",
    acceptanceRevision: "ledger-initial",
    portfolioModel: portfolio(1),
    holdingsHistoryModel: history(1),
    currentDayPoint: undefined,
    refreshPhase: "idle" as const,
    historyPending: false,
    historyError: null,
    historyCurrentInput: current,
    historyAcceptedInput: current,
    ...overrides,
  };
}

function publicationPermit(status: HoldingsPublicationPermit["status"]): HoldingsPublicationPermit {
  return {
    generation: 10,
    revision: "import-cold-scope",
    owner: "import",
    affectedInstrumentIds: ["usd"],
    requiredMarketDataIds: ["usd"],
    readbackInstrumentIds: status === "complete" ? ["usd"] : [],
    status,
    receipt: status === "complete"
      ? { requestedAtByInstrument: { usd: "2026-10-15T01:00:00.000Z" } }
      : undefined,
  };
}

function publishablePublicationPermit(
  status: "complete" | "partial",
): HoldingsPublicationPermit {
  return {
    ...publicationPermit(status),
    readbackInstrumentIds: ["usd"],
    receipt: { requestedAtByInstrument: { usd: "2026-10-15T01:00:00.000Z" } },
  };
}

describe("useAcceptedHoldingsSnapshot", () => {
  it("freezes a cold first read through three intermediate releases and accepts the complete bundle once", async () => {
    const first = workerInput("cold-first");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(1),
        refreshPhase: "downloading",
        historyPending: true,
        historyCurrentInput: first,
        historyAcceptedInput: null,
      }),
    });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.acceptedSnapshot).toBeNull();
    expectBundle(1, hook.result.current.displaySnapshot);

    for (const value of [2, 3, 4]) {
      hook.rerender(input({
        ...bundle(value),
        refreshPhase: "downloading",
        historyCurrentInput: first,
        historyAcceptedInput: first,
      }));
      await act(async () => { await Promise.resolve(); });
      // The first exact worker acknowledgement establishes the cold bundle
      // even while the market request is downloading. Later candidates stay
      // on that accepted baseline until the terminal phase.
      expectBundle(2, hook.result.current.displaySnapshot);
    }

    const final = workerInput("cold-final");
    hook.rerender(input({
      ...bundle(4),
      refreshPhase: "complete",
      historyCurrentInput: final,
      historyAcceptedInput: final,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(4, hook.result.current.displaySnapshot);
    expect(hook.result.current.acceptedSnapshot?.portfolioModel.count).toBe(4);
  });

  it("keeps the last financial bundle during an in-flight update and accepts one terminal partial bundle", async () => {
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), { initialProps: input() });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.displaySnapshot.portfolioModel.count).toBe(1);

    const candidateInput = workerInput("candidate");
    hook.rerender(input({
      portfolioModel: portfolio(2),
      holdingsHistoryModel: history(2),
      refreshPhase: "downloading",
      historyCurrentInput: candidateInput,
      historyAcceptedInput: candidateInput,
    }));
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.displaySnapshot.portfolioModel.count).toBe(1);

    hook.rerender(input({
      portfolioModel: portfolio(2),
      holdingsHistoryModel: history(2),
      refreshPhase: "partial",
      historyCurrentInput: candidateInput,
      historyAcceptedInput: candidateInput,
    }));
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.displaySnapshot.portfolioModel.count).toBe(2);

    hook.rerender(input({
      portfolioModel: portfolio(3),
      holdingsHistoryModel: history(3),
      refreshPhase: "failed",
      historyCurrentInput: workerInput("failed"),
      historyAcceptedInput: workerInput("failed"),
    }));
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.displaySnapshot.portfolioModel.count).toBe(2);
  });

  it("does not leak a scope A bundle into B while an old A result arrives late", async () => {
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), { initialProps: input() });
    await act(async () => { await Promise.resolve(); });

    const bInput = workerInput("scope-b");
    hook.rerender(input({
      scopeKey: "scope-b",
      portfolioModel: portfolio(20),
      holdingsHistoryModel: history(20),
      refreshPhase: "downloading",
      historyCurrentInput: bInput,
      historyAcceptedInput: null,
      historyPending: true,
    }));
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.displaySnapshot.portfolioModel.count).toBe(20);

    hook.rerender(input({
      scopeKey: "scope-b",
      portfolioModel: portfolio(21),
      holdingsHistoryModel: history(21),
      refreshPhase: "downloading",
      historyCurrentInput: bInput,
      historyAcceptedInput: bInput,
    }));
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.displaySnapshot.portfolioModel.count).toBe(21);

    hook.rerender(input({
      scopeKey: "scope-b",
      portfolioModel: portfolio(22),
      holdingsHistoryModel: history(22),
      refreshPhase: "downloading",
      historyCurrentInput: workerInput("scope-b-new"),
      historyAcceptedInput: workerInput("scope-b-new"),
    }));
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.displaySnapshot.portfolioModel.count).toBe(21);
  });

  it("accepts same-scope source changes only at an idle/terminal boundary and ignores quote-only live mutations", async () => {
    const original = workerInput("source-original");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({ ...bundle(1), historyCurrentInput: original, historyAcceptedInput: original }),
    });
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);

    const imported = workerInput("source-imported");
    hook.rerender(input({
      ...bundle(2),
      acceptanceRevision: "ledger-imported",
      refreshPhase: "idle",
      historyPending: true,
      historyCurrentInput: imported,
      historyAcceptedInput: null,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);
    hook.rerender(input({
      ...bundle(2),
      acceptanceRevision: "ledger-imported",
      refreshPhase: "idle",
      historyCurrentInput: imported,
      historyAcceptedInput: imported,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(2, hook.result.current.displaySnapshot);

    const quoteOnly = input({ ...bundle(3), refreshPhase: "idle", historyCurrentInput: imported, historyAcceptedInput: imported });
    hook.rerender(quoteOnly);
    await act(async () => { await Promise.resolve(); });
    expectBundle(2, hook.result.current.displaySnapshot);

    hook.rerender(input({
      ...bundle(3),
      refreshPhase: "downloading",
      historyPending: true,
      historyCurrentInput: imported,
      historyAcceptedInput: null,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(2, hook.result.current.displaySnapshot);
    hook.rerender(input({
      ...bundle(3),
      refreshPhase: "partial",
      historyCurrentInput: imported,
      historyAcceptedInput: imported,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(3, hook.result.current.displaySnapshot);
  });

  it("keeps the accepted source bundle while the current hydration boundary is not ready", async () => {
    const original = workerInput("source-hydration-before");
    const oldBundle = bundle(1);
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...oldBundle,
        historyCurrentInput: original,
        historyAcceptedInput: original,
        initialDataReady: true,
      }),
    });
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);

    const imported = workerInput("source-hydration-after");
    const candidate = bundle(2);
    hook.rerender(input({
      ...candidate,
      acceptanceRevision: "ledger-source-hydration-after",
      refreshPhase: "idle",
      historyPending: true,
      historyCurrentInput: imported,
      historyAcceptedInput: null,
      initialDataReady: false,
    }));
    await act(async () => { await Promise.resolve(); });

    hook.rerender(input({
      ...candidate,
      acceptanceRevision: "ledger-source-hydration-after",
      refreshPhase: "idle",
      historyPending: false,
      historyCurrentInput: imported,
      historyAcceptedInput: imported,
      initialDataReady: false,
    }));
    await act(async () => { await Promise.resolve(); });

    expectBundle(1, hook.result.current.displaySnapshot);
    expect(hook.result.current.displaySnapshot.historyInput).toBe(original);
    expect(hook.result.current.displaySnapshot.portfolioModel).toBe(oldBundle.portfolioModel);
    expect(hook.result.current.displaySnapshot.fxSnapshot).toBe(oldBundle.fxSnapshot);
    expect(hook.result.current.displaySnapshot.quotesByInstrument).toEqual(oldBundle.quotesByInstrument);
    expect(hook.result.current.displaySnapshot.candlesByInstrument).toEqual(oldBundle.candlesByInstrument);

    hook.rerender(input({
      ...candidate,
      acceptanceRevision: "ledger-source-hydration-after",
      refreshPhase: "idle",
      historyPending: false,
      historyCurrentInput: imported,
      historyAcceptedInput: imported,
      initialDataReady: true,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(2, hook.result.current.displaySnapshot);
  });

  it("keeps the accepted terminal bundle until the current hydration boundary is ready", async () => {
    const original = workerInput("terminal-hydration-before");
    const oldBundle = bundle(1);
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...oldBundle,
        historyCurrentInput: original,
        historyAcceptedInput: original,
        initialDataReady: true,
      }),
    });
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);

    const candidate = bundle(2);
    const refreshed = workerInput("terminal-hydration-after");
    hook.rerender(input({
      ...candidate,
      acceptanceRevision: "ledger-terminal-hydration-after",
      refreshPhase: "downloading",
      historyPending: true,
      historyCurrentInput: refreshed,
      historyAcceptedInput: null,
      initialDataReady: false,
    }));
    await act(async () => { await Promise.resolve(); });

    hook.rerender(input({
      ...candidate,
      acceptanceRevision: "ledger-terminal-hydration-after",
      refreshPhase: "partial",
      historyPending: false,
      historyCurrentInput: refreshed,
      historyAcceptedInput: refreshed,
      initialDataReady: false,
    }));
    await act(async () => { await Promise.resolve(); });

    expectBundle(1, hook.result.current.displaySnapshot);
    expect(hook.result.current.displaySnapshot.historyInput).toBe(original);
    expect(hook.result.current.displaySnapshot.portfolioModel).toBe(oldBundle.portfolioModel);
    expect(hook.result.current.displaySnapshot.fxSnapshot).toBe(oldBundle.fxSnapshot);
    expect(hook.result.current.displaySnapshot.quotesByInstrument).toEqual(oldBundle.quotesByInstrument);
    expect(hook.result.current.displaySnapshot.candlesByInstrument).toEqual(oldBundle.candlesByInstrument);

    hook.rerender(input({
      ...candidate,
      acceptanceRevision: "ledger-terminal-hydration-after",
      refreshPhase: "partial",
      historyPending: false,
      historyCurrentInput: refreshed,
      historyAcceptedInput: refreshed,
      initialDataReady: true,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(2, hook.result.current.displaySnapshot);
  });

  it("does not republish a late exact worker input without a new pending boundary", async () => {
    const original = workerInput("source-stable");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(1),
        refreshPhase: "partial",
        historyCurrentInput: original,
        historyAcceptedInput: original,
      }),
    });
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);

    const late = workerInput("late-worker-input");
    hook.rerender(input({
      ...bundle(2),
      refreshPhase: "partial",
      historyCurrentInput: late,
      historyAcceptedInput: late,
      historyPending: false,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);
  });

  it("ignores quote, cutoff, and late FX worker changes without an explicit publication boundary", async () => {
    const original = workerInput("source-stable");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(1),
        historyCurrentInput: original,
        historyAcceptedInput: original,
      }),
    });
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);

    const late = workerInput("fx-late-or-clock-tick");
    hook.rerender(input({
      ...bundle(2),
      refreshPhase: "partial",
      historyCurrentInput: late,
      historyAcceptedInput: late,
      historyPending: false,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);
  });

  it("accepts a published FX boundary once its exact worker result is settled", async () => {
    const original = workerInput("fx-before");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(1),
        historyCurrentInput: original,
        historyAcceptedInput: original,
      }),
    });
    await act(async () => { await Promise.resolve(); });

    const published = workerInput("fx-published");
    hook.rerender(input({
      ...bundle(2),
      acceptanceRevision: "fx:published-2",
      // An independent FX publication starts its own worker pending edge;
      // it is not the market-data request already owned by the refresh hook.
      refreshPhase: "idle",
      historyPending: true,
      historyCurrentInput: published,
      historyAcceptedInput: null,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);

    hook.rerender(input({
      ...bundle(2),
      acceptanceRevision: "fx:published-2",
      refreshPhase: "idle",
      historyPending: false,
      historyCurrentInput: published,
      historyAcceptedInput: published,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(2, hook.result.current.displaySnapshot);
  });

  it("does not publish an in-flight FX candidate after cancellation", async () => {
    const original = workerInput("cancel-fx-before");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(1),
        historyCurrentInput: original,
        historyAcceptedInput: original,
      }),
    });
    await act(async () => { await Promise.resolve(); });

    const candidate = workerInput("cancel-fx-candidate");
    hook.rerender(input({
      ...bundle(2),
      acceptanceRevision: "fx:cancelled-candidate",
      refreshPhase: "downloading",
      historyPending: true,
      historyCurrentInput: candidate,
      historyAcceptedInput: null,
    }));
    await act(async () => { await Promise.resolve(); });
    hook.rerender(input({
      ...bundle(2),
      acceptanceRevision: "fx:cancelled-candidate",
      refreshPhase: "cancelled",
      historyPending: false,
      historyCurrentInput: candidate,
      historyAcceptedInput: candidate,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);
  });

  it("does not publish an in-flight FX candidate after an all-failed request", async () => {
    const original = workerInput("failed-fx-before");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(1),
        historyCurrentInput: original,
        historyAcceptedInput: original,
      }),
    });
    await act(async () => { await Promise.resolve(); });

    const candidate = workerInput("failed-fx-candidate");
    hook.rerender(input({
      ...bundle(2),
      acceptanceRevision: "fx:failed-candidate",
      refreshPhase: "downloading",
      historyPending: true,
      historyCurrentInput: candidate,
      historyAcceptedInput: null,
    }));
    await act(async () => { await Promise.resolve(); });
    hook.rerender(input({
      ...bundle(2),
      acceptanceRevision: "fx:failed-candidate",
      refreshPhase: "failed",
      historyPending: false,
      historyCurrentInput: candidate,
      historyAcceptedInput: candidate,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);
  });

  it("publishes an in-flight FX candidate once a mixed terminal batch is ready", async () => {
    const original = workerInput("partial-fx-before");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(1),
        historyCurrentInput: original,
        historyAcceptedInput: original,
      }),
    });
    await act(async () => { await Promise.resolve(); });

    const candidate = workerInput("partial-fx-candidate");
    hook.rerender(input({
      ...bundle(2),
      acceptanceRevision: "fx:partial-candidate",
      refreshPhase: "downloading",
      historyPending: true,
      historyCurrentInput: candidate,
      historyAcceptedInput: null,
    }));
    await act(async () => { await Promise.resolve(); });
    hook.rerender(input({
      ...bundle(2),
      acceptanceRevision: "fx:partial-candidate",
      refreshPhase: "partial",
      historyPending: false,
      historyCurrentInput: candidate,
      historyAcceptedInput: candidate,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(2, hook.result.current.displaySnapshot);
  });

  it("keeps a cancelled result frozen when the late worker input has no new source boundary", async () => {
    const original = workerInput("cancel-before");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(1),
        historyCurrentInput: original,
        historyAcceptedInput: original,
      }),
    });
    await act(async () => { await Promise.resolve(); });

    const late = workerInput("cancelled-late");
    hook.rerender(input({
      ...bundle(2),
      refreshPhase: "cancelled",
      historyCurrentInput: late,
      historyAcceptedInput: late,
      historyPending: false,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);
  });

  it("does not accept a changed FX/ledger revision that arrives after cancellation", async () => {
    const original = workerInput("cancel-boundary-before");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(1),
        historyCurrentInput: original,
        historyAcceptedInput: original,
      }),
    });
    await act(async () => { await Promise.resolve(); });

    const late = workerInput("cancel-boundary-late");
    hook.rerender(input({
      ...bundle(2),
      acceptanceRevision: "fx:cancelled-request",
      refreshPhase: "downloading",
      historyPending: true,
      historyCurrentInput: late,
      historyAcceptedInput: null,
    }));
    await act(async () => { await Promise.resolve(); });
    hook.rerender(input({
      ...bundle(2),
      acceptanceRevision: "fx:cancelled-request",
      refreshPhase: "cancelled",
      historyPending: false,
      historyCurrentInput: late,
      historyAcceptedInput: late,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(1, hook.result.current.displaySnapshot);
  });

  it("waits for the persisted cache boundary before freezing the first bundle", async () => {
    const cached = workerInput("hydrated-cache");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(0),
        initialDataReady: false,
        historyCurrentInput: cached,
        historyAcceptedInput: cached,
      }),
    });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.acceptedSnapshot).toBeNull();
    expectBundle(0, hook.result.current.displaySnapshot);

    hook.rerender(input({
      ...bundle(5),
      initialDataReady: true,
      historyCurrentInput: cached,
      historyAcceptedInput: cached,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(5, hook.result.current.displaySnapshot);
    expect(hook.result.current.acceptedSnapshot?.portfolioModel.count).toBe(5);
  });

  it("replaces a provisional cold candidate with the hydrated cache before the history worker settles", async () => {
    const cached = workerInput("hydrated-cache-pending");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(0),
        initialDataReady: false,
        historyPending: true,
        historyCurrentInput: cached,
        historyAcceptedInput: null,
      }),
    });
    await act(async () => { await Promise.resolve(); });
    expectBundle(0, hook.result.current.displaySnapshot);

    hook.rerender(input({
      ...bundle(7),
      initialDataReady: true,
      historyPending: true,
      historyCurrentInput: cached,
      historyAcceptedInput: null,
    }));
    await act(async () => { await Promise.resolve(); });
    expectBundle(7, hook.result.current.displaySnapshot);
    expect(hook.result.current.acceptedSnapshot).toBeNull();
  });

  it("fails closed for a cold owned ledger when the publication permit is missing", async () => {
    const candidate = workerInput("cold-owned-without-permit");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(8),
        scopeKey: "scope-cold-owned-without-permit",
        acceptanceRevision: "import-cold-without-permit",
        ledgerRevision: "import-cold-without-permit",
        historyCurrentInput: candidate,
        historyAcceptedInput: candidate,
        initialDataReady: true,
        publicationScopeInstrumentIds: new Set(["usd"]),
        ledgerPublicationRequired: true,
        publicationPermit: null,
      }),
    });
    await act(async () => { await Promise.resolve(); });

    expect(hook.result.current.acceptedSnapshot).toBeNull();
    expectUnavailable(hook.result.current.displaySnapshot);
  });

  it("fails closed before hydration even when an independent ledger path supplies a candidate", async () => {
    const candidate = workerInput("cold-before-hydration");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(8),
        historyCurrentInput: candidate,
        historyAcceptedInput: candidate,
        initialDataReady: false,
        ledgerPublicationRequired: false,
        publicationPermit: null,
      }),
    });
    await act(async () => { await Promise.resolve(); });

    expect(hook.result.current.acceptedSnapshot).toBeNull();
    expectUnavailable(hook.result.current.displaySnapshot);

    hook.rerender(input({
      ...bundle(8),
      historyCurrentInput: candidate,
      historyAcceptedInput: candidate,
      initialDataReady: true,
      ledgerPublicationRequired: false,
      publicationPermit: null,
    }));
    await act(async () => { await Promise.resolve(); });

    expectBundle(8, hook.result.current.displaySnapshot);
  });

  it.each(["complete", "partial"] as const)(
    "keeps a publishable cold owned %s permit unavailable while history is pending",
    async status => {
      const candidate = workerInput(`cold-owned-${status}-pending`);
      const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
        initialProps: input({
          ...bundle(8),
          scopeKey: `scope-cold-owned-${status}-pending`,
          acceptanceRevision: `import-cold-${status}-pending`,
          ledgerRevision: `import-cold-${status}-pending`,
          historyPending: true,
          historyCurrentInput: candidate,
          historyAcceptedInput: candidate,
          publicationScopeInstrumentIds: new Set(["usd"]),
          ledgerPublicationRequired: true,
          publicationPermit: publishablePublicationPermit(status),
        }),
      });
      await act(async () => { await Promise.resolve(); });

      expect(hook.result.current.acceptedSnapshot).toBeNull();
      expectUnavailable(hook.result.current.displaySnapshot);
    },
  );

  it.each(["complete", "partial"] as const)(
    "keeps a publishable cold owned %s permit unavailable on worker input mismatch",
    async status => {
      const candidate = workerInput(`cold-owned-${status}-mismatch`);
      const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
        initialProps: input({
          ...bundle(8),
          scopeKey: `scope-cold-owned-${status}-mismatch`,
          acceptanceRevision: `import-cold-${status}-mismatch`,
          ledgerRevision: `import-cold-${status}-mismatch`,
          historyCurrentInput: candidate,
          historyAcceptedInput: workerInput(`cold-owned-${status}-old`),
          publicationScopeInstrumentIds: new Set(["usd"]),
          ledgerPublicationRequired: true,
          publicationPermit: publishablePublicationPermit(status),
        }),
      });
      await act(async () => { await Promise.resolve(); });

      expect(hook.result.current.acceptedSnapshot).toBeNull();
      expectUnavailable(hook.result.current.displaySnapshot);
    },
  );

  it.each(["pending", "failed", "cancelled"] as const)(
    "does not capture a cold scope before the owned %s permit is publishable",
    async status => {
      const candidate = workerInput(`cold-owned-${status}`);
      const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
        initialProps: input({
          ...bundle(8),
          scopeKey: "scope-cold-owned",
          acceptanceRevision: "import-cold-scope",
          ledgerRevision: "import-cold-scope",
          historyCurrentInput: candidate,
          historyAcceptedInput: candidate,
          publicationScopeInstrumentIds: new Set(["usd"]),
          ledgerPublicationRequired: true,
          publicationPermit: publicationPermit(status),
        }),
      });
      await act(async () => { await Promise.resolve(); });

      expect(hook.result.current.acceptedSnapshot).toBeNull();
      expectUnavailable(hook.result.current.displaySnapshot);
    },
  );

  it("freezes an exact cached history baseline when automatic valuation is already waiting", async () => {
    const cached = workerInput("waiting-cache");
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(6),
        refreshPhase: "waiting",
        historyCurrentInput: cached,
        historyAcceptedInput: cached,
        historyPending: false,
        initialDataReady: true,
      }),
    });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.acceptedSnapshot?.portfolioModel.count).toBe(6);
    expectBundle(6, hook.result.current.displaySnapshot);
  });

  it("copies direct price inputs only for accepted current holdings", async () => {
    const hook = renderHook(props => useAcceptedHoldingsSnapshot(props), {
      initialProps: input({
        ...bundle(1),
        quotesByInstrument: {
          usd: { price: "1" } as unknown as TradingRoomQuote,
          "unrelated-history-instrument": { price: "999" } as unknown as TradingRoomQuote,
        },
        candlesByInstrument: {
          usd: [{ close: "1" }] as unknown as readonly DailyCandleRecord[],
          "unrelated-history-instrument": [{ close: "999" }] as unknown as readonly DailyCandleRecord[],
        },
      }),
    });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.displaySnapshot.quotesByInstrument).toEqual({ usd: { price: "1" } });
    expect(hook.result.current.displaySnapshot.candlesByInstrument).toEqual({ usd: [{ close: "1" }] });
  });
});
