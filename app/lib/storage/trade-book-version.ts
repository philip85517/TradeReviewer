import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type BookVersion = Readonly<{ databaseId: string; epoch: string; sequence: number }>;

/** State absence/corruption is an explicit operational failure, never version zero. */
export class BookVersionUnavailableError extends Error {
  readonly code = "BOOK_VERSION_UNAVAILABLE";
  readonly phase = "book-version";
  readonly retryable = false;
  constructor(options?: ErrorOptions) {
    super("Trade book version state is unavailable or invalid", options);
    this.name = "BookVersionUnavailableError";
  }
}

/** The expected book, recovery epoch, or sequence no longer matches. */
export class BookVersionChangedError extends Error {
  readonly code = "BOOK_VERSION_CHANGED";
  readonly phase = "book-version";
  readonly retryable = false;
  readonly expected: BookVersion;
  readonly actual: BookVersion;
  constructor(expected: BookVersion, actual: BookVersion) {
    super("Trade book version changed; prepare or read again");
    this.name = "BookVersionChangedError";
    this.expected = expected;
    this.actual = actual;
  }
}

function parseVersion(row: Record<string, unknown> | undefined): BookVersion {
  if (!row || typeof row.database_id !== "string" || !row.database_id.trim()
    || typeof row.epoch !== "string" || !row.epoch.trim()
    || typeof row.sequence !== "number" || !Number.isSafeInteger(row.sequence) || row.sequence < 0) {
    throw new BookVersionUnavailableError();
  }
  return Object.freeze({ databaseId: row.database_id, epoch: row.epoch, sequence: row.sequence });
}

/** Reads from the caller's connection/transaction; does not start or finish one. */
export function readBookVersion(database: DatabaseSync): BookVersion {
  try {
    return parseVersion(database.prepare("select database_id, epoch, sequence from trade_book_state where singleton = 1").get());
  } catch (error) {
    if (error instanceof BookVersionUnavailableError) throw error;
    // Preserve native busy/connection errors for the boundary that maps them.
    if (!(error instanceof Error) || !error.message.includes("no such table: trade_book_state")) throw error;
    throw new BookVersionUnavailableError({ cause: error });
  }
}

export function assertBookVersion(database: DatabaseSync, expected: BookVersion): void {
  const actual = readBookVersion(database);
  if (actual.databaseId !== expected.databaseId || actual.epoch !== expected.epoch || actual.sequence !== expected.sequence) {
    throw new BookVersionChangedError(expected, actual);
  }
}

/**
 * Explicit restore/independent-clone step. One atomic statement also participates
 * in an existing maintenance transaction. Normal initialization never calls it.
 * Import this file directly from native Node for offline maintenance; it has no
 * application bootstrap, path lookup, or server-only package dependency.
 */
export function rotateBookEpoch(database: DatabaseSync): BookVersion {
  readBookVersion(database); // Missing state must not turn into a new default book.
  return parseVersion(database.prepare("update trade_book_state set epoch = ?, sequence = 0 where singleton = 1 returning database_id, epoch, sequence")
    .get(randomUUID()));
}
