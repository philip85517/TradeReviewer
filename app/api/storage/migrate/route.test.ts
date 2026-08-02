import { afterEach, describe, expect, it, vi } from "vitest";

const { mergeBrowserState, openSqliteDatabase } = vi.hoisted(() => ({
  mergeBrowserState: vi.fn(),
  openSqliteDatabase: vi.fn(),
}));

vi.mock("../../../lib/storage/sqlite-store", () => ({
  getSqliteStore: vi.fn(() => ({ mergeBrowserState })),
}));
vi.mock("../../../../db/sqlite", () => ({ openSqliteDatabase }));

import { POST } from "./route";

const payload = {
  version: 1, sourceClientId: "browser-1", sourceFingerprint: "fingerprint-1",
  executions: [], importHistory: [], instruments: [], reviews: [], reviewStates: [],
  tagSuggestions: [], marketDataJobs: [], settings: {}, dailyCandles: [], marketCandles: [],
  coverage: [], intervalCoverage: [], providerSymbols: [],
};

function request(body: unknown) {
  return new Request("http://localhost/api/storage/migrate", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

afterEach(() => vi.clearAllMocks());

describe("POST /api/storage/migrate", () => {
  it("rejects an unsupported migration payload version with 400", async () => {
    const response = await POST(request({ ...payload, version: 2 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid-payload" } });
    expect(mergeBrowserState).not.toHaveBeenCalled();
  });

  it("returns a migration report and is idempotent on the same fingerprint", async () => {
    openSqliteDatabase.mockReturnValue({});
    mergeBrowserState
      .mockReturnValueOnce({ sourceFingerprint: "fingerprint-1", inserted: 1, duplicate: 0, conflict: 0, failed: 0, validationDigest: "digest" })
      .mockReturnValueOnce({ sourceFingerprint: "fingerprint-1", inserted: 0, duplicate: 1, conflict: 0, failed: 0, validationDigest: "digest" });

    const first = await POST(request(payload));
    const second = await POST(request(payload));

    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(await first.json()).toMatchObject({ inserted: 1, duplicate: 0 });
    expect(await second.json()).toMatchObject({ inserted: 0, duplicate: 1 });
    expect(mergeBrowserState).toHaveBeenCalledTimes(2);
  });

  it("returns 503 when the database cannot be opened", async () => {
    openSqliteDatabase.mockImplementation(() => { throw new Error("unavailable"); });

    const response = await POST(request(payload));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "database-unavailable" } });
  });
});
