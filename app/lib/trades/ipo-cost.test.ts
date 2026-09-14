import { describe, expect, it } from "vitest";

import { resolveIpoAcquisitionCost } from "./ipo-cost";
import type { StatementEvent } from "../import/monthly-statement";

function event(overrides: Partial<StatementEvent>): StatementEvent {
  const result: StatementEvent = {
    id: overrides.id ?? "event",
    accountId: overrides.accountId ?? "acct-1",
    market: overrides.market ?? "HK",
    symbol: overrides.symbol ?? "02050",
    date: overrides.date ?? "2025-06-19",
    kind: overrides.kind ?? "ipo",
    amount: overrides.amount,
    quantity: overrides.quantity,
    currency: overrides.currency ?? "HKD",
    description: overrides.description ?? "IPO evidence",
    source: [],
  };
  if ("market" in overrides) result.market = overrides.market;
  if ("symbol" in overrides) result.symbol = overrides.symbol;
  if ("currency" in overrides) result.currency = overrides.currency;
  return result;
}

describe("resolveIpoAcquisitionCost", () => {
  it("R4 treats compatible unscoped fees as uncertainty without absorbing unrelated fees", () => {
    const allocation = event({ id: "allocation", quantity: "500" });
    const base = [allocation,
      event({ id: "application", amount: "-10000", description: "IPO Application" }),
      event({ id: "refund", amount: "5000", description: "IPO Refund" }),
    ];
    const fee = event({ id: "unassigned", kind: "fee", amount: "-100", symbol: undefined, market: undefined, currency: undefined, description: "IPO fee" });
    expect(resolveIpoAcquisitionCost(allocation, [...base, fee])).toBeUndefined();
    for (const unrelated of [
      { ...fee, symbol: "09999", market: "HK" },
      { ...fee, currency: "USD" },
      { ...fee, market: "US" },
      { ...fee, accountId: "other" },
      { ...fee, date: "2024-01-01" },
    ]) expect(resolveIpoAcquisitionCost(allocation, [...base, unrelated])).toMatchObject({ cashCost: "5000", feeCost: "0", evidenceIds: ["application", "refund"] });
    expect(fee.symbol).toBeUndefined();
  });
  it("derives total and unit cost from uniquely linked cross-month cash evidence", () => {
    const allocation = event({ id: "allocation", date: "2025-06-19", quantity: "500", amount: "11265", currency: undefined, description: "IPO allotment" });
    const events = [
      allocation,
      event({ id: "application", date: "2025-05-20", amount: "-68271.65", description: "Dr. - IPO FINANCING App #02050" }),
      event({ id: "fee", date: "2025-05-20", kind: "fee", amount: "-100", description: "Dr. IPO Application Handling Fee - #02050" }),
      event({ id: "refund", date: "2025-06-19", amount: "56893.04", description: "Cr. - IPO Refund Amount - #02050" }),
    ];
    const result = resolveIpoAcquisitionCost(allocation, events);
    expect(resolveIpoAcquisitionCost(allocation, events, [], "HKD")).toEqual(result);

    expect(result).toMatchObject({
      cashCost: "11378.61",
      feeCost: "100",
      totalCost: "11478.61",
      unitCost: "22.95722",
      evidenceIds: ["application", "fee", "refund"],
    });
  });

  it("requires a unique allocation and never attributes a fee without a symbol", () => {
    const allocation = event({ id: "allocation-a", date: "2025-06-19", quantity: "500", amount: "11265" });
    expect(resolveIpoAcquisitionCost(allocation, [
      allocation,
      event({ id: "allocation-b", date: "2025-06-20", quantity: "100", amount: "2300" }),
      event({ id: "application", date: "2025-06-01", amount: "-10000", description: "IPO Application Amount - #02050" }),
      event({ id: "refund", date: "2025-06-19", amount: "5000", description: "IPO Refund Amount - #02050" }),
      event({ id: "unscoped-fee", market: undefined, symbol: undefined, kind: "fee", amount: "-100", description: "IPO Application Handling Fee" }),
    ])).toBeUndefined();
  });

  it("isolates account, market, and currency when selecting cash evidence", () => {
    const allocation = event({ id: "allocation", date: "2025-06-19", quantity: "500", amount: "11265" });
    const result = resolveIpoAcquisitionCost(allocation, [
      allocation,
      event({ id: "application", amount: "-10000", description: "IPO Application Amount - #02050" }),
      event({ id: "refund", amount: "5000", description: "IPO Refund Amount - #02050" }),
      event({ id: "other-account", accountId: "other", amount: "-999", description: "IPO Application Amount - #02050" }),
      event({ id: "other-currency", currency: "USD", amount: "-999", description: "IPO Application Amount - #02050" }),
      event({ id: "other-market", market: "US", amount: "-999", description: "IPO Application Amount - #02050" }),
    ]);

    expect(result?.totalCost).toBe("5000");
    expect(result?.evidenceIds).toEqual(["application", "refund"]);
  });

  it("requires explicit refund semantics and one ordered application/refund pair", () => {
    const allocation = event({ id: "allocation", date: "2025-06-19", quantity: "500", amount: "11265" });
    const base = [
      allocation,
      event({ id: "application", date: "2025-06-01", amount: "-10000", description: "IPO Application Amount - #02050" }),
      event({ id: "refund", date: "2025-06-19", amount: "5000", description: "IPO Refund Amount - #02050" }),
    ];
    expect(resolveIpoAcquisitionCost(allocation, [
      ...base,
      event({ id: "bonus", date: "2025-06-19", amount: "100", description: "IPO Bonus Credit - #02050" }),
    ])?.evidenceIds).toEqual(["application", "refund"]);
    expect(resolveIpoAcquisitionCost(allocation, [
      ...base,
      event({ id: "cancelled-application", date: "2025-06-02", amount: "-2000", description: "IPO Application Amount - #02050" }),
      event({ id: "cancelled-refund", date: "2025-06-03", amount: "2000", description: "IPO Refund Amount - #02050" }),
    ])).toBeUndefined();
    expect(resolveIpoAcquisitionCost(allocation, [
      allocation,
      event({ id: "late-application", date: "2025-06-20", amount: "-10000", description: "IPO Application Amount - #02050" }),
      event({ id: "late-refund", date: "2025-06-21", amount: "5000", description: "IPO Refund Amount - #02050" }),
    ])).toBeUndefined();
  });

  it("keeps an over-window cash trail unknown", () => {
    const allocation = event({ id: "allocation", date: "2025-06-19", quantity: "500", amount: "11265" });
    expect(resolveIpoAcquisitionCost(allocation, [
      allocation,
      event({ id: "application", date: "2025-04-01", amount: "-10000", description: "IPO Application Amount - #02050" }),
      event({ id: "refund", date: "2025-06-19", amount: "5000", description: "IPO Refund Amount - #02050" }),
    ])).toBeUndefined();
  });

  it("does not guess a missing cash currency from the instrument currency", () => {
    const allocation = event({ id: "allocation", date: "2025-06-19", quantity: "500", amount: "11265", currency: undefined });
    expect(resolveIpoAcquisitionCost(allocation, [
      allocation,
      event({ id: "application", date: "2025-06-01", amount: "-10000", currency: undefined, description: "IPO Application Amount - #02050" }),
      event({ id: "refund", date: "2025-06-19", amount: "5000", currency: undefined, description: "IPO Refund Amount - #02050" }),
    ], [], "HKD")).toBeUndefined();
  });
});
