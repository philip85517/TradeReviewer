import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { TradeExecution } from "../../lib/trades/types";
import { buildTradingRoomModel, createDefaultRoomScope } from "../../lib/reviews/trading-room-scope";
import { createEmptyEpisodeReviewRecord } from "../../lib/reviews/review-metrics";
import { buildPendingReviews } from "../../lib/reviews/trading-room-pending";
import type { RoomPendingReviewsModel } from "../../lib/reviews/trading-room-pending";
import { RoomPendingReviews } from "./room-pending-reviews";
afterEach(cleanup);
function fixture() {
  const fills: TradeExecution[] = [];
  for (let i = 1; i <= 6; i++) {
    const instrument = { id: `US:T${i}`, symbol: `T${i}`, name: `待复盘证券${i}`, market: "US", currency: "USD" };
    for (const side of ["buy", "sell"] as const) fills.push({ id: `${i}:${side}`, accountId: `account-${i % 2}`, accountLabel: "同名账户", instrument, side, executedAt: `2026-09-0${i}T0${side === "buy" ? 1 : 2}:00:00Z`, quantity: "1", price: side === "buy" ? "10" : "11", fee: "0", source: { tradeNature: "live", platform: "test", row: 1, tradingDate: `2026-09-0${i}` } });
  }
  return buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), {}, {});
}
const scope = createDefaultRoomScope("2026-09-25");
const model = (entries: ReturnType<typeof fixture>) => buildPendingReviews(buildTradingRoomModel(entries, { scope }).rows);

it("paginates the same pending count, keeps unavailable rows, and opens the exact episode with its queue", () => {
  const entries = fixture();
  const latest = entries.find(entry => entry.instrument.id === "US:T6")!.episodes[0];
  latest.metrics.netPnl = null;
  const onOpen = vi.fn();
  const onViewAll = vi.fn();
  const pending = model(entries);
  render(<RoomPendingReviews model={pending} pageSize={2} onOpenInReview={onOpen} onViewAllPending={onViewAll} />);
  expect(screen.getByRole("region", { name: "待复盘的已完成交易" })).toHaveTextContent("待复盘的已完成交易（6）");
  const rows = screen.getAllByRole("row");
  expect(rows[1]).toHaveTextContent("待复盘证券6");
  expect(rows[1]).toHaveTextContent("不可用");
  fireEvent.click(within(rows[1]).getByRole("button", { name: "开始复盘" }));
  expect(onOpen).toHaveBeenCalledWith("US:T6", latest.episode.id, pending.queueIds);
  expect(screen.getByText("待复盘的已完成交易（6）")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "第1页待复盘" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "第2页待复盘" })).not.toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "下一页待复盘" }));
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("待复盘证券4");
  expect(screen.getByRole("button", { name: "第2页待复盘" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("button", { name: "第3页待复盘" }));
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("待复盘证券2");
  expect(screen.getByRole("button", { name: "第3页待复盘" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("button", { name: "第2页待复盘" }));
  fireEvent.click(screen.getByRole("button", { name: "查看全部待复盘" }));
  expect(onViewAll).toHaveBeenCalledWith(expect.objectContaining({
    reviewStatus: "pending",
    positionStatus: "closed",
  }));
});

it("uses saved completion/defer records on refresh and retains pending work on unchanged or cancelled return", () => {
  const entries = fixture();
  const onViewAll = vi.fn();
  const props = { onOpenInReview: vi.fn(), onViewAllPending: onViewAll, pageSize: 2 };
  const view = render(<RoomPendingReviews {...props} model={model(entries)} />);
  fireEvent.click(screen.getAllByRole("button", { name: "开始复盘" })[0]);
  view.rerender(<RoomPendingReviews {...props} model={model(entries)} />);
  expect(screen.getByText("待复盘的已完成交易（6）")).toBeInTheDocument();
  const completed = entries[0].episodes[0];
  completed.review = createEmptyEpisodeReviewRecord(completed.episode.id, entries[0].instrument.id);
  completed.review.review.completed = true;
  const deferred = entries[1].episodes[0];
  deferred.review = createEmptyEpisodeReviewRecord(deferred.episode.id, entries[1].instrument.id);
  deferred.review.review.deferredReason = "等待资料";
  view.rerender(<RoomPendingReviews {...props} model={model(entries)} />);
  expect(screen.getByText("待复盘的已完成交易（4）")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "查看全部待复盘" }));
  expect(onViewAll).toHaveBeenCalledWith(expect.objectContaining({
    reviewStatus: "pending",
    positionStatus: "closed",
  }));
});

it("uses exactly the caller's filtered identity and excludes open rounds from pending", () => {
  const entries = fixture();
  entries[0].episodes[0].episode.status = "open";
  const room = buildTradingRoomModel(entries, { scope: { ...scope, accountIds: ["account-1"] } });
  const pending = buildPendingReviews(room.rows);
  expect(pending.rows.every(row => row.accountId === "account-1")).toBe(true);
  expect(pending.rows.some(row => row.episodeId === entries[0].episodes[0].episode.id)).toBe(false);
  expect(pending.queueIds).toEqual(pending.rows.map(row => row.episodeId));
});

it("keeps the original fact visible while explicitly marking a missing HKD target", () => {
  const entries = fixture();
  const pending = buildPendingReviews(buildTradingRoomModel(entries, { scope }).rows, undefined, "HKD");
  render(<RoomPendingReviews model={pending} pageSize={2} onOpenInReview={vi.fn()} />);

  expect(screen.getAllByText(/HKD暂不可用/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/原币：/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/CNY/)).not.toBeInTheDocument();
});

it("keeps the view-all navigation entry for a one-page pending set", () => {
  const full = model(fixture());
  const pending = { ...full, rows: full.rows.slice(0, 2), count: 2, queueIds: full.queueIds.slice(0, 2) };
  const onViewAll = vi.fn();
  render(<RoomPendingReviews model={pending} onOpenInReview={vi.fn()} onViewAllPending={onViewAll} />);

  fireEvent.click(screen.getByRole("button", { name: "查看全部待复盘" }));
  expect(onViewAll).toHaveBeenCalledWith(expect.objectContaining({
    closeDateFrom: expect.any(String),
    closeDateTo: expect.any(String),
  }));
});

it("keeps trusted money while placing a close-field explanation beside the unavailable price", () => {
  const pending: RoomPendingReviewsModel = {
    displayCurrency: "original",
    count: 1,
    queueIds: ["episode:gap"],
    rows: [{
      episodeId: "episode:gap",
      instrumentId: "US:GAP",
      instrumentName: "缺价证券",
      symbol: "GAP",
      accountId: "qa-main",
      accountLabel: "QA 主账户",
      closeDate: "2026-02-03",
      closingSide: "sell",
      closingQuantity: "100",
      closingWeightedPrice: null,
      closingCurrency: "USD",
      closingUnavailableReason: "closing-price-unavailable",
      money: {
        baseCurrency: "CNY",
        originalByCurrency: { USD: "1798" },
        convertedCny: null,
        conversion: "same-currency",
        fxSnapshotId: null,
        note: "按原币显示",
      },
      unavailableReason: "closing-price-unavailable",
    }],
  };
  render(<RoomPendingReviews model={pending} onOpenInReview={vi.fn()} />);

  expect(screen.getByText("+1798.00 USD")).toBeInTheDocument();
  expect(screen.getByText("成交均价证据不足")).toBeInTheDocument();
  expect(screen.queryByText("closing-price-unavailable")).not.toBeInTheDocument();
  expect(screen.getByText("待复盘")).toBeInTheDocument();
});

it("formats long weighted prices to six decimals while keeping the source value accessible", () => {
  const pending: RoomPendingReviewsModel = {
    displayCurrency: "original",
    count: 1,
    queueIds: ["episode:price"],
    rows: [{
      episodeId: "episode:price",
      instrumentId: "CN-SH:ETF",
      instrumentName: "黄金ETF华安",
      symbol: "518880",
      accountId: "qa-main",
      accountLabel: "QA 主账户",
      closeDate: "2026-02-03",
      closingSide: "sell",
      closingQuantity: "4200",
      closingWeightedPrice: "8.4578333333333333333",
      closingCurrency: "CNY",
      closingUnavailableReason: null,
      money: {
        baseCurrency: "CNY",
        originalByCurrency: { CNY: "5373.17" },
        convertedCny: "5373.17",
        conversion: "same-currency",
        fxSnapshotId: null,
        note: "同币种",
      },
      unavailableReason: null,
    }],
  };

  render(<RoomPendingReviews model={pending} onOpenInReview={vi.fn()} />);

  const price = screen.getByText("8.457833 CNY");
  expect(price).toHaveAttribute("title", "完整成交均价：8.4578333333333333333 CNY");
  expect(price).toHaveAttribute("aria-label", "完整成交均价：8.4578333333333333333 CNY");
  expect(screen.queryByText("完整成交均价：8.4578333333333333333 CNY")).not.toBeVisible();
  fireEvent.click(price);
  expect(screen.getByText("完整成交均价：8.4578333333333333333 CNY")).toBeVisible();
  expect(screen.getByText("4200")).toBeInTheDocument();
});

it("emits an exact library range plus the complete homepage source snapshot", () => {
  const pending = model(fixture());
  const onViewAll = vi.fn();
  const sourceSnapshot = {
    sharedScope: { nature: "live" as const, accountIds: ["account-1"], reportCurrency: "original" as const, simulationRunId: null },
    observationPeriod: { preset: "month" as const, startDate: "2026-09-01", endDate: "2026-09-25" },
    historyPeriod: { preset: "custom" as const, startDate: "2026-09-01", endDate: "2026-09-25" },
    holdings: { query: "NVDA", page: 2 },
    pending: { page: 2 },
    historyCalendar: { displayMonth: "2026-09", selectedDate: "2026-09-18" },
  };
  render(<RoomPendingReviews model={pending} pageSize={2} page={2} onPageChange={vi.fn()} sourceSnapshot={sourceSnapshot} onViewAllPending={onViewAll} onOpenInReview={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "查看全部待复盘" }));

  expect(onViewAll).toHaveBeenCalledWith(expect.objectContaining({
    reviewStatus: "pending",
    positionStatus: "closed",
    closeDateFrom: "2026-09-01",
    closeDateTo: "2026-09-25",
    sourceSnapshot: expect.objectContaining({
      holdings: { query: "NVDA", page: 2 },
      pending: { page: 2 },
      historyCalendar: { displayMonth: "2026-09", selectedDate: "2026-09-18" },
    }),
  }));
});
