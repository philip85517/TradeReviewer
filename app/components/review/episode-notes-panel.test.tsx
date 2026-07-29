import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EpisodeNotesPanel } from "./episode-notes-panel";

describe("EpisodeNotesPanel", () => {
  it("keeps every plan and review field, tags, completion, and save status editable", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EpisodeNotesPanel
        episodeId="episode-1"
        instrumentId="HK:9868"
        delayMs={0}
        onSave={onSave}
      />,
    );

    for (const label of [
      "买入理由",
      "预期路径",
      "失效条件",
      "目标区间",
      "计划风险金额",
      "信心等级",
      "决策质量",
      "执行质量",
      "风险管理",
      "心理复盘",
      "可复用规则",
      "标记为已完成复盘",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("checkbox", { name: "突破" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("买入理由"), "等待回踩");
    await user.click(screen.getByRole("checkbox", { name: "突破" }));
    await user.click(screen.getByLabelText("标记为已完成复盘"));
    expect(await screen.findByRole("status")).toHaveTextContent("已自动保存");
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({ thesis: "等待回踩" }),
        review: expect.objectContaining({ completed: true }),
        confirmedTagIds: ["breakout"],
      }),
    );
  });
});
