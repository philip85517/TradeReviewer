import { describe, expect, it } from "vitest";
import { buildReferenceReturnSummary, emptyReferenceCapitalState, normalizeReferenceCapitalDraft, referenceCapitalCoverage, upsertReferenceCapital, validateReferenceCapitalDraft } from "./reference-capital-model";

const draft = { nature: "live" as const, simulationRunId: null, accountId: "acct-1", currency: "CNY" as const, fromDate: "2026-01-01", toDate: "2026-12-31", amount: "10000" };
describe("reference capital v2", () => {
 it("validates dates, positive amounts, and simulation run identity", () => { expect(normalizeReferenceCapitalDraft({ ...draft, fromDate: "2026-02-30" })).toBeNull(); expect(normalizeReferenceCapitalDraft({ ...draft, amount: "0" })).toBeNull(); expect(normalizeReferenceCapitalDraft({ ...draft, nature: "simulation", simulationRunId: null })).toBeNull(); });
 it("rejects overlapping account/currency periods but isolates accounts and simulations", () => { const first = upsertReferenceCapital(emptyReferenceCapitalState(), draft); expect(validateReferenceCapitalDraft(first, { ...draft, fromDate: "2026-06-01" })).toContain("重叠"); expect(validateReferenceCapitalDraft(first, { ...draft, accountId: "acct-2" })).toBeNull(); expect(validateReferenceCapitalDraft(first, { ...draft, nature: "simulation", simulationRunId: "run-1" })).toBeNull(); });
 it("reports complete, partial, and missing coverage without fallback", () => { const state = upsertReferenceCapital(emptyReferenceCapitalState(), draft); expect(referenceCapitalCoverage(state, { nature: "live", simulationRunId: null, pairs: [{accountId:"acct-1",currency:"CNY"}], fromDate: "2026-03-01", toDate: "2026-09-01" }).status).toBe("complete"); expect(referenceCapitalCoverage(state, { nature: "live", simulationRunId: null, pairs: [{accountId:"acct-1",currency:"CNY"},{accountId:"acct-2",currency:"USD"}], fromDate: "2026-03-01", toDate: "2026-09-01" }).status).toBe("partial"); });
 it("returns an independent reference return and converts mixed currencies with an actual snapshot", () => { let state = upsertReferenceCapital(emptyReferenceCapitalState(), draft); state = upsertReferenceCapital(state, { ...draft, id: "usd", accountId: "acct-2", currency: "USD", amount: "20000" }); const input = { nature:"live" as const, simulationRunId:null, pairs:[{accountId:"acct-1",currency:"CNY"},{accountId:"acct-2",currency:"USD"}], fromDate:"2026-03-01", toDate:"2026-09-01", trustedClosedPnl:[{accountId:"acct-1",currency:"CNY",amount:"100"},{accountId:"acct-2",currency:"USD",amount:"200"}] }; const missing = buildReferenceReturnSummary(state, input); expect(missing.status).toBe("partial"); expect(missing.returnPercent).toBeNull(); const summary = buildReferenceReturnSummary(state, { ...input, fxRatesToCny: { USD: "7" } }); expect(summary.status).toBe("available"); expect(summary.returnPercent).toBe("1"); });
});


describe("reference capital currency boundaries", () => {
  it("computes a single foreign currency without requesting FX", () => {
    const state = upsertReferenceCapital(emptyReferenceCapitalState(), { ...draft, currency: "USD", amount: "1000" });
    expect(buildReferenceReturnSummary(state, { nature: "live", simulationRunId: null, pairs: [{ accountId: "acct-1", currency: "USD" }], fromDate: "2026-03-01", toDate: "2026-09-01", trustedClosedPnl: [{accountId: "acct-1", currency: "USD", amount: "100"}] }).returnPercent).toBe("10");
  });
  it("weights mixed currencies using actual rates and rejects invalid snapshots", () => {
    let state = upsertReferenceCapital(emptyReferenceCapitalState(), { ...draft, amount: "1000" });
    state = upsertReferenceCapital(state, { ...draft, accountId: "usd", currency: "USD", amount: "1000" });
    const input = { nature: "live" as const, simulationRunId: null, pairs: [{ accountId: "acct-1", currency: "CNY" }, {accountId: "usd", currency: "USD"}], fromDate: "2026-03-01", toDate: "2026-09-01", trustedClosedPnl: [{accountId: "acct-1", currency: "CNY", amount: "100"}, {accountId: "usd", currency: "USD", amount: "200"}] };
    expect(buildReferenceReturnSummary(state, {...input, fxRatesToCny: {USD: "7"}}).returnPercent).toBe("18.75");
    for (const rate of ["garbage", "Infinity", "NaN", "0", "-1"]) {
      expect(buildReferenceReturnSummary(state, {...input, fxRatesToCny: {USD: rate}}).returnPercent).toBeNull();
    }
  });
});
