import { describe, expect, it } from "vitest";

import type { StatementEvent } from "../import/monthly-statement";
import {
  collectBonusShareEvidence,
  isBonusShareEvidence,
} from "./bonus-share-evidence";

function event(overrides: Partial<StatementEvent> = {}): StatementEvent {
  return {
    id: "bonus-1",
    accountId: "account-1",
    market: "CN-SH",
    symbol: "516780",
    date: "2026-05-22",
    kind: "corporate-action",
    quantity: "10000",
    amount: "0",
    currency: "CNY",
    description: "红股入账 1.8900",
    source: [{ page: 15, row: 396, role: "corporate-action" }],
    ...overrides,
  };
}

describe("bonus-share-evidence", () => {
  it("accepts an explicitly zero-cash red-share event without using description prices", () => {
    expect(isBonusShareEvidence(event())).toBe(true);
    expect(isBonusShareEvidence(event({ amount: undefined }))).toBe(false);
    expect(isBonusShareEvidence(event({ amount: "1" }))).toBe(false);
    expect(isBonusShareEvidence(event({ description: "现金股息", quantity: "10000" }))).toBe(false);
  });

  it("deduplicates repeated references but reports distinct source copies", () => {
    const first = event();
    const sameReference = { ...first };
    const differentSource = event({
      id: "bonus-copy",
      source: [{ page: 15, row: 396, role: "corporate-action" }],
    });

    expect(collectBonusShareEvidence([first, sameReference, differentSource])).toMatchObject({
      events: [first],
      duplicateKeys: [expect.any(String)],
    });
  });

  it("treats numeric formatting and presentation text as the same source row", () => {
    const first = event({
      description: "红股入账 1.89",
      currency: "cny",
    });
    const differentPresentation = event({
      id: "bonus-copy",
      quantity: "10000.00",
      amount: "0.00",
      description: "红股入账 1.8900",
      currency: "CNY",
    });

    expect(collectBonusShareEvidence([first, differentPresentation])).toMatchObject({
      events: [first],
      duplicateKeys: [expect.any(String)],
    });
  });

  it("keeps same IDs distinct when account or instrument identity differs", () => {
    const foreignAccount = event({ accountId: "account-2" });
    const otherInstrument = event({ market: "CN-SZ", symbol: "000001" });

    expect(collectBonusShareEvidence([foreignAccount, event(), otherInstrument]).events).toHaveLength(3);
  });
});
