import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../db/sqlite", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../../db/sqlite")>(),
  openSqliteDatabase: vi.fn(),
}));

import { initializeSqlite, openSqliteDatabase } from "../../../../db/sqlite";
import type { IntervalCoverageSegment } from "../../../lib/market/contracts";
import { SqliteStore } from "../../../lib/storage/sqlite-store";
import { GET, PUT } from "./route";

const instrument = { id: "HK:700", symbol: "700", name: "腾讯", market: "HK", currency: "HKD" };
const otherInstrument = { id: "HK:5", symbol: "5", name: "汇丰", market: "HK", currency: "HKD" };
const daily = {
  instrumentId: instrument.id, tradingDate: "2025-01-02",
  open: "1.000000000000000001", high: "3", low: "1", close: "2.000000000000000001",
  volume: "12345678901234567890", currency: "HKD", provider: "tencent" as const,
  providerSymbol: "hk00700", adjustmentMode: "raw" as const, fetchedAt: "2025-01-05T00:00:00.000Z",
};
const candle = {
  instrumentId: instrument.id, interval: "15m" as const, timestamp: "2025-01-02T01:30:00.000Z",
  open: "1", high: "3", low: "1", close: "2", volume: "10", currency: "HKD",
  provider: "yahoo" as const, providerSymbol: "0700.HK", adjustmentMode: "raw" as const,
  fetchedAt: "2025-01-05T00:00:00.000Z", knowledgeAt: "2025-01-02T01:45:00.000Z",
};
const segments: IntervalCoverageSegment[] = [
  {
    interval: "1D", requestedStart: "2025-01-01T00:00:00.000Z", requestedEnd: "2025-01-02T23:59:59.999Z",
    actualStart: "2025-01-02T00:00:00.000Z", actualEnd: "2025-01-02T00:00:00.000Z",
    status: "partial", provider: "tencent", fetchedAt: "2025-01-05T00:00:00.000Z", reason: "holiday",
  },
  {
    interval: "1D", requestedStart: "2025-01-03T00:00:00.000Z", requestedEnd: "2025-01-04T23:59:59.999Z",
    actualStart: "2025-01-03T00:00:00.000Z", actualEnd: "2025-01-03T00:00:00.000Z",
    status: "latest-available", provider: "yahoo", fetchedAt: "2025-01-05T01:00:00.000Z", reason: "market closed",
  },
];
const coverage = [{
  startDate: "2025-01-01", endDate: "2025-01-04", status: "partial" as const,
  missingTradingDates: ["2025-01-01"], provider: "tencent" as const,
  fetchedAt: "2025-01-05T00:00:00.000Z", reason: "holiday",
}];
const expectedIntervalCoverage = segments.map((segment) => ({ ...segment, instrumentId: instrument.id, adjustmentMode: "raw" }));
let directory: string;
let database: DatabaseSync;
let store: SqliteStore;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "tradereview-market-route-"));
  database = new DatabaseSync(join(directory, "test.sqlite"));
  initializeSqlite(database);
  vi.mocked(openSqliteDatabase).mockReturnValue(database);
  store = new SqliteStore(database);
  store.mergeTradeData({ instruments: [instrument, otherInstrument], executions: [] });
  store.commitMarketData({
    instrumentId: instrument.id,
    candles: [{ ...daily, tradingDate: "2025-01-03" }, daily],
    coverage,
    providerSymbol: { provider: "tencent", symbol: "hk00700" },
  });
  for (const interval of ["1D", "1h", "15m"] as const) {
    store.commitIntervalMarketData({
      instrumentId: instrument.id, interval,
      candles: interval === "1D" ? [] : [{ ...candle, interval }],
      coverage: segments.map((segment) => ({ ...segment, interval })),
    });
  }
  store.commitIntervalMarketData({ instrumentId: otherInstrument.id, interval: "1D", candles: [], coverage: [segments[0]!] });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(openSqliteDatabase).mockReset();
  if (database?.isOpen) database.close();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

function read(query: Record<string, string> = {}) {
  const params = new URLSearchParams({ instrumentId: instrument.id, interval: "1D", ...query });
  return GET(new Request(`http://localhost/api/storage/market-data?${params}`));
}
function write(value: unknown) {
  return PUT(new Request("http://localhost/api/storage/market-data", { method: "PUT", body: JSON.stringify(value) }));
}
function corrupt(sql: string, ...parameters: string[]) {
  database.exec("pragma ignore_check_constraints = on");
  database.prepare(sql).run(...parameters);
  database.exec("pragma ignore_check_constraints = off");
}
async function expectError(response: Response, status: number, code: string, message: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: { code, message } });
}

describe("storage market-data route with isolated SQLite", () => {
  it("keeps 1D, 1h and 15m query results and coverage separate", async () => {
    for (const interval of ["15m", "1h"] as const) {
      const response = await read({ interval });
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toEqual({
        candles: [{ ...candle, interval }],
        intervalCoverage: expectedIntervalCoverage.map((segment) => ({ ...segment, interval })),
      });
    }
    expect(await (await read()).json()).toEqual({
      candles: [
        { ...daily, interval: "1D", timestamp: "2025-01-02T00:00:00.000Z" },
        { ...daily, tradingDate: "2025-01-03", interval: "1D", timestamp: "2025-01-03T00:00:00.000Z" },
      ],
      intervalCoverage: expectedIntervalCoverage,
      coverage,
    });
  });

  it("keeps all daily-only response fields and full coverage outside the candle date range", async () => {
    const response = await read({ dailyOnly: "true", start: "2025-01-02T12:00:00.000Z", end: "2025-01-02T23:59:59.999Z" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ dailyCandles: [daily], intervalCoverage: expectedIntervalCoverage, coverage });
  });

  it("includes timestamp boundaries and preserves generic 1D precedence and ordering", async () => {
    const generic = { ...candle, interval: "1D" as const, timestamp: "2025-01-02T00:00:00.000Z", close: "9" };
    store.putMarketData({ marketCandles: [generic] });
    expect(await (await read({ start: "2025-01-02T00:00:00.000Z", end: "2025-01-02T00:00:00.000Z" })).json()).toEqual({
      candles: [generic], intervalCoverage: expectedIntervalCoverage, coverage,
    });
    expect(await (await read({ start: "2025-01-02T00:00:00.001Z", end: "2025-01-02T23:59:59.999Z" })).json()).toEqual({
      candles: [], intervalCoverage: expectedIntervalCoverage, coverage,
    });
    expect(await (await read({ interval: "15m", start: candle.timestamp, end: candle.timestamp })).json()).toMatchObject({ candles: [candle] });
    expect(await (await read({ interval: "15m", start: "2025-01-02T01:30:00.001Z" })).json()).toMatchObject({ candles: [] });
  });

  it.each(["metadata_json", "localized_name_json"])("ignores unrelated corrupt instrument %s", async (column) => {
    corrupt(`update instruments set ${column} = ? where id = ?`, "{", otherInstrument.id);
    const response = await read({ dailyOnly: "true" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ dailyCandles: [daily, { ...daily, tradingDate: "2025-01-03" }], intervalCoverage: expectedIntervalCoverage, coverage });
  });

  it.each([
    { instrumentId: otherInstrument.id, interval: "1D" },
    { instrumentId: instrument.id, interval: "1h" },
  ])("does not parse coverage outside the requested ID and interval: $instrumentId/$interval", async ({ instrumentId, interval }) => {
    corrupt("update interval_coverage set details_json = ? where instrument_id = ? and interval = ?", "{", instrumentId, interval);
    const response = await read({ dailyOnly: "true" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ dailyCandles: [daily, { ...daily, tradingDate: "2025-01-03" }], intervalCoverage: expectedIntervalCoverage, coverage });
  });

  it.each(["interval_coverage", "coverage"])("reports selected corrupt %s as storage-unavailable", async (table) => {
    corrupt(`update ${table} set details_json = ? where instrument_id = ?`, "{", instrument.id);
    await expectError(await read({ dailyOnly: "true" }), 503, "storage-unavailable", "storage unavailable");
  });

  it("queries SQLite by ID and interval without materializing the instrument directory", async () => {
    const prepare = vi.spyOn(database, "prepare");
    const response = await read({ dailyOnly: "true" });
    expect(response.status).toBe(200);
    const selects = prepare.mock.calls.map(([sql]) => sql);
    expect(selects.filter((sql) => /\bfrom instruments\b/i.test(sql))).toEqual(["select 1 from instruments where id = ?"]);
    const coverageCall = prepare.mock.calls.findIndex(([sql]) => /\bfrom interval_coverage\b/i.test(sql));
    expect(selects[coverageCall]).toMatch(/where instrument_id = \? and interval = \?/i);
    const statement = prepare.mock.results[coverageCall];
    expect(statement?.type).toBe("return");
    if (statement?.type !== "return") throw new Error("Expected a real prepared SQLite statement");
    expect(statement.value.expandedSQL).toContain("where instrument_id = 'HK:700' and interval = '1D'");
  });

  it("reads provider symbols without parsing unrelated metadata or coverage", async () => {
    corrupt("update instruments set metadata_json = ? where id = ?", "{", otherInstrument.id);
    corrupt("update interval_coverage set details_json = ? where instrument_id = ?", "{", otherInstrument.id);
    const response = await read({ interval: "", provider: "tencent" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ providerSymbol: "hk00700" });
    expect(await (await read({ interval: "", provider: "missing" })).json()).toEqual({ providerSymbol: null });
  });

  it.each(["missing", "HK:700' OR 1=1 --", " HK:700 "])("returns not-found for the exact unknown ID %s", async (instrumentId) => {
    corrupt("update instruments set metadata_json = ? where id = ?", "{", otherInstrument.id);
    await expectError(await read({ instrumentId }), 404, "not-found", "not found");
  });

  it.each<Record<string, string>>([
    { instrumentId: "" }, { instrumentId: " " }, { interval: "" }, { interval: "5m" },
    { dailyOnly: "false" }, { dailyOnly: "true", interval: "15m" },
    { start: "2025-02-01", end: "2025-01-01" },
    { provider: "" }, { provider: "tencent" },
    { provider: "tencent", interval: "", dailyOnly: "true" },
  ])("keeps invalid query errors and no-store for %j", async (query) => {
    await expectError(await read(query), 400, "invalid-request", "invalid request");
  });

  it("returns storage-unavailable when the database cannot be read", async () => {
    database.close();
    await expectError(await read(), 503, "storage-unavailable", "storage unavailable");
  });

  it("observes committed candle and coverage revisions from another connection on the next request", async () => {
    expect(await (await read({ dailyOnly: "true" })).json()).toMatchObject({ dailyCandles: [daily, { ...daily, tradingDate: "2025-01-03" }] });
    const writer = new DatabaseSync(join(directory, "test.sqlite"));
    try {
      writer.exec("begin immediate");
      writer.prepare("update daily_candles set close = ? where instrument_id = ? and date = ?").run("2.000000000000000009", instrument.id, daily.tradingDate);
      writer.prepare("update interval_coverage set details_json = ? where instrument_id = ? and interval = ?").run(
        JSON.stringify([{ ...segments[0], status: "stale", reason: "revised" }]), instrument.id, "1D",
      );
      writer.exec("commit");
      const response = await read({ dailyOnly: "true" });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toEqual({
        dailyCandles: [{ ...daily, close: "2.000000000000000009" }, { ...daily, tradingDate: "2025-01-03" }],
        intervalCoverage: [{ ...expectedIntervalCoverage[0], status: "stale", reason: "revised" }], coverage,
      });
    } finally {
      writer.close();
    }
  });

  it("persists daily commits and rejects malformed JSON", async () => {
    const result = { instrumentId: instrument.id, candles: [{ ...daily, close: "8" }], coverage: [], providerSymbol: { provider: "tencent", symbol: "700" } };
    expect((await write({ kind: "daily", result })).status).toBe(200);
    expect(store.getDailyCandles(instrument.id)[0]?.close).toBe("8");
    expect(store.getProviderSymbol(instrument.id, "tencent")).toBe("700");
    await expectError(await PUT(new Request("http://localhost", { method: "PUT", body: "{" })), 400, "invalid-request", "invalid request");
  });

  it("persists daily coverage without requiring a provider symbol", async () => {
    const result = { instrumentId: instrument.id, candles: [], coverage: [{ startDate: "2024-01-02", endDate: "2024-01-02", status: "partial", missingTradingDates: [], reason: "no-data" }] };
    expect((await write({ kind: "daily", result })).status).toBe(200);
    expect(store.getCoverageSegments(instrument.id)).toEqual(result.coverage);
  });

  it("rejects cross-instrument and cross-interval commits without changing persisted candles", async () => {
    const badDaily = { instrumentId: instrument.id, candles: [{ ...daily, instrumentId: otherInstrument.id }], coverage: [] };
    await expectError(await write({ kind: "daily", result: badDaily }), 400, "invalid-request", "invalid request");
    await expectError(await write({ kind: "interval", result: { instrumentId: instrument.id, interval: "1D", candles: [candle], coverage: [] } }), 400, "invalid-request", "invalid request");
    expect(store.getDailyCandles(instrument.id)).toEqual([daily, { ...daily, tradingDate: "2025-01-03" }]);
  });
});
