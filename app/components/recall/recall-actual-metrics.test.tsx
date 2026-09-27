import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { buildTradeEpisodes } from "../../lib/trades/episodes";
import type { TradeExecution } from "../../lib/trades/types";
import { createRecallDocument } from "../../lib/recall/document";
import { calculateRecallActualMetrics } from "../../lib/recall/actual-metrics";
import { formatRecallActualMetricValue, RecallActualMetricsPanel } from "./recall-actual-metrics";

afterEach(cleanup);
function sample(fee: string) {
  const instrument = { id: "US:TEST", symbol: "TEST", name: "合成验收", market: "US", currency: "USD" };
  const fills: TradeExecution[] = [
    { id: "entry", accountId: "a", accountLabel: "合成", instrument, side: "buy", quantity: "10", price: "10", fee, executedAt: "2026-01-01T00:00:00Z", source: { platform: "test", row: 1 } },
    { id: "exit", accountId: "a", accountLabel: "合成", instrument, side: "sell", quantity: "10", price: "12", fee: "0", executedAt: "2026-01-02T00:00:00Z", source: { platform: "test", row: 2 } },
  ];
  const episode = buildTradeEpisodes(fills)[0];
  return calculateRecallActualMetrics({ episode, decisions: createRecallDocument(episode).decisions, planVersions: [], riskBaselines: [], context: { phase: "post-review", cursor: "2026-01-03", executionCursor: "exit" }, source: { documentRevision: 2, computedAt: "2026-01-03", evidenceDigest: "fixture" } });
}
it("keeps unknown fees separate from confirmed zero and hides actual results before entry", () => {
  const metrics = sample("");
  const { rerender } = render(<RecallActualMetricsPanel phase="pre-entry" metrics={metrics} />);
  expect(screen.queryByRole("region", { name: "实际结果" })).toBeNull();
  rerender(<RecallActualMetricsPanel phase="post-review" metrics={metrics} />);
  expect(screen.getAllByText("费用待补齐").length).toBeGreaterThan(0);
  expect(screen.getByText("回合净盈亏").parentElement).toHaveTextContent("费用待补齐");
  rerender(<RecallActualMetricsPanel phase="post-review" metrics={sample("0")} />);
  expect(screen.getAllByText("20 USD").length).toBeGreaterThan(0);
  expect(screen.getAllByText("0 USD").length).toBeGreaterThan(0);
});
it("does not fill an old capture with current metrics", () => {
  render(<RecallActualMetricsPanel phase="post-review" metrics={null} retained />);
  expect(screen.getByText(/该快照未留存统计口径/)).toBeInTheDocument();
  expect(screen.queryByText("20 USD")).toBeNull();
});

it("keeps realized and floating metrics visible after a partial exit while final totals stay open", () => {
  const instrument = { id: "US:TEST", symbol: "TEST", name: "合成验收", market: "US", currency: "USD" };
  const fills: TradeExecution[] = [
    { id: "entry", accountId: "a", accountLabel: "合成", instrument, side: "buy", quantity: "10", price: "10", fee: "0", executedAt: "2026-01-01T00:00:00Z", source: { platform: "test", row: 1 } },
    { id: "exit", accountId: "a", accountLabel: "合成", instrument, side: "sell", quantity: "3", price: "12", fee: "0", executedAt: "2026-01-02T00:00:00Z", source: { platform: "test", row: 2 } },
  ];
  const episode = buildTradeEpisodes(fills)[0];
  const metrics = calculateRecallActualMetrics({
    episode, decisions: createRecallDocument(episode).decisions, planVersions: [], riskBaselines: [],
    context: { phase: "post-review", cursor: "2026-01-03", executionCursor: "exit" },
    mark: { price: "11", time: "2026-01-02T00:00:00Z", priceBasis: "raw" },
    source: { documentRevision: 2, computedAt: "2026-01-03", evidenceDigest: "fixture" },
  });
  expect(metrics.metrics.realizedNet.value).toBe("6");
  expect(metrics.metrics.unrealizedGross.value).toBe("7");
  expect(metrics.metrics.netPnl).toMatchObject({ value: null, reason: "episode-open" });
  expect(metrics.metrics.actualR).toMatchObject({ value: null, reason: "episode-open" });
  expect(formatRecallActualMetricValue(metrics.metrics.realizedNet)).toBe("6 USD");
  expect(formatRecallActualMetricValue(metrics.metrics.unrealizedGross)).toBe("7 USD");
  expect(formatRecallActualMetricValue(metrics.metrics.netPnl)).toBe("尚未平仓");
  expect(formatRecallActualMetricValue(metrics.metrics.actualR)).toBe("尚未平仓");
  render(<RecallActualMetricsPanel phase="post-review" metrics={metrics} />);
  expect(screen.getByText("已实现净盈亏").parentElement).toHaveTextContent("6 USD");
  expect(screen.getByText("持仓浮盈亏（未扣费）").parentElement).toHaveTextContent("7 USD");
  expect(screen.getByText("回合净盈亏").parentElement).toHaveTextContent("尚未平仓");
  expect(screen.getByText("实际 R").parentElement).toHaveTextContent("尚未平仓");
});

it("offers a compact trusted summary while keeping the complete panel in details", () => {
  const metrics = sample("0");
  render(<RecallActualMetricsPanel phase="post-review" metrics={metrics} compact />);
  const region = screen.getByRole("region", { name: "实际结果" });
  expect(region).toHaveClass("recall-actual-metrics--compact");
  expect(region.querySelector(":scope > dl")?.children).toHaveLength(2);
  expect(screen.getByText("回合净盈亏").parentElement).toHaveTextContent("20 USD");
  expect(screen.getByText("实际 R").parentElement).toHaveTextContent("初始风险未记录");
  expect(region.querySelector("details")).toBeInTheDocument();
});
