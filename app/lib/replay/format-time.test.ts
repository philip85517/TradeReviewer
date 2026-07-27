import { describe, expect, it } from "vitest";

import { formatReplayCursor } from "./format-time";

describe("formatReplayCursor", () => {
  it("uses the product timezone instead of the server process timezone", () => {
    expect(formatReplayCursor("2025-01-21T20:00:00.000Z")).toBe(
      "01/22 04:00",
    );
  });
});
