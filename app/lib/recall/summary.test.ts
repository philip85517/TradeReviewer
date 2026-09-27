import { describe, expect, it } from "vitest";
import type { RecallDocument, RecallDrawing, RecallSnapshot } from "./types";
import { summarizeRecallDocument } from "./summary";

function drawing(text: string, id = "note"): RecallDrawing {
  return { version: 2, episodeId: "episode", id, name: "text", tool: "text", anchors: [], style: { color: "#fff", lineWidth: 1, opacity: 1 }, text, zIndex: 0, hidden: false, locked: false, visibleOn: "all", stage: "post-review", createdAtCursor: "2026-09-17" };
}
function snapshot(id: string, date: string, text: string): RecallSnapshot {
  return { id, decisionId: "global", timeframe: "1D", cursor: "2026-09-17", executionCursor: "2026-09-17", candles: [{ time: "2026-09-17", open: 1, high: 2, low: 1, close: 2, volume: 5 }], imageDataUrl: `data:image/png;base64,${"SECRET".repeat(1000)}`, drawings: [drawing(text, id)], createdAt: date, updatedAt: date };
}
function document(status: RecallDocument["status"] = "in-progress"): RecallDocument {
  return { version: 1, episodeId: "episode", revision: 1, decisions: [], snapshots: [], working: { drawings: [], timeframe: "1D", cursor: "2026-09-17", executionCursor: "2026-09-17", selectedDecisionId: null }, status, updatedAt: "2026-09-25T10:00:00Z", ...(status === "completed" ? { completedAt: "2026-09-25T10:00:00Z" } : {}) };
}

describe("recall summary projection", () => {
  it.each(["in-progress", "completed", "needs-confirmation"] as const)("preserves current %s status instead of a previous completed version", status => {
    const current = document(status);
    current.lastCompleted = { ...document("completed"), status: "completed", completedAt: "2026-09-24T10:00:00Z" };
    expect(summarizeRecallDocument(current)).toMatchObject({ episodeId: "episode", status, updatedAt: current.updatedAt, snapshotCount: 0, text: "" });
  });
  it("selects recent persisted text, compresses whitespace and never exposes large snapshot fields", () => {
    const current = document("completed");
    current.snapshots = [snapshot("new", "2026-09-25T09:00:00Z", "新  记录\n继续复盘"), snapshot("old", "2026-09-24T09:00:00Z", "旧记录")];
    const result = summarizeRecallDocument(current);
    expect(result).toEqual({ episodeId: "episode", status: "completed", updatedAt: current.updatedAt, completedAt: current.completedAt, text: "新 记录 继续复盘", snapshotCount: 2 });
    expect(JSON.stringify(result)).not.toMatch(/imageDataUrl|candles|SECRET|drawings|lastCompleted/);
    current.working.drawings = [drawing("更早工作文字"), drawing("当前工作文字", "latest")];
    expect(summarizeRecallDocument(current).text).toBe("当前工作文字");
  });
  it("caps the text excerpt and returns empty text for visual-only snapshots", () => {
    const current = document();
    current.working.drawings = [drawing("a".repeat(1000))];
    expect(summarizeRecallDocument(current).text.length).toBeLessThanOrEqual(160);
    current.working.drawings = [];
    current.snapshots = [{ ...snapshot("image", "2026-09-25", ""), drawings: [] }];
    expect(summarizeRecallDocument(current)).toMatchObject({ text: "", snapshotCount: 1 });
  });
});
