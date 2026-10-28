import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../db/sqlite", async importOriginal => ({
  ...await importOriginal<typeof import("../../../../db/sqlite")>(),
  openSqliteDatabase: vi.fn(),
}));
import { openSqliteDatabase } from "../../../../db/sqlite";
import { GET, PUT } from "./route";

const originalDatabase = await vi.importActual<typeof import("../../../../db/sqlite")>("../../../../db/sqlite");
let directory: string;
let path: string;
let database: DatabaseSync;
const metadata = { market: "US", symbol: "AAPL", name: "Apple Inc.", assetType: "stock", source: "sec", confidence: "official", resolvedAt: "2026-10-22T00:00:00.000Z", exchange: { code: "NASDAQ", source: "sec", resolvedAt: "2026-10-22T00:00:00.000Z" } };
const instrument = { id: "US:AAPL", market: "US", symbol: "AAPL", name: "Apple Inc.", currency: "USD", metadata };
const execution = { id: "broad-fill", source: { platform: "futu", row: 1, tradeNature: "live" }, accountId: "one", accountLabel: "实盘一", instrument, side: "buy", executedAt: "2026-10-22T01:00:00Z", quantity: "2", price: "100", fee: "0" };
const request = (body: unknown) => new Request("http://localhost/api/storage/trades", { method: "PUT", body: JSON.stringify(body) });
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "tradereview-p1-broad-metadata-"));
  path = join(directory, "isolated.sqlite");
  database = originalDatabase.openSqliteDatabase(path);
  vi.mocked(openSqliteDatabase).mockImplementation(() => database);
});
afterEach(() => { database.close(); rmSync(directory, { recursive: true, force: true }); vi.clearAllMocks(); });

describe("broad trades metadata write boundary", () => {
  it("preserves the typed version conflict when legacy replacement is refused", async () => {
    expect((await PUT(request({ executions: [execution] }))).status).toBe(200);
    const response = await PUT(request({ executions: [{ ...execution, price: "101" }], replaceExecutionIds: [execution.id] }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "VERSION_REQUIRED", category: "conflict", phase: "compatibility", retryable: false } });
    expect(await (await GET()).json()).toMatchObject({ executions: [{ id: execution.id, price: "100" }] });
  });
  it.each([
    ["guessed market code", { code: "US", source: "sec", resolvedAt: metadata.resolvedAt }],
    ["untrusted exchange provider", { code: "NASDAQ", source: "tencent", resolvedAt: metadata.resolvedAt }],
    ["invalid evidence time", { code: "NASDAQ", source: "sec", resolvedAt: "not-a-date" }],
  ])("rejects %s from both instrument and embedded execution before any persistence", async (_label, exchange) => {
    const invalid = { ...instrument, metadata: { ...metadata, exchange } };
    for (const payload of [{ instruments: [invalid], executions: [] }, { executions: [{ ...execution, instrument: invalid }] }]) {
      const response = await PUT(request(payload));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "INVALID_INPUT", category: "input", phase: "prepare", retryable: false } });
      expect(await (await GET()).json()).toEqual({ instruments: [], executions: [], importHistory: [] });
    }
  });
  it("retains valid exchange across the broad HTTP write, disk reopen and read", async () => {
    expect((await PUT(request({ instruments: [instrument], executions: [execution] }))).status).toBe(200);
    database.close(); database = originalDatabase.openSqliteDatabase(path);
    const body = await (await GET()).json();
    expect(body).toMatchObject({ instruments: [{ id: instrument.id, metadata: { exchange: metadata.exchange } }], executions: [{ instrument: { id: instrument.id } }] });
  });
});
