import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { TradeEpisode, TradeExecution } from "../trades/types";
import {
  completeRecallDocument,
  createRecallDocument,
  mergeRecallDecisions,
  missingDecisionIds,
  reconcileRecallDocument,
  retainRecallSnapshot,
  splitRecallDecision,
  updateRecallSnapshot,
} from "./document";
import { openSqliteDatabase } from "../../../db/sqlite";
import { buildTradeEpisodes } from "../trades/episodes";
import { getSqliteStore } from "../storage/sqlite-store";
import {
  RecallConflictError,
  getRecallDocument,
  saveRecallDocument,
} from "./server-repository";
import type { RecallSnapshot } from "./types";

const directories: string[] = [];

function execution(
  id: string,
  side: TradeExecution["side"],
  executedAt: string,
  sourceTimezone?: string,
): TradeExecution {
  return {
    id,
    source: {
      platform: "review",
      row: Number(id.replace(/\D/g, "")) || 1,
      ...(sourceTimezone ? { sourceTimezone } : {}),
    },
    accountId: "review-account",
    accountLabel: "Review account",
    instrument: {
      id: "US:REVIEW",
      symbol: "REVIEW",
      name: "Review",
      market: "US",
      currency: "USD",
    },
    side,
    executedAt,
    quantity: "1",
    price: "10",
    fee: "0",
  };
}

function episode(
  executions: TradeExecution[],
  status: TradeEpisode["status"] = "closed",
): TradeEpisode {
  return {
    id: "review-episode",
    accountId: "review-account",
    accountLabel: "Review account",
    instrument: executions[0].instrument,
    direction: "long",
    status,
    startedAt: executions[0].executedAt,
    ...(status === "closed" ? { endedAt: executions.at(-1)?.executedAt } : {}),
    openingQuantity: "1",
    remainingQuantity: status === "closed" ? "0" : "1",
    executions,
  };
}

function snapshot(id: string, decisionId: RecallSnapshot["decisionId"]): RecallSnapshot {
  return {
    id,
    decisionId,
    timeframe: "1D",
    cursor: "2026-01-01T00:00:00.000Z",
    executionCursor: "2026-01-01T00:00:00.000Z",
    candles: [{ time: "2026-01-01T00:00:00.000Z", open: 10, high: 11, low: 9, close: 10, volume: 1 }],
    drawings: [],
    imageDataUrl: "data:image/png;base64,AAAA",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("independent Recall domain review", () => {
  it("requires a retained global snapshot before completing a round", () => {
    const tradeEpisode = episode([
      execution("buy", "buy", "2026-01-01T00:00:00.000Z"),
      execution("sell", "sell", "2026-01-02T00:00:00.000Z"),
    ]);
    let document = createRecallDocument(tradeEpisode);
    document = retainRecallSnapshot(document, snapshot("buy-snapshot", "buy"));
    document = retainRecallSnapshot(document, snapshot("sell-snapshot", "sell"));

    expect(() => completeRecallDocument(document, tradeEpisode, "2026-01-03T00:00:00.000Z"))
      .toThrow(/global/i);
  });

  it("keeps split snapshots unassigned until the user explicitly allocates them", () => {
    const tradeEpisode = episode([
      execution("one", "buy", "2026-01-01T00:00:00.000Z"),
      execution("two", "buy", "2026-01-02T00:00:00.000Z"),
    ], "open");
    let document = mergeRecallDecisions(
      createRecallDocument(tradeEpisode),
      ["one", "two"],
    );
    document = retainRecallSnapshot(document, snapshot("merged", "one"));
    document = retainRecallSnapshot(document, snapshot("global", "global"));

    const split = splitRecallDecision(document, "one", [
      { id: "one", executionIds: ["one"], snapshotIds: [] },
      { id: "two", executionIds: ["two"] },
    ]);
    expect(split.snapshots.find((item) => item.id === "merged")?.decisionId).toBe("unassigned");
    expect(missingDecisionIds(split)).toEqual(["one", "two"]);

    const assigned = updateRecallSnapshot(
      split,
      { ...snapshot("merged", "two"), drawings: [] },
    );
    expect(assigned.snapshots.find((item) => item.id === "merged")?.decisionId).toBe("two");
    expect(missingDecisionIds(assigned)).toEqual(["one"]);
  });

  it("deep-copies retained candles and drawings in both directions", () => {
    const tradeEpisode = episode([execution("one", "buy", "2026-01-01T00:00:00.000Z")]);
    const source = snapshot("retained", "one");
    const before = createRecallDocument(tradeEpisode);
    const document = retainRecallSnapshot(before, source);

    source.candles[0].close = 999;
    document.snapshots[0].candles[0].close = 888;
    document.snapshots[0].drawings.push({} as never);

    expect(source.candles[0].close).toBe(999);
    expect(before.snapshots).toHaveLength(0);
    expect(document.snapshots[0].candles[0].close).toBe(888);
    expect(document.snapshots).toHaveLength(1);
  });

  it("does not complete a round after a removed execution is refreshed away", () => {
    const originalEpisode = episode([
      execution("one", "buy", "2026-01-01T00:00:00.000Z"),
      execution("two", "sell", "2026-01-02T00:00:00.000Z"),
    ]);
    const refreshedEpisode = episode([
      execution("one", "buy", "2026-01-01T00:00:00.000Z"),
    ]);
    let document = createRecallDocument(originalEpisode);
    document = retainRecallSnapshot(document, snapshot("one-snapshot", "one"));
    document = retainRecallSnapshot(document, snapshot("two-snapshot", "two"));
    document = retainRecallSnapshot(document, snapshot("global", "global"));

    const firstReconcile = reconcileRecallDocument(document, refreshedEpisode);
    expect(firstReconcile.document.reconciliation?.stale).toBe(true);
    const secondReconcile = reconcileRecallDocument(firstReconcile.document, refreshedEpisode);
    expect(secondReconcile.document.reconciliation?.stale).toBe(true);

    expect(() => completeRecallDocument(
      secondReconcile.document,
      refreshedEpisode,
      "2026-01-03T00:00:00.000Z",
    )).toThrow(/stale|removed|confirm/i);
  });
});

describe("independent Recall repository review", () => {
  it("uses persisted executions for finalization and preserves formal data across CAS edits", () => {
    const directory = mkdtempSync(join(tmpdir(), "recall-review-")).toString();
    directories.push(directory);
    const database = openSqliteDatabase(join(directory, "review.sqlite"));
    const store = getSqliteStore(database);
    const executions = [
      execution("persisted-buy", "buy", "2026-01-01T00:00:00.000Z"),
      execution("persisted-sell", "sell", "2026-01-02T00:00:00.000Z"),
    ];
    store.mergeExecutions(executions);
    const persistedEpisode = buildTradeEpisodes(store.getExecutions())[0];
    let document = createRecallDocument(persistedEpisode);
    for (const decision of document.decisions) {
      document = retainRecallSnapshot(document, snapshot(`snapshot-${decision.id}`, decision.id));
    }
    document = retainRecallSnapshot(document, snapshot("global", "global"));

    const draft = saveRecallDocument(database, { document, expectedRevision: 0 });
    const finalized = saveRecallDocument(database, {
      document: draft.document,
      expectedRevision: draft.revision,
      finalize: true,
    });
    const formalBefore = (database
      .prepare("select finalized_json from recall_documents where episode_id = ?")
      .get(persistedEpisode.id) as { finalized_json: string }).finalized_json;

    expect(() => saveRecallDocument(database, {
      document: finalized.document,
      expectedRevision: draft.revision,
    })).toThrow(RecallConflictError);

    const edited = {
      ...finalized.document,
      working: {
        ...finalized.document.working,
        cursor: "2026-01-03T00:00:00.000Z",
      },
    };
    const autosaved = saveRecallDocument(database, {
      document: edited,
      expectedRevision: finalized.revision,
    });
    const formalAfter = (database
      .prepare("select finalized_json from recall_documents where episode_id = ?")
      .get(persistedEpisode.id) as { finalized_json: string }).finalized_json;

    expect(formalAfter).toBe(formalBefore);
    expect(autosaved.document.lastCompleted?.snapshots).toHaveLength(3);
    expect(getRecallDocument(database, persistedEpisode.id)?.lastCompleted?.snapshots).toHaveLength(3);
  });

  it("rejects finalization when persisted executions leave the episode open", () => {
    const directory = mkdtempSync(join(tmpdir(), "recall-review-open-")).toString();
    directories.push(directory);
    const database = openSqliteDatabase(join(directory, "review.sqlite"));
    const store = getSqliteStore(database);
    const buy = execution("open-buy", "buy", "2026-01-01T00:00:00.000Z");
    store.mergeExecutions([buy]);
    const persistedEpisode = buildTradeEpisodes(store.getExecutions())[0];
    let document = createRecallDocument(persistedEpisode);
    document = retainRecallSnapshot(document, snapshot("open-snapshot", document.decisions[0].id));
    document = retainRecallSnapshot(document, snapshot("open-global", "global"));
    const clientMarkedCompleted = { ...document, status: "completed" as const, completedAt: "2026-01-02T00:00:00.000Z" };

    expect(() => saveRecallDocument(database, {
      document: clientMarkedCompleted,
      expectedRevision: 0,
      finalize: true,
    })).toThrow(/closed/i);
  });
});
