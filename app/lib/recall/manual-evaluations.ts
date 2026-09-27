import { executionBoundaryForCursor } from '../replay/recall-replay';
import type { TradeEpisode } from '../trades/types';
import { RecallValidationError } from './document';
import type { RecallDocument, RecallDrawing } from './types';

export type RecallManualEvaluationTag = 'position' | 'entry' | 'analysis';

export type RecallManualEvaluationTarget = {
  scope: 'episode';
  decisionId: null;
  /** Optional on the wire for backwards-compatible callers; when present it must match the document. */
  episodeId?: string;
};

export type RecallManualEvaluationEvidence = {
  kind: 'text';
  drawingId: string;
  textRevision: number;
  ownerId: string;
} | {
  kind: 'snapshot';
  snapshotId: string;
};

export type RecallManualEvaluationDraft = {
  id: string;
  evaluationId: string;
  target: RecallManualEvaluationTarget;
  tags: RecallManualEvaluationTag[];
  tagDictionaryVersion: 'manual-v1';
  evidence: RecallManualEvaluationEvidence[];
  source: 'manual-retrospective';
  recordedBy: 'user';
  recordedPhase: 'post-review';
  recordedAt: string;
  knowledgeCutoff: { cursor: string; executionCursor: string };
  hasSeenFuture: boolean;
};

export type RecallManualEvaluationVersion = RecallManualEvaluationDraft & {
  retainedAt: string;
  executionIds: string[];
};

export type RecallManualEvaluationAssociation = {
  evaluationId: string;
  decisionId: null;
  executionIds?: string[];
  status: 'linked' | 'needs-confirmation';
};

export type RecallManualEvaluationState = {
  drafts: RecallManualEvaluationDraft[];
  versions: RecallManualEvaluationVersion[];
  associations: RecallManualEvaluationAssociation[];
};

export const RECALL_MANUAL_EVALUATION_TAGS: Readonly<Record<RecallManualEvaluationTag, string>> = {
  position: '仓位',
  entry: '入场',
  analysis: '判断',
};

function invalid(field: string, message: string): never {
  throw new RecallValidationError(`${field}: ${message}`);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(field, 'must be an object');
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) return invalid(field, 'must be a non-empty string');
  return value;
}

function timestamp(value: unknown, field: string): void {
  const text = stringValue(value, field);
  if (!Number.isFinite(Date.parse(text))) invalid(field, 'must be a valid ISO timestamp');
}

function uniqueStrings(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) return invalid(field, 'must be an array');
  const values = value.map((item, index) => stringValue(item, `${field}[${index}]`));
  if (new Set(values).size !== values.length) return invalid(field, 'contains duplicate identity');
  return values;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
    .join(',')}}`;
}

function evidenceKey(evidence: RecallManualEvaluationEvidence): string {
  return canonical(evidence);
}

function currentExecutionIds(document: RecallDocument): string[] {
  return [...new Set(document.decisions.flatMap(decision => decision.executionIds))].sort();
}

function validateEvidence(value: unknown, field: string): asserts value is RecallManualEvaluationEvidence[] {
  if (!Array.isArray(value)) return invalid(field, 'must be an array');
  const seen = new Set<string>();
  value.forEach((raw, index) => {
    const evidence = record(raw, `${field}[${index}]`);
    if (evidence.kind === 'text') {
      stringValue(evidence.drawingId, `${field}[${index}].drawingId`);
      stringValue(evidence.ownerId, `${field}[${index}].ownerId`);
      if (!Number.isInteger(evidence.textRevision) || (evidence.textRevision as number) < 1) {
        invalid(`${field}[${index}].textRevision`, 'must be a positive integer');
      }
    } else if (evidence.kind === 'snapshot') {
      stringValue(evidence.snapshotId, `${field}[${index}].snapshotId`);
    } else {
      invalid(`${field}[${index}].kind`, 'unsupported value');
    }
    const key = evidenceKey(evidence as RecallManualEvaluationEvidence);
    if (seen.has(key)) invalid(field, 'contains duplicate pointer');
    seen.add(key);
  });
}

function validateTarget(value: unknown, document: RecallDocument, field: string): asserts value is RecallManualEvaluationTarget {
  const target = record(value, field);
  if (target.scope !== 'episode' || target.decisionId !== null) invalid(field, 'only episode target is supported');
  if (target.episodeId !== undefined && target.episodeId !== document.episodeId) invalid(field, 'episode identity mismatch');
}

function validateDraft(value: unknown, document: RecallDocument, field: string): asserts value is RecallManualEvaluationDraft {
  const draft = record(value, field);
  stringValue(draft.id, `${field}.id`);
  stringValue(draft.evaluationId, `${field}.evaluationId`);
  validateTarget(draft.target, document, `${field}.target`);
  if (!Array.isArray(draft.tags)) invalid(`${field}.tags`, 'must be an array');
  const tags = draft.tags as unknown[];
  const seen = new Set<string>();
  for (const [index, tag] of tags.entries()) {
    if (!Object.hasOwn(RECALL_MANUAL_EVALUATION_TAGS, tag as string)) invalid(`${field}.tags[${index}]`, 'unsupported value');
    if (seen.has(tag as string)) invalid(`${field}.tags`, 'contains duplicate tag');
    seen.add(tag as string);
  }
  if (draft.tagDictionaryVersion !== 'manual-v1') invalid(`${field}.tagDictionaryVersion`, 'unsupported version');
  validateEvidence(draft.evidence, `${field}.evidence`);
  if (draft.source !== 'manual-retrospective') invalid(`${field}.source`, 'unsupported value');
  if (draft.recordedBy !== 'user') invalid(`${field}.recordedBy`, 'unsupported value');
  if (draft.recordedPhase !== 'post-review') invalid(`${field}.recordedPhase`, 'unsupported value');
  timestamp(draft.recordedAt, `${field}.recordedAt`);
  const cutoff = record(draft.knowledgeCutoff, `${field}.knowledgeCutoff`);
  timestamp(cutoff.cursor, `${field}.knowledgeCutoff.cursor`);
  stringValue(cutoff.executionCursor, `${field}.knowledgeCutoff.executionCursor`);
  if (typeof draft.hasSeenFuture !== 'boolean') invalid(`${field}.hasSeenFuture`, 'must be boolean');
}

export function validateRecallManualEvaluations(document: RecallDocument): void {
  const state = document.manualEvaluations;
  if (state === undefined) return;
  const value = record(state, 'manualEvaluations');
  for (const key of ['drafts', 'versions', 'associations'] as const) {
    if (!Array.isArray(value[key])) invalid(`manualEvaluations.${key}`, 'must be an array');
  }
  const identities = new Set<string>();
  const lineages = new Set<string>();
  const draftLineages = new Set<string>();
  for (const [index, item] of state.drafts.entries()) {
    const field = `manualEvaluations.drafts[${index}]`;
    validateDraft(item, document, field);
    if (identities.has(item.id)) invalid(`${field}.id`, 'duplicate identity');
    identities.add(item.id);
    lineages.add(item.evaluationId);
    if (draftLineages.has(item.evaluationId)) invalid('manualEvaluations.drafts', 'one draft per evaluation');
    draftLineages.add(item.evaluationId);
  }
  for (const [index, item] of state.versions.entries()) {
    const field = `manualEvaluations.versions[${index}]`;
    validateDraft(item, document, field);
    if (identities.has(item.id)) invalid(`${field}.id`, 'duplicate identity');
    identities.add(item.id);
    lineages.add(item.evaluationId);
    timestamp(item.retainedAt, `${field}.retainedAt`);
    uniqueStrings(item.executionIds, `${field}.executionIds`);
  }
  if (draftLineages.size > 1) invalid('manualEvaluations.drafts', 'episode scope permits one current evaluation');
  const associations = new Set<string>();
  for (const [index, raw] of state.associations.entries()) {
    const field = `manualEvaluations.associations[${index}]`;
    const association = record(raw, field);
    const evaluationId = stringValue(association.evaluationId, `${field}.evaluationId`);
    if (!lineages.has(evaluationId) || associations.has(evaluationId)) invalid(field, 'unknown or duplicate lineage');
    associations.add(evaluationId);
    if (association.decisionId !== null) invalid(`${field}.decisionId`, 'episode association must be null');
    if (association.status !== 'linked' && association.status !== 'needs-confirmation') invalid(`${field}.status`, 'unsupported value');
    if (association.executionIds !== undefined) uniqueStrings(association.executionIds, `${field}.executionIds`);
  }
  for (const evaluationId of lineages) if (!associations.has(evaluationId)) invalid('manualEvaluations.associations', 'missing current association');
}

export function getCurrentRecallManualEvaluation(document: RecallDocument): RecallManualEvaluationDraft | undefined {
  return document.manualEvaluations?.drafts[0];
}

export function upsertRecallManualEvaluationDraft(document: RecallDocument, draft: RecallManualEvaluationDraft): RecallDocument {
  validateDraft(draft, document, 'manualEvaluation');
  const next = structuredClone(document);
  next.manualEvaluations ??= { drafts: [], versions: [], associations: [] };
  const index = next.manualEvaluations.drafts.findIndex(item => item.evaluationId === draft.evaluationId);
  const existingDraft = index >= 0 ? next.manualEvaluations.drafts[index] : undefined;
  if (index < 0 && next.manualEvaluations.drafts.length > 0) invalid('manualEvaluation', 'episode scope permits one current evaluation');
  if (index >= 0 && next.manualEvaluations.drafts[index].id !== draft.id) invalid('manualEvaluation.id', 'draft identity must remain stable');
  if (next.manualEvaluations.versions.some(item => item.id === draft.id)) invalid('manualEvaluation.id', 'cannot reuse immutable version identity');
  for (const evidence of draft.evidence) {
    if (getRecallManualEvaluationEvidenceStatus(document, evidence).available) continue;
    if (existingDraft?.evidence.some(previous => evidenceKey(previous) === evidenceKey(evidence))) continue;
    invalid('manualEvaluation.evidence', 'new evidence pointer is not present in this document');
  }
  if (index < 0) next.manualEvaluations.drafts.push(structuredClone(draft));
  else next.manualEvaluations.drafts[index] = structuredClone(draft);
  const association = next.manualEvaluations.associations.find(item => item.evaluationId === draft.evaluationId);
  if (!association) next.manualEvaluations.associations.push({ evaluationId: draft.evaluationId, decisionId: null, status: 'linked', executionIds: currentExecutionIds(next) });
  next.updatedAt = draft.recordedAt;
  next.status = 'in-progress';
  validateRecallManualEvaluations(next);
  return next;
}

/** Mark an episode label for confirmation when the imported execution set changed. */
export function reconcileRecallManualEvaluationAssociations(document: RecallDocument): RecallDocument {
  const next = structuredClone(document);
  const state = next.manualEvaluations;
  if (!state) return next;
  const current = currentExecutionIds(next);
  for (const association of state.associations) {
    if (association.status !== 'linked') continue;
    const retained = state.versions.find(version => version.evaluationId === association.evaluationId);
    const previous = association.executionIds ?? retained?.executionIds;
    if (!previous || canonical([...previous].sort()) !== canonical(current)) {
      association.status = 'needs-confirmation';
      association.decisionId = null;
      continue;
    }
    association.executionIds = [...previous].sort();
  }
  validateRecallManualEvaluations(next);
  return next;
}

/** Explicitly accept the current episode execution set for a pending label. */
export function confirmRecallManualEvaluationAssociation(document: RecallDocument, evaluationId: string): RecallDocument {
  const next = structuredClone(document);
  const association = next.manualEvaluations?.associations.find(item => item.evaluationId === evaluationId);
  if (!association) invalid('manualEvaluation.association', 'unknown evaluation');
  association.status = 'linked';
  association.decisionId = null;
  association.executionIds = currentExecutionIds(next);
  next.updatedAt = new Date().toISOString();
  validateRecallManualEvaluations(next);
  return next;
}

function currentDrawingRecords(document: RecallDocument): RecallDrawing[] {
  return [
    ...document.working.drawings,
    ...Object.values(document.working.phaseContexts ?? {}).flatMap(context => context?.drawings ?? []),
    ...(document.working.editingContext?.drawings ?? []),
    ...(document.working.decisionDrafts ?? []).flatMap(context => context.drawings),
    ...document.snapshots.flatMap(snapshot => snapshot.drawings),
  ];
}

export function getRecallManualEvaluationEvidenceChoices(document: RecallDocument): {
  pointer: RecallManualEvaluationEvidence;
  label: string;
}[] {
  const choices: { pointer: RecallManualEvaluationEvidence; label: string }[] = [];
  const seen = new Set<string>();
  for (const drawing of currentDrawingRecords(document)) {
    const textRevision = drawing.textRevision;
    if (drawing.tool !== 'text' || typeof drawing.text !== 'string' || typeof textRevision !== 'number' || !Number.isInteger(textRevision) || textRevision < 1) continue;
    const pointer: RecallManualEvaluationEvidence = {
      kind: 'text', drawingId: drawing.id, textRevision, ownerId: drawing.recallOwnerId ?? 'global',
    };
    if (seen.has(evidenceKey(pointer))) continue;
    seen.add(evidenceKey(pointer));
    choices.push({ pointer, label: `Text · ${drawing.text.slice(0, 48)}` });
  }
  for (const snapshot of document.snapshots) {
    const pointer: RecallManualEvaluationEvidence = { kind: 'snapshot', snapshotId: snapshot.id };
    if (seen.has(evidenceKey(pointer))) continue;
    seen.add(evidenceKey(pointer));
    choices.push({ pointer, label: `快照 · ${snapshot.id}` });
  }
  return choices;
}

export function getRecallManualEvaluationEvidenceStatus(document: RecallDocument, evidence: RecallManualEvaluationEvidence): {
  available: boolean;
  reason: string | null;
} {
  if (evidence.kind === 'snapshot') return document.snapshots.some(snapshot => snapshot.id === evidence.snapshotId)
    ? { available: true, reason: null }
    : { available: false, reason: 'snapshot-missing' };
  const available = currentDrawingRecords(document).some(drawing => drawing.tool === 'text' && drawing.id === evidence.drawingId
    && drawing.textRevision === evidence.textRevision && (drawing.recallOwnerId ?? 'global') === evidence.ownerId);
  return available ? { available: true, reason: null } : { available: false, reason: 'text-revision-or-owner-missing' };
}

/**
 * The client helper rejects new missing evidence, but the server must enforce
 * the same boundary because a caller can submit a shaped document directly.
 * A pointer already present in the previous document remains valid history
 * even when its drawing or snapshot is no longer available in the new draft.
 */
export function validateRecallManualEvaluationEvidenceChanges(previous: RecallDocument | undefined, next: RecallDocument): void {
  const previousEvidence = new Set<string>();
  for (const state of [previous?.manualEvaluations, previous?.lastCompleted?.manualEvaluations]) {
    for (const evaluation of [...state?.drafts ?? [], ...state?.versions ?? []]) {
      for (const evidence of evaluation.evidence) previousEvidence.add(evidenceKey(evidence));
    }
  }
  for (const evaluation of [...next.manualEvaluations?.drafts ?? [], ...next.manualEvaluations?.versions ?? []]) {
    for (const evidence of evaluation.evidence) {
      if (getRecallManualEvaluationEvidenceStatus(next, evidence).available || previousEvidence.has(evidenceKey(evidence))) continue;
      invalid('manualEvaluation.evidence', 'new evidence pointer is not present in this document');
    }
  }
}

function cutoffAllows(draft: RecallManualEvaluationDraft, cutoff: RecallManualEvaluationDraft['knowledgeCutoff'], episode: TradeEpisode): boolean {
  const cutoffBoundary = executionBoundaryForCursor(episode.executions, cutoff.executionCursor);
  return Date.parse(draft.knowledgeCutoff.cursor) <= Date.parse(cutoff.cursor)
    && executionBoundaryForCursor(episode.executions, draft.knowledgeCutoff.executionCursor) <= cutoffBoundary;
}

export function freezeRecallManualEvaluations(document: RecallDocument, options: {
  bundleId: string;
  retainedAt: string;
  episode: TradeEpisode;
  sourceRevisionIds?: string[] | null;
  knowledgeCutoff?: RecallManualEvaluationDraft['knowledgeCutoff'];
}): { document: RecallDocument; revisionIds: string[] | undefined } {
  const next = structuredClone(document);
  validateRecallManualEvaluations(next);
  if (options.sourceRevisionIds === null) return { document: next, revisionIds: undefined };
  if (!next.manualEvaluations && (options.sourceRevisionIds === undefined || options.sourceRevisionIds.length === 0)) {
    return { document: next, revisionIds: undefined };
  }
  if (options.sourceRevisionIds === undefined && next.manualEvaluations?.drafts.length === 0) {
    return { document: next, revisionIds: undefined };
  }
  next.manualEvaluations ??= { drafts: [], versions: [], associations: [] };
  if (options.sourceRevisionIds !== undefined) {
    uniqueStrings(options.sourceRevisionIds, 'manualEvaluationRevisionIds');
    for (const id of options.sourceRevisionIds) if (!next.manualEvaluations.versions.some(version => version.id === id)) invalid('manualEvaluationRevisionIds', 'unknown retained revision');
    return { document: next, revisionIds: [...options.sourceRevisionIds] };
  }
  const cutoff = options.knowledgeCutoff;
  const revisionIds: string[] = [];
  for (const draft of next.manualEvaluations.drafts) {
    if (cutoff && !cutoffAllows(draft, cutoff, options.episode)) continue;
    const association = next.manualEvaluations.associations.find(item => item.evaluationId === draft.evaluationId);
    if (association?.status !== 'linked') continue;
    const executionIds = cutoff ? options.episode.executions.filter(execution => Date.parse(execution.executedAt) <= Date.parse(cutoff.cursor)
      && executionBoundaryForCursor(options.episode.executions, execution.id) <= executionBoundaryForCursor(options.episode.executions, cutoff.executionCursor)).map(execution => execution.id) : [];
    const existing = [...next.manualEvaluations.versions].reverse().find(version => canonical({ ...version, id: undefined, retainedAt: undefined, executionIds: undefined }) === canonical({ ...draft, id: undefined }) && canonical([...version.executionIds].sort()) === canonical([...executionIds].sort()));
    if (existing) {
      revisionIds.push(existing.id);
      continue;
    }
    const id = `${options.bundleId}:manual:${draft.id}`;
    if (next.manualEvaluations.versions.some(version => version.id === id)) invalid('manualEvaluationRevisionIds', 'immutable revision ID reused');
    next.manualEvaluations.versions.push({ ...structuredClone(draft), id, retainedAt: options.retainedAt, executionIds });
    revisionIds.push(id);
  }
  validateRecallManualEvaluations(next);
  return { document: next, revisionIds };
}

export function assertRecallManualEvaluationImmutability(previous: RecallDocument | undefined, next: RecallDocument): void {
  for (const old of previous?.manualEvaluations?.versions ?? []) {
    const current = next.manualEvaluations?.versions.find(version => version.id === old.id);
    if (!current || canonical(current) !== canonical(old)) invalid('manualEvaluation.version', 'immutable retained evaluation changed or removed');
  }
}

export function getRecallManualEvaluationRevisions(document: RecallDocument, revisionIds: readonly string[] | undefined): RecallManualEvaluationVersion[] {
  if (!revisionIds) return [];
  return (document.manualEvaluations?.versions ?? []).filter(version => revisionIds.includes(version.id));
}
