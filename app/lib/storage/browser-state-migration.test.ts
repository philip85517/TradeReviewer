import { beforeEach, describe, expect, it, vi } from "vitest";

import { migrateLegacyBrowserState, SQLITE_MIGRATION_MARKER_KEY } from "./browser-state-migration";
import type { BrowserStatePayload, MigrationReport } from "./sqlite-contracts";
import { StorageHttpError } from "./sqlite-http-client";

const payload: BrowserStatePayload = { version: 1, sourceClientId: "browser", sourceFingerprint: "fingerprint", executions: [], importHistory: [], instruments: [], reviews: [], reviewStates: [], tagSuggestions: [], marketDataJobs: [], settings: {}, dailyCandles: [], marketCandles: [], coverage: [], intervalCoverage: [], providerSymbols: [] };
const report: MigrationReport = { sourceFingerprint: "fingerprint", inserted: 1, duplicate: 0, conflict: 0, failed: 0, validationDigest: "digest" };

beforeEach(() => localStorage.clear());

describe("migrateLegacyBrowserState", () => {
  it("marks a validated migration once and is idempotent", async () => {
    const client = { migrate: vi.fn().mockResolvedValue(report) };
    await expect(migrateLegacyBrowserState(client, payload)).resolves.toEqual(report);
    await expect(migrateLegacyBrowserState(client, payload)).resolves.toEqual(report);
    expect(client.migrate).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(SQLITE_MIGRATION_MARKER_KEY)).toContain("digest");
  });

  it("retries transport and 503 failures without recording a marker", async () => {
    const client = { migrate: vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockRejectedValueOnce(new StorageHttpError(503, "storage-unavailable", "offline")).mockResolvedValue(report) };
    await expect(migrateLegacyBrowserState(client, payload)).resolves.toEqual(report);
    expect(client.migrate).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem(SQLITE_MIGRATION_MARKER_KEY)).toContain("digest");
  });

  it("does not retry or mark a validation failure", async () => {
    const client = { migrate: vi.fn().mockRejectedValue(new StorageHttpError(400, "invalid-request", "bad payload")) };
    await expect(migrateLegacyBrowserState(client, payload)).rejects.toThrow("bad payload");
    expect(client.migrate).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(SQLITE_MIGRATION_MARKER_KEY)).toBeNull();
  });
});
