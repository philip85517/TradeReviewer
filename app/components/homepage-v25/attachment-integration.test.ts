import { describe, expect, it } from "vitest";
import { createEmptyEpisodeReviewRecord } from "../../lib/reviews/review-metrics";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { TradeExecution } from "../../lib/trades/types";
import { holdingsCsv } from "./holdings-model";
import { homepageHoldingsFixture as buildHomepageHoldings } from "./holdings-test-fixture";

const scope = { live: true as const, market: "all" as const, accounts: ["*"], rangeMode: "all" as const };
const asOf = "2026-10-23T12:00:00Z";
const attachments = { categories: ["stock", "etf"], openOnly: false, pendingReview: [true] };
const metadata = { "HK:X": { market: "HK", symbol: "X", assetType: "stock" as const }, "HK:Y": { market: "HK", symbol: "Y", assetType: "etf" as const } };
function fill(accountId: string, symbol: string, side: "buy" | "sell" = "buy", day = "01"): TradeExecution {
  return { id: `${accountId}-${symbol}-${side}-${day}`, accountId, accountLabel: `账户${accountId}`,
    instrument: { id: `HK:${symbol}`, symbol, name: `${symbol}证券`, market: "HK", currency: "HKD" },
    side, executedAt: `2026-10-${day}T01:00:00Z`, quantity: "1", price: "100", fee: "2",
    source: { platform: "futu", row: 1, tradeNature: "live" } };
}
function source(fills: TradeExecution[], completed: string[] = []) {
  const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), {}, {});
  for (const item of entries.flatMap(entry => entry.episodes)) {
    if (!completed.includes(`${item.episode.accountId}/${item.episode.instrument.symbol}`)) continue;
    const review = createEmptyEpisodeReviewRecord(item.episode.id, item.episode.instrument.id);
    item.review = { ...review, review: { ...review.review, completed: true } };
  }
  return entries;
}

describe("owned homepage attachment consumer integration", () => {
  it("projects one canonical instrument entry while retaining separate eligible account episodes", () => {
    const entries = source([fill("A", "X"), fill("B", "X")]);
    const result = buildHomepageHoldings(entries, { scope, asOf, instrumentMetadata: metadata });
    expect(result.source.selectedEntries).toHaveLength(1);
    expect(result.source.selectedEntries[0].episodes.map(item => item.episode.accountId).sort()).toEqual(["A", "B"]);
    expect(result.rows).toHaveLength(2);
  });
  // Dropping the shared qualifier would admit the A/Y and B/X competitors into holdings and CSV.
  it("feeds holdings and CSV from the exact eligible account/instrument groups", () => {
    const entries = source([fill("A", "X"), fill("A", "Y"), fill("B", "X"), fill("B", "Y")], ["A/Y", "B/X"]);
    const result = buildHomepageHoldings(entries, { scope, asOf, instrumentMetadata: metadata, attachments, reviewSummariesComplete: true });
    expect(result.rows.map(row => [row.accountId, row.instrumentId]).sort()).toEqual([["A", "HK:X"], ["B", "HK:Y"]]);
    const csv = holdingsCsv(result.rows);
    expect(csv).toContain("X证券,HKEX:X,账户A");
    expect(csv).toContain("Y证券,HKEX:Y,账户B");
    expect(csv).not.toContain("Y证券,HKEX:Y,账户A");
    expect(csv).not.toContain("X证券,HKEX:X,账户B");
    expect(result.source.selectedEntries.flatMap(entry => entry.executions).map(item => item.id).sort()).toEqual(["A-X-buy-01", "B-Y-buy-01"]);
  });

  it("qualifies open exposure without quotes or unrealized money and retains complete selected histories", () => {
    const bought = fill("A", "X"), sold = fill("A", "X", "sell", "02"), later = fill("A", "X", "buy", "10");
    const entries = source([bought, sold, later, fill("B", "Y"), fill("B", "Y", "sell", "02")]);
    const result = buildHomepageHoldings(entries, { scope: { ...scope, rangeMode: "custom", from: "2026-10-10", to: "2026-10-23" }, asOf,
      instrumentMetadata: metadata, attachments: { categories: [], openOnly: true, pendingReview: [] }, reviewSummariesComplete: true });
    expect(result.rows.map(row => [row.accountId, row.instrumentId, row.quantity])).toEqual([["A", "HK:X", "1"]]);
    expect(result.rows[0].reportPnl).toBeNull();
    expect(result.source.selectedEntries.flatMap(entry => entry.executions)).toEqual([bought, sold, later]);
    expect(result.source.selectedEntries.flatMap(entry => entry.executions)[0]).not.toBe(bought);
    expect(result.source.selectedEntries.flatMap(entry => entry.executions).map(item => item.fee)).toEqual(["2", "2", "2"]);
    expect(result.source.selectedEntries.flatMap(entry => entry.episodes)).toHaveLength(2);
  });

  it("does not label completed-looking incomplete histories as pending=no or guess missing stock metadata", () => {
    const incomplete = fill("A", "X"); incomplete.source.historyIncomplete = ["missing opening history"];
    const entries = source([incomplete, fill("B", "Y")], ["A/X", "B/Y"]);
    const result = buildHomepageHoldings(entries, { scope, asOf, instrumentMetadata: metadata,
      attachments: { categories: [], openOnly: false, pendingReview: [false] }, reviewSummariesComplete: true });
    expect(result.rows.map(row => [row.accountId, row.instrumentId])).toEqual([["B", "HK:Y"]]);
    expect(result.source.receipt.reasons).toContain('group:["A","HK:X","live",null]:pending-review-unknown');
    const noMetadata = buildHomepageHoldings(entries, { scope, asOf, instrumentMetadata: {},
      attachments: { categories: ["stock"], openOnly: false, pendingReview: [] }, reviewSummariesComplete: true });
    expect(noMetadata.source.receipt.eligibleGroupKeys).toEqual([]);
  });

  it("uses Recall completion from its owned entries and resolves source identity to concrete instruments", () => {
    const entries = source([fill("A", "X"), fill("B", "Y")]);
    const item = entries.find(entry => entry.instrument.id === "HK:X")!.episodes[0];
    item.recallReview = { episodeId: item.episode.id, status: "completed", completedAt: asOf, updatedAt: asOf, text: "saved", snapshotCount: 0 };
    const result = buildHomepageHoldings(entries, { scope: { ...scope, symbolIdentity: "HKEX:X" }, asOf, instrumentMetadata: metadata,
      symbolInstrumentIds: ["HK:X"], attachments: { categories: [], openOnly: false, pendingReview: [false] }, reviewSummariesComplete: true });
    expect(result.rows.map(row => row.instrumentId)).toEqual(["HK:X"]);
    expect(result.source.selectedEntries[0].episodes[0].recallReview?.status).toBe("completed");
  });
});
