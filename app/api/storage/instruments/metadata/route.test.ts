import { afterEach, describe, expect, it, vi } from "vitest";

const { getInstrumentMetadata, putInstrumentMetadata, openSqliteDatabase } = vi.hoisted(() => ({
  getInstrumentMetadata: vi.fn(),
  putInstrumentMetadata: vi.fn(),
  openSqliteDatabase: vi.fn(),
}));

vi.mock("../../../../lib/storage/sqlite-store", () => ({
  getSqliteStore: vi.fn(() => ({ getInstrumentMetadata, putInstrumentMetadata })),
}));
vi.mock("../../../../../db/sqlite", () => ({ openSqliteDatabase }));

import { GET, PUT } from "./route";

const metadata = {
  market: "US" as const,
  symbol: "AAPL",
  name: "Apple Inc.",
  assetType: "stock" as const,
  source: "nasdaq" as const,
  confidence: "official" as const,
  resolvedAt: "2026-09-29T00:00:00.000Z",
};

const request = (body: unknown) => new Request("http://localhost/api/storage/instruments/metadata", {
  method: "PUT",
  body: JSON.stringify(body),
});

afterEach(() => vi.clearAllMocks());

describe("/api/storage/instruments/metadata", () => {
  it("reads a deduplicated batch of instrument metadata without bootstrap data", async () => {
    openSqliteDatabase.mockReturnValue({});
    getInstrumentMetadata.mockReturnValue([{ id: "HK:700" }]);

    const response = await GET(new Request(
      "http://localhost/api/storage/instruments/metadata?id=HK%3A700&id=US%3AAAPL&id=HK%3A700",
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getInstrumentMetadata).toHaveBeenCalledWith(["HK:700", "US:AAPL"]);
    expect(await response.json()).toEqual({ instruments: [{ id: "HK:700" }] });
  });

  it("rejects an empty metadata read", async () => {
    const response = await GET(new Request("http://localhost/api/storage/instruments/metadata"));

    expect(response.status).toBe(400);
    expect(getInstrumentMetadata).not.toHaveBeenCalled();
  });

  it("writes one resolved record through the narrow store method", async () => {
    openSqliteDatabase.mockReturnValue({});

    const response = await PUT(request(metadata));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(putInstrumentMetadata).toHaveBeenCalledWith(metadata);
  });

  it("rejects invalid metadata before opening the database", async () => {
    const response = await PUT(request({ ...metadata, name: "AAPL" }));

    expect(response.status).toBe(400);
    expect(openSqliteDatabase).not.toHaveBeenCalled();
    expect(putInstrumentMetadata).not.toHaveBeenCalled();
  });

  it("rejects an invalid resolvedAt before opening the database", async () => {
    const response = await PUT(request({ ...metadata, resolvedAt: "not-a-date" }));

    expect(response.status).toBe(400);
    expect(openSqliteDatabase).not.toHaveBeenCalled();
    expect(putInstrumentMetadata).not.toHaveBeenCalled();
  });
});
