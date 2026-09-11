import { describe, expect, it } from "vitest";
import { buildTradeLibraryEntries } from "../trades/library";
import { buildInstrumentTradeSummaries } from "../trades/instruments";
import type { TradeExecution } from "../trades/types";
import { createEmptyEpisodeReviewRecord } from "./review-metrics";
import { buildReviewQueue } from "./review-queue";

const instrument = {id:"CN-SH:TEST",name:"测试ETF",symbol:"TEST",market:"CN-SH",currency:"CNY"};
function pair(accountId: string, date: string): TradeExecution[] {
  return (["buy", "sell"] as const).map((side,i) => ({id:`${accountId}-${date}-${side}`,accountId,accountLabel:accountId,instrument,side,executedAt:`${date}T0${i+1}:00:00Z`,quantity:"100",price:i ? "11" : "10",fee:"1",source:{platform:"china-merchants",row:i}}));
}
export function queueFixtures() {
  return buildTradeLibraryEntries(buildInstrumentTradeSummaries([...pair("A","2025-01-02"), ...pair("B","2026-01-02"), ...pair("A","2026-02-02")]),{},{});
}

describe("review queue", () => {
  it("filters actual episodes by account and year instead of leaking sibling episodes", () => {
    const queue = buildReviewQueue(queueFixtures(), {account:"A", year:"2026", status:"all"});
    expect(queue).toHaveLength(1);
    expect(queue[0].item.episode.startedAt).toBe("2026-02-02T01:00:00Z");
  });
  it("keeps completion and deferral distinct and orders pending episodes newest first", () => {
    const entries = queueFixtures();
    const all = entries.flatMap(entry => entry.episodes);
    const old = all.find(item => item.episode.startedAt.startsWith("2025"))!;
    old.review = createEmptyEpisodeReviewRecord(old.episode.id, instrument.id);
    old.review.review.completed = true;
    const deferred = all.find(item => item.episode.accountId === "B")!;
    deferred.review = createEmptyEpisodeReviewRecord(deferred.episode.id, instrument.id);
    deferred.review.review.deferredReason = "等待补充资料";
    expect(buildReviewQueue(entries, {status:"pending"}).map(row => row.item.episode.startedAt)).toEqual(["2026-02-02T01:00:00Z"]);
    expect(buildReviewQueue(entries, {status:"completed"})).toHaveLength(1);
    expect(buildReviewQueue(entries, {status:"all"})).toHaveLength(3);
  });
});
