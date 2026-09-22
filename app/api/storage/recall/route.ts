import { openSqliteDatabase } from "../../../../db/sqlite";
import {
  RecallConflictError,
  RecallNotFoundError,
  getRecallDocument,
  saveRecallDocument,
} from "../../../lib/recall/server-repository";
import { RecallValidationError } from "../../../lib/recall/document";
import type { RecallDocument, RecallSaveInput } from "../../../lib/recall/types";

export const runtime = "nodejs";

function response(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function failure(
  code: "invalid-request" | "not-found" | "conflict" | "storage-unavailable",
  message: string,
  status: number,
): Response {
  return response({ error: { code, message } }, status);
}

export async function GET(request: Request): Promise<Response> {
  const episodeId = new URL(request.url).searchParams.get("episodeId");
  if (!episodeId || episodeId.trim().length === 0) {
    return failure("invalid-request", "episodeId is required", 400);
  }
  try {
    const document = getRecallDocument(openSqliteDatabase(), episodeId);
    return document
      ? response(document)
      : failure("not-found", "Recall document not found", 404);
  } catch (error) {
    if (error instanceof RecallValidationError) {
      return failure("invalid-request", error.message, 400);
    }
    return failure("storage-unavailable", "Recall storage is unavailable", 503);
  }
}

function parseSaveBody(value: unknown): RecallSaveInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecallValidationError("Recall save body must be an object");
  }
  const body = value as Record<string, unknown>;
  const documentValue = "document" in body ? body.document : value;
  if (!documentValue || typeof documentValue !== "object" || Array.isArray(documentValue)) {
    throw new RecallValidationError("Recall document is required");
  }
  const document = documentValue as RecallDocument;
  const expectedRevision = body.expectedRevision ?? document.revision;
  if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new RecallValidationError("expectedRevision must be a non-negative integer");
  }
  if (body.finalize !== undefined && typeof body.finalize !== "boolean") {
    throw new RecallValidationError("finalize must be boolean");
  }
  return {
    document,
    expectedRevision,
    ...(body.finalize === undefined ? {} : { finalize: body.finalize === true }),
  };
}

export async function PUT(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("invalid-request", "request body must be valid JSON", 400);
  }
  try {
    const saved = saveRecallDocument(openSqliteDatabase(), parseSaveBody(body));
    return response(saved.document);
  } catch (error) {
    if (error instanceof RecallConflictError) {
      return failure("conflict", error.message, 409);
    }
    if (error instanceof RecallNotFoundError) {
      return failure("not-found", error.message, 404);
    }
    if (error instanceof RecallValidationError) {
      return failure("invalid-request", error.message, 400);
    }
    return failure("storage-unavailable", "Recall storage is unavailable", 503);
  }
}
