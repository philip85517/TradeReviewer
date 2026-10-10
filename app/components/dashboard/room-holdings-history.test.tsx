import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DailyCandleRecord } from "../../lib/market/contracts";
import { buildHoldingsHistory, type HoldingsHistoryModel } from "../../lib/reviews/trading-room-history";
import { buildRoomMoneyView, createDefaultRoomScope } from "../../lib/reviews/trading-room-scope";
import { buildRoomMoneySubtotal } from "../../lib/reviews/holdings-money-subtotal";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import type { Instrument, TradeEpisode, TradeExecution } from "../../lib/trades/types";
import { RoomHoldingsHistory } from "./room-holdings-history";

afterEach(cleanup);
function model(values: Array<string | null> = ["100", "120", "80"]): HoldingsHistoryModel {
  const scope = createDefaultRoomScope("2026-09-21");
  scope.period = { preset: "custom", startDate: "2026-09-17", endDate: "2026-09-21" };
  const result = buildHoldingsHistory([], { scope, asOf: "2026-09-21" });
  result.points = result.points.slice(0, values.length).map((point, index) => ({ ...point,
    holdings: [{
      key: "fixture-usd", instrumentId: "US:FIXTURE", instrumentName: "测试持仓", accountId: "a", currency: "USD",
      quantity: values[index] === null ? null : "1", marketValue: values[index], cost: values[index] === null ? null : "100",
      unrealizedPnl: values[index] === null ? null : String(Number(values[index]) - 100),
      unrealizedReturnPercent: values[index] === null ? null : String(Number(values[index]) - 100), quoteDate: point.date,
      quotePrice: values[index] === null ? null : "100", quantityAvailable: values[index] !== null,
      marketValueAvailable: values[index] !== null, costAvailable: values[index] !== null, reasons: values[index] === null ? ["缺少数量"] : [],
    }],
    marketValue: buildRoomMoneyView([{ currency: "USD", amount: values[index] }]),
    unrealizedPnl: buildRoomMoneyView([{ currency: "USD", amount: values[index] === null ? null : String(Number(values[index]) - 100) }]),
    cost: buildRoomMoneyView([{ currency: "USD", amount: "100" }]),
    dailyPnl: buildRoomMoneyView([{ currency: "USD", amount: "3" }]), dailyPnlAvailable: true, dailyPnlReasons: [],
    unrealizedReturnPercent: values[index] === null ? null : String(Number(values[index]) - 100),
    marketValueAvailable: values[index] !== null, unrealizedPnlAvailable: values[index] !== null, available: values[index] !== null,
  }));
  return result;
}
function chart() { return screen.getByRole("img", { name: /持仓.*曲线/ }); }
function hover(x: number) {
  vi.spyOn(chart(), "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 720, height: 270, top: 0, left: 0, right: 720, bottom: 270, toJSON: () => ({}) });
  fireEvent.mouseMove(chart(), { clientX: x, clientY: 100 });
}

function producerInstrument(overrides: Partial<Instrument> = {}): Instrument {
  return {
    id: "US:TEST",
    symbol: "TEST",
    name: "测试标的",
    market: "US",
    currency: "USD",
    ...overrides,
  };
}

function producerExecution(base: Instrument, side: "buy" | "sell", executedAt: string): TradeExecution {
  return {
    id: `${base.id}:${side}:${executedAt}`,
    source: { platform: "fixture", row: 1 },
    accountId: "account-1",
    accountLabel: "主账户",
    instrument: base,
    side,
    executedAt,
    quantity: "2",
    price: side === "buy" ? "10" : "11",
    fee: "0",
  };
}

function producerEntry(base: Instrument, startedAt: string): TradeLibraryEntry {
  const executions = [producerExecution(base, "buy", startedAt)];
  const episode: TradeEpisode = {
    id: `${base.id}:${startedAt}`,
    accountId: "account-1",
    accountLabel: "主账户",
    instrument: base,
    tradeNature: "live",
    direction: "long",
    status: "open",
    startedAt,
    openingQuantity: "2",
    remainingQuantity: "2",
    executions,
  };
  return {
    groupId: `${base.id}:live`,
    tradeNature: "live",
    instrument: base,
    executions,
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
        unrealizedPnl: "999",
        netPnl: "999",
        returnPercent: "999",
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
    firstTradeAt: startedAt,
    lastTradeAt: startedAt,
    status: "open",
    netPnl: "999",
    returnPercent: "999",
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
}

function producerCandle(instrument: Instrument): DailyCandleRecord {
  return {
    instrumentId: instrument.id,
    tradingDate: "2026-09-17",
    close: "12",
    open: "12",
    high: "12",
    low: "12",
    volume: "10",
    currency: instrument.currency,
    provider: "yahoo",
    providerSymbol: instrument.symbol,
    adjustmentMode: "raw",
    fetchedAt: "2026-09-18T00:00:00Z",
  };
}

function producerMixedModel(): HoldingsHistoryModel {
  const cny = producerInstrument({ id: "CN-SH:TEST", market: "CN-SH", currency: "CNY" });
  const usd = producerInstrument();
  const unknown = producerEntry(usd, "2026-09-17T14:00:00Z");
  unknown.episodes[0].episode.initialPosition = {
    accountId: "account-1",
    symbol: "TEST",
    market: "US",
    phase: "opening",
    date: "2026-09-17",
    quantity: "5",
    source: [],
  };
  const scope = {
    ...createDefaultRoomScope("2026-09-17"),
    period: { preset: "custom" as const, startDate: "2026-09-17", endDate: "2026-09-17" },
  };
  return buildHoldingsHistory([producerEntry(cny, "2026-09-17T02:00:00Z"), unknown], {
    scope,
    asOf: "2026-09-17",
    candlesByInstrument: {
      [cny.id]: [producerCandle(cny)],
      [usd.id]: [producerCandle(usd)],
    },
  });
}

describe("RoomHoldingsHistory B2", () => {
  it("draws known partial amounts as dashed segments with per-currency coverage", () => {
    const input = model(["100", "120", "80"]);
    input.points = input.points.map((point, index) => ({ ...point,
      holdings: [
        { key: "known", instrumentId: "US:KNOWN", instrumentName: "已知", accountId: "a", currency: "USD", quantity: "1", marketValue: index === 1 ? null : "100", cost: "80", unrealizedPnl: index === 1 ? null : "20", unrealizedReturnPercent: "25", quoteDate: point.date, quotePrice: "100", quantityAvailable: true, marketValueAvailable: index !== 1, costAvailable: true, reasons: index === 1 ? ["缺价"] : [] },
        { key: "missing", instrumentId: "US:MISSING", instrumentName: "缺失", accountId: "a", currency: "USD", quantity: null, marketValue: null, cost: null, unrealizedPnl: null, unrealizedReturnPercent: null, quoteDate: null, quotePrice: null, quantityAvailable: false, marketValueAvailable: false, costAvailable: false, reasons: ["缺少数量"] },
      ],
      marketValue: buildRoomMoneyView([{ currency: "USD", amount: index === 1 ? "100" : "100" }]),
      marketValueAvailable: false,
      available: false,
    }));
    render(<RoomHoldingsHistory model={input} />);
    const paths = [...document.querySelectorAll("[data-history-series='USD']")];
    expect(paths.some(path => path.getAttribute("stroke-dasharray"))).toBe(true);
    hover(66);
    expect(screen.getByText(/USD.*1\/2/)).toBeInTheDocument();
  });

  it("breaks the path and marks a member-set boundary", () => {
    const input = model(["100", "120", "80"]);
    input.points = input.points.map((point, index) => ({ ...point,
      holdings: [{ key: index === 1 ? "second" : "first", instrumentId: "US:TEST", instrumentName: "测试", accountId: "a", currency: "USD", quantity: "1", marketValue: "100", cost: "80", unrealizedPnl: "20", unrealizedReturnPercent: "25", quoteDate: point.date, quotePrice: "100", quantityAvailable: true, marketValueAvailable: true, costAvailable: true, reasons: [] }],
      marketValueAvailable: true, unrealizedPnlAvailable: true, available: true,
    }));
    render(<RoomHoldingsHistory model={input} />);
    expect(document.querySelectorAll("[data-history-boundary='USD']").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-history-series='USD']").length).toBeGreaterThan(1);
  });

  it("marks a covered-member change even when the member count stays constant and preserves a singleton", () => {
    const input = model(["100", null, "80"]);
    input.points = input.points.map((point, index) => ({ ...point,
      holdings: [{ key: "same-member-count", instrumentId: "US:TEST", instrumentName: "测试", accountId: "a", currency: "USD", quantity: "1", marketValue: index === 1 ? null : "100", cost: "80", unrealizedPnl: index === 1 ? null : "20", unrealizedReturnPercent: "25", quoteDate: point.date, quotePrice: "100", quantityAvailable: true, marketValueAvailable: index !== 1, costAvailable: true, reasons: index === 1 ? ["缺价"] : [] }],
      marketValueAvailable: false, available: false,
    }));
    render(<RoomHoldingsHistory model={input} />);
    expect(document.querySelectorAll("[data-history-singleton='USD']").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-history-boundary='USD']").length).toBeGreaterThan(0);
  });

  it("draws complete, partial and unknown member coverage with truthful segment states", () => {
    const input = model(["100", "120", null]);
    input.points = input.points.map((point, index) => {
      const first = { ...point.holdings[0], key: "first", marketValue: index === 2 ? null : "100", quantity: index === 2 ? null : "1", quantityAvailable: index !== 2, marketValueAvailable: index !== 2, reasons: index === 2 ? ["缺少数量"] : [] };
      const second = { ...point.holdings[0], key: "second", marketValue: index === 0 ? "50" : null, quantity: index === 0 ? "1" : null, quantityAvailable: index === 0, marketValueAvailable: index === 0, reasons: index === 0 ? [] : ["缺少数量"] };
      return { ...point, holdings: [first, second], marketValue: buildRoomMoneyView([{ currency: "USD", amount: index === 0 ? "150" : index === 1 ? "100" : null }, { currency: "CNY", amount: null }]), marketValueAvailable: index === 0, available: index === 0 };
    });
    render(<RoomHoldingsHistory model={input} />);
    const paths = [...document.querySelectorAll("[data-history-series='USD']")];
    expect(paths.map(path => path.getAttribute("data-history-state"))).toEqual(["complete", "partial"]);
    expect(paths.some(path => path.getAttribute("stroke-dasharray") === "6 4")).toBe(true);
    expect(document.querySelectorAll("[data-history-singleton='USD']").length).toBeGreaterThanOrEqual(2);
    expect(paths.map(path => path.getAttribute("data-history-expected"))).toEqual(["2", "2"]);
  });

  it("counts all source holdings for a converted target and guards target returns with a short", () => {
    const fx = { id: "fx", baseCurrency: "CNY" as const, asOf: "2026-09-21", source: "test", status: "complete" as const, rates: { "USD/CNY": "7" } };
    const input = model();
    input.points = input.points.map(point => {
      const usd = { ...point.holdings[0], key: "usd", currency: "USD", marketValue: "100", unrealizedPnl: "20", quantity: "1", marketValueAvailable: true, costAvailable: true, reasons: [] };
      const cny = { ...point.holdings[0], key: "cny", currency: "CNY", marketValue: "50", unrealizedPnl: "10", quantity: "1", marketValueAvailable: true, costAvailable: true, reasons: [] };
      return { ...point, holdings: [usd, cny], marketValue: buildRoomMoneyView([{ currency: "USD", amount: "100" }, { currency: "CNY", amount: "50" }], fx, "CNY"), marketValueAvailable: true, unrealizedPnl: buildRoomMoneyView([{ currency: "USD", amount: "20" }, { currency: "CNY", amount: "10" }], fx, "CNY"), unrealizedPnlAvailable: true };
    });
    render(<RoomHoldingsHistory model={input} reportCurrency="CNY" />);
    expect(document.querySelector("[data-history-series='CNY']")?.getAttribute("data-history-expected")).toBe("2");
    hover(390);
    expect(screen.getByRole("tooltip")).toHaveTextContent("CNY");
    cleanup();
    const shortInput = model();
    shortInput.points = shortInput.points.map(point => ({ ...point, holdings: [{ ...point.holdings[0], quantity: "-1", marketValue: "100", marketValueAvailable: true, costAvailable: true, reasons: [] }], marketValue: buildRoomMoneyView([{ currency: "USD", amount: "100" }], fx, "CNY"), unrealizedPnl: buildRoomMoneyView([{ currency: "USD", amount: "20" }], fx, "CNY"), marketValueAvailable: true, unrealizedPnlAvailable: true }));
    render(<RoomHoldingsHistory model={shortInput} reportCurrency="CNY" />);
    fireEvent.click(screen.getByRole("button", { name: "未实现收益率" }));
    expect(document.querySelector("[data-history-series='CNY']")).toBeNull();
  });

  it("draws a proven zero aggregate after complete liquidation while leaving empty unknown data gapped", () => {
    const input = model(["100", "0", "0"]);
    input.points = input.points.map((point, index) => ({ ...point,
      holdings: [],
      marketValue: buildRoomMoneyView([{ currency: "USD", amount: "0" }]),
      unrealizedPnl: buildRoomMoneyView([{ currency: "USD", amount: "0" }]),
      marketValueAvailable: index < 2,
      unrealizedPnlAvailable: index < 2,
      available: index < 2,
    }));
    render(<RoomHoldingsHistory model={input} />);
    const paths = [...document.querySelectorAll("[data-history-series='USD']")];
    expect(paths.some(path => path.getAttribute("data-history-state") === "complete")).toBe(true);
    expect(paths.some(path => path.getAttribute("d")?.includes(","))).toBe(true);
    fireEvent.change(screen.getByLabelText("历史持仓日期"), { target: { value: "2026-09-18" } });
    expect(screen.getByRole("tooltip")).toHaveTextContent("总市值");
    expect(screen.getByRole("tooltip")).not.toHaveTextContent("已知小计");
    expect(document.querySelectorAll("[data-history-series='USD']")).toHaveLength(1);
  });

  it("uses aggregate return inputs when one long member has zero cost", () => {
    const input = model();
    input.points = input.points.map(point => ({ ...point,
      holdings: [
        { ...point.holdings[0], key: "funded", cost: "100", unrealizedPnl: "20", unrealizedReturnPercent: "20", quantity: "1", costAvailable: true },
        { ...point.holdings[0], key: "zero-cost", cost: "0", unrealizedPnl: "10", unrealizedReturnPercent: null, quantity: "1", costAvailable: true },
      ],
      cost: buildRoomMoneyView([{ currency: "USD", amount: "100" }]),
      unrealizedPnl: buildRoomMoneyView([{ currency: "USD", amount: "30" }]),
      unrealizedReturnPercent: "30",
      costAvailable: true,
      unrealizedPnlAvailable: true,
      marketValueAvailable: true,
      available: true,
    }));
    render(<RoomHoldingsHistory model={input} />);
    fireEvent.click(screen.getByRole("button", { name: "未实现收益率" }));
    expect(document.querySelector("[data-history-series='USD']")).not.toBeNull();
    hover(390);
    expect(screen.getByRole("tooltip")).toHaveTextContent("30.00%");
  });

  it("keeps a trusted original CNY return when an unrelated USD member is unknown", () => {
    const input = producerMixedModel();
    const point = input.points[0];
    expect(point.cost.originalByCurrency).toEqual({ CNY: "20" });
    expect(point.unrealizedPnl.originalByCurrency).toEqual({ CNY: "4" });
    expect(point.costAvailable).toBe(false);
    expect(point.unrealizedPnlAvailable).toBe(false);
    expect(point.unrealizedReturnPercent).toBeNull();

    render(<RoomHoldingsHistory model={input} />);
    fireEvent.click(screen.getByRole("button", { name: "未实现收益率" }));
    fireEvent.change(screen.getByLabelText("历史持仓日期"), { target: { value: "2026-09-17" } });
    expect(screen.getByRole("tooltip")).toHaveTextContent("+20.00%");

    cleanup();
    render(<RoomHoldingsHistory model={input} reportCurrency="CNY" />);
    fireEvent.click(screen.getByRole("button", { name: "未实现收益率" }));
    fireEvent.change(screen.getByLabelText("历史持仓日期"), { target: { value: "2026-09-17" } });
    expect(screen.getByRole("tooltip")).toHaveTextContent("不可用");
  });

  it("starts clean, snaps to the nearest x and links five-field tooltip/crosshair/highlight, then clears on leave", () => {
    render(<RoomHoldingsHistory model={model()} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(document.querySelector("[data-history-crosshair]")).toBeNull();
    hover(390);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("2026-09-18");
    expect(within(tooltip).getByText("总市值")).toBeInTheDocument();
    expect(within(tooltip).getByText("未实现盈亏")).toBeInTheDocument();
    expect(within(tooltip).getByText("未实现盈亏率")).toBeInTheDocument();
    expect(within(tooltip).getByText(/当日盈亏/)).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("+20.00");
    expect(document.querySelector("[data-history-crosshair]")).not.toBeNull();
    expect(document.querySelector("[data-history-highlight]")).not.toBeNull();
    fireEvent.mouseLeave(chart());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(document.querySelector("[data-history-highlight]")).toBeNull();
  });
  it("clears selection on metric, granularity, scope, currency and data changes", () => {
    const original = model();
    const view = render(<RoomHoldingsHistory model={original} />);
    hover(66);
    fireEvent.click(screen.getByRole("button", { name: "未实现收益率" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByText("单位：%")).toBeInTheDocument();
    hover(66);
    fireEvent.click(screen.getByRole("button", { name: "周" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    hover(66);
    view.rerender(<RoomHoldingsHistory model={{ ...original, fxSnapshotId: "new-fx" }} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    hover(66);
    view.rerender(<RoomHoldingsHistory model={original} reportCurrency="CNY" />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    hover(66);
    view.rerender(<RoomHoldingsHistory model={{ ...original, scope: { ...original.scope, accountIds: ["changed"] } }} reportCurrency="CNY" />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
  it("commits a clicked chart date with its holdings table and returns to current state locally", () => {
    render(<RoomHoldingsHistory model={model()} />);
    vi.spyOn(chart(), "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 720, height: 270, top: 0, left: 0, right: 720, bottom: 270, toJSON: () => ({}) });
    fireEvent.click(chart(), { clientX: 390, clientY: 100 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-18");
    expect(screen.getByText("2026-09-18 持仓明细")).toBeInTheDocument();
    expect(screen.getByText("测试持仓 / a")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返回当前持仓" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.queryByText("2026-09-18 持仓明细")).not.toBeInTheDocument();
  });

  it("keeps a committed date and table while hover previews another point and leaves the chart", () => {
    render(<RoomHoldingsHistory model={model()} />);
    vi.spyOn(chart(), "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 720, height: 270, top: 0, left: 0, right: 720, bottom: 270, toJSON: () => ({}) });
    fireEvent.click(chart(), { clientX: 390, clientY: 100 });
    expect(screen.getByText("2026-09-18 持仓明细")).toBeInTheDocument();
    fireEvent.mouseMove(chart(), { clientX: 700, clientY: 100 });
    fireEvent.mouseLeave(chart());
    expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-18");
    expect(screen.getByText("2026-09-18 持仓明细")).toBeInTheDocument();
  });

  it("preserves a selected actual date through immutable status updates and clears when it leaves the range", () => {
    const original = model();
    const view = render(<RoomHoldingsHistory model={original} />);
    fireEvent.change(screen.getByLabelText("历史持仓日期"), { target: { value: "2026-09-18" } });
    expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-18");
    view.rerender(<RoomHoldingsHistory model={{ ...original, reasons: ["状态更新"] }} />);
    expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-18");
    view.rerender(<RoomHoldingsHistory model={{ ...original, points: original.points.filter(point => point.date !== "2026-09-18") }} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
  it("clears committed detail when its effective original currency disappears and does not restore it", () => {
    const withCurrencies = (input: HoldingsHistoryModel, currencies: readonly string[]): HoldingsHistoryModel => ({
      ...input,
      points: input.points.map(point => {
        const base = point.holdings[0];
        const holdings = currencies.map(currency => ({
          ...base,
          key: `fixture-${currency.toLowerCase()}`,
          currency,
          marketValue: currency === "USD" ? "100" : "200",
          cost: currency === "USD" ? "80" : "160",
          unrealizedPnl: currency === "USD" ? "20" : "40",
          unrealizedReturnPercent: currency === "USD" ? "25" : "25",
        }));
        return {
          ...point,
          holdings,
          marketValue: buildRoomMoneyView(currencies.map(currency => ({ currency, amount: currency === "USD" ? "100" : "200" }))),
          unrealizedPnl: buildRoomMoneyView(currencies.map(currency => ({ currency, amount: currency === "USD" ? "20" : "40" }))),
          cost: buildRoomMoneyView(currencies.map(currency => ({ currency, amount: currency === "USD" ? "80" : "160" }))),
          dailyPnl: buildRoomMoneyView(currencies.map(currency => ({ currency, amount: currency === "USD" ? "3" : "6" }))),
        };
      }),
    });
    const both = withCurrencies(model(), ["USD", "CNY"]);
    const cnyOnly = withCurrencies(model(), ["CNY"]);
    const view = render(<RoomHoldingsHistory model={both} reportCurrency="original" />);
    fireEvent.click(screen.getByRole("button", { name: "USD" }));
    fireEvent.change(screen.getByLabelText("历史持仓日期"), { target: { value: "2026-09-18" } });
    expect(screen.getByText("2026-09-18 持仓明细")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-18");

    view.rerender(<RoomHoldingsHistory model={cnyOnly} reportCurrency="original" />);
    expect(screen.queryByText("2026-09-18 持仓明细")).not.toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("历史持仓日期"), { target: { value: "2026-09-18" } });
    expect(screen.getByRole("tooltip")).toHaveTextContent("CNY");

    view.rerender(<RoomHoldingsHistory model={both} reportCurrency="original" />);
    expect(screen.getByRole("tooltip")).toHaveTextContent("CNY");
    expect(screen.getByRole("button", { name: "CNY" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "USD" })).toHaveAttribute("aria-pressed", "false");
  });
  it("supports keyboard first/last points and Escape plus explicit date selection/close", () => {
    render(<RoomHoldingsHistory model={model()} />);
    const interaction = screen.getByRole("group", { name: "持仓曲线交互" });
    fireEvent.keyDown(interaction, { key: "Home" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-17");
    fireEvent.keyDown(interaction, { key: "End" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-19");
    fireEvent.keyDown(interaction, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("历史持仓日期"), { target: { value: "2026-09-18" } });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭持仓详情" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
  it("preserves a chart gap and explains missing values while single/empty series are safe", () => {
    const view = render(<RoomHoldingsHistory model={model(["100", null, "80"])} />);
    expect([...document.querySelectorAll("[data-history-series]")].map(path => path.getAttribute("d") ?? "").join("").match(/M/g)).toHaveLength(2);
    hover(390);
    expect(screen.getByRole("tooltip")).toHaveTextContent("不可用");
    expect(document.querySelector("[data-history-highlight]")).toBeNull();
    view.rerender(<RoomHoldingsHistory model={model(["-10"])} />);
    hover(390);
    expect(screen.getByRole("tooltip")).toHaveTextContent("-10.00");
    view.rerender(<RoomHoldingsHistory model={model([])} />);
    hover(390);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByText(/没有可查看日期/)).toBeInTheDocument();
  });
  it("keeps touch details open until explicitly closed and displays original currency groups separately", () => {
    const input = model();
    input.points = input.points.map(point => ({ ...point,
      marketValue: buildRoomMoneyView([{ currency: "USD", amount: "120" }, { currency: "CNY", amount: "700" }]),
      unrealizedPnl: buildRoomMoneyView([{ currency: "USD", amount: "20" }, { currency: "CNY", amount: "-10" }]),
    }));
    render(<RoomHoldingsHistory model={input} />);
    vi.spyOn(chart(), "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 720, height: 270, top: 0, left: 0, right: 720, bottom: 270, toJSON: () => ({}) });
    fireEvent.touchStart(chart(), { touches: [{ clientX: 700, clientY: 100 }] });
    expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-19");
    expect(screen.getByRole("tooltip")).toHaveTextContent("USD +20.00");
    expect(screen.getByRole("tooltip")).toHaveTextContent("CNY -10.00");
    fireEvent.mouseLeave(chart());
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭持仓详情" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("keeps the selected original currency mouse tooltip open while the pointer enters its content", () => {
    const input = model();
    input.points = input.points.map(point => ({ ...point,
      marketValue: buildRoomMoneyView(["USD", "CNY", "HKD"].map(currency => ({ currency, amount: "120" }))),
      unrealizedPnl: buildRoomMoneyView(["USD", "CNY", "HKD"].map(currency => ({ currency, amount: "20" }))),
      dailyPnl: buildRoomMoneyView(["USD", "CNY", "HKD"].map(currency => ({ currency, amount: "3" }))),
      reasons: ["未知成本与缺失行情需要进一步核对".repeat(20)],
    }));
    render(<RoomHoldingsHistory model={input} />);
    hover(390);
    const tooltip = screen.getByRole("tooltip");
    fireEvent.mouseOut(chart(), { relatedTarget: tooltip });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("CNY +3.00");
    fireEvent.mouseLeave(screen.getByRole("group", { name: "持仓曲线交互" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("explains wholly incomplete valuation without a numeric axis while retaining known subtotal details", () => {
    const input = model(["100", "120"]);
    input.points = input.points.map(point => ({ ...point,
      holdings: [{ ...point.holdings[0], quantity: null, marketValue: null, cost: null, unrealizedPnl: null,
        unrealizedReturnPercent: null, quoteDate: null, quotePrice: null, quantityAvailable: false,
        marketValueAvailable: false, costAvailable: false, reasons: ["部分持仓数量未知"] }],
      marketValueAvailable: false, unrealizedPnlAvailable: false, available: false,
      reasons: ["部分持仓数量未知"],
    }));
    render(<RoomHoldingsHistory model={input} />);
    expect(screen.getByText("所选期间暂无完整估值；可选日期查看已知小计与缺失原因")).toBeInTheDocument();
    expect(chart().querySelectorAll("line:not([data-history-crosshair])")).toHaveLength(0);
    expect(document.querySelector("[data-history-series]")).toBeNull();
    fireEvent.change(screen.getByLabelText("历史持仓日期"), { target: { value: "2026-09-17" } });
    expect(screen.getByRole("tooltip")).toHaveTextContent("USD 100.00（已知小计）");
    expect(screen.getByRole("tooltip")).toHaveTextContent("部分持仓数量未知");
    fireEvent.click(screen.getByRole("button", { name: "未实现收益率" }));
    expect(screen.getByText("所选期间暂无完整收益率；可选日期查看已知小计与缺失原因")).toBeInTheDocument();
    hover(66);
    expect(screen.getByRole("tooltip")).toHaveTextContent("部分持仓数量未知");
  });

  it("keeps valid partial-period points drawable without declaring the entire period unavailable", () => {
    render(<RoomHoldingsHistory model={model([null, "120", "80"])} />);
    const coverageSlot = document.querySelector('[role="status"][aria-hidden="true"]');
    expect(coverageSlot).toBeInTheDocument();
    expect(coverageSlot).toHaveTextContent("所选期间暂无完整估值；可选日期查看已知小计与缺失原因");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect([...document.querySelectorAll("[data-history-series]")].map(path => path.getAttribute("d") ?? "").join("")).toContain("L");
    expect(chart().querySelectorAll("line:not([data-history-crosshair])").length).toBeGreaterThan(0);
  });

  it("recomputes the path and date axis when observed plot width and height change", () => {
    let resizeCallback: (() => void) | null = null;
    let dimensions = { width: 720, height: 220 };
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) {
        resizeCallback = callback;
      }

      observe(element: Element) {
        Object.defineProperty(element, "getBoundingClientRect", {
          configurable: true,
          value: () => ({ ...dimensions, x: 0, y: 0, top: 0, right: dimensions.width, bottom: dimensions.height, left: 0, toJSON: () => ({}) }),
        });
        resizeCallback?.();
      }

      disconnect() {}
    });

    const { container } = render(<RoomHoldingsHistory model={model()} />);
    const svg = chart();
    expect(svg.getAttribute("viewBox")).toBe("0 0 720 220");
    const series = container.querySelector("[data-history-series]") as SVGPathElement;
    const initialPath = series.getAttribute("d");

    dimensions = { width: 960, height: 248 };
    act(() => resizeCallback?.());
    expect(svg.getAttribute("viewBox")).toBe("0 0 960 248");
    const widePath = series.getAttribute("d");
    expect(widePath).not.toBe(initialPath);
    const pathEndX = Number(widePath?.split("L").at(-1)?.split(",")[0]);
    expect(pathEndX).toBeCloseTo(946, 2);
    const lastDateLabel = [...svg.querySelectorAll("text")].find(label => label.textContent === "2026-09-19");
    expect(Number(lastDateLabel?.getAttribute("x"))).toBeCloseTo(946, 2);

    dimensions = { width: 960, height: 190 };
    act(() => resizeCallback?.());
    expect(svg.getAttribute("viewBox")).toBe("0 0 960 190");
    const finalPath = series.getAttribute("d");
    expect(finalPath).not.toBe(widePath);
    const finalY = Number(finalPath?.split("L").at(-1)?.split(",")[1]);
    expect(finalY).toBeCloseTo(14 + (190 - 14 - 28) * (1 - 80 / 120), 2);
  });

  it("renders the shell-owned period controls in the chart card slot", () => {
    render(<RoomHoldingsHistory model={model()} periodLabel="持仓历史观察期间" periodControls={<button type="button">今年</button>} />);
    expect(screen.getByRole("group", { name: "持仓历史观察期间" })).toContainElement(screen.getByRole("button", { name: "今年" }));
  });

  it("uses the selected HKD target and keeps original subtotals discoverable when FX is missing", () => {
    const target = buildRoomMoneyView([{ currency: "USD", amount: "120" }], undefined, "HKD");
    const input = model();
    input.points = input.points.map(point => ({ ...point,
      marketValue: target,
      unrealizedPnl: target,
      dailyPnl: target,
    }));
    render(<RoomHoldingsHistory model={input} reportCurrency="HKD" />);
    hover(390);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("目标 HKD 不可用");
    expect(tooltip).toHaveTextContent("USD +120.00");
    expect(tooltip).not.toHaveTextContent("CNY +120.00");
  });

  it("exposes every usable original currency when a requested target FX value is unavailable", () => {
    const target = buildRoomMoneyView([
      { currency: "USD", amount: "120" },
      { currency: "CNY", amount: "80" },
    ], undefined, "HKD");
    const input = model();
    input.points = input.points.map(point => ({ ...point,
      holdings: point.holdings,
      marketValue: target,
      unrealizedPnl: target,
      dailyPnl: target,
    }));
    render(<RoomHoldingsHistory model={input} reportCurrency="HKD" />);
    const currencies = screen.getByRole("group", { name: "持仓曲线币种" });
    expect(within(currencies).getByRole("button", { name: "CNY" })).toBeInTheDocument();
    expect(within(currencies).getByRole("button", { name: "USD" })).toBeInTheDocument();
    fireEvent.click(within(currencies).getByRole("button", { name: "USD" }));
    hover(390);
    expect(screen.getByRole("tooltip")).toHaveTextContent("USD +120.00");
  });

  it("uses positive and negative tones for the primary floating PnL", () => {
    render(<RoomHoldingsHistory model={model(["100", "120", "80"])} />);
    hover(390);
    expect(screen.getAllByText(/\+20\.00/).some(element => element.className.includes("gain"))).toBe(true);
    cleanup();
    render(<RoomHoldingsHistory model={model(["100", "80", "80"])} />);
    hover(390);
    expect(screen.getAllByText(/-20\.00/).some(element => element.className.includes("loss"))).toBe(true);
  });

  it("breaks converted curves when an unknown member is replaced", () => {
    const fx = { id: "fx", baseCurrency: "CNY" as const, asOf: "2026-09-21", source: "test", status: "complete" as const, rates: { "USD/CNY": "7" } };
    const input = model(["100", "100", "100"]);
    input.points = input.points.map((point, index) => {
      const known = { ...point.holdings[0], key: "A", currency: "USD", marketValue: "100", quantity: "1", marketValueAvailable: true };
      const unknown = { ...point.holdings[0], key: index === 0 ? "B" : "C", currency: "USD", marketValue: null, quantity: null, marketValueAvailable: false };
      return { ...point, holdings: [known, unknown], marketValue: buildRoomMoneyView([{ currency: "USD", amount: "100" }, { currency: "USD", amount: null }], fx, "CNY"), knownSubtotals: { ...point.knownSubtotals, marketValue: buildRoomMoneySubtotal([{ memberKey: "A", currency: "USD", amount: "100" }, { memberKey: index === 0 ? "B" : "C", currency: "USD", amount: null }], fx, "CNY") }, marketValueAvailable: false };
    });
    render(<RoomHoldingsHistory model={input} reportCurrency="CNY" />);
    expect(document.querySelectorAll("[data-history-boundary='CNY']").length).toBeGreaterThan(0);
  });

});
