import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReviewSummaryNote } from "../../lib/reviews/review-summary";
import type { ReviewSummaryClient } from "../../lib/storage/review-summary-client";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import { ReviewSummary, initialReviewSummaryFilters, type ReviewSummaryDrafts } from "./review-summary";

afterEach(cleanup);

function entry(): TradeLibraryEntry {
  const instrument = {
    id: "US:AAA",
    symbol: "AAA",
    name: "Alpha",
    market: "US",
    currency: "USD",
  };
  return {
    groupId: "US:AAA|live",
    scopeKey: "live",
    tradeNature: "live",
    instrument,
    executions: [],
    episodes: [
      {
        episode: {
          id: "episode-1",
          accountId: "account-a",
          accountLabel: "主账户",
          instrument,
          tradeNature: "live",
          direction: "long",
          status: "closed",
          startedAt: "2026-09-01T15:00:00.000Z",
          endedAt: "2026-09-02T15:00:00.000Z",
          openingQuantity: "1",
          remainingQuantity: "0",
          executions: [],
        },
        metrics: {
          buyCount: 1,
          sellCount: 1,
          boughtQuantity: "1",
          soldQuantity: "1",
          grossExposure: "100",
          fees: "1",
          realizedPnl: "9",
          unrealizedPnl: "0",
          netPnl: "9",
          returnPercent: "9",
          holdingMilliseconds: 86_400_000,
        },
        reviewStatus: "completed",
        confirmedTagIds: [],
        tagDictionaryVersion: 1,
        rMultiple: null,
      },
    ],
    accountCount: 1,
    tradeCount: 2,
    episodeCount: 1,
    firstTradeAt: "2026-09-01T15:00:00.000Z",
    lastTradeAt: "2026-09-02T15:00:00.000Z",
    status: "closed",
    netPnl: "9",
    returnPercent: "9",
    reviewedEpisodeCount: 1,
    confirmedTagIds: [],
    cumulativeR: null,
  };
}

function note(
  scopeId: string,
  rangeId: string,
  keep: string,
): ReviewSummaryNote {
  return {
    version: 1,
    scopeId,
    rangeId,
    updatedAt: "2026-09-10T00:00:00.000Z",
    keep,
    change: "",
    next: "",
    evidenceEpisodeIds: [],
  };
}

describe("ReviewSummary", () => {
  it("restores each range independently and keeps an unsaved draft when switching back", async () => {
    const user = userEvent.setup();
    const records = new Map<string, ReviewSummaryNote>();
    const client: ReviewSummaryClient = {
      get: vi.fn(async (scopeId, rangeId) => records.get(`${scopeId}|${rangeId}`)),
      put: vi.fn(async (value) => value),
    };
    const entries = [entry()];
    const scopeId = "review-scope:v1:account-a:US:live::USD";
    records.set(`${scopeId}|all`, note(scopeId, "all", "全部范围已保存"));
    records.set(
      `${scopeId}|custom:2026-08-12:2026-09-10`,
      note(scopeId, "custom:2026-08-12:2026-09-10", "近30天已保存"),
    );

    render(
      <ReviewSummary
        entries={entries}
        scopeId={scopeId}
        onScopeChange={vi.fn()}
        client={client}
        onOpenEpisode={vi.fn()}
        today="2026-09-10"
      />,
    );

    expect(await screen.findByDisplayValue("全部范围已保存")).toBeInTheDocument();
    const keep = screen.getByRole("textbox", { name: "保持" });
    await user.clear(keep);
    await user.type(keep, "未保存的全部范围草稿");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "总结日期范围" }),
      "last-30",
    );
    expect(await screen.findByDisplayValue("近30天已保存")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("未保存的全部范围草稿")).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "总结日期范围" }),
      "all",
    );
    expect(await screen.findByDisplayValue("未保存的全部范围草稿")).toBeInTheDocument();
    await waitFor(() => expect(client.get).toHaveBeenCalledTimes(2));
  });

  it("persists the three observations and selected evidence for the exact scope and range", async () => {
    const user = userEvent.setup();
    const client: ReviewSummaryClient = {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn(async (value) => value),
    };
    const scopeId = "review-scope:v1:account-a:US:live::USD";
    render(
      <ReviewSummary
        entries={[entry()]}
        scopeId={scopeId}
        onScopeChange={vi.fn()}
        client={client}
        onOpenEpisode={vi.fn()}
        today="2026-09-10"
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "保持" }), "耐心");
    await user.type(screen.getByRole("textbox", { name: "修正" }), "追价");
    await user.type(screen.getByRole("textbox", { name: "下期重点" }), "确认");
    await user.click(
      screen.getByRole("checkbox", { name: "作为总结证据 episode-1" }),
    );
    await user.click(screen.getByRole("button", { name: "保存阶段总结" }));

    await waitFor(() => expect(client.put).toHaveBeenCalledTimes(1));
    expect(client.put).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        scopeId,
        rangeId: "all",
        keep: "耐心",
        change: "追价",
        next: "确认",
        evidenceEpisodeIds: ["episode-1"],
      }),
    );
  });
  it("requires a successful read before editing or saving, and supports retry", async () => {
    const user = userEvent.setup();
    const client = { get: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined), put: vi.fn(async (value: ReviewSummaryNote) => value) };
    render(<ReviewSummary entries={[entry()]} scopeId="review-scope:v1:account-a:US:live::USD" onScopeChange={vi.fn()} client={client} onOpenEpisode={vi.fn()} />);
    expect(await screen.findByText("阶段总结读取失败，可稍后重试")).toBeInTheDocument();
    expect(screen.getByLabelText("保持")).toBeDisabled();
    expect(screen.getByRole("button", {name:"保存阶段总结"})).toBeDisabled();
    await user.click(screen.getByRole("button", {name:"重试读取阶段总结"}));
    await waitFor(() => expect(screen.getByLabelText("保持")).toBeEnabled());
  });

  it("freezes the saved scope and draft until its write finishes", async () => {
    const user = userEvent.setup();
    let finish!: (value: ReviewSummaryNote) => void;
    const client = { get: vi.fn().mockResolvedValue(undefined), put: vi.fn(() => new Promise<ReviewSummaryNote>(resolve => { finish = resolve; })) };
    const scopeId="review-scope:v1:account-a:US:live::USD";
    render(<ReviewSummary entries={[entry()]} scopeId={scopeId} onScopeChange={vi.fn()} client={client} onOpenEpisode={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("保持")).toBeEnabled());
    await user.type(screen.getByLabelText("保持"), "saved text");
    await user.click(screen.getByRole("button", {name:"保存阶段总结"}));
    expect(screen.getByLabelText("保持")).toBeDisabled();
    expect(screen.getByLabelText("总结日期范围")).toBeDisabled();
    expect(screen.getByLabelText("总结统计范围")).toBeDisabled();
    await act(async () => finish(note(scopeId, "all", "saved text")));
    expect(screen.getByLabelText("保持")).toHaveValue("saved text");
    expect(screen.getByLabelText("保持")).toBeEnabled();
  });

  it("keeps unsaved observations across evidence navigation and summary remount", async () => {
    const user=userEvent.setup();
    const client={get:vi.fn().mockResolvedValue(undefined),put:vi.fn(async(value:ReviewSummaryNote)=>value)};
    function Host() {
      const [drafts,setDrafts]=useState<ReviewSummaryDrafts>({});
      const [filters,setFilters]=useState(() => initialReviewSummaryFilters("2026-09-10"));
      const [show,setShow]=useState(true);
      return <><button onClick={()=>setShow(value=>!value)}>返回总结</button>{show && <ReviewSummary today="2026-09-10" filterStore={{filters,setFilters}} entries={[entry()]} scopeId="review-scope:v1:account-a:US:live::USD" draftStore={{drafts,setDrafts}} onScopeChange={vi.fn()} client={client} onOpenEpisode={()=>setShow(false)} />}</>;
    }
    render(<Host/>);
    await waitFor(()=>expect(screen.getByLabelText("保持")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("总结日期范围"), "custom");
    await user.clear(screen.getByLabelText("开始日期"));
    await user.type(screen.getByLabelText("开始日期"), "2026-09-01");
    await waitFor(()=>expect(screen.getByLabelText("保持")).toBeEnabled());
    await user.type(screen.getByLabelText("保持"),"离开后保留草稿");
    await user.click(screen.getByText("总结证据（0）"));
    await user.click(screen.getByRole("button",{name:"查看回合"}));
    expect(screen.queryByLabelText("保持")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"返回总结"}));
    expect(screen.getByLabelText("保持")).toHaveValue("离开后保留草稿");
    expect(screen.getByLabelText("总结日期范围")).toHaveValue("custom");
    expect(screen.getByLabelText("开始日期")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("结束日期")).toHaveValue("2026-09-10");
  });

  it("does not overwrite a remounted draft when an earlier save resolves", async () => {
    const user = userEvent.setup();
    let finish!: (value: ReviewSummaryNote) => void;
    let sent!: ReviewSummaryNote;
    const client = {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn((value: ReviewSummaryNote) => {
        sent = value;
        return new Promise<ReviewSummaryNote>(resolve => { finish = resolve; });
      }),
    };
    function Host() {
      const [drafts, setDrafts] = useState<ReviewSummaryDrafts>({});
      const [show, setShow] = useState(true);
      return <><button onClick={() => setShow(value => !value)}>切换页面</button>{show && <ReviewSummary entries={[entry()]} scopeId="review-scope:v1:account-a:US:live::USD" draftStore={{drafts, setDrafts}} onScopeChange={vi.fn()} client={client} onOpenEpisode={vi.fn()} />}</>;
    }
    render(<Host />);
    await waitFor(() => expect(screen.getByLabelText("保持")).toBeEnabled());
    await user.type(screen.getByLabelText("保持"), "第一版");
    await user.click(screen.getByRole("button", {name: "保存阶段总结"}));
    await user.click(screen.getByRole("button", {name: "切换页面"}));
    await user.click(screen.getByRole("button", {name: "切换页面"}));
    await user.type(screen.getByLabelText("保持"), "，返回后新增");
    await act(async () => finish(sent));
    expect(screen.getByLabelText("保持")).toHaveValue("第一版，返回后新增");
    expect(client.put).toHaveBeenCalledTimes(1);
  });

});
