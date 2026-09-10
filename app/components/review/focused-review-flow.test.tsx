import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyEpisodeReviewRecord } from "../../lib/reviews/review-metrics";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";
import { EpisodeNotesPanel } from "./episode-notes-panel";
import { EpisodeReviewEditor } from "./episode-review-editor";

afterEach(cleanup);

describe("focused review completion", () => {
  it("persists the three answers before advancing and retains the legacy plan", async () => {
    const record = createEmptyEpisodeReviewRecord("focused-complete", "US:TEST");
    record.plan.thesis = "原始计划";
    const saved: EpisodeReviewRecord[] = [];
    const pending = Promise.withResolvers<void>();
    let advanced = false;
    render(<EpisodeNotesPanel episodeId={record.episodeId} instrumentId={record.instrumentId}
      record={record} onSave={async value => { saved.push(value); await pending.promise; }}
      onComplete={() => { advanced = true; }} />);
    fireEvent.change(screen.getByLabelText("关键决策"), { target: { value: "提前离场，缺少确认" } });
    fireEvent.change(screen.getByLabelText("计划符合度"), { target: { value: "deviated" } });
    fireEvent.change(screen.getByLabelText("下次行动"), { target: { value: "退出前先检查失效条件" } });
    fireEvent.click(screen.getByRole("button", { name: "完成并下一回合" }));
    expect(advanced).toBe(false);
    expect(saved.at(-1)).toMatchObject({ plan: { thesis: "原始计划" }, review: {
      completed: true, keyDecision: "提前离场，缺少确认", planAdherence: "deviated", reusableRule: "退出前先检查失效条件",
    } });
    await act(async () => { pending.resolve(); await pending.promise; });
    expect(advanced).toBe(true);
  });

  it("does not mark an empty review complete", async () => {
    const saved: EpisodeReviewRecord[] = [];
    render(<EpisodeNotesPanel episodeId="focused-empty" instrumentId="US:TEST" onSave={async v => { saved.push(v); }} />);
    fireEvent.click(screen.getByRole("button", { name: "完成复盘" }));
    expect(screen.getByRole("alert")).toHaveTextContent("结论");
    expect(saved).toHaveLength(0);
  });

  it("keeps failed completion editable and only advances after a successful retry", async () => {
    let fail = true;
    let advanced = false;
    render(<EpisodeNotesPanel episodeId="focused-failed" instrumentId="US:TEST"
      onSave={async () => { if (fail) throw new Error("offline"); }} onComplete={() => { advanced = true; }} />);
    fireEvent.change(screen.getByLabelText("下次行动"), { target: { value: "保持纪律" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "完成并下一回合" })));
    expect(advanced).toBe(false);
    expect(screen.getByLabelText("下次行动")).toHaveValue("保持纪律");
    expect(screen.getByRole("alert")).toHaveTextContent("保存失败");
    fail = false;
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "完成并下一回合" })));
    expect(advanced).toBe(true);
  });

  it("uses autosave through the library entry too", async () => {
    vi.useFakeTimers();
    const saved: EpisodeReviewRecord[] = [];
    const view = render(<EpisodeReviewEditor episodeId="focused-library" instrumentId="US:TEST" netPnl="10"
      onSave={async value => { saved.push(value); }} />);
    fireEvent.change(screen.getByLabelText("下次行动"), { target: { value: "等待确认" } });
    await act(async () => vi.advanceTimersByTimeAsync(700));
    expect(saved.at(-1)?.review.reusableRule).toBe("等待确认");
    expect(screen.getByRole("status")).toHaveTextContent("已自动保存");
    view.unmount();
    vi.useRealTimers();
  });
});
