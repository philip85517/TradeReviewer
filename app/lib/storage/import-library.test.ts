import { beforeEach, describe, expect, it } from "vitest";

import type { TradeExecution } from "../trades/types";
import {
  loadImportedExecutions,
  mergeExecutions,
  saveImportedExecutions,
} from "./import-library";

function execution(
  id: string,
  side: "buy" | "sell",
  executedAt: string,
  quantity: string,
): TradeExecution {
  return {
    id,
    source: { platform: "futu", row: 2 },
    accountId: "acct",
    accountLabel: "富途 · 0855",
    instrument: {
      id: "US:BABA",
      symbol: "BABA",
      name: "BABA",
      market: "US",
      currency: "USD",
    },
    side,
    executedAt,
    quantity,
    price: "137.65",
    fee: "2.05",
  };
}

describe("import execution library", () => {
  beforeEach(() => window.localStorage.clear());

  it("unions imports by stable execution id before episode rebuilding", () => {
    const buy = execution(
      "statement-a:2",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );
    const sell = execution(
      "statement-b:7",
      "sell",
      "2025-04-10T06:20:00.000Z",
      "20",
    );

    expect(mergeExecutions([buy], [buy, sell])).toEqual([buy, sell]);
  });

  it("round-trips normalized executions and drops malformed values", () => {
    const buy = execution(
      "statement-a:2",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );
    saveImportedExecutions([buy, buy]);
    expect(loadImportedExecutions()).toEqual([buy]);

    window.localStorage.setItem(
      "trade-reviewer:executions:v1",
      JSON.stringify({ version: 1, executions: [{ nope: true }] }),
    );
    expect(loadImportedExecutions()).toEqual([]);
  });
});
