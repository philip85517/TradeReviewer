import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getRecallDocument,
  saveRecallDocument,
  openSqliteDatabase,
  RecallConflictError,
  RecallNotFoundError,
} = vi.hoisted(() => ({
  getRecallDocument: vi.fn(),
  saveRecallDocument: vi.fn(),
  openSqliteDatabase: vi.fn(),
  RecallConflictError: class RecallConflictError extends Error {},
  RecallNotFoundError: class RecallNotFoundError extends Error {},
}));

vi.mock("../../../lib/recall/server-repository", () => ({
  getRecallDocument,
  saveRecallDocument,
  RecallConflictError,
  RecallNotFoundError,
}));
vi.mock("../../../../db/sqlite", () => ({ openSqliteDatabase }));

import { GET, PUT } from "./route";

const document = {
  version: 1,
  episodeId: "episode",
  revision: 0,
  decisions: [],
  snapshots: [],
  working: {
    drawings: [],
    timeframe: "1D",
    cursor: "2026-01-01T00:00:00.000Z",
    executionCursor: "2026-01-01T00:00:00.000Z",
    selectedDecisionId: null,
  },
  status: "in-progress",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as const;

afterEach(() => vi.clearAllMocks());

describe("recall storage route", () => {
  it("loads a document and disables caching", async () => {
    openSqliteDatabase.mockReturnValue({});
    getRecallDocument.mockReturnValue(document);
    const result = await GET(new Request("http://localhost/api/storage/recall?episodeId=episode"));
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toEqual(document);
  });

  it("uses revision CAS and maps stale writes to 409", async () => {
    openSqliteDatabase.mockReturnValue({});
    saveRecallDocument.mockImplementation(() => {
      throw new RecallConflictError("stale revision");
    });
    const result = await PUT(new Request("http://localhost/api/storage/recall", {
      method: "PUT",
      body: JSON.stringify({ document, expectedRevision: 0 }),
    }));
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({ error: { code: "conflict" } });
  });

  it("does not turn malformed bodies or missing documents into storage outages", async () => {
    expect((await PUT(new Request("http://localhost", { method: "PUT", body: "{" }))).status).toBe(400);
    openSqliteDatabase.mockReturnValue({});
    getRecallDocument.mockReturnValue(undefined);
    expect((await GET(new Request("http://localhost/api/storage/recall?episodeId=episode"))).status).toBe(404);
    saveRecallDocument.mockImplementation(() => {
      throw new RecallNotFoundError("Unknown episode");
    });
    const result = await PUT(new Request("http://localhost/api/storage/recall", {
      method: "PUT",
      body: JSON.stringify(document),
    }));
    expect(result.status).toBe(404);
  });
});
