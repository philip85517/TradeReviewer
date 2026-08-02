import { afterEach, describe, expect, it, vi } from "vitest";

const { getStatus, openSqliteDatabase } = vi.hoisted(() => ({
  getStatus: vi.fn(),
  openSqliteDatabase: vi.fn(),
}));

vi.mock("../../../lib/storage/sqlite-store", () => ({
  getSqliteStore: vi.fn(() => ({ getStatus })),
}));
vi.mock("../../../../db/sqlite", () => ({ openSqliteDatabase }));

import { GET } from "./route";

afterEach(() => vi.clearAllMocks());

describe("GET /api/storage/status", () => {
  it("returns status and counts without leaking the absolute database path", async () => {
    openSqliteDatabase.mockReturnValue({});
    getStatus.mockReturnValue({
      schemaVersion: 3,
      migration: null,
      counts: { executions: 2 },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      schemaVersion: 3,
      migration: null,
      counts: { executions: 2 },
      databasePath: "tradereview.sqlite",
    });
  });

  it("returns 503 when the database cannot be opened", async () => {
    openSqliteDatabase.mockImplementation(() => { throw new Error("unavailable"); });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "database-unavailable", message: "Storage database is unavailable" },
    });
  });
});
