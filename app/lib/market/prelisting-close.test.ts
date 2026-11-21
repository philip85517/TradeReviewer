import { describe, expect, it } from "vitest";
import { confirmedPrelistingClose } from "./prelisting-close";

describe("confirmedPrelistingClose", () => {
  it("confirms only the independently documented sessions", () => {
    expect(confirmedPrelistingClose("HK:9903", "2026-01-06")).toEqual({ listingDate: "2026-01-08" });
    expect(confirmedPrelistingClose("US:BTGO", "2026-01-21")).toEqual({ listingDate: "2026-01-22" });
  });
  it("does not infer listing-day, reused-symbol, unknown or when-issued exclusions", () => {
    for (const [id, day] of [
      ["HK:9903", "2026-01-08"], ["HK:9903", "2025-01-06"],
      ["HK:9903", "2026-01-05"], ["HK:09903", "2026-01-06"],
      ["US:SNDK", "2025-02-13"], ["US:UNKNOWN", "2026-01-21"],
      ["US:BTGO", "2026-01-22"], ["HK:1021", "2026-03-27"],
      ["HK:9903", "2026-01-06T00:00:00Z"],
    ]) expect(confirmedPrelistingClose(id, day)).toBeNull();
  });
});
