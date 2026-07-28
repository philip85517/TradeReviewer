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

function fromFile(execution: TradeExecution, fingerprint: string, id: string) {
  return {
    ...execution,
    id,
    instrument: { ...execution.instrument },
    source: { ...execution.source, fileFingerprint: fingerprint },
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

  it("drops the same economic fill from overlapping exports", () => {
    const buy = execution(
      "statement-a:2",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );

    expect(
      mergeExecutions(
        [fromFile(buy, "file-a", "file-a:2")],
        [fromFile(buy, "file-b", "file-b:18")],
      ),
    ).toHaveLength(1);
  });

  it("preserves identical fills on separate rows in one export", () => {
    const buy = execution(
      "statement-a:2",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );

    expect(
      mergeExecutions([], [
        fromFile(buy, "file-a", "file-a:2"),
        fromFile(buy, "file-a", "file-a:3"),
      ]),
    ).toHaveLength(2);
  });

  it("keeps the maximum duplicate count regardless of import order", () => {
    const buy = execution(
      "statement-a:2",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );
    const oneFill = [fromFile(buy, "file-a", "file-a:2")];
    const twoFills = [
      fromFile(buy, "file-b", "file-b:2"),
      fromFile(buy, "file-b", "file-b:3"),
    ];

    expect(mergeExecutions(oneFill, twoFills)).toHaveLength(2);
    expect(mergeExecutions(twoFills, oneFill)).toHaveLength(2);
  });

  it("enriches an existing duplicate with a newly supplied stock name", () => {
    const buy = execution(
      "statement-a:2",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );
    const unresolved = fromFile(buy, "file-a", "file-a:2");
    unresolved.instrument.name = "名称待行情源补充";
    const resolved = fromFile(buy, "file-b", "file-b:2");
    resolved.instrument.name = "阿里巴巴";

    expect(mergeExecutions([unresolved], [resolved])[0].instrument.name).toBe(
      "阿里巴巴",
    );
  });

  it("preserves date-only source order for same-day executions", () => {
    const firstSourceRow = execution(
      "cms:z",
      "buy",
      "2026-02-24T07:00:00.000Z",
      "100",
    );
    firstSourceRow.source = {
      platform: "china-merchants",
      row: 12,
      sourceOrder: 0,
      timePrecision: "date-only",
    };
    const secondSourceRow = execution(
      "cms:a",
      "sell",
      "2026-02-24T07:00:00.000Z",
      "100",
    );
    secondSourceRow.source = {
      platform: "china-merchants",
      row: 11,
      sourceOrder: 1,
      timePrecision: "date-only",
    };

    expect(
      mergeExecutions([], [secondSourceRow, firstSourceRow]).map(
        (item) => item.id,
      ),
    ).toEqual(["cms:z", "cms:a"]);
  });
});
