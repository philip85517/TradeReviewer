import type { RecallDocument } from "./types";
import { validateRecallDocument } from "./document";

export class RecallRepositoryError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RecallRepositoryError";
  }
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function errorBody(value: unknown): { code?: string; message?: string } {
  if (!value || typeof value !== "object") return {};
  const error = "error" in value ? (value as { error?: unknown }).error : value;
  if (!error || typeof error !== "object") return {};
  const body = error as { code?: unknown; message?: unknown };
  return {
    ...(typeof body.code === "string" ? { code: body.code } : {}),
    ...(typeof body.message === "string" ? { message: body.message } : {}),
  };
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new RecallRepositoryError(
      response.status,
      "invalid-response",
      "Recall storage returned invalid JSON",
    );
  }
}

function unwrapDocument(value: unknown): RecallDocument {
  const candidate =
    value && typeof value === "object" && "document" in value
      ? (value as { document?: unknown }).document
      : value;
  validateRecallDocument(candidate);
  return candidate;
}

function episodeUrl(episodeId: string): string {
  if (typeof episodeId !== "string" || episodeId.trim().length === 0) {
    throw new RecallRepositoryError(400, "invalid-request", "episodeId is required");
  }
  return `/api/storage/recall?episodeId=${encodeURIComponent(episodeId)}`;
}

export async function fetchRecallDocument(
  episodeId: string,
  fetcher: Fetcher = fetch,
): Promise<RecallDocument | null> {
  const response = await fetcher(episodeUrl(episodeId), { cache: "no-store" });
  const body = await parseJson(response);
  if (response.status === 404) return null;
  if (!response.ok) {
    const error = errorBody(body);
    throw new RecallRepositoryError(
      response.status,
      error.code ?? "storage-request-failed",
      error.message ?? `Recall storage request failed (${response.status})`,
    );
  }
  return unwrapDocument(body);
}

export const loadRecallDocument = fetchRecallDocument;
export const getRecallDocument = fetchRecallDocument;

export type RecallSaveOptions = {
  expectedRevision?: number;
  finalize?: boolean;
  fetcher?: Fetcher;
};

export async function saveRecallDocument(
  document: RecallDocument,
  optionsOrRevision: RecallSaveOptions | number = {},
  maybeFetcher?: Fetcher,
): Promise<RecallDocument> {
  const options: RecallSaveOptions =
    typeof optionsOrRevision === "number"
      ? { expectedRevision: optionsOrRevision, fetcher: maybeFetcher }
      : optionsOrRevision;
  const expectedRevision = options.expectedRevision ?? document.revision;
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new RecallRepositoryError(400, "invalid-request", "expectedRevision must be a non-negative integer");
  }
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher("/api/storage/recall", {
    method: "PUT",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      document,
      expectedRevision,
      ...(options.finalize === undefined ? {} : { finalize: options.finalize }),
    }),
  });
  const body = await parseJson(response);
  if (!response.ok) {
    const error = errorBody(body);
    throw new RecallRepositoryError(
      response.status,
      error.code ?? "storage-request-failed",
      error.message ?? `Recall storage request failed (${response.status})`,
    );
  }
  const saved = unwrapDocument(body);
  return saved;
}

export function createRecallRepository(fetcher: Fetcher = fetch) {
  return {
    load: (episodeId: string) => fetchRecallDocument(episodeId, fetcher),
    fetch: (episodeId: string) => fetchRecallDocument(episodeId, fetcher),
    save: (document: RecallDocument, options: Omit<RecallSaveOptions, "fetcher"> = {}) =>
      saveRecallDocument(document, { ...options, fetcher }),
  };
}

export type { RecallSaveResult } from "./types";
