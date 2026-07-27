import { describe, expect, it } from "vitest";

import { expectedTradingDates } from "./calendar";

describe("expectedTradingDates", () => {
  it.each([
    ["US", "2025-01-01", "2025-01-03", ["2025-01-02", "2025-01-03"]],
    ["HK", "2025-01-01", "2025-01-03", ["2025-01-02", "2025-01-03"]],
    [
      "CN-SH",
      "2025-01-27",
      "2025-02-05",
      ["2025-01-27", "2025-02-05"],
    ],
    [
      "CN-SZ",
      "2026-02-13",
      "2026-02-24",
      ["2026-02-13", "2026-02-24"],
    ],
  ] as const)(
    "uses the bundled %s exchange calendar",
    (market, start, end, expected) => {
      expect(expectedTradingDates(market, start, end)).toEqual(expected);
    },
  );
});
