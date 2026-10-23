import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import type { HomepageV25BoundaryPoint, HomepageV25Metric } from "../../../../../../app/lib/reviews/homepage-v25-performance";
import type { HomepageV25SeriesBundle } from "../../../../../../app/lib/reviews/homepage-v25-series";
import { MetricCards } from "../../../../../../app/components/homepage-v25/metric-cards";

// Independent literal B contract. No projector, financial math, service or IO.
const metric: HomepageV25Metric = {
  value: "100.0000", available: true, coverage: { total: 1, available: 1 }, reasons: [],
  money: { targetCurrency: "CNY", originalByCurrency: { CNY: "100.0000" }, conversion: "same-currency", fx: null },
};
const fxCoverage = { state: "not-required", businessDate: "2026-10-02", observationIds: [], requiredPairs: [], pairKnowledge: {}, reasons: [] } as const;
const point: HomepageV25BoundaryPoint = {
  key: "2026-10-02", requestedAt: "2026-10-02", businessDate: "2026-10-02", effectiveCursor: "2026-10-02T15:59:59Z",
  boundaryPrecision: "day", state: "value", plottable: true,
  net: metric, periodRealized: metric, unrealizedChange: metric, openingUnrealized: metric, closingUnrealized: metric,
  lifetimeRealizedNet: metric, lifetimeNet: metric, marketValue: metric, unrealizedNet: metric, openFees: metric, periodFees: metric,
  instruments: [], quoteCoverage: {}, fxCoverage, lifetimeCoverage: [], reasons: [],
};
const series: HomepageV25SeriesBundle = {
  sourceId: "literal-source", requestGeneration: "committed-g1", revisions: { trades: "t", metadata: "m", quotes: "q", fx: "f" },
  policies: { finance: "F3-2026-10-23", feePool: "F3-canonical-prefix", feeFacts: "P2-incurred-knowledge-1", calendar: "exchange-2010-2030-F3",
    dailyCoverage: "P2-strict-completed-1", fx: "P2-historical-pair-knowledge-1", quoteKnowledgeMode: "retrospective-completed-session" },
  scope: { nature: "live", simulationRunId: null, includedExecutions: 1, excludedExecutions: 0, excludedByReason: {} },
  boundary: { businessTimezone: "Asia/Shanghai", asOf: "2026-10-02T10:00:00Z", periodStart: "2026-10-01", requestedEnd: "2026-10-02", effectiveEnd: "2026-10-02" },
  points: [point], periodSummary: point, summaryState: "value", feeFacts: [],
  tooltipFields: ["marketValue", "unrealizedNet", "lifetimeRealizedNet", "lifetimeNet", "net", "periodFees"],
  current: { asOf: "2026-10-02T10:00:00Z", currentMarketValue: metric, currentUnrealized: metric, currentOpenFees: metric,
    instruments: [], quoteCoverage: {}, fxCoverage },
};
const ready = { kind: "ready" } as const;
afterEach(cleanup);

it("a currency-context invalidation stays closed when the original context returns without another activation", async () => {
  const user = userEvent.setup();
  const mounted = render(<><button>外部阅读位置</button><MetricCards series={series} reportCurrency="CNY" status={ready} /></>);
  const trigger = screen.getByRole("button", { name: /^期间净盈亏，口径详情，/ });
  await user.click(trigger);
  expect(screen.getByRole("dialog")).toHaveFocus();

  // This explicit mismatch is a supported presentation-error state under ruling 1.
  mounted.rerender(<><button>外部阅读位置</button><MetricCards series={series} reportCurrency="USD" status={ready} /></>);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  screen.getByRole("button", { name: "外部阅读位置" }).focus();

  mounted.rerender(<><button>外部阅读位置</button><MetricCards series={series} reportCurrency="CNY" status={ready} /></>);
  expect(screen.queryByRole("dialog"), "a dismissed detail must not resurrect solely because a display context returns").not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "外部阅读位置" })).toHaveFocus();
});
