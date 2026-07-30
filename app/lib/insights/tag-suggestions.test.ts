import { describe, expect, it } from "vitest";

import type { DailyCandleRecord } from "../market/contracts";
import type { EpisodeReviewRecord } from "../reviews/types";
import type {
  TradeLibraryEntry,
  TradeLibraryEpisode,
} from "../trades/library";
import type { TradeExecution } from "../trades/types";
import {
  buildTagSuggestions,
  type TagSuggestionRecord,
} from "./tag-suggestions";

const GENERATED_AT = "2026-07-27T00:00:00.000Z";

function execution(
  id: string,
  side: "buy" | "sell",
  executedAt: string,
  quantity: string,
  price: string,
): TradeExecution {
  return {
    id,
    source: { platform: "fixture", row: 1 },
    accountId: "account-1",
    accountLabel: "美股账户",
    instrument: {
      id: "US:XPEV",
      symbol: "XPEV",
      name: "小鹏汽车",
      market: "US",
      currency: "USD",
    },
    side,
    executedAt,
    quantity,
    price,
    fee: "0",
  };
}

function review(
  episodeId: string,
  confirmedTagIds: string[] = [],
  psychology = "",
): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId,
    instrumentId: "US:XPEV",
    updatedAt: "2026-07-26T00:00:00.000Z",
    plan: {
      thesis: "",
      expectedPath: "",
      invalidationCondition: "",
      targetRange: "",
      plannedRiskAmount: "100",
      confidence: null,
    },
    review: {
      decisionQuality: null,
      executionQuality: null,
      riskManagement: "",
      psychology,
      reusableRule: "",
      completed: true,
    },
    confirmedTagIds,
  };
}

function entry(
  episodeId: string,
  executions: TradeExecution[],
  savedReview?: EpisodeReviewRecord,
): TradeLibraryEntry {
  const episode: TradeLibraryEpisode = {
    episode: {
      id: episodeId,
      accountId: "account-1",
      accountLabel: "美股账户",
      instrument: executions[0].instrument,
      direction: "long",
      status: "closed",
      startedAt: executions[0].executedAt,
      endedAt: executions.at(-1)?.executedAt,
      openingQuantity: "100",
      remainingQuantity: "0",
      executions,
    },
    metrics: {
      buyCount: executions.filter(({ side }) => side === "buy").length,
      sellCount: executions.filter(({ side }) => side === "sell").length,
      boughtQuantity: "100",
      soldQuantity: "100",
      grossExposure: "1000",
      fees: "0",
      realizedPnl: "100",
      unrealizedPnl: "0",
      netPnl: "100",
      returnPercent: "10",
      holdingMilliseconds: 86_400_000,
    },
    review: savedReview,
    reviewStatus: savedReview?.review.completed ? "completed" : "pending",
    confirmedTagIds: savedReview?.confirmedTagIds ?? [],
    tagDictionaryVersion: 1,
    rMultiple: "1",
  };

  return {
    instrument: executions[0].instrument,
    executions,
    episodes: [episode],
    accountCount: 1,
    tradeCount: executions.length,
    episodeCount: 1,
    firstTradeAt: executions[0].executedAt,
    lastTradeAt: executions.at(-1)?.executedAt ?? executions[0].executedAt,
    status: "closed",
    netPnl: "100",
    returnPercent: "10",
    reviewedEpisodeCount: savedReview?.review.completed ? 1 : 0,
    confirmedTagIds: savedReview?.confirmedTagIds ?? [],
    cumulativeR: "1",
  };
}

function candle(
  tradingDate: string,
  high: string,
  close = high,
  low = close,
): DailyCandleRecord {
  return {
    instrumentId: "US:XPEV",
    tradingDate,
    open: close,
    high,
    low,
    close,
    volume: "1000",
    currency: "USD",
    provider: "tencent",
    providerSymbol: "usXPEV",
    adjustmentMode: "raw",
    fetchedAt: GENERATED_AT,
  };
}

function januaryCandles(
  count: number,
  high = "10",
): DailyCandleRecord[] {
  return Array.from({ length: count }, (_, index) =>
    candle(`2025-01-${String(index + 1).padStart(2, "0")}`, high),
  );
}

describe("buildTagSuggestions", () => {
  it("suggests a 20-session breakout using only candles before entry", () => {
    const buys = [
      execution(
        "open",
        "buy",
        "2025-01-21T15:00:00Z",
        "100",
        "11",
      ),
      execution(
        "close",
        "sell",
        "2025-01-22T15:00:00Z",
        "100",
        "12",
      ),
    ];
    const futureCandle = candle("2025-01-22", "99");

    const suggestions = buildTagSuggestions(
      [entry("episode-breakout", buys)],
      {
        "US:XPEV": [...januaryCandles(20), futureCandle],
      },
      [],
      GENERATED_AT,
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      episodeId: "episode-breakout",
      tagDictionaryVersion: 1,
      tagId: "breakout",
      finalTagId: null,
      ruleId: "entry-20d-breakout",
      ruleVersion: 1,
      status: "suggested",
      suggestedAt: GENERATED_AT,
      decidedAt: null,
      evidence: [
        {
          kind: "price-comparison",
          tradingDate: "2025-01-21",
          observed: "11",
          reference: "10",
        },
      ],
    });
  });

  it("suggests the first pullback near a breakout level from the prior five sessions", () => {
    const base = januaryCandles(20);
    const breakout = candle("2025-01-21", "10.8", "10.5", "10.2");
    const pause = candle("2025-01-22", "10.7", "10.4", "10.4");
    const fills = [
      execution(
        "open",
        "buy",
        "2025-01-23T15:00:00Z",
        "100",
        "10.1",
      ),
      execution(
        "close",
        "sell",
        "2025-01-24T15:00:00Z",
        "100",
        "11",
      ),
    ];

    const suggestions = buildTagSuggestions(
      [entry("episode-pullback", fills)],
      { "US:XPEV": [...base, breakout, pause] },
      [],
      GENERATED_AT,
    );

    expect(suggestions.map(({ tagId }) => tagId)).toEqual(["pullback"]);
    expect(suggestions[0].evidence).toEqual([
      {
        kind: "breakout-pullback",
        tradingDate: "2025-01-23",
        breakoutDate: "2025-01-21",
        observed: "10.1",
        reference: "10",
      },
    ]);
  });

  it("does not call a later retest the first pullback", () => {
    const base = januaryCandles(20);
    const breakout = candle("2025-01-21", "10.8", "10.5", "10.2");
    const earlierRetest = candle(
      "2025-01-22",
      "10.7",
      "10.4",
      "10.1",
    );
    const fills = [
      execution(
        "open",
        "buy",
        "2025-01-23T15:00:00Z",
        "100",
        "10.1",
      ),
      execution(
        "close",
        "sell",
        "2025-01-24T15:00:00Z",
        "100",
        "11",
      ),
    ];

    const suggestions = buildTagSuggestions(
      [entry("episode-late-pullback", fills)],
      { "US:XPEV": [...base, breakout, earlierRetest] },
      [],
      GENERATED_AT,
    );

    expect(suggestions).toEqual([]);
  });

  it("suggests scale-in for multiple opening-side executions", () => {
    const fills = [
      execution(
        "open-1",
        "buy",
        "2025-02-03T15:00:00Z",
        "50",
        "9",
      ),
      execution(
        "open-2",
        "buy",
        "2025-02-04T15:00:00Z",
        "50",
        "9.5",
      ),
      execution(
        "close",
        "sell",
        "2025-02-05T15:00:00Z",
        "100",
        "10",
      ),
    ];

    const suggestions = buildTagSuggestions(
      [entry("episode-scale-in", fills)],
      { "US:XPEV": [] },
      [],
      GENERATED_AT,
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      tagId: "scale-in",
      ruleId: "scale-in",
      evidence: [
        {
          kind: "execution-count",
          observed: "2",
          reference: "1",
        },
      ],
    });
  });

  it("preserves decisions, skips confirmed tags, and never infers psychology", () => {
    const fills = [
      execution(
        "open-1",
        "buy",
        "2025-02-03T15:00:00Z",
        "50",
        "9",
      ),
      execution(
        "open-2",
        "buy",
        "2025-02-04T15:00:00Z",
        "50",
        "9.5",
      ),
      execution(
        "close",
        "sell",
        "2025-02-05T15:00:00Z",
        "100",
        "10",
      ),
    ];
    const rejected: TagSuggestionRecord = {
      version: 1,
      tagDictionaryVersion: 1,
      id: "episode-rejected:scale-in:1",
      episodeId: "episode-rejected",
      instrumentId: "US:XPEV",
      tagId: "scale-in",
      finalTagId: null,
      ruleId: "scale-in",
      ruleVersion: 1,
      status: "rejected",
      suggestedAt: "2026-07-26T00:00:00.000Z",
      decidedAt: "2026-07-26T01:00:00.000Z",
      evidence: [],
    };

    const suggestions = buildTagSuggestions(
      [
        entry(
          "episode-rejected",
          fills,
          review("episode-rejected", [], "FOMO，担心踏空"),
        ),
        entry(
          "episode-confirmed",
          fills,
          review("episode-confirmed", ["scale-in"], "恐惧"),
        ),
      ],
      { "US:XPEV": [] },
      [rejected],
      GENERATED_AT,
    );

    expect(suggestions).toEqual([rejected]);
    expect(
      suggestions.some(({ tagId }) => tagId === "fomo" || tagId === "fear"),
    ).toBe(false);
  });
});
