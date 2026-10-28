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

  it("retains equal-valued observations from separate export materials", () => {
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
    ).toEqual([
      fromFile(buy, "file-a", "file-a:2"),
      fromFile(buy, "file-b", "file-b:18"),
    ]);
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

  it("retains all three observations with distinct stable rows in either import order", () => {
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
    twoFills[1].source.row = 3;

    expect(mergeExecutions(oneFill, twoFills)).toEqual([
      oneFill[0], twoFills[0], twoFills[1],
    ]);
    expect(mergeExecutions(twoFills, oneFill)).toEqual([
      oneFill[0], twoFills[0], twoFills[1],
    ]);
  });

  it("retains the old observation alongside both rows from a larger new material", () => {
    const buy = execution(
      "statement-a:2",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );
    const existing = fromFile(buy, "old-file", "old-file:1");
    existing.source.row = 1;
    existing.source.sourceOrder = 1;
    const incoming = [7, 8].map((sourceOrder) => {
      const next = fromFile(
        buy,
        "new-file",
        `new-file:${sourceOrder}`,
      );
      next.source.row = sourceOrder;
      next.source.sourceOrder = sourceOrder;
      return next;
    });

    expect(
      mergeExecutions([existing], incoming).map(({ id }) => id),
    ).toEqual(["old-file:1", "new-file:7", "new-file:8"]);
    expect(mergeExecutions([existing], incoming)).toEqual([
      existing, incoming[0], incoming[1],
    ]);
  });

  it("round-trips the representative set chosen for a larger fill multiplicity", () => {
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
    const merged = mergeExecutions(oneFill, twoFills);

    saveImportedExecutions(merged);

    expect(loadImportedExecutions()).toEqual(merged);
  });

  it("enriches a stable execution name while retaining separate material observations", () => {
    const buy = execution(
      "statement-a:2",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );
    const unresolved = fromFile(buy, "file-a", "file-a:2");
    unresolved.instrument.name = "名称待行情源补充";
    const resolved = fromFile(buy, "file-a", "file-a:2");
    resolved.instrument.name = "阿里巴巴";

    expect(mergeExecutions([unresolved], [resolved])[0].instrument.name).toBe(
      "阿里巴巴",
    );
    expect(mergeExecutions([unresolved], [resolved])).toEqual([resolved]);

    const independent = fromFile(resolved, "file-b", "file-b:2");
    expect(mergeExecutions([unresolved], [independent])).toEqual([
      unresolved, independent,
    ]);
  });

  it("retains separate accounts and their original fee evidence", () => {
    const buy = execution(
      "statement-a:2",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );
    const statement = fromFile(buy, "statement", "statement:2");
    statement.accountId = "account-0855";
    statement.accountLabel = "Futu · 0855";
    statement.fee = "2.05";
    statement.source.inputKind = "statement";
    const screenshot = fromFile(buy, "image", "image:2");
    screenshot.accountId = "account-manual";
    screenshot.accountLabel = "Manual account";
    screenshot.fee = "0";
    screenshot.source.inputKind = "screenshot";

    expect(mergeExecutions([statement], [screenshot])).toEqual([
      screenshot, statement,
    ]);
  });

  it("retains an unknown-account observation beside richer statement metadata", () => {
    const buy = execution(
      "base",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );
    const screenshot = fromFile(buy, "image", "image:2");
    screenshot.accountId = "unknown";
    screenshot.accountLabel = "Unknown";
    screenshot.fee = "0";
    screenshot.instrument.name = "名称待行情源补充";
    screenshot.source.inputKind = "screenshot";
    const statement = fromFile(buy, "statement", "statement:2");
    statement.accountId = "account-0855";
    statement.accountLabel = "Futu · 0855";
    statement.fee = "2.05";
    statement.instrument.name = "阿里巴巴";
    statement.source.inputKind = "statement";

    expect(mergeExecutions([screenshot], [statement])).toEqual([
      screenshot, statement,
    ]);
    expect(mergeExecutions([statement], [screenshot])).toEqual([
      screenshot, statement,
    ]);
  });

  it("keeps different-core records at the same candidate instant", () => {
    const buy = fromFile(
      execution("buy", "buy", "2025-03-12T16:38:57.000Z", "20"),
      "statement",
      "statement:2",
    );
    const sell = fromFile(
      execution("sell", "sell", "2025-03-12T16:38:57.000Z", "20"),
      "image",
      "image:2",
    );

    expect(mergeExecutions([buy], [sell]).map(({ id }) => id)).toEqual([
      "image:2",
      "statement:2",
    ]);
  });

  it("preserves multiplicity for legacy rows without source evidence", () => {
    const buy = execution(
      "legacy:2",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );
    const second = { ...buy, id: "legacy:3", source: { ...buy.source, row: 3 } };

    expect(mergeExecutions([], [buy, second])).toEqual([buy, second]);
  });

  it("does not collapse legacy rows when a verified screenshot overlaps", () => {
    const legacy = execution(
      "legacy:2",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );
    const screenshot = fromFile(legacy, "image-source", "image:2");
    screenshot.source.inputKind = "screenshot";
    const secondLegacy = {
      ...legacy,
      id: "legacy:3",
      source: { ...legacy.source, row: 3 },
    };

    expect(mergeExecutions([legacy], [screenshot])).toHaveLength(2);
    expect(mergeExecutions([legacy, secondLegacy], [screenshot])).toHaveLength(
      3,
    );
  });

  it("still merges a repeated legacy execution with the same stable ID", () => {
    const legacy = execution(
      "legacy:2",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );
    const repeated = {
      ...legacy,
      source: { ...legacy.source },
      instrument: { ...legacy.instrument },
    };

    expect(mergeExecutions([legacy], [repeated])).toEqual([legacy]);
  });

  it("retains observations without treating platform and filename as verified identity", () => {
    const buy = execution(
      "base",
      "buy",
      "2025-03-12T16:38:57.000Z",
      "20",
    );
    const first = {
      ...buy,
      id: "same-file:2",
      source: { ...buy.source, fileName: "fills.xlsx", row: 2 },
    };
    const second = {
      ...buy,
      id: "same-file:3",
      source: { ...buy.source, fileName: "fills.xlsx", row: 3 },
    };
    const overlapping = {
      ...buy,
      id: "other-file:2",
      source: { ...buy.source, fileName: "overlap.xlsx", row: 2 },
    };

    expect(mergeExecutions([], [first, second])).toEqual([first, second]);
    expect(mergeExecutions([first], [overlapping])).toEqual([
      overlapping, first,
    ]);
  });

  it("loads all different-core conflict records from storage", () => {
    const buy = fromFile(
      execution("buy", "buy", "2025-03-12T16:38:57.000Z", "20"),
      "statement",
      "statement:2",
    );
    const changedQuantity = fromFile(
      execution("changed", "buy", "2025-03-12T16:38:57.000Z", "21"),
      "image",
      "image:2",
    );
    window.localStorage.setItem(
      "trade-reviewer:executions:v1",
      JSON.stringify({
        version: 1,
        executions: [
          buy,
          {
            id: "v1-partial",
            accountId: "acct",
            executedAt: "2025-03-12T16:38:57.000Z",
            quantity: "20",
            price: "137.65",
            instrument: { id: "US:BABA" },
            side: "buy",
          },
          changedQuantity,
        ],
      }),
    );

    expect(loadImportedExecutions().map(({ id }) => id)).toEqual([
      "image:2",
      "statement:2",
      "v1-partial",
    ]);
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

  it("keeps calendar-only historical fills before later timestamped fills", () => {
    const earlier = execution("date-only", "buy", "2019-06-03", "1");
    earlier.source.timePrecision = "date-only";
    const later = execution("timestamped", "sell", "2025-06-03T13:30:00Z", "1");
    expect(mergeExecutions([], [later, earlier]).map(e => e.id)).toEqual(["date-only", "timestamped"]);
    expect(earlier.executedAt).toBe("2019-06-03");
  });
});
