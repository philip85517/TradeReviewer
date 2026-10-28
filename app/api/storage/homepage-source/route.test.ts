import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeSqlite } from "../../../../db/sqlite";
const { openSqliteDatabase } = vi.hoisted(() => ({ openSqliteDatabase: vi.fn() }));
vi.mock("../../../../db/sqlite", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../../db/sqlite")>(), openSqliteDatabase,
}));
import { GET } from "./route";

let database: DatabaseSync;
beforeEach(() => {
  database = new DatabaseSync(":memory:");
  initializeSqlite(database);
  openSqliteDatabase.mockReturnValue(database);
});
afterEach(() => { database.close(); vi.resetAllMocks(); });

describe("homepage source route", () => {
  it("returns a real empty database receipt with no-store", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      bootstrap: { executions: [], instruments: [] }, recallSummaries: [],
      receipt: { policy: "homepage-stored-collection-v1", enumeration: "complete", counts: { executions: 0 } },
    });
  });
  it("returns one failure with no partial receipt or SQL details", async () => {
    database.exec("drop table recall_documents");
    const response = await GET();
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ error: { code: "UNEXPECTED_FAILURE", category: "unexpected" } });
    expect(JSON.stringify(body)).not.toContain("recall_documents");
  });
});
