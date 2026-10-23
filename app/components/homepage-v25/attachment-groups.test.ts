import { describe, expect, it } from "vitest";
import { createEmptyEpisodeReviewRecord } from "../../lib/reviews/review-metrics";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries, type TradeLibraryEntry } from "../../lib/trades/library";
import type { TradeExecution } from "../../lib/trades/types";
import { qualifyHomepageAttachmentGroups, homepageAttachmentGroupKey, type HomepageAttachmentGroupIdentity, type HomepageAttachmentInput } from "./attachment-groups";

const scope = { live: true as const, market: "all" as const, accounts: ["*"], rangeMode: "all" as const };
const empty = { categories: [], openOnly: false, pendingReview: [] };
const asOf = "2026-10-23T12:00:00Z";
function fill(accountId: string, instrumentId: string, suffix = "buy", at = "2026-10-01T01:00:00Z"): TradeExecution {
  return { id: `${accountId}-${instrumentId}-${suffix}`, accountId, accountLabel: accountId,
    instrument: { id: instrumentId, symbol: instrumentId, name: instrumentId, market: "HK", currency: "HKD" },
    side: suffix === "sell" ? "sell" : "buy", executedAt: at, quantity: "1", price: "100", fee: "0",
    source: { platform: "futu", row: 1, tradeNature: "live" } };
}
function entries(fills: TradeExecution[]): TradeLibraryEntry[] {
  return buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), {}, {});
}
function identity(accountId: string, instrumentId: string): HomepageAttachmentGroupIdentity {
  return { accountId, instrumentId, nature: "live", simulationRunId: null };
}
function input(source: TradeLibraryEntry[], quantities: Array<[string, string, string | null]>): HomepageAttachmentInput {
  return { entries: source, scope, attachments: empty, asOf,
    current: { boundary: { asOf }, instruments: quantities.map(([a, i, quantity]) => ({ identity: identity(a, i), evidence: { current: { quantity, reasons: quantity === null ? ["quantity-unavailable"] : [] } } })) },
    episodeCoverage: new Map(quantities.map(([a, i]) => [homepageAttachmentGroupKey(identity(a, i)), { complete: true, reasons: [] }])),
    instrumentMetadata: { X: { market: "HK", symbol: "X", assetType: "stock" }, Y: { market: "HK", symbol: "Y", assetType: "etf" } } };
}
function review(source: TradeLibraryEntry[], account: string, instrument: string, state: "completed" | "deferred") {
  const item = source.flatMap(entry => entry.episodes).find(item => item.episode.accountId === account && item.episode.instrument.id === instrument)!;
  const record = createEmptyEpisodeReviewRecord(item.episode.id, instrument);
  item.review = { ...record, review: { ...record.review, completed: state === "completed", ...(state === "deferred" ? { deferredReason: "等待补充证据" } : {}) } };
}

describe("homepage attachment group qualification", () => {
  // A wrong independent account/instrument filter would admit A/Y and B/X.
  it("retains strict composite pending groups without an account × instrument cartesian product", () => {
    const source = entries([fill("A", "X"), fill("A", "Y"), fill("B", "X"), fill("B", "Y")]);
    review(source, "A", "Y", "completed"); review(source, "B", "X", "deferred");
    const result = qualifyHomepageAttachmentGroups({ ...input(source, [["A", "X", "1"], ["A", "Y", "1"], ["B", "X", "1"], ["B", "Y", "1"]]), attachments: { ...empty, pendingReview: [true] } });
    expect(result.eligibleGroups.map(group => [group.identity.accountId, group.identity.instrumentId])).toEqual([["A", "X"], ["B", "Y"]]);
    expect(result.executions.map(item => item.id).sort()).toEqual(["A-X-buy", "B-Y-buy"]);
    expect(result.groups.map(group => group.pendingReview.value)).toEqual([true, false, false, true]);
  });

  it("ORs category choices and ANDs category, open and pending dimensions", () => {
    const source = entries([fill("A", "X"), fill("B", "Y"), fill("C", "Y")]);
    review(source, "C", "Y", "completed");
    const raw = input(source, [["A", "X", "1"], ["B", "Y", "0"], ["C", "Y", "1"]]);
    expect(qualifyHomepageAttachmentGroups({ ...raw, attachments: { categories: ["stock", "etf"], openOnly: false, pendingReview: [] } }).eligibleGroups).toHaveLength(3);
    expect(qualifyHomepageAttachmentGroups({ ...raw, attachments: { categories: ["stock", "etf"], openOnly: true, pendingReview: [true] } }).executions.map(item => item.id)).toEqual(["A-X-buy"]);
  });

  it("uses canonical quantity for openOnly, including zero UF and missing quotes, and keeps unknown explicit", () => {
    const source = entries([fill("A", "X"), fill("B", "X"), fill("C", "X"), fill("D", "X")]);
    const raw = input(source, [["A", "X", "1"], ["B", "X", "-1"], ["C", "X", "0"], ["D", "X", null]]);
    const result = qualifyHomepageAttachmentGroups({ ...raw, attachments: { ...empty, openOnly: true } });
    // No unrealized amount or quote is supplied. Positive and short exposure are both open.
    expect(result.executions.map(item => item.accountId)).toEqual(["A", "B"]);
    expect(result.groups.find(group => group.identity.accountId === "D")?.open.value).toBeNull();
    expect(result.groups.find(group => group.identity.accountId === "D")?.exclusionReasons).toContain("open-unknown");
  });

  it("does not infer stock or pending=no from missing metadata or incomplete/missing episode evidence", () => {
    const source = entries([fill("A", "X"), fill("B", "X"), fill("C", "X")]);
    review(source, "A", "X", "completed"); review(source, "B", "X", "deferred");
    source[0].episodes = source[0].episodes.filter(item => item.episode.accountId !== "C");
    const raw = input(source, [["A", "X", "1"], ["B", "X", "1"], ["C", "X", "1"]]);
    const noCoverage = qualifyHomepageAttachmentGroups({ ...raw, episodeCoverage: new Map(), instrumentMetadata: {}, attachments: { ...empty, pendingReview: [false] } });
    expect(noCoverage.eligibleGroups).toEqual([]);
    expect(noCoverage.groups.every(group => group.pendingReview.value === null && group.category.value === null)).toBe(true);
    const known = qualifyHomepageAttachmentGroups({ ...raw, attachments: { ...empty, pendingReview: [false] } });
    expect(known.eligibleGroups.map(group => group.identity.accountId)).toEqual(["A", "B"]);
    expect(qualifyHomepageAttachmentGroups({ ...raw, instrumentMetadata: {}, attachments: { ...empty, categories: ["stock"] } }).eligibleGroups).toEqual([]);
  });

  it("keeps empty and double pending choices unrestricted and does not mutate either draft", () => {
    const source = entries([fill("A", "X")]); source[0].episodes = [];
    const raw = input(source, [["A", "X", null]]);
    const selected = { ...empty, pendingReview: [true, false, true] };
    expect(qualifyHomepageAttachmentGroups(raw).eligibleGroups).toHaveLength(1);
    expect(qualifyHomepageAttachmentGroups({ ...raw, attachments: selected }).eligibleGroups).toHaveLength(1);
    expect(selected.pendingReview).toEqual([true, false, true]);
  });

  it("retains full selected group history and evidence carriers rather than pending episodes or period-only fills", () => {
    const first = fill("A", "X"), sold = fill("A", "X", "sell", "2026-10-02T01:00:00Z"), later = fill("A", "X", "later", "2026-10-10T01:00:00Z");
    later.source.historyIncomplete = ["late statement evidence"];
    const source = entries([first, sold, later]);
    const completed = source[0].episodes[0];
    completed.review = { ...createEmptyEpisodeReviewRecord(completed.episode.id, "X"), review: { decisionQuality: null, executionQuality: null, riskManagement: "", psychology: "", reusableRule: "", completed: true } };
    const result = qualifyHomepageAttachmentGroups({ ...input(source, [["A", "X", "1"]]), scope: { ...scope, rangeMode: "custom", from: "2026-10-10", to: "2026-10-23" }, attachments: { ...empty, pendingReview: [true] } });
    expect(result.executions).toEqual([first, sold, later]);
    expect(result.executions[2]).toBe(later);
    expect(result.episodes).toEqual(source[0].episodes);
    expect(result.eligibleGroups[0].sources[0].entry).toBe(source[0]);
    expect(result.executions[2].source.historyIncomplete).toEqual(["late statement evidence"]);
  });

  it("filters explicit live/market/accounts without a date cut and never joins different nature or run groups", () => {
    const live = fill("A", "X"), sim = fill("A", "X", "sim"), unknown = fill("A", "X", "unknown"), other = fill("B", "X");
    sim.source.tradeNature = "simulation"; sim.source.simulationRunId = "run-a"; delete unknown.source.tradeNature;
    const result = qualifyHomepageAttachmentGroups({ ...input(entries([live, sim, unknown, other]), [["A", "X", "1"], ["B", "X", "1"]]), scope: { ...scope, accounts: ["A"], market: "hk" } });
    expect(result.executions.map(item => item.id)).toEqual(["A-X-buy"]);
    expect(result.groups).toHaveLength(1);
    expect(homepageAttachmentGroupKey(identity("A|B", "C"))).not.toBe(homepageAttachmentGroupKey(identity("A", "B|C")));
  });

  it("rejects stale canonical exposure and contradictory quantity evidence as unknown rather than selecting a first fact", () => {
    const raw = input(entries([fill("A", "X")]), [["A", "X", "1"]]);
    const stale = qualifyHomepageAttachmentGroups({ ...raw, current: { ...raw.current!, boundary: { asOf: "2026-10-22" } }, attachments: { ...empty, openOnly: true } });
    expect(stale.eligibleGroups).toEqual([]); expect(stale.groups[0].open.reasons).toContain("current-asof-mismatch");
    const conflict = qualifyHomepageAttachmentGroups({ ...raw, current: { boundary: { asOf }, instruments: [...raw.current!.instruments, { identity: identity("A", "X"), evidence: { current: { quantity: "0", reasons: [] } } }] }, attachments: { ...empty, openOnly: true } });
    expect(conflict.groups[0].open.value).toBeNull(); expect(conflict.eligibleGroups).toEqual([]);
  });
});
