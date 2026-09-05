import { describe, expect, it } from "vitest";

import { resolveHistoricalInstrumentIdentity } from "./historical-instrument-identity";

describe("historical instrument identity", () => {
  it("maps pre-inception US FB trades to Meta's historical ticker", () => {
    expect(
      resolveHistoricalInstrumentIdentity({
        market: "US",
        symbol: "FB",
        name: "ProShares S&P 500 Dynamic Buffer ETF",
        executedAt: [
          "2019-01-31T18:28:15.000Z",
          "2022-04-25T14:04:11.000Z",
        ],
      }),
    ).toEqual({
      displayName: "Meta Platforms, Inc. (historical FB)",
      marketDataSymbol: "META",
    });
  });

  it("keeps the current FB ETF identity after its inception", () => {
    expect(
      resolveHistoricalInstrumentIdentity({
        market: "US",
        symbol: "FB",
        name: "ProShares S&P 500 Dynamic Buffer ETF",
        executedAt: ["2025-07-01T14:30:00.000Z"],
      }),
    ).toBeUndefined();
  });

  it("does not remap unrelated symbols", () => {
    expect(
      resolveHistoricalInstrumentIdentity({
        market: "US",
        symbol: "META",
        name: "Meta Platforms, Inc.",
        executedAt: ["2022-04-25T14:04:11.000Z"],
      }),
    ).toBeUndefined();
  });
});
