import type { TradeEpisode } from "../trades/types";
import {
  type RecallCandle,
  type RecallCompletedVersion,
  type RecallDecision,
  type RecallDocument,
  type RecallDrawing,
  type RecallReconciliation,
  type RecallReconciliationResolution,
  type RecallSnapshot,
  type RecallSplitGroup,
  type RecallSplitInput,
  type RecallWorkingContext,
  type RecallWorkingState,
} from "./types";

export const RECALL_VERSION = 1 as const;
export const RECALL_TIMEFRAMES = ["15m", "1h", "4h", "1D", "1W"] as const;
export const MAX_RECALL_IMAGE_DATA_URL_LENGTH = 16_000_000;

export class RecallValidationError extends Error {
  readonly code = "invalid-recall-document";

  constructor(message: string) {
    super(message);
    this.name = "RecallValidationError";
  }
}

function invalid(message: string): never {
  throw new RecallValidationError(message);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return invalid(`${field} must be a non-empty string`);
  }
  return value;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return invalid(`${field} must be a finite number`);
  }
  return value;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) return invalid(`${field} must be an array`);
  return value;
}

/** Validate JSON without coercing or dropping unknown drawing fields. */
export function assertRecallJsonSafe(
  value: unknown,
  field = "value",
  seen = new Set<object>(),
): void {
  // Optional fields on chart records are occasionally present as undefined
  // before JSON serialization. Object properties are omitted by clone/save;
  // array holes remain invalid rather than becoming surprising nulls.
  if (value === undefined) return;
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    finiteNumber(value, field);
    return;
  }
  if (typeof value !== "object" || value === undefined) {
    invalid(`${field} must contain only JSON values`);
  }
  const object = value as object;
  if (seen.has(object)) invalid(`${field} must not contain cyclic values`);
  seen.add(object);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertRecallJsonSafe(item, `${field}[${index}]`, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      invalid(`${field} must contain plain JSON objects`);
    }
    Object.entries(value).forEach(([key, item]) => {
      if (item !== undefined) assertRecallJsonSafe(item, `${field}.${key}`, seen);
    });
  }
  seen.delete(object);
}

function clone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (child !== undefined) output[key] = clone(child);
  }
  return output as T;
}

export function cloneRecallDocument(document: RecallDocument): RecallDocument {
  return clone(document);
}

function validTimeframe(value: unknown, field: string): void {
  if (!RECALL_TIMEFRAMES.includes(value as (typeof RECALL_TIMEFRAMES)[number])) {
    invalid(`${field} has an unsupported timeframe`);
  }
}

function validateImageDataUrl(value: unknown, field: string): void {
  const image = nonEmptyString(value, field);
  if (image.length > MAX_RECALL_IMAGE_DATA_URL_LENGTH) {
    invalid(`${field} exceeds the maximum allowed size`);
  }
  // This deliberately excludes HTTP URLs and object URLs. PNG is the normal
  // capture format; JPEG/WebP are accepted for adapters that provide them.
  if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    invalid(`${field} must be a base64 image data URL`);
  }
}

function validateCandle(value: unknown, index: number): asserts value is RecallCandle {
  const item = record(value, `snapshot candle ${index}`);
  nonEmptyString(item.time, `snapshot candle ${index}.time`);
  if (item.knowledgeAt !== undefined) nonEmptyString(item.knowledgeAt, `snapshot candle ${index}.knowledgeAt`);
  for (const field of ["open", "high", "low", "close", "volume"] as const) {
    finiteNumber(item[field], `snapshot candle ${index}.${field}`);
  }
  if (item.tradingDates !== undefined) {
    array(item.tradingDates, `snapshot candle ${index}.tradingDates`).forEach((date, dateIndex) => {
      nonEmptyString(date, `snapshot candle ${index}.tradingDates[${dateIndex}]`);
    });
  }
  assertRecallJsonSafe(item, `snapshot candle ${index}`);
}

function validateDrawings(value: unknown, field: string): asserts value is RecallDrawing[] {
  const drawings = array(value, field);
  drawings.forEach((drawing, index) => {
    const item = record(drawing, `${field}[${index}]`);
    // Validate the stable chart identity whenever a chart drawing is supplied,
    // while retaining unknown/raw fields verbatim for forward compatibility.
    nonEmptyString(item.id, `${field}[${index}].id`);
    nonEmptyString(item.tool, `${field}[${index}].tool`);
    const anchors = array(item.anchors, `${field}[${index}].anchors`);
    anchors.forEach((anchor, anchorIndex) => {
      const point = record(anchor, `${field}[${index}].anchors[${anchorIndex}]`);
      nonEmptyString(point.time, `${field}[${index}].anchors[${anchorIndex}].time`);
      finiteNumber(point.price, `${field}[${index}].anchors[${anchorIndex}].price`);
    });
    const style = record(item.style, `${field}[${index}].style`);
    nonEmptyString(style.color, `${field}[${index}].style.color`);
    finiteNumber(style.lineWidth, `${field}[${index}].style.lineWidth`);
    finiteNumber(style.opacity, `${field}[${index}].style.opacity`);
    if (item.version !== undefined && item.version !== 1 && item.version !== 2) {
      invalid(`${field}[${index}].version must be 1 or 2`);
    }
    if (item.hidden !== undefined && typeof item.hidden !== "boolean") invalid(`${field}[${index}].hidden must be boolean`);
    if (item.locked !== undefined && typeof item.locked !== "boolean") invalid(`${field}[${index}].locked must be boolean`);
    if (item.visibleOn !== undefined && item.visibleOn !== "all" && (!Array.isArray(item.visibleOn) || item.visibleOn.some((timeframe) => !RECALL_TIMEFRAMES.includes(timeframe as (typeof RECALL_TIMEFRAMES)[number])))) {
      invalid(`${field}[${index}].visibleOn is invalid`);
    }
    if (item.stage !== undefined && !["pre-trade", "during-replay", "post-review"].includes(String(item.stage))) {
      invalid(`${field}[${index}].stage is invalid`);
    }
    assertRecallJsonSafe(drawing, `${field}[${index}]`);
  });
}

function validateViewport(value: unknown): void {
  const viewport = record(value, "snapshot.viewport");
  if (viewport.version !== 1) invalid("snapshot.viewport.version must be 1");
  for (const field of ["barSpacing", "rightOffset", "width", "height"] as const) {
    finiteNumber(viewport[field], `snapshot.viewport.${field}`);
  }
  if (viewport.logicalRange !== null) {
    const range = record(viewport.logicalRange, "snapshot.viewport.logicalRange");
    finiteNumber(range.from, "snapshot.viewport.logicalRange.from");
    finiteNumber(range.to, "snapshot.viewport.logicalRange.to");
  }
  assertRecallJsonSafe(viewport, "snapshot.viewport");
}

function validateDecision(value: unknown, index: number): asserts value is RecallDecision {
  const decision = record(value, `decision ${index}`);
  nonEmptyString(decision.id, `decision ${index}.id`);
  const executionIds = array(decision.executionIds, `decision ${index}.executionIds`);
  const seen = new Set<string>();
  executionIds.forEach((executionId, executionIndex) => {
    const id = nonEmptyString(executionId, `decision ${index}.executionIds[${executionIndex}]`);
    if (seen.has(id)) invalid(`decision ${index} contains duplicate execution ${id}`);
    seen.add(id);
  });
}

function validateSnapshot(value: unknown, index: number): asserts value is RecallSnapshot {
  const snapshot = record(value, `snapshot ${index}`);
  nonEmptyString(snapshot.id, `snapshot ${index}.id`);
  const decisionId = nonEmptyString(snapshot.decisionId, `snapshot ${index}.decisionId`);
  if (decisionId !== "global" && decisionId !== "unassigned") {
    // The decision reference is checked after all decision ids are collected.
    nonEmptyString(decisionId, `snapshot ${index}.decisionId`);
  }
  validTimeframe(snapshot.timeframe, `snapshot ${index}`);
  nonEmptyString(snapshot.cursor, `snapshot ${index}.cursor`);
  nonEmptyString(snapshot.executionCursor, `snapshot ${index}.executionCursor`);
  const candles = array(snapshot.candles, `snapshot ${index}.candles`);
  candles.forEach((candle, candleIndex) => validateCandle(candle, candleIndex));
  validateDrawings(snapshot.drawings, `snapshot ${index}.drawings`);
  if (snapshot.viewport !== undefined) validateViewport(snapshot.viewport);
  validateImageDataUrl(snapshot.imageDataUrl, `snapshot ${index}.imageDataUrl`);
  nonEmptyString(snapshot.createdAt, `snapshot ${index}.createdAt`);
  nonEmptyString(snapshot.updatedAt, `snapshot ${index}.updatedAt`);
  assertRecallJsonSafe(snapshot, `snapshot ${index}`);
}

function validateWorking(value: unknown): asserts value is RecallWorkingState {
  const working = record(value, "working");
  validateDrawings(working.drawings, "working.drawings");
  validTimeframe(working.timeframe, "working");
  nonEmptyString(working.cursor, "working.cursor");
  nonEmptyString(working.executionCursor, "working.executionCursor");
  if (
    working.selectedDecisionId !== null &&
    typeof working.selectedDecisionId !== "string"
  ) {
    invalid("working.selectedDecisionId must be a string or null");
  }
  if (working.editingContext !== undefined) validateWorkingContext(working.editingContext);
  if (working.decisionDrafts !== undefined) {
    const drafts = array(working.decisionDrafts, "working.decisionDrafts");
    const decisionIds = new Set<string>();
    drafts.forEach((draft, index) => {
      validateWorkingContext(draft, `working.decisionDrafts[${index}]`);
      const context = draft as RecallWorkingContext;
      if (context.mode !== "decision" || context.decisionId === "global") {
        invalid(`working.decisionDrafts[${index}] must be a decision context`);
      }
      if (decisionIds.has(context.decisionId)) {
        invalid(`working.decisionDrafts contains duplicate decision ${context.decisionId}`);
      }
      decisionIds.add(context.decisionId);
    });
  }
  assertRecallJsonSafe(working, "working");
}

function validateWorkingContext(value: unknown, field = "working.editingContext"): asserts value is RecallWorkingContext {
  const context = record(value, field);
  if (context.mode !== "global" && context.mode !== "decision") {
    invalid(`${field}.mode must be global or decision`);
  }
  if (typeof context.decisionId !== "string" || context.decisionId.trim().length === 0) {
    invalid(`${field}.decisionId must be a non-empty string`);
  }
  if (context.mode === "global" && context.decisionId !== "global") {
    invalid(`global editing context must use decisionId global`);
  }
  validateDrawings(context.drawings, `${field}.drawings`);
  validTimeframe(context.timeframe, field);
  nonEmptyString(context.cursor, `${field}.cursor`);
  nonEmptyString(context.executionCursor, `${field}.executionCursor`);
}

function validateBaseDocument(
  value: unknown,
  field: string,
  allowLastCompleted: boolean,
): asserts value is RecallDocument {
  const document = record(value, field);
  if (document.version !== RECALL_VERSION) invalid(`${field}.version must be 1`);
  nonEmptyString(document.episodeId, `${field}.episodeId`);
  if (typeof document.revision !== "number" || !Number.isInteger(document.revision) || document.revision < 0) {
    invalid(`${field}.revision must be a non-negative integer`);
  }
  const decisions = array(document.decisions, `${field}.decisions`);
  const decisionIds = new Set<string>();
  const executionIds = new Set<string>();
  decisions.forEach((decision, index) => {
    validateDecision(decision, index);
    if (decisionIds.has(decision.id)) invalid(`duplicate decision id ${decision.id}`);
    decisionIds.add(decision.id);
    decision.executionIds.forEach((executionId) => {
      if (executionIds.has(executionId)) invalid(`execution ${executionId} belongs to multiple decisions`);
      executionIds.add(executionId);
    });
  });

  const snapshots = array(document.snapshots, `${field}.snapshots`);
  const snapshotIds = new Set<string>();
  let globalCount = 0;
  snapshots.forEach((snapshot, index) => {
    validateSnapshot(snapshot, index);
    if (snapshotIds.has(snapshot.id)) invalid(`duplicate snapshot id ${snapshot.id}`);
    snapshotIds.add(snapshot.id);
    if (snapshot.decisionId === "global") {
      globalCount += 1;
      if (globalCount > 1) invalid("a recall document may contain only one global snapshot");
    } else if (snapshot.decisionId !== "unassigned" && !decisionIds.has(snapshot.decisionId)) {
      invalid(`snapshot ${snapshot.id} references unknown decision ${snapshot.decisionId}`);
    }
  });

  validateWorking(document.working);
  if (
    document.working.selectedDecisionId !== null &&
    document.working.selectedDecisionId !== "global" &&
    document.working.selectedDecisionId !== "unassigned" &&
    !decisionIds.has(document.working.selectedDecisionId)
  ) {
    invalid(`working.selectedDecisionId references unknown decision ${document.working.selectedDecisionId}`);
  }
  const editingContext = document.working.editingContext;
  if (editingContext?.mode === "decision" && !decisionIds.has(editingContext.decisionId)) {
    invalid(`working.editingContext references unknown decision ${editingContext.decisionId}`);
  }
  for (const draft of document.working.decisionDrafts ?? []) {
    if (!decisionIds.has(draft.decisionId)) {
      invalid(`working.decisionDrafts references unknown decision ${draft.decisionId}`);
    }
  }
  if (!["in-progress", "completed", "needs-confirmation"].includes(String(document.status))) {
    invalid(`${field}.status is invalid`);
  }
  nonEmptyString(document.updatedAt, `${field}.updatedAt`);
  if (document.completedAt !== undefined) nonEmptyString(document.completedAt, `${field}.completedAt`);
  if (document.status === "completed" && document.completedAt === undefined) {
    invalid(`${field}.completedAt is required for a completed document`);
  }
  if (document.reconciliation !== undefined) {
    const reconciliation = record(document.reconciliation, `${field}.reconciliation`);
    for (const key of ["addedExecutionIds", "removedExecutionIds"] as const) {
      array(reconciliation[key], `${field}.reconciliation.${key}`).forEach((id, index) => {
        nonEmptyString(id, `${field}.reconciliation.${key}[${index}]`);
      });
    }
    if (typeof reconciliation.stale !== "boolean") invalid(`${field}.reconciliation.stale must be boolean`);
  }
  if (document.lastCompleted !== undefined) {
    if (!allowLastCompleted) invalid(`${field}.lastCompleted cannot be nested`);
    const formal = record(document.lastCompleted, `${field}.lastCompleted`);
    if (formal.status !== "completed") invalid(`${field}.lastCompleted must be completed`);
    validateBaseDocument(formal, `${field}.lastCompleted`, false);
  }
  assertRecallJsonSafe(document, field);
}

export function validateRecallDocument(value: unknown): asserts value is RecallDocument {
  validateBaseDocument(value, "recall document", true);
}

export function assertRecallDocument(value: unknown): asserts value is RecallDocument {
  validateRecallDocument(value);
}

function validateEpisode(episode: TradeEpisode): void {
  record(episode, "episode");
  nonEmptyString(episode.id, "episode.id");
  if (!Array.isArray(episode.executions) || episode.executions.length === 0) {
    invalid("episode must contain at least one execution");
  }
  const ids = new Set<string>();
  for (const [index, execution] of episode.executions.entries()) {
    const id = nonEmptyString(execution.id, `episode.executions[${index}].id`);
    if (ids.has(id)) invalid(`episode contains duplicate execution ${id}`);
    ids.add(id);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function touch(document: RecallDocument, status = document.status): RecallDocument {
  const next = cloneRecallDocument(document);
  next.status = status;
  next.updatedAt = nowIso();
  return next;
}

function markNeedsConfirmation(document: RecallDocument): RecallDocument {
  const next = touch(document, "needs-confirmation");
  delete next.completedAt;
  return next;
}

function decisionIds(document: RecallDocument): Set<string> {
  return new Set(document.decisions.map((decision) => decision.id));
}

function snapshotIds(document: RecallDocument): Set<string> {
  return new Set(document.snapshots.map((snapshot) => snapshot.id));
}

function validateSnapshotDecisionReference(document: RecallDocument, snapshot: RecallSnapshot): void {
  if (
    snapshot.decisionId !== "global" &&
    snapshot.decisionId !== "unassigned" &&
    !decisionIds(document).has(snapshot.decisionId)
  ) {
    invalid(`snapshot ${snapshot.id} references unknown decision ${snapshot.decisionId}`);
  }
}

export function createRecallDocument(
  episode: TradeEpisode,
  now = nowIso(),
): RecallDocument {
  validateEpisode(episode);
  const decisions = episode.executions.map<RecallDecision>((execution) => ({
    id: execution.id,
    executionIds: [execution.id],
  }));
  const firstExecution = episode.executions[0];
  const document: RecallDocument = {
    version: RECALL_VERSION,
    episodeId: episode.id,
    revision: 0,
    decisions,
    snapshots: [],
    working: {
      drawings: [],
      timeframe: "1D",
      cursor: firstExecution.executedAt,
      // Execution cursors use the stable fill id so same-time date-only rows
      // resume at the exact source-order boundary instead of revealing every
      // fill sharing the first timestamp.
      executionCursor: firstExecution.id,
      selectedDecisionId: decisions[0]?.id ?? null,
    },
    status: "in-progress",
    updatedAt: now,
  };
  validateRecallDocument(document);
  return cloneRecallDocument(document);
}

export function reconcileRecallDocument(
  document: RecallDocument,
  episode: TradeEpisode,
): RecallReconciliation {
  validateRecallDocument(document);
  validateEpisode(episode);
  if (document.episodeId !== episode.id) invalid("document and episode ids do not match");

  const next = cloneRecallDocument(document);
  const incomingIds = episode.executions.map((execution) => execution.id);
  const incoming = new Set(incomingIds);
  const assigned = new Set(next.decisions.flatMap((decision) => decision.executionIds));
  const newlyAddedExecutionIds = incomingIds.filter((id) => !assigned.has(id));
  const newlyRemovedExecutionIds = [...assigned].filter((id) => !incoming.has(id));
  const previousReconciliation = next.reconciliation;
  const addedExecutionIds = [...new Set([
    ...(previousReconciliation?.stale ? previousReconciliation.addedExecutionIds : []),
    ...newlyAddedExecutionIds,
  ])];
  const removedExecutionIds = [...new Set([
    ...(previousReconciliation?.stale ? previousReconciliation.removedExecutionIds : []),
    ...newlyRemovedExecutionIds,
  ])];

  next.decisions = next.decisions.map((decision) => ({
    ...decision,
    executionIds: decision.executionIds.filter((id) => incoming.has(id)),
  }));
  const ids = decisionIds(next);
  for (const executionId of newlyAddedExecutionIds) {
    const id = ids.has(executionId) ? `decision:${executionId}` : executionId;
    next.decisions.push({ id, executionIds: [executionId] });
    ids.add(id);
  }

  const changed = newlyAddedExecutionIds.length > 0 || newlyRemovedExecutionIds.length > 0;
  const remainsStale = Boolean(previousReconciliation?.stale) || addedExecutionIds.length > 0 || removedExecutionIds.length > 0;
  if (changed || remainsStale) {
    const changedDocument = markNeedsConfirmation(next);
    changedDocument.reconciliation = {
      addedExecutionIds: [...addedExecutionIds],
      removedExecutionIds: [...removedExecutionIds],
      stale: true,
    };
    return {
      document: changedDocument,
      addedExecutionIds: [...addedExecutionIds],
      removedExecutionIds: [...removedExecutionIds],
      staleExecutionIds: [...removedExecutionIds],
      missingDecisionIds: missingDecisionIds(changedDocument),
    };
  }

  next.reconciliation = {
    addedExecutionIds: [],
    removedExecutionIds: [],
    stale: false,
  };
  next.updatedAt = nowIso();
  return {
    document: next,
    addedExecutionIds: [],
    removedExecutionIds: [],
    staleExecutionIds: [],
    missingDecisionIds: missingDecisionIds(next),
  };
}

/**
 * Clear a refreshed execution-set blocker only after the caller has handled
 * every orphaned decision explicitly. Re-running reconciliation never calls
 * this implicitly, which keeps removed execution evidence visible to the UI.
 */
export function resolveRecallReconciliation(
  document: RecallDocument,
  resolution: RecallReconciliationResolution,
): RecallDocument {
  validateRecallDocument(document);
  if (!resolution || typeof resolution !== "object") invalid("reconciliation resolution is required");
  const pending = document.reconciliation;
  if (!pending?.stale && !pending?.addedExecutionIds.length && !pending?.removedExecutionIds.length) {
    invalid("recall document has no pending reconciliation");
  }
  const expectedAdded = pending?.addedExecutionIds ?? [];
  const expectedRemoved = pending?.removedExecutionIds ?? [];
  const requestedAdded = [...(resolution.addedExecutionIds ?? [])];
  const requestedRemoved = [...(resolution.removedExecutionIds ?? [])];
  const sameIds = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length && new Set(left).size === left.length && left.every((id) => right.includes(id));
  if (!sameIds(requestedAdded, expectedAdded) || !sameIds(requestedRemoved, expectedRemoved)) {
    invalid("reconciliation resolution must explicitly acknowledge every pending execution change");
  }

  const decisionIdsToRemove = [...(resolution.decisionIdsToRemove ?? [])];
  const removalSet = new Set(decisionIdsToRemove);
  if (removalSet.size !== decisionIdsToRemove.length) invalid("decisionIdsToRemove must be unique");
  const emptyDecisionIds = document.decisions
    .filter((decision) => decision.executionIds.length === 0)
    .map((decision) => decision.id);
  if (emptyDecisionIds.some((id) => !removalSet.has(id))) {
    invalid("removed execution decisions require explicit removal after snapshots are handled");
  }
  for (const decisionId of decisionIdsToRemove) {
    const decision = requireDecision(document, decisionId);
    if (decision.executionIds.length > 0) invalid(`decision ${decisionId} still contains executions`);
    if (document.snapshots.some((snapshot) => snapshot.decisionId === decisionId)) {
      invalid(`decision ${decisionId} still owns snapshots; reassign or delete them first`);
    }
  }

  const next = cloneRecallDocument(document);
  next.decisions = next.decisions.filter((decision) => !removalSet.has(decision.id));
  if (next.working.selectedDecisionId && removalSet.has(next.working.selectedDecisionId)) {
    next.working.selectedDecisionId = next.decisions[0]?.id ?? null;
  }
  if (next.working.editingContext && removalSet.has(next.working.editingContext.decisionId)) {
    delete next.working.editingContext;
  }
  if (next.working.decisionDrafts) {
    next.working.decisionDrafts = next.working.decisionDrafts.filter(
      (draft) => !removalSet.has(draft.decisionId),
    );
  }
  next.reconciliation = {
    addedExecutionIds: [],
    removedExecutionIds: [],
    stale: false,
  };
  next.updatedAt = nowIso();
  return next;
}

export function missingDecisionIds(document: RecallDocument): string[] {
  validateRecallDocument(document);
  const retained = new Set(
    document.snapshots
      .filter((snapshot) => snapshot.decisionId !== "global" && snapshot.decisionId !== "unassigned")
      .map((snapshot) => snapshot.decisionId),
  );
  return document.decisions
    .filter((decision) => !retained.has(decision.id))
    .map((decision) => decision.id);
}

function requireDecision(document: RecallDocument, id: string): RecallDecision {
  const decision = document.decisions.find((candidate) => candidate.id === id);
  if (!decision) invalid(`unknown decision ${id}`);
  return decision;
}

function mergeWorkingDrawings(
  existing: RecallDrawing[],
  incoming: RecallDrawing[],
): RecallDrawing[] {
  const byId = new Map(existing.map((drawing) => [drawing.id, drawing]));
  for (const drawing of incoming) byId.set(drawing.id, drawing);
  return [...byId.values()];
}

function remapWorkingContext(
  context: RecallWorkingContext,
  sourceSet: ReadonlySet<string>,
  mergedId: string,
  remapDrawingOwner: (drawing: RecallDrawing) => RecallDrawing,
): RecallWorkingContext {
  return {
    ...context,
    decisionId: sourceSet.has(context.decisionId) ? mergedId : context.decisionId,
    drawings: context.drawings.map(remapDrawingOwner),
  };
}

function mergeDecisionDrafts(
  drafts: readonly RecallWorkingContext[] | undefined,
  sourceSet: ReadonlySet<string>,
  mergedId: string,
  remapDrawingOwner: (drawing: RecallDrawing) => RecallDrawing,
): RecallWorkingContext[] | undefined {
  if (!drafts) return undefined;
  const byDecision = new Map<string, RecallWorkingContext>();
  for (const draft of drafts) {
    const remapped = remapWorkingContext(draft, sourceSet, mergedId, remapDrawingOwner);
    const previous = byDecision.get(remapped.decisionId);
    byDecision.set(
      remapped.decisionId,
      previous
        ? { ...remapped, drawings: mergeWorkingDrawings(previous.drawings, remapped.drawings) }
        : remapped,
    );
  }
  return [...byDecision.values()];
}

export function mergeRecallDecisions(
  document: RecallDocument,
  sourceIds: readonly string[],
  mergedId = sourceIds[0],
): RecallDocument {
  validateRecallDocument(document);
  if (!Array.isArray(sourceIds) || sourceIds.length < 2) invalid("merge requires at least two decisions");
  const uniqueIds = [...new Set(sourceIds)];
  if (uniqueIds.length !== sourceIds.length) invalid("merge decision ids must be unique");
  uniqueIds.forEach((id) => requireDecision(document, id));
  if (!mergedId || !uniqueIds.includes(mergedId)) invalid("merged id must be one of the source decisions");

  const sourceSet = new Set(uniqueIds);
  const merged: RecallDecision = {
    id: mergedId,
    executionIds: document.decisions
      .filter((decision) => sourceSet.has(decision.id))
      .flatMap((decision) => decision.executionIds),
  };
  const firstIndex = document.decisions.findIndex((decision) => sourceSet.has(decision.id));
  const next = cloneRecallDocument(document);
  const remapDrawingOwner = (drawing: RecallDrawing): RecallDrawing =>
    drawing.recallOwnerId && sourceSet.has(drawing.recallOwnerId)
      ? { ...drawing, recallOwnerId: mergedId }
      : drawing;
  next.decisions = document.decisions.filter((decision) => !sourceSet.has(decision.id));
  next.decisions.splice(firstIndex, 0, merged);
  next.snapshots = next.snapshots.map((snapshot) =>
    sourceSet.has(snapshot.decisionId)
      ? { ...snapshot, decisionId: mergedId, drawings: snapshot.drawings.map(remapDrawingOwner) }
      : snapshot,
  );
  next.working.drawings = next.working.drawings.map(remapDrawingOwner);
  if (next.working.editingContext) {
    next.working.editingContext = remapWorkingContext(next.working.editingContext, sourceSet, mergedId, remapDrawingOwner);
  }
  next.working.decisionDrafts = mergeDecisionDrafts(next.working.decisionDrafts, sourceSet, mergedId, remapDrawingOwner);
  if (sourceSet.has(next.working.selectedDecisionId ?? "")) next.working.selectedDecisionId = mergedId;
  return document.status === "completed" ? markNeedsConfirmation(next) : touch(next);
}

function normalizeSplitGroups(groups: RecallSplitInput): RecallSplitGroup[] {
  if (!Array.isArray(groups) || groups.length < 2) invalid("split requires at least two groups");
  return groups.map((group, index) => {
    if (Array.isArray(group)) {
      return { executionIds: [...group] };
    }
    const value = record(group, `split group ${index}`);
    const executionIds = array(value.executionIds, `split group ${index}.executionIds`).map((id, idIndex) =>
      nonEmptyString(id, `split group ${index}.executionIds[${idIndex}]`),
    );
    const snapshotIdsValue = value.snapshotIds;
    return {
      ...(value.id === undefined ? {} : { id: nonEmptyString(value.id, `split group ${index}.id`) }),
      executionIds,
      ...(snapshotIdsValue === undefined
        ? {}
        : {
            snapshotIds: array(snapshotIdsValue, `split group ${index}.snapshotIds`).map((id, idIndex) =>
              nonEmptyString(id, `split group ${index}.snapshotIds[${idIndex}]`),
            ),
          }),
    };
  });
}

export function splitRecallDecision(
  document: RecallDocument,
  decisionId: string,
  rawGroups: RecallSplitInput,
): RecallDocument {
  validateRecallDocument(document);
  const source = requireDecision(document, decisionId);
  const groups = normalizeSplitGroups(rawGroups);
  const sourceExecutions = new Set(source.executionIds);
  const allocatedExecutions = new Set<string>();
  groups.forEach((group, index) => {
    if (group.executionIds.length === 0) invalid(`split group ${index} cannot be empty`);
    for (const executionId of group.executionIds) {
      if (!sourceExecutions.has(executionId)) invalid(`execution ${executionId} does not belong to ${decisionId}`);
      if (allocatedExecutions.has(executionId)) invalid(`execution ${executionId} appears in multiple split groups`);
      allocatedExecutions.add(executionId);
    }
  });
  if (allocatedExecutions.size !== sourceExecutions.size) invalid("split groups must cover every source execution");

  const ids = new Set(document.decisions.map((decision) => decision.id));
  const normalizedGroups = groups.map((group, index) => {
    const id = index === 0 ? decisionId : group.id;
    if (!id) invalid(`split group ${index} requires an explicit id`);
    if (index > 0 && ids.has(id)) invalid(`split group id ${id} already exists`);
    ids.add(id);
    return { ...group, id };
  });
  const allSnapshotIds = snapshotIds(document);
  const allocatedSnapshots = new Set<string>();
  normalizedGroups.forEach((group, index) => {
    for (const snapshotId of group.snapshotIds ?? []) {
      if (!allSnapshotIds.has(snapshotId)) invalid(`split group ${index} references unknown snapshot ${snapshotId}`);
      if (allocatedSnapshots.has(snapshotId)) invalid(`snapshot ${snapshotId} appears in multiple split groups`);
      allocatedSnapshots.add(snapshotId);
    }
  });
  const sourceSnapshotIds = document.snapshots
    .filter((snapshot) => snapshot.decisionId === decisionId)
    .map((snapshot) => snapshot.id);
  const sourceSnapshotSet = new Set(sourceSnapshotIds);
  for (const snapshotId of allocatedSnapshots) {
    if (!sourceSnapshotSet.has(snapshotId)) invalid(`snapshot ${snapshotId} does not belong to ${decisionId}`);
  }

  const next = cloneRecallDocument(document);
  const index = next.decisions.findIndex((candidate) => candidate.id === decisionId);
  next.decisions.splice(
    index,
    1,
    ...normalizedGroups.map((group) => ({ id: group.id!, executionIds: [...group.executionIds] })),
  );
  const targetBySnapshot = new Map<string, string>();
  normalizedGroups.forEach((group) => {
    for (const snapshotId of group.snapshotIds ?? []) targetBySnapshot.set(snapshotId, group.id!);
  });
  next.snapshots = next.snapshots.map((snapshot) => {
    if (!sourceSnapshotSet.has(snapshot.id)) return snapshot;
    return { ...snapshot, decisionId: targetBySnapshot.get(snapshot.id) ?? "unassigned" };
  });
  if (next.working.selectedDecisionId === decisionId) next.working.selectedDecisionId = decisionId;
  return document.status === "completed" ? markNeedsConfirmation(next) : touch(next);
}

export function retainRecallSnapshot(
  document: RecallDocument,
  snapshot: RecallSnapshot,
): RecallDocument {
  validateRecallDocument(document);
  validateSnapshot(snapshot, 0);
  if (snapshot.decisionId === "unassigned") invalid("a retained snapshot cannot remain unassigned");
  if (snapshotIds(document).has(snapshot.id)) invalid(`snapshot ${snapshot.id} already exists`);
  validateSnapshotDecisionReference(document, snapshot);
  const next = cloneRecallDocument(document);
  if (snapshot.decisionId === "global") {
    next.snapshots = next.snapshots.filter((candidate) => candidate.decisionId !== "global");
  }
  next.snapshots.push(clone(snapshot));
  return touch(next);
}

export function updateRecallSnapshot(
  document: RecallDocument,
  snapshot: RecallSnapshot,
): RecallDocument {
  validateRecallDocument(document);
  validateSnapshot(snapshot, 0);
  if (snapshot.decisionId === "unassigned") invalid("updated snapshot must be assigned");
  validateSnapshotDecisionReference(document, snapshot);
  const index = document.snapshots.findIndex((candidate) => candidate.id === snapshot.id);
  if (index < 0) invalid(`unknown snapshot ${snapshot.id}`);
  const next = cloneRecallDocument(document);
  if (snapshot.decisionId === "global") {
    next.snapshots = next.snapshots.filter((candidate) => candidate.decisionId !== "global" || candidate.id === snapshot.id);
  }
  const replacementIndex = next.snapshots.findIndex((candidate) => candidate.id === snapshot.id);
  if (replacementIndex < 0) invalid(`unknown snapshot ${snapshot.id}`);
  next.snapshots[replacementIndex] = clone(snapshot);
  return touch(next);
}

export function deleteRecallSnapshot(document: RecallDocument, snapshotId: string): RecallDocument {
  validateRecallDocument(document);
  nonEmptyString(snapshotId, "snapshotId");
  if (!snapshotIds(document).has(snapshotId)) invalid(`unknown snapshot ${snapshotId}`);
  const next = cloneRecallDocument(document);
  next.snapshots = next.snapshots.filter((snapshot) => snapshot.id !== snapshotId);
  return touch(next);
}

export function reorderRecallSnapshots(
  document: RecallDocument,
  orderedIds: readonly string[],
): RecallDocument {
  validateRecallDocument(document);
  const currentIds = document.snapshots.map((snapshot) => snapshot.id);
  if (orderedIds.length !== currentIds.length) invalid("snapshot order must include every snapshot exactly once");
  const currentSet = new Set(currentIds);
  const orderedSet = new Set(orderedIds);
  if (orderedSet.size !== orderedIds.length || orderedIds.some((id) => !currentSet.has(id))) {
    invalid("snapshot order must include every snapshot exactly once");
  }
  const byId = new Map(document.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const next = cloneRecallDocument(document);
  next.snapshots = orderedIds.map((id) => clone(byId.get(id)!));
  return touch(next);
}

function withoutLastCompleted(document: RecallDocument): RecallCompletedVersion {
  const formal = clone(document) as RecallDocument;
  delete formal.lastCompleted;
  delete formal.reconciliation;
  return formal as RecallCompletedVersion;
}

export function completeRecallDocument(
  document: RecallDocument,
  episode: TradeEpisode,
  completedAt = nowIso(),
): RecallDocument {
  validateRecallDocument(document);
  validateEpisode(episode);
  if (document.episodeId !== episode.id) invalid("document and episode ids do not match");
  if (episode.status !== "closed") invalid("a recall document can only be completed for a closed episode");
  if (document.reconciliation?.stale || (document.reconciliation?.removedExecutionIds.length ?? 0) > 0) {
    invalid("execution reconciliation with removed content must be explicitly resolved before completion");
  }
  const emptyDecisionIds = document.decisions
    .filter((decision) => decision.executionIds.length === 0)
    .map((decision) => decision.id);
  if (emptyDecisionIds.length > 0) {
    invalid(`orphaned decisions require explicit reconciliation: ${emptyDecisionIds.join(", ")}`);
  }
  const missing = missingDecisionIds(document);
  if (missing.length > 0) invalid(`missing retained snapshot for decisions: ${missing.join(", ")}`);
  if (!document.snapshots.some((snapshot) => snapshot.decisionId === "global")) {
    invalid("a global snapshot is required before completion");
  }
  if (document.snapshots.some((snapshot) => snapshot.decisionId === "unassigned")) {
    invalid("all split snapshots must be assigned before completion");
  }
  const currentIds = new Set(episode.executions.map((execution) => execution.id));
  const documentIds = new Set(document.decisions.flatMap((decision) => decision.executionIds));
  if (documentIds.size !== currentIds.size || [...currentIds].some((id) => !documentIds.has(id))) {
    invalid("decision grouping is stale for this episode");
  }
  nonEmptyString(completedAt, "completedAt");
  const completed = cloneRecallDocument(document);
  completed.status = "completed";
  completed.completedAt = completedAt;
  completed.updatedAt = completedAt;
  completed.reconciliation = {
    addedExecutionIds: [],
    removedExecutionIds: [],
    stale: false,
  };
  completed.lastCompleted = withoutLastCompleted(completed);
  validateRecallDocument(completed);
  return completed;
}

// Short aliases keep the command vocabulary convenient for controller code;
// the Recall-prefixed names remain the canonical public contract.
export const mergeDecisions = mergeRecallDecisions;
export const splitDecision = splitRecallDecision;
export const retainSnapshot = retainRecallSnapshot;
export const updateSnapshot = updateRecallSnapshot;
export const deleteSnapshot = deleteRecallSnapshot;
export const reorderSnapshots = reorderRecallSnapshots;
