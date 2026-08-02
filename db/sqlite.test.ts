import { mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  initializeSqlite,
  openSqliteDatabase,
  withSqliteTransaction,
} from "./sqlite";
import { SQLITE_MIGRATIONS } from "./sqlite-schema";

const temporaryDirectories: string[] = [];

function tempDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), "trade-review-sqlite-"));
  temporaryDirectories.push(directory);
  return join(directory, "tradereview.sqlite");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("SQLite storage foundation", () => {
  it("creates the unified schema and applies required pragmas", () => {
    const database = openSqliteDatabase(tempDatabasePath());

    expect(database.prepare("select name from sqlite_master where type='table'").all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "instruments" }),
        expect.objectContaining({ name: "executions" }),
        expect.objectContaining({ name: "schema_migrations" }),
        expect.objectContaining({ name: "app_settings" }),
      ]),
    );
    expect(database.prepare("pragma foreign_keys").get()).toMatchObject({ foreign_keys: 1 });
    expect(database.prepare("pragma journal_mode").get()).toMatchObject({ journal_mode: "wal" });
    expect(database.prepare("pragma busy_timeout").get()).toMatchObject({ timeout: 5000 });
  });

  it("rolls back a transaction when a write throws", () => {
    const database = openSqliteDatabase(tempDatabasePath());

    expect(() =>
      withSqliteTransaction(database, () => {
        database.prepare(
          "insert into instruments (id, symbol, name, market, currency) values (?, ?, ?, ?, ?)",
        ).run("HK:700", "700", "腾讯控股", "HK", "HKD");
        throw new Error("abort");
      }),
    ).toThrow("abort");

    expect(database.prepare("select count(*) as count from instruments").get()).toEqual({ count: 0 });
  });

  it("records a checksum for every applied migration without reapplying them", () => {
    const database = openSqliteDatabase(tempDatabasePath());
    const appliedMigrations = database
      .prepare("select version, checksum from schema_migrations order by version")
      .all();

    expect(appliedMigrations).toEqual(
      SQLITE_MIGRATIONS.map((migration) => ({
        version: migration.version,
        checksum: createHash("sha256").update(migration.sql).digest("hex"),
      })),
    );

    initializeSqlite(database);
    expect(database.prepare("select count(*) as count from schema_migrations").get()).toEqual({
      count: SQLITE_MIGRATIONS.length,
    });
  });

  it("rejects root and unsafe database paths before creating a directory", () => {
    expect(() => openSqliteDatabase("/")).toThrow("unsafe");
    expect(() => openSqliteDatabase("relative.sqlite")).toThrow("absolute path");
    expect(() => openSqliteDatabase("/tmp/../unsafe.sqlite")).toThrow("unsafe");
  });
});
