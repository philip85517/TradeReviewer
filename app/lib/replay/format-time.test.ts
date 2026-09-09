import { describe, expect, it } from "vitest";

import {
  formatBeijingDate,
  formatBeijingDateTime,
  formatBeijingUnixSeconds,
  formatReplayCursor,
} from "./format-time";

describe("formatReplayCursor", () => {
  it("uses the product timezone instead of the server process timezone", () => {
    expect(formatReplayCursor("2025-01-21T20:00:00.000Z")).toBe(
      "2025年01月22日 04:00:00",
    );
  });

  it("formats all visible date-time values in Beijing time with seconds", () => {
    expect(formatBeijingDateTime("2025-01-21T20:00:00.000Z")).toBe(
      "2025年01月22日 04:00:00",
    );
    expect(formatBeijingDate("2025-01-21T20:00:00.000Z")).toBe(
      "2025年01月22日",
    );
  });

  it("formats chart epoch seconds in Beijing time", () => {
    expect(
      formatBeijingUnixSeconds(
        Date.parse("2026-08-31T01:30:00.000Z") / 1000,
      ),
    ).toBe("2026年08月31日 09:30:00");
  });
});
