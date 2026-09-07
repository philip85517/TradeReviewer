import { describe, expect, it } from "vitest";

import type { TradeEpisode } from "../trades/types";
import {
  buildIntradaySyncRanges,
  mergeIntradayTimeRanges,
} from "./intraday-sync-ranges";

function episode(
  id: string,
  startedAt: string,
  endedAt: string,
): TradeEpisode {
  return {
    id,
    accountId: "account-1",
    accountLabel: "账户",
    instrument: {
      id: "HK:1810",
      symbol: "1810",
      name: "小米集团-W",
      market: "HK",
      currency: "HKD",
    },
    direction: "long",
    status: "closed",
    startedAt,
    endedAt,
    openingQuantity: "100",
    remainingQuantity: "0",
    executions: [],
  };
}

describe("intraday sync ranges", () => {
  it("creates a range for every trade episode", () => {
    const ranges = buildIntradaySyncRanges([
      episode(
        "episode-1",
        "2019-03-12T01:40:44.000Z",
        "2019-03-20T01:40:44.000Z",
      ),
      episode(
        "episode-2",
        "2025-12-22T01:53:39.000Z",
        "2025-12-29T01:53:39.000Z",
      ),
    ], "HK");

    expect(ranges).toHaveLength(2);
    expect(ranges[0]?.startTime).toContain("2019-");
    expect(ranges[1]?.startTime).toContain("2025-");
    expect(ranges[0]?.endTime).toContain("2019-");
    expect(ranges[1]?.endTime).toContain("2025-");
  });

  it("merges overlapping ranges without extending unrelated gaps", () => {
    expect(
      mergeIntradayTimeRanges([
        {
          startTime: "2025-01-01T00:00:00.000Z",
          endTime: "2025-01-03T23:59:59.999Z",
        },
        {
          startTime: "2025-01-03T12:00:00.000Z",
          endTime: "2025-01-05T23:59:59.999Z",
        },
        {
          startTime: "2025-02-01T00:00:00.000Z",
          endTime: "2025-02-02T23:59:59.999Z",
        },
      ]),
    ).toEqual([
      {
        startTime: "2025-01-01T00:00:00.000Z",
        endTime: "2025-01-05T23:59:59.999Z",
      },
      {
        startTime: "2025-02-01T00:00:00.000Z",
        endTime: "2025-02-02T23:59:59.999Z",
      },
    ]);
  });
});
