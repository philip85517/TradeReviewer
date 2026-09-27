import { describe, expect, it } from "vitest";

import type { TradeEpisode, TradeExecution } from "../trades/types";
import {
  cloneRecallDocument,
  completeRecallDocument,
  createRecallDocument,
  deleteRecallSnapshot,
  mergeRecallDecisions,
  missingDecisionIds,
  reconcileRecallDocument,
  retainRecallSnapshot,
  reorderRecallSnapshots,
  resolveRecallReconciliation,
  resolveRecallPhaseContext,
  splitRecallDecision,
  updateRecallSnapshot,
  validateRecallDocument,
} from "./document";
import type { RecallDocument, RecallSnapshot } from "./types";

function execution(id: string, executedAt: string): TradeExecution {
  return {
    id,
    source: { platform: "test", row: 0 },
    accountId: "account",
    accountLabel: "Test",
    instrument: {
      id: "US:TEST",
      symbol: "TEST",
      name: "Test",
      market: "US",
      currency: "USD",
    },
    side: "buy",
    executedAt,
    quantity: "1",
    price: "10",
    fee: "0",
  };
}

function episode(executions: TradeExecution[], status: TradeEpisode["status"] = "closed"): TradeEpisode {
  return {
    id: "episode",
    accountId: "account",
    accountLabel: "Test",
    instrument: executions[0].instrument,
    direction: "long",
    status,
    startedAt: executions[0].executedAt,
    endedAt: status === "closed" ? executions.at(-1)?.executedAt : undefined,
    openingQuantity: "1",
    remainingQuantity: status === "closed" ? "0" : "1",
    executions,
  };
}

function drawing(id: string) {
  return {
    version: 2 as const,
    episodeId: "episode",
    id,
    name: "text",
    tool: "text" as const,
    anchors: [{ time: "2026-01-01T00:00:00.000Z", price: 10 }],
    style: { color: "#fff", lineWidth: 1, opacity: 1 },
    text: `note-${id}`,
    zIndex: 0,
    hidden: false,
    locked: false,
    visibleOn: "all" as const,
    stage: "during-replay" as const,
    createdAtCursor: "2026-01-01T00:00:00.000Z",
    rawExtension: { keep: true },
  };
}

function snapshot(id: string, decisionId: RecallSnapshot["decisionId"]): RecallSnapshot {
  return {
    id,
    decisionId,
    timeframe: "1D",
    cursor: "2026-01-01T00:00:00.000Z",
    executionCursor: "2026-01-01T00:00:00.000Z",
    candles: [{ time: "2026-01-01T00:00:00.000Z", open: 10, high: 12, low: 9, close: 11, volume: 100 }],
    drawings: [drawing(id)],
    viewport: { version: 1, logicalRange: null, barSpacing: 8, rightOffset: 4, width: 800, height: 400 },
    imageDataUrl: "data:image/png;base64,AAAA",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("Recall document domain", () => {
  it("creates one explicit decision per execution without guessing groups", () => {
    const tradeEpisode = episode([
      execution("buy-1", "2026-01-01T00:00:00.000Z"),
      execution("buy-2", "2026-01-02T00:00:00.000Z"),
    ]);
    const document = createRecallDocument(tradeEpisode, "2026-01-03T00:00:00.000Z");
    expect(document.decisions).toEqual([
      { id: "buy-1", executionIds: ["buy-1"] },
      { id: "buy-2", executionIds: ["buy-2"] },
    ]);
    expect(document.working.selectedDecisionId).toBe("buy-1");
  });

  it("starts the execution cursor at the first stable execution id", () => {
    const tradeEpisode = episode([
      execution("same-day-first", "2026-01-01T00:00:00.000Z"),
      execution("same-day-second", "2026-01-01T00:00:00.000Z"),
    ]);

    const document = createRecallDocument(tradeEpisode, "2026-01-03T00:00:00.000Z");

    expect(document.working.cursor).toBe("2026-01-01T00:00:00.000Z");
    expect(document.working.executionCursor).toBe("same-day-first");
  });

  it("reconciles added and removed executions while preserving decision ids", () => {
    const original = episode([
      execution("one", "2026-01-01T00:00:00.000Z"),
      execution("two", "2026-01-02T00:00:00.000Z"),
    ], "open");
    const document = createRecallDocument(original, "2026-01-03T00:00:00.000Z");
    const result = reconcileRecallDocument(
      document,
      episode([
        execution("one", "2026-01-01T00:00:00.000Z"),
        execution("three", "2026-01-03T00:00:00.000Z"),
      ], "open"),
    );
    expect(result.addedExecutionIds).toEqual(["three"]);
    expect(result.removedExecutionIds).toEqual(["two"]);
    expect(result.document.decisions[0].id).toBe("one");
    expect(result.document.status).toBe("needs-confirmation");
    expect(document.decisions[1].executionIds).toEqual(["two"]);
  });

  it("keeps retained snapshots independent and requires explicit split assignment", () => {
    const tradeEpisode = episode([
      execution("one", "2026-01-01T00:00:00.000Z"),
      execution("two", "2026-01-02T00:00:00.000Z"),
    ]);
    let document = createRecallDocument(tradeEpisode, "2026-01-03T00:00:00.000Z");
    document = mergeRecallDecisions(document, ["one", "two"]);
    document = retainRecallSnapshot(document, snapshot("stage", "one"));
    const split = splitRecallDecision(document, "one", [
      { executionIds: ["one"], id: "one", snapshotIds: [] },
      { executionIds: ["two"], id: "two" },
    ]);
    expect(split.snapshots[0].decisionId).toBe("unassigned");
    expect(() => completeRecallDocument(split, tradeEpisode, "2026-01-04T00:00:00.000Z")).toThrow(/missing retained snapshot|unassigned/);
    const assigned = updateRecallSnapshot(split, snapshot("stage", "two"));
    expect(assigned.snapshots[0].decisionId).toBe("two");
    expect(missingDecisionIds(assigned)).toEqual(["one"]);
  });

  it("supports independent snapshot ordering, updates, deletion, and completion checks", () => {
    const tradeEpisode = episode([execution("one", "2026-01-01T00:00:00.000Z")]);
    let document = createRecallDocument(tradeEpisode, "2026-01-03T00:00:00.000Z");
    document = retainRecallSnapshot(document, snapshot("first", "one"));
    document = retainRecallSnapshot(document, snapshot("global", "global"));
    document = reorderRecallSnapshots(document, ["global", "first"]);
    const changed = { ...snapshot("first", "one"), drawings: [{ ...drawing("changed"), rawExtension: { keep: "independent" } }] };
    document = updateRecallSnapshot(document, changed);
    expect(document.snapshots.find((item) => item.id === "global")?.decisionId).toBe("global");
    expect(document.snapshots.find((item) => item.id === "first")?.drawings[0]).toMatchObject({ rawExtension: { keep: "independent" } });
    document = deleteRecallSnapshot(document, "global");
    expect(document.snapshots.map((item) => item.id)).toEqual(["first"]);
    document = retainRecallSnapshot(document, snapshot("global-restored", "global"));
    const completed = completeRecallDocument(document, tradeEpisode, "2026-01-04T00:00:00.000Z");
    expect(completed.status).toBe("completed");
    expect(completed.lastCompleted?.status).toBe("completed");
  });

  it("remaps an active working decision context when decisions merge", () => {
    const tradeEpisode = episode([
      execution("one", "2026-01-01T00:00:00.000Z"),
      execution("two", "2026-01-02T00:00:00.000Z"),
    ]);
    const source = createRecallDocument(tradeEpisode, "2026-01-03T00:00:00.000Z");
    const withContext: RecallDocument = {
      ...source,
      working: {
        ...source.working,
        selectedDecisionId: "two",
        editingContext: {
          mode: "decision",
          decisionId: "two",
          drawings: [{ ...drawing("context"), recallOwnerId: "two" }],
          timeframe: "1D",
          cursor: "2026-01-02T00:00:00.000Z",
          executionCursor: "two",
        },
        decisionDrafts: [{
          mode: "decision",
          decisionId: "two",
          drawings: [{ ...drawing("draft-context"), recallOwnerId: "two" }],
          timeframe: "1D",
          cursor: "2026-01-02T00:00:00.000Z",
          executionCursor: "two",
        }],
      },
    };

    const merged = mergeRecallDecisions(withContext, ["one", "two"], "one");

    expect(merged.working.selectedDecisionId).toBe("one");
    expect(merged.working.editingContext?.decisionId).toBe("one");
    expect(merged.working.editingContext?.drawings[0]?.recallOwnerId).toBe("one");
    expect(merged.working.decisionDrafts?.[0]?.decisionId).toBe("one");
    expect(merged.working.decisionDrafts?.[0]?.drawings[0]?.recallOwnerId).toBe("one");
  });

  it("rejects completion for an open episode or a missing decision snapshot", () => {
    const open = episode([execution("one", "2026-01-01T00:00:00.000Z")], "open");
    const document = createRecallDocument(open, "2026-01-03T00:00:00.000Z");
    expect(() => completeRecallDocument(document, open)).toThrow(/closed/);
    const closed = episode(open.executions);
    expect(() => completeRecallDocument(document, closed)).toThrow(/missing retained snapshot/);
  });

  it("keeps reconciliation stale across refresh and exposes explicit resolution", () => {
    const original = episode([
      execution("one", "2026-01-01T00:00:00.000Z"),
      execution("two", "2026-01-02T00:00:00.000Z"),
    ]);
    let document = createRecallDocument(original, "2026-01-03T00:00:00.000Z");
    document = retainRecallSnapshot(document, snapshot("one-snapshot", "one"));
    document = retainRecallSnapshot(document, snapshot("two-snapshot", "two"));
    document = retainRecallSnapshot(document, snapshot("global", "global"));
    const refreshed = episode([execution("one", "2026-01-01T00:00:00.000Z")]);
    const first = reconcileRecallDocument(document, refreshed).document;
    const second = reconcileRecallDocument(first, refreshed).document;
    expect(second.reconciliation).toMatchObject({ stale: true, removedExecutionIds: ["two"] });
    expect(second.decisions.filter((decision) => decision.id === "two")).toHaveLength(1);
    const cleaned = deleteRecallSnapshot(second, "two-snapshot");
    const withOrphanedDraft: RecallDocument = {
      ...cleaned,
      working: {
        ...cleaned.working,
        selectedDecisionId: "two",
        editingContext: {
          mode: "decision",
          decisionId: "two",
          drawings: [drawing("orphaned-context")],
          timeframe: "1D",
          cursor: "2026-01-02T00:00:00.000Z",
          executionCursor: "two",
        },
        decisionDrafts: [{
          mode: "decision",
          decisionId: "two",
          drawings: [drawing("orphaned-draft")],
          timeframe: "1D",
          cursor: "2026-01-02T00:00:00.000Z",
          executionCursor: "two",
        }],
      },
    };
    const resolved = resolveRecallReconciliation(withOrphanedDraft, {
      removedExecutionIds: ["two"],
      decisionIdsToRemove: ["two"],
    });
    expect(resolved.reconciliation).toMatchObject({ stale: false, removedExecutionIds: [] });
    expect(resolved.working.selectedDecisionId).toBe("one");
    expect(resolved.working.editingContext).toBeUndefined();
    expect(resolved.working.decisionDrafts).toEqual([]);
    validateRecallDocument(resolved);
    expect(completeRecallDocument(resolved, refreshed, "2026-01-04T00:00:00.000Z").status).toBe("completed");
  });
});

describe("phase metadata", () => {
  function phasedDocument() {
    const document = createRecallDocument(episode([
      execution("one", "2026-01-01"), execution("two", "2026-01-02"),
    ]));
    document.working.phase = "holding";
    document.working.hasSeenFuture = true;
    document.working.phaseContexts = { holding: {
      mode: "decision", decisionId: "two", timeframe: "1D", cursor: "2026-01-02",
      viewport: { version: 1, logicalRange: { from: 1, to: 8 }, barSpacing: 8, rightOffset: 4, width: 800, height: 400 },
      executionCursor: "two", drawings: [{ ...drawing("note"), recallOwnerId: "two", recallHasSeenFuture: true }],
    } };
    return document;
  }

  it.each([
    { phase: "future" }, { hasSeenFuture: "yes" },
    { phaseContexts: { invalid: {} } },
    { phaseContexts: { holding: { mode: "decision", decisionId: "missing", drawings: [], timeframe: "1D", cursor: "day", executionCursor: "fill" } } },
  ])("rejects malformed phase metadata %j", (metadata) => {
    const document = phasedDocument();
    Object.assign(document.working, metadata);
    expect(() => validateRecallDocument(document)).toThrow();
  });

  it("validates snapshot and drawing future evidence without fabricating legacy evidence", () => {
    const document = phasedDocument();
    const retained = retainRecallSnapshot(document, { ...snapshot("phase", "two"), phase: "holding", hasSeenFuture: false });
    document.working.phaseContexts!.holding!.drawings[0].text = "changed";
    expect(retained.working.phaseContexts!.holding!.drawings[0].text).toBe("note-note");
    document.working.phaseContexts!.holding!.viewport!.logicalRange!.from = 99;
    expect(retained.working.phaseContexts!.holding!.viewport!.logicalRange!.from).toBe(1);
    expect(retained.snapshots[0].hasSeenFuture).toBe(false);
    Object.assign(retained.snapshots[0], { phase: "invalid" });
    expect(() => validateRecallDocument(retained)).toThrow();
    const legacy = createRecallDocument(episode([execution("one", "2026-01-01")]));
    expect(legacy.working).not.toHaveProperty("phase");
    Object.assign(legacy.working, { drawings: [{ ...drawing("bad"), recallHasSeenFuture: "yes" }] });
    expect(() => validateRecallDocument(legacy)).toThrow();
  });

  it("remaps phase contexts on merge and split using the execution boundary without mutation", () => {
    const original = phasedDocument();
    const merged = mergeRecallDecisions(original, ["one", "two"]);
    expect(merged.working.phaseContexts!.holding!.decisionId).toBe("one");
    expect(merged.working.phaseContexts!.holding!.drawings[0].recallOwnerId).toBe("one");
    expect(original.working.phaseContexts!.holding!.decisionId).toBe("two");
    const split = splitRecallDecision(merged, "one", [{ executionIds: ["one"] }, { id: "second", executionIds: ["two"] }]);
    expect(split.working.phaseContexts!.holding!.decisionId).toBe("second");
    expect(split.working.phaseContexts!.holding!.drawings[0].recallOwnerId).toBe("second");
    expect(split.working.hasSeenFuture).toBe(true);
    expect(() => validateRecallDocument(split)).not.toThrow();
    merged.working.phaseContexts!.holding!.executionCursor = "legacy-date";
    expect(splitRecallDecision(merged, "one", [{ executionIds: ["one"] }, { id: "second", executionIds: ["two"] }]).status).toBe("needs-confirmation");
  });

  it.each(["invalid", "2026-02-30T00:00:00Z", "2026-01-03T00:00:00Z", 123])("rejects invalid or future revealed candle boundary %s", (boundary) => {
    const document = phasedDocument();
    Object.assign(document.working.phaseContexts!.holding!, { revealedCandleCursor: boundary });
    expect(() => validateRecallDocument(document)).toThrow(/revealedCandleCursor/);
  });

  it.each([null, "2026-01-01T00:00:00Z", "2026-01-02", "2026-01-02T08:00:00+08:00"])("round trips actual candle boundary %s independently of aligned cursor", (boundary) => {
    const document = phasedDocument();
    document.working.phaseContexts!.holding!.revealedCandleCursor = boundary;
    expect(() => validateRecallDocument(document)).not.toThrow();
    const copied = cloneRecallDocument(document);
    document.working.phaseContexts!.holding!.revealedCandleCursor = "2025-12-31T00:00:00Z";
    expect(copied.working.phaseContexts!.holding!.revealedCandleCursor).toBe(boundary);
    expect(copied.working.phaseContexts!.holding!.cursor).toBe("2026-01-02");
    expect(copied.working.phaseContexts!.holding!.executionCursor).toBe("two");
  });

  it("explicitly reassigns an orphan phase context to global before removing its decision", () => {
    const reconciled = reconcileRecallDocument(phasedDocument(), episode([execution("one", "2026-01-01")])).document;
    const original = reconciled.working.phaseContexts!.holding!;
    const reassigned = resolveRecallPhaseContext(reconciled, "holding", "global");
    const context = reassigned.working.phaseContexts!.holding!;
    expect(context).toMatchObject({ mode: "global", decisionId: "global", cursor: original.cursor, executionCursor: original.executionCursor, viewport: original.viewport });
    expect(context.drawings[0]).toMatchObject({ text: "note-note", recallOwnerId: "global", recallHasSeenFuture: true });
    expect(original.decisionId).toBe("two");
    expect(reassigned.reconciliation).toEqual(reconciled.reconciliation);
    const resolved = resolveRecallReconciliation(reassigned, { removedExecutionIds: ["two"], decisionIdsToRemove: ["two"] });
    expect(resolved.reconciliation!.stale).toBe(false);
    expect(resolved.working.phaseContexts!.holding!.drawings[0].text).toBe("note-note");
    expect(() => validateRecallDocument(resolved)).not.toThrow();
  });

  it("validates explicit phase reassignment and preserves unrelated drawing owners", () => {
    const document = phasedDocument();
    document.working.phaseContexts!.holding!.drawings.push({ ...drawing("global-note"), recallOwnerId: "global" });
    expect(() => resolveRecallPhaseContext(document, "holding", "missing")).toThrow(/unknown decision/);
    expect(() => resolveRecallPhaseContext(document, "pre-entry", "one")).toThrow(/phase context/);
    const reassigned = resolveRecallPhaseContext(document, "holding", "one");
    expect(reassigned.working.phaseContexts!.holding!).toMatchObject({ mode: "decision", decisionId: "one" });
    expect(reassigned.working.phaseContexts!.holding!.drawings.map((item) => item.recallOwnerId)).toEqual(["one", "global"]);
  });

  it("requires explicit handling of phase content before removing a reconciled decision", () => {
    const reconciled = reconcileRecallDocument(phasedDocument(), episode([execution("one", "2026-01-01")])).document;
    expect(reconciled.working.phaseContexts!.holding!.drawings).toHaveLength(1);
    expect(() => resolveRecallReconciliation(reconciled, { removedExecutionIds: ["two"], decisionIdsToRemove: ["two"] })).toThrow(/phase context/);
  });
});

it('blocks completion of merged rated decisions until current evaluation is explicitly selected',()=>{
 const e=episode([execution('a','2026-01-01'),execution('b','2026-01-02')]);
 let d=createRecallDocument(e);d=mergeRecallDecisions(d,['a','b'],'a');
 const first:import('./exit-evaluations').RecallExitEvaluationDraft={id:'draft-one',evaluationId:'one',decisionId:'a',earlyExit:'uncertain',adherence:'no-plan',reason:null,reasonDetail:null,comparedPlanVersionId:null,comparedTargetId:null,tags:[],tagDictionaryVersion:'manual-v1',evidence:[],source:'manual-retrospective',recordedBy:'user',recordedPhase:'post-review',recordedAt:'2026-01-03',knowledgeCutoff:{cursor:'2026-01-03',executionCursor:'b'},hasSeenFuture:true};
 d.exitEvaluations={drafts:[first,{...first,id:'draft-two',evaluationId:'two'}],versions:[],associations:[{evaluationId:'one',decisionId:'a',status:'linked'},{evaluationId:'two',decisionId:'a',status:'linked'}]};
 expect(()=>completeRecallDocument(d,e)).toThrow(/explicit current selection/);
 d.exitEvaluations.activeEvaluationByDecision=[{decisionId:'a',evaluationId:'one'}];
 expect(()=>completeRecallDocument(d,e)).toThrow(/missing retained snapshot/);
 expect(d.exitEvaluations.drafts).toHaveLength(2);
 d.exitEvaluations.activeEvaluationByDecision=[{decisionId:'a',evaluationId:'missing'}];
 expect(()=>validateRecallDocument(d)).toThrow(/selection/);
});
