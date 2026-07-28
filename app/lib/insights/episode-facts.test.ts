import { describe, expect, it } from "vitest";

import type { DailyCandleRecord } from "../market/contracts";
import type { MarketDataSyncStatus } from "../market/sync-status";
import type { EpisodeReviewRecord } from "../reviews/types";
import type {
  TradeLibraryEntry,
  TradeLibraryEpisode,
} from "../trades/library";
import type {
  Instrument,
  TradeExecution,
} from "../trades/types";
import type { TagSuggestionRecord } from "./types";
import { buildInsightEpisodeFacts } from "./episode-facts";

const xpev: Instrument = {
  id: "US:XPEV",
  symbol: "XPEV",
  name: "小鹏汽车",
  market: "US",
  currency: "USD",
};

function execution(
  instrument: Instrument,
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
    accountLabel: "账户一",
    instrument,
    side,
    executedAt,
    quantity,
    price,
    fee: "0",
  };
}

function savedReview(
  episodeId: string,
  plannedRiskAmount: string,
  tags: string[],
): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId,
    instrumentId: xpev.id,
    updatedAt: "2026-07-27T00:00:00.000Z",
    plan: {
      thesis: "",
      expectedPath: "",
      invalidationCondition: "",
      targetRange: "",
      plannedRiskAmount,
      confidence: 4,
    },
    review: {
      decisionQuality: 4,
      executionQuality: 4,
      riskManagement: "",
      psychology: "",
      reusableRule: "",
      completed: true,
    },
    confirmedTagIds: tags,
  };
}

function libraryEpisode(options: {
  id: string;
  instrument?: Instrument;
  direction: "long" | "short";
  status?: "open" | "closed";
  executions: TradeExecution[];
  netPnl: string | null;
  returnPercent: string | null;
  rMultiple: string | null;
  tags?: string[];
}): TradeLibraryEpisode {
  const instrument = options.instrument ?? xpev;
  const status = options.status ?? "closed";
  const tags = options.tags ?? [];
  const review = savedReview(
    options.id,
    options.rMultiple === null ? "" : "10",
    tags,
  );
  return {
    episode: {
      id: options.id,
      accountId: "account-1",
      accountLabel: "账户一",
      instrument,
      direction: options.direction,
      status,
      startedAt: options.executions[0].executedAt,
      endedAt:
        status === "closed"
          ? options.executions.at(-1)?.executedAt
          : undefined,
      openingQuantity: "10",
      remainingQuantity: status === "closed" ? "0" : "10",
      executions: options.executions,
    },
    metrics: {
      buyCount: options.executions.filter(({ side }) => side === "buy")
        .length,
      sellCount: options.executions.filter(({ side }) => side === "sell")
        .length,
      boughtQuantity: "10",
      soldQuantity: status === "closed" ? "10" : "0",
      grossExposure: "100",
      fees: "0",
      realizedPnl: options.netPnl ?? "0",
      unrealizedPnl: status === "closed" ? "0" : null,
      netPnl: options.netPnl,
      returnPercent: options.returnPercent,
      holdingMilliseconds:
        status === "closed" ? 86_400_000 : null,
    },
    review,
    reviewStatus: "completed",
    confirmedTagIds: tags,
    tagDictionaryVersion: 1,
    rMultiple: options.rMultiple,
  };
}

function entry(
  instrument: Instrument,
  episodes: TradeLibraryEpisode[],
): TradeLibraryEntry {
  const executions = episodes.flatMap(({ episode }) => episode.executions);
  return {
    instrument,
    executions,
    episodes,
    accountCount: 1,
    tradeCount: executions.length,
    episodeCount: episodes.length,
    firstTradeAt: executions[0].executedAt,
    lastTradeAt: executions.at(-1)?.executedAt ?? executions[0].executedAt,
    status: episodes.some(({ episode }) => episode.status === "open")
      ? "open"
      : "closed",
    netPnl: null,
    returnPercent: null,
    reviewedEpisodeCount: episodes.length,
    confirmedTagIds: [
      ...new Set(episodes.flatMap(({ confirmedTagIds }) => confirmedTagIds)),
    ],
    cumulativeR: null,
  };
}

function candle(
  tradingDate: string,
  high: string,
  low: string,
  close: string,
): DailyCandleRecord {
  return {
    instrumentId: xpev.id,
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
    fetchedAt: "2026-07-27T00:00:00.000Z",
  };
}

function confirmedSuggestion(
  episodeId: string,
): TagSuggestionRecord {
  return {
    version: 1,
    tagDictionaryVersion: 1,
    id: `${episodeId}:entry-20d-breakout:1`,
    episodeId,
    instrumentId: xpev.id,
    tagId: "breakout",
    finalTagId: "breakout",
    ruleId: "entry-20d-breakout",
    ruleVersion: 1,
    status: "confirmed",
    suggestedAt: "2026-07-26T00:00:00.000Z",
    decidedAt: "2026-07-27T00:00:00.000Z",
    evidence: [],
  };
}

describe("buildInsightEpisodeFacts", () => {
  it("calculates direction-aware excursions without applying later scale-in basis backwards", () => {
    const longExecutions = [
      execution(
        xpev,
        "long-open-1",
        "buy",
        "2025-01-02T15:00:00Z",
        "5",
        "9",
      ),
      execution(
        xpev,
        "long-open-2",
        "buy",
        "2025-01-02T16:00:00Z",
        "5",
        "11",
      ),
      execution(
        xpev,
        "long-close",
        "sell",
        "2025-01-03T15:00:00Z",
        "10",
        "12",
      ),
    ];
    const shortExecutions = [
      execution(
        xpev,
        "short-open",
        "sell",
        "2025-02-03T15:00:00Z",
        "10",
        "20",
      ),
      execution(
        xpev,
        "short-close",
        "buy",
        "2025-02-04T15:00:00Z",
        "10",
        "16",
      ),
    ];
    const long = libraryEpisode({
      id: "episode-long",
      direction: "long",
      executions: longExecutions,
      netPnl: "20",
      returnPercent: "20",
      rMultiple: "2",
      tags: ["breakout", "planned"],
    });
    const short = libraryEpisode({
      id: "episode-short",
      direction: "short",
      executions: shortExecutions,
      netPnl: "40",
      returnPercent: "20",
      rMultiple: "4",
      tags: ["planned"],
    });

    const result = buildInsightEpisodeFacts(
      [entry(xpev, [long, short])],
      {
        "US:XPEV": [
          candle("2025-01-02", "11", "9", "10"),
          candle("2025-01-03", "15", "11", "12"),
          candle("2025-02-03", "22", "18", "20"),
          candle("2025-02-04", "19", "14", "16"),
        ],
      },
      { "US:XPEV": "complete" },
      [confirmedSuggestion("episode-long")],
    );

    expect(result.excluded).toEqual([]);
    expect(result.facts).toEqual([
      expect.objectContaining({
        episodeId: "episode-long",
        instrumentId: "US:XPEV",
        instrumentName: "小鹏汽车",
        direction: "long",
        netPnl: "20",
        returnPercent: "20",
        rMultiple: "2",
        holdingMilliseconds: 86_400_000,
        holdingDays: "1",
        averageEntryPrice: "10",
        openingExecutionCount: 2,
        addOnCount: 1,
        mfePercent: "20",
        maePercent: "0",
        givebackPercent: "0",
        confirmedTagIds: ["breakout", "planned"],
        confirmedRuleVersions: [
          {
            tagId: "breakout",
            tagDictionaryVersion: 1,
            ruleId: "entry-20d-breakout",
            ruleVersion: 1,
          },
        ],
        calculationVersion: 1,
      }),
      expect.objectContaining({
        episodeId: "episode-short",
        direction: "short",
        netPnl: "40",
        returnPercent: "20",
        rMultiple: "4",
        averageEntryPrice: "20",
        openingExecutionCount: 1,
        addOnCount: 0,
        mfePercent: "20",
        maePercent: "0",
        givebackPercent: "0",
        confirmedTagIds: ["planned"],
        confirmedRuleVersions: [],
      }),
    ]);
  });

  it("reports explicit exclusions instead of emitting partial facts", () => {
    const closedExecutions = [
      execution(
        xpev,
        "closed-open",
        "buy",
        "2025-03-03T15:00:00Z",
        "10",
        "10",
      ),
      execution(
        xpev,
        "closed-close",
        "sell",
        "2025-03-04T15:00:00Z",
        "10",
        "11",
      ),
    ];
    const openExecutions = [
      execution(
        xpev,
        "open",
        "buy",
        "2025-04-01T15:00:00Z",
        "10",
        "10",
      ),
    ];
    const open = libraryEpisode({
      id: "episode-open",
      direction: "long",
      status: "open",
      executions: openExecutions,
      netPnl: null,
      returnPercent: null,
      rMultiple: null,
    });
    const missingCandles = libraryEpisode({
      id: "episode-missing-candles",
      direction: "long",
      executions: closedExecutions,
      netPnl: "10",
      returnPercent: "10",
      rMultiple: "1",
    });
    const partialInstrument = {
      ...xpev,
      id: "US:PARTIAL",
      symbol: "PARTIAL",
      name: "行情不完整股票",
    };
    const partialExecutions = closedExecutions.map((item) => ({
      ...item,
      id: `partial-${item.id}`,
      instrument: partialInstrument,
    }));
    const partial = libraryEpisode({
      id: "episode-partial",
      instrument: partialInstrument,
      direction: "long",
      executions: partialExecutions,
      netPnl: "10",
      returnPercent: "10",
      rMultiple: "1",
    });

    const result = buildInsightEpisodeFacts(
      [
        entry(xpev, [open, missingCandles]),
        entry(partialInstrument, [partial]),
      ],
      {
        "US:XPEV": [candle("2025-03-03", "11", "9", "10")],
        "US:PARTIAL": [
          {
            ...candle("2025-03-03", "11", "9", "10"),
            instrumentId: "US:PARTIAL",
          },
        ],
      },
      {
        "US:XPEV": "complete",
        "US:PARTIAL": "partial",
      } satisfies Record<string, MarketDataSyncStatus>,
      [],
    );

    expect(result.facts).toEqual([]);
    expect(result.excluded).toEqual([
      expect.objectContaining({
        episodeId: "episode-open",
        reason: "open-episode",
        reasonLabel: "持仓回合尚未结束",
      }),
      expect.objectContaining({
        episodeId: "episode-missing-candles",
        reason: "missing-episode-candles",
        reasonLabel: "回合起止日期缺少完整 K 线",
      }),
      expect.objectContaining({
        episodeId: "episode-partial",
        reason: "incomplete-market-data",
        reasonLabel: "本地行情覆盖不完整",
      }),
    ]);
  });
});
