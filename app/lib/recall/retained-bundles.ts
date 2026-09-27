import { freezeRecallExitEvaluations, assertRecallExitEvaluationImmutability } from './exit-evaluations';
import { assertRecallManualEvaluationImmutability, freezeRecallManualEvaluations } from './manual-evaluations';
import { executionBoundaryForCursor } from '../replay/recall-replay';
import type { TradeEpisode } from '../trades/types';
import { cloneRecallDocument } from './document';
import { freezeRecallPlanDraft, recallPlanRiskBaseline, planError, planRecord, planString, planTimestamp } from './plans';
import { sha256 } from './retained-digest';
import type { RecallDocument, RecallExecutionEvidence, RecallSnapshot } from './types';
/** Preserve ordered evidence arrays; only object-key order is irrelevant. */
export function canonicalRecallJson(value: unknown): string {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonicalRecallJson).join(',')}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter(k => record[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonicalRecallJson(record[k])}`).join(',')}}`;
}
function captureContext(snapshot: RecallSnapshot) {
    return {
        phase: snapshot.phase, cursor: snapshot.cursor, executionCursor: snapshot.executionCursor, timeframe: snapshot.timeframe, viewport: snapshot.viewport, hasSeenFuture: snapshot.hasSeenFuture, priceBasis: snapshot.priceBasis
    };
}
/** Decision ownership may change during regrouping, but the actual financial picture cannot. */
function snapshotContentDigest(snapshot: RecallSnapshot): string {
    return sha256(canonicalRecallJson({
        context: captureContext(snapshot), candles: snapshot.candles, imageDataUrl: snapshot.imageDataUrl,
        drawings: snapshot.drawings.map(({ recallOwnerId, ...drawing }) => {
            void recallOwnerId;
            return drawing;
        }),
    }));
}
function assertBoundSnapshot(snapshot: RecallSnapshot, bundle: NonNullable<RecallDocument['retainedBundles']>[number]): void {
    if (canonicalRecallJson(captureContext(snapshot)) !== canonicalRecallJson(bundle.captureContext))
        planError('retainedBundle.captureContext', 'capture context mismatch; retain a new bundle');
    if (bundle.snapshotContentDigest !== undefined && bundle.snapshotContentDigest !== snapshotContentDigest(snapshot))
        planError('retainedBundle.snapshotContentDigest', 'snapshot content changed; retain a new bundle');
}
export function captureRecallExecutionEvidence(episode: TradeEpisode): RecallExecutionEvidence {
    const identity = (instrument: TradeEpisode['instrument']) => ({
        id: instrument.id, symbol: instrument.symbol, market: instrument.market, currency: instrument.currency
    });
    const { executions, accountLabel, instrument, ...facts } = episode;
    void accountLabel;
    const payload = {
        episode: {
            ...facts, instrument: identity(instrument)
        }, executions: executions.map(({ accountLabel, instrument, ...execution }) => {
            void accountLabel;
            return {
                ...execution, instrument: identity(instrument)
            };
        })
    };
    const safe = JSON.parse(JSON.stringify(payload)) as typeof payload;
    return {
        version: 1, executionIds: safe.executions.map(e => e.id), digest: sha256(canonicalRecallJson(safe)), payload: safe
    };
}
export function freezeRecallSnapshotBundle(document: RecallDocument, snapshotId: string, options: {
    bundleId: string;
    retainedAt: string;
    episode: TradeEpisode;
    sourceBundleId?: string | null;
}): RecallDocument {
    let next = cloneRecallDocument(document);
    const snapshot = next.snapshots.find(s => s.id === snapshotId);
    if (!snapshot)
        planError('snapshotId', 'unknown snapshot');
    if (options.episode.id !== document.episodeId)
        planError('episode', 'identity mismatch');
    if (next.retainedBundles?.some(b => b.id === options.bundleId))
        planError('bundleId', 'immutable id already exists');
    const sourceBundle = options.sourceBundleId ? next.retainedBundles?.find(b => b.id === options.sourceBundleId) : undefined;
    if (options.sourceBundleId && !sourceBundle)
        planError('sourceBundleId', 'unknown retained selection');
    const lineages = new Set((next.planAssociations ?? []).filter(a => {
        if (snapshot.decisionId === 'global')
            return true;
        if (a.status !== 'linked')
            return false;
        if (a.decisionId === snapshot.decisionId)
            return true;
        const plan = next.plans?.drafts.find(d => d.planId === a.planId) ?? next.plans?.versions.find(d => d.planId === a.planId);
        return Boolean(plan && Date.parse(plan.knowledgeCutoff.cursor) <= Date.parse(snapshot.cursor) && executionBoundaryForCursor(options.episode.executions, plan.knowledgeCutoff.executionCursor) <= executionBoundaryForCursor(options.episode.executions, snapshot.executionCursor));
    }).map(a => a.planId));
    for (const draft of next.plans?.drafts ?? [])
        if (options.sourceBundleId === undefined && lineages.has(draft.planId))
            next = freezeRecallPlanDraft(next, draft.id, {
                versionId: `${options.bundleId}:plan:${draft.id}`, riskBaselineId: `${options.bundleId}:risk:${draft.id}`, retainedAt: options.retainedAt
            });
    const latest = new Map<string, string>();
    for (const version of next.plans?.versions ?? [])
        if (lineages.has(version.planId))
            latest.set(version.planId, version.id);
    const planVersionIds = options.sourceBundleId === null ? [] : sourceBundle ? [...sourceBundle.planVersionIds] : [...latest.values()];
    const riskBaselineIds = options.sourceBundleId === null ? [] : sourceBundle ? [...sourceBundle.riskBaselineIds] : [...new Set(planVersionIds.map(id => recallPlanRiskBaseline(next, id)?.id).filter((id): id is string => Boolean(id)))];
    for (const id of riskBaselineIds) {
        const versionId = next.plans?.riskBaselines.find(b => b.id === id)?.planVersionId;
        if (versionId && !planVersionIds.includes(versionId))
            planVersionIds.push(versionId);
    }
    const evaluations = freezeRecallExitEvaluations(next, {
        bundleId: options.bundleId, retainedAt: options.retainedAt,
        decisionId: snapshot.phase === 'post-review' ? 'global' : snapshot.decisionId,
        episode: options.episode,
        ...(options.sourceBundleId !== undefined
            ? { sourceRevisionIds: sourceBundle?.evaluationRevisionIds ?? null }
            : snapshot.phase === 'pre-entry' || snapshot.phase === 'holding'
                ? { sourceRevisionIds: [] }
                : snapshot.phase === 'post-review'
                    ? { knowledgeCutoff: { cursor: snapshot.cursor, executionCursor: snapshot.executionCursor } }
                    : {}),
    });
    next = evaluations.document;
    const manualEvaluations = freezeRecallManualEvaluations(next, {
        bundleId: options.bundleId,
        retainedAt: options.retainedAt,
        episode: options.episode,
        ...(options.sourceBundleId !== undefined
            ? { sourceRevisionIds: sourceBundle?.manualEvaluationRevisionIds ?? null }
            : snapshot.phase === 'post-review'
                ? { knowledgeCutoff: { cursor: snapshot.cursor, executionCursor: snapshot.executionCursor } }
                : { sourceRevisionIds: [] }),
    });
    next = manualEvaluations.document;
    next.retainedBundles ??= [];
    next.retainedBundles.push({
        id: options.bundleId, snapshotId, documentRevision: 0, retainedAt: options.retainedAt, snapshotContentDigest: snapshotContentDigest(snapshot), executionEvidence: captureRecallExecutionEvidence(options.episode), decisions: structuredClone(next.decisions), captureContext: JSON.parse(JSON.stringify({
            phase: snapshot.phase, cursor: snapshot.cursor, executionCursor: snapshot.executionCursor, timeframe: snapshot.timeframe, viewport: snapshot.viewport, hasSeenFuture: snapshot.hasSeenFuture, priceBasis: snapshot.priceBasis
        })), planVersionIds, riskBaselineIds,
        ...(evaluations.revisionIds === undefined ? {} : { evaluationRevisionIds: evaluations.revisionIds }),
        ...(manualEvaluations.revisionIds === undefined ? {} : { manualEvaluationRevisionIds: manualEvaluations.revisionIds })
    });
    next.snapshots.find(s => s.id === snapshotId)!.retainedBundleId = options.bundleId;
    // A superseded capture that has never been accepted is not retained history.
    // Every newly submitted bundle must be attached to a concrete snapshot.
    next.retainedBundles = next.retainedBundles.filter(bundle => bundle.documentRevision > 0 || next.snapshots.some(s => s.retainedBundleId === bundle.id));
    return next;
}
export function validateRecallRetainedState(document: RecallDocument): void {
    const planIds = new Set([...document.plans?.drafts ?? [], ...document.plans?.versions ?? []].map(p => p.planId));
    const associations = new Set<string>();
    if (document.planAssociations !== undefined && !Array.isArray(document.planAssociations))
        planError('planAssociations', 'must be an array');
    for (const raw of document.planAssociations ?? []) {
        const a = planRecord(raw, 'planAssociation');
        planString(a.planId, 'planAssociation.planId');
        if (!planIds.has(a.planId) || associations.has(a.planId))
            planError('planAssociation', 'unknown or duplicate lineage');
        associations.add(a.planId);
        if (a.executionIds !== undefined && (!Array.isArray(a.executionIds) || a.executionIds.some(id => typeof id !== 'string') || new Set(a.executionIds).size !== a.executionIds.length))
            planError('planAssociation.executionIds', 'invalid explicit boundary');
        if (a.status === 'linked') {
            if (!document.decisions.some(d => d.id === a.decisionId))
                planError('planAssociation.decisionId', 'unknown linked decision');
        }
        else if (a.status !== 'needs-confirmation' || a.decisionId !== null)
            planError('planAssociation', 'unresolved association requires null owner');
    }
    for (const id of planIds)
        if (!associations.has(id))
            planError('planAssociations', 'each plan requires a current association');
    const ids = new Set<string>();
    if (document.retainedBundles !== undefined && !Array.isArray(document.retainedBundles))
        planError('retainedBundles', 'must be an array');
    for (const raw of document.retainedBundles ?? []) {
        const b = planRecord(raw, 'retainedBundle');
        for (const field of ['id', 'snapshotId', 'retainedAt'])
            planString(b[field], `retainedBundle.${field}`);
        planTimestamp(b.retainedAt, 'retainedBundle.retainedAt');
        if (ids.has(b.id as string))
            planError('retainedBundle.id', 'duplicate id');
        ids.add(b.id as string);
        if (!Number.isInteger(b.documentRevision) || (b.documentRevision as number) < 0)
            planError('retainedBundle.documentRevision', 'invalid revision');
        for (const field of ['planVersionIds', 'riskBaselineIds', 'decisions'])
            if (!Array.isArray(b[field]))
                planError(`retainedBundle.${field}`, 'must be array');
        for (const id of b.planVersionIds as unknown[])
            if (!document.plans?.versions.some(p => p.id === id))
                planError('retainedBundle.planVersionIds', 'unknown version');
        for (const id of b.riskBaselineIds as unknown[])
            if (!document.plans?.riskBaselines.some(p => p.id === id && (b.planVersionIds as unknown[]).includes(p.planVersionId)))
                planError('retainedBundle.riskBaselineIds', 'unknown baseline');
        if (b.evaluationRevisionIds !== undefined) {
            if (!Array.isArray(b.evaluationRevisionIds))
                planError('evaluationRevisionIds', 'must be array');
            if(new Set(b.evaluationRevisionIds as unknown[]).size !== (b.evaluationRevisionIds as unknown[]).length) planError('evaluationRevisionIds','duplicate revision');
            for (const id of b.evaluationRevisionIds as unknown[])
                if (!document.exitEvaluations?.versions.some(v => v.id === id))
                    planError('evaluationRevisionIds', 'unknown revision');
        }
        if (b.manualEvaluationRevisionIds !== undefined) {
            if (!Array.isArray(b.manualEvaluationRevisionIds))
                planError('manualEvaluationRevisionIds', 'must be array');
            if (new Set(b.manualEvaluationRevisionIds as unknown[]).size !== (b.manualEvaluationRevisionIds as unknown[]).length) planError('manualEvaluationRevisionIds', 'duplicate revision');
            for (const id of b.manualEvaluationRevisionIds as unknown[])
                if (!document.manualEvaluations?.versions.some(v => v.id === id))
                    planError('manualEvaluationRevisionIds', 'unknown revision');
        }
        const context = planRecord(b.captureContext, 'retainedBundle.captureContext');
        for (const key of ['cursor', 'executionCursor', 'timeframe'])
            planString(context[key], `retainedBundle.captureContext.${key}`);
        planTimestamp(context.cursor, 'retainedBundle.captureContext.cursor');
        const e = planRecord(b.executionEvidence, 'executionEvidence');
        if (e.version !== 1 || !Array.isArray(e.executionIds))
            planError('executionEvidence', 'invalid version/IDs');
        planString(e.digest, 'executionEvidence.digest');
        if (e.digest !== sha256(canonicalRecallJson(e.payload)))
            planError('executionEvidence.digest', 'payload mismatch');
        const payload = planRecord(e.payload, 'executionEvidence.payload');
        const episode = planRecord(payload.episode, 'executionEvidence.payload.episode');
        if (episode.id !== document.episodeId || !Array.isArray(payload.executions))
            planError('executionEvidence.payload', 'invalid episode');
        const executionIds = (payload.executions as unknown[]).map(x => {
            const execution = planRecord(x, 'executionEvidence.execution');
            planString(execution.id, 'executionEvidence.execution.id');
            return execution.id;
        });
        if (canonicalRecallJson(executionIds) !== canonicalRecallJson(e.executionIds) || new Set(executionIds).size !== executionIds.length)
            planError('executionEvidence.executionIds', 'payload mismatch');
        const grouped = new Set<string>();
        for (const raw of b.decisions as unknown[]) {
            const d = planRecord(raw, 'retainedBundle.decision');
            planString(d.id, 'retainedBundle.decision.id');
            if (!Array.isArray(d.executionIds))
                planError('retainedBundle.decision.executionIds', 'must be array');
            for (const id of d.executionIds) {
                if (typeof id !== 'string' || !executionIds.includes(id) || grouped.has(id))
                    planError('retainedBundle.decisions', 'invalid execution boundary');
                grouped.add(id);
            }
        }
    }
    for (const snapshot of document.snapshots) {
        if (snapshot.retainedBundleId === undefined)
            continue;
        const bundle = document.retainedBundles?.find(b => b.id === snapshot.retainedBundleId && b.snapshotId === snapshot.id);
        if (!bundle)
            planError('snapshot.retainedBundleId', 'unknown capture bundle');
        assertBoundSnapshot(snapshot, bundle);
    }
}
/** Compare immutable entities before stamping only captures first accepted by this CAS. */
export function confirmRecallRetainedState(previous: RecallDocument | undefined, next: RecallDocument, episode: TradeEpisode | undefined, revision: number): void {
    assertRecallExitEvaluationImmutability(previous, next);
    assertRecallManualEvaluationImmutability(previous, next);
    for (const [oldItems, newItems] of [[previous?.plans?.versions, next.plans?.versions], [previous?.plans?.riskBaselines, next.plans?.riskBaselines], [previous?.retainedBundles, next.retainedBundles]] as const)
        for (const old of oldItems ?? []) {
            const item = newItems?.find(v => v.id === old.id);
            if (!item || canonicalRecallJson(item) !== canonicalRecallJson(old))
                planError('retained evidence', 'immutable object modified or removed');
        }
    for (const original of previous?.snapshots ?? []) {
        if (!original.retainedBundleId)
            continue;
        const current = next.snapshots.find(snapshot => snapshot.id === original.id);
        if (current && !current.retainedBundleId)
            planError('snapshot.retainedBundleId', 'accepted capture binding cannot be stripped; retain a new bundle');
    }
    for (const bundle of next.retainedBundles ?? []) {
        const snapshot = next.snapshots.find(s => s.id === bundle.snapshotId && s.retainedBundleId === bundle.id);
        const accepted = previous?.retainedBundles?.some(b => b.id === bundle.id);
        if (snapshot)
            assertBoundSnapshot(snapshot, bundle);
        if (accepted) {
            if (snapshot && bundle.snapshotContentDigest === undefined) {
                const original = previous?.snapshots.find(s => s.id === snapshot.id && s.retainedBundleId === bundle.id);
                if (!original || snapshotContentDigest(original) !== snapshotContentDigest(snapshot))
                    planError('retainedBundle.snapshotContentDigest', 'legacy accepted snapshot changed; retain a new bundle');
            }
            continue;
        }
        if (!episode)
            planError('episode', 'required for new capture');
        const expected = captureRecallExecutionEvidence(episode);
        if (canonicalRecallJson(expected) !== canonicalRecallJson(bundle.executionEvidence))
            planError('executionEvidence', 'stale or spoofed capture; refresh and retain again');
        if (canonicalRecallJson(bundle.decisions) !== canonicalRecallJson(next.decisions))
            planError('retainedBundle.decisions', 'capture grouping mismatch');
        if (!snapshot)
            planError('retainedBundle.snapshotId', 'new capture requires a bound snapshot');
        if (!bundle.snapshotContentDigest)
            planError('retainedBundle.snapshotContentDigest', 'new capture requires content binding');
        bundle.documentRevision = revision;
        bundle.executionEvidence = expected;
    }
    for (const p of [...next.plans?.drafts ?? [], ...next.plans?.versions ?? []])
        if (episode && ((p.input.currency !== null && p.input.currency !== episode.instrument.currency) || (p.riskBudget && p.riskBudget.currency !== episode.instrument.currency)))
            planError('plan.input.currency', 'must match episode currency');
}
/** Baseline source versions coexist in bundles; only the last selected descendant is current. */
export function getRecallBundlePlans(document: RecallDocument, bundle: import('./types').RecallRetainedBundle): import('./types').RecallPlanVersion[] {
    const selected = new Map<string, import('./types').RecallPlanVersion>();
    for (const version of document.plans?.versions ?? [])
        if (bundle.planVersionIds.includes(version.id))
            selected.set(version.planId, version);
    return [...selected.values()];
}
