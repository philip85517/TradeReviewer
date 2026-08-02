import { afterEach, describe, expect, it, vi } from "vitest";

const { getBootstrap, openSqliteDatabase } = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  openSqliteDatabase: vi.fn(),
}));

vi.mock("../../../lib/storage/sqlite-store", () => ({
  getSqliteStore: vi.fn(() => ({ getBootstrap })),
}));
vi.mock("../../../../db/sqlite", () => ({ openSqliteDatabase }));

import { GET } from "./route";

afterEach(() => vi.clearAllMocks());

describe("GET /api/storage/bootstrap", () => {
  it("returns a SQLite bootstrap payload for a single user", async () => {
    openSqliteDatabase.mockReturnValue({});
    getBootstrap.mockReturnValue({
      schemaVersion: 3,
      migration: null,
      executions: [], importHistory: [], instruments: [], reviews: [], reviewStates: [],
      tagSuggestions: [], marketDataJobs: [], settings: {},
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(expect.objectContaining({ schemaVersion: 3, executions: [] }));
  });

  it("returns 503 when the database cannot be opened", async () => {
    openSqliteDatabase.mockImplementation(() => { throw new Error("unavailable"); });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "database-unavailable" } });
  });
});
