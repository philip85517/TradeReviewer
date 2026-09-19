import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { initializeSqlite } from "../../../db/sqlite";
import type { FxSnapshot } from "./contracts";
import {
  readFxSnapshot,
  replaceFxSnapshot,
} from "./storage";
import { refreshFxSnapshot } from "./service";

const databases: DatabaseSync[] = [];

function openDatabase() {
  const database = new DatabaseSync(":memory:");
  databases.push(database);
  initializeSqlite(database);
  return database;
}

function snapshot(overrides: Partial<FxSnapshot> = {}): FxSnapshot {
  return {
    version: 1,
    baseCurrency: "CNY",
    rates: { CNY: 1, HKD: 1.02, USD: 7.1 },
    source: {
      id: "frankfurter-ecb",
      label: "Frankfurter（ECB 参考汇率）",
      url: "https://api.frankfurter.dev/v2/providers/ecb/rates?base=CNY&quotes=HKD,USD",
      attributionUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
    },
    rateDate: "2026-09-18",
    fetchedAt: "2026-09-19T10:00:00.000Z",
    lastAttemptedAt: "2026-09-19T10:00:00.000Z",
    cacheStatus: "fresh",
    ...overrides,
  };
}

afterEach(() => {
  for (const database of databases.splice(0)) {
    if (database.isOpen) database.close();
  }
});

describe("FX snapshot persistence and refresh", () => {
  it("replaces and reads one complete snapshot from the generic settings store", () => {
    const database = openDatabase();
    const value = snapshot();

    replaceFxSnapshot(database, value);

    expect(readFxSnapshot(database)).toEqual(value);
    expect(
      (
        database
          .prepare("select count(*) as count from app_settings where key = ?")
          .get("fx.rates.snapshot.v1") as { count: number }
      ).count,
    ).toBe(1);
  });

  it("updates the entire snapshot after two successful refreshes", async () => {
    const database = openDatabase();
    const first = snapshot({ rates: { CNY: 1, HKD: 1.01, USD: 7.01 } });
    const second = snapshot({
      rates: { CNY: 1, HKD: 1.03, USD: 7.11 },
      rateDate: "2026-09-19",
      fetchedAt: "2026-09-19T11:00:00.000Z",
    });
    const fetchLatest = async () => (readFxSnapshot(database) ? second : first);

    await expect(
      refreshFxSnapshot(database, {
        fetchLatest,
        now: () => "2026-09-19T11:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      status: "fresh",
      snapshot: { ...first, lastAttemptedAt: "2026-09-19T11:00:00.000Z" },
    });
    await expect(
      refreshFxSnapshot(database, {
        fetchLatest,
        now: () => "2026-09-19T12:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      status: "fresh",
      snapshot: { ...second, lastAttemptedAt: "2026-09-19T12:00:00.000Z" },
    });
    expect(readFxSnapshot(database)).toMatchObject({
      ...second,
      lastAttemptedAt: "2026-09-19T12:00:00.000Z",
    });
  });

  it("reads the successful snapshot after the SQLite database is reopened", () => {
    const directory = mkdtempSync(join(tmpdir(), "tradereview-fx-"));
    const path = join(directory, "snapshot.sqlite");
    const firstDatabase = new DatabaseSync(path);
    initializeSqlite(firstDatabase);
    const value = snapshot();
    replaceFxSnapshot(firstDatabase, value);
    firstDatabase.close();

    const secondDatabase = new DatabaseSync(path);
    databases.push(secondDatabase);
    initializeSqlite(secondDatabase);
    expect(readFxSnapshot(secondDatabase)).toEqual(value);
    secondDatabase.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("keeps the previous complete snapshot and marks it cached after a failed refresh", async () => {
    const database = openDatabase();
    const previous = snapshot();
    replaceFxSnapshot(database, previous);

    const result = await refreshFxSnapshot(database, {
      fetchLatest: async () => {
        throw new Error("provider unavailable");
      },
      now: () => "2026-09-19T11:30:00.000Z",
    });

    expect(result).toMatchObject({
      status: "cached",
      snapshot: {
        rates: previous.rates,
        fetchedAt: previous.fetchedAt,
        cacheStatus: "cached",
        lastAttemptedAt: "2026-09-19T11:30:00.000Z",
        lastError: "provider unavailable",
      },
    });
    expect(readFxSnapshot(database)).toMatchObject({
      rates: previous.rates,
      fetchedAt: previous.fetchedAt,
      cacheStatus: "cached",
    });
  });

  it("does not create a zero or partial snapshot when the first refresh fails", async () => {
    const database = openDatabase();

    const result = await refreshFxSnapshot(database, {
      fetchLatest: async () => {
        throw new Error("timeout");
      },
      now: () => "2026-09-19T11:30:00.000Z",
    });

    expect(result).toMatchObject({ status: "unavailable", snapshot: null });
    expect(readFxSnapshot(database)).toBeNull();
  });

  it("rejects an incomplete candidate without replacing the old snapshot", async () => {
    const database = openDatabase();
    const previous = snapshot();
    replaceFxSnapshot(database, previous);

    const result = await refreshFxSnapshot(database, {
      fetchLatest: async () => ({
        ...previous,
        rates: { CNY: 1, HKD: 1.03, USD: Number.NaN },
      }),
      now: () => "2026-09-19T11:30:00.000Z",
    });

    expect(result.status).toBe("cached");
    expect(readFxSnapshot(database)).toMatchObject({
      rates: previous.rates,
      fetchedAt: previous.fetchedAt,
      cacheStatus: "cached",
    });
  });

  it("does not let an older failed refresh overwrite a newer successful refresh", async () => {
    const database = openDatabase();
    const olderFailure = Promise.withResolvers<FxSnapshot>();
    const newer = snapshot({
      rates: { CNY: 1, HKD: 1.04, USD: 7.2 },
      rateDate: "2026-09-19",
      fetchedAt: "2026-09-19T12:00:00.000Z",
    });
    let call = 0;
    const fetchLatest = vi.fn(() => {
      call += 1;
      return call === 1 ? olderFailure.promise : Promise.resolve(newer);
    });

    const first = refreshFxSnapshot(database, {
      fetchLatest,
      now: () => "2026-09-19T11:00:00.000Z",
    });
    const second = refreshFxSnapshot(database, {
      fetchLatest,
      now: () => "2026-09-19T12:00:00.000Z",
    });
    await expect(second).resolves.toMatchObject({
      status: "fresh",
      snapshot: { ...newer, lastAttemptedAt: "2026-09-19T12:00:00.000Z" },
    });
    olderFailure.reject(new Error("older provider failure"));

    await expect(first).resolves.toMatchObject({
      status: "fresh",
      snapshot: { ...newer, lastAttemptedAt: "2026-09-19T12:00:00.000Z" },
    });
    expect(readFxSnapshot(database)).toMatchObject({
      rates: newer.rates,
      cacheStatus: "fresh",
    });
    expect(readFxSnapshot(database)).not.toHaveProperty("lastError");
  });

  it("does not let an older successful refresh overwrite a newer failed refresh", async () => {
    const database = openDatabase();
    const olderSuccess = Promise.withResolvers<FxSnapshot>();
    const previous = snapshot();
    replaceFxSnapshot(database, previous);
    let call = 0;
    const fetchLatest = vi.fn(() => {
      call += 1;
      return call === 1 ? olderSuccess.promise : Promise.reject(new Error("newer failure"));
    });

    const first = refreshFxSnapshot(database, {
      fetchLatest,
      now: () => "2026-09-19T11:00:00.000Z",
    });
    const second = refreshFxSnapshot(database, {
      fetchLatest,
      now: () => "2026-09-19T12:00:00.000Z",
    });
    await expect(second).resolves.toMatchObject({
      status: "cached",
      snapshot: { cacheStatus: "cached", lastError: "newer failure" },
    });
    olderSuccess.resolve(snapshot({ rates: { CNY: 1, HKD: 1.05, USD: 7.3 } }));

    await expect(first).resolves.toMatchObject({ status: "cached" });
    expect(readFxSnapshot(database)).toMatchObject({
      rates: previous.rates,
      cacheStatus: "cached",
      lastError: "newer failure",
    });
  });
});
