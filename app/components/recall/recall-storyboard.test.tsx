import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecallDocument, RecallSnapshot } from "../../lib/recall/types";
import { RecallStoryboard } from "./recall-storyboard";

afterEach(cleanup);
const date = "2026-01-01T00:00:00.000Z";
const snapshot: RecallSnapshot = { id: "holding-image", phase: "holding", decisionId: "d", timeframe: "1D", cursor: date, executionCursor: "e", candles: [], drawings: [], imageDataUrl: "data:image/png;base64,AA==", createdAt: date, updatedAt: date };
const document: RecallDocument = { version: 1, episodeId: "e", revision: 1, decisions: [{ id: "d", executionIds: ["e"] }], snapshots: [snapshot], working: { drawings: [], timeframe: "1D", cursor: date, executionCursor: "e", selectedDecisionId: "d" }, status: "in-progress", updatedAt: date };

describe("RecallStoryboard", () => {
  it("shows missing stages, legacy exclusion and emits a persisted retained selection only", () => {
    const onChangeDocument = vi.fn();
    render(<RecallStoryboard document={document} onChangeDocument={onChangeDocument} />);
    expect(screen.getByText("导出不含当前未留存编辑")).toBeInTheDocument();
    expect(screen.getAllByText("该阶段尚无已留存快照")).toHaveLength(2);
    expect(screen.getByText("缺少已留存全局版本组合，汇总不可用")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("持仓过程代表快照"), { target: { value: "holding-image" } });
    expect(onChangeDocument.mock.calls[0][0]).toMatchObject({ storyboard: { holding: { snapshotId: "holding-image" } }, status: "in-progress" });
  });
  it("formal source uses its own retained images and disables selection edits", () => {
    const formalImage = { ...snapshot, id: "formal", imageDataUrl: "data:image/png;base64,AQ==" };
    const withFormal: RecallDocument = { ...document, lastCompleted: { ...document, snapshots: [formalImage], status: "completed", completedAt: date } };
    const onChangeDocument = vi.fn();
    render(<RecallStoryboard document={withFormal} onChangeDocument={onChangeDocument} />);
    fireEvent.click(screen.getByRole("button", { name: "正式版本" }));
    expect(screen.getByAltText("持仓过程已留存原图")).toHaveAttribute("src", formalImage.imageDataUrl);
    expect(screen.getByLabelText("持仓过程代表快照")).toBeDisabled();
    expect(onChangeDocument).not.toHaveBeenCalled();
  });
  it("shows a stale selected reference rather than silently previewing another image", () => {
    render(<RecallStoryboard document={{ ...document, storyboard: { holding: { snapshotId: "deleted" } } }} onChangeDocument={vi.fn()} />);
    expect(screen.getByText("所选快照已删除或被替换，请重新选择")).toBeInTheDocument();
    expect(screen.queryByAltText("持仓过程已留存原图")).not.toBeInTheDocument();
  });
});
