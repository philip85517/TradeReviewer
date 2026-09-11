import { describe, expect, it } from "vitest";

import type { TradeExecution } from "../trades/types";
import type { EnrichedImportResult } from "./enrich-import";
import { assessMonthlyReimport } from "./monthly-reimport";
import type { MonthlyStatement } from "./monthly-statement";

const monthly: MonthlyStatement = {
  documentId: "futu:statement",
  month: "2020-12",
  templateIds: ["F4"],
  positions: [],
  events: [],
  reviewRequired: false,
};

function execution(
  id: string,
  overrides: Partial<TradeExecution> = {},
): TradeExecution {
  return {
    id,
    accountId: "account",
    accountLabel: "账户",
    instrument: {
      id: "US:ACB",
      symbol: "ACB",
      name: "名称待行情源补充",
      market: "US",
      currency: "USD",
    },
    side: "buy",
    executedAt: "2020-12-01T14:30:00.000Z",
    quantity: "10",
    price: "2",
    fee: "1",
    source: {
      platform: "futu",
      fileFingerprint: "statement",
      page: 1,
      row: 2,
      sourceOrder: 1,
    },
    ...overrides,
  };
}

function unresolvedEnrichment(
  importable: TradeExecution[] = [],
): EnrichedImportResult {
  return {
    broker: "futu",
    monthly,
    importable,
    unresolved: [{ market: "US", symbol: "ACB", attempts: [] }],
    exclusions: [{
      category: "unknown-asset",
      label: "无法确认属于股票或 ETF",
      count: 1,
      instrumentSymbol: "ACB",
    }],
    diagnostics: [],
    cacheHits: 0,
  };
}

describe("assessMonthlyReimport", () => {
  it("reuses stored rows for an exact same-file retry", () => {
    const stored = execution("fill-1", {
      instrument: {
        ...execution("fill-1").instrument,
        name: "历史证券名称",
      },
    });
    const incoming = execution("fill-1");

    const result = assessMonthlyReimport(
      [stored],
      [incoming],
      unresolvedEnrichment(),
      monthly,
    );

    expect(result.idempotent).toBe(true);
    expect(result.enriched.importable).toEqual([stored]);
    expect(result.enriched.unresolved).toEqual([]);
    expect(result.enriched.exclusions).toEqual([]);
  });

  it("does not classify a partial or corrected file as idempotent", () => {
    const stored = execution("fill-1");
    const corrected = execution("fill-1", {
      executedAt: "2020-12-01T14:31:00.000Z",
    });

    expect(
      assessMonthlyReimport(
        [stored],
        [corrected],
        unresolvedEnrichment([corrected]),
        monthly,
      ).idempotent,
    ).toBe(false);
    expect(
      assessMonthlyReimport(
        [stored],
        [stored, execution("fill-2")],
        unresolvedEnrichment(),
        monthly,
      ).idempotent,
    ).toBe(false);
  });
});
