import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EpisodeReviewRecord } from "../../lib/reviews/types";
import { EpisodeReviewEditor } from "./episode-review-editor";

function savedRecord(): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId: "episode-1",
    instrumentId: "US:XPEV",
    updatedAt: "2025-02-01T00:00:00.000Z",
    plan: {
      thesis: "等待突破",
      expectedPath: "突破后回踩",
      invalidationCondition: "跌破前低",
      targetRange: "15–18",
      plannedRiskAmount: "100",
      confidence: 4,
    },
    review: {
      decisionQuality: 4,
      executionQuality: 3,
      riskManagement: "按计划退出",
      psychology: "平静",
      reusableRule: "等待确认",
      completed: false,
    },
    confirmedTagIds: ["breakout"],
  };
}

describe("EpisodeReviewEditor", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads the episode record and previews R from user-entered risk", () => {
    render(
      <EpisodeReviewEditor
        episodeId="episode-1"
        instrumentId="US:XPEV"
        netPnl="250"
        record={savedRecord()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("买入理由")).toHaveValue("等待突破");
    expect(screen.getByLabelText("计划风险金额")).toHaveValue("100");
    expect(screen.getByText("2.5R")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "突破" })).toBeChecked();
  });

  it("rejects invalid risk and saves only explicitly selected tags", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(
      <EpisodeReviewEditor
        episodeId="episode-2"
        instrumentId="US:XPEV"
        netPnl="-125"
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText("买入理由"), "  回踩确认  ");
    await user.type(screen.getByLabelText("心理复盘"), "当时有 FOMO");
    await user.type(screen.getByLabelText("计划风险金额"), "-10");
    await user.click(screen.getByRole("checkbox", { name: "回踩" }));
    await user.click(screen.getByRole("button", { name: "保存当前回合复盘" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "计划风险必须大于 0",
    );
    expect(onSave).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("计划风险金额"));
    await user.type(screen.getByLabelText("计划风险金额"), "50");
    await user.click(screen.getByLabelText("标记为已完成复盘"));
    await user.click(screen.getByRole("button", { name: "保存当前回合复盘" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      version: 1,
      episodeId: "episode-2",
      instrumentId: "US:XPEV",
      plan: {
        thesis: "回踩确认",
        plannedRiskAmount: "50",
      },
      review: {
        psychology: "当时有 FOMO",
        completed: true,
      },
      confirmedTagIds: ["pullback"],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts a finite positive Decimal value below JavaScript number range", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <EpisodeReviewEditor
        episodeId="episode-tiny-risk"
        instrumentId="US:XPEV"
        netPnl="1e-400"
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText("计划风险金额"), "1e-400");
    await user.click(screen.getByRole("button", { name: "保存当前回合复盘" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("已保存在本机");
  });

  it("keeps a dirty draft when a persisted record arrives late", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(
      <EpisodeReviewEditor
        episodeId="episode-1"
        instrumentId="US:XPEV"
        netPnl="250"
        onSave={onSave}
      />,
    );
    await user.type(screen.getByLabelText("买入理由"), "我正在输入");

    rerender(
      <EpisodeReviewEditor
        episodeId="episode-1"
        instrumentId="US:XPEV"
        netPnl="250"
        record={savedRecord()}
        onSave={onSave}
      />,
    );

    expect(screen.getByLabelText("买入理由")).toHaveValue("我正在输入");
  });

  it("announces persistence failures and does not claim success", async () => {
    const user = userEvent.setup();
    render(
      <EpisodeReviewEditor
        episodeId="episode-1"
        instrumentId="US:XPEV"
        netPnl="250"
        onSave={vi.fn().mockRejectedValue(new Error("quota exceeded"))}
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存当前回合复盘" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "保存失败，请检查本机存储后重试",
    );
    expect(screen.queryByText("已保存在本机")).not.toBeInTheDocument();
  });
});
