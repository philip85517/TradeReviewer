import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HomepageV25BoundaryPoint, HomepageV25Metric } from "../../../../../../app/lib/reviews/homepage-v25-performance";
import type { HomepageV25SeriesBundle } from "../../../../../../app/lib/reviews/homepage-v25-series";
import { PerformanceChart } from "../../../../../../app/components/homepage-v25/performance-chart";

// Independent literal caller. This test never imports the existing 29 tests or a builder.
function money(value: string): HomepageV25Metric {
  return { value, available: true, coverage: { total: 1, available: 1 }, reasons: [],
    money: { originalByCurrency: { CNY: value }, targetCurrency: "CNY", conversion: "same-currency", fx: null } };
}
function day(key: string, value: string): HomepageV25BoundaryPoint {
  return { key, requestedAt: key, businessDate: key, effectiveCursor: `${key}T15:59:59Z`, boundaryPrecision: "day",
    state: "value", plottable: true, marketValue: money("123.40"), unrealizedNet: money("-2.10"),
    lifetimeRealizedNet: money("1.00"), lifetimeNet: money("-1.10"), net: money(value), periodFees: money("0.20"),
    periodRealized: money("1.00"), openingUnrealized: money("0"), closingUnrealized: money("-2.10"),
    unrealizedChange: money("-2.10"), openFees: money("0.20"), instruments: [], quoteCoverage: {}, lifetimeCoverage: [],
    fxCoverage: { state: "not-required", businessDate: key, observationIds: [], requiredPairs: [], pairKnowledge: {}, reasons: [] }, reasons: [] };
}
const points = [day("2026-10-01", "-10"), day("2026-10-02", "10")];
const input: HomepageV25SeriesBundle = {
  sourceId: "independent-mixed-input", requestGeneration: "review-1", points,
  revisions: { trades: "review", metadata: "review", quotes: "review", fx: "review" },
  policies: { finance: "F3-2026-10-23", feePool: "F3-canonical-prefix", feeFacts: "P2-incurred-knowledge-1",
    calendar: "exchange-2010-2030-F3", dailyCoverage: "P2-strict-completed-1", fx: "P2-historical-pair-knowledge-1",
    quoteKnowledgeMode: "retrospective-completed-session" },
  scope: { nature: "live", simulationRunId: null, includedExecutions: 1, excludedExecutions: 0, excludedByReason: {} },
  boundary: { businessTimezone: "Asia/Shanghai", asOf: "2026-10-02T16:00:00Z", periodStart: "2026-10-01",
    requestedEnd: "2026-10-02", effectiveEnd: "2026-10-02" },
  periodSummary: points[1], summaryState: "value", feeFacts: [],
  tooltipFields: ["marketValue", "unrealizedNet", "lifetimeRealizedNet", "lifetimeNet", "net", "periodFees"],
  current: { asOf: "2026-10-02T16:00:00Z", currentMarketValue: money("999"), currentUnrealized: money("999"),
    currentOpenFees: money("999"), instruments: [], quoteCoverage: {},
    fxCoverage: { state: "not-required", businessDate: "2026-10-02", observationIds: [], requiredPairs: [], pairKnowledge: {}, reasons: [] } },
};
const graph = () => screen.getByRole("group", { name: "当前表现｜期间净盈亏（按日）" });
const hit = () => screen.getByTestId("hp-chart-point-2026-10-02");
const detail = () => screen.getByRole("tooltip");
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
function hoverThenFocusValue() {
  fireEvent.mouseEnter(hit()); tick(300);
  act(() => graph().focus());
  act(() => within(detail()).getByTestId("hp-chart-value-marketValue").focus());
  expect(within(detail()).getByTestId("hp-chart-value-marketValue")).toHaveFocus();
}
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("independent chart mixed pointer and keyboard counterexample", () => {
  it("keeps keyboard-focused detail when the pointer leaves the point", () => {
    vi.useFakeTimers();
    render(<PerformanceChart series={input} reportCurrency="CNY" />);
    hoverThenFocusValue();
    fireEvent.mouseLeave(hit()); tick(100);
    expect(screen.queryByRole("tooltip")).toBeInTheDocument();
    expect(within(detail()).getByTestId("hp-chart-value-marketValue")).toHaveFocus();
  });

  it("already keeps keyboard-focused detail when the pointer leaves the detail", () => {
    vi.useFakeTimers();
    render(<PerformanceChart series={input} reportCurrency="CNY" />);
    hoverThenFocusValue();
    fireEvent.mouseLeave(detail()); tick(100);
    expect(screen.queryByRole("tooltip")).toBeInTheDocument();
    expect(within(detail()).getByTestId("hp-chart-value-marketValue")).toHaveFocus();
  });
});
