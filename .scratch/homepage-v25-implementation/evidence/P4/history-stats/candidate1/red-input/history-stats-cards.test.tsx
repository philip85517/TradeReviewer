import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistoryStatsCards, type HistoryStatsCardsProps, type HistoryStatsSummary } from "./history-stats-cards";

const ready = { kind: "ready" } as const;
const names = ["已平仓净盈亏", "已平仓回合数", "胜率", "已扣费用"] as const;
function scalar(value: string | null, reasons: readonly string[] = []) {
  return { value, available: value !== null, reasons };
}
function money(value: string | null, reasons: readonly string[] = []): HistoryStatsSummary["closedNet"] {
  return { ...scalar(value, reasons), coverage: { available: value === null ? 0 : 14, total: 14 },
    money: { originalByCurrency: value === null ? {} : { CNY: value }, targetCurrency: "CNY", conversion: "same-currency", fx: null } };
}
function summary(): HistoryStatsSummary {
  return { closedNet: money("30000.123400"), allocatedFees: money("2440.0000"), closedRounds: scalar("14"),
    winningRounds: scalar("9"), winRate: scalar("64.3") };
}
function props(changes: Partial<HistoryStatsCardsProps> = {}): HistoryStatsCardsProps {
  return { summary: summary(), reportCurrency: "CNY", sourceId: "library-1", requestGeneration: "2026-g1", status: ready, ...changes };
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const card = (name: string) => screen.getByRole("article", { name });
const primary = (name: string) => within(card(name)).getByTestId("hp-history-stat-value");
const trigger = (name: string) => within(card(name)).getByRole("button", { name: new RegExp(`^${name}，`) });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("controlled history statistics", () => {
  it("HS01 preserves the four original card order and renders submitted 9/14 and 64.3 independently", () => {
    render(<HistoryStatsCards {...props()} />);
    expect(screen.getAllByRole("article").map(node => node.getAttribute("aria-label"))).toEqual(names);
    expect(primary(names[0])).toHaveTextContent("+3.00 万");
    expect(primary(names[1])).toHaveTextContent(/^14$/);
    expect(primary(names[2])).toHaveTextContent(/^64.3%$/);
    expect(primary(names[3])).toHaveTextContent(/^2,440.00$/);
    expect(within(card(names[2])).getByLabelText("盈利回合 9 / 总回合 14")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/完整性|已完整/)).not.toBeInTheDocument();
  });

  it.each(names)("HS14 %s opens its own read-only explanation and returns focus to the same trigger", async name => {
    const user = userEvent.setup();
    render(<HistoryStatsCards {...props()} />);
    const opener = trigger(name);
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: `${name} · 口径详情` });
    expect(dialog).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getAllByRole("button")).toHaveLength(1);
    await user.click(within(dialog).getByRole("button", { name: "关闭详情" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("HS02–03 displays genuine zero and one hundred percent without deriving either from counts or money", () => {
    const data = summary();
    const view = render(<HistoryStatsCards {...props({ summary: { ...data, closedNet: money("500000"),
      closedRounds: scalar("5"), winningRounds: scalar("0"), winRate: scalar("0") } })} />);
    expect(primary(names[2])).toHaveTextContent(/^0%$/);
    expect(primary(names[1])).toHaveTextContent(/^5$/);
    // A deliberately independently submitted rate must not be recalculated by this presentation leaf.
    view.rerender(<HistoryStatsCards {...props({ summary: { ...data, winningRounds: scalar("0"), winRate: scalar("100") } })} />);
    expect(primary(names[2])).toHaveTextContent(/^100%$/);
    expect(within(card(names[2])).getByLabelText("盈利回合 0 / 总回合 14")).toBeInTheDocument();
  });

  it("HS04 keeps explicit empty zero rounds and unknown rate without inventing net or fees zero", async () => {
    const user = userEvent.setup();
    render(<HistoryStatsCards {...props({ status: { kind: "empty", reason: "暂无已平仓回合" }, summary: {
      closedNet: money(null), allocatedFees: money(null), closedRounds: scalar("0"), winningRounds: scalar("0"), winRate: scalar(null),
    } })} />);
    expect(primary(names[1])).toHaveTextContent(/^0$/);
    for (const name of [names[0], names[2], names[3]]) expect(primary(name)).toHaveTextContent(/^—$/);
    await user.click(trigger(names[2]));
    expect(screen.getByRole("dialog")).toHaveTextContent("暂无已平仓回合");
    expect(screen.queryByRole("button", { name: /重试|修复|导入/ })).not.toBeInTheDocument();
  });

  it("HS04 renders amounts zero only when the complete empty summary explicitly supplies known zero", () => {
    render(<HistoryStatsCards {...props({ status: { kind: "empty", reason: "暂无已平仓回合" }, summary: {
      closedNet: money("0"), allocatedFees: money("0"), closedRounds: scalar("0"), winningRounds: scalar("0"), winRate: scalar(null),
    } })} />);
    expect(primary(names[0])).toHaveTextContent(/^0.00$/);
    expect(primary(names[3])).toHaveTextContent(/^0.00$/);
    expect(primary(names[0])).toHaveAttribute("data-tone", "neutral");
    expect(primary(names[2])).toHaveTextContent(/^—$/);
  });

  it("HS05 unavailable amounts and rate do not erase independently known fourteen closed rounds", async () => {
    const user = userEvent.setup();
    render(<HistoryStatsCards {...props({ summary: { ...summary(), closedNet: money(null, ["缺少历史汇率"]),
      allocatedFees: money(null, ["费用覆盖不完整"]), winRate: scalar(null, ["部分回合净额未知"]) } })} />);
    expect(primary(names[1])).toHaveTextContent(/^14$/);
    expect(primary(names[2])).toHaveTextContent(/^—$/);
    await user.click(trigger(names[0])); expect(screen.getByRole("dialog")).toHaveTextContent("缺少历史汇率");
    await user.click(trigger(names[3])); expect(screen.getByRole("dialog")).toHaveTextContent("费用覆盖不完整");
  });

  it("HS06 unavailable closed count does not erase a separately known rate, winning count or amount", async () => {
    const user = userEvent.setup();
    render(<HistoryStatsCards {...props({ summary: { ...summary(), closedRounds: scalar(null, ["数量来源不足"]) } })} />);
    expect(primary(names[0])).toHaveTextContent("+3.00 万");
    expect(primary(names[1])).toHaveTextContent(/^—$/);
    expect(primary(names[2])).toHaveTextContent(/^64.3%$/);
    expect(within(card(names[2])).getByLabelText("盈利回合 9 / 总回合 未知")).toBeInTheDocument();
    await user.click(trigger(names[1])); expect(screen.getByRole("dialog")).toHaveTextContent("数量来源不足");
  });

  it("HS06 respects available:false even if stale scalar and money strings are present", () => {
    const data = summary();
    render(<HistoryStatsCards {...props({ summary: { ...data, closedNet: { ...data.closedNet, available: false },
      closedRounds: { ...data.closedRounds, available: false }, winRate: { ...data.winRate, available: false } } })} />);
    for (const name of names.slice(0, 3)) expect(primary(name)).toHaveTextContent(/^—$/);
    expect(primary(names[3])).toHaveTextContent("2,440.00");
  });

  it("HS07 first pending has four skeletons, no fabricated zero, and an available explanation", async () => {
    const user = userEvent.setup();
    render(<HistoryStatsCards {...props({ summary: null, status: { kind: "pending", reason: "首次加载历史" } })} />);
    expect(screen.getAllByTestId("hp-history-stat-skeleton")).toHaveLength(4);
    expect(screen.queryByText(/^0(?:\.00|%)?$/)).not.toBeInTheDocument();
    await user.click(trigger(names[1])); expect(screen.getByRole("dialog")).toHaveTextContent("首次加载历史");
  });

  it("HS08–09 pending and failure retain the entire frozen caller summary and expose their reasons", async () => {
    const user = userEvent.setup(); const data = freeze(summary()); const original = JSON.stringify(data);
    const view = render(<HistoryStatsCards {...props({ summary: data, status: { kind: "pending", reason: "更新中，继续显示原范围" } })} />);
    expect(screen.getByRole("status")).toHaveTextContent("更新中，继续显示原范围");
    expect(screen.getAllByText("更新中", { exact: true })).toHaveLength(4);
    expect(primary(names[0])).toHaveTextContent("+3.00 万"); expect(primary(names[1])).toHaveTextContent("14");
    await user.click(trigger(names[0])); expect(screen.getByRole("dialog")).toHaveTextContent("30000.123400 CNY");
    view.rerender(<HistoryStatsCards {...props({ summary: data, status: { kind: "error", reason: "请求失败，保留原范围" } })} />);
    expect(screen.getByRole("status")).toHaveTextContent("请求失败，保留原范围");
    expect(primary(names[3])).toHaveTextContent("2,440.00");
    expect(screen.getByRole("dialog")).toHaveTextContent("请求失败，保留原范围");
    expect(JSON.stringify(data)).toBe(original);
  });

  it("HS10 initial failure shows unknown readouts and reason without synthetic zero or a local previous-summary cache", () => {
    const view = render(<HistoryStatsCards {...props()} />);
    view.rerender(<HistoryStatsCards {...props({ summary: null, status: { kind: "error", reason: "历史数据不可用" } })} />);
    expect(screen.getAllByTestId("hp-history-stat-value").every(node => node.textContent === "—")).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("历史数据不可用");
  });

  it("HS11 preserves unrounded source amounts, huge counts, coverage, currencies and FX provenance in details", async () => {
    const user = userEvent.setup(); const data = summary();
    const amount = "123456789012345678901234567890.12345678901234567890";
    render(<HistoryStatsCards {...props({ summary: { ...data, closedNet: { ...money(amount), coverage: { available: 13, total: 14 },
      reasons: ["调用方已提交完整口径说明"], money: { originalByCurrency: { USD: "9876543210987654321.00000100", HKD: "0.000000009" },
        targetCurrency: "CNY", conversion: "complete", fx: { id: "fx-history-42", source: "historical-official", asOf: "2026-03-12", status: "complete" } } },
      closedRounds: scalar("100000000000000000000000000001"), winningRounds: scalar("99999999999999999999999999999") } })} />);
    await user.click(trigger(names[0])); const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(`${amount} CNY`); expect(dialog).toHaveTextContent("13 / 14");
    expect(dialog).toHaveTextContent("9876543210987654321.00000100 USD"); expect(dialog).toHaveTextContent("0.000000009 HKD");
    expect(dialog).toHaveTextContent("historical-official"); expect(dialog).toHaveTextContent("2026-03-12"); expect(dialog).toHaveTextContent("fx-history-42");
    expect(dialog).toHaveTextContent("调用方已提交完整口径说明");
    await user.click(trigger(names[2]));
    expect(screen.getByRole("dialog")).toHaveTextContent("99999999999999999999999999999");
    expect(screen.getByRole("dialog")).toHaveTextContent("100000000000000000000000000001");
  });

  it.each(["NaN", "Infinity", "not-an-amount"])("HS11 invalid finite amount %s cannot crash or become a visible known number", async invalid => {
    const user = userEvent.setup();
    render(<HistoryStatsCards {...props({ summary: { ...summary(), closedNet: money(invalid) } })} />);
    expect(primary(names[0])).toHaveTextContent(/^—$/); expect(primary(names[1])).toHaveTextContent(/^14$/);
    await user.click(trigger(names[0])); expect(screen.getByRole("dialog")).toHaveTextContent("金额格式无效");
  });

  it("HS11 rejects negative/fractional counts and rate outside 0..100 without changing unrelated evidence", async () => {
    const user = userEvent.setup();
    render(<HistoryStatsCards {...props({ summary: { ...summary(), closedRounds: scalar("-1"), winningRounds: scalar("1.5"), winRate: scalar("100.01") } })} />);
    expect(primary(names[1])).toHaveTextContent(/^—$/); expect(primary(names[2])).toHaveTextContent(/^—$/);
    expect(within(card(names[2])).getByLabelText("盈利回合 未知 / 总回合 未知")).toBeInTheDocument();
    await user.click(trigger(names[2])); expect(screen.getByRole("dialog")).toHaveTextContent("百分比格式无效");
    expect(screen.getByRole("dialog")).toHaveTextContent("回合数格式无效");
  });

  it("HS12 currency mismatch hides only money and preserves exact source currency in its explanation", async () => {
    const user = userEvent.setup();
    render(<HistoryStatsCards {...props({ reportCurrency: "USD" })} />);
    expect(primary(names[0])).toHaveTextContent(/^—$/); expect(primary(names[3])).toHaveTextContent(/^—$/);
    expect(primary(names[1])).toHaveTextContent(/^14$/); expect(primary(names[2])).toHaveTextContent(/^64.3%$/);
    await user.click(trigger(names[0])); const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("币种与报表不一致"); expect(dialog).toHaveTextContent("30000.123400 CNY");
    expect(dialog).not.toHaveTextContent("30000.123400 USD");
  });

  it.each(["sourceId", "requestGeneration", "reportCurrency"] as const)("HS13 %s invalidation never resurrects old detail or steals subsequently external focus", async key => {
    const user = userEvent.setup(); const original = props();
    const view = render(<><button>外部操作</button><HistoryStatsCards {...original} /></>);
    await user.click(trigger(names[2]));
    view.rerender(<><button>外部操作</button><HistoryStatsCards {...original} {...{ [key]: "changed" }} /></>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "外部操作" }));
    view.rerender(<><button>外部操作</button><HistoryStatsCards {...original} /></>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "外部操作" })).toHaveFocus();
    expect(trigger(names[2])).toHaveAttribute("aria-expanded", "false");
  });

  it("HS14 tabs through four triggers, opens with Enter/Space and Escape returns exact focus", async () => {
    const user = userEvent.setup(); render(<HistoryStatsCards {...props()} />);
    for (const [index, name] of names.entries()) {
      await user.tab(); expect(trigger(name)).toHaveFocus();
      await user.keyboard(index % 2 ? " " : "{Enter}");
      expect(screen.getByRole("dialog")).toHaveAccessibleName(`${name} · 口径详情`);
      await user.keyboard("{Escape}"); expect(trigger(name)).toHaveFocus();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  });

  it("HS14 inside clicks and Tab preserve detail; outside click closes and returns its opener", async () => {
    const user = userEvent.setup(); render(<><button>外部操作</button><HistoryStatsCards {...props()} /></>);
    await user.click(trigger(names[0]));
    await user.click(within(screen.getByRole("dialog")).getByText("覆盖数量"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    screen.getByRole("dialog").focus(); await user.tab();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "关闭详情" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "外部操作" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger(names[0])).toHaveFocus();
  });

  it("HS15 replaces all four displayed readings as one group while keeping trigger identity and focus stable", () => {
    const data = summary(); const view = render(<HistoryStatsCards {...props({ summary: data })} />);
    const readings = names.map(primary); const opener = trigger(names[1]); opener.focus();
    view.rerender(<HistoryStatsCards {...props({ summary: { ...data } })} />);
    names.forEach((name, index) => expect(primary(name)).toBe(readings[index]));
    view.rerender(<HistoryStatsCards {...props({ summary: { closedNet: money("-1"), allocatedFees: money("2"),
      closedRounds: scalar("5"), winningRounds: scalar("0"), winRate: scalar("0") }, requestGeneration: "g2" })} />);
    names.forEach((name, index) => expect(primary(name)).not.toBe(readings[index]));
    expect(primary(names[0])).toHaveTextContent(/^-1.00$/); expect(primary(names[1])).toHaveTextContent(/^5$/);
    expect(primary(names[2])).toHaveTextContent(/^0%$/); expect(primary(names[3])).toHaveTextContent(/^2.00$/);
    expect(trigger(names[1])).toBe(opener); expect(opener).toHaveFocus();
  });

  it("HS15 closes access immediately but retains an inert visual exit for exactly 160ms", async () => {
    const user = userEvent.setup(); render(<HistoryStatsCards {...props()} />);
    const opener = trigger(names[0]); await user.click(opener); const detail = screen.getByRole("dialog");
    vi.useFakeTimers(); fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(opener).toHaveFocus();
    expect(detail).toHaveAttribute("aria-hidden", "true"); expect(detail).toHaveAttribute("inert");
    act(() => vi.advanceTimersByTime(159)); expect(detail).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1)); expect(detail).not.toBeInTheDocument();
  });

  it("HS15 reopening during exit cancels the former timer and focuses the newly selected card", async () => {
    const user = userEvent.setup(); render(<HistoryStatsCards {...props()} />);
    await user.click(trigger(names[0])); vi.useFakeTimers(); fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(trigger(names[3])); act(() => vi.advanceTimersByTime(160));
    const dialog = screen.getByRole("dialog", { name: `${names[3]} · 口径详情` });
    expect(dialog).toHaveFocus(); expect(dialog).not.toHaveAttribute("inert"); expect(dialog).toHaveTextContent("2440.0000 CNY");
  });

  it("HS15 reduced motion has no delayed exit and enabling it mid-exit reaches the terminal state", async () => {
    const events = new EventTarget(); let reduced = true;
    const query: MediaQueryList = { get matches() { return reduced; }, media: "(prefers-reduced-motion: reduce)", onchange: null,
      addListener() {}, removeListener() {}, addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events) };
    vi.stubGlobal("matchMedia", () => query);
    const user = userEvent.setup(); render(<HistoryStatsCards {...props()} />);
    await user.click(trigger(names[2])); const first = screen.getByRole("dialog"); await user.keyboard("{Escape}");
    expect(first).not.toBeInTheDocument(); expect(trigger(names[2])).toHaveFocus();
    reduced = false; await user.click(trigger(names[1])); const second = screen.getByRole("dialog");
    await user.keyboard("{Escape}"); expect(second).toBeInTheDocument();
    reduced = true; const event = new Event("change"); Object.defineProperty(event, "matches", { value: true });
    act(() => query.dispatchEvent(event)); expect(second).not.toBeInTheDocument();
    expect(trigger(names[1])).toHaveFocus();
  });
});
