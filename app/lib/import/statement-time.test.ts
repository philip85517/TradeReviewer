import { describe, expect, it } from "vitest";
import { resolveStatementTime } from "./statement-time";

describe("monthly statement source-time evidence", () => {
  it.each([
    ["2024-03-08 09:30:00, US/Eastern", "2024-03-08T14:30:00Z"],
    ["2024-03-11 09:30:00, US/Eastern", "2024-03-11T13:30:00Z"],
    ["2024-11-04 09:30:00, US/Eastern", "2024-11-04T14:30:00Z"],
    ["2020-12-17 14:20:41, GMT+8", "2020-12-17T06:20:41Z"],
  ])("converts explicit %s", (text, executedAt) => {
    expect(resolveStatementTime({ text, market: "US" })).toMatchObject({ ok: true, executedAt, timeEvidence: "row" });
  });
  it("distinguishes Hong Kong source date from US local date", () => {
    expect(resolveStatementTime({ text: "2025/06/25 00:05:24", market: "US", documentTimezone: "Asia/Hong_Kong" })).toMatchObject({
      ok: true, executedAt: "2025-06-24T16:05:24Z", marketCalendarDate: "2025-06-24", timeEvidence: "document",
    });
  });
  it("attributes a documented overnight session independently of calendar/month", () => {
    expect(resolveStatementTime({ text: "2024-09-30 20:30:00", market: "US", documentTimezone: "market-local", overnightNextDay: true })).toMatchObject({
      ok: true, executedAt: "2024-10-01T00:30:00Z", marketCalendarDate: "2024-09-30", tradingDate: "2024-10-01",
    });
  });
  it.each([
    ["2024-03-10 02:30:00", "nonexistent-wall-clock"],
    ["2024-11-03 01:30:00", "ambiguous-wall-clock"],
    ["2024-02-30 10:00:00", "invalid-statement-time"],
    ["2024-02-01 25:00:00", "invalid-wall-clock"],
  ])("rejects invalid or nonunique %s", (text, code) => {
    expect(resolveStatementTime({ text, market: "US", rowTimezone: "US/Eastern" })).toMatchObject({ ok: false, code });
  });
  it("never infers source timezone from market alone", () => {
    expect(resolveStatementTime({ text: "2015-04-15 11:54:09", market: "US" })).toMatchObject({ ok: false, code: "missing-statement-timezone" });
  });
  it("retains explicit user provenance and does not override a row timezone", () => {
    expect(resolveStatementTime({ text: "2015-04-15 11:54:09", market: "US", options: { sourceTimezone: "Asia/Hong_Kong" } })).toMatchObject({ ok: true, timeEvidence: "user", executedAt: "2015-04-15T03:54:09Z" });
    expect(resolveStatementTime({ text: "2024-03-11 09:30:00, US/Eastern", market: "US", options: { sourceTimezone: "Asia/Hong_Kong", overrideDocumentTimezone: true } })).toMatchObject({ ok: true, timeEvidence: "row", executedAt: "2024-03-11T13:30:00Z" });
  });
  it("retains the inference rule and candidate evidence when inference is selected", () => {
    expect(resolveStatementTime({
      text: "2020-01-27 11:30:42",
      market: "US",
      inferredTimezone: "America/New_York",
      inferenceConfidence: 0.93,
      inferenceReason: "market session",
      inferenceRuleId: "futu/time/market-session@1",
      inferenceCandidates: [
        { timezone: "America/New_York", score: 0.93, evidence: ["market-session"] },
      ],
    })).toMatchObject({
      ok: true,
      timeRuleId: "futu/time/market-session@1",
      timeCandidates: [{ timezone: "America/New_York", score: 0.93 }],
    });
  });
  it("does not invent execution seconds for order time or date-only evidence", () => {
    expect(resolveStatementTime({ text: "2019-06-03 10:20:30", kind: "order", market: "US" })).toMatchObject({ ok: true, executedAt: "2019-06-03", timePrecision: "date-only", sourceTimeKind: "order" });
    expect(resolveStatementTime({ text: "2019-06-03", market: "HK" })).toMatchObject({ ok: true, executedAt: "2019-06-03", timePrecision: "date-only" });
  });
});
