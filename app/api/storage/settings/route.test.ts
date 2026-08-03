import { afterEach, describe, expect, it, vi } from "vitest";
const { getSettings, putSettings, openSqliteDatabase } = vi.hoisted(() => ({ getSettings: vi.fn(), putSettings: vi.fn(), openSqliteDatabase: vi.fn() }));
vi.mock("../../../lib/storage/sqlite-store", () => ({ getSqliteStore: vi.fn(() => ({ getSettings, putSettings })) })); vi.mock("../../../../db/sqlite", () => ({ openSqliteDatabase }));
import { GET, PUT } from "./route";
const settings = { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" };
afterEach(() => vi.clearAllMocks());
describe("storage settings route", () => { it("reads and writes settings", async () => { openSqliteDatabase.mockReturnValue({}); getSettings.mockReturnValue(settings); expect((await GET()).headers.get("cache-control")).toBe("no-store"); expect((await PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify(settings) }))).status).toBe(200); }); it("rejects malformed settings", async () => { expect((await PUT(new Request("http://localhost", { method: "PUT", body: "{}" }))).status).toBe(400); }); });
