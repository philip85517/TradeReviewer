import { describe, expect, it } from "vitest";
import { deleteRecallSnapshot, mergeRecallDecisions, retainRecallSnapshot, splitRecallDecision, updateRecallSnapshot, validateRecallDocument } from "./document";
import { getRecallStoryboard, selectRecallStageSnapshot, validateRecallStoryboard } from "./storyboard";
import type { RecallDocument, RecallPhase, RecallSnapshot } from "./types";

const date = "2026-01-01T00:00:00.000Z";
function snapshot(id: string, phase?: RecallPhase): RecallSnapshot {
  return { id, phase, decisionId: "decision", timeframe: "1D", cursor: date,
    executionCursor: "execution", candles: [{ time: date, open: 10, high: 11, low: 9, close: 10, volume: 1 }],
    drawings: [], imageDataUrl: "data:image/png;base64,AA==", createdAt: date, updatedAt: date,
    viewport: { version: 1, logicalRange: { from: 0, to: 10 }, barSpacing: 6, rightOffset: 0, width: 600, height: 400 } };
}
function document(snapshots: RecallSnapshot[] = []): RecallDocument {
  return { version: 1, episodeId: "episode", revision: 0,
    decisions: [{ id: "decision", executionIds: ["execution"] }], snapshots,
    working: { timeframe: "1D", cursor: date, executionCursor: "execution", drawings: [], selectedDecisionId: "decision" },
    status: "in-progress", updatedAt: date };
}

describe("retained stage storyboard", () => {
  it("round trips only chosen references without completing or changing retained evidence", () => {
    const original = document([snapshot("pre", "pre-entry"), snapshot("hold", "holding")]);
    const next = selectRecallStageSnapshot(original, "holding", "hold");
    const reopened = JSON.parse(JSON.stringify(next));
    validateRecallDocument(reopened);
    expect(getRecallStoryboard(reopened)[1]).toMatchObject({ snapshot: { id: "hold" }, selection: "explicit" });
    expect(next.status).toBe(original.status);
    expect(next.decisions).toEqual(original.decisions);
    expect(next.snapshots).toEqual(original.snapshots);
    expect(original.storyboard).toBeUndefined();
  });
  it("never infers unknown legacy phases, working edits, or missing global bundles", () => {
    const result = getRecallStoryboard(document([snapshot("legacy")]));
    expect(result.every((stage) => stage.snapshot === null && stage.reasons.includes("missing-phase"))).toBe(true);
    expect(result[2].reasons).toContain("missing-global-bundle");
    expect(() => selectRecallStageSnapshot(document([snapshot("legacy")]), "pre-entry", "legacy")).toThrow();
  });
  it("flags deleted and globally replaced references instead of choosing different evidence", () => {
    const global = { ...snapshot("global", "post-review"), decisionId: "global" };
    const selected = selectRecallStageSnapshot(document([global]), "post-review", "global");
    const deleted = deleteRecallSnapshot(selected, "global");
    expect(getRecallStoryboard(deleted)[2].reasons).toContain("stale-reference");
    const replaced = retainRecallSnapshot(selected, { ...global, id: "new-global" });
    expect(getRecallStoryboard(replaced)[2].snapshot).toBeNull();
    expect(getRecallStoryboard(replaced)[2].reasons).toContain("stale-reference");
  });
  it("flags a selected snapshot whose phase changed and unresolved split/reimport ownership", () => {
    const selected = selectRecallStageSnapshot(document([snapshot("hold", "holding")]), "holding", "hold");
    const changed = updateRecallSnapshot(selected, snapshot("hold", "post-review"));
    expect(changed.storyboard?.holding).toBeUndefined();
    changed.storyboard = { holding: { snapshotId: "hold" } };
    expect(getRecallStoryboard(changed)[1].reasons).toContain("phase-mismatch");
    selected.snapshots[0].decisionId = "unassigned";
    expect(getRecallStoryboard(selected)[1].reasons).toContain("unresolved-owner");
    selected.snapshots[0].decisionId = "removed-decision";
    expect(getRecallStoryboard(selected)[1].reasons).toContain("unresolved-owner");
  });
  it("prefers a comparable holding default and original global final image", () => {
    const pre = snapshot("pre", "pre-entry");
    const different = { ...snapshot("different", "holding"), timeframe: "1W" as const };
    const same = snapshot("same", "holding");
    const global = { ...snapshot("global", "post-review"), decisionId: "global" };
    const result = getRecallStoryboard(document([pre, different, same, snapshot("post", "post-review"), global]));
    expect(result.map((stage) => stage.snapshot?.id)).toEqual(["pre", "same", "global"]);
    expect(result[1].reasons).not.toContain("timeframe-difference");
    expect(result[1].reasons).toContain("price-scale-unverified");
  });
  it("compares stored time origins and viewport; never derives scale from future highs", () => {
    const pre = snapshot("pre", "pre-entry");
    const hold = snapshot("hold", "holding");
    hold.candles[0].time = "2026-01-02T00:00:00.000Z";
    hold.candles[0].high = 100000;
    const source = document([pre, hold]);
    const before = JSON.stringify(source);
    expect(getRecallStoryboard(source)[1].reasons).toContain("time-window-difference");
    expect(JSON.stringify(source)).toBe(before);
    delete hold.viewport;
    expect(getRecallStoryboard(source)[1].reasons).toContain("missing-viewport");
  });
  it("flags a one-sided visible tail while allowing equal empty future space", () => {
    const pre = snapshot("pre", "pre-entry");
    const hold = snapshot("hold", "holding");
    const candle = pre.candles[0];
    pre.candles.push({ ...candle, time: "2026-01-02T00:00:00.000Z" });
    hold.candles = [...pre.candles, { ...candle, time: "2026-01-08T00:00:00.000Z" }];
    pre.viewport!.logicalRange = { from: 0, to: 2 };
    hold.viewport!.logicalRange = { from: 0, to: 2 };
    expect(getRecallStoryboard(document([pre, hold]))[1].reasons).toContain("time-window-difference");
    // The comparison is symmetric: a shorter holding capture is also unverified.
    const reversed = document([{ ...hold, phase: "pre-entry" }, { ...pre, phase: "holding" }]);
    expect(getRecallStoryboard(reversed)[1].reasons).toContain("time-window-difference");
    hold.candles = [...pre.candles];
    expect(getRecallStoryboard(document([pre, hold]))[1].reasons).not.toContain("time-window-difference");
  });
  it("compares canonical output geometry rather than the source sidebar dimensions", () => {
    const pre = snapshot("pre", "pre-entry");
    const hold = snapshot("hold", "holding");
    for (const item of [pre, hold]) Object.assign(item.viewport!, {
      imageFrame: { version: 1, width: 1280, height: 720, pixelRatio: 2 },
      priceRange: { from: 8, to: 14 },
      priceScaleOptions: { mode: 0, invertScale: false, scaleMargins: { top: 0.1, bottom: 0.2 } },
    });
    hold.viewport!.width = 960;
    hold.viewport!.height = 520;
    hold.viewport!.barSpacing = 9;
    const reasons = getRecallStoryboard(document([pre, hold]))[1].reasons;
    expect(reasons).not.toContain("composition-difference");
    expect(reasons).not.toContain("price-scale-unverified");
    expect(reasons).not.toContain("price-scale-difference");
    hold.viewport!.priceRange = { from: 8, to: 18 };
    expect(getRecallStoryboard(document([pre, hold]))[1].reasons).toContain("price-scale-difference");
  });
  it("does not certify missing, malformed, or differently oriented retained price axes", () => {
    const pre = snapshot("pre", "pre-entry");
    const hold = snapshot("hold", "holding");
    const axis = { mode: 0, invertScale: false, scaleMargins: { top: 0.1, bottom: 0.2 } };
    Object.assign(pre.viewport!, { priceRange: { from: 8, to: 14 }, priceScaleOptions: axis });
    Object.assign(hold.viewport!, { priceRange: { from: 8, to: 14 }, priceScaleOptions: { ...axis, invertScale: true } });
    expect(getRecallStoryboard(document([pre, hold]))[1].reasons).toContain("price-scale-difference");
    hold.viewport!.priceRange = { from: 8, to: "14" };
    expect(getRecallStoryboard(document([pre, hold]))[1].reasons).toContain("price-scale-unverified");
    delete pre.viewport!.priceRange;
    hold.viewport!.priceRange = { from: 8, to: 14 };
    expect(getRecallStoryboard(document([pre, hold]))[1].reasons).toContain("price-scale-unverified");
  });
  it("does not use retained tail evidence beyond the visible span to disqualify the window", () => {
    const pre = snapshot("pre", "pre-entry");
    const hold = snapshot("hold", "holding");
    hold.candles.push({ ...hold.candles[0], time: "2026-01-08T00:00:00.000Z" });
    pre.viewport!.logicalRange = { from: 0, to: 0 };
    hold.viewport!.logicalRange = { from: 0, to: 0 };
    expect(getRecallStoryboard(document([pre, hold]))[1].reasons).not.toContain("time-window-difference");
  });
  it("keeps completion and the formal copy untouched when choosing a presentation reference", () => {
    const source = document([snapshot("hold", "holding")]);
    source.status = "completed";
    source.completedAt = date;
    source.lastCompleted = { ...document([snapshot("formal", "holding")]), status: "completed", completedAt: date };
    const next = selectRecallStageSnapshot(source, "holding", "hold");
    expect(next.status).toBe("completed");
    expect(next.completedAt).toBe(date);
    expect(next.lastCompleted).toEqual(source.lastCompleted);
  });
  it("keeps stable snapshot references through merge and flags a subsequent unallocated split", () => {
    const source = document([snapshot("hold", "holding")]);
    source.decisions.push({ id: "second", executionIds: ["second-execution"] });
    const selected = selectRecallStageSnapshot(source, "holding", "hold");
    const merged = mergeRecallDecisions(selected, ["decision", "second"]);
    expect(getRecallStoryboard(merged)[1].snapshot?.id).toBe("hold");
    const split = splitRecallDecision(merged, "decision", [
      { executionIds: ["execution"] }, { id: "split", executionIds: ["second-execution"] },
    ]);
    expect(getRecallStoryboard(split)[1].selectedSnapshotId).toBe("hold");
    expect(getRecallStoryboard(split)[1].reasons).toContain("unresolved-owner");
    expect(split.decisions).toHaveLength(2);
  });
  it("clears an explicit choice to automatic selection and validates malformed references", () => {
    const selected = selectRecallStageSnapshot(document([snapshot("hold", "holding")]), "holding", "hold");
    expect(selectRecallStageSnapshot(selected, "holding", null).storyboard?.holding).toBeUndefined();
    expect(() => validateRecallStoryboard({ holding: { snapshotId: "" } }, [])).toThrow();
    expect(() => validateRecallStoryboard({ mystery: { snapshotId: "a" } }, [])).toThrow();
    expect(() => validateRecallStoryboard({ holding: { snapshotId: "deleted" } }, [])).not.toThrow();
    expect(() => selectRecallStageSnapshot(selected, "pre-entry", "hold")).toThrow();
  });
});
