import "server-only";
import { ensureImportHistoryAudit } from "../app/lib/storage/import-history-audit";

import { existsSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, isAbsolute, parse, resolve, sep } from "node:path";

import { initializeSqlite } from "./sqlite-initialization.ts";
export { initializeSqlite, withSqliteTransaction, UnsupportedSqliteSchemaError } from "./sqlite-initialization.ts";
import { resolveRuntimeConfig } from "../scripts/runtime-config.mjs";

export const SQLITE_DATABASE_PATH = "/var/lib/tradereview/tradereview.sqlite";

const databases = new Map<string, DatabaseSync>();


function resolveDatabasePath(path?: string): string {
  const candidate = path ?? resolveRuntimeConfig().databasePath;

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


export function openSqliteDatabase(path?: string): DatabaseSync {
  const databasePath = resolveDatabasePath(path);
  const existing = databases.get(databasePath);
  if (existing?.isOpen) {
    return existing;
  }
  if (existing) {
    databases.delete(databasePath);
  }

  if (!path && !process.env.TRADEREVIEW_DB_PATH?.trim()) {
    const runtime = resolveRuntimeConfig();
    if (runtime.databasePathSource === "config" && !existsSync(databasePath)) {
      throw new Error(`Configured SQLite database does not exist: ${databasePath}`);
    }
  }
  ensureDatabaseDirectory(databasePath);
  const database = new DatabaseSync(databasePath);
  try {
    initializeSqlite(database);
    ensureImportHistoryAudit(database);
  } catch (error) {
    database.close();
    throw error;
  }

  databases.set(databasePath, database);
  return database;
}
