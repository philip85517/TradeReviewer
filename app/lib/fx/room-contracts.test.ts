import { describe, expect, it } from "vitest";

import { emptyFxState, fxStatusForRates, toRoomFxSnapshot } from "./room-contracts";

describe("trading-room FX contracts", () => {
  it("keeps CNY as the base and only exposes a complete room snapshot", () => {
    const state = {
      ...emptyFxState(),
      id: "boc:snapshot",
      publishedAt: "2026-09-19T10:30:00+08:00",
      fetchedAt: "2026-09-19T03:00:00.000Z",
      rates: { USD: "6.7521", HKD: "0.8606" },
      publishedAtByCurrency: {
        USD: "2026-09-19T10:30:00+08:00",
        HKD: "2026-09-19T09:20:00+08:00",
      },
      status: "complete" as const,
    };

    expect(toRoomFxSnapshot(state)).toEqual({
      id: "boc:snapshot",
      baseCurrency: "CNY",
      asOf: "2026-09-19T10:30:00+08:00",
      source: "BOC",
      status: "complete",
      rates: { "USD/CNY": "6.7521", "HKD/CNY": "0.8606" },
    });
    expect(toRoomFxSnapshot({ ...state, status: "partial", rates: { USD: "6.7521" } })).toBeUndefined();
  });

  it("classifies missing required currency pairs without treating CNY as external data", () => {
    expect(fxStatusForRates({})).toBe("missing");
    expect(fxStatusForRates({ USD: "6.7521" })).toBe("partial");
    expect(fxStatusForRates({ USD: "6.7521", HKD: "0.8606" })).toBe("complete");
    expect(fxStatusForRates({ CNY: "1" })).toBe("missing");
  });
});
