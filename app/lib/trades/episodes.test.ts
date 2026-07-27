import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { buildTradeEpisodes } from "./episodes";
import type { TradeExecution } from "./types";

function execution(
  side: "buy" | "sell",
  executedAt: string,
  quantity: string,
  price: string,
): TradeExecution {
  return {
    id: `${side}-${executedAt}`,
    source: { platform: "demo", row: 1 },
    accountId: "acct-1",
    accountLabel: "演示账户",
    instrument: {
      id: "US:XPEV",
      symbol: "XPEV",
      name: "XPeng",
      market: "US",
      currency: "USD",
    },
    side,
    executedAt,
    quantity,
    price,
    fee: "0",
  };
}

function sumAllocatedFees(episodes: ReturnType<typeof buildTradeEpisodes>) {
  return episodes
    .flatMap((episode) => episode.executions)
    .reduce(
      (total, item) => total + Number(item.fee),
      0,
    );
}

describe("buildTradeEpisodes", () => {
  it("groups partial buys and sells until the position returns to zero", () => {
    const episodes = buildTradeEpisodes([
      execution("buy", "2025-01-02T14:30:00Z", "100", "10"),
      execution("buy", "2025-01-03T14:30:00Z", "50", "11"),
      execution("sell", "2025-01-08T14:30:00Z", "75", "12"),
      execution("sell", "2025-01-09T14:30:00Z", "75", "13"),
    ]);

    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({
      status: "closed",
      openingQuantity: "150",
      remainingQuantity: "0",
      startedAt: "2025-01-02T14:30:00Z",
      endedAt: "2025-01-09T14:30:00Z",
    });
    expect(episodes[0].executions).toHaveLength(4);
  });

  it("closes a long and opens a short when one sell crosses through zero", () => {
    const episodes = buildTradeEpisodes([
      execution("buy", "2025-01-02T14:30:00Z", "100", "10"),
      execution("sell", "2025-01-03T14:30:00Z", "150", "9"),
    ]);

    expect(episodes).toHaveLength(2);
    expect(episodes[0]).toMatchObject({
      direction: "long",
      status: "closed",
      remainingQuantity: "0",
    });
    expect(episodes[0].executions.at(-1)?.quantity).toBe("100");
    expect(episodes[1]).toMatchObject({
      direction: "short",
      status: "open",
      openingQuantity: "50",
      remainingQuantity: "50",
    });
    expect(episodes[1].executions[0].quantity).toBe("50");
  });

  it("uses source fingerprint, row, and id to stabilize equal-time executions", () => {
    const timestamp = "2025-01-02T14:30:00Z";
    const later = execution("buy", timestamp, "20", "11");
    later.id = "fill-z";
    later.source = {
      platform: "futu",
      fileFingerprint: "file-b",
      row: 1,
    };
    const first = execution("buy", timestamp, "10", "10");
    first.id = "fill-b";
    first.source = {
      platform: "futu",
      fileFingerprint: "file-a",
      row: 2,
    };
    const second = execution("buy", timestamp, "30", "12");
    second.id = "fill-a";
    second.source = {
      platform: "futu",
      fileFingerprint: "file-a",
      row: 2,
    };

    const [episode] = buildTradeEpisodes([later, first, second]);

    expect(episode.executions.map((item) => item.id)).toEqual([
      "fill-a",
      "fill-b",
      "fill-z",
    ]);
  });

  it("orders source rows before sheet names at the same timestamp", () => {
    const timestamp = "2025-01-02T14:30:00Z";
    const rowTwo = execution("buy", timestamp, "10", "10");
    rowTwo.id = "row-two";
    rowTwo.source = {
      platform: "futu",
      fileFingerprint: "same-file",
      sheet: "A",
      row: 2,
    };
    const rowOne = execution("buy", timestamp, "20", "10");
    rowOne.id = "row-one";
    rowOne.source = {
      platform: "futu",
      fileFingerprint: "same-file",
      sheet: "Z",
      row: 1,
    };

    const [episode] = buildTradeEpisodes([rowTwo, rowOne]);

    expect(episode.executions.map((item) => item.id)).toEqual([
      "row-one",
      "row-two",
    ]);
  });

  it("pairs canonical symbol aliases inside one account episode", () => {
    const buy = execution(
      "buy",
      "2025-01-02T14:30:00Z",
      "100",
      "300",
    );
    buy.instrument = {
      ...buy.instrument,
      id: "HK:0700",
      symbol: "0700",
      market: "HK",
    };
    const sell = execution(
      "sell",
      "2025-01-03T14:30:00Z",
      "100",
      "320",
    );
    sell.instrument = {
      ...sell.instrument,
      id: "HK:700",
      symbol: "700",
      market: "HK",
    };

    const episodes = buildTradeEpisodes([buy, sell]);

    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({
      status: "closed",
      remainingQuantity: "0",
    });
  });

  it("keeps episode IDs unique across same-time reversals", () => {
    const timestamp = "2025-01-02T14:30:00Z";
    const first = execution("buy", timestamp, "100", "10");
    first.id = "a-long";
    const reverseShort = execution("sell", timestamp, "200", "10");
    reverseShort.id = "b-short";
    const reverseLong = execution("buy", timestamp, "200", "10");
    reverseLong.id = "c-long";

    const episodes = buildTradeEpisodes([
      first,
      reverseShort,
      reverseLong,
    ]);

    expect(new Set(episodes.map((episode) => episode.id)).size).toBe(
      episodes.length,
    );
  });

  it("preserves the original fee exactly when a reversal fill is allocated", () => {
    const buy = execution(
      "buy",
      "2025-01-02T14:30:00Z",
      "1",
      "10",
    );
    const reverse = execution(
      "sell",
      "2025-01-03T14:30:00Z",
      "2",
      "10",
    );
    reverse.fee = "0.00000001";

    const episodes = buildTradeEpisodes([buy, reverse]);

    expect(sumAllocatedFees(episodes)).toBe(0.00000001);
  });

  it("keeps sub-cent reversal fee parts non-negative and Decimal-exact", () => {
    const buy = execution(
      "buy",
      "2025-01-02T14:30:00Z",
      "9",
      "10",
    );
    const reverse = execution(
      "sell",
      "2025-01-03T14:30:00Z",
      "10",
      "10",
    );
    reverse.fee = "0.000000009";

    const episodes = buildTradeEpisodes([buy, reverse]);
    const allocated = episodes.flatMap((episode) =>
      episode.executions
        .filter((item) => item.id.startsWith(reverse.id))
        .map((item) => new Decimal(item.fee)),
    );

    expect(
      allocated.every((fee) => fee.isPositive() || fee.isZero()),
    ).toBe(true);
    expect(
      allocated.reduce((total, fee) => total.plus(fee), new Decimal(0))
        .equals(reverse.fee),
    ).toBe(true);
  });
});
