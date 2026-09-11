import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EpisodeNotesPanel } from "./episode-notes-panel";

describe("EpisodeNotesPanel", () => {
  afterEach(cleanup);

  it("blocks suggestion decisions until the current draft has saved", async () => {
    const user = userEvent.setup();
    const decide = vi.fn();
    render(<EpisodeNotesPanel episodeId="suggestion-draft" instrumentId="US:A" delayMs={60000} onSave={vi.fn().mockResolvedValue(undefined)} suggestions={<button type="button" onClick={decide}>确认建议</button>} />);
    await user.type(screen.getByLabelText("关键决策"), "draft");
    expect(screen.getByRole("button", { name: "确认建议" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "确认建议" }));
    expect(decide).not.toHaveBeenCalled();
  });

  it("lets the user expand the summary without hiding or losing the plan draft", async () => {
    const user = userEvent.setup();
    render(<EpisodeNotesPanel episodeId="stage-1" instrumentId="HK:9868" onSave={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByLabelText("关键决策")).toBeVisible();
    await user.click(screen.getByText("补充分析 · 原始计划、风险与标签"));
    expect(screen.getByLabelText("买入理由")).toBeVisible();
    expect(screen.getByLabelText("风险管理")).not.toBeVisible();
    await user.type(screen.getByLabelText("买入理由"), "等待确认");
    await user.click(screen.getByText("事后总结", { selector: "summary" }));
    await user.type(screen.getByRole("textbox", { name: "风险管理" }), "控制风险");
    expect(screen.getByRole("textbox", { name: "风险管理" })).toBeVisible();
    expect(screen.getByLabelText("风险管理")).toBeVisible();
    expect(screen.getByLabelText("买入理由")).toHaveValue("等待确认");
  });

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
      "下次行动",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    await user.click(screen.getByText("补充分析 · 原始计划、风险与标签"));
    expect(screen.getByRole("checkbox", { name: "突破" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("买入理由"), "等待回踩");
    await user.click(screen.getByRole("checkbox", { name: "突破" }));
    await user.type(screen.getByLabelText("下次行动"), "等待回踩确认");
    await user.click(screen.getByRole("button", {name:"完成复盘"}));
    expect(await screen.findByRole("status")).toHaveTextContent("已自动保存");
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({ thesis: "等待回踩" }),
        review: expect.objectContaining({ completed: true }),
        confirmedTagIds: ["breakout"],
      }),
    );
  });

  it("announces a dirty draft while it waits for autosave", async () => {
    const user = userEvent.setup();
    render(
      <EpisodeNotesPanel
        episodeId="episode-1"
        instrumentId="HK:9868"
        delayMs={600}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await user.type(screen.getByLabelText("关键决策"), "等待回踩");

    expect(screen.getByRole("status")).toHaveTextContent("等待自动保存");
  });
});
