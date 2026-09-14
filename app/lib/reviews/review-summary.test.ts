import { describe, expect, it } from "vitest";

import type { TradeLibraryEntry } from "../trades/library";
import type { EpisodeReviewRecord } from "./types";
import {
  buildReviewPhaseSummary,
  filterTradeLibraryEntriesByScope,
  reviewScopeOptions,
  trackedRuleCandidates,
  updateRuleCheck,
  type ReviewSummaryRange,
} from "./review-summary";

function review(
  episodeId: string,
  overrides: Partial<EpisodeReviewRecord["review"]> = {},
): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId,
    instrumentId: "US:AAA",
    updatedAt: "2026-08-02T00:00:00.000Z",
    plan: {
      thesis: "",
      expectedPath: "",
      invalidationCondition: "",
      targetRange: "",
      plannedRiskAmount: "",
      confidence: null,
    },
    review: {
      decisionQuality: null,
      executionQuality: null,
      riskManagement: "",
      psychology: "",
      reusableRule: "",
      completed: false,
      ...overrides,
    },
    confirmedTagIds: [],
  };
}

function entry(input: {
  id: string;
  accountId?: string;
  market?: string;
  currency?: string;
  nature?: "live" | "simulation" | "unknown";
  run?: string;
  startedAt?: string;
  endedAt?: string;
  netPnl?: string | null;
  fees?: string;
  pnlAvailable?: false;
  review?: EpisodeReviewRecord;
}): TradeLibraryEntry {
  const market = input.market ?? "US";
  const currency = input.currency ?? "USD";
  const accountId = input.accountId ?? "account-a";
  const nature = input.nature ?? "live";
  const startedAt = input.startedAt ?? "2026-08-01T15:00:00.000Z";
  const endedAt = input.endedAt;
  const instrument = {
    id: `${market}:${input.id}`,
    symbol: input.id,
    name: input.id,
    market,
    currency,
  };
  return {
    groupId: `${instrument.id}|${nature}|${input.run ?? ""}`,
    scopeKey: nature === "simulation" ? `simulation:${input.run}` : nature,
    tradeNature: nature,
    ...(input.run ? { simulationRunId: input.run } : {}),
    instrument,
    executions: [],
    episodes: [
      {
        episode: {
          id: input.id,
          accountId,
          accountLabel: accountId === "account-a" ? "主账户" : "其他账户",
          instrument,
          tradeNature: nature,
          ...(input.run ? { simulationRunId: input.run } : {}),
          direction: "long",
          status: endedAt ? "closed" : "open",
          startedAt,
          ...(endedAt ? { endedAt } : {}),
          openingQuantity: "1",
          remainingQuantity: endedAt ? "0" : "1",
          executions: [],
        },
        metrics: {
          ...(input.pnlAvailable === false ? { pnlAvailable: false as const } : {}),
          buyCount: 1,
          sellCount: endedAt ? 1 : 0,
          boughtQuantity: "1",
          soldQuantity: endedAt ? "1" : "0",
          grossExposure: "100",
          fees: input.fees ?? "1",
          realizedPnl: input.netPnl ?? "0",
          unrealizedPnl: endedAt ? "0" : null,
          netPnl: input.netPnl === undefined ? (endedAt ? "10" : null) : input.netPnl,
          returnPercent: input.netPnl === null ? null : "10",
          holdingMilliseconds: endedAt ? 86_400_000 : null,
        },
        review: input.review,
        reviewStatus: input.review?.review.completed ? "completed" : "pending",
        confirmedTagIds: [],
        tagDictionaryVersion: 1,
        rMultiple: null,
      },
    ],
    accountCount: 1,
    tradeCount: 2,
    episodeCount: 1,
    firstTradeAt: startedAt,
    lastTradeAt: endedAt ?? startedAt,
    status: endedAt ? "closed" : "open",
    netPnl: input.netPnl === undefined ? (endedAt ? "10" : null) : input.netPnl,
    returnPercent: input.netPnl === null ? null : "10",
    reviewedEpisodeCount: input.review?.review.completed ? 1 : 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
}

const ALL: ReviewSummaryRange = {
  id: "all",
  label: "全部",
  startDate: null,
  endDate: null,
};

describe("review phase summary", () => {
  it("totals trusted closed accounting without candles and isolates account, nature, run, market, and currency", () => {
    const desired = [
      entry({
        id: "one",
        endedAt: "2026-08-02T15:00:00.000Z",
        netPnl: "20",
        fees: "2",
        review: review("one", { completed: true, planAdherence: "followed" }),
      }),
      entry({
        id: "two",
        endedAt: "2026-08-04T15:00:00.000Z",
        netPnl: "-5",
        fees: "1",
        review: review("two", { planAdherence: "deviated" }),
      }),
      entry({ id: "open", startedAt: "2026-08-05T15:00:00.000Z" }),
    ];
    const incompatible = [
      entry({ id: "other-account", accountId: "account-b", endedAt: "2026-08-02T15:00:00.000Z", netPnl: "999" }),
      entry({ id: "hkd", currency: "HKD", endedAt: "2026-08-02T15:00:00.000Z", netPnl: "999" }),
      entry({ id: "simulation-a", nature: "simulation", run: "run-a", endedAt: "2026-08-02T15:00:00.000Z", netPnl: "999" }),
      entry({ id: "simulation-b", nature: "simulation", run: "run-b", endedAt: "2026-08-02T15:00:00.000Z", netPnl: "999" }),
      entry({ id: "hk-usd", market: "HK", endedAt: "2026-08-02T15:00:00.000Z", netPnl: "999" }),
      entry({ id: "untrusted", endedAt: "2026-08-06T15:00:00.000Z", netPnl: null, pnlAvailable: false }),
    ];
    const entries = [...desired, ...incompatible];
    const scope = reviewScopeOptions(entries).find(
      (option) =>
        option.scope.accountId === "account-a" &&
        option.scope.market === "US" &&
        option.scope.currency === "USD" &&
        option.scope.tradeNature === "live",
    );

    expect(scope).toBeDefined();
    const summary = buildReviewPhaseSummary(entries, scope!.id, ALL);

    expect(summary.scopeLabel).toContain("主账户");
    expect(summary.scopeLabel).toContain("实盘");
    expect(summary.scopeLabel).toContain("USD");
    expect(summary.episodeCount).toBe(4);
    expect(summary.reviewedCount).toBe(1);
    expect(summary.trustedClosedCount).toBe(2);
    expect(summary.netPnl).toBe("15");
    expect(summary.fees).toBe("3");
    expect(summary.planAdherence).toEqual({
      followed: 1,
      deviated: 1,
      noPlan: 0,
      unassessed: 2,
    });
  });

  it("uses episode end dates, and start dates only for open episodes", () => {
    const entries = [
      entry({ id: "closed", startedAt: "2026-01-01T15:00:00.000Z", endedAt: "2026-02-03T15:00:00.000Z" }),
      entry({ id: "open", startedAt: "2026-02-04T15:00:00.000Z" }),
    ];
    const scopeId = reviewScopeOptions(entries)[0].id;
    const summary = buildReviewPhaseSummary(entries, scopeId, {
      id: "custom:2026-02-01:2026-02-04",
      label: "2026-02-01—2026-02-04",
      startDate: "2026-02-01",
      endDate: "2026-02-04",
    });

    expect(summary.episodeIds).toEqual(["open", "closed"]);
  });
});

describe("review scope and tracked rules", () => {
  it("filters entries before insight computation without retaining incompatible episodes", () => {
    const entries = [
      entry({ id: "wanted", accountId: "account-a", endedAt: "2026-08-02T15:00:00.000Z" }),
      entry({ id: "other", accountId: "account-b", endedAt: "2026-08-02T15:00:00.000Z" }),
    ];
    const scopeId = reviewScopeOptions(entries).find(
      ({ scope }) => scope.accountId === "account-a",
    )!.id;

    expect(
      filterTradeLibraryEntriesByScope(entries, scopeId).flatMap((item) =>
        item.episodes.map(({ episode }) => episode.id),
      ),
    ).toEqual(["wanted"]);
  });

  it("offers only earlier tracked rules in the same account, market, nature, run, and currency", () => {
    const sourceReview = review("source", {
      completed: true,
      reusableRule: "突破后只在回踩确认时加仓",
      ruleTracking: true,
      ruleStatus: "observing",
    });
    const entries = [
      entry({ id: "source", nature: "simulation", run: "run-a", startedAt: "2026-08-01T15:00:00.000Z", endedAt: "2026-08-02T15:00:00.000Z", review: sourceReview }),
      entry({ id: "current", nature: "simulation", run: "run-a", startedAt: "2026-08-05T15:00:00.000Z", endedAt: "2026-08-06T15:00:00.000Z", review: review("current", { reusableRule: "不能成为自己的证据", ruleTracking: true }) }),
      entry({ id: "future", nature: "simulation", run: "run-a", startedAt: "2026-08-07T15:00:00.000Z", review: sourceReview }),
      entry({ id: "other-run", nature: "simulation", run: "run-b", startedAt: "2026-08-01T15:00:00.000Z", review: sourceReview }),
      entry({ id: "other-account", accountId: "account-b", nature: "simulation", run: "run-a", startedAt: "2026-08-01T15:00:00.000Z", review: sourceReview }),
      entry({ id: "other-currency", currency: "HKD", nature: "simulation", run: "run-a", startedAt: "2026-08-01T15:00:00.000Z", review: sourceReview }),
    ];

    expect(trackedRuleCandidates(entries, "current")).toEqual([
      expect.objectContaining({
        sourceEpisodeId: "source",
        ruleText: "突破后只在回踩确认时加仓",
        sourceUpdatedAt: sourceReview.updatedAt,
      }),
    ]);
  });

  it("keeps the first checked rule text and source revision immutable", () => {
    const first = {
      sourceEpisodeId: "source",
      sourceUpdatedAt: "2026-08-02T00:00:00.000Z",
      ruleText: "只在回踩确认时加仓",
      sourceInstrumentId: "US:AAA",
      sourceLabel: "AAA · 2026-08-01",
    };
    const initial = updateRuleCheck([], first, "followed");
    const changedSource = {
      ...first,
      sourceUpdatedAt: "2026-08-09T00:00:00.000Z",
      ruleText: "修改后的规则",
    };

    expect(updateRuleCheck(initial, changedSource, "deviated")).toEqual([
      {
        sourceEpisodeId: "source",
        sourceUpdatedAt: "2026-08-02T00:00:00.000Z",
        ruleText: "只在回踩确认时加仓",
        result: "deviated",
      },
    ]);
  });
  it("uses canonical entry nature for legacy episodes and filters insights by the same end-date range", () => {
    const first = entry({id:"old", endedAt:"2026-08-02T15:00:00Z"});
    first.episodes[0].episode.tradeNature = "unknown";
    const second = entry({id:"new", endedAt:"2026-09-02T15:00:00Z"});
    const entries=[first, second];
    const scopes=reviewScopeOptions(entries);
    expect(scopes).toHaveLength(1);
    expect(scopes[0].scope.tradeNature).toBe("live");
    expect(filterTradeLibraryEntriesByScope(entries, scopes[0].id, {id:"sep",label:"September",startDate:"2026-09-01",endDate:"2026-09-30"}).flatMap(value => value.episodes.map(item => item.episode.id))).toEqual(["new"]);
  });

  it("retains checked snapshots when an older source is cleared or no longer tracked", () => {
    const source = entry({id:"source",endedAt:"2026-08-02T15:00:00Z",review:review("source",{ruleTracking:false,reusableRule:""})});
    const check={sourceEpisodeId:"source",sourceUpdatedAt:"2026-08-02T00:00:00Z",ruleText:"原始规则",result:"followed" as const};
    const later = entry({id:"later",startedAt:"2026-09-01T15:00:00Z",endedAt:"2026-09-02T15:00:00Z",review:review("later",{ruleChecks:[check]})});
    const entries=[source,later];
    const result=buildReviewPhaseSummary(entries,reviewScopeOptions(entries)[0].id,{id:"sep",label:"September",startDate:"2026-09-01",endDate:"2026-09-30"});
    expect(result.trackedRules).toEqual([expect.objectContaining({ruleText:"原始规则",sourceEpisodeId:"source",checks:[{...check,episodeId:"later"}]})]);
  });

});
