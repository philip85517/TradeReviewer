import "server-only";

import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, isAbsolute, parse, resolve, sep } from "node:path";

import { SQLITE_MIGRATIONS } from "./sqlite-schema";

export const SQLITE_DATABASE_PATH = "/var/lib/tradereview/tradereview.sqlite";

const databases = new Map<string, DatabaseSync>();

function resolveDatabasePath(path?: string): string {
  const candidate = path ?? process.env.TRADEREVIEW_DB_PATH ?? SQLITE_DATABASE_PATH;

  if (!candidate || candidate.includes("\0") || !isAbsolute(candidate)) {
    throw new Error("SQLite database path must be a non-empty absolute path");
  }

  const resolvedPath = resolve(candidate);
  if (
    resolvedPath === parse(resolvedPath).root ||
    candidate.split(sep).includes("..") ||
    candidate.endsWith(sep)
  ) {
    throw new Error("SQLite database path is unsafe");
  }

  return resolvedPath;
}

function ensureDatabaseDirectory(path: string): void {
  const directory = dirname(path);
  if (directory === parse(directory).root) {
    return;
  }

  mkdirSync(directory, { recursive: true });
}

export function initializeSqlite(database: DatabaseSync): void {
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

export function openSqliteDatabase(path?: string): DatabaseSync {
  const databasePath = resolveDatabasePath(path);
  const existing = databases.get(databasePath);
  if (existing?.isOpen) {
    return existing;
  }
  if (existing) {
    databases.delete(databasePath);
  }

  ensureDatabaseDirectory(databasePath);
  const database = new DatabaseSync(databasePath);
  try {
    initializeSqlite(database);
  } catch (error) {
    database.close();
    throw error;
  }

  databases.set(databasePath, database);
  return database;
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
