import { openSqliteDatabase } from "../../../../db/sqlite";
import type { BrowserStatePayload } from "../../../lib/storage/sqlite-contracts";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";

export const runtime = "nodejs";

const COLLECTIONS = [
  "executions", "importHistory", "instruments", "reviews", "reviewStates",
  "tagSuggestions", "marketDataJobs", "dailyCandles", "marketCandles", "coverage",
  "intervalCoverage", "providerSymbols",
] as const;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function invalidPayload(message = "Migration payload is invalid") {
  return json({ error: { code: "invalid-payload", message } }, 400);
}

function parsePayload(value: unknown): BrowserStatePayload | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const payload = value as Record<string, unknown>;
  if (
    payload.version !== 1
    || typeof payload.sourceClientId !== "string" || !payload.sourceClientId
    || typeof payload.sourceFingerprint !== "string" || !payload.sourceFingerprint
    || !payload.settings || typeof payload.settings !== "object" || Array.isArray(payload.settings)
    || COLLECTIONS.some((field) => !Array.isArray(payload[field]))
  ) {
    return undefined;
  }
  return payload as BrowserStatePayload;
}

function isValidationError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("Invalid ");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidPayload("Migration payload must be valid JSON");
  }

  const payload = parsePayload(body);
  if (!payload) return invalidPayload();

  try {
    return json(getSqliteStore(openSqliteDatabase()).mergeBrowserState(payload));
  } catch (error) {
    if (isValidationError(error)) return invalidPayload();
    return json(
      { error: { code: "database-unavailable", message: "Storage database is unavailable" } },
      503,
    );
  }
}
