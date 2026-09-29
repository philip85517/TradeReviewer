import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { initializeSqlite } from "./sqlite";
import { SQLITE_MIGRATIONS } from "./sqlite-schema";

const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe("TradingView account migration SQLite schema", () => {
  it("registers the migration DDL as the next version without changing prior checksums", () => {
    expect(SQLITE_MIGRATIONS.at(-1)).toMatchObject({
      version: 14,
      name: "tradingview-account-migration",
    });
    expect(SQLITE_MIGRATIONS.slice(0, -1).map(({ version, checksum }) => ({ version, checksum }))).toEqual([
      { version: 1, checksum: "bf5e2a51726b8284b3e5abf4b5639db602a4792e2d6af678559aa953396eea40" },
      { version: 2, checksum: "401b915358bb32042c4d79eed35edd18662a1cec58193b08f498d245a33938fa" },
      { version: 3, checksum: "1ed38012c97a6e534ffd44da7489a94a88399115f074f9807f8e6dc474806feb" },
      { version: 4, checksum: "7545b452834b42b1bb56d0b947126942749e42e72975fa4b88c7701aac32887a" },
      { version: 5, checksum: "868fc720cea02b82444dcf7874fdaaa6fa71d36cc7a7583643ce752b94225d8d" },
      { version: 6, checksum: "64857cafe9e22606a02cd9f8d579f2095f2e425b3b6ace3d0affa1d5c2e436ee" },
      { version: 7, checksum: "5b45b208853e1d914b0c74bb5c9acc2b9dbe14408817bd7260c44ea822aea698" },
      { version: 8, checksum: "51b4ee7565671f5331e5b8f7defd278e9b8f4dc35df52688d9e7320a67223ee3" },
      { version: 9, checksum: "3a171f5f5c651c76e69d0d056e1e4b958f5cbe054efc1f5d5fafbcd79b5e4900" },
      { version: 10, checksum: "090afc7c2043eed3b0059d869533b4ef2c8e1b1fe1b6c66391fe9adcec581147" },
      { version: 11, checksum: "71ad249ec789586e19e37c7f68fb4358b9564a58426d78a35c024c305e3d8ef5" },
      { version: 12, checksum: "1efa87843cd5da1e1e31f9d4af72536bcde9f2562c7989299e15e71df6f4e260" },
      { version: 13, checksum: "5182cc3c0c82f291e8a0adf4919f29af8669e498ff1d485f7f1e0b25595f7c95" },
    ]);
  });

  it("creates migration tables and upgrades an in-memory database twice without duplicates", () => {
    const database = new DatabaseSync(":memory:");
    databases.push(database);

    initializeSqlite(database);
    initializeSqlite(database);

    expect(database.prepare("select count(*) as count from schema_migrations where version = 14").get()).toEqual({ count: 1 });
    expect(database.prepare("select name from sqlite_master where type = 'table'").all()).toEqual(expect.arrayContaining([
      { name: "account_principal_provisionals" },
      { name: "tradingview_account_migration_operations" },
      { name: "tradingview_account_migration_rows" },
      { name: "tradingview_account_migration_aliases" },
      { name: "tradingview_account_migration_dependencies" },
    ]));
  });
});
