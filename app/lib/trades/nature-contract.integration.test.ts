import { describe, expect, it } from "vitest";
import { buildInstrumentTradeSummaries } from "./instruments";
import { buildTradeEpisodes } from "./episodes";
import { buildTradeLibraryEntries, type TradeLibraryEpisode } from "./library";
import { tradeScopeKey, type TradeExecution } from "./types";
import { tradeNatureForReviewRow } from "../../components/library/library-browse-state";
import { buildReviewQueueSummary } from "../reviews/review-queue-summary";
import { reviewScopeOptions } from "../reviews/review-summary";
import { buildReviewQueue } from "../reviews/review-queue";
import { filterExecutionHistoryForEpisode } from "../reviews/shared-scope";
import { cashScopeFromExecution } from "../cash/cash-model";
import { explicitLiveEntries } from "../../components/homepage-v25/holdings-model";
import { homepageAttachmentEpisodeCoverage, qualifyHomepageAttachmentGroups } from "../../components/homepage-v25/attachment-groups";
import { buildHomepageV25PerformanceFromEntries } from "../reviews/homepage-v25-performance";

function fill(id: string, side: "buy" | "sell", source: Partial<TradeExecution["source"]> = {}): TradeExecution {
  return { id, side, accountId: "a", accountLabel: "A", instrument: { id: "HK:700", symbol: "700", name: "腾讯", market: "HK", currency: "HKD" },
    executedAt: side === "buy" ? "2026-01-02T02:00:00Z" : "2026-01-03T02:00:00Z", quantity: "1", price: "100", fee: "0",
    source: { platform: "tiger", row: side === "buy" ? 1 : 2, formatRuleId: "tiger/pdf/monthly-v1", fileFingerprint: "evidence", ...source } };
}
const library = (fills: TradeExecution[]) => buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), {}, {});
const attachments = (entries: ReturnType<typeof library>) => qualifyHomepageAttachmentGroups({ entries,
  scope: { live: true, market: "all", accounts: ["*"], rangeMode: "all" }, attachments: { categories: [], openOnly: false, pendingReview: [] },
  asOf: "2026-01-31T12:00:00Z", episodeCoverage: homepageAttachmentEpisodeCoverage(entries, "2026-01-31T12:00:00Z", true) });

describe("historical nature contract across existing consumers", () => {
  it("keeps historical identity and full history while new and old live scopes agree", () => {
    const fills = [fill("buy", "buy"), fill("sell", "sell")];
    const [entry] = library(fills), episode = entry.episodes[0].episode;
    const originalIdentity = `episode:${encodeURIComponent(JSON.stringify(["a:HK:700", fills[0].executedAt, "buy", "1", "100"]))}:1`;
    expect(episode).toMatchObject({ id: originalIdentity, tradeNature: "live" });
    expect(episode.executions.map(e => e.id)).toEqual(["buy", "sell"]);
    expect(entry).toMatchObject({ tradeNature: "live", tradingLabel: "实盘", groupId: "HK:700|unknown" });
    expect(entry.scopeKey).toBeUndefined();
    expect(tradeScopeKey(fills[0])).toBe("unknown");
    expect(buildReviewQueue([entry], { nature: "live" }).map(row => row.item.episode.id)).toEqual([episode.id]);
    expect(filterExecutionHistoryForEpisode(fills, episode)).toEqual(fills);
    expect(explicitLiveEntries([entry])).toHaveLength(1);
    expect(attachments([entry]).executions.map(e => e.id)).toEqual(["buy", "sell"]);
    expect(cashScopeFromExecution(fills[0])).toEqual({ nature: "live", simulationRunId: null });
    const result = buildHomepageV25PerformanceFromEntries({ entries: [entry], asOf: "2026-01-31", period: { start: "2026-01-01", end: "2026-01-31" }, targetCurrency: "HKD", scope: { nature: "live" } });
    expect(result.scope.includedExecutions).toBe(2);
    expect(result.scope.excludedExecutions).toBe(0);
  });

  it("does not upgrade a mixed episode by its first fill or its entry metadata", () => {
    const fills = [fill("buy", "buy"), fill("sell", "sell", { formatRuleId: "manual/verified-ipo-allotment@1" })];
    const [entry] = library(fills), episode = entry.episodes[0].episode;
    expect(episode.tradeNature).toBe("unknown");
    expect(entry).toMatchObject({ tradeNature: "unknown", tradingLabel: "交易性质未知" });
    expect(buildTradeEpisodes(fills)[0].executions.map(e => e.id)).toEqual(["buy", "sell"]);
    expect(filterExecutionHistoryForEpisode(fills, episode)).toEqual(fills);
    expect(explicitLiveEntries([entry])).toEqual([]);
    entry.tradeNature = "live";
    expect(buildReviewQueue([entry], { nature: "live" })).toEqual([]);
    expect(buildReviewQueue([entry], { nature: "unknown" })).toHaveLength(1);
    expect([...homepageAttachmentEpisodeCoverage([entry], "2026-01-31T12:00:00Z", true).values()].every(value => !value.complete)).toBe(true);
  });

  it("does not inherit a live entry label when an empty episode has no declared nature", () => {
    const [entry] = library([fill("buy", "buy"), fill("sell", "sell")]);
    const item: TradeLibraryEpisode = { ...entry.episodes[0], episode: { ...entry.episodes[0].episode, executions: [], tradeNature: undefined } };
    expect(tradeNatureForReviewRow({ entry, item })).toBe("unknown");
    item.episode.tradeNature = "unknown";
    expect(tradeNatureForReviewRow({ entry, item })).toBe("unknown");
    item.episode.tradeNature = "live";
    expect(tradeNatureForReviewRow({ entry, item })).toBe("live");
    item.episode.tradeNature = "simulation";
    expect(tradeNatureForReviewRow({ entry, item })).toBe("simulation");
  });

  it("allows a supported episode inside a mixed entry without leaking the unknown episode into live", () => {
    const fills = [fill("buy", "buy"), fill("sell", "sell"), { ...fill("unknown", "buy", { formatRuleId: undefined }), executedAt: "2026-01-04T02:00:00Z" }];
    const [entry] = library(fills);
    expect(entry.tradeNature).toBe("unknown");
    const rows = buildReviewQueue([entry], { nature: "all" });
    expect(rows.map(tradeNatureForReviewRow).sort()).toEqual(["live", "unknown"]);
    expect(buildReviewQueueSummary(rows).groups.map(group => group.tradeNature).sort()).toEqual(["live", "unknown"]);
    expect(reviewScopeOptions([entry]).map(option => option.scope.tradeNature).sort()).toEqual(["live", "unknown"]);
    expect(buildReviewQueue([entry], { nature: "live" }).map(row => row.item.episode.executions.map(e => e.id))).toEqual([["buy", "sell"]]);
    expect(buildReviewQueue([entry], { nature: "unknown" }).map(row => row.item.episode.executions.map(e => e.id))).toEqual([["unknown"]]);
  });
});
