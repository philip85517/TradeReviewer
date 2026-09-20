import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { openSqliteDatabase } from "../../../db/sqlite";
import { buildTradeEpisodes } from "../trades/episodes";
import type { TradeExecution } from "../trades/types";
import { getSqliteStore } from "../storage/sqlite-store";
import {
  createRecallDocument,
  retainRecallSnapshot,
} from "./document";
import {
  getRecallDocument,
  RecallConflictError,
  saveRecallDocument,
} from "./server-repository";
import type { RecallSnapshot } from "./types";

const directories: string[] = [];

function database() {
  const directory = mkdtempSync(join(tmpdir(), "trade-review-recall-"));
  directories.push(directory);
  return openSqliteDatabase(join(directory, "recall.sqlite"));
}

function execution(id: string, side: TradeExecution["side"], executedAt: string): TradeExecution {
  return {
    id,
    source: { platform: "test", row: 0 },
    accountId: "account",
    accountLabel: "Test",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side,
    executedAt,
    quantity: "1",
    price: "10",
    fee: "0",
  };
}

function snapshot(decisionId: string, id = "snapshot"): RecallSnapshot {
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
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("Recall SQLite repository", () => {
  it("keeps the formal JSON unchanged while autosaving a later draft", () => {
    const db = database();
    const store = getSqliteStore(db);
    const executions = [
      execution("buy", "buy", "2026-01-01T00:00:00.000Z"),
      execution("sell", "sell", "2026-01-02T00:00:00.000Z"),
    ];
    store.mergeExecutions(executions);
    const tradeEpisode = buildTradeEpisodes(store.getExecutions())[0];
    let draft = createRecallDocument(tradeEpisode, "2026-01-03T00:00:00.000Z");
    draft = retainRecallSnapshot(draft, snapshot(draft.decisions[0].id));

    const first = saveRecallDocument(db, { document: draft, expectedRevision: 0 });
    let formalInput = retainRecallSnapshot(first.document, snapshot(first.document.decisions[1].id, "snapshot-2"));
    formalInput = retainRecallSnapshot(formalInput, snapshot("global", "global"));
    const formal = saveRecallDocument(db, {
      document: { ...formalInput, status: "completed", completedAt: "2026-01-04T00:00:00.000Z" },
      expectedRevision: 1,
      finalize: true,
    });
    const finalizedJsonBefore = db.prepare("select finalized_json from recall_documents where episode_id = ?").get(tradeEpisode.id) as { finalized_json: string };

    const edited = {
      ...formal.document,
      working: { ...formal.document.working, cursor: "2026-01-05T00:00:00.000Z" },
    };
    const draftAfter = saveRecallDocument(db, { document: edited, expectedRevision: 2 });
    const finalizedJsonAfter = db.prepare("select finalized_json from recall_documents where episode_id = ?").get(tradeEpisode.id) as { finalized_json: string };
    expect(finalizedJsonAfter.finalized_json).toBe(finalizedJsonBefore.finalized_json);
    expect(draftAfter.document.lastCompleted).toMatchObject({ revision: 2, status: "completed" });
    expect(getRecallDocument(db, tradeEpisode.id)?.lastCompleted).toMatchObject({ revision: 2 });
    expect(() => saveRecallDocument(db, { document: edited, expectedRevision: 2 })).toThrow(RecallConflictError);
  });
});
