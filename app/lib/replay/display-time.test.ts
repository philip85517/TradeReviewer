import { describe, expect, it } from "vitest";

import { displayTimeForCandle } from "./display-time";

const candles = [
  { time: "2025-01-10T01:30:00.000Z" },
  { time: "2025-01-10T02:30:00.000Z" },
  { time: "2025-01-11T01:30:00.000Z" },
];

describe("displayTimeForCandle", () => {
  it("anchors session-open records to the first candle of the trading date", () => {
    expect(
      displayTimeForCandle(candles, {
        at: "2025-01-10T05:30:00.000Z",
        policy: "session-open",
      }),
    ).toBe("2025-01-10T01:30:00.000Z");
  });

  it("uses the first candle in the statement month for month-only events", () => {
    expect(
      displayTimeForCandle(candles, {
        at: "2025-01-31",
        policy: "session-open",
      }),
    ).toBe("2025-01-10T01:30:00.000Z");
  });

  it("keeps exact execution records on the latest candle not after the execution", () => {
    expect(
      displayTimeForCandle(candles, {
        at: "2025-01-10T02:00:00.000Z",
        policy: "execution-time",
      }),
    ).toBe("2025-01-10T01:30:00.000Z");
  });
});
