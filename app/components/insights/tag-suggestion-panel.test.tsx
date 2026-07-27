import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TagSuggestionRecord } from "../../lib/insights/types";
import { TagSuggestionPanel } from "./tag-suggestion-panel";

function suggestion(
  rule:
    | "entry-20d-breakout"
    | "first-pullback-after-breakout"
    | "scale-in",
  episodeId: string,
): TagSuggestionRecord {
  const tagId =
    rule === "entry-20d-breakout"
      ? "breakout"
      : rule === "first-pullback-after-breakout"
        ? "pullback"
        : "scale-in";
  return {
    version: 1,
    id: `${episodeId}:${rule}:1`,
    episodeId,
    instrumentId: "US:XPEV",
    tagId,
    finalTagId: null,
    ruleId: rule,
    ruleVersion: 1,
    status: "suggested",
    suggestedAt: "2026-07-27T00:00:00.000Z",
    decidedAt: null,
    evidence:
      rule === "scale-in"
        ? [
            {
              kind: "execution-count",
              observed: "2",
              reference: "1",
            },
          ]
        : [
            {
              kind: "price-comparison",
              tradingDate: "2025-01-21",
              observed: "11",
              reference: "10",
            },
          ],
  };
}

const contexts = {
  "episode-breakout": {
    instrumentId: "US:XPEV",
    instrumentName: "小鹏汽车",
    instrumentSymbol: "XPEV",
    episodeLabel: "第 2 次交易",
    dateRange: "2025/1/21—2025/1/22",
  },
  "episode-scale": {
    instrumentId: "US:XPEV",
    instrumentName: "小鹏汽车",
    instrumentSymbol: "XPEV",
    episodeLabel: "第 1 次交易",
    dateRange: "2025/1/2—2025/1/5",
  },
};

describe("TagSuggestionPanel", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("confirms, rejects, and routes suggestions without network access", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onReject = vi.fn().mockResolvedValue(undefined);
    const onOpenEpisode = vi.fn();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <TagSuggestionPanel
        suggestions={[
          suggestion("entry-20d-breakout", "episode-breakout"),
          suggestion("scale-in", "episode-scale"),
        ]}
        episodeContexts={contexts}
        onConfirm={onConfirm}
        onReject={onReject}
        onOpenEpisode={onOpenEpisode}
      />,
    );

    expect(
      screen.getByText("小鹏汽车（XPEV）· 第 2 次交易"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("入场价 11 高于前 20 日参考高点 10"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "查看小鹏汽车第 2 次交易",
      }),
    );
    expect(onOpenEpisode).toHaveBeenCalledWith(
      "US:XPEV",
      "episode-breakout",
    );

    await user.click(
      screen.getByRole("button", { name: "确认“突破”" }),
    );
    expect(
      screen.queryByRole("button", { name: "确认“突破”" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "否决“分批进入”" }),
    );
    expect(
      screen.queryByRole("button", { name: "否决“分批进入”" }),
    ).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps the suggestion visible and announces a persistence error", async () => {
    const user = userEvent.setup();
    render(
      <TagSuggestionPanel
        suggestions={[
          suggestion("entry-20d-breakout", "episode-breakout"),
        ]}
        episodeContexts={contexts}
        onConfirm={vi.fn().mockRejectedValue(new Error("quota"))}
        onReject={vi.fn()}
        onOpenEpisode={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "确认“突破”" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "建议处理失败，请检查本机存储后重试",
    );
    expect(
      screen.getByRole("button", { name: "确认“突破”" }),
    ).toBeInTheDocument();
  });
});
