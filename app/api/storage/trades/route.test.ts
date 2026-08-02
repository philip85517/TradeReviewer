import { afterEach, describe, expect, it, vi } from "vitest";

const { mergeTradeData, getExecutions, getImportHistory, getInstruments, openSqliteDatabase } = vi.hoisted(() => ({
  mergeTradeData: vi.fn(), getExecutions: vi.fn(), getImportHistory: vi.fn(), getInstruments: vi.fn(), openSqliteDatabase: vi.fn(),
}));
vi.mock("../../../lib/storage/sqlite-store", () => ({ getSqliteStore: vi.fn(() => ({ mergeTradeData, getExecutions, getImportHistory, getInstruments })) }));
vi.mock("../../../../db/sqlite", () => ({ openSqliteDatabase }));
import { GET, PUT } from "./route";

const instrument = { id: "HK:700", symbol: "700", name: "腾讯", market: "HK", currency: "HKD" };
const execution = { id: "e1", source: { platform: "broker", row: 1 }, accountId: "a", accountLabel: "A", instrument, side: "buy", executedAt: "2025-01-01T00:00:00Z", quantity: "1", price: "1", fee: "0" };
const request = (body: unknown) => new Request("http://localhost/api/storage/trades", { method: "PUT", body: JSON.stringify(body) });
afterEach(() => vi.clearAllMocks());

describe("storage trades route", () => {
  it("reads and writes a validated merge with no-store", async () => {
    openSqliteDatabase.mockReturnValue({}); mergeTradeData.mockReturnValue({ inserted: 1, duplicate: 0, conflict: 0 });
    getExecutions.mockReturnValue([execution]); getImportHistory.mockReturnValue([]); getInstruments.mockReturnValue([instrument]);
    expect((await PUT(request({ executions: [execution], instruments: [instrument] }))).status).toBe(200);
    expect(mergeTradeData).toHaveBeenCalledWith({ executions: [execution], instruments: [instrument] });
    const response = await GET(); expect(response.headers.get("cache-control")).toBe("no-store"); expect(await response.json()).toMatchObject({ executions: [execution] });
  });
  it("rejects malformed payloads and maps unknown instruments", async () => {
    expect((await PUT(new Request("http://localhost", { method: "PUT", body: "{" }))).status).toBe(400);
    openSqliteDatabase.mockReturnValue({}); mergeTradeData.mockImplementation(() => { throw new Error("Unknown instrument: X"); });
    const response = await PUT(request({ executions: [execution], instruments: [] })); expect(response.status).toBe(404); expect(await response.json()).toMatchObject({ error: { code: "not-found" } });
  });
  it("returns duplicate and rolls back a failed batch", async () => {
    openSqliteDatabase.mockReturnValue({}); mergeTradeData.mockReturnValue({ inserted: 0, duplicate: 1, conflict: 0 });
    expect(await (await PUT(request({ executions: [execution] }))).json()).toMatchObject({ duplicate: 1 });
    mergeTradeData.mockImplementation(() => { throw new Error("Invalid execution"); });
    expect((await PUT(request({ executions: [execution, { bad: true }] }))).status).toBe(400);
  });
});
