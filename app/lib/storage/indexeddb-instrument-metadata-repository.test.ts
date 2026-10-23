import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { IndexedDbInstrumentMetadataRepository } from "./indexeddb-instrument-metadata-repository";
import {
  openTradeReviewDatabase,
  requestValue,
} from "./indexeddb-schema";

const databases: string[] = [];

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
    ),
  );
});

describe("IndexedDbInstrumentMetadataRepository", () => {
  it("round-trips exchange evidence and keeps it through a name-only update", async () => {
    const name = `exchange-${crypto.randomUUID()}`; databases.push(name);
    const repository = new IndexedDbInstrumentMetadataRepository(name);
    const record = { market: "US" as const, symbol: "AAPL", name: "Apple Inc.", assetType: "stock" as const, source: "sec" as const, confidence: "official" as const, resolvedAt: "2026-10-22T00:00:00.000Z" };
    const exchange = { code: "NASDAQ" as const, source: "sec" as const, resolvedAt: "2026-10-21T00:00:00.000Z" };
    await repository.put({ ...record, exchange });
    expect((await repository.get("US:AAPL"))?.exchange).toEqual(exchange);
    await repository.put({ ...record, resolvedAt: "2026-10-23T00:00:00.000Z" });
    expect((await repository.getMany(["US:AAPL"])).get("US:AAPL")?.exchange).toEqual(exchange);
    const newer = { code: "NYSE" as const, source: "nasdaq" as const, resolvedAt: "2026-10-23T00:00:00.000Z" };
    await repository.put({ ...record, exchange: newer });
    await repository.put({ ...record, exchange });
    expect((await repository.get("US:AAPL"))?.exchange).toEqual(newer);
  });
  it("round-trips one canonical metadata record", async () => {
    const databaseName = `metadata-${crypto.randomUUID()}`;
    databases.push(databaseName);
    const repository = new IndexedDbInstrumentMetadataRepository(databaseName);
    await repository.put({
      market: "US",
      symbol: "SPY",
      name: "SPDR S&P 500 ETF Trust",
      localizedName: {
        name: "标普500指数基金",
        locale: "zh-CN",
        source: "tencent",
        resolvedAt: "2026-07-29T00:00:00.000Z",
      },
      assetType: "etf",
      source: "nasdaq",
      confidence: "official",
      resolvedAt: "2026-07-29T00:00:00.000Z",
    });
    await expect(repository.get("US:SPY")).resolves.toMatchObject({
      name: "SPDR S&P 500 ETF Trust",
      localizedName: { name: "标普500指数基金", locale: "zh-CN" },
      assetType: "etf",
    });
  });

  it("gets only cached metadata for a batch of instrument ids", async () => {
    const databaseName = `metadata-many-${crypto.randomUUID()}`;
    databases.push(databaseName);
    const repository = new IndexedDbInstrumentMetadataRepository(databaseName);
    await repository.put({
      market: "US",
      symbol: "SPY",
      name: "SPDR S&P 500 ETF Trust",
      assetType: "etf",
      source: "nasdaq",
      confidence: "official",
      resolvedAt: "2026-07-29T00:00:00.000Z",
    });
    await repository.put({
      market: "US",
      symbol: "QQQ",
      name: "Invesco QQQ Trust",
      assetType: "etf",
      source: "nasdaq",
      confidence: "official",
      resolvedAt: "2026-07-29T00:00:00.000Z",
    });

    const records = await repository.getMany(["US:SPY", "US:QQQ", "US:IWM"]);

    expect([...records.keys()]).toEqual(["US:SPY", "US:QQQ"]);
    expect(records.get("US:QQQ")).toMatchObject({
      name: "Invesco QQQ Trust",
      assetType: "etf",
    });
  });

  it("upgrades version three without losing existing stores", async () => {
    const databaseName = `metadata-upgrade-${crypto.randomUUID()}`;
    databases.push(databaseName);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 3);
      request.onupgradeneeded = () => {
        for (const name of [
          "dailyCandles",
          "coverage",
          "providerSymbols",
          "reviews",
          "tagSuggestions",
        ]) {
          request.result.createObjectStore(name);
        }
        request.transaction
          ?.objectStore("reviews")
          .put({ version: 1 }, "saved-review");
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    const database = await openTradeReviewDatabase(databaseName);
    expect([...database.objectStoreNames]).toEqual(
      expect.arrayContaining([
        "dailyCandles",
        "coverage",
        "providerSymbols",
        "reviews",
        "tagSuggestions",
        "instrumentMetadata",
      ]),
    );
    const review = await requestValue(
      database.transaction("reviews").objectStore("reviews").get("saved-review"),
    );
    expect(review).toEqual({ version: 1 });
    database.close();
  });
});
