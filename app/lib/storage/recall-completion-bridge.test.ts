import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { openSqliteDatabase } from "../../../db/sqlite";
import { createRecallDocument, retainRecallSnapshot } from "../recall/document";
import { saveRecallDocument } from "../recall/server-repository";
import { buildInstrumentTradeSummaries } from "../trades/instruments";
import { buildTradeEpisodes } from "../trades/episodes";
import { buildTradeLibraryEntries } from "../trades/library";
import type { TradeExecution } from "../trades/types";
import { buildDashboardRows } from "../reviews/dashboard";
import { buildReviewQueue } from "../reviews/review-queue";
import { createEmptyEpisodeReviewRecord } from "../reviews/review-metrics";
import { SqliteStore } from "./sqlite-store";

let databaseDirectory: string | undefined;
let databasePath = "";
let previousDatabasePath: string | undefined;
let database: ReturnType<typeof openSqliteDatabase> | undefined;

const instrument = {
  id: "US:RECALL-BRIDGE",
  symbol: "RECALL-BRIDGE",
  name: "Recall bridge fixture",
  market: "US",
  currency: "USD",
};

function executions(): TradeExecution[] {
  return [
    {
      id: "recall-bridge-buy",
      source: { platform: "fixture", row: 1 },
      accountId: "bridge-account",
      accountLabel: "Bridge account",
      instrument,
      side: "buy",
      executedAt: "2026-01-02T14:30:00.000Z",
      quantity: "10",
      price: "10",
      fee: "0",
    },
    {
      id: "recall-bridge-sell",
      source: { platform: "fixture", row: 2 },
      accountId: "bridge-account",
      accountLabel: "Bridge account",
      instrument,
      side: "sell",
      executedAt: "2026-01-03T14:30:00.000Z",
      quantity: "10",
      price: "11",
      fee: "0",
    },
  ];
}

function snapshot(id: string, decisionId: string, executionCursor: string) {
  return {
    id,
    decisionId,
    timeframe: "1D" as const,
    cursor: "2026-01-03T14:30:00.000Z",
    executionCursor,
    candles: [{ time: "2026-01-03T14:30:00.000Z", open: 10, high: 11, low: 9, close: 11, volume: 100 }],
    drawings: [],
    imageDataUrl: "data:image/png;base64,AA==",
    createdAt: "2026-01-03T15:00:00.000Z",
    updatedAt: "2026-01-03T15:00:00.000Z",
  };
}

function completedRecallDocument(store: SqliteStore) {
  const episode = buildTradeEpisodes(store.getExecutions())[0]!;
  let document = createRecallDocument(episode, "2026-01-03T15:00:00.000Z");
  for (const decision of document.decisions) {
    document = retainRecallSnapshot(document, snapshot(`snapshot-${decision.id}`, decision.id, decision.id));
  }
  document = retainRecallSnapshot(document, snapshot("snapshot-global", "global", "recall-bridge-sell"));
  const draft = saveRecallDocument(database!, { document, expectedRevision: 0 });
  return saveRecallDocument(database!, {
    document: draft.document,
    expectedRevision: draft.revision,
    finalize: true,
  });
}

function consumerEntries(store: SqliteStore) {
  const bootstrap = store.getBootstrap();
  const reviews = Object.fromEntries(bootstrap.reviews.map((record) => [record.episodeId, record]));
  return {
    bootstrap,
    entries: buildTradeLibraryEntries(
      buildInstrumentTradeSummaries(store.getExecutions()),
      {},
      {},
      reviews,
    ),
  };
}

beforeEach(() => {
  previousDatabasePath = process.env.TRADEREVIEW_DB_PATH;
  const directory = mkdtempSync(join(tmpdir(), "tradereview-recall-completion-"));
  databaseDirectory = directory;
  databasePath = join(directory, "unit-acceptance.sqlite");
  process.env.TRADEREVIEW_DB_PATH = databasePath;
  database = openSqliteDatabase(databasePath);
  new SqliteStore(database).mergeExecutions(executions());
});

afterEach(() => {
  database?.close();
  database = undefined;
  if (previousDatabasePath === undefined) delete process.env.TRADEREVIEW_DB_PATH;
  else process.env.TRADEREVIEW_DB_PATH = previousDatabasePath;
  previousDatabasePath = undefined;
  if (databaseDirectory) rmSync(databaseDirectory, { recursive: true, force: true });
  databaseDirectory = undefined;
  databasePath = "";
});

describe("formal Recall completion bridge", () => {
  it("projects a newly finalized Recall into the library and both status consumers after reload", () => {
    const store = new SqliteStore(database!);
    const finalized = completedRecallDocument(store);
    expect(finalized.document.status).toBe("completed");

    const first = consumerEntries(store);
    const firstEpisode = first.entries[0]!.episodes[0]!;
    expect(first.bootstrap.reviews).toHaveLength(1);
    expect(store.getReview(firstEpisode.episode.id)?.review.completed).toBe(true);
    expect(firstEpisode.review?.review.completed).toBe(true);
    expect(first.entries[0]!.reviewedEpisodeCount).toBe(1);
    expect(buildReviewQueue(first.entries, { status: "completed" })).toHaveLength(1);
    expect(buildReviewQueue(first.entries, { status: "pending" })).toHaveLength(0);
    expect(buildDashboardRows(first.entries, { status: "completed" })).toHaveLength(1);

    database!.close();
    database = openSqliteDatabase(databasePath);
    const reloaded = consumerEntries(new SqliteStore(database));
    expect(reloaded.entries[0]!.episodes[0]!.review?.review.completed).toBe(true);
  });

  it("preserves legacy review fields and completed status while formal completion exists", () => {
    const store = new SqliteStore(database!);
    const episode = buildTradeEpisodes(store.getExecutions())[0]!;
    const legacy = createEmptyEpisodeReviewRecord(episode.id, instrument.id, "2026-01-02T00:00:00.000Z");
    legacy.plan.thesis = "legacy plan must survive";
    legacy.review.psychology = "legacy note";
    store.putReview(legacy);
    completedRecallDocument(store);

    const record = store.getReviews()[0]!;
    expect(record).toMatchObject({
      plan: { thesis: "legacy plan must survive" },
      review: { psychology: "legacy note", completed: true },
    });
  });

  it("keeps a preexisting legacy completed review completed without formal Recall", () => {
    const store = new SqliteStore(database!);
    const episode = buildTradeEpisodes(store.getExecutions())[0]!;
    const legacy = createEmptyEpisodeReviewRecord(episode.id, instrument.id, "2026-01-02T00:00:00.000Z");
    legacy.review.completed = true;
    legacy.review.reusableRule = "legacy rule";
    store.putReview(legacy);

    expect(store.getReviews()).toEqual([legacy]);
  });

  it("does not project an unfinalized draft as completed", () => {
    const store = new SqliteStore(database!);
    const episode = buildTradeEpisodes(store.getExecutions())[0]!;
    const document = createRecallDocument(episode, "2026-01-03T15:00:00.000Z");
    saveRecallDocument(database!, { document, expectedRevision: 0 });

    expect(store.getReviews()).toEqual([]);
    expect(buildReviewQueue(consumerEntries(store).entries, { status: "completed" })).toHaveLength(0);
  });

  it("does not project completion when finalization fails", () => {
    const store = new SqliteStore(database!);
    const episode = buildTradeEpisodes(store.getExecutions())[0]!;
    const document = createRecallDocument(episode, "2026-01-03T15:00:00.000Z");
    const draft = saveRecallDocument(database!, { document, expectedRevision: 0 });
    expect(() => saveRecallDocument(database!, {
      document: { ...draft.document, status: "completed", completedAt: "2026-01-03T16:00:00.000Z" },
      expectedRevision: draft.revision,
      finalize: true,
    })).toThrow(/snapshot|missing|global/i);

    expect(store.getReviews()).toEqual([]);
  });

  it("keeps formal completion when a later draft is autosaved", () => {
    const store = new SqliteStore(database!);
    const finalized = completedRecallDocument(store);
    const draft = saveRecallDocument(database!, {
      document: {
        ...finalized.document,
        working: { ...finalized.document.working, cursor: "2026-01-04T15:00:00.000Z" },
      },
      expectedRevision: finalized.revision,
    });

    expect(draft.document.status).toBe("completed");
    expect(store.getReviews()[0]!.review.completed).toBe(true);
  });

  it("keeps legacy compare-and-write independent from the formal projection", () => {
    const store = new SqliteStore(database!);
    const finalized = completedRecallDocument(store);
    const episode = buildTradeEpisodes(store.getExecutions())[0]!;
    const legacy = createEmptyEpisodeReviewRecord(
      episode.id,
      instrument.id,
      "2026-01-04T00:00:00.000Z",
    );
    legacy.plan.thesis = "new legacy draft";

    expect(store.putReview(legacy)).toBe(true);
    expect(store.getReview(episode.id)).toMatchObject({
      plan: { thesis: "new legacy draft" },
      review: { completed: true },
    });
    expect(finalized.document.status).toBe("completed");
  });
});
