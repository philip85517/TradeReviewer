import "server-only";

import type { DatabaseSync } from "node:sqlite";

import { withSqliteTransaction } from "../../../db/sqlite";
import { buildTradeEpisodes } from "../trades/episodes";
import type { TradeEpisode } from "../trades/types";
import { getSqliteStore } from "../storage/sqlite-store";
import {
  cloneRecallDocument,
  completeRecallDocument,
  RecallValidationError,
  validateRecallDocument,
} from "./document";
import type {
  RecallCompletedVersion,
  RecallDocument,
  RecallSaveInput,
  RecallSaveResult,
} from "./types";

type Row = Record<string, unknown>;

export class RecallConflictError extends Error {
  readonly code = "conflict";

  constructor(message = "Recall document revision is stale") {
    super(message);
    this.name = "RecallConflictError";
  }
}

export class RecallNotFoundError extends Error {
  readonly code = "not-found";

  constructor(message: string) {
    super(message);
    this.name = "RecallNotFoundError";
  }
}

function parseDocument(value: unknown, field: string): RecallDocument {
  if (typeof value !== "string") throw new RecallValidationError(`${field} is invalid`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new RecallValidationError(`${field} is invalid JSON`);
  }
  validateRecallDocument(parsed);
  return parsed;
}

function serialize(document: RecallDocument): string {
  validateRecallDocument(document);
  return JSON.stringify(document);
}

function withoutLastCompleted(document: RecallDocument): RecallDocument {
  const draft = cloneRecallDocument(document);
  delete draft.lastCompleted;
  return draft;
}

function asFormal(document: RecallDocument): RecallCompletedVersion {
  const formal = withoutLastCompleted(document);
  delete formal.reconciliation;
  if (formal.status !== "completed" || !formal.completedAt) {
    throw new RecallValidationError("finalized recall document must be completed");
  }
  return formal as RecallCompletedVersion;
}

function formalFromRow(row: Row): RecallCompletedVersion | undefined {
  if (row.finalized_json === null || row.finalized_json === undefined) return undefined;
  const formal = parseDocument(row.finalized_json, "finalized recall document");
  if (formal.status !== "completed" || !formal.completedAt) {
    throw new RecallValidationError("stored finalized recall document is incomplete");
  }
  return asFormal(formal);
}

function rowDocument(row: Row): RecallDocument {
  const draft = parseDocument(row.draft_json, "draft recall document");
  const formal = formalFromRow(row);
  if (formal) draft.lastCompleted = formal;
  if (typeof row.revision === "number") draft.revision = row.revision;
  if (typeof row.updated_at === "string") draft.updatedAt = row.updated_at;
  validateRecallDocument(draft);
  return draft;
}

export function getRecallDocument(
  database: DatabaseSync,
  episodeId: string,
): RecallDocument | undefined {
  if (typeof episodeId !== "string" || episodeId.trim().length === 0) {
    throw new RecallValidationError("episodeId is required");
  }
  const row = database
    .prepare("select episode_id, draft_json, finalized_json, revision, updated_at from recall_documents where episode_id = ?")
    .get(episodeId) as Row | undefined;
  return row ? rowDocument(row) : undefined;
}

export const loadRecallDocument = getRecallDocument;

function currentEpisode(database: DatabaseSync, episodeId: string): TradeEpisode {
  const executions = getSqliteStore(database).getExecutions();
  const episode = buildTradeEpisodes(executions).find((candidate) => candidate.id === episodeId);
  if (!episode) throw new RecallNotFoundError(`Unknown episode: ${episodeId}`);
  return episode;
}

export function saveRecallDocument(
  database: DatabaseSync,
  input: RecallSaveInput,
): RecallSaveResult {
  if (!input || typeof input !== "object") throw new RecallValidationError("recall save input is invalid");
  validateRecallDocument(input.document);
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new RecallValidationError("expectedRevision must be a non-negative integer");
  }

  // Acquire SQLite's write lock before reading the revision. A read followed
  // by a later transaction would let two processes pass the same CAS check.
  return withSqliteTransaction(database, () => {
    const existing = database
      .prepare("select episode_id, draft_json, finalized_json, revision, updated_at from recall_documents where episode_id = ?")
      .get(input.document.episodeId) as Row | undefined;
    const currentRevision = existing && typeof existing.revision === "number" ? existing.revision : 0;
    if (currentRevision !== input.expectedRevision) {
      throw new RecallConflictError();
    }

    // Finalization is an explicit command. An edited completed draft can be
    // autosaved without replacing the last formal version.
    const finalize = input.finalize === true;
    let draft = cloneRecallDocument(input.document);
    let formal: RecallCompletedVersion | undefined = existing ? formalFromRow(existing) : undefined;
    // The client cannot replace the formal copy by echoing a different
    // `lastCompleted` value in an autosave payload.
    delete draft.lastCompleted;
    if (finalize) {
      // The server is the authority for closed/open status. The request cannot
      // turn an open episode into a completed record by setting a boolean.
      const episode = currentEpisode(database, input.document.episodeId);
      draft = completeRecallDocument(draft, episode, draft.completedAt ?? new Date().toISOString());
      formal = asFormal(draft);
    }
    const nextRevision = currentRevision + 1;
    draft.revision = nextRevision;
    draft.updatedAt = new Date().toISOString();
    if (finalize && formal) {
      formal.revision = nextRevision;
      formal.updatedAt = draft.updatedAt;
      formal = asFormal(formal);
    }
    const draftJson = serialize(withoutLastCompleted(draft));
    const formalJson = formal ? serialize(formal) : null;
    database.prepare(`
      insert into recall_documents (episode_id, draft_json, finalized_json, revision, updated_at)
      values (?, ?, ?, ?, ?)
      on conflict(episode_id) do update set
        draft_json = excluded.draft_json,
        finalized_json = coalesce(excluded.finalized_json, recall_documents.finalized_json),
        revision = excluded.revision,
        updated_at = excluded.updated_at
    `).run(draft.episodeId, draftJson, formalJson, nextRevision, draft.updatedAt);
    if (formal) draft.lastCompleted = formal;
    validateRecallDocument(draft);
    return { document: draft, revision: nextRevision };
  });
}

export const putRecallDocument = saveRecallDocument;
