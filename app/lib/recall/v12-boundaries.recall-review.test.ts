import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { buildTradeEpisodes } from "../trades/episodes";
import type { TradeEpisode, TradeExecution } from "../trades/types";
import {
  createRecallDocument,
  retainRecallSnapshot,
} from "./document";
import type { RecallDocument, RecallSnapshot } from "./types";
import type { NormalizedDrawing } from "../chart/drawings";

function execution({
  id,
  accountId,
  side,
  executedAt,
  quantity,
  fee = "0",
}: {
  id: string;
  accountId: string;
  side: TradeExecution["side"];
  executedAt: string;
  quantity: string;
  fee?: string;
}): TradeExecution {
  return {
    id,
    source: { platform: "v12-review", row: 1 },
    accountId,
    accountLabel: accountId === "account-a" ? "Account A" : "Account B",
    instrument: {
      id: "US:BOUNDARY",
      symbol: "BOUNDARY",
      name: "Boundary",
      market: "US",
      currency: "USD",
    },
    side,
    executedAt,
    quantity,
    price: "10",
    fee,
  };
}

function episodeContaining(episodes: TradeEpisode[], executionId: string): TradeEpisode {
  const found = episodes.find((episode) =>
    episode.executions.some((item) => item.id === executionId),
  );
  if (!found) throw new Error(`episode containing ${executionId} was not built`);
  return found;
}

function drawing(episodeId: string, id: string): NormalizedDrawing {
  return {
    version: 2,
    episodeId,
    id,
    name: id,
    tool: "text",
    anchors: [{ time: "2026-01-01T00:00:00.000Z", price: 10 }],
    style: { color: "#ffffff", lineWidth: 1, opacity: 1 },
    text: id,
    zIndex: 0,
    hidden: false,
    locked: false,
    visibleOn: "all",
    stage: "during-replay",
    createdAtCursor: "2026-01-01T00:00:00.000Z",
  };
}

function snapshot(
  document: RecallDocument,
  id: string,
  drawingId: string,
): RecallSnapshot {
  return {
    id,
    decisionId: document.decisions[0].id,
    timeframe: "1D",
    cursor: document.working.cursor,
    executionCursor: document.working.executionCursor,
    candles: [{
      time: document.working.cursor,
      open: 10,
      high: 11,
      low: 9,
      close: 10,
      volume: 1,
    }],
    drawings: [drawing(document.episodeId, drawingId)],
    imageDataUrl: "data:image/png;base64,AA==",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("Recall V12 episode boundaries", () => {
  it("keeps a new round and a same-symbol other account in separate documents and drawings", () => {
    const executions = [
      execution({
        id: "a-round-one-buy",
        accountId: "account-a",
        side: "buy",
        executedAt: "2026-01-01T00:00:00.000Z",
        quantity: "10",
      }),
      execution({
        id: "b-round-one-buy",
        accountId: "account-b",
        side: "buy",
        executedAt: "2026-01-01T01:00:00.000Z",
        quantity: "20",
      }),
      execution({
        id: "a-round-one-sell",
        accountId: "account-a",
        side: "sell",
        executedAt: "2026-01-01T02:00:00.000Z",
        quantity: "10",
      }),
      execution({
        id: "b-round-one-sell",
        accountId: "account-b",
        side: "sell",
        executedAt: "2026-01-01T03:00:00.000Z",
        quantity: "20",
      }),
      execution({
        id: "a-round-two-buy",
        accountId: "account-a",
        side: "buy",
        executedAt: "2026-01-02T00:00:00.000Z",
        quantity: "30",
      }),
      execution({
        id: "a-round-two-sell",
        accountId: "account-a",
        side: "sell",
        executedAt: "2026-01-02T01:00:00.000Z",
        quantity: "30",
      }),
    ];
    const episodes = buildTradeEpisodes(executions);
    const roundOne = episodeContaining(episodes, "a-round-one-buy");
    const otherAccount = episodeContaining(episodes, "b-round-one-buy");
    const roundTwo = episodeContaining(episodes, "a-round-two-buy");
    const documents = [
      createRecallDocument(roundOne, "2026-01-03T00:00:00.000Z"),
      createRecallDocument(otherAccount, "2026-01-03T00:00:00.000Z"),
      createRecallDocument(roundTwo, "2026-01-03T00:00:00.000Z"),
    ];

    expect(new Set(documents.map((document) => document.episodeId)).size).toBe(3);
    expect(documents.map((document) => document.decisions.flatMap((decision) => decision.executionIds))).toEqual([
      ["a-round-one-buy", "a-round-one-sell"],
      ["b-round-one-buy", "b-round-one-sell"],
      ["a-round-two-buy", "a-round-two-sell"],
    ]);

    const withRoundOneDrawing = retainRecallSnapshot(
      documents[0],
      snapshot(documents[0], "round-one-snapshot", "round-one-note"),
    );
    const withRoundTwoDrawing = retainRecallSnapshot(
      documents[2],
      snapshot(documents[2], "round-two-snapshot", "round-two-note"),
    );

    expect(withRoundOneDrawing.snapshots[0].drawings.map((item) => item.id)).toEqual([
      "round-one-note",
    ]);
    expect(withRoundTwoDrawing.snapshots[0].drawings.map((item) => item.id)).toEqual([
      "round-two-note",
    ]);
    expect(documents[1].snapshots).toEqual([]);
    expect(documents[1].working.drawings).toEqual([]);
    expect(documents[2].snapshots).toEqual([]);
    expect(documents[2].working.drawings).toEqual([]);
  });

  it("preserves source quantity and fees when a reversal crosses zero and creates Recall documents for both episodes", () => {
    const buy = execution({
      id: "reverse-buy",
      accountId: "account-a",
      side: "buy",
      executedAt: "2026-02-01T00:00:00.000Z",
      quantity: "100",
      fee: "0.11",
    });
    const reverse = execution({
      id: "reverse-sell",
      accountId: "account-a",
      side: "sell",
      executedAt: "2026-02-01T01:00:00.000Z",
      quantity: "150",
      fee: "0.37",
    });
    const episodes = buildTradeEpisodes([buy, reverse]);

    expect(episodes).toHaveLength(2);
    expect(episodes[0].status).toBe("closed");
    expect(episodes[1].direction).toBe("short");

    const allocatedReverseExecutions = episodes
      .flatMap((episode) => episode.executions)
      .filter((item) => item.id.startsWith(`${reverse.id}:`));
    expect(allocatedReverseExecutions).toHaveLength(2);
    expect(
      allocatedReverseExecutions
        .reduce((total, item) => total.plus(item.quantity), new Decimal(0))
        .equals(reverse.quantity),
    ).toBe(true);
    expect(
      allocatedReverseExecutions
        .reduce((total, item) => total.plus(item.fee), new Decimal(0))
        .equals(reverse.fee),
    ).toBe(true);
    expect(reverse).toMatchObject({ quantity: "150", fee: "0.37" });

    const documents = episodes.map((episode) => createRecallDocument(
      episode,
      "2026-02-02T00:00:00.000Z",
    ));
    const documentExecutionIds = documents.flatMap((document) =>
      document.decisions.flatMap((decision) => decision.executionIds),
    );
    const episodeExecutionIds = episodes.flatMap((episode) =>
      episode.executions.map((item) => item.id),
    );
    expect(new Set(documentExecutionIds)).toEqual(new Set(episodeExecutionIds));
    expect(new Set(documents.map((document) => document.episodeId)).size).toBe(2);
  });
});
