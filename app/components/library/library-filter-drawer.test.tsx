import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import type { TradeLibraryBrowseState } from "./library-browse-state";
import { LibraryFilterDrawer } from "./library-filter-drawer";
import {
  buildLibraryFilterOptions,
  normalizeBrokerId,
  type LibraryFilterOptions,
} from "./library-filter-options";

function entry(overrides: Partial<TradeLibraryEntry> = {}): TradeLibraryEntry {
  const instrument = {
    id: "US:ABC",
    market: "US",
    symbol: "ABC",
    name: "Alpha Beta",
    currency: "USD",
  } as TradeLibraryEntry["instrument"];
  const execution = (id: string, accountId: string, platform: string) => ({
    id,
    accountId,
    accountLabel: accountId === "account-a" ? "共享账户" : "其他账户",
    instrument,
    source: { platform, row: 1, tradingDate: "2026-01-02" },
    side: "buy" as const,
    executedAt: "2026-01-02T15:00:00.000Z",
    quantity: "1",
    price: "10",
    fee: "0",
  } as TradeLibraryEntry["executions"][number]);
  const firstExecution = execution("fill-1", "account-a", "futu");
  const secondExecution = execution("fill-2", "account-b", "tradingview");
  const episode = (id: string, fill: TradeLibraryEntry["executions"][number], runId?: string) => ({
    episode: {
      id,
      instrument,
      executions: [fill],
      accountId: fill.accountId,
      accountLabel: fill.accountLabel,
      startedAt: fill.executedAt,
      status: "open" as const,
      direction: "long" as const,
      openingQuantity: "1",
      remainingQuantity: "1",
      tradeNature: runId ? "simulation" as const : "live" as const,
      ...(runId ? { simulationRunId: runId } : {}),
    },
    metrics: {} as TradeLibraryEntry["episodes"][number]["metrics"],
    reviewStatus: "pending" as const,
    confirmedTagIds: [],
    tagDictionaryVersion: 1,
    rMultiple: null,
  } as TradeLibraryEntry["episodes"][number]);
  return {
    groupId: "US:ABC|scope",
    tradeNature: "all" as never,
    instrument,
    executions: [firstExecution, secondExecution],
    episodes: [episode("episode-live", firstExecution), episode("episode-sim", secondExecution, "run-opaque-2026")],
    accountCount: 2,
    tradeCount: 2,
    episodeCount: 2,
    firstTradeAt: firstExecution.executedAt,
    lastTradeAt: secondExecution.executedAt,
    status: "open",
    netPnl: null,
    returnPercent: null,
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
    ...overrides,
  };
}

const baseState: TradeLibraryBrowseState = {
  mode: "stocks",
  selectedInstrumentId: null,
  selectedEpisodeId: null,
  expandedStockIds: [],
  includeReviewedStockIds: [],
  query: "",
  market: "all",
  account: "all",
  accounts: [],
  brokers: [],
  year: "all",
  tradeNature: "simulation",
  simulationRunId: "all",
  reviewStatus: "all",
  sort: "newest",
  positionStatus: "all",
  dataStatus: "all",
  tag: "all",
  advancedExpanded: false,
  scrollTop: 0,
  stockPage: 1,
  roundPage: 1,
};

function entryWithPlatform(platform: string) {
  const base = entry();
  return entry({
    executions: base.executions.map((execution) => ({
      ...execution,
      source: { ...execution.source, platform },
    })),
    episodes: [],
  });
}

afterEach(() => cleanup());

function Harness({
  initial = baseState,
  entries = [entry()],
  options,
  onApplied = vi.fn(),
}: {
  initial?: TradeLibraryBrowseState;
  entries?: TradeLibraryEntry[];
  options?: LibraryFilterOptions;
  onApplied?: (patch: Partial<TradeLibraryBrowseState>) => void;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)}>打开高级筛选</button>
    {open && <LibraryFilterDrawer
      value={initial}
      entries={entries}
      options={options}
      onApply={(patch) => { onApplied(patch); setOpen(false); }}
      onClose={() => setOpen(false)}
    />}
  </>;
}

describe("LibraryFilterDrawer", () => {
  it("stages source/account/year changes until Apply and represents same-dimension OR arrays", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();
    render(<Harness onApplied={onApplied} />);

    const trigger = screen.getByRole("button", { name: "打开高级筛选" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "高级筛选" });
    const sources = within(dialog).getByRole("group", { name: "来源平台选项" });
    await user.click(within(sources).getByRole("checkbox", { name: "TradingView" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "富途" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "共享账户" }));
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "年份" }), "2026");

    expect(onApplied).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "应用筛选" }));

    expect(onApplied).toHaveBeenCalledWith(expect.objectContaining({
      brokers: ["tradingview", "futu"],
      accounts: ["account-a"],
      account: "account-a",
      year: "2026",
    }));
    expect(trigger).toHaveFocus();
  });

  it("normalizes persisted source aliases before applying the canonical filter IDs", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();
    const aliasedEntries = [entry({
      executions: entry().executions.map((execution) => ({
        ...execution,
        source: { ...execution.source, platform: "TradingView" },
      })),
      episodes: [],
    })];
    render(<Harness
      entries={aliasedEntries}
      initial={{ ...baseState, brokers: ["TradingView"] }}
      onApplied={onApplied}
    />);

    await user.click(screen.getByRole("button", { name: "打开高级筛选" }));
    const dialog = screen.getByRole("dialog", { name: "高级筛选" });
    const checkbox = within(dialog).getByRole("checkbox", { name: "TradingView" });
    expect(checkbox).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "应用筛选" }));

    expect(onApplied).toHaveBeenCalledWith(expect.objectContaining({
      brokers: [normalizeBrokerId("TradingView")],
    }));
  });

  it("uses parent options and refreshes them when entries and options change", async () => {
    const user = userEvent.setup();
    const initialEntries = [entry()];
    const nextEntries = [entryWithPlatform("tiger")];
    const view = render(<Harness
      entries={initialEntries}
      options={buildLibraryFilterOptions(initialEntries)}
    />);

    await user.click(screen.getByRole("button", { name: "打开高级筛选" }));
    expect(within(screen.getByRole("dialog", { name: "高级筛选" })).getByRole("checkbox", { name: "富途" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "关闭高级筛选" }));

    view.rerender(<Harness
      entries={nextEntries}
      options={buildLibraryFilterOptions(nextEntries)}
    />);
    await user.click(screen.getByRole("button", { name: "打开高级筛选" }));
    const dialog = screen.getByRole("dialog", { name: "高级筛选" });
    expect(within(dialog).getByRole("checkbox", { name: "Tiger" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox", { name: "富途" })).not.toBeInTheDocument();
  });

  it("refreshes fallback options when entries change while mounted", async () => {
    const user = userEvent.setup();
    const view = render(<Harness entries={[entry()]} />);
    await user.click(screen.getByRole("button", { name: "打开高级筛选" }));
    expect(within(screen.getByRole("dialog", { name: "高级筛选" })).getByRole("checkbox", { name: "富途" })).toBeInTheDocument();

    view.rerender(<Harness entries={[entryWithPlatform("tiger")]} />);
    const dialog = screen.getByRole("dialog", { name: "高级筛选" });
    expect(within(dialog).getByRole("checkbox", { name: "Tiger" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox", { name: "富途" })).not.toBeInTheDocument();
  });

  it("discards draft values on close and starts from the applied state after reopen", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();
    render(<Harness onApplied={onApplied} />);
    const trigger = screen.getByRole("button", { name: "打开高级筛选" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "高级筛选" });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "年份" }), "2026");
    await user.click(within(dialog).getByRole("button", { name: "关闭高级筛选" }));
    expect(onApplied).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    expect(within(screen.getByRole("dialog", { name: "高级筛选" })).getByRole("combobox", { name: "年份" })).toHaveValue("all");
  });

  it("closes on Escape and restores focus through useModalFocus", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "打开高级筛选" });
    await user.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "高级筛选" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows simulation runs only for a compatible simulation scope and keeps stable friendly identity", async () => {
    const user = userEvent.setup();
    const liveState = { ...baseState, tradeNature: "live" as const };
    render(<Harness initial={liveState} />);
    await user.click(screen.getByRole("button", { name: "打开高级筛选" }));
    const liveDialog = screen.getByRole("dialog", { name: "高级筛选" });
    expect(within(liveDialog).queryByRole("combobox", { name: "模拟运行" })).not.toBeInTheDocument();
    await user.click(within(liveDialog).getByRole("button", { name: "关闭高级筛选" }));

    cleanup();
    render(<Harness initial={baseState} />);
    await user.click(screen.getByRole("button", { name: "打开高级筛选" }));
    const simulationDialog = screen.getByRole("dialog", { name: "高级筛选" });
    expect(within(simulationDialog).getByRole("combobox", { name: "模拟运行" })).toBeInTheDocument();
    expect(within(simulationDialog).getByRole("option", { name: /Alpha Beta（ABC）/ })).toBeInTheDocument();
  });
});
