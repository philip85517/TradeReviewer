import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries, type TradeLibraryEntry } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import type { SharedScope } from "../../lib/reviews/shared-scope";
import { ReviewDashboard } from "./review-dashboard";

const hydrationInstrument: Instrument = {
  id: "US:H2025",
  symbol: "H2025",
  name: "2025 已平仓 H",
  market: "US",
  currency: "USD",
};

const oldQuote = {
  price: "20",
  currency: "USD",
  quoteDate: "2026-10-14",
  fetchedAt: "2026-10-14T08:00:00.000Z",
  provider: "consumer-fixture",
  freshness: "stale" as const,
};

function closedHEntries(accountIds: readonly string[] = ["account-1"]): TradeLibraryEntry[] {
  const executions: TradeExecution[] = accountIds.flatMap((accountId, index) => {
    const suffix = `${accountId}:${index}`;
    return [
      {
        id: `${suffix}:buy`,
        accountId,
        accountLabel: accountId === "account-1" ? "主账户" : "备用账户",
        instrument: hydrationInstrument,
        side: "buy",
        executedAt: "2025-02-10T14:00:00.000Z",
        quantity: "1",
        price: "10",
        fee: "0",
        source: { platform: "consumer-fixture", row: index * 2 + 1 },
      },
      {
        id: `${suffix}:sell`,
        accountId,
        accountLabel: accountId === "account-1" ? "主账户" : "备用账户",
        instrument: hydrationInstrument,
        side: "sell",
        executedAt: "2025-02-11T14:00:00.000Z",
        quantity: "1",
        price: "11",
        fee: "0",
        source: { platform: "consumer-fixture", row: index * 2 + 2 },
      },
    ];
  });
  return buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {}, {});
}

function scope(accountId: string): SharedScope {
  return {
    nature: "live",
    accountIds: [accountId],
    simulationRunId: null,
    reportCurrency: "original",
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-15T12:00:00.000Z"), shouldAdvanceTime: true });
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PAI16 Dashboard hydration recovery consumer", () => {
  it("routes a duplicate closed-only 2025 hydration need through the default-year manual action", async () => {
    const entries = closedHEntries();
    const onRefreshHoldingsValuation = vi.fn(() => false);
    render(
      <ReviewDashboard
        entries={entries}
        onOpenInReview={() => undefined}
        referenceCapitalEnabled={false}
        holdingsAsOf="2026-10-15T12:00:00.000Z"
        holdingsDataReady={false}
        holdingsQuotesByInstrument={{ [hydrationInstrument.id]: oldQuote }}
        holdingsHydrationRetryInstruments={[
          { instrumentId: hydrationInstrument.id, market: hydrationInstrument.market },
          { instrumentId: hydrationInstrument.id, market: hydrationInstrument.market },
        ]}
        onRefreshHoldingsValuation={onRefreshHoldingsValuation}
      />,
    );

    const workspace = screen.getByRole("region", { name: "持仓照看" });
    expect(screen.getByRole("tab", { name: "持仓历史：今年至今", selected: true })).toBeInTheDocument();
    expect(within(workspace).getByRole("region", { name: "历史持仓估值" })).not.toHaveTextContent(hydrationInstrument.name);
    expect(onRefreshHoldingsValuation).not.toHaveBeenCalled();

    fireEvent.click(within(workspace).getByRole("button", { name: "更新估值" }));
    await waitFor(() => {
      expect(onRefreshHoldingsValuation).toHaveBeenCalledWith([hydrationInstrument.id], "manual");
    });
    expect(onRefreshHoldingsValuation).toHaveBeenCalledTimes(1);
  });

  it("does not let a late H response cross a changed scope or let scope membership become a request", async () => {
    const entries = closedHEntries(["account-1", "account-2"]);
    let resolveRefresh!: (value: boolean) => void;
    const onRefreshHoldingsValuation = vi.fn(() => new Promise<boolean>(resolve => {
      resolveRefresh = resolve;
    }));
    const view = render(
      <ReviewDashboard
        entries={entries}
        onOpenInReview={() => undefined}
        referenceCapitalEnabled={false}
        sharedScope={scope("account-1")}
        holdingsAsOf="2026-10-15T12:00:00.000Z"
        holdingsDataReady={false}
        holdingsQuotesByInstrument={{ [hydrationInstrument.id]: oldQuote }}
        holdingsHydrationRetryInstruments={[{ instrumentId: hydrationInstrument.id, market: hydrationInstrument.market }]}
        onRefreshHoldingsValuation={onRefreshHoldingsValuation}
      />,
    );

    const workspace = screen.getByRole("region", { name: "持仓照看" });
    fireEvent.click(within(workspace).getByRole("button", { name: "更新估值" }));
    await waitFor(() => {
      expect(onRefreshHoldingsValuation).toHaveBeenCalledWith([hydrationInstrument.id], "manual");
    });

    view.rerender(
      <ReviewDashboard
        entries={entries}
        onOpenInReview={() => undefined}
        referenceCapitalEnabled={false}
        sharedScope={scope("account-2")}
        holdingsAsOf="2026-10-15T12:00:00.000Z"
        holdingsDataReady={false}
        holdingsQuotesByInstrument={{ [hydrationInstrument.id]: oldQuote }}
        holdingsHydrationRetryInstruments={[]}
        onRefreshHoldingsValuation={onRefreshHoldingsValuation}
      />,
    );

    await act(async () => {
      resolveRefresh(true);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(onRefreshHoldingsValuation).toHaveBeenCalledTimes(1);
    });

    const switchedWorkspace = screen.getByRole("region", { name: "持仓照看" });
    fireEvent.click(within(switchedWorkspace).getByRole("button", { name: /更新估值|重试/ }));
    await waitFor(() => {
      expect(switchedWorkspace.querySelector("[data-refresh-phase]")).toHaveTextContent("当前无需补齐行情");
    });
    expect(onRefreshHoldingsValuation).toHaveBeenCalledTimes(1);
  });
});
