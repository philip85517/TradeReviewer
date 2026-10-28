import { DatabaseSync } from "node:sqlite";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeSqlite } from "../../../../db/sqlite";
import { BookVersionUnavailableError, readBookVersion } from "../../../lib/storage/trade-book-version";
import { createSqliteHttpClient } from "../../../lib/storage/sqlite-http-client";
const { openSqliteDatabase } = vi.hoisted(() => ({ openSqliteDatabase: vi.fn() }));
vi.mock("../../../../db/sqlite", async original => ({ ...await original<typeof import("../../../../db/sqlite")>(), openSqliteDatabase }));
import { GET } from "./route";
let db: DatabaseSync;
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); db = new DatabaseSync(":memory:"); initializeSqlite(db); openSqliteDatabase.mockReturnValue(db); });
afterEach(() => { db.close(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
describe("GET /api/storage/bootstrap", () => {
  it("returns a complete version-bound snapshot consumed by the real client", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ bookVersion: readBookVersion(db), bootstrap: { executions: [] }, tradeReadPages: [{ snapshot: { displayExecutionIds: [] } }] });
    const client = createSqliteHttpClient(async () => GET());
    expect(await client.getBootstrap()).toMatchObject({ bookVersion: readBookVersion(db), executions: [], tradeReadPages: [expect.any(Object)] });
  });
  it("returns explicit unavailable and unexpected failures without partial data", async () => {
    openSqliteDatabase.mockImplementationOnce(() => { throw new BookVersionUnavailableError(); });
    const unavailable = await GET();
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({ error: { code: "BOOK_VERSION_UNAVAILABLE" } });
    openSqliteDatabase.mockImplementationOnce(() => { throw new Error("internal path secret"); });
    const unexpected = await GET();
    expect(unexpected.status).toBe(500);
    expect(await unexpected.json()).toMatchObject({ error: { code: "UNEXPECTED_FAILURE" } });
  });
});
