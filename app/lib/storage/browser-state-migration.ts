import type { BrowserStatePayload, MigrationReport } from "./sqlite-contracts";
import { StorageHttpError, type SqliteHttpClient } from "./sqlite-http-client";

export const SQLITE_MIGRATION_MARKER_KEY = "trade-reviewer:sqlite-migration:complete:v1";
const MAX_ATTEMPTS = 3;

type MigrationClient = Pick<SqliteHttpClient, "migrate">;
type MigrationOptions = {
  /** The SQLite server has no recorded migration, so a local marker is not authoritative. */
  ignoreLocalMarker?: boolean;
};

function completed(payload: BrowserStatePayload): MigrationReport | null {
  const serialized = localStorage.getItem(SQLITE_MIGRATION_MARKER_KEY);
  if (!serialized) return null;
  try {
    const marker = JSON.parse(serialized) as MigrationReport;
    return marker.sourceFingerprint === payload.sourceFingerprint && typeof marker.validationDigest === "string" && marker.validationDigest ? marker : null;
  } catch { return null; }
}

function retryable(error: unknown) {
  return !(error instanceof StorageHttpError) || error.status >= 500;
}

export async function migrateLegacyBrowserState(
  client: MigrationClient,
  payload: BrowserStatePayload,
  options: MigrationOptions = {},
): Promise<MigrationReport> {
  const prior = options.ignoreLocalMarker ? null : completed(payload);
  if (prior) return prior;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const report = await client.migrate(payload);
      if (!report.validationDigest) throw new Error("SQLite migration response did not include validation digest");
      localStorage.setItem(SQLITE_MIGRATION_MARKER_KEY, JSON.stringify(report));
      return report;
    } catch (error) {
      lastError = error;
      if (!retryable(error)) throw error;
    }
  }
  throw lastError;
}
