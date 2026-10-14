import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectedTradingDates } from "../../lib/market/calendar";
import type { DailyCandleRecord } from "../../lib/market/contracts";
import {
  type HoldingsHistoryWorkerRequestMessage,
  type HoldingsHistoryWorkerResponseMessage,
  type HoldingsHistoryWorkerResult,
} from "../../lib/reviews/holdings-history-worker";
import type { HoldingsHistoryModel, HoldingsHistoryPoint } from "../../lib/reviews/trading-room-history";
import { buildRoomMoneySubtotal } from "../../lib/reviews/holdings-money-subtotal";
import { buildRoomMoneyView, type RoomScope } from "../../lib/reviews/trading-room-scope";
import type { PositionLedgerSnapshot } from "../../lib/replay/position-ledger";
import type { RoomFxSnapshot } from "../../lib/reviews/trading-room-scope";
import type { TradingRoomQuote } from "../../lib/reviews/trading-room-holdings";
import { ReviewDashboard, type ReviewDashboardProps } from "./review-dashboard";
import type { HoldingsRefreshReceipt } from "./use-holdings-valuation-refresh";
import type { HoldingsPublicationPermit } from "./holdings-publication-boundary";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";

type Fixture = {
  entries: TradeLibraryEntry[];
  positionsByEpisode: Readonly<Record<string, PositionLedgerSnapshot>>;
  instrumentIds: string[];
};

type MarketCandidate = {
  asOf: string;
  fx: RoomFxSnapshot;
  price: string;
  quotes: Readonly<Record<string, TradingRoomQuote>>;
  candles: Readonly<Record<string, readonly DailyCandleRecord[]>>;
};

const initialAsOf = "2026-10-15T12:00:00.000Z";
const initialPrice = "15";
const initialFxRate = "7";
const initialFxPublishedAt = "2026-10-14";
const receiptAt = "2026-10-15T01:00:00.000Z";

class ControlledWorker {
  static instances: ControlledWorker[] = [];
  readonly messages: HoldingsHistoryWorkerRequestMessage[] = [];
  onmessage: ((event: MessageEvent<HoldingsHistoryWorkerResponseMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;

  constructor() {
    ControlledWorker.instances.push(this);
  }

  postMessage(message: HoldingsHistoryWorkerRequestMessage): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  respondNext(): void {
    const message = this.messages.shift();
    if (!message) throw new Error("consumer fixture expected a queued holdings worker request");
    const model = (scope: typeof message.input.observationScope): HoldingsHistoryModel => ({
      points: [historyPoint(scope, message.input.fxSnapshot, message.input.entries, message.input.asOf)],
      start: scope.period.startDate,
      end: scope.period.endDate,
      reasons: [],
      scope,
      fxSnapshotId: message.input.fxSnapshot?.id ?? null,
    });
    const result: HoldingsHistoryWorkerResult = {
      observation: model(message.input.observationScope),
      currentDay: model(message.input.currentDayScope),
    };
    this.onmessage?.({
      data: { requestId: message.requestId, result },
    } as MessageEvent<HoldingsHistoryWorkerResponseMessage>);
  }
}

function historyPoint(
  scope: RoomScope,
  fx: RoomFxSnapshot | undefined,
  entries: readonly TradeLibraryEntry[],
  asOf: string | undefined,
): HoldingsHistoryPoint {
  const date = scope.period.endDate;
  const price = asOf === "2026-10-15T12:03:00.000Z"
    ? "18"
    : asOf === "2026-10-15T12:02:00.000Z"
      ? "17"
      : asOf === "2026-10-15T12:01:00.000Z"
        ? "16"
        : "15";
  const scopedEntries = entries.filter(entry => {
    const episode = entry.episodes[0]?.episode;
    if (!episode || episode.tradeNature !== scope.nature) return false;
    if (scope.accountIds.length > 0 && !scope.accountIds.includes(episode.accountId)) return false;
    if (scope.instrumentIds.length > 0 && !scope.instrumentIds.includes(entry.instrument.id)) return false;
    if (scope.markets.length > 0 && !scope.markets.includes(entry.instrument.market)) return false;
    return true;
  });
  const holdings = scopedEntries.map(entry => {
    const instrument = entry.instrument;
    const accountId = entry.episodes[0]?.episode.accountId ?? "unknown";
    const marketValue = String(Number(price) * 2);
    const unrealizedPnl = String((Number(price) - 10) * 2);
    return {
      key: `${instrument.id}:${accountId}:live`,
      instrumentId: instrument.id,
      instrumentName: instrument.name,
      accountId,
      currency: "USD",
      quantity: "2",
      marketValue,
      cost: "20",
      unrealizedPnl,
      unrealizedReturnPercent: String((Number(price) - 10) * 10),
      quoteDate: "2026-10-14",
      quotePrice: price,
      quantityAvailable: true,
      marketValueAvailable: true,
      costAvailable: true,
      reasons: [],
    };
  });
  const amounts = (field: "marketValue" | "cost" | "unrealizedPnl") => holdings.map(holding => ({
    currency: holding.currency,
    amount: holding[field],
  }));
  const marketValue = buildRoomMoneyView(amounts("marketValue"), fx, "CNY");
  const cost = buildRoomMoneyView(amounts("cost"), fx, "CNY");
  const unrealizedPnl = buildRoomMoneyView(amounts("unrealizedPnl"), fx, "CNY");
  const knownSubtotals = {
    marketValue: buildRoomMoneySubtotal(holdings.map(holding => ({ memberKey: holding.key, currency: holding.currency, amount: holding.marketValue })), fx, "CNY"),
    cost: buildRoomMoneySubtotal(holdings.map(holding => ({ memberKey: holding.key, currency: holding.currency, amount: holding.cost })), fx, "CNY"),
    unrealizedPnl: buildRoomMoneySubtotal(holdings.map(holding => ({ memberKey: holding.key, currency: holding.currency, amount: holding.unrealizedPnl })), fx, "CNY"),
  };
  const dailyPnl = buildRoomMoneyView([{ currency: "USD", amount: "0" }], fx, "CNY");
  const dailyCapital = buildRoomMoneyView([{ currency: "USD", amount: String(holdings.length * 20) }], fx, "CNY");
  return {
    date,
    valuationDate: date,
    dailyPnl,
    dailyPnlAvailable: true,
    dailyPnlReasons: [],
    dailyPnlDenominator: dailyCapital,
    dailyPnlPercent: "0",
    dailyPnlPercentAvailable: true,
    dailyPnlPercentReasons: [],
    dailyCapital,
    dailyReturnPercent: "0",
    dailyReturnPercentAvailable: true,
    dailyReturnPercentReasons: [],
    holdings,
    marketValue,
    cost,
    unrealizedPnl,
    knownSubtotals,
    unrealizedReturnPercent: String((Number(price) - 10) * 10),
    available: true,
    quantityAvailable: true,
    marketValueAvailable: true,
    costAvailable: true,
    unrealizedPnlAvailable: true,
    coverage: {
      total: holdings.length,
      quantity: holdings.length,
      marketValue: holdings.length,
      cost: holdings.length,
      unrealizedPnl: holdings.length,
    },
    reasons: [],
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(initialAsOf), shouldAdvanceTime: true });
  ControlledWorker.instances = [];
  vi.stubGlobal("Worker", ControlledWorker);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function positionSnapshot(): PositionLedgerSnapshot {
  return {
    quantity: "2",
    averageCost: "10",
    realizedPnl: "0",
    unrealizedPnl: "10",
    netPnl: "10",
    fees: "0",
    grossCapitalDeployed: "20",
    returnPercent: "50",
  };
}

function candle(instrumentId: string, tradingDate: string, close: string, fetchedAt: string): DailyCandleRecord {
  return {
    instrumentId,
    tradingDate,
    open: close,
    high: close,
    low: close,
    close,
    volume: "1000",
    currency: "USD",
    provider: "yahoo",
    providerSymbol: instrumentId,
    adjustmentMode: "raw",
    fetchedAt,
  };
}

function holdingEntry(index: number, accountId = "account-1"): TradeLibraryEntry {
  const suffix = ["ALPHA", "BRAVO", "CHARLIE"][index];
  const instrument: Instrument = {
    id: `US:${suffix}`,
    symbol: suffix,
    name: `${suffix}持仓`,
    market: "US",
    currency: "USD",
  };
  const execution: TradeExecution = {
    id: `${suffix}:buy`,
    accountId,
    accountLabel: accountId === "account-1" ? "主账户" : "备用账户",
    instrument,
    side: "buy",
    executedAt: "2026-10-01T14:00:00.000Z",
    quantity: "2",
    price: "10",
    fee: "0",
    source: { platform: "consumer-fixture", row: index + 1 },
  };
  const episodeId = `episode:${suffix}`;
  const episode = {
    id: episodeId,
    accountId,
    accountLabel: accountId === "account-1" ? "主账户" : "备用账户",
    instrument,
    tradeNature: "live" as const,
    direction: "long" as const,
    status: "open" as const,
    startedAt: execution.executedAt,
    openingQuantity: "2",
    remainingQuantity: "2",
    executions: [execution],
  };
  return {
    groupId: `${instrument.id}|live:${accountId}`,
    tradeNature: "live",
    instrument,
    executions: [execution],
    episodes: [{
      episode,
      metrics: {
        buyCount: 1,
        sellCount: 0,
        boughtQuantity: "2",
        soldQuantity: "0",
        grossExposure: "20",
        fees: "0",
        realizedPnl: "0",
        unrealizedPnl: "10",
        netPnl: "10",
        returnPercent: "50",
        holdingMilliseconds: null,
      },
      reviewStatus: "pending",
      confirmedTagIds: [],
      tagDictionaryVersion: 1,
      rMultiple: null,
    }],
    accountCount: 1,
    tradeCount: 1,
    episodeCount: 1,
    firstTradeAt: execution.executedAt,
    lastTradeAt: execution.executedAt,
    status: "open",
    netPnl: "10",
    returnPercent: "50",
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
}

function fixture(): Fixture {
  const entries = [0, 1, 2].map(index => holdingEntry(index));
  return {
    entries,
    positionsByEpisode: Object.fromEntries(entries.map(entry => [entry.episodes[0].episode.id, positionSnapshot()])),
    instrumentIds: entries.map(entry => entry.instrument.id),
  };
}

function accountScopeFixture(): Fixture {
  const entries = [holdingEntry(0, "account-1"), holdingEntry(1, "account-2")];
  return {
    entries,
    positionsByEpisode: Object.fromEntries(entries.map(entry => [entry.episodes[0].episode.id, positionSnapshot()])),
    instrumentIds: entries.map(entry => entry.instrument.id),
  };
}

function fxSnapshot(id: string, rate: string, publishedAt: string): RoomFxSnapshot {
  return {
    id,
    baseCurrency: "CNY",
    asOf: publishedAt,
    source: "BOC",
    status: "complete",
    rates: { "USD/CNY": rate },
    publishedAt,
    fetchedAt: `${publishedAt}T23:00:00.000Z`,
  };
}

function candidates(input: Fixture): MarketCandidate[] {
  const dates = expectedTradingDates("US", "2026-10-01", "2026-10-14");
  const makeQuotes = (price: string, fetchedAt: string) => Object.fromEntries(input.instrumentIds.map(id => [id, {
    price,
    currency: "USD",
    quoteDate: "2026-10-14",
    fetchedAt,
    provider: "yahoo",
    freshness: "current" as const,
  }])) as Readonly<Record<string, TradingRoomQuote>>;
  const old = {
    asOf: initialAsOf,
    fx: fxSnapshot("fx-old", initialFxRate, initialFxPublishedAt),
    price: initialPrice,
    quotes: makeQuotes(initialPrice, "2026-10-15T00:00:00.000Z"),
    candles: Object.fromEntries(input.instrumentIds.map(id => [id, dates.map(date => candle(id, date, initialPrice, "2026-10-15T00:00:00.000Z"))])),
  } as MarketCandidate;
  return [
    old,
    {
      asOf: "2026-10-15T12:01:00.000Z",
      fx: fxSnapshot("fx-batch-1", "7.1", "2026-10-15"),
      price: "16",
      quotes: makeQuotes("16", "2026-10-15T00:01:00.000Z"),
      candles: Object.fromEntries(input.instrumentIds.map(id => [id, dates.map(date => candle(id, date, "16", "2026-10-15T00:01:00.000Z"))])),
    },
    {
      asOf: "2026-10-15T12:02:00.000Z",
      fx: fxSnapshot("fx-batch-2", "7.2", "2026-10-15"),
      price: "17",
      quotes: makeQuotes("17", "2026-10-15T00:02:00.000Z"),
      candles: Object.fromEntries(input.instrumentIds.map(id => [id, dates.map(date => candle(id, date, "17", "2026-10-15T00:02:00.000Z"))])),
    },
    {
      asOf: "2026-10-15T12:03:00.000Z",
      fx: fxSnapshot("fx-batch-3", "7.3", "2026-10-15"),
      price: "18",
      quotes: makeQuotes("18", "2026-10-15T00:03:00.000Z"),
      candles: Object.fromEntries(input.instrumentIds.map(id => [id, dates.map(date => candle(id, date, "18", "2026-10-15T00:03:00.000Z"))])),
    },
  ];
}

function jobs(input: Fixture, status: "syncing" | "complete" = "complete") {
  return Object.fromEntries(input.instrumentIds.map(id => [id, {
    status,
    requestedAt: status === "complete" ? receiptAt : "2026-10-15T00:00:00.000Z",
    intervals: [{ interval: "1D", status }],
  }]));
}

function props(
  input: Fixture,
  candidate: MarketCandidate,
  overrides: Partial<Pick<ReviewDashboardProps, "holdingsDataReady" | "sharedScope" | "holdingsPublicationPermit" | "holdingsLedgerPublicationRequired">> = {},
) {
  return {
    entries: input.entries,
    onOpenInReview: vi.fn(),
    referenceCapitalEnabled: false,
    holdingsAsOf: candidate.asOf,
    holdingsDataReady: true,
    holdingsQuotesByInstrument: candidate.quotes,
    holdingsCandlesByInstrument: candidate.candles,
    positionSnapshotsByEpisode: input.positionsByEpisode,
    fxSnapshot: candidate.fx,
    sharedScope: { nature: "live" as const, accountIds: [], simulationRunId: null, reportCurrency: "CNY" as const },
    // A normal workspace mount has no import-owned permit and explicitly
    // leaves the ledger publication fence off. Import consumer tests opt in
    // to the fence when they pass a permit (or set this flag directly for a
    // missing-permit fail-closed case).
    holdingsLedgerPublicationRequired: overrides.holdingsLedgerPublicationRequired
      ?? Boolean(overrides.holdingsPublicationPermit),
    ...overrides,
  };
}

function importPermit(
  input: Fixture,
  generation: number,
  status: HoldingsPublicationPermit["status"],
): HoldingsPublicationPermit {
  return {
    generation,
    revision: `import-${generation}`,
    owner: "import",
    affectedInstrumentIds: input.instrumentIds,
    requiredMarketDataIds: [],
    readbackInstrumentIds: status === "complete" || status === "partial" ? input.instrumentIds : [],
    status,
    receipt: status === "complete" || status === "partial"
      ? { requestedAtByInstrument: {} }
      : undefined,
  };
}

async function settleWorker(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function respondWorker(): void {
  const worker = ControlledWorker.instances.at(-1);
  if (!worker) throw new Error("consumer fixture expected a holdings worker");
  worker.respondNext();
}

function summaryText(): string {
  return within(screen.getByRole("region", { name: "当前持仓概览" })).getByText(/持仓市值|已知市值小计/).closest("div")?.textContent ?? "";
}

function currentHoldingsTable(): HTMLElement {
  return within(screen.getByRole("region", { name: "当前持仓" })).getByRole("table");
}

function headerUpdatedAt(): HTMLElement {
  const time = screen.getByRole("banner", { name: "我的交易室页面头部" }).querySelector("time");
  if (!time) throw new Error("consumer fixture expected a header update time");
  return time;
}

function selectHistoryDate(): HTMLElement {
  const history = screen.getByRole("region", { name: "历史持仓估值" });
  const select = within(history).getByLabelText("历史持仓日期");
  const option = within(select).getByRole("option", { name: /2026-10-15/ });
  fireEvent.change(select, { target: { value: option.getAttribute("value") } });
  return history;
}

describe("PA-I03 ReviewDashboard accepted bundle consumer stability", () => {
  it("keeps the prior financial bundle when a hidden dashboard sees an imported ledger before its owned terminal permit", async () => {
    const input = fixture();
    const [old, importedCandidate] = candidates(input);
    const importedEntries = input.entries.map((entry, index) => index === 0
      ? { ...entry, groupId: `${entry.groupId}:imported-ledger` }
      : entry);
    const refresh = vi.fn(() => false);
    const view = render(
      <ReviewDashboard
        {...props(input, old)}
        visible={false}
        onRefreshHoldingsValuation={refresh}
      />,
    );
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();
    expect(summaryText()).toContain("CNY 630.00");
    expect(currentHoldingsTable()).toHaveTextContent("US$15");

    // The import has changed the ledger and the exact worker candidate, but
    // this is still the previous complete/idle dashboard lifecycle. Without
    // an import-owned terminal/readback permit the old financial bundle must
    // remain visible while the dashboard is hidden.
    const imported = {
      ...importedCandidate,
      fx: old.fx,
    };
    view.rerender(
      <ReviewDashboard
        {...props({ ...input, entries: importedEntries }, imported, {
          holdingsLedgerPublicationRequired: true,
        })}
        visible={false}
        onRefreshHoldingsValuation={refresh}
      />,
    );
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    expect(summaryText()).toContain("CNY 630.00");
    expect(currentHoldingsTable()).toHaveTextContent("US$15");
    expect(currentHoldingsTable()).not.toHaveTextContent("US$16");
    expect(refresh).not.toHaveBeenCalled();
    view.unmount();
  });

  it("fails closed for a cold hidden scope while its owned permit is pending", async () => {
    const input = fixture();
    const [candidate] = candidates(input).slice(1);
    const importedEntries = input.entries.map((entry, index) => index === 0
      ? { ...entry, groupId: `${entry.groupId}:cold-pending` }
      : entry);
    const view = render(<ReviewDashboard
      {...props({ ...input, entries: importedEntries }, candidate, {
        holdingsPublicationPermit: importPermit(input, 21, "pending"),
      })}
      visible={false}
    />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    expect(screen.getByTestId("holdings-publication-placeholder")).toHaveTextContent("等待发布");
    expect(screen.getByTestId("holdings-history-publication-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("holdings-allocation-publication-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("holdings-table-publication-placeholder")).toBeInTheDocument();
    expect(screen.queryByText("CNY 681.60")).not.toBeInTheDocument();
    expect(screen.queryByText("US$16")).not.toBeInTheDocument();
    expect(screen.queryByText("持仓标的数")).not.toBeInTheDocument();
    view.unmount();
  });

  it("shows the current owned import progress instead of the durable global summary", async () => {
    const input = fixture();
    const [candidate] = candidates(input).slice(1);
    const permit = {
      ...importPermit(input, 41, "pending"),
      requiredMarketDataIds: input.instrumentIds,
    };
    const view = render(
      <ReviewDashboard
        {...props(input, candidate, { holdingsPublicationPermit: permit })}
        visible={false}
        holdingsOwnedProgress={{
          generation: 41,
          runId: 4101,
          runIds: [4101],
          requiredIds: input.instrumentIds,
          settledIds: [input.instrumentIds[0]],
          terminalById: { [input.instrumentIds[0]]: "complete" },
          cacheOnlyIds: [],
          phase: "downloading",
        }}
      />,
    );

    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    const status = screen.getByRole("region", { name: "持仓照看" }).querySelector<HTMLElement>("[data-refresh-phase]");
    expect(status?.textContent).toContain("1/3 个标的已处理");
    view.unmount();
  });

  it("fails closed for a cold hidden scope when its owned publication permit is missing", async () => {
    const input = fixture();
    const [candidate] = candidates(input).slice(1);
    const importedEntries = input.entries.map((entry, index) => index === 0
      ? { ...entry, groupId: `${entry.groupId}:cold-without-permit` }
      : entry);
    const view = render(<ReviewDashboard
      {...props({ ...input, entries: importedEntries }, candidate, {
        holdingsPublicationPermit: null,
        holdingsLedgerPublicationRequired: true,
      })}
      visible={false}
    />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    expect(screen.getByTestId("holdings-publication-placeholder")).toHaveTextContent("等待发布");
    expect(screen.queryByText("CNY 681.60")).not.toBeInTheDocument();
    expect(screen.queryByText("US$16")).not.toBeInTheDocument();
    expect(screen.queryByText("持仓标的数")).not.toBeInTheDocument();
    view.unmount();
  });

  it("does not expose the old scope bundle while a new scope is cold and fenced", async () => {
    const input = accountScopeFixture();
    const [old, candidate] = candidates(input);
    const view = render(<ReviewDashboard {...props(input, old)} visible={false} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();
    expect(summaryText()).toContain("CNY 420.00");
    expect(currentHoldingsTable()).toHaveTextContent("US$15");

    view.rerender(<ReviewDashboard
      {...props(input, candidate, {
        sharedScope: {
          nature: "live",
          accountIds: ["account-2"],
          simulationRunId: null,
          reportCurrency: "CNY",
        },
        holdingsPublicationPermit: importPermit(input, 31, "pending"),
      })}
      visible={false}
    />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    expect(screen.getByTestId("holdings-publication-placeholder")).toBeInTheDocument();
    expect(screen.queryByText("CNY 420.00")).not.toBeInTheDocument();
    expect(screen.queryByText("US$15")).not.toBeInTheDocument();
    expect(screen.queryByTestId("holdings-table-publication-placeholder")).toBeInTheDocument();
    view.unmount();
  });

  it("does not let a consumed import generation block a later FX-only publication", async () => {
    const input = fixture();
    const [old, importedCandidate, fxCandidate] = candidates(input);
    const importedEntries = input.entries.map((entry, index) => index === 0
      ? { ...entry, groupId: `${entry.groupId}:imported-ledger` }
      : entry);
    const view = render(<ReviewDashboard {...props(input, old)} visible={false} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    // The saved ledger is visible while its producer permit is pending.
    view.rerender(<ReviewDashboard
      {...props({ ...input, entries: importedEntries }, { ...importedCandidate, fx: old.fx }, {
        holdingsPublicationPermit: importPermit(input, 1, "pending"),
      })}
      visible={false}
    />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();
    expect(summaryText()).toContain("CNY 630.00");

    // The terminal/readback permit releases this ledger generation once.
    view.rerender(<ReviewDashboard
      {...props({ ...input, entries: importedEntries }, { ...importedCandidate, fx: old.fx }, {
        holdingsPublicationPermit: importPermit(input, 1, "complete"),
      })}
      visible={false}
    />);
    await act(async () => { await Promise.resolve(); });
    await settleWorker();
    expect(summaryText()).toContain("CNY 672.00");
    expect(document.querySelector("[data-refresh-phase]"))
      .toHaveAttribute("data-refresh-phase", "complete");
    expect(within(screen.getByRole("region", { name: "持仓照看" })).getByRole("status"))
      .toHaveTextContent("估值更新完成");

    // Keep the consumed permit attached but change only the FX publication.
    // The new FX worker result is an independent source boundary and must be
    // accepted instead of being swallowed by generation 1's one-shot guard.
    view.rerender(<ReviewDashboard
      {...props({ ...input, entries: importedEntries }, {
        ...fxCandidate,
        fx: fxSnapshot("fx-after-import", "7.2", "2026-10-15"),
      }, {
        holdingsPublicationPermit: importPermit(input, 1, "complete"),
      })}
      visible={false}
    />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();
    expect(summaryText()).toContain("CNY 734.40");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("汇率：2026-10-15（中行）");
    view.unmount();
  });

  it("does not reopen an accepted ledger when the library only recomputes derived metrics", async () => {
    const input = fixture();
    const [old, importedCandidate] = candidates(input);
    const importedEntries = input.entries.map((entry, index) => index === 0
      ? { ...entry, groupId: `${entry.groupId}:derived-metrics` }
      : entry);
    const permit = importPermit(input, 41, "complete");
    const view = render(<ReviewDashboard {...props(input, old)} visible={false} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    view.rerender(<ReviewDashboard
      {...props({ ...input, entries: importedEntries }, { ...importedCandidate, fx: old.fx }, {
        holdingsPublicationPermit: { ...permit, status: "pending", readbackInstrumentIds: [] },
      })}
      visible={false}
    />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    view.rerender(<ReviewDashboard
      {...props({ ...input, entries: importedEntries }, { ...importedCandidate, fx: old.fx }, {
        holdingsPublicationPermit: permit,
      })}
      visible={false}
    />);
    await settleWorker();
    expect(document.querySelector("[data-refresh-phase]"))
      .toHaveAttribute("data-refresh-phase", "complete");

    // The library producer may fill these values after a candle/mark arrives.
    // That recomputation must not create a new financial-ledger revision.
    const derivedOnlyEntries = importedEntries.map((entry, index) => index === 0
      ? {
        ...entry,
        netPnl: "999",
        returnPercent: "999",
        cumulativeR: "17",
        episodes: entry.episodes.map(item => ({
          ...item,
          metrics: {
            ...item.metrics,
            unrealizedPnl: "999",
            netPnl: "999",
            returnPercent: "999",
          },
          rMultiple: "4.5",
        })),
      }
      : entry);
    view.rerender(<ReviewDashboard
      {...props({ ...input, entries: derivedOnlyEntries }, { ...importedCandidate, fx: old.fx }, {
        holdingsPublicationPermit: permit,
      })}
      visible={false}
    />);
    await settleWorker();

    expect(document.querySelector("[data-refresh-phase]"))
      .toHaveAttribute("data-refresh-phase", "complete");
    view.unmount();
  });

  it.each(["failed", "cancelled"] as const)(
    "keeps the accepted bundle and exposes the producer %s terminal state",
    async status => {
      const input = fixture();
      const [old, importedCandidate] = candidates(input);
      const importedEntries = input.entries.map((entry, index) => index === 0
        ? { ...entry, groupId: `${entry.groupId}:terminal-${status}` }
        : entry);
      const view = render(<ReviewDashboard {...props(input, old)} visible={false} />);
      await act(async () => { await Promise.resolve(); });
      respondWorker();
      await settleWorker();

      view.rerender(<ReviewDashboard
        {...props({ ...input, entries: importedEntries }, { ...importedCandidate, fx: old.fx }, {
          holdingsPublicationPermit: importPermit(input, status === "failed" ? 11 : 12, status),
        })}
        visible={false}
      />);
      await act(async () => { await Promise.resolve(); });
      respondWorker();
      await settleWorker();

      expect(document.querySelector("[data-refresh-phase]"))
        .toHaveAttribute("data-refresh-phase", status);
      expect(summaryText()).toContain("CNY 630.00");
      expect(currentHoldingsTable()).toHaveTextContent("US$15");
      expect(currentHoldingsTable()).not.toHaveTextContent("US$16");
      view.unmount();
    },
  );

  it("keeps an import partial terminal state visible after the ledger is accepted", async () => {
    const input = fixture();
    const [old, importedCandidate] = candidates(input);
    const importedEntries = input.entries.map((entry, index) => index === 0
      ? { ...entry, groupId: `${entry.groupId}:terminal-partial` }
      : entry);
    const view = render(<ReviewDashboard {...props(input, old)} visible={false} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    view.rerender(<ReviewDashboard
      {...props({ ...input, entries: importedEntries }, { ...importedCandidate, fx: old.fx }, {
        holdingsPublicationPermit: importPermit(input, 13, "pending"),
      })}
      visible={false}
    />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    // A producer partial receipt still publishes its coherent financial
    // bundle; the terminal copy must describe the market-data boundary.
    view.rerender(<ReviewDashboard
      {...props({ ...input, entries: importedEntries }, { ...importedCandidate, fx: old.fx }, {
        holdingsPublicationPermit: importPermit(input, 13, "partial"),
      })}
      visible={false}
    />);
    await settleWorker();

    const status = within(screen.getByRole("region", { name: "持仓照看" })).getByRole("status");
    expect(status).toHaveAttribute("data-refresh-phase", "partial");
    expect(status).toHaveTextContent("部分行情未更新");
    expect(status).toHaveTextContent("估值基于可用行情");
    expect(status).not.toHaveTextContent("估值部分完成");
    expect(summaryText()).toContain("CNY 672.00");
    expect(currentHoldingsTable()).toHaveTextContent("US$16");
    view.unmount();
  });

  it("holds one accepted financial bundle through three candidate batches, FX/as-of ticks, and exact terminal worker readiness", async () => {
    const input = fixture();
    const [old, batch1, batch2, batch3] = candidates(input);
    type CompleteReceipt = Extract<HoldingsRefreshReceipt, { ok: true }>;
    let resolveRefresh!: (value: CompleteReceipt) => void;
    const refresh = vi.fn(() => new Promise<CompleteReceipt>(resolve => { resolveRefresh = resolve; }));
    const view = render(<ReviewDashboard {...props(input, old)} onRefreshHoldingsValuation={refresh} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    const overview = screen.getByRole("region", { name: "当前持仓概览" });
    expect(overview).toHaveTextContent("持仓市值CNY 630.00");
    expect(overview).toHaveTextContent("未实现盈亏CNY +210.00");
    expect(overview).toHaveTextContent("估值截点：2026-10-15");
    expect(screen.getByRole("region", { name: "当前持仓资产分布" })).toHaveTextContent("CNY 630.00");
    const initialHistory = selectHistoryDate();
    expect(within(initialHistory).getByRole("tooltip")).toHaveTextContent("CNY 630.00");
    expect(within(initialHistory).getByRole("tooltip")).toHaveTextContent("2026-10-15");
    fireEvent.click(within(initialHistory).getByText("2026-10-15 持仓明细"));
    expect(initialHistory).toHaveTextContent("ALPHA持仓 / account-1");
    expect(initialHistory).toHaveTextContent("USD 30.00");
    expect(initialHistory).toHaveTextContent("2026-10-14");
    expect(currentHoldingsTable()).toHaveTextContent("US$15");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("1 USD = 7 CNY");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:00");

    const staleQuotes = Object.fromEntries(input.instrumentIds.map(id => [id, { ...old.quotes[id], freshness: "stale" as const }]));
    view.rerender(<ReviewDashboard {...props(input, { ...old, quotes: staleQuotes })} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 3, completed: 0, processed: 0, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await settleWorker();
    expect(refresh).toHaveBeenCalledWith(input.instrumentIds, "automatic");

    view.rerender(<ReviewDashboard {...props(input, batch1)} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 3, completed: 1, processed: 1, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();
    expect(document.querySelector("[data-refresh-phase]")).toHaveAttribute("data-refresh-phase", "downloading");
    expect(summaryText()).toContain("CNY 630.00");
    expect(within(screen.getByRole("region", { name: "历史持仓估值" })).getByRole("tooltip")).toHaveTextContent("CNY 630.00");
    expect(currentHoldingsTable()).toHaveTextContent("US$15");
    expect(currentHoldingsTable()).not.toHaveTextContent("US$16");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("1 USD = 7 CNY");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:00");

    view.rerender(<ReviewDashboard {...props(input, batch2)} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 3, completed: 2, processed: 2, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();
    expect(summaryText()).toContain("CNY 630.00");
    expect(screen.getByRole("region", { name: "当前持仓资产分布" })).toHaveTextContent("CNY 630.00");
    expect(screen.getByRole("region", { name: "当前持仓" })).toHaveAttribute("data-current-date", "2026-10-15");
    expect(within(screen.getByRole("region", { name: "历史持仓估值" })).getByRole("tooltip")).toHaveTextContent("CNY 630.00");
    expect(currentHoldingsTable()).toHaveTextContent("US$15");
    expect(currentHoldingsTable()).not.toHaveTextContent("US$17");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:00");

    view.rerender(<ReviewDashboard {...props(input, batch3)} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 3, completed: 3, processed: 3, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();
    // The exact worker result alone is not a publish boundary while the last
    // market-data batch remains non-terminal.
    expect(summaryText()).toContain("CNY 630.00");
    expect(within(screen.getByRole("region", { name: "历史持仓估值" })).getByRole("tooltip")).toHaveTextContent("CNY 630.00");
    expect(currentHoldingsTable()).toHaveTextContent("US$15");
    expect(currentHoldingsTable()).not.toHaveTextContent("US$18");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("1 USD = 7 CNY");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:00");

    resolveRefresh({
      ok: true,
      requestedAtByInstrument: Object.fromEntries(input.instrumentIds.map(id => [id, receiptAt])),
      dailyStatusByInstrument: Object.fromEntries(input.instrumentIds.map(id => [id, "complete" as const])),
    });
    view.rerender(<ReviewDashboard {...props(input, batch3)} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: false, total: 3, completed: 3, processed: 3, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "complete"]))} marketDataJobs={jobs(input, "complete")} />);
    await settleWorker();

    expect(document.querySelector("[data-refresh-phase]")).toHaveAttribute("data-refresh-phase", "complete");
    expect(screen.getByRole("region", { name: "当前持仓概览" })).toHaveTextContent("持仓市值CNY 788.40");
    expect(screen.getByRole("region", { name: "当前持仓概览" })).toHaveTextContent("未实现盈亏CNY +350.40");
    expect(screen.getByRole("region", { name: "当前持仓资产分布" })).toHaveTextContent("CNY 788.40");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("1 USD = 7.3 CNY");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("汇率：2026-10-15（中行）");
    expect(currentHoldingsTable()).toHaveTextContent("US$18");
    expect(currentHoldingsTable()).not.toHaveTextContent("US$15");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:03");
    expect(screen.getByRole("region", { name: "当前持仓" })).toHaveAttribute("data-current-date", "2026-10-15");
    const finalHistory = selectHistoryDate();
    expect(within(finalHistory).getByRole("tooltip")).toHaveTextContent("CNY 788.40");
    expect(within(finalHistory).getByRole("tooltip")).toHaveTextContent("2026-10-15");
    fireEvent.click(within(finalHistory).getByText("2026-10-15 持仓明细"));
    expect(finalHistory).toHaveTextContent("USD 36.00");
    expect(finalHistory).toHaveTextContent("2026-10-14");
  });

  it("accepts a per-currency FX publication correction only with the matching money bundle", async () => {
    const input = fixture();
    const [baseCandidate] = candidates(input);
    const oldPublicationCandidate: MarketCandidate = {
      ...baseCandidate,
      fx: {
        ...baseCandidate.fx,
        publishedAtByCurrency: { USD: "2026-10-14" },
      },
    };
    const staleQuotes = Object.fromEntries(input.instrumentIds.map(id => [id, { ...oldPublicationCandidate.quotes[id], freshness: "stale" as const }]));
    const correctedPublicationCandidate: MarketCandidate = {
      ...oldPublicationCandidate,
      // Stale quotes trigger the refresh; the corrected candidate restores the
      // base candidate's fresh, unchanged prices so money remains comparable.
      quotes: baseCandidate.quotes,
      fx: {
        ...oldPublicationCandidate.fx,
        publishedAtByCurrency: { USD: "2026-10-15" },
      },
    };
    type CompleteReceipt = Extract<HoldingsRefreshReceipt, { ok: true }>;
    let resolveRefresh!: (value: CompleteReceipt) => void;
    const refresh = vi.fn(() => new Promise<CompleteReceipt>(resolve => { resolveRefresh = resolve; }));
    const view = render(<ReviewDashboard {...props(input, oldPublicationCandidate)} onRefreshHoldingsValuation={refresh} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    expect(summaryText()).toContain("CNY 630.00");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("汇率：2026-10-14（中行）");

    view.rerender(<ReviewDashboard {...props(input, { ...oldPublicationCandidate, quotes: staleQuotes })} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 1, completed: 0, processed: 0, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await settleWorker();
    expect(refresh).toHaveBeenCalledWith(input.instrumentIds, "automatic");

    view.rerender(<ReviewDashboard {...props(input, correctedPublicationCandidate)} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 1, completed: 0, processed: 0, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    // The corrected candidate is exact in the worker but cannot publish while
    // its durable market-data batch is still pending.
    expect(summaryText()).toContain("CNY 630.00");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("汇率：2026-10-14（中行）");
    expect(screen.getByTestId("room-holdings-fx-provenance")).not.toHaveTextContent("汇率：2026-10-15（中行）");

    resolveRefresh({
      ok: true,
      requestedAtByInstrument: Object.fromEntries(input.instrumentIds.map(id => [id, receiptAt])),
      dailyStatusByInstrument: Object.fromEntries(input.instrumentIds.map(id => [id, "complete" as const])),
    });
    view.rerender(<ReviewDashboard {...props(input, correctedPublicationCandidate)} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: false, total: 1, completed: 1, processed: 1, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "complete"]))} marketDataJobs={jobs(input, "complete")} />);
    await settleWorker();

    expect(summaryText()).toContain("CNY 630.00");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("汇率：2026-10-15（中行）");
    expect(screen.getByTestId("room-holdings-fx-provenance")).not.toHaveTextContent("汇率：2026-10-14（中行）");
    expect(document.querySelector("[data-refresh-phase]")).toHaveAttribute("data-refresh-phase", "complete");
  });

  it("keeps the accepted bundle when a new FX candidate is cancelled before its worker ack", async () => {
    const input = fixture();
    const [old, batch1] = candidates(input);
    type CompleteReceipt = Extract<HoldingsRefreshReceipt, { ok: true }>;
    let resolveRefresh!: (value: CompleteReceipt) => void;
    const refresh = vi.fn(() => new Promise<CompleteReceipt>(resolve => { resolveRefresh = resolve; }));
    const view = render(<ReviewDashboard {...props(input, old)} onRefreshHoldingsValuation={refresh} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();
    const history = selectHistoryDate();
    expect(within(history).getByRole("tooltip")).toHaveTextContent("CNY 630.00");
    fireEvent.click(within(history).getByText("2026-10-15 持仓明细"));
    expect(history).toHaveTextContent("USD 30.00");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:00");

    const staleQuotes = Object.fromEntries(input.instrumentIds.map(id => [id, { ...old.quotes[id], freshness: "stale" as const }]));
    view.rerender(<ReviewDashboard {...props(input, { ...old, quotes: staleQuotes })} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 3, completed: 0, processed: 0, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await settleWorker();
    expect(refresh).toHaveBeenCalledWith(input.instrumentIds, "automatic");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:00");

    // A fresh FX/candle candidate starts a new history request, but it has no
    // right to replace the accepted snapshot while the market batch is open.
    view.rerender(<ReviewDashboard {...props(input, batch1)} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 3, completed: 1, processed: 1, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(summaryText()).toContain("CNY 630.00");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("1 USD = 7 CNY");

    fireEvent.click(within(screen.getByRole("region", { name: "持仓照看" })).getByRole("button", { name: "取消" }));
    await settleWorker();
    expect(document.querySelector("[data-refresh-phase]")).toHaveAttribute("data-refresh-phase", "cancelled");
    expect(summaryText()).toContain("CNY 630.00");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("1 USD = 7 CNY");
    expect(within(history).getByRole("tooltip")).toHaveTextContent("CNY 630.00");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:00");

    // Both the worker result and the producer receipt are late acknowledgements
    // from the cancelled generation. They must not publish batch 1.
    respondWorker();
    resolveRefresh({
      ok: true,
      requestedAtByInstrument: Object.fromEntries(input.instrumentIds.map(id => [id, receiptAt])),
      dailyStatusByInstrument: Object.fromEntries(input.instrumentIds.map(id => [id, "complete" as const])),
    });
    view.rerender(<ReviewDashboard {...props(input, batch1)} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: false, total: 3, completed: 3, processed: 3, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "complete"]))} marketDataJobs={jobs(input, "complete")} />);
    await settleWorker();
    expect(document.querySelector("[data-refresh-phase]")).toHaveAttribute("data-refresh-phase", "cancelled");
    expect(summaryText()).toContain("CNY 630.00");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("1 USD = 7 CNY");
    expect(within(history).getByRole("tooltip")).toHaveTextContent("CNY 630.00");
    expect(history).toHaveTextContent("USD 30.00");
    expect(currentHoldingsTable()).not.toHaveTextContent("US$16");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:00");
  });

  it("keeps the prior bundle and exposes a failed state when the refresh runner rejects", async () => {
    const input = fixture();
    const [old, batch1] = candidates(input);
    const failedReceipt: Extract<HoldingsRefreshReceipt, { ok: false }> = { ok: false, reason: "failed" };
    const refresh = vi.fn((): Promise<HoldingsRefreshReceipt> => Promise.resolve(failedReceipt));
    const view = render(<ReviewDashboard {...props(input, old)} onRefreshHoldingsValuation={refresh} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();
    const history = selectHistoryDate();
    expect(within(history).getByRole("tooltip")).toHaveTextContent("CNY 630.00");
    fireEvent.click(within(history).getByText("2026-10-15 持仓明细"));
    expect(history).toHaveTextContent("USD 30.00");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:00");

    const staleQuotes = Object.fromEntries(input.instrumentIds.map(id => [id, { ...old.quotes[id], freshness: "stale" as const }]));
    view.rerender(<ReviewDashboard {...props(input, { ...old, quotes: staleQuotes })} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 3, completed: 0, processed: 0, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await settleWorker();
    expect(document.querySelector("[data-refresh-phase]")).toHaveAttribute("data-refresh-phase", "failed");
    expect(summaryText()).toContain("CNY 630.00");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("1 USD = 7 CNY");
    expect(within(history).getByRole("tooltip")).toHaveTextContent("CNY 630.00");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:00");

    // A late candidate worker result after the failure still belongs to the
    // rejected generation and cannot expose its FX or quote values.
    view.rerender(<ReviewDashboard {...props(input, batch1)} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: false, total: 3, completed: 3, processed: 3, partial: 0, failed: 3 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "error"]))} marketDataJobs={Object.fromEntries(input.instrumentIds.map(id => [id, { status: "error", requestedAt: receiptAt, intervals: [{ interval: "1D", status: "error" }] }]))} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    respondWorker();
    await settleWorker();
    expect(document.querySelector("[data-refresh-phase]")).toHaveAttribute("data-refresh-phase", "failed");
    expect(summaryText()).toContain("CNY 630.00");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("1 USD = 7 CNY");
    expect(within(history).getByRole("tooltip")).toHaveTextContent("CNY 630.00");
    expect(history).toHaveTextContent("USD 30.00");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:00");
  });

  it("does not let late A-scope worker or receipt data overwrite a switched B account scope", async () => {
    const input = accountScopeFixture();
    const [old, batch1] = candidates(input);
    const bCandidate = { ...batch1, fx: fxSnapshot("fx-account-b", "8", "2026-10-15") };
    const scopeA = { nature: "live" as const, accountIds: ["account-1"], simulationRunId: null, reportCurrency: "CNY" as const };
    const scopeB = { nature: "live" as const, accountIds: ["account-2"], simulationRunId: null, reportCurrency: "CNY" as const };
    type CompleteReceipt = Extract<HoldingsRefreshReceipt, { ok: true }>;
    const pendingReceipts: Array<{ ids: readonly string[]; resolve: (value: CompleteReceipt) => void }> = [];
    const refresh = vi.fn((ids: readonly string[]) => new Promise<CompleteReceipt>(resolve => {
      pendingReceipts.push({ ids, resolve });
    }));
    const view = render(<ReviewDashboard {...props(input, old, { sharedScope: scopeA })} onRefreshHoldingsValuation={refresh} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    const aHistory = selectHistoryDate();
    expect(within(aHistory).getByRole("tooltip")).toHaveTextContent("CNY 210.00");
    fireEvent.click(within(aHistory).getByText("2026-10-15 持仓明细"));
    expect(aHistory).toHaveTextContent("ALPHA持仓 / account-1");
    expect(currentHoldingsTable()).toHaveTextContent("ALPHA持仓");
    expect(currentHoldingsTable()).not.toHaveTextContent("BRAVO持仓");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("1 USD = 7 CNY");

    const staleOldQuotes = Object.fromEntries(input.instrumentIds.map(id => [id, { ...old.quotes[id], freshness: "stale" as const }]));
    view.rerender(<ReviewDashboard {...props(input, { ...old, quotes: staleOldQuotes }, { sharedScope: scopeA })} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 1, completed: 0, processed: 0, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await settleWorker();
    expect(refresh).toHaveBeenCalledWith(["US:ALPHA"], "automatic");

    const staleQuotes = Object.fromEntries(input.instrumentIds.map(id => [id, { ...batch1.quotes[id], freshness: "stale" as const }]));
    const aCandidate = { ...batch1, quotes: staleQuotes };
    view.rerender(<ReviewDashboard {...props(input, aCandidate, { sharedScope: scopeA })} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 2, completed: 1, processed: 1, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const aWorker = ControlledWorker.instances.at(-1);
    if (!aWorker) throw new Error("consumer fixture expected the A-scope worker");

    view.rerender(<ReviewDashboard {...props(input, bCandidate, { sharedScope: scopeB })} onRefreshHoldingsValuation={refresh} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const bWorker = ControlledWorker.instances.at(-1);
    if (!bWorker) throw new Error("consumer fixture expected the shared holdings worker");

    // Both acknowledgements belong to the old A request. They arrive after the
    // scope switch and must not repaint B, even though its worker is pending.
    aWorker.respondNext();
    const aReceipt = pendingReceipts[0];
    if (!aReceipt) throw new Error("consumer fixture expected the A-scope receipt");
    aReceipt.resolve({
      ok: true,
      requestedAtByInstrument: Object.fromEntries(aReceipt.ids.map(id => [id, receiptAt])),
      dailyStatusByInstrument: Object.fromEntries(aReceipt.ids.map(id => [id, "complete" as const])),
    });
    await settleWorker();

    expect(summaryText()).toContain("CNY 256.00");
    expect(currentHoldingsTable()).toHaveTextContent("BRAVO持仓");
    expect(currentHoldingsTable()).not.toHaveTextContent("ALPHA持仓");
    expect(screen.getByTestId("room-holdings-fx-provenance")).toHaveTextContent("1 USD = 8 CNY");

    // The queued response now belongs to B and establishes B's own history
    // boundary after the late A result/receipt above.
    bWorker.respondNext();
    await settleWorker();
    // The durable A job is terminal by this point. Surface that exact
    // boundary while the B worker result is current; this is the cross-scope
    // handoff that lets the real consumer capture B's first stable history
    // bundle without replaying A's receipt.
    view.rerender(<ReviewDashboard {...props(input, bCandidate, { sharedScope: scopeB })} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: false, total: 2, completed: 2, processed: 2, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "complete"]))} marketDataJobs={jobs(input, "complete")} />);
    await settleWorker();
    const bHistory = selectHistoryDate();
    expect(within(bHistory).getByRole("tooltip")).toHaveTextContent("CNY 256.00");
    fireEvent.click(within(bHistory).getByText("2026-10-15 持仓明细"));
    expect(bHistory).toHaveTextContent("BRAVO持仓 / account-2");
    expect(bHistory).toHaveTextContent("USD 32.00");
    expect(bHistory).not.toHaveTextContent("ALPHA持仓 / account-1");
  });

  it("keeps an A-scope automatic attempt stable when an out-of-scope B member changes", async () => {
    const input = accountScopeFixture();
    const inputWithChangedBMember: Fixture = {
      entries: [input.entries[0], holdingEntry(2, "account-2")],
      positionsByEpisode: {
        [input.entries[0].episodes[0].episode.id]: positionSnapshot(),
        [holdingEntry(2, "account-2").episodes[0].episode.id]: positionSnapshot(),
      },
      instrumentIds: [input.entries[0].instrument.id, "US:CHARLIE"],
    };
    const [old] = candidates(input);
    const [oldWithChangedBMember] = candidates(inputWithChangedBMember);
    const scopeA = { nature: "live" as const, accountIds: ["account-1"], simulationRunId: null, reportCurrency: "CNY" as const };
    const scopeB = { nature: "live" as const, accountIds: ["account-2"], simulationRunId: null, reportCurrency: "CNY" as const };
    const staleQuotes = Object.fromEntries(input.instrumentIds.map(id => [id, { ...old.quotes[id], freshness: "stale" as const }]));
    const staleQuotesWithChangedBMember = Object.fromEntries(inputWithChangedBMember.instrumentIds.map(id => [id, { ...oldWithChangedBMember.quotes[id], freshness: "stale" as const }]));
    const refresh = vi.fn(() => false);
    const view = render(<ReviewDashboard {...props(input, old, { sharedScope: scopeA })} onRefreshHoldingsValuation={refresh} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    view.rerender(<ReviewDashboard {...props(input, { ...old, quotes: staleQuotes }, { sharedScope: scopeA })} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 1, completed: 0, processed: 0, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await act(async () => { await Promise.resolve(); });
    await settleWorker();
    expect(refresh).toHaveBeenNthCalledWith(1, ["US:ALPHA"], "automatic");

    view.rerender(<ReviewDashboard {...props(inputWithChangedBMember, { ...oldWithChangedBMember, quotes: staleQuotesWithChangedBMember }, { sharedScope: scopeA })} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 1, completed: 0, processed: 0, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(inputWithChangedBMember.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(inputWithChangedBMember, "syncing")} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();
    expect(refresh).toHaveBeenCalledTimes(1);

    view.rerender(<ReviewDashboard {...props(inputWithChangedBMember, { ...oldWithChangedBMember, quotes: staleQuotesWithChangedBMember }, { sharedScope: scopeB })} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 1, completed: 0, processed: 0, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(inputWithChangedBMember.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(inputWithChangedBMember, "syncing")} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();
    expect(refresh).toHaveBeenNthCalledWith(2, ["US:CHARLIE"], "automatic");
  });

  it("waits for the cached exact history boundary before automatic refresh and preserves its history curve", async () => {
    const input = fixture();
    const [old] = candidates(input);
    type CompleteReceipt = Extract<HoldingsRefreshReceipt, { ok: true }>;
    const staleQuotes = Object.fromEntries(input.instrumentIds.map(id => [id, { ...old.quotes[id], freshness: "stale" as const }]));
    const cachedCandidate = { ...old, quotes: staleQuotes };
    const refresh = vi.fn(() => new Promise<CompleteReceipt>(() => {}));
    const view = render(<ReviewDashboard {...props(input, cachedCandidate, { holdingsDataReady: false })} onRefreshHoldingsValuation={refresh} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    // The worker has acknowledged the exact cached history input, but the
    // persisted current-day cache boundary has not arrived yet.
    expect(refresh).not.toHaveBeenCalled();

    view.rerender(<ReviewDashboard {...props(input, cachedCandidate, { holdingsDataReady: true })} onRefreshHoldingsValuation={refresh} />);
    await settleWorker();
    expect(refresh).toHaveBeenCalledWith(input.instrumentIds, "automatic");

    const history = selectHistoryDate();
    expect(within(history).getByRole("tooltip")).toHaveTextContent("CNY 630.00");
    expect(within(history).getByRole("tooltip")).toHaveTextContent("2026-10-15");
    expect(history.querySelector("[data-history-series='CNY']")).toBeInTheDocument();
    fireEvent.click(within(history).getByText("2026-10-15 持仓明细"));
    expect(history).toHaveTextContent("USD 30.00");
    expect(history).toHaveTextContent("2026-10-14");

    // The automatic request is still unresolved; its candidate must not clear
    // the hydrated history curve or details.
    view.rerender(<ReviewDashboard {...props(input, cachedCandidate, { holdingsDataReady: true })} onRefreshHoldingsValuation={refresh} marketDataRefresh={{ running: true, total: 3, completed: 1, processed: 1, partial: 0, failed: 0 }} marketDataDailyStatuses={Object.fromEntries(input.instrumentIds.map(id => [id, "syncing"]))} marketDataJobs={jobs(input, "syncing")} />);
    await settleWorker();
    expect(within(screen.getByRole("region", { name: "历史持仓估值" })).getByRole("tooltip")).toHaveTextContent("CNY 630.00");
    expect(screen.getByRole("region", { name: "历史持仓估值" })).toHaveTextContent("USD 30.00");
    expect(currentHoldingsTable()).toHaveTextContent("US$15");
  });

  it("gives truthful feedback when a manual refresh has no candidates and clears it on a new market scope", async () => {
    const input = fixture();
    const [old] = candidates(input);
    const refresh = vi.fn(() => false);
    const view = render(<ReviewDashboard {...props(input, old)} onRefreshHoldingsValuation={refresh} />);
    await act(async () => { await Promise.resolve(); });
    respondWorker();
    await settleWorker();

    const workspace = screen.getByRole("region", { name: "持仓照看" });
    expect(refresh).not.toHaveBeenCalled();
    expect(workspace.querySelector("[data-refresh-announcement='empty']")).toBeInTheDocument();
    expect(document.querySelector("[data-refresh-phase]")).toHaveAttribute("data-refresh-phase", "idle");

    fireEvent.click(within(workspace).getByRole("button", { name: "更新估值" }));
    await act(async () => { await Promise.resolve(); });

    expect(refresh).not.toHaveBeenCalled();
    expect(within(workspace).getByRole("status")).toHaveTextContent("当前无需补齐行情");
    expect(within(workspace).getByText("当前范围暂无需要补齐的行情。")).toBeInTheDocument();
    expect(document.querySelector("[data-refresh-phase]")).toHaveAttribute("data-refresh-phase", "idle");
    expect(headerUpdatedAt()).toHaveTextContent("2026-10-15 08:00");

    fireEvent.click(within(workspace).getByRole("tab", { name: "持仓美股市场" }));
    await act(async () => { await Promise.resolve(); });
    expect(workspace.querySelector("[data-refresh-announcement='empty']")).toBeInTheDocument();
    expect(workspace).not.toHaveTextContent("当前范围暂无需要补齐的行情。");
    view.unmount();
  });
});
