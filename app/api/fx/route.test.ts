import { afterEach, describe, expect, it, vi } from "vitest";

const { openSqliteDatabase, readFxSnapshot, refreshFxSnapshot } = vi.hoisted(() => ({
  openSqliteDatabase: vi.fn(),
  readFxSnapshot: vi.fn(),
  refreshFxSnapshot: vi.fn(),
}));

vi.mock("../../lib/fx/storage", () => ({ readFxSnapshot }));
vi.mock("../../lib/fx/service", () => ({ refreshFxSnapshot }));
vi.mock("../../../db/sqlite", () => ({ openSqliteDatabase }));

import { GET, POST } from "./route";

const freshSnapshot = {
  version: 1,
  baseCurrency: "CNY",
  rates: { CNY: 1, HKD: 1.17, USD: 0.15 },
  source: { id: "frankfurter-ecb", label: "Frankfurter（ECB 参考汇率）", url: "https://api.frankfurter.dev", attributionUrl: "https://www.ecb.europa.eu" },
  rateDate: "2026-09-18",
  fetchedAt: "2026-09-19T10:00:00.000Z",
  lastAttemptedAt: "2026-09-19T10:00:00.000Z",
  cacheStatus: "fresh",
} as const;

afterEach(() => vi.clearAllMocks());

describe("/api/fx", () => {
  it("reads the persisted snapshot without invoking an external fetch", async () => {
    openSqliteDatabase.mockReturnValue({});
    readFxSnapshot.mockReturnValue(freshSnapshot);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ snapshot: freshSnapshot });
    expect(refreshFxSnapshot).not.toHaveBeenCalled();
  });

  it("runs refresh only through POST and returns the new full snapshot", async () => {
    const database = {};
    openSqliteDatabase.mockReturnValue(database);
    refreshFxSnapshot.mockResolvedValue({ status: "fresh", snapshot: freshSnapshot });

    const response = await POST(new Request("http://localhost/api/fx", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(refreshFxSnapshot).toHaveBeenCalledWith(database);
    expect(await response.json()).toEqual({ status: "fresh", snapshot: freshSnapshot });
  });

  it("returns a cached snapshot with a visible failure result", async () => {
    openSqliteDatabase.mockReturnValue({});
    refreshFxSnapshot.mockResolvedValue({
      status: "cached",
      snapshot: { ...freshSnapshot, cacheStatus: "cached", lastError: "provider unavailable" },
      error: { code: "source-unavailable", message: "provider unavailable" },
    });

    const response = await POST(new Request("http://localhost/api/fx", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "cached",
      snapshot: { cacheStatus: "cached", rates: freshSnapshot.rates },
      error: { code: "source-unavailable" },
    });
  });

  it("returns unavailable when the first refresh has no usable cache", async () => {
    openSqliteDatabase.mockReturnValue({});
    refreshFxSnapshot.mockResolvedValue({
      status: "unavailable",
      snapshot: null,
      error: { code: "source-unavailable", message: "provider unavailable" },
    });

    const response = await POST(new Request("http://localhost/api/fx", { method: "POST" }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "unavailable",
      snapshot: null,
      error: { code: "source-unavailable", message: "provider unavailable" },
    });
  });
});
