import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { buildCurrentPortfolio } from "../../lib/reviews/trading-room-portfolio";
import { createDefaultRoomScope } from "../../lib/reviews/trading-room-scope";
import { buildRoomValuationDiagnostics, RoomValuationDiagnostics } from "./room-valuation-diagnostics";
import type { CashSummary } from "../../lib/cash/cash-model";

afterEach(cleanup);

function modelWithRows() {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  model.rows = [
    {
      holding: { instrumentId: "instrument-1", episodeId: "episode-1", instrumentName: "港股测试", settlementCurrency: "HKD", direction: "long", quantity: "2", quote: { quoteDate: "2026-09-24" } },
      marketValue: null,
      cost: null,
      unrealizedPnl: null,
      unrealizedReturnPercent: null,
      reasons: ["报价证据缺失"],
    },
    {
      holding: { instrumentId: "instrument-2", episodeId: "episode-2", instrumentName: "现金待核对", settlementCurrency: null, direction: "long", quantity: "1" },
      marketValue: "10",
      cost: "8",
      unrealizedPnl: "2",
      unrealizedReturnPercent: "25",
      reasons: [],
    },
  ] as never;
  return model;
}

function modelWithDiagnosticRows(count: number) {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  model.rows = Array.from({ length: count }, (_, index) => ({
    holding: {
      instrumentId: `bulk-instrument-${index}`,
      episodeId: `bulk-episode-${index}`,
      instrumentName: `批量问题 ${index}`,
      settlementCurrency: null,
      quantity: null,
      direction: "unknown",
      quoteStatus: "missing",
      quote: null,
    },
    marketValue: null,
    cost: null,
    unrealizedPnl: null,
    unrealizedReturnPercent: null,
    reasons: [],
  })) as never;
  return model;
}

it("keeps metric specific reasons separate and carries only real holding ids", () => {
  const diagnostics = buildRoomValuationDiagnostics({ model: modelWithRows() });
  expect(diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({ group: "valuation", reason: "报价证据缺失", instrumentId: "instrument-1", episodeId: "episode-1", action: "retry-valuation" }),
    expect.objectContaining({ group: "holding", reason: "剩余成本待核对", instrumentId: "instrument-1", episodeId: "episode-1" }),
    expect.objectContaining({ group: "record", reason: "结算币种待核对", instrumentId: "instrument-2", episodeId: "episode-2" }),
  ]));
  expect(diagnostics.every(item => item.instrumentId !== "报价证据缺失")).toBe(true);
});

it("routes fresh quote rows with unknown position evidence to data checking", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  model.rows = [{
    holding: { instrumentId: "fresh-1", episodeId: "fresh-episode", instrumentName: "待核对仓位", settlementCurrency: "HKD", quantity: null, quantityStatus: "unavailable", direction: "unknown", quoteStatus: "available", quote: { price: "12", quoteDate: "2026-09-25" } },
    marketValue: null, cost: null, unrealizedPnl: null, unrealizedReturnPercent: null, reasons: [],
  }] as never;
  const diagnostics = buildRoomValuationDiagnostics({ model });
  expect(diagnostics.some(item => item.action === "retry-valuation")).toBe(false);
  expect(diagnostics.filter(item => item.group === "holding").length).toBeGreaterThanOrEqual(2);
  expect(diagnostics.every(item => item.dimension === "holdings")).toBe(true);
});

it("keeps mixed raw quote and position evidence traceable with separate actions", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  model.rows = [{
    holding: { instrumentId: "mixed-1", episodeId: "mixed-episode", instrumentName: "混合证据", settlementCurrency: "HKD", quantity: null, quantityStatus: "unavailable", direction: "unknown", quoteStatus: "missing", quote: null },
    marketValue: null, cost: "1", unrealizedPnl: null, unrealizedReturnPercent: null, reasons: ["行情源缺失；持仓数量待核对"],
  }] as never;
  const diagnostics = buildRoomValuationDiagnostics({ model });
  const mixed = diagnostics.filter(item => item.reason === "行情源缺失；持仓数量待核对");
  expect(mixed).toEqual(expect.arrayContaining([
    expect.objectContaining({ group: "valuation", action: "retry-valuation" }),
    expect.objectContaining({ group: "holding", action: "open-data-check" }),
  ]));
});

it("opens an accessible drawer, calls real-id actions, and returns focus on close", async () => {
  const user = userEvent.setup();
  const onRetryValuation = vi.fn();
  const onOpenDataCheck = vi.fn();
  render(<RoomValuationDiagnostics model={modelWithRows()} onRetryValuation={onRetryValuation} onOpenDataCheck={onOpenDataCheck} />);

  const trigger = screen.getByRole("button", { name: "查看问题详情" });
  await user.click(trigger);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "更新行情" }));
  expect(onRetryValuation).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.activeElement).toBe(trigger);
  await user.click(trigger);
  const recordIssue = screen.getByText("现金待核对").closest("article");
  expect(recordIssue).not.toBeNull();
  await user.click(within(recordIssue!).getByRole("button", { name: "核对数据" }));
  expect(onOpenDataCheck).toHaveBeenCalledWith("transaction", ["instrument-2"], "episode-2");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.activeElement).toBe(trigger);
});

it("closes an open drawer when live diagnostics become empty and stays closed for later reasons", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<RoomValuationDiagnostics model={modelWithRows()} />);
  const trigger = screen.getByRole("button", { name: "查看问题详情" });
  await user.click(trigger);
  expect(screen.getByRole("dialog")).toBeInTheDocument();

  const empty = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  rerender(<RoomValuationDiagnostics model={empty} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.activeElement).toHaveAttribute("tabindex", "-1");
  const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  window.dispatchEvent(escape);
  expect(escape.defaultPrevented).toBe(false);

  rerender(<RoomValuationDiagnostics model={modelWithRows()} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const replacementTrigger = screen.getByRole("button", { name: "查看问题详情" });
  await user.click(replacementTrigger);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("reports unstructured cash reasons with unknown object coverage and preserves every reason", () => {
  const money = { baseCurrency: "CNY", originalByCurrency: {}, convertedCny: null, converted: null, convertedHkd: null, targetCurrency: "CNY", conversion: "missing", fxSnapshotId: null, note: "缺少可信现金数据" } as const;
  const cashSummary = {
    todayProceeds: money,
    cashTotal: money,
    todayProceedsStatus: "unavailable",
    cashTotalStatus: "unavailable",
    coverage: { included: 0, excluded: 0, missing: 2 },
    asOf: null,
    missingReasons: ["现金原因 A", "现金原因 B"],
    byScope: {},
    updatedAt: null,
  } satisfies CashSummary;
  const diagnostics = buildRoomValuationDiagnostics({ model: buildCurrentPortfolio([], { scope: createDefaultRoomScope() }), cashSummary });
  expect(diagnostics.filter(item => item.group === "record")).toHaveLength(3);
  expect(diagnostics.filter(item => item.group === "record").every(item => !item.instrumentId && !item.episodeId)).toBe(true);
  expect(diagnostics.map(item => item.reason)).toEqual(expect.arrayContaining(["现金原因 A", "现金原因 B", "缺少可信现金数据"]));
  render(<RoomValuationDiagnostics model={buildCurrentPortfolio([], { scope: createDefaultRoomScope() })} cashSummary={cashSummary} />);
  expect(screen.getAllByText(/现金与记录缺口/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/3 个对象/)).not.toBeInTheDocument();
});

it("navigates from the rendered clamped page after live results shrink", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<RoomValuationDiagnostics model={modelWithDiagnosticRows(20)} />);
  await user.click(screen.getByRole("button", { name: "查看问题详情" }));
  await user.click(screen.getByRole("button", { name: "下一页" }));
  await user.click(screen.getByRole("button", { name: "下一页" }));
  await user.click(screen.getByRole("button", { name: "下一页" }));
  expect(screen.getByText("第 4 / 4 页")).toBeInTheDocument();

  rerender(<RoomValuationDiagnostics model={modelWithDiagnosticRows(13)} />);
  expect(screen.getByText("第 3 / 3 页")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "上一页" }));
  expect(screen.getByText("第 2 / 3 页")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "下一页" }));
  expect(screen.getByText("第 3 / 3 页")).toBeInTheDocument();
});

it("shows impact-first counts and keeps raw evidence searchable and expandable", async () => {
  const user = userEvent.setup();
  render(<RoomValuationDiagnostics model={modelWithRows()} />);

  expect(screen.getByText(/问题类型数/)).toHaveTextContent("问题类型数 3 · 已识别对象数 2 · 原始记录数 3");
  await user.click(screen.getByRole("button", { name: "查看问题详情" }));
  const issue = screen.getAllByText("港股测试")[0].closest("article");
  expect(issue).not.toBeNull();
  await user.click(within(issue!).getByText("查看原始证据"));
  expect(within(issue!).getByText("报价证据缺失")).toBeInTheDocument();

  const search = screen.getByRole("textbox", { name: "搜索原因" });
  await user.clear(search);
  await user.type(search, "episode-1");
  expect(screen.getByText("2 组 / 2 条原始记录")).toBeInTheDocument();
  expect(screen.getAllByText("港股测试")).toHaveLength(2);
});

it("groups repeated semantic reasons while preserving raw identifiers and stable query state", async () => {
  const user = userEvent.setup();
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25T01:02:03Z" });
  model.rows = [{
    holding: { instrumentId: "same-instrument", episodeId: "same-episode", instrumentName: "同一标的", settlementCurrency: "HKD", quantity: "1", direction: "long", quoteStatus: "missing", quote: null },
    marketValue: null, cost: "1", unrealizedPnl: null, unrealizedReturnPercent: null,
    reasons: ["行情缺失，交易ID=A", "行情缺失，交易ID=B"],
  }] as never;
  render(<RoomValuationDiagnostics model={model} />);
  await user.click(screen.getByRole("button", { name: "查看问题详情" }));
  expect(screen.getAllByRole("heading", { name: "行情与估值缺口" })).toHaveLength(1);
  const evidence = screen.getByText("查看原始证据");
  await user.click(evidence);
  expect(screen.getByText("行情缺失，交易ID=A")).toBeInTheDocument();
  expect(screen.getByText("行情缺失，交易ID=B")).toBeInTheDocument();
  const search = screen.getByRole("textbox", { name: "搜索原因" });
  await user.type(search, "交易ID=B");
  expect(screen.getByText("1 组 / 1 条原始记录")).toBeInTheDocument();
});

it("lazily pages large raw evidence groups while keeping every record searchable", async () => {
  const user = userEvent.setup();
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25T01:02:03Z" });
  model.rows = [{
    holding: { instrumentId: "large-instrument", episodeId: "large-episode", instrumentName: "大量证据", settlementCurrency: "HKD", quantity: "1", direction: "long", quoteStatus: "missing", quote: null },
    marketValue: null, cost: "1", unrealizedPnl: null, unrealizedReturnPercent: null,
    reasons: Array.from({ length: 1000 }, (_, index) => `行情缺失，交易ID=${index}`),
  }] as never;
  render(<RoomValuationDiagnostics model={model} />);
  await user.click(screen.getByRole("button", { name: "查看问题详情" }));
  expect(screen.queryByText("规则/原因")).not.toBeInTheDocument();
  await user.click(screen.getByText("查看原始证据"));
  expect(screen.getAllByText(/交易ID=/)).toHaveLength(30);
  await user.click(screen.getByRole("button", { name: "下一批" }));
  expect(screen.getByText(/行情缺失，交易ID=30/)).toBeInTheDocument();
  const search = screen.getByRole("textbox", { name: "搜索原因" });
  await user.type(search, "交易ID=999");
  expect(screen.getByText(/行情缺失，交易ID=999/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "关闭估值问题详情" }));
  await user.click(screen.getByRole("button", { name: "查看问题详情" }));
  expect(screen.getByRole("textbox", { name: "搜索原因" })).toHaveValue("交易ID=999");
  expect(screen.getByText(/行情缺失，交易ID=999/)).toBeInTheDocument();
});
