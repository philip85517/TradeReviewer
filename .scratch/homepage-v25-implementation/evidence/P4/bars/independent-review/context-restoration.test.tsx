import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { ContributionBars, type ContributionMetric, type CurrentContributionRow } from "../../../../../../app/components/homepage-v25/contribution-bars";

// Literal prepared consumer facts only; no projector, financial math, IO or host.
const realized: ContributionMetric = Object.freeze({
  value: "120.123456", available: true, coverage: Object.freeze({ total: 1, available: 1 }), reasons: Object.freeze([]),
  money: Object.freeze({ originalByCurrency: Object.freeze({ CNY: "120.123456" }), targetCurrency: "CNY", conversion: "same-currency", fx: null }),
});
const unrealized: ContributionMetric = Object.freeze({ ...realized, value: "-20.123456" });
const net: ContributionMetric = Object.freeze({ ...realized, value: "100.000000" });
const identity = Object.freeze({ kind: "instrument", accountId: "literal-account", instrumentId: "CN:LITERAL", market: "CN", nature: "live", simulationRunId: null } as const);
const rows: readonly CurrentContributionRow[] = Object.freeze([Object.freeze({
  key: "literal-row", label: "字面证券", accessibleLabel: "查看字面证券", identity,
  periodRealized: realized, unrealizedChange: unrealized, net,
})]);
const ready = Object.freeze({ kind: "ready" } as const);
const activate = () => {};
afterEach(cleanup);

it("an invalidated contribution detail stays closed and preserves outside focus when a currency context returns", async () => {
  const user = userEvent.setup();
  const content = (currency: string) => <><button>外部阅读位置</button><ContributionBars mode="current" rows={rows} fullTotal={net} reportCurrency={currency} readState={ready} onActivate={activate} /></>;
  const mounted = render(content("CNY"));
  const trigger = screen.getByRole("button", { name: "字面证券，贡献详情" });
  await user.click(trigger);
  expect(screen.getByRole("dialog")).toHaveFocus();

  // Currency mismatch is an explicitly supported readout state, not a new fact.
  mounted.rerender(content("USD"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  const outside = screen.getByRole("button", { name: "外部阅读位置" });
  outside.focus();
  expect(outside).toHaveFocus();

  mounted.rerender(content("CNY"));
  // Soft assertions preserve both independent observations in this single run.
  expect.soft(screen.queryByRole("dialog"), "a dismissed readout must not resurrect without a new activation").not.toBeInTheDocument();
  expect.soft(outside, "context restoration must not steal the reader's outside focus").toHaveFocus();
});
