import { openSqliteDatabase } from "../../../../../db/sqlite";
import {
  validateResolvedInstrument,
  type InstrumentLookup,
  type ResolvedInstrument,
} from "../../../../lib/instruments/metadata-contracts";
import { getSqliteStore } from "../../../../lib/storage/sqlite-store";

export const runtime = "nodejs";

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function invalid() {
  return response(
    { error: { code: "invalid-request", message: "invalid request" } },
    400,
  );
}

function parseInstrumentIds(request: Request): string[] | undefined {
  const ids = [...new Set(
    new URL(request.url).searchParams
      .getAll("id")
      .map((value) => value.trim())
      .filter(Boolean),
  )];
  return ids.length > 0 && ids.length <= 100 ? ids : undefined;
}

function parseMetadata(value: unknown): ResolvedInstrument | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  const market = typeof candidate.market === "string"
    ? candidate.market.toUpperCase()
    : "";
  const symbol = typeof candidate.symbol === "string"
    ? candidate.symbol
    : "";
  try {
    return validateResolvedInstrument(value, {
      market: market as InstrumentLookup["market"],
      symbol,
    });
  } catch {
    return undefined;
  }
}

export async function GET(request: Request) {
  const instrumentIds = parseInstrumentIds(request);
  if (!instrumentIds) return invalid();
  try {
    const instruments = getSqliteStore(openSqliteDatabase())
      .getInstrumentMetadata(instrumentIds);
    return response({ instruments });
  } catch {
    return response(
      { error: { code: "storage-unavailable", message: "storage unavailable" } },
      503,
    );
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid();
  }
  const metadata = parseMetadata(body);
  if (!metadata) return invalid();
  try {
    getSqliteStore(openSqliteDatabase()).putInstrumentMetadata(metadata);
    return response({ ok: true });
  } catch (caught) {
    if (caught instanceof Error && (caught.message.startsWith("Invalid ") || caught.message.includes("证券元数据结果无效"))) {
      return invalid();
    }
    return response(
      { error: { code: "storage-unavailable", message: "storage unavailable" } },
      503,
    );
  }
}
