import { describe, expect, it } from "vitest";

import { wallClockToInstant } from "./time";

describe("wallClockToInstant", () => {
  it("converts a confirmed HK wall clock to an exact UTC second", () => {
    expect(
      wallClockToInstant("24/06/05 14:39:25", "Asia/Hong_Kong"),
    ).toEqual({
      ok: true,
      executedAt: "2024-06-05T06:39:25Z",
    });
  });

  it("rejects nonexistent New York wall time", () => {
    expect(
      wallClockToInstant("24/03/10 02:30:00", "America/New_York"),
    ).toEqual({ ok: false, code: "nonexistent-wall-clock" });
  });

  it("requires earlier/later for repeated New York wall time", () => {
    expect(
      wallClockToInstant("24/11/03 01:30:00", "America/New_York"),
    ).toEqual({ ok: false, code: "ambiguous-wall-clock" });
  });

  it("resolves each repeated New York wall time to the exact instant", () => {
    expect(
      wallClockToInstant(
        "2024-11-03 01:30:00",
        "America/New_York",
        "earlier",
      ),
    ).toEqual({
      ok: true,
      executedAt: "2024-11-03T05:30:00Z",
    });
    expect(
      wallClockToInstant(
        "2024-11-03 01:30:00",
        "America/New_York",
        "later",
      ),
    ).toEqual({
      ok: true,
      executedAt: "2024-11-03T06:30:00Z",
    });
  });

  it("accepts only the documented exact wall-clock formats", () => {
    expect(
      wallClockToInstant(
        "2024-06-05 14:39:25",
        "Asia/Hong_Kong",
      ),
    ).toEqual({
      ok: true,
      executedAt: "2024-06-05T06:39:25Z",
    });
    for (const sourceText of [
      "2024/6/05 14:39:25",
      "2024/06/05 14:39",
      "2024.06.05 14:39:25",
      "2024/06-05 14:39:25",
    ]) {
      expect(
        wallClockToInstant(sourceText, "Asia/Hong_Kong"),
      ).toEqual({ ok: false, code: "invalid-wall-clock" });
    }
  });
});
