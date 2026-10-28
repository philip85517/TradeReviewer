import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HomepageV25BoundaryPoint, HomepageV25Metric } from "../../lib/reviews/homepage-v25-performance";
import type { HomepageV25SeriesBundle } from "../../lib/reviews/homepage-v25-series";
import type { HomepagePeriodView } from "./financial-view-model";
import { MetricCards } from "./metric-cards";

// Literal public B data, independent of the financial projector, clock or IO.
function money(value: string | null, changes: Partial<HomepageV25Metric> = {}): HomepageV25Metric {
  return { value, available: value !== null, coverage: { total: 3, available: value === null ? 0 : 3 }, reasons: [],
    money: { originalByCurrency: value === null ? {} : { CNY: value }, targetCurrency: "CNY", conversion: "same-currency", fx: null }, ...changes };
}
function bundle(): HomepageV25SeriesBundle {
  const point: HomepageV25BoundaryPoint = { key: "2026-10-02", requestedAt: "2026-10-02", businessDate: "2026-10-02",
    effectiveCursor: "2026-10-02T15:59:59Z", boundaryPrecision: "day", state: "value", plottable: true,
    net: money("18420.567800"), periodRealized: money("12240.5678"), unrealizedChange: money("6180"),
    openingUnrealized: money("900"), closingUnrealized: money("7080"), marketValue: money("888"), unrealizedNet: money("777"),
    lifetimeRealizedNet: money("666"), lifetimeNet: money("555"), openFees: money("1"), periodFees: money("640"),
    instruments: [], quoteCoverage: {}, lifetimeCoverage: [], reasons: [],
    fxCoverage: { state: "not-required", businessDate: "2026-10-02", observationIds: [], requiredPairs: [], pairKnowledge: {}, reasons: [] } };
  return { sourceId: "source-1", requestGeneration: "g1", revisions: { trades: "t1", metadata: "m1", quotes: "q1", fx: "f1" },
    policies: { finance: "F3-2026-10-23", feePool: "F3-canonical-prefix", feeFacts: "P2-incurred-knowledge-1", calendar: "exchange-2010-2030-F3",
      dailyCoverage: "P2-strict-completed-1", fx: "P2-historical-pair-knowledge-1", quoteKnowledgeMode: "retrospective-completed-session" },
    scope: { nature: "live", simulationRunId: null, includedExecutions: 1, excludedExecutions: 0, excludedByReason: {} },
    boundary: { businessTimezone: "Asia/Shanghai", asOf: "2026-10-23T08:00:00Z", periodStart: "2026-10-01", requestedEnd: "2026-10-02", effectiveEnd: "2026-10-02" },
    points: [point], periodSummary: point, summaryState: "value", tooltipFields: ["marketValue", "unrealizedNet", "lifetimeRealizedNet", "lifetimeNet", "net", "periodFees"], feeFacts: [],
    current: { asOf: "2026-10-23T08:00:00Z", currentMarketValue: money("260102.123400"), currentUnrealized: money("23153.2500"), currentOpenFees: money("4"),
      instruments: [], quoteCoverage: {}, fxCoverage: { state: "not-required", businessDate: "2026-10-23", observationIds: [], requiredPairs: [], pairKnowledge: {}, reasons: [] } } };
}
function frozen<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
const ready = { kind: "ready" } as const;
const card = (name: string) => screen.getByRole("article", { name });
const value = (name: string) => within(card(name)).getByTestId("hp-metric-value");
const trigger = (name: string, action = "口径详情") => screen.getByRole("button", { name: new RegExp(`^${name}，${action}，`) });
afterEach(cleanup);

describe("four controlled homepage metric readouts", () => {
  it("M01–04 reads the three period fields and the separate current market value in visual order", () => {
    render(<MetricCards view={periodView(bundle(), "CNY")} status={ready} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map(node => node.textContent)).toEqual([
      "期间净盈亏(CNY)", "期间已实现(CNY)", "期间浮盈变动(CNY)", "当前持仓市值(CNY)",
    ]);
    expect(value("期间净盈亏")).toHaveTextContent("+1.84 万");
    expect(value("期间已实现")).toHaveTextContent("+1.22 万");
    expect(value("期间浮盈变动")).toHaveTextContent("+6,180.00");
    expect(value("当前持仓市值")).toHaveTextContent("26.01 万");
    expect(value("当前持仓市值")).toHaveAttribute("data-tone", "neutral");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["期间净盈亏", "期间已实现", "期间浮盈变动", "当前持仓市值"])("M01–04 %s opens its own exact readout and returns focus on close", async name => {
    const user = userEvent.setup();
    render(<MetricCards view={periodView(bundle(), "CNY")} status={ready} />);
    await user.click(trigger(name));
    const dialog = screen.getByRole("dialog", { name: `${name} · 口径详情` });
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveTextContent("覆盖数量");
    expect(dialog).toHaveTextContent("3 / 3");
    await user.click(within(dialog).getByRole("button", { name: "关闭详情" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger(name)).toHaveFocus();
  });

  it("M05 tabs in order and opens with Enter/Space, then Escape restores the exact trigger", async () => {
    const user = userEvent.setup();
    render(<MetricCards view={periodView(bundle(), "CNY")} status={ready} />);
    for (const [index, name] of ["期间净盈亏", "期间已实现", "期间浮盈变动", "当前持仓市值"].entries()) {
      await user.tab(); expect(trigger(name)).toHaveFocus();
      await user.keyboard(index % 2 ? " " : "{Enter}");
      expect(screen.getByRole("dialog")).toHaveAccessibleName(`${name} · 口径详情`);
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger(name)).toHaveFocus();
    }
  });

  it("M06 outside click closes and restores the opener; clicking inside preserves the readout", async () => {
    const user = userEvent.setup();
    render(<><button>外部操作</button><MetricCards view={periodView(bundle(), "CNY")} status={ready} /></>);
    await user.click(trigger("期间浮盈变动"));
    await user.click(within(screen.getByRole("dialog")).getByText("覆盖数量"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "外部操作" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger("期间浮盈变动")).toHaveFocus();
  });

  it("M01–04 moving directly between card triggers replaces the detail and restores the new opener", async () => {
    const user = userEvent.setup();
    render(<MetricCards view={periodView(bundle(), "CNY")} status={ready} />);
    await user.click(trigger("期间净盈亏"));
    await user.click(trigger("当前持仓市值"));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("当前持仓市值 · 口径详情");
    await user.keyboard("{Escape}");
    expect(trigger("当前持仓市值")).toHaveFocus();
  });

  it("M07 pending preserves the entire committed bundle and opening details cannot request or replace data", async () => {
    const user = userEvent.setup(); const data = frozen(bundle());
    render(<MetricCards view={periodView(data, "CNY")} status={{ kind: "pending", reason: "正在更新，继续显示原期间" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("正在更新，继续显示原期间");
    expect(value("期间净盈亏")).toHaveTextContent("+1.84 万");
    expect(value("当前持仓市值")).toHaveTextContent("26.01 万");
    await user.click(trigger("期间净盈亏")); await user.keyboard("{Escape}{Enter}");
    expect(screen.getByRole("dialog")).toHaveTextContent("18420.567800 CNY");
    expect(screen.getByRole("dialog")).toHaveTextContent("2026-10-01 至 2026-10-02");
  });

  it("M08 first load shows four loading placeholders without invented zeroes and still explains each card", async () => {
    const user = userEvent.setup();
    render(<MetricCards view={null} placeholderCurrency="CNY" status={{ kind: "pending", reason: "首次加载" }} />);
    expect(screen.getAllByTestId("hp-metric-skeleton")).toHaveLength(4);
    expect(screen.queryByText(/^0(?:\.00)?$/)).not.toBeInTheDocument();
    await user.click(trigger("期间已实现"));
    expect(screen.getByRole("dialog")).toHaveTextContent("首次加载");
    expect(screen.getByRole("dialog")).toHaveTextContent("实际平仓日");
  });

  it("M09 empty has four dashes and read-only reasons without next-step actions", async () => {
    const user = userEvent.setup();
    render(<MetricCards view={null} placeholderCurrency="CNY" status={{ kind: "empty", reason: "当前范围没有可计算指标" }} />);
    expect(screen.getAllByTestId("hp-metric-value").every(node => node.textContent === "—")).toBe(true);
    await user.click(trigger("期间净盈亏"));
    expect(screen.getByRole("dialog")).toHaveTextContent("当前范围没有可计算指标");
    expect(within(screen.getByRole("dialog")).getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /修复|重试|导入/ })).not.toBeInTheDocument();
  });

  it("M09 missing net never falls back to an earlier point or suppresses independently available realized/current values", async () => {
    const user = userEvent.setup(); const data = bundle();
    const summary = { ...data.periodSummary!, state: "source-missing" as const, net: money(null, { reasons: ["缺少期末行情"] }) };
    render(<MetricCards view={periodView({ ...data, periodSummary: summary, summaryState: "source-missing" }, "CNY")} status={ready} />);
    expect(value("期间净盈亏")).toHaveTextContent(/^—$/);
    expect(value("期间已实现")).toHaveTextContent("+1.22 万");
    expect(value("当前持仓市值")).toHaveTextContent("26.01 万");
    await user.click(trigger("期间净盈亏")); expect(screen.getByRole("dialog")).toHaveTextContent("缺少期末行情");
  });

  it("M09 future period values and details remain unknown while the independent current snapshot stays available", async () => {
    const user = userEvent.setup();
    const data = bundle();
    render(<MetricCards view={periodView({ ...data, periodSummary: { ...data.periodSummary!, state: "future" }, summaryState: "future" }, "CNY")} status={ready} />);
    expect(value("期间净盈亏")).toHaveTextContent(/^—$/); expect(value("期间已实现")).toHaveTextContent(/^—$/);
    expect(value("期间浮盈变动")).toHaveTextContent(/^—$/); expect(value("当前持仓市值")).toHaveTextContent("26.01 万");
    await user.click(trigger("期间净盈亏"));
    expect(screen.getByRole("dialog")).toHaveTextContent("未来未覆盖，金额未知");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("18420.567800");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("来源金额");
  });

  it("M10 update failure keeps old values and context in the reason action", async () => {
    const user = userEvent.setup();
    render(<MetricCards view={periodView(bundle(), "CNY")} status={{ kind: "error", reason: "新范围未应用：读取超时" }} />);
    expect(value("期间净盈亏")).toHaveTextContent("+1.84 万");
    await user.click(trigger("期间净盈亏", "查看原因"));
    expect(screen.getByRole("dialog")).toHaveTextContent("新范围未应用：读取超时");
    expect(screen.getByRole("dialog")).toHaveTextContent("2026-10-01 至 2026-10-02");
    expect(screen.getByRole("dialog")).toHaveTextContent("18420.567800 CNY");
  });

  it("M10 initial failure offers reasons and never substitutes zero", async () => {
    const user = userEvent.setup();
    render(<MetricCards view={null} placeholderCurrency="CNY" status={{ kind: "error", reason: "首次读取失败" }} />);
    expect(screen.getAllByTestId("hp-metric-value").every(node => node.textContent === "—")).toBe(true);
    await user.click(trigger("当前持仓市值", "查看原因")); expect(screen.getByRole("dialog")).toHaveTextContent("首次读取失败");
  });

  it("M11 distinguishes positive, negative, true zero and missing values", () => {
    const data = bundle();
    render(<MetricCards view={periodView({ ...data, periodSummary: { ...data.periodSummary!, net: money("0"), periodRealized: money("-12.345600"), unrealizedChange: money(null) } }, "CNY")} status={ready} />);
    expect(value("期间净盈亏")).toHaveTextContent(/^0\.00$/); expect(value("期间净盈亏")).toHaveAttribute("data-tone", "neutral");
    expect(value("期间已实现")).toHaveTextContent("-12.35"); expect(value("期间已实现")).toHaveAttribute("data-tone", "negative");
    expect(value("期间浮盈变动")).toHaveTextContent(/^—$/);
  });

  it("M12 market detail reads exact current unrealized, coverage, original amounts and supplied FX source", async () => {
    const user = userEvent.setup(); const data = bundle();
    const currentMarketValue = money("260102.123400", { coverage: { total: 9, available: 8 }, money: {
      targetCurrency: "CNY", originalByCurrency: { USD: "12345.678900", HKD: "999.001200" }, conversion: "complete",
      fx: { id: "fx-23", source: "央行每日参考汇率中文完整来源", asOf: "2026-10-23", status: "complete" } } });
    render(<MetricCards view={periodView({ ...data, current: { ...data.current, currentMarketValue } }, "CNY")} status={ready} />);
    await user.click(trigger("当前持仓市值"));
    const dialog = screen.getByRole("dialog");
    for (const text of ["260102.123400 CNY", "23153.2500 CNY", "8 / 9", "12345.678900 USD", "999.001200 HKD", "央行每日参考汇率中文完整来源", "fx-23"]) expect(dialog).toHaveTextContent(text);
    expect(dialog).not.toHaveTextContent("7080"); expect(dialog).not.toHaveTextContent("888");
  });

  it("M13/M18 atomically replaces period values from frozen input while current remains independent and old detail closes", async () => {
    const user = userEvent.setup(); const data = frozen(bundle()); const before = JSON.stringify(data);
    const mounted = render(<MetricCards view={periodView(data, "CNY")} status={ready} />);
    await user.click(trigger("期间净盈亏"));
    const next = frozen({ ...data, requestGeneration: "g2", boundary: { ...data.boundary, periodStart: "2026-09-01" },
      periodSummary: { ...data.periodSummary!, net: money("-100"), periodRealized: money("0"), unrealizedChange: money("-100") } });
    mounted.rerender(<MetricCards view={periodView(next, "CNY")} status={ready} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger("期间净盈亏")).toHaveFocus();
    expect(value("期间净盈亏")).toHaveTextContent("-100.00"); expect(value("期间已实现")).toHaveTextContent("0.00");
    expect(value("当前持仓市值")).toHaveTextContent("26.01 万"); expect(JSON.stringify(data)).toBe(before);
    await user.click(trigger("期间净盈亏")); expect(screen.getByRole("dialog")).toHaveTextContent("2026-09-01 至 2026-10-02");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("18420.567800");
  });

  it("M12 refuses to relabel a mismatched currency while retaining the true source amount and currency in details", async () => {
    const user = userEvent.setup(); const data = bundle();
    const usd = money("123.4500", { money: { targetCurrency: "USD", originalByCurrency: { USD: "123.4500" }, conversion: "same-currency", fx: null } });
    render(<MetricCards view={periodView({ ...data, periodSummary: { ...data.periodSummary!, net: usd },
      current: { ...data.current, currentUnrealized: usd } }, "CNY")} status={ready} />);
    expect(value("期间净盈亏")).toHaveTextContent(/^—$/);
    await user.click(trigger("期间净盈亏"));
    expect(screen.getByRole("dialog")).toHaveTextContent("币种与报表不一致");
    expect(screen.getByRole("dialog")).toHaveTextContent("123.4500 USD");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("123.4500 CNY");
    await user.keyboard("{Escape}"); await user.click(trigger("当前持仓市值"));
    expect(screen.getByRole("dialog")).toHaveTextContent("当前浮盈");
    expect(screen.getByRole("dialog")).toHaveTextContent("币种与报表不一致");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("123.4500 CNY");
  });

  it("M14 long exact amounts and reasons stay available in details without losing precision", async () => {
    const user = userEvent.setup(); const data = bundle(); const exact = "123456789012345678901234567890.123456789000";
    const reason = "这是一段很长的中文来源和缺失原因，必须保持完整可读而不能只放在标题属性里。".repeat(8);
    render(<MetricCards view={periodView({ ...data, periodSummary: { ...data.periodSummary!, net: money(exact, { reasons: [reason] }) } }, "CNY")} status={ready} />);
    expect(trigger("期间净盈亏")).toHaveAccessibleName(`期间净盈亏，口径详情，完整金额 ${exact} CNY`);
    await user.click(trigger("期间净盈亏"));
    expect(screen.getByRole("dialog")).toHaveTextContent(`${exact} CNY`); expect(screen.getByRole("dialog")).toHaveTextContent(reason);
  });

  it.each(["currency", "generation", "source"] as const)("M18 invalidating %s permanently closes the old detail and preserves an outside reading position when context returns", async context => {
    const user = userEvent.setup(); const data = frozen(bundle());
    const renderCards = (series: HomepageV25SeriesBundle, reportCurrency: HomepagePeriodView["stamp"]["reportCurrency"]) => <><button>外部阅读位置</button><MetricCards view={periodView(series, reportCurrency)} status={ready} /></>;
    const mounted = render(renderCards(data, "CNY"));
    const opener = trigger("期间净盈亏");
    await user.click(opener);
    expect(screen.getByRole("dialog")).toHaveFocus();

    const changed = context === "generation" ? { ...data, requestGeneration: "g2" }
      : context === "source" ? { ...data, sourceId: "source-2" } : data;
    mounted.rerender(renderCards(changed, context === "currency" ? "USD" : "CNY"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    const outside = screen.getByRole("button", { name: "外部阅读位置" });
    outside.focus();

    mounted.rerender(renderCards(data, "CNY"));
    expect(screen.queryByRole("dialog"), "returning context must not reactivate an invalidated detail").not.toBeInTheDocument();
    expect(outside).toHaveFocus();
    await user.click(opener);
    expect(screen.getByRole("dialog")).toHaveTextContent("18420.567800 CNY");
    await user.keyboard("{Escape}");
    expect(opener).toHaveFocus();
  });
});

describe("metric detail motion lifecycle", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("M05/M17 closes access and restores focus immediately while the noninteractive exit finishes at160ms", async () => {
    const user = userEvent.setup();
    render(<MetricCards view={periodView(bundle(), "CNY")} status={ready} />);
    const opener = trigger("期间净盈亏");
    await user.click(opener);
    const detail = screen.getByRole("dialog");
    vi.useFakeTimers();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "false");
    expect(detail).toBeInTheDocument();
    expect(detail).toHaveAttribute("aria-hidden", "true");
    expect(detail).toHaveAttribute("inert");
    act(() => vi.advanceTimersByTime(159));
    expect(detail).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(detail).not.toBeInTheDocument();
  });

  it("M17 reopening during exit cancels the old cleanup and keeps the new readout open", async () => {
    const user = userEvent.setup();
    render(<MetricCards view={periodView(bundle(), "CNY")} status={ready} />);
    await user.click(trigger("期间净盈亏"));
    const exiting = screen.getByRole("dialog");
    vi.useFakeTimers();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(exiting).toBeInTheDocument();
    expect(exiting).toHaveAttribute("inert");
    fireEvent.click(trigger("当前持仓市值"));
    act(() => vi.advanceTimersByTime(160));
    const detail = screen.getByRole("dialog", { name: "当前持仓市值 · 口径详情" });
    expect(detail).toHaveFocus();
    expect(detail).not.toHaveAttribute("inert");
    expect(detail).toHaveTextContent("260102.123400 CNY");
    expect(trigger("当前持仓市值")).toHaveAttribute("aria-expanded", "true");
  });

  it("M17 reduced motion closes directly to the terminal state without a lingering exit", async () => {
    const query: MediaQueryList = { matches: true, media: "(prefers-reduced-motion: reduce)", onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
    vi.stubGlobal("matchMedia", () => query);
    const user = userEvent.setup();
    render(<MetricCards view={periodView(bundle(), "CNY")} status={ready} />);
    const opener = trigger("期间已实现");
    await user.click(opener);
    const detail = screen.getByRole("dialog");
    await user.keyboard("{Escape}");
    expect(detail).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "false");
  });
});

// Literal committed view: no producer calls or invented all-history boundary.
function periodView(series: HomepageV25SeriesBundle = bundle(), reportCurrency: HomepagePeriodView["stamp"]["reportCurrency"] = "CNY"): HomepagePeriodView {
  return { stamp: { sourceId: series.sourceId, requestGeneration: series.requestGeneration,
    selectionKey: "selection-accounts-1", asOf: series.current.asOf, reportCurrency,
    revisions: series.revisions, policies: series.policies },
  range: { preset: "custom", from: series.boundary.periodStart, to: series.boundary.requestedEnd },
  bounds: { state: "known", start: series.boundary.periodStart, end: series.boundary.requestedEnd, reasons: [] },
  series, current: series.current, reasons: [] };
}
function unknownInception(): HomepagePeriodView {
  return { ...periodView(), range: { preset: "all", from: null, to: null },
    bounds: { state: "unknown", start: null, end: null, reasons: ["全部期间起点缺少证据"] },
    series: null, reasons: ["全部期间起点缺少证据"] };
}
const periodLabels = ["期间净盈亏", "期间已实现", "期间浮盈变动"];

describe("committed PeriodView current and identity", () => {
  it("C01 null series with unknown inception preserves current precision, coverage and its own clock", async () => {
    const user = userEvent.setup(); const source = unknownInception();
    const data = frozen({ ...source, current: { ...source.current,
      currentMarketValue: money("260102.123400", { coverage: { total: 9, available: 8 }, money: {
        targetCurrency: "CNY", originalByCurrency: { USD: "12345.678900", HKD: "999.001200" }, conversion: "complete",
        fx: { id: "fx-current", source: "当前权威汇率", asOf: "2026-10-23", status: "complete" } } }),
      quoteCoverage: { "asset-1": { state: "complete" as const, requiredCompletedSession: "2026-10-22", selectedDate: "2026-10-22", missingSessions: [], reasons: ["当前行情证据"] } },
      fxCoverage: { ...source.current.fxCoverage, reasons: ["当前换汇证据"] } } });
    render(<MetricCards view={data} status={ready} />);
    for (const name of periodLabels) expect(value(name)).toHaveTextContent(/^—$/);
    expect(value("当前持仓市值")).toHaveTextContent("26.01 万");
    expect(value("当前持仓市值")).toHaveAttribute("data-tone", "neutral");
    await user.click(trigger("当前持仓市值"));
    const detail = screen.getByRole("dialog");
    for (const text of ["260102.123400 CNY", "23153.2500 CNY", "8 / 9", "12345.678900 USD", "999.001200 HKD", "当前权威汇率", "fx-current", "2026-10-23T08:00:00Z", "当前行情证据", "当前换汇证据"]) expect(detail).toHaveTextContent(text);
    expect(detail).not.toHaveTextContent("全部期间起点缺少证据");
    await user.keyboard("{Escape}"); await user.click(trigger("期间净盈亏"));
    expect(screen.getByRole("dialog")).toHaveTextContent("全部期间起点缺少证据");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("2026-10-01");
  });

  it.each(["empty", "pending", "error"] as const)("C02 %s feedback cannot erase known current when series is null", async kind => {
    const user = userEvent.setup(); const data = frozen(unknownInception());
    render(<MetricCards view={data} status={{ kind, reason: "期间边界尚不可用，保留已提交快照" }} />);
    expect(value("当前持仓市值")).toHaveTextContent("26.01 万");
    expect(screen.queryByTestId("hp-metric-skeleton")).not.toBeInTheDocument();
    for (const name of periodLabels) expect(value(name)).toHaveTextContent(/^—$/);
    if (kind === "pending") expect(screen.getAllByText("更新中")).toHaveLength(4);
    await user.click(trigger("当前持仓市值", kind === "error" ? "查看原因" : "口径详情"));
    expect(screen.getByRole("dialog")).toHaveTextContent("260102.123400 CNY");
    expect(screen.getByRole("dialog")).toHaveTextContent("23153.2500 CNY");
  });

  it("C02 empty feedback preserves every known finite amount", () => {
    render(<MetricCards view={periodView()} status={{ kind: "empty", reason: "附属列表为空" }} />);
    expect(value("期间净盈亏")).toHaveTextContent("+1.84 万");
    expect(value("期间已实现")).toHaveTextContent("+1.22 万");
    expect(value("期间浮盈变动")).toHaveTextContent("+6,180.00");
    expect(value("当前持仓市值")).toHaveTextContent("26.01 万");
  });

  it("C03 a complete empty all range retains authoritative current zero", async () => {
    const user = userEvent.setup(); const source = unknownInception();
    const data = frozen({ ...source, bounds: { state: "empty" as const, start: null, end: null, reasons: ["完整空集合"] }, reasons: ["完整空集合"],
      current: { ...source.current, currentMarketValue: money("0"), currentUnrealized: money("0"), currentOpenFees: money("0") } });
    render(<MetricCards view={data} status={{ kind: "empty", reason: "没有历史期间" }} />);
    expect(value("当前持仓市值")).toHaveTextContent(/^0\.00$/);
    expect(value("当前持仓市值")).toHaveAttribute("data-tone", "neutral");
    for (const name of periodLabels) expect(value(name)).toHaveTextContent(/^—$/);
    await user.click(trigger("当前持仓市值")); expect(screen.getByRole("dialog")).toHaveTextContent("0 CNY");
    await user.keyboard("{Escape}"); await user.click(trigger("期间净盈亏"));
    expect(screen.getByRole("dialog")).toHaveTextContent("完整空集合");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("2026-10-01");
  });

  it.each(["all", "finite"] as const)("C03 an unknown universe cannot publish its observed subtotal in the %s range", async range => {
    const user = userEvent.setup(); const source = range === "all" ? unknownInception() : periodView();
    const unknown = money(null, { available: false, coverage: { total: 3, available: 1 }, reasons: ["universe:incomplete"],
      money: { originalByCurrency: { CNY: "42.0000" }, targetCurrency: "CNY", conversion: "same-currency", fx: null } });
    const data = frozen({ ...source, series: null, reasons: ["universe:incomplete"],
      current: { ...source.current, currentMarketValue: unknown, currentUnrealized: unknown, currentOpenFees: unknown } });
    render(<MetricCards view={data} status={ready} />);
    expect(screen.getAllByTestId("hp-metric-value").every(node => node.textContent === "—")).toBe(true);
    expect(trigger("当前持仓市值")).toHaveAccessibleName("当前持仓市值，口径详情，金额未知");
    await user.click(trigger("当前持仓市值"));
    expect(screen.getByRole("dialog")).toHaveTextContent("universe:incomplete");
    expect(screen.getByRole("dialog")).toHaveTextContent("42.0000 CNY");
    expect(screen.getByRole("dialog")).toHaveTextContent("1 / 3");
    expect(within(screen.getByRole("dialog")).getAllByText("完整金额").every(node => node.nextElementSibling?.textContent === "—")).toBe(true);
    await user.keyboard("{Escape}"); await user.click(trigger("期间净盈亏"));
    expect(screen.getByRole("dialog")).toHaveTextContent("universe:incomplete");
    if (range === "finite") expect(screen.getByRole("dialog")).toHaveTextContent("2026-10-01 至 2026-10-02");
  });

  it.each(["future", "source-missing"] as const)("C04 %s period availability remains separate from current", state => {
    const series = bundle();
    const data = periodView({ ...series, summaryState: state, periodSummary: { ...series.periodSummary!, state,
      net: state === "source-missing" ? money(null, { reasons: ["缺少期间行情"] }) : series.periodSummary!.net } });
    render(<MetricCards view={data} status={ready} />);
    expect(value("期间净盈亏")).toHaveTextContent(/^—$/);
    expect(value("期间已实现")).toHaveTextContent(state === "future" ? "—" : "+1.22 万");
    expect(value("当前持仓市值")).toHaveTextContent("26.01 万");
  });

  it("C05 only independent current is readable even when a full structural view has a contradictory series.current", async () => {
    const user = userEvent.setup(); const source = periodView(); const series = bundle();
    const data = { ...source, series: { ...series, current: { ...series.current,
      currentMarketValue: money("999999.0000"), currentUnrealized: money("-888.0000"), asOf: "1999-01-01T00:00:00Z" } } };
    render(<MetricCards view={data} status={ready} />);
    expect(value("当前持仓市值")).toHaveTextContent("26.01 万");
    await user.click(trigger("当前持仓市值"));
    expect(screen.getByRole("dialog")).toHaveTextContent("23153.2500 CNY");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("999999.0000");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("-888.0000");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("1999-01-01");
  });

  const stampFields = ["sourceId", "requestGeneration", "selectionKey", "asOf", "reportCurrency",
    "revisions.trades", "revisions.metadata", "revisions.quotes", "revisions.fx",
    "policies.finance", "policies.feePool", "policies.feeFacts", "policies.calendar", "policies.dailyCoverage", "policies.fx", "policies.quoteKnowledgeMode"];
  it.each(stampFields)("C06 changing stamp %s closes before commit and returning cannot revive or steal focus", field => {
    const data = frozen(unknownInception());
    const show = (view: HomepagePeriodView) => <><button>外部阅读位置</button><MetricCards view={view} status={ready} /></>;
    const mounted = render(show(data)); const opener = trigger("当前持仓市值");
    fireEvent.click(opener); const detail = screen.getByRole("dialog"); expect(detail).toHaveFocus();
    const stamp = structuredClone(data.stamp); const [parent, key] = field.split(".");
    const target = parent === "revisions" ? stamp.revisions : parent === "policies" ? stamp.policies : stamp;
    // Runtime version changes exercise the identity boundary without calling financial code.
    Object.defineProperty(target, key ?? parent, { value: field === "reportCurrency" ? "USD" : field === "asOf" ? "2026-10-24T08:00:00Z" : "different-version" });
    mounted.rerender(show({ ...data, stamp }));
    expect(detail).not.toBeInTheDocument(); expect(opener).toHaveFocus();
    const outside = screen.getByRole("button", { name: "外部阅读位置" }); outside.focus();
    mounted.rerender(show(data));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(outside).toHaveFocus();
    fireEvent.click(opener); expect(screen.getByRole("dialog")).toHaveTextContent("260102.123400 CNY");
  });

  it("C06 equal complete stamps with reversed dictionary key order retain the current detail through pending and error", () => {
    const data = frozen(unknownInception());
    const mounted = render(<MetricCards view={data} status={ready} />);
    fireEvent.click(trigger("当前持仓市值")); const detail = screen.getByRole("dialog");
    const stamp = structuredClone(data.stamp);
    for (const dictionary of [stamp.revisions, stamp.policies]) {
      const entries = Object.entries(dictionary).reverse();
      for (const [key] of entries) Reflect.deleteProperty(dictionary, key);
      for (const [key, value] of entries) Object.defineProperty(dictionary, key, { value, enumerable: true });
    }
    const equal = frozen({ ...data, stamp });
    mounted.rerender(<MetricCards view={equal} status={{ kind: "pending", reason: "新期间尚未提交" }} />);
    expect(screen.getByRole("dialog")).toBe(detail); expect(detail).toHaveFocus();
    expect(value("当前持仓市值")).toHaveTextContent("26.01 万");
    mounted.rerender(<MetricCards view={equal} status={{ kind: "error", reason: "新期间读取失败" }} />);
    expect(screen.getByRole("dialog")).toBe(detail); expect(detail).toHaveFocus();
    expect(detail).toHaveTextContent("260102.123400 CNY");
  });

  it("C06 replacing a committed view with no data closes detail once and a returning view stays closed", () => {
    const data = frozen(unknownInception());
    const mounted = render(<><button>外部阅读位置</button><MetricCards view={data} status={ready} /></>);
    const opener = trigger("当前持仓市值"); fireEvent.click(opener);
    mounted.rerender(<><button>外部阅读位置</button><MetricCards view={null} placeholderCurrency="CNY" status={{ kind: "pending", reason: "首次读取" }} /></>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(opener).toHaveFocus();
    const outside = screen.getByRole("button", { name: "外部阅读位置" }); outside.focus();
    mounted.rerender(<><button>外部阅读位置</button><MetricCards view={data} status={ready} /></>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(outside).toHaveFocus();
  });

  it("C07 currency mismatch does not relabel independent current and frozen input remains unchanged", async () => {
    const user = userEvent.setup(); const source = unknownInception();
    const usd = money("123.4500", { money: { targetCurrency: "USD", originalByCurrency: { USD: "123.4500" }, conversion: "same-currency", fx: null } });
    const data = frozen({ ...source, current: { ...source.current, currentMarketValue: usd, currentUnrealized: usd } });
    const before = JSON.stringify(data);
    render(<MetricCards view={data} status={ready} />);
    expect(value("当前持仓市值")).toHaveTextContent(/^—$/);
    await user.click(trigger("当前持仓市值"));
    expect(screen.getByRole("dialog")).toHaveTextContent("币种与报表不一致");
    expect(screen.getByRole("dialog")).toHaveTextContent("123.4500 USD");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("123.4500 CNY");
    await user.keyboard("{Escape}{Enter}"); expect(JSON.stringify(data)).toBe(before);
  });

  it.each(["pending", "error", "empty"] as const)("C08 initial %s uses only placeholder currency and explains every unavailable card", async kind => {
    const user = userEvent.setup();
    render(<MetricCards view={null} placeholderCurrency="HKD" status={{ kind, reason: "尚无已提交快照" }} />);
    expect(screen.getAllByRole("heading", { level: 3 }).every(node => node.textContent?.endsWith("(HKD)"))).toBe(true);
    if (kind === "pending") expect(screen.getAllByTestId("hp-metric-skeleton")).toHaveLength(4);
    else expect(screen.getAllByTestId("hp-metric-value").every(node => node.textContent === "—")).toBe(true);
    for (const name of [...periodLabels, "当前持仓市值"]) {
      await user.click(trigger(name, kind === "error" ? "查看原因" : "口径详情"));
      expect(screen.getByRole("dialog")).toHaveTextContent("尚无已提交快照");
      expect(screen.getByRole("dialog")).not.toHaveTextContent("0 HKD");
      await user.keyboard("{Escape}");
    }
  });
});
