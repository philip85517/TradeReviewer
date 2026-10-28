import { describe, expect, it, vi } from "vitest";

import {
  isMarketDataErrorDetail,
  isLegacyMarketDataIntervalJob,
  isLegacyMarketDataJobBase,
  isLegacyMarketDataJob,
} from "./market-data-job-contract";
import * as migration from "./market-data-jobs";

const base = {
  instrumentId: "US:NVDA",
  symbol: "NVDA",
  market: "US",
  requestedAt: "2026-01-01T00:00:00.000Z",
  status: "partial",
};
const interval = { interval: "1D", status: "complete" };

const statuses = [
  "not-requested", "syncing", "complete", "latest-available", "partial", "stale",
  "source-rate-limited", "source-forbidden", "source-unavailable", "invalid-response",
  "storage-error", "needs-provider", "ready", "error",
];

describe("market data job strict contract", () => {
  it("preserves all four migration facade validators", () => {
    expect(migration.isMarketDataErrorDetail).toBe(isMarketDataErrorDetail);
    expect(migration.isLegacyMarketDataIntervalJob).toBe(isLegacyMarketDataIntervalJob);
    expect(migration.isLegacyMarketDataJobBase).toBe(isLegacyMarketDataJobBase);
    expect(migration.isLegacyMarketDataJob).toBe(isLegacyMarketDataJob);
  });

  it.each(statuses)("accepts status %s without recovering or filling intervals", (status) => {
    const job = { ...base, status, intervals: [{ ...interval, status }] };
    expect(isLegacyMarketDataJobBase({ ...base, status })).toBe(true);
    expect(isLegacyMarketDataIntervalJob({ ...interval, status })).toBe(true);
    expect(isLegacyMarketDataJob(job)).toBe(true);
    expect(job.status).toBe(status);
    expect(job.intervals[0].status).toBe(status);
    expect(isLegacyMarketDataJob({ ...base, status })).toBe(false);
  });

  it.each(["15m", "1h", "1D"])("accepts native interval %s", (nativeInterval) => {
    expect(isLegacyMarketDataIntervalJob({ ...interval, interval: nativeInterval })).toBe(true);
    expect(isLegacyMarketDataJob({ ...base, intervals: [{ ...interval, interval: nativeInterval }] })).toBe(true);
  });

  it("retains empty strings, empty intervals and unvalidated extra metadata", () => {
    const historical = { instrumentId: "", symbol: "", market: "", requestedAt: "", status: "error", intervals: [], extra: 1 };
    expect(isLegacyMarketDataJob(historical)).toBe(true);
    expect(isLegacyMarketDataJobBase({ ...base, intervals: "ignored-by-base" })).toBe(true);
    expect(isLegacyMarketDataJobBase(Object.assign([], base))).toBe(true);
    expect(isLegacyMarketDataIntervalJob(Object.assign([], interval))).toBe(true);
    expect(isLegacyMarketDataJob(Object.assign([], { ...base, intervals: [] }))).toBe(true);
  });

  it("requires nonempty error strings while retaining whitespace and extra fields", () => {
    for (const error of [{ code: "source", message: "unavailable" }, { code: " ", message: " ", extra: true }]) {
      expect(isMarketDataErrorDetail(error)).toBe(true);
      expect(isLegacyMarketDataIntervalJob({ ...interval, error })).toBe(true);
      expect(isLegacyMarketDataJob({ ...base, error, intervals: [interval] })).toBe(true);
    }
    for (const error of [undefined, null, false, "error", [], Object.assign([], { code: "code", message: "message" }), {}, { code: "", message: "message" }, { code: "code", message: "" }, { code: 1, message: "message" }, { code: "code", message: 1 }]) {
      expect(isMarketDataErrorDetail(error)).toBe(false);
      if (error !== undefined) {
        expect(isLegacyMarketDataIntervalJob({ ...interval, error })).toBe(false);
        expect(isLegacyMarketDataJobBase({ ...base, error })).toBe(false);
        expect(isLegacyMarketDataJob({ ...base, error, intervals: [interval] })).toBe(false);
      }
    }
  });

  it("rejects nonrecords, unknown statuses, missing fields and malformed intervals", () => {
    for (const value of [undefined, null, false, 1, "job", [], {}]) {
      expect(isLegacyMarketDataJobBase(value)).toBe(false);
      expect(isLegacyMarketDataIntervalJob(value)).toBe(false);
      expect(isLegacyMarketDataJob(value)).toBe(false);
    }
    for (const status of [undefined, null, "unknown", "COMPLETE", 1, NaN, Infinity, -1]) {
      expect(isLegacyMarketDataJobBase({ ...base, status })).toBe(false);
      expect(isLegacyMarketDataIntervalJob({ ...interval, status })).toBe(false);
      expect(isLegacyMarketDataJob({ ...base, status, intervals: [] })).toBe(false);
    }
    for (const nativeInterval of [undefined, null, "1d", "5m", 1]) {
      expect(isLegacyMarketDataIntervalJob({ ...interval, interval: nativeInterval })).toBe(false);
      expect(isLegacyMarketDataJob({ ...base, intervals: [{ ...interval, interval: nativeInterval }] })).toBe(false);
    }
    for (const intervals of [undefined, null, {}, "1D", [null], [interval, {}]]) {
      expect(isLegacyMarketDataJob({ ...base, intervals })).toBe(false);
    }
  });

  it.each(["instrumentId", "symbol", "market", "requestedAt"])("requires string %s", (field) => {
    for (const value of [undefined, null, 1, false, {}]) {
      expect(isLegacyMarketDataJobBase({ ...base, [field]: value })).toBe(false);
      expect(isLegacyMarketDataJob({ ...base, [field]: value, intervals: [] })).toBe(false);
    }
  });

  it.each(["message", "coverageStart", "coverageEnd"])("retains optional string boundary %s", (field) => {
    for (const value of [undefined, "", "not-a-date"]) {
      expect(isLegacyMarketDataJobBase({ ...base, [field]: value })).toBe(true);
      expect(isLegacyMarketDataIntervalJob({ ...interval, [field]: value })).toBe(true);
      expect(isLegacyMarketDataJob({ ...base, [field]: value, intervals: [interval] })).toBe(true);
    }
    for (const value of [null, 1, false, {}]) {
      expect(isLegacyMarketDataJobBase({ ...base, [field]: value })).toBe(false);
      expect(isLegacyMarketDataIntervalJob({ ...interval, [field]: value })).toBe(false);
      expect(isLegacyMarketDataJob({ ...base, [field]: value, intervals: [interval] })).toBe(false);
    }
  });

  it("loads and validates with browser storage access forbidden", async () => {
    vi.resetModules();
    const originals = [...new Set([globalThis, window])].flatMap((target) =>
      ["localStorage", "indexedDB"].map((name) => ({ target, name, descriptor: Object.getOwnPropertyDescriptor(target, name) })),
    );
    try {
      for (const { target, name } of originals) {
        Object.defineProperty(target, name, { configurable: true, get() { throw new Error(`Forbidden browser storage: ${name}`); } });
      }
      const contract = await import("./market-data-job-contract");
      expect(contract.isMarketDataErrorDetail({ code: "code", message: "message" })).toBe(true);
      expect(contract.isLegacyMarketDataIntervalJob(interval)).toBe(true);
      expect(contract.isLegacyMarketDataJobBase(base)).toBe(true);
      expect(contract.isLegacyMarketDataJob({ ...base, intervals: [interval] })).toBe(true);
      expect(contract.isLegacyMarketDataJob({ ...base, intervals: [{}] })).toBe(false);
    } finally {
      for (const { target, name, descriptor } of originals) {
        if (descriptor) Object.defineProperty(target, name, descriptor);
        else Reflect.deleteProperty(target, name);
      }
    }
  });
});
