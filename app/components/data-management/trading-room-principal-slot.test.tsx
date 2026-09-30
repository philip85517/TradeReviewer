import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrincipalState } from "../../lib/principal/principal-model";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../../lib/trades/tradingview-account-identity";
import { TradingRoomPrincipalSlot } from "./trading-room-principal-slot";

const usePrincipalSettings = vi.hoisted(() => vi.fn());
const useReferenceCapital = vi.hoisted(() => vi.fn());
const capturedPanels = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const capturedProvisionalPanels = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock("../../lib/principal/use-principal-settings", () => ({ usePrincipalSettings }));
vi.mock("../../lib/principal/use-reference-capital", () => ({ useReferenceCapital }));
vi.mock("./reference-capital-panel", () => ({
  ReferenceCapitalPanel: (props: Record<string, unknown>) => {
    capturedPanels.push(props);
    const accounts = props.accounts as Array<{ id: string }>;
    return <output aria-label="参考资本范围" data-account-ids={accounts.map(account => account.id).join(",")} data-simulation-run-id={String(props.simulationRunId)} />;
  },
}));
vi.mock("./account-principal-provisional-panel", () => ({
  AccountPrincipalProvisionalPanel: (props: Record<string, unknown>) => {
    capturedProvisionalPanels.push(props);
    return <output aria-label="暂定本金范围" data-account-id={String(props.accountId)} />;
  },
}));

const emptyPrincipalState = { version: 1, scopes: {} } as PrincipalState;

function execution(id: string, accountId: string, run: string, platform = "tradingview", tradeNature: "simulation" | "live" = "simulation") {
  return {
    id,
    accountId,
    accountLabel: accountId,
    instrument: { id: "US:SPY", symbol: "SPY", name: "SPY", market: "US", currency: "USD" },
    side: "buy" as const,
    executedAt: "2026-09-01T00:00:00Z",
    quantity: "1",
    price: "10",
    fee: "0",
    source: { platform, row: 1, tradeNature, simulationRunId: run },
  };
}

function entry(accountId: string, sourceExecutions: ReturnType<typeof execution>[], tradeNature: "simulation" | "live" = "simulation"): TradeLibraryEntry {
  const firstExecution = sourceExecutions[0]!;
  return {
    groupId: firstExecution.instrument.id,
    scopeKey: tradeNature,
    tradeNature,
    simulationRunId: tradeNature === "simulation" ? firstExecution.source.simulationRunId : undefined,
    instrument: firstExecution.instrument,
    executions: sourceExecutions,
    episodes: [{
      episode: {
        id: `${accountId}-episode`,
        accountId,
        accountLabel: accountId,
        instrument: firstExecution.instrument,
        tradeNature,
        direction: "long",
        status: "open",
        startedAt: firstExecution.executedAt,
        openingQuantity: "1",
        remainingQuantity: "1",
        executions: sourceExecutions,
      },
      metrics: { buyCount: 1, sellCount: 0, boughtQuantity: "1", soldQuantity: "0", grossExposure: "10", fees: "0", realizedPnl: "0", unrealizedPnl: "0", netPnl: "0", returnPercent: "0", holdingMilliseconds: 0 },
      reviewStatus: "pending",
      confirmedTagIds: [],
      tagDictionaryVersion: 1,
      rMultiple: null,
    }],
    accountCount: 1,
    tradeCount: sourceExecutions.length,
    episodeCount: 1,
    firstTradeAt: firstExecution.executedAt,
    lastTradeAt: firstExecution.executedAt,
    status: "open",
    netPnl: "0",
    returnPercent: "0",
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
}

describe("TradingRoomPrincipalSlot", () => {
  beforeEach(() => {
    capturedPanels.length = 0;
    capturedProvisionalPanels.length = 0;
    usePrincipalSettings.mockReturnValue({ state: emptyPrincipalState, config: {}, loading: false, saving: false, error: null, save: vi.fn(), clear: vi.fn() });
    useReferenceCapital.mockReturnValue({ state: { version: 2, records: [] }, loading: false, saving: false, error: null, save: vi.fn(), remove: vi.fn() });
  });

  afterEach(() => cleanup());

  it("passes the canonical account and run-null scope to principal settings and reference capital", () => {
    const canonicalExecutions = [
      execution("r1", TRADINGVIEW_CANONICAL_ACCOUNT_ID, "source-run-1"),
      execution("r2", TRADINGVIEW_CANONICAL_ACCOUNT_ID, "source-run-2"),
    ];
    render(<TradingRoomPrincipalSlot
      entries={[entry(TRADINGVIEW_CANONICAL_ACCOUNT_ID, canonicalExecutions), entry(TRADINGVIEW_CANONICAL_ACCOUNT_ID, [execution("live", TRADINGVIEW_CANONICAL_ACCOUNT_ID, "live-run", "futu", "live")], "live")]}
      sharedScope={{ nature: "simulation", accountIds: [TRADINGVIEW_CANONICAL_ACCOUNT_ID], simulationRunId: null, reportCurrency: "original" }}
    />);

    expect(usePrincipalSettings).toHaveBeenCalledWith({ scope: { nature: "simulation", simulationRunId: null, accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID }, enabled: true });
    expect(screen.getByLabelText("参考资本范围")).toHaveAttribute("data-account-ids", TRADINGVIEW_CANONICAL_ACCOUNT_ID);
    expect(screen.getByLabelText("参考资本范围")).toHaveAttribute("data-simulation-run-id", "null");
    expect(capturedPanels[0]?.nature).toBe("simulation");
    expect(screen.getByLabelText("暂定本金范围")).toHaveAttribute("data-account-id", TRADINGVIEW_CANONICAL_ACCOUNT_ID);
  });

  it("keeps the single canonical provisional account visible when all accounts are selected", () => {
    render(<TradingRoomPrincipalSlot
      entries={[entry(TRADINGVIEW_CANONICAL_ACCOUNT_ID, [execution("r1", TRADINGVIEW_CANONICAL_ACCOUNT_ID, "source-run-1")]) ]}
      sharedScope={{ nature: "simulation", accountIds: [], simulationRunId: null, reportCurrency: "original" }}
    />);

    expect(screen.getByLabelText("暂定本金范围")).toBeInTheDocument();
    expect(capturedProvisionalPanels).toHaveLength(1);
  });

  it("does not expose the canonical provisional account on legacy runs or live scopes", () => {
    const { rerender } = render(<TradingRoomPrincipalSlot
      entries={[entry(TRADINGVIEW_CANONICAL_ACCOUNT_ID, [execution("r1", TRADINGVIEW_CANONICAL_ACCOUNT_ID, "source-run-1")]) ]}
      sharedScope={{ nature: "simulation", accountIds: [TRADINGVIEW_CANONICAL_ACCOUNT_ID], simulationRunId: "source-run-1", reportCurrency: "original" }}
    />);

    expect(screen.queryByLabelText("暂定本金范围")).not.toBeInTheDocument();
    expect(capturedProvisionalPanels).toHaveLength(0);

    rerender(<TradingRoomPrincipalSlot
      entries={[entry(TRADINGVIEW_CANONICAL_ACCOUNT_ID, [execution("live", TRADINGVIEW_CANONICAL_ACCOUNT_ID, "live-run", "futu", "live")], "live")]}
      sharedScope={{ nature: "live", accountIds: [TRADINGVIEW_CANONICAL_ACCOUNT_ID], simulationRunId: null, reportCurrency: "original" }}
    />);

    expect(screen.queryByLabelText("暂定本金范围")).not.toBeInTheDocument();
    expect(capturedProvisionalPanels).toHaveLength(0);
  });
});
