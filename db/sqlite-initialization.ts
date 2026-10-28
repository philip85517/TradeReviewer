import type { DatabaseSync } from "node:sqlite";
import { SQLITE_MIGRATIONS } from "./sqlite-schema.ts";

export class UnsupportedSqliteSchemaError extends Error {
  readonly code = "SQLITE_SCHEMA_UNSUPPORTED";
  readonly version: number;
  constructor(version: number) {
    super(`SQLite schema migration ${version} is unsupported by this application`);
    this.name = "UnsupportedSqliteSchemaError";
    this.version = version;
  }
}


export function initializeSqlite(database: DatabaseSync): void {
  // Inspect before any PRAGMA/schema mutation. A newer writer's database must
  // never be quietly opened by an older application with incomplete rules.
  if (database.prepare("select 1 from sqlite_master where type = 'table' and name = 'schema_migrations'").get()) {
    const supported = new Set(SQLITE_MIGRATIONS.map((migration) => migration.version));
    for (const row of database.prepare("select version from schema_migrations").all()) {
      if (typeof row.version !== "number" || !supported.has(row.version)) {
        throw new UnsupportedSqliteSchemaError(Number(row.version));
      }
    }
  }
  database.exec("pragma foreign_keys = on");
  database.exec("pragma journal_mode = wal");
  database.exec("pragma busy_timeout = 5000");
  database.exec(`
    create table if not exists schema_migrations (
      version integer primary key,
      name text not null,
      checksum text not null,
      applied_at text not null default current_timestamp
    )
  `);

  const applied = database.prepare("select checksum from schema_migrations where version = ?");
  const record = database.prepare(
    "insert into schema_migrations (version, name, checksum) values (?, ?, ?)",
  );

  // The feature branch shipped simulation columns as migration 4, while
  // master shipped audited revisions under that number. Recognize only the
  // exact published simulation checksum before promoting its history to 5.
  const simulationMigration = SQLITE_MIGRATIONS.find(m => m.name === "persist-trade-nature-and-simulation-scope")!;
  const legacy = applied.get(4) as { checksum: string } | undefined;
  if (legacy?.checksum === simulationMigration.checksum && !applied.get(simulationMigration.version)) {
    withSqliteTransaction(database, () => {
      database.prepare("update schema_migrations set version = ? where version = 4 and checksum = ?")
        .run(simulationMigration.version, simulationMigration.checksum);
    });
  }

  for (const migration of SQLITE_MIGRATIONS) {
    const existing = applied.get(migration.version) as { checksum: string } | undefined;
    if (existing) {
      if (existing.checksum !== migration.checksum) {
        throw new Error(`SQLite migration ${migration.version} checksum does not match`);
      }
      continue;
    }

    withSqliteTransaction(database, () => {
      database.exec(migration.sql);
      record.run(migration.version, migration.name, migration.checksum);
    });
  }
}


export function withSqliteTransaction<T>(database: DatabaseSync, work: () => T): T {
  database.exec("begin immediate");
  try {
    const result = work();
    database.exec("commit");
    return result;
  } catch (error) {
    database.exec("rollback");
    throw error;
  }
}
