import { describe, expect, it } from "vitest";
import type { TradeExecution } from "../trades/types";
import { buildCashSummary, type CashBaselineRecord } from "./cash-model";

const scope = { nature: "live", simulationRunId: null } as const;
const baseline: CashBaselineRecord = {
  id: "review-baseline", scope, accountId: "review-account", currency: "CNY",
  balance: "100000", asOf: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-26T00:00:00.000Z",
};
function execution(id: string, executedAt: string, feeStatus: "reported" | "unknown" = "reported", instrumentId = "CN-SH:600000"): TradeExecution {
  const symbol = instrumentId.split(":").at(-1) ?? instrumentId;
  return {
    id, accountId: "review-account", accountLabel: "Review account",
    instrument: { id: instrumentId, symbol, name: symbol, market: "CN-SH", currency: "CNY" },
    side: "sell", executedAt, quantity: "10", price: "100", fee: "1",
    source: { platform: "review", row: 1, tradeNature: "live", tradingDate: executedAt.slice(0, 10), feeStatus },
  };
}
const input = {
  baselines: [baseline], scope, accountIds: ["review-account"], today: "2026-09-26",
};

describe("independent cash review counterexamples", () => {
  it("does not downgrade a manual baseline for a proven earlier trade with missing metadata", () => {
    const result = buildCashSummary({
      ...input, executions: [execution("old-trade", "2026-08-01T03:00:00.000Z")], instrumentMetadata: new Map(),
    });
    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "100000" });
    expect(result.cashTotalStatus).toBe("available");
    expect(result.todayProceedsStatus).toBe("zero");
  });

  it("retains a partial trusted subtotal when one of today's sells has unknown fees", () => {
    const result = buildCashSummary({
      ...input,
      executions: [execution("known", "2026-09-26T03:00:00.000Z"), execution("unknown", "2026-09-26T04:00:00.000Z", "unknown")],
      instrumentMetadata: new Map([["CN-SH:600000", { market: "CN-SH", symbol: "600000", assetType: "stock" as const }]]),
    });
    expect(result.todayProceeds.originalByCurrency).toEqual({ CNY: "999" });
    expect(result.todayProceedsStatus).toBe("partial");
    expect(result.cashTotalStatus).toBe("partial");
  });

  it("keeps a covered total gap while retaining a same-day missing-metadata proceeds gap", () => {
    const result = buildCashSummary({
      ...input,
      baselines: [{ ...baseline, asOf: "2026-09-26T12:00:00.000Z" }],
      executions: [execution("today-missing-metadata", "2026-09-26T03:00:00.000Z", "reported", "CN-SH:600001")],
      instrumentMetadata: new Map(),
    });
    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "100000" });
    expect(result.cashTotalStatus).toBe("available");
    expect(result.todayProceedsStatus).toBe("unavailable");
  });

  it("marks a mixed covered metadata gap partial while preserving the reliable proceeds", () => {
    const result = buildCashSummary({
      ...input,
      baselines: [{ ...baseline, asOf: "2026-09-26T12:00:00.000Z" }],
      executions: [
        execution("today-missing-metadata", "2026-09-26T03:00:00.000Z", "reported", "CN-SH:600001"),
        execution("today-known", "2026-09-26T04:00:00.000Z"),
      ],
      instrumentMetadata: new Map([["CN-SH:600000", { market: "CN-SH", symbol: "600000", assetType: "stock" as const }]]),
    });
    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "100000" });
    expect(result.cashTotalStatus).toBe("available");
    expect(result.todayProceeds.originalByCurrency).toEqual({ CNY: "999" });
    expect(result.todayProceedsStatus).toBe("partial");
  });
});
