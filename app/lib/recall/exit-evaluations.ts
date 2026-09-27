import Decimal from 'decimal.js';
import { executionBoundaryForCursor } from '../replay/recall-replay';
import { cloneRecallDocument } from './document';
import { planError, planRecord, planString, planTimestamp } from './plans';
import type { RecallDocument, RecallPhase, RecallDrawing } from './types';
import type { TradeEpisode } from '../trades/types';
export type RecallEarlyExit = 'yes' | 'no' | 'uncertain' | null;
export type RecallExitAdherence = 'as-planned' | 'deviated' | 'no-plan' | null;
export type RecallExitReason = 'planned-partial' | 'structure-invalid' | 'risk-reduction' | 'emotion' | 'capital-need' | 'other' | null;
export type RecallEvaluationTag = 'position' | 'entry' | 'exit' | 'analysis';
export type RecallEvaluationEvidence = {
    kind: 'text';
    drawingId: string;
    textRevision: number;
    ownerId: string;
} | {
    kind: 'snapshot';
    snapshotId: string;
};
export type RecallExitEvaluationDraft = {
    id: string;
    evaluationId: string;
    decisionId: string;
    earlyExit: RecallEarlyExit;
    adherence: RecallExitAdherence;
    reason: RecallExitReason;
    reasonDetail: string | null;
    comparedPlanVersionId: string | null;
    comparedTargetId: string | null;
    tags: RecallEvaluationTag[];
    tagDictionaryVersion: 'manual-v1';
    evidence: RecallEvaluationEvidence[];
    source: 'manual-retrospective';
    recordedBy: 'user';
    recordedPhase: 'post-review';
    recordedAt: string;
    knowledgeCutoff: {
        cursor: string;
        executionCursor: string;
    };
    hasSeenFuture: boolean;
};
export type RecallExitEvaluationVersion = RecallExitEvaluationDraft & {
    retainedAt: string;
    executionIds: string[];
};
export type RecallExitEvaluationAssociation = {
    executionIds?: string[];
    evaluationId: string;
    decisionId: string | null;
    status: 'linked' | 'needs-confirmation';
};
export type RecallExitEvaluationState = {
    activeEvaluationByDecision?: {
        decisionId: string;
        evaluationId: string;
    }[];
    drafts: RecallExitEvaluationDraft[];
    versions: RecallExitEvaluationVersion[];
    associations: RecallExitEvaluationAssociation[];
};
export type RecallEvaluationDocument = RecallDocument & {
    exitEvaluations?: RecallExitEvaluationState;
};
export const RECALL_EVALUATION_TAGS: Readonly<Record<RecallEvaluationTag, string>> = {
    position: '仓位', entry: '入场', exit: '退出', analysis: '判断'
};
export const RECALL_EXIT_REASONS: Readonly<Record<Exclude<RecallExitReason, null>, string>> = {
    'planned-partial': '计划内分批', 'structure-invalid': '结构失效', 'risk-reduction': '风险收缩', emotion: '情绪影响', 'capital-need': '资金需求', other: '其他'
};
function canonical(value: unknown): string {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}
function enumValue(value: unknown, allowed: readonly unknown[], field: string) {
    if (!allowed.includes(value))
        planError(field, 'unsupported value');
}
function uniqueStrings(value: unknown, field: string): string[] {
    if (!Array.isArray(value))
        planError(field, 'must be an array');
    const values = value.map(v => {
        planString(v, field);
        return v;
    });
    if (new Set(values).size !== values.length)
        planError(field, 'duplicate identity');
    return values;
}
function validateDraft(value: unknown, document: RecallEvaluationDocument): asserts value is RecallExitEvaluationDraft {
    const d = planRecord(value, 'exitEvaluation');
    for (const key of ['id', 'evaluationId', 'decisionId'])
        planString(d[key], `exitEvaluation.${key}`);
    enumValue(d.earlyExit, [null, 'yes', 'no', 'uncertain'], 'exitEvaluation.earlyExit');
    enumValue(d.adherence, [null, 'as-planned', 'deviated', 'no-plan'], 'exitEvaluation.adherence');
    enumValue(d.reason, [null, ...Object.keys(RECALL_EXIT_REASONS)], 'exitEvaluation.reason');
    if (d.reasonDetail !== null && (typeof d.reasonDetail !== 'string' || d.reasonDetail.length > 500))
        planError('exitEvaluation.reasonDetail', 'must be null or at most 500 characters');
    if (d.reason === 'other' && (typeof d.reasonDetail !== 'string' || !d.reasonDetail.trim()))
        planError('exitEvaluation.reasonDetail', 'required for other reason');
    enumValue(d.tagDictionaryVersion, ['manual-v1'], 'exitEvaluation.tagDictionaryVersion');
    for (const tag of uniqueStrings(d.tags, 'exitEvaluation.tags'))
        enumValue(tag, Object.keys(RECALL_EVALUATION_TAGS), 'exitEvaluation.tags');
    enumValue(d.source, ['manual-retrospective'], 'exitEvaluation.source');
    enumValue(d.recordedBy, ['user'], 'exitEvaluation.recordedBy');
    enumValue(d.recordedPhase, ['post-review'], 'exitEvaluation.recordedPhase');
    planTimestamp(d.recordedAt, 'exitEvaluation.recordedAt');
    const cutoff = planRecord(d.knowledgeCutoff, 'exitEvaluation.knowledgeCutoff');
    planTimestamp(cutoff.cursor, 'exitEvaluation.knowledgeCutoff.cursor');
    planString(cutoff.executionCursor, 'exitEvaluation.knowledgeCutoff.executionCursor');
    if (typeof d.hasSeenFuture !== 'boolean')
        planError('exitEvaluation.hasSeenFuture', 'must be boolean');
    if (d.comparedPlanVersionId !== null) {
        planString(d.comparedPlanVersionId, 'exitEvaluation.comparedPlanVersionId');
        if (!document.plans?.versions.some(v => v.id === d.comparedPlanVersionId))
            planError('exitEvaluation.comparedPlanVersionId', 'unknown immutable plan version');
    }
    if (d.comparedTargetId !== null) {
        planString(d.comparedTargetId, 'exitEvaluation.comparedTargetId');
        if (!document.plans?.versions.find(v => v.id === d.comparedPlanVersionId)?.input.targets.some(t => t.id === d.comparedTargetId))
            planError('exitEvaluation.comparedTargetId', 'unknown target in compared plan');
    }
    if (d.adherence === 'no-plan' && (d.comparedPlanVersionId !== null || d.comparedTargetId !== null))
        planError('exitEvaluation.adherence', 'no-plan cannot reference a compared plan');
    if (!Array.isArray(d.evidence))
        planError('exitEvaluation.evidence', 'must be an array');
    const refs = new Set<string>();
    for (const raw of d.evidence) {
        const e = planRecord(raw, 'exitEvaluation.evidence');
        if (e.kind === 'text') {
            planString(e.drawingId, 'evidence.drawingId');
            planString(e.ownerId, 'evidence.ownerId');
            if (!Number.isInteger(e.textRevision) || (e.textRevision as number) < 1)
                planError('evidence.textRevision', 'must be a positive integer');
        }
        else if (e.kind === 'snapshot')
            planString(e.snapshotId, 'evidence.snapshotId');
        else
            planError('evidence.kind', 'unsupported kind');
        const key = canonical(e);
        if (refs.has(key))
            planError('evidence', 'duplicate pointer');
        refs.add(key);
    }
}
export function validateRecallExitEvaluations(document: RecallEvaluationDocument, episode?: TradeEpisode): void {
    const state = document.exitEvaluations;
    if (state === undefined)
        return;
    planRecord(state, 'exitEvaluations');
    for (const key of ['drafts', 'versions', 'associations'] as const)
        if (!Array.isArray(state[key]))
            planError(`exitEvaluations.${key}`, 'must be an array');
    const ids = new Set<string>();
    const lineages = new Set<string>();
    const draftLineages = new Set<string>();
    for (const [kind, items] of [['draft', state.drafts], ['version', state.versions]] as const)
        for (const item of items) {
            validateDraft(item, document);
            if (ids.has(item.id))
                planError('exitEvaluation.id', 'duplicate identity');
            ids.add(item.id);
            lineages.add(item.evaluationId);
            if (kind === 'draft') {
                if (draftLineages.has(item.evaluationId))
                    planError('exitEvaluations.drafts', 'one draft per evaluation');
                draftLineages.add(item.evaluationId);
            }
            else {
                const version = item as RecallExitEvaluationVersion;
                planTimestamp(version.retainedAt, 'exitEvaluation.retainedAt');
                uniqueStrings(version.executionIds, 'exitEvaluation.executionIds');
            }
        }
    const associated = new Set<string>();
    for (const a of state.associations) {
        planRecord(a, 'exitEvaluation.association');
        if (!lineages.has(a.evaluationId) || associated.has(a.evaluationId))
            planError('exitEvaluation.association', 'unknown or duplicate lineage');
        associated.add(a.evaluationId);
        if (a.executionIds !== undefined)
            uniqueStrings(a.executionIds, 'exitEvaluation.association.executionIds');
        if (episode && a.status === 'linked' && !getRecallExitDecisions(document, episode).some(exit => exit.decisionId === a.decisionId))
            planError('exitEvaluation.association', 'evaluation requires a closing decision');
        if (a.status === 'linked') {
            if (!document.decisions.some(d => d.id === a.decisionId))
                planError('exitEvaluation.association', 'unknown current decision');
        }
        else if (a.status !== 'needs-confirmation' || a.decisionId !== null)
            planError('exitEvaluation.association', 'unresolved owner must be null');
    }
    if (state.activeEvaluationByDecision !== undefined) {
        if (!Array.isArray(state.activeEvaluationByDecision))
            planError('exitEvaluation.selection', 'must be an array');
        const selected = new Set<string>();
        for (const selection of state.activeEvaluationByDecision) {
            planRecord(selection, 'exitEvaluation.selection');
            if (selected.has(selection.decisionId) || !state.associations.some(a => a.status === 'linked' && a.decisionId === selection.decisionId && a.evaluationId === selection.evaluationId))
                planError('exitEvaluation.selection', 'unknown or duplicate current selection');
            selected.add(selection.decisionId);
        }
    }
    for (const id of lineages)
        if (!associated.has(id))
            planError('exitEvaluation.association', 'missing current association');
}
/** More than one linked lineage needs an explicit, persisted current selection. */
export function getCurrentRecallExitEvaluation(document: RecallEvaluationDocument, decisionId: string): RecallExitEvaluationDraft | undefined {
    const state = document.exitEvaluations;
    const linked = state?.associations.filter(a => a.status === 'linked' && a.decisionId === decisionId) ?? [];
    const selected = state?.activeEvaluationByDecision?.find(s => s.decisionId === decisionId)?.evaluationId;
    const id = linked.length === 1 ? linked[0].evaluationId : linked.some(a => a.evaluationId === selected) ? selected : undefined;
    return id ? state?.drafts.find(d => d.evaluationId === id) : undefined;
}
export function getRecallExitEvaluationConflicts(document: RecallEvaluationDocument): string[] {
    const ids = new Set(document.exitEvaluations?.associations.filter(a => a.status === 'linked').map(a => a.decisionId!) ?? []);
    return [...ids].filter(id => (document.exitEvaluations?.associations.filter(a => a.status === 'linked' && a.decisionId === id).length ?? 0) > 1 && !getCurrentRecallExitEvaluation(document, id));
}
export function selectRecallExitEvaluation(document: RecallEvaluationDocument, decisionId: string, evaluationId: string): RecallEvaluationDocument {
    const next = cloneRecallDocument(document) as RecallEvaluationDocument;
    const state = next.exitEvaluations;
    if (!state?.associations.some(a => a.status === 'linked' && a.decisionId === decisionId && a.evaluationId === evaluationId))
        planError('exitEvaluation.selection', 'choose a linked current evaluation');
    state.activeEvaluationByDecision = [...state.activeEvaluationByDecision?.filter(s => s.decisionId !== decisionId) ?? [], {
            decisionId, evaluationId
        }];
    validateRecallExitEvaluations(next);
    next.status = getRecallExitEvaluationConflicts(next).length ? 'needs-confirmation' : 'in-progress';
    return next;
}
export function upsertRecallExitEvaluationDraft(document: RecallEvaluationDocument, draft: RecallExitEvaluationDraft): RecallEvaluationDocument {
    const next = cloneRecallDocument(document) as RecallEvaluationDocument;
    if (!next.decisions.some(d => d.id === draft.decisionId))
        planError('exitEvaluation.decisionId', 'unknown decision');
    next.exitEvaluations ??= {
        drafts: [], versions: [], associations: []
    };
    const index = next.exitEvaluations.drafts.findIndex(d => d.evaluationId === draft.evaluationId);
    if (index >= 0 && next.exitEvaluations.drafts[index].id !== draft.id)
        planError('exitEvaluation.id', 'draft identity must remain stable');
    if (index < 0)
        next.exitEvaluations.drafts.push(structuredClone(draft));
    else
        next.exitEvaluations.drafts[index] = structuredClone(draft);
    if (!next.exitEvaluations.associations.some(a => a.evaluationId === draft.evaluationId))
        next.exitEvaluations.associations.push({
            evaluationId: draft.evaluationId, decisionId: draft.decisionId, status: 'linked', executionIds: [...next.decisions.find(d => d.id === draft.decisionId)!.executionIds]
        });
    validateRecallExitEvaluations(next);
    next.status = 'in-progress';
    next.updatedAt = draft.recordedAt;
    return next;
}
export type RecallExitDecision = {
    decisionId: string;
    executionIds: string[];
    quantity: string | null;
    quantityReason: string | null;
    action: 'reduce' | 'close' | 'unknown';
    executedAt: string | null;
    averagePrice: string | null;
    priceReason: string | null;
};
export function getRecallExitDecisions(document: RecallDocument, episode: TradeEpisode): RecallExitDecision[] {
    if (episode.directionKnown === false)
        return [];
    const closingSide = episode.direction === 'long' ? 'sell' : 'buy';
    const openingQuantity = /^\d+(?:\.\d+)?$/.test(episode.openingQuantity) ? new Decimal(episode.openingQuantity) : null;
    const lastClosingDecisionId = [...document.decisions].reverse().find(candidate => episode.executions.some(e => candidate.executionIds.includes(e.id) && e.side === closingSide))?.id;
    let cumulative = new Decimal(0);
    return document.decisions.flatMap(decision => {
        const fills = episode.executions.filter(e => decision.executionIds.includes(e.id) && e.side === closingSide);
        if (!fills.length)
            return [];
        let quantity = new Decimal(0);
        let unknown = false;
        let amount = new Decimal(0);
        let priceUnknown = false;
        for (const fill of fills) {
            if (!/^\d+(?:\.\d+)?$/.test(fill.quantity) || !new Decimal(fill.quantity).gt(0))
                unknown = true;
            else {
                quantity = quantity.plus(fill.quantity);
                if (!/^\d+(?:\.\d+)?$/.test(fill.price) || !new Decimal(fill.price).gt(0)) priceUnknown = true;
                else amount = amount.plus(new Decimal(fill.price).mul(fill.quantity));
            }
        }
        if (!unknown) cumulative = cumulative.plus(quantity);
        const isFinalDecision = decision.id === lastClosingDecisionId;
        const action = unknown ? 'unknown' : openingQuantity && cumulative.gte(openingQuantity) || (episode.status === 'closed' && isFinalDecision) ? 'close' : 'reduce';
        return [{
                decisionId: decision.id, executionIds: fills.map(f => f.id), quantity: unknown ? null : quantity.toFixed(), quantityReason: unknown ? 'missing-exit-quantity' : null,
                action, executedAt: fills[0]?.executedAt ?? null,
                averagePrice: !unknown && !priceUnknown && quantity.gt(0) ? amount.div(quantity).toFixed() : null,
                priceReason: unknown ? 'missing-exit-quantity' : priceUnknown ? 'missing-exit-price' : null,
            }];
    });
}
function revisionContent(value: RecallExitEvaluationDraft | RecallExitEvaluationVersion) {
    const { id, ...rest } = value;
    void id;
    const content = {
        ...rest
    } as Record<string, unknown>;
    delete content.retainedAt;
    delete content.executionIds;
    return canonical(content);
}
export function freezeRecallExitEvaluations(document: RecallEvaluationDocument, options: {
    bundleId: string;
    retainedAt: string;
    decisionId: string;
    episode: TradeEpisode;
    sourceRevisionIds?: string[] | null;
    knowledgeCutoff?: RecallExitEvaluationDraft['knowledgeCutoff'];
}): {
    document: RecallEvaluationDocument;
    revisionIds: string[] | undefined;
} {
    const next = cloneRecallDocument(document) as RecallEvaluationDocument;
    validateRecallExitEvaluations(next);
    if (options.sourceRevisionIds === null)
        return {
            document: next, revisionIds: undefined
        };
    if (options.sourceRevisionIds !== undefined) {
        uniqueStrings(options.sourceRevisionIds, 'evaluationRevisionIds');
        for (const id of options.sourceRevisionIds)
            if (!next.exitEvaluations?.versions.some(v => v.id === id))
                planError('evaluationRevisionIds', 'unknown retained revision');
        return {
            document: next, revisionIds: [...options.sourceRevisionIds]
        };
    }
    if (!next.exitEvaluations)
        return {
            document: next, revisionIds: []
        };
    const exits = getRecallExitDecisions(next, options.episode);
    const isKnown = (draft: RecallExitEvaluationDraft, decisionId: string) => {
        const cutoff = options.knowledgeCutoff;
        if (!cutoff) return true;
        const boundary = executionBoundaryForCursor(options.episode.executions, cutoff.executionCursor);
        const exit = exits.find(e => e.decisionId === decisionId);
        return Date.parse(draft.knowledgeCutoff.cursor) <= Date.parse(cutoff.cursor)
            && executionBoundaryForCursor(options.episode.executions, draft.knowledgeCutoff.executionCursor) <= boundary
            && Boolean(exit?.executionIds.every(id => {
                const execution = options.episode.executions.find(e => e.id === id);
                return execution && Date.parse(execution.executedAt) <= Date.parse(cutoff.cursor)
                    && executionBoundaryForCursor(options.episode.executions, id) <= boundary;
            }));
    };
    if (getRecallExitEvaluationConflicts(next).some(id => (options.decisionId === 'global' || options.decisionId === id)
        && (!options.knowledgeCutoff || next.exitEvaluations!.associations.some(a => a.status === 'linked' && a.decisionId === id
            && next.exitEvaluations!.drafts.some(d => d.evaluationId === a.evaluationId && isKnown(d, id))))))
        planError('exitEvaluation.selection', 'choose the current evaluation before capture');
    const revisionIds: string[] = [];
    for (const association of next.exitEvaluations.associations) {
        if (options.decisionId !== 'global' && association.decisionId !== options.decisionId)
            continue;
        const draft = association.decisionId ? getCurrentRecallExitEvaluation(next, association.decisionId) : undefined;
        if (draft?.evaluationId !== association.evaluationId)
            continue;
        if (!draft)
            continue;
        const exit = exits.find(e => e.decisionId === association.decisionId);
        if (!exit)
            continue;
        if (!isKnown(draft, exit.decisionId))
            continue;
        const existing = [...next.exitEvaluations.versions].reverse().find(v => revisionContent(v) === revisionContent(draft) && canonical([...v.executionIds].sort()) === canonical([...exit.executionIds].sort()));
        if (existing) {
            revisionIds.push(existing.id);
            continue;
        }
        const id = `${options.bundleId}:evaluation:${draft.id}`;
        if (next.exitEvaluations.versions.some(v => v.id === id))
            planError('evaluationRevisionIds', 'immutable revision ID reused');
        next.exitEvaluations.versions.push({
            ...structuredClone(draft), id, retainedAt: options.retainedAt, executionIds: [...exit.executionIds]
        });
        revisionIds.push(id);
    }
    validateRecallExitEvaluations(next);
    return {
        document: next, revisionIds
    };
}
export function assertRecallExitEvaluationImmutability(previous: RecallEvaluationDocument | undefined, next: RecallEvaluationDocument): void {
    for (const old of previous?.exitEvaluations?.versions ?? []) {
        const version = next.exitEvaluations?.versions.find(v => v.id === old.id);
        if (!version || canonical(version) !== canonical(old))
            planError('exitEvaluation.version', 'immutable retained evaluation changed or removed');
    }
}
/** Reconcile captured fill boundaries, never rewrite historical version ownership. */
export function reconcileRecallExitEvaluationAssociations(document: RecallEvaluationDocument): RecallEvaluationDocument {
    const next = cloneRecallDocument(document) as RecallEvaluationDocument;
    for (const association of next.exitEvaluations?.associations ?? []) {
        const version = [...next.exitEvaluations!.versions].reverse().find(v => v.evaluationId === association.evaluationId);
        if (!version && !association.executionIds) {
            if (!next.decisions.some(d => d.id === association.decisionId)) {
                association.decisionId = null;
                association.status = 'needs-confirmation';
            }
            continue;
        }
        const boundary = association.executionIds ?? version!.executionIds;
        const matches = next.decisions.filter(d => boundary.length > 0 && boundary.every(id => d.executionIds.includes(id)));
        association.decisionId = matches.length === 1 ? matches[0].id : null;
        association.status = matches.length === 1 ? 'linked' : 'needs-confirmation';
        const draft = next.exitEvaluations!.drafts.find(d => d.evaluationId === association.evaluationId);
        if (draft && association.decisionId)
            draft.decisionId = association.decisionId;
    }
    if (next.exitEvaluations?.activeEvaluationByDecision)
        next.exitEvaluations.activeEvaluationByDecision = next.exitEvaluations.activeEvaluationByDecision.filter(selection => next.exitEvaluations!.associations.some(a => a.status === 'linked' && a.decisionId === selection.decisionId && a.evaluationId === selection.evaluationId));
    if (getRecallExitEvaluationConflicts(next).length || next.exitEvaluations?.associations.some(a => a.status === 'needs-confirmation'))
        next.status = 'needs-confirmation';
    return next;
}
export function resolveRecallExitEvaluationAssociation(document: RecallEvaluationDocument, evaluationId: string, decisionId: string): RecallEvaluationDocument {
    const next = cloneRecallDocument(document) as RecallEvaluationDocument;
    const a = next.exitEvaluations?.associations.find(a => a.evaluationId === evaluationId);
    if (!a || !next.decisions.some(d => d.id === decisionId))
        planError('exitEvaluation.association', 'unknown evaluation or decision');
    a.executionIds = [...next.decisions.find(d => d.id === decisionId)!.executionIds];
    a.decisionId = decisionId;
    a.status = 'linked';
    const draft = next.exitEvaluations!.drafts.find(d => d.evaluationId === evaluationId);
    if (draft)
        draft.decisionId = decisionId;
    next.status = 'in-progress';
    return next;
}
export function getRecallEvaluationEvidenceStatus(document: RecallEvaluationDocument, evidence: RecallEvaluationEvidence): {
    available: boolean;
    reason: string | null;
} {
    if (evidence.kind === 'snapshot')
        return document.snapshots.some(s => s.id === evidence.snapshotId) ? {
            available: true, reason: null
        } : {
            available: false, reason: 'snapshot-missing'
        };
    const contexts = [document.working, ...Object.values(document.working.phaseContexts ?? {}), document.working.editingContext, ...document.working.decisionDrafts ?? [], ...document.snapshots];
    const drawings = contexts.flatMap(c => c?.drawings ?? []);
    const exact = drawings.some(d => d.tool === 'text' && d.id === evidence.drawingId && d.textRevision === evidence.textRevision && (d.recallOwnerId ?? 'global') === evidence.ownerId);
    return {
        available: exact, reason: exact ? null : 'text-revision-or-owner-missing'
    };
}
export function getRecallEvaluationEvidenceChoices(document: RecallEvaluationDocument): {
    pointer: RecallEvaluationEvidence;
    label: string;
}[] {
    const result: {
        pointer: RecallEvaluationEvidence;
        label: string;
    }[] = document.snapshots.map((s, index) => ({
        pointer: {
            kind: 'snapshot', snapshotId: s.id
        }, label: `快照 ${index + 1} · ${s.createdAt.slice(0, 10)}`
    }));
    const contexts = [document.working, ...Object.values(document.working.phaseContexts ?? {}), document.working.editingContext, ...document.working.decisionDrafts ?? []];
    const seen = new Set<string>();
    for (const drawing of contexts.flatMap(c => c?.drawings ?? []) as RecallDrawing[]) {
        if (drawing.tool !== 'text' || !drawing.textRevision)
            continue;
        const pointer: RecallEvaluationEvidence = {
            kind: 'text', drawingId: drawing.id, textRevision: drawing.textRevision, ownerId: drawing.recallOwnerId ?? 'global'
        };
        const key = canonical(pointer);
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push({
            pointer, label: `Text r${drawing.textRevision} · ${drawing.text?.slice(0, 40) ?? drawing.id}`
        });
    }
    return result;
}
export function calculateRecallExitEvaluationCoverage(document: RecallEvaluationDocument, episode: TradeEpisode) {
    const exits = getRecallExitDecisions(document, episode);
    let yes = 0, no = 0, uncertain = 0, unevaluated = 0, missingQuantityDecisions = 0;
    let yesQuantity = new Decimal(0), noQuantity = new Decimal(0);
    for (const exit of exits) {
        const draft = getCurrentRecallExitEvaluation(document, exit.decisionId);
        const value = draft?.earlyExit ?? null;
        if (value === 'yes')
            yes++;
        else if (value === 'no')
            no++;
        else if (value === 'uncertain')
            uncertain++;
        else
            unevaluated++;
        if (value === 'yes' || value === 'no') {
            if (exit.quantity === null)
                missingQuantityDecisions++;
            else if (value === 'yes')
                yesQuantity = yesQuantity.plus(exit.quantity);
            else
                noQuantity = noQuantity.plus(exit.quantity);
        }
    }
    const knownQuantity = yesQuantity.plus(noQuantity);
    const evaluatedDecisions = yes + no + uncertain;
    return {
        totalExitDecisions: exits.length, evaluatedDecisions, yes, no, uncertain, unevaluated, coverage: exits.length ? new Decimal(evaluatedDecisions).div(exits.length).toFixed() : null, decisionEarlyRate: yes + no ? new Decimal(yes).div(yes + no).toFixed() : null, quantityEarlyRate: knownQuantity.gt(0) ? yesQuantity.div(knownQuantity).toFixed() : null, yesQuantity: yesQuantity.toFixed(), noQuantity: noQuantity.toFixed(), missingQuantityDecisions, quantityRateReason: missingQuantityDecisions ? 'partial-quantity-coverage' : knownQuantity.eq(0) ? 'no-known-yes-no-quantity' : null
    };
}
export function canEditRecallExitEvaluations(phase: RecallPhase): boolean {
    return phase === 'post-review';
}
