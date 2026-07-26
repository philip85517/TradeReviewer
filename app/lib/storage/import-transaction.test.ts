import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TradeExecution } from "../trades/types";
import { loadImportedExecutions } from "./import-library";
import { loadImportHistory } from "./import-history";
import { persistImportBatch } from "./import-transaction";

const execution: TradeExecution = {
  id: "fill-1",
  source: { platform: "futu", row: 2 },
  accountId: "acct",
  accountLabel: "账户",
  instrument: {
    id: "US:NVDA",
    symbol: "NVDA",
    name: "英伟达",
    market: "US",
    currency: "USD",
  },
  side: "buy",
  executedAt: "2025-03-01T00:00:00.000Z",
  quantity: "1",
  price: "100",
  fee: "1",
};

describe("persistImportBatch", () => {
  beforeEach(() => window.localStorage.clear());

  it("rolls back executions if history persistence fails", () => {
    const originalSetItem = window.localStorage.setItem.bind(
      window.localStorage,
    );
    vi.spyOn(window.localStorage, "setItem").mockImplementation(
      (key, value) => {
        if (key === "trade-reviewer:import-history:v1") {
          throw new Error("quota");
        }
        originalSetItem(key, value);
      },
    );

    expect(() =>
      persistImportBatch([], [execution], {
        id: "batch",
        fileName: "trades.xlsx",
        importedAt: "2026-07-26T00:00:00.000Z",
        tradeCount: 1,
        instrumentCount: 1,
        excludedInstrumentCount: 0,
      }),
    ).toThrow("quota");
    expect(loadImportedExecutions()).toEqual([]);
    expect(loadImportHistory()).toEqual([]);
  });
});
