import { describe, expect, it } from "vitest";

import {
  canonicalFxPublicationIdentity,
  emptyFxState,
  fxStatusForRates,
  toRoomFxSnapshot,
} from "./room-contracts";

describe("trading-room FX contracts", () => {
  it("canonicalizes publication fields while ignoring fetch and attempt metadata", () => {
    const base = {
      id: "boc:snapshot",
      baseCurrency: "CNY" as const,
      asOf: "2026-09-19T10:30:00+08:00",
      source: "BOC",
      status: "complete" as const,
      rates: { "USD/CNY": "6.7521", "HKD/CNY": "0.8606" },
      publishedAt: "2026-09-19T10:30:00+08:00",
      publishedAtByCurrency: {
        USD: "2026-09-19T10:30:00+08:00",
        HKD: "2026-09-19T09:20:00+08:00",
      },
      fetchedAt: "2026-09-19T03:00:00.000Z",
      lastAttemptDay: "2026-09-19",
      error: null,
    };

    const reorderedAndRetried = canonicalFxPublicationIdentity({
      ...base,
      rates: { "HKD/CNY": "0.8606", "USD/CNY": "6.7521" },
      publishedAtByCurrency: {
        HKD: "2026-09-19T09:20:00+08:00",
        USD: "2026-09-19T10:30:00+08:00",
      },
      fetchedAt: "2026-09-19T04:00:00.000Z",
      lastAttemptDay: "2026-09-20",
      error: "provider unavailable",
    });

    expect(reorderedAndRetried).toEqual(canonicalFxPublicationIdentity(base));
    expect(canonicalFxPublicationIdentity({ ...base, source: "ECB" })).not.toEqual(canonicalFxPublicationIdentity(base));
    expect(canonicalFxPublicationIdentity({ ...base, publishedAt: "2026-09-20T10:30:00+08:00" })).not.toEqual(canonicalFxPublicationIdentity(base));
    expect(canonicalFxPublicationIdentity({
      ...base,
      publishedAtByCurrency: { ...base.publishedAtByCurrency, USD: "2026-09-20T10:30:00+08:00" },
    })).not.toEqual(canonicalFxPublicationIdentity(base));
  });

  it("keeps the adapter's fetch-only asOf fallback in the publication identity", () => {
    const first = toRoomFxSnapshot({
      ...emptyFxState(),
      fetchedAt: "2026-09-19T03:00:00.000Z",
      rates: { USD: "6.7521" },
      status: "partial",
    });
    const second = toRoomFxSnapshot({
      ...emptyFxState(),
      fetchedAt: "2026-09-19T04:00:00.000Z",
      rates: { USD: "6.7521" },
      status: "partial",
    });

    expect(first?.publishedAt).toBeNull();
    expect(first?.asOf).toBe("2026-09-19T03:00:00.000Z");
    expect(canonicalFxPublicationIdentity(first)?.asOf).toBe("2026-09-19T03:00:00.000Z");
    expect(canonicalFxPublicationIdentity(second)).not.toEqual(canonicalFxPublicationIdentity(first));
  });

  it("keeps CNY as the base and carries publication provenance with the rates", () => {
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
      publishedAt: "2026-09-19T10:30:00+08:00",
      publishedAtByCurrency: {
        USD: "2026-09-19T10:30:00+08:00",
        HKD: "2026-09-19T09:20:00+08:00",
      },
      fetchedAt: "2026-09-19T03:00:00.000Z",
      error: null,
      lastAttemptDay: null,
    });

    expect(toRoomFxSnapshot({ ...state, status: "partial", rates: { USD: "6.7521" } })).toMatchObject({
      status: "partial",
      rates: { "USD/CNY": "6.7521" },
      publishedAt: "2026-09-19T10:30:00+08:00",
      fetchedAt: "2026-09-19T03:00:00.000Z",
    });
  });

  it("keeps a partial snapshot numerically ineligible for CNY conversion", async () => {
    const { buildRoomMoneyView } = await import("../reviews/trading-room-scope");
    const state = {
      ...emptyFxState(),
      id: "boc:partial",
      publishedAt: "2026-09-19T10:30:00+08:00",
      fetchedAt: "2026-09-19T03:00:00.000Z",
      rates: { USD: "6.7521" },
      status: "partial" as const,
    };

    expect(buildRoomMoneyView(
      [{ currency: "USD", amount: "2" }],
      toRoomFxSnapshot(state),
      "CNY",
    )).toMatchObject({
      convertedCny: null,
      conversion: "partial",
    });
  });

  it("downgrades an inconsistent complete state before exposing partial rates", async () => {
    const { buildRoomMoneyView } = await import("../reviews/trading-room-scope");
    const state = {
      ...emptyFxState(),
      id: "boc:inconsistent-complete",
      publishedAt: "2026-09-19T10:30:00+08:00",
      fetchedAt: "2026-09-19T03:00:00.000Z",
      rates: { USD: "6.7521", HKD: "NaN" },
      status: "complete" as const,
    };
    const snapshot = toRoomFxSnapshot(state);

    expect(snapshot).toMatchObject({
      status: "partial",
      rates: { "USD/CNY": "6.7521" },
    });
    expect(buildRoomMoneyView(
      [{ currency: "USD", amount: "2" }],
      snapshot,
      "CNY",
    )).toMatchObject({ convertedCny: null, conversion: "partial" });
    expect(buildRoomMoneyView(
      [{ currency: "CNY", amount: "10" }],
      snapshot,
      "CNY",
    )).toMatchObject({ convertedCny: "10", conversion: "same-currency" });
  });

  it("classifies missing required currency pairs without treating CNY as external data", () => {
    expect(fxStatusForRates({})).toBe("missing");
    expect(fxStatusForRates({ USD: "6.7521" })).toBe("partial");
    expect(fxStatusForRates({ USD: "6.7521", HKD: "0.8606" })).toBe("complete");
    expect(fxStatusForRates({ USD: "NaN", HKD: "0" })).toBe("missing");
    expect(fxStatusForRates({ CNY: "1" })).toBe("missing");
  });
});
