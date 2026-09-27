import { Temporal } from '@js-temporal/polyfill';
import Decimal from 'decimal.js';
import { validateRecallSizing } from './sizing';
import { executionBoundaryForCursor } from '../replay/recall-replay';
import type { TradeEpisode } from '../trades/types';
import { cloneRecallDocument, RecallValidationError } from './document';
import type { RecallDecision, RecallDocument, RecallPlanCalculation, RecallPlanDraft, RecallPlanInput, RecallPlanMetric } from './types';
const currencies = new Set(Intl.supportedValuesOf('currency'));
export function planError(field: string, message: string): never {
    throw new RecallValidationError(`${field}: ${message}`);
}
export function planRecord(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return planError(field, 'must be an object');
    return value as Record<string, unknown>;
}
export function planString(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string' || !value.trim())
        planError(field, 'must be a non-empty string');
}
export function planTimestamp(value: unknown, field: string): void {
    planString(value, field);
    try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value))
            Temporal.PlainDate.from(value);
        else
            Temporal.Instant.from(value);
    }
    catch {
        planError(field, 'must be a valid ISO date or timestamp');
    }
}
function choice(value: unknown, choices: readonly unknown[], field: string) {
    if (!choices.includes(value))
        planError(field, 'unsupported value');
}
export function positiveDecimal(value: unknown, field: string, nullable = true) {
    if (value === null && nullable)
        return;
    if (typeof value !== 'string' || !/^(?:\d+)(?:\.\d+)?$/.test(value) || !new Decimal(value).gt(0))
        planError(field, 'must be a positive decimal string');
}
function currency(value: unknown, field: string) {
    if (value !== null && (typeof value !== 'string' || !currencies.has(value)))
        planError(field, 'unsupported ISO currency');
}
export function validateRecallPlanInput(value: unknown): asserts value is RecallPlanInput {
    const x = planRecord(value, 'input');
    choice(x.direction, [null, 'long', 'short'], 'input.direction');
    currency(x.currency, 'input.currency');
    choice(x.priceBasis, [null, 'raw', 'adjusted'], 'input.priceBasis');
    for (const field of ['entry', 'initialStop', 'sizeInputValue', 'resolvedQuantity'])
        positiveDecimal(x[field], `input.${field}`);
    choice(x.sizeInputMode, ['quantity', 'amount', 'ratio'], 'input.sizeInputMode');
    choice(x.quantityUnit, ['share', 'unit'], 'input.quantityUnit');
    if (!Array.isArray(x.targets))
        planError('input.targets', 'must be an array');
    const ids = new Set<string>();
    for (const [i, v] of x.targets.entries()) {
        const t = planRecord(v, `input.targets.${i}`);
        planString(t.id, `input.targets.${i}.id`);
        if (ids.has(t.id))
            planError('input.targets', 'duplicate id');
        ids.add(t.id);
        for (const f of ['price', 'quantity', 'ratio'])
            positiveDecimal(t[f], `input.targets.${i}.${f}`);
        if (t.ratio !== null && new Decimal(t.ratio as string).gt(1))
            planError(`input.targets.${i}.ratio`, 'must not exceed 1');
    }
    if (x.sizing === undefined && x.sizeInputMode === 'quantity' && x.sizeInputValue !== x.resolvedQuantity)
        planError('input.resolvedQuantity', 'must equal quantity input');
    if (x.capital !== null) {
        const c = planRecord(x.capital, 'input.capital');
        positiveDecimal(c.amount, 'input.capital.amount');
        currency(c.currency, 'input.capital.currency');
        if (c.asOf !== null)
            planTimestamp(c.asOf, 'input.capital.asOf');
        choice(c.source, ['manual-reference', 'account-snapshot'], 'input.capital.source');
        if (c.source === 'account-snapshot')
            planString(c.snapshotRef, 'input.capital.snapshotRef');
    }
    if (x.sizing !== undefined) {
        planRecord(x.sizing, 'input.sizing');
        const error = validateRecallSizing(x as RecallPlanInput);
        if (error)
            planError('input.sizing', error);
    }
}
export function calculateRecallPlan(input: RecallPlanInput, kind: RecallPlanDraft['kind'] = 'initial'): RecallPlanCalculation {
    const issues: RecallPlanCalculation['issues'] = [];
    try {
        validateRecallPlanInput(input);
    }
    catch (error) {
        issues.push({
            field: 'input', message: (error as Error).message
        });
    }
    if (kind !== 'adjustment' && !issues.length && input.entry && input.initialStop && input.direction) {
        if (input.direction === 'long' ? new Decimal(input.initialStop).gte(input.entry) : new Decimal(input.initialStop).lte(input.entry))
            issues.push({
                field: 'initialStop', message: '止损必须位于入场价的风险方向'
            });
    }
    if (!issues.length && input.entry && input.direction)
        for (const t of input.targets)
            if (t.price && (input.direction === 'long' ? new Decimal(t.price).lte(input.entry) : new Decimal(t.price).gte(input.entry)))
                issues.push({
                    field: `targets.${t.id}.price`, message: '目标必须位于入场价的获利方向'
                });
    const metric = (value: string | null, reason: string | null, unit = 'money'): RecallPlanMetric => ({
        value, reason, currency: unit === 'R' ? null : input.currency, unit, methodVersion: 'plan-v1'
    });
    const missing = issues.length ? 'invalid-plan' : kind === 'adjustment' ? 'inherited-initial-risk-baseline' : !input.direction ? 'missing-direction' : !input.currency ? 'missing-currency' : !input.entry ? 'missing-entry' : !input.initialStop ? 'missing-stop' : !input.resolvedQuantity ? 'missing-quantity' : null;
    const risk = missing ? null : new Decimal(input.entry!).minus(input.initialStop!).abs().mul(input.resolvedQuantity!);
    const rewardMissing = missing ?? (!input.targets[0]?.price ? 'missing-target' : null);
    const reward = rewardMissing ? null : new Decimal(input.targets[0].price!).minus(input.entry!).abs().mul(input.resolvedQuantity!);
    return {
        initialRisk: metric(risk?.toFixed() ?? null, missing), targetReward: metric(reward?.toFixed() ?? null, rewardMissing), expectedR: metric(risk && reward ? reward.div(risk).toFixed() : null, rewardMissing, 'R'), issues
    };
}
export function validateRecallPlans(value: unknown, decisions: RecallDecision[]): void {
    if (value === undefined)
        return;
    const p = planRecord(value, 'plans');
    for (const f of ['drafts', 'versions', 'riskBaselines'])
        if (!Array.isArray(p[f]))
            planError(`plans.${f}`, 'must be an array');
    const ids = new Set<string>();
    const versions = new Map<string, RecallPlanDraft>();
    const drafts = new Set<string>();
    for (const [kind, items] of [['versions', p.versions], ['drafts', p.drafts]] as const)
        for (const raw of items as unknown[]) {
            const d = planRecord(raw, `plans.${kind}`);
            for (const f of ['id', 'planId', 'decisionId', 'recordedAt'])
                planString(d[f], `plans.${kind}.${f}`);
            if (ids.has(d.id as string))
                planError('plans', 'duplicate entity id');
            ids.add(d.id as string);
            choice(d.kind, ['initial', 'adjustment', 'correction'], 'plan.kind');
            choice(d.recordedPhase, ['pre-entry', 'holding', 'post-review'], 'plan.recordedPhase');
            choice(d.source, ['retrospective'], 'plan.source');
            if (typeof d.hasSeenFuture !== 'boolean')
                planError('plan.hasSeenFuture', 'must be boolean');
            const cutoff = planRecord(d.knowledgeCutoff, 'plan.knowledgeCutoff');
            planString(cutoff.cursor, 'plan.knowledgeCutoff.cursor');
            planString(cutoff.executionCursor, 'plan.knowledgeCutoff.executionCursor');
            planTimestamp(d.recordedAt, 'plan.recordedAt');
            planTimestamp(cutoff.cursor, 'plan.knowledgeCutoff.cursor');
            validateRecallPlanInput(d.input);
            if (calculateRecallPlan(d.input, d.kind as RecallPlanDraft['kind']).issues.length)
                planError('plan.input', calculateRecallPlan(d.input, d.kind as RecallPlanDraft['kind']).issues[0].message);
            if (kind === 'versions') {
                planTimestamp(d.retainedAt, 'plan.retainedAt');
                versions.set(d.id as string, d as unknown as RecallPlanDraft);
            }
            else {
                if (drafts.has(d.planId as string))
                    planError('plans.drafts', 'one current draft per lineage');
                drafts.add(d.planId as string);
            }
        }
    for (const raw of [...p.versions as unknown[], ...p.drafts as unknown[]]) {
        const d = raw as RecallPlanDraft;
        if (d.kind !== 'initial' || d.reason !== undefined)
            planString(d.reason, 'plan.reason');
        if (d.riskBudget !== undefined) {
            validateRecallRiskBudget(d.riskBudget);
            if (Date.parse(d.riskBudget.effectiveKnowledgeCutoff.cursor) > Date.parse(d.knowledgeCutoff.cursor))
                planError('riskBudget', 'effective cutoff exceeds observed cutoff');
        }
        if (d.kind !== 'initial' && !d.parentVersionId)
            planError('plan.parentVersionId', 'required for revision');
        if (d.parentVersionId) {
            const parent = versions.get(d.parentVersionId);
            if (!parent || parent.planId !== d.planId || parent.id === d.id)
                planError('plan.parentVersionId', 'unknown or invalid lineage');
        }
    }
    const initialByLineage = new Map<string, RecallPlanDraft>();
    for (const version of versions.values())
        if (version.kind === 'initial') {
            if (initialByLineage.has(version.planId))
                planError('plans.versions', 'one initial version per lineage');
            initialByLineage.set(version.planId, version);
        }
    for (const draft of p.drafts as RecallPlanDraft[]) {
        const initial = initialByLineage.get(draft.planId);
        if (draft.kind === 'initial' && initial && JSON.stringify(draft.input) !== JSON.stringify(initial.input))
            planError('plans.drafts', 'retained initial plan is read-only');
    }
    for (const version of versions.values()) {
        const visited = new Set<string>();
        let parent: RecallPlanDraft | undefined = version;
        while (parent) {
            if (visited.has(parent.id))
                planError('plan.parentVersionId', 'cyclic lineage');
            visited.add(parent.id);
            parent = parent.parentVersionId ? versions.get(parent.parentVersionId) : undefined;
        }
    }
    for (const raw of p.riskBaselines as unknown[]) {
        const b = planRecord(raw, 'riskBaseline');
        for (const f of ['id', 'planVersionId', 'frozenAt'])
            planString(b[f], `riskBaseline.${f}`);
        if (ids.has(b.id as string))
            planError('riskBaseline.id', 'duplicate id');
        ids.add(b.id as string);
        planTimestamp(b.frozenAt, 'riskBaseline.frozenAt');
        choice(b.scope, ['decision', 'episode'], 'riskBaseline.scope');
        if (b.scope === 'decision')
            planString(b.decisionId, 'riskBaseline.decisionId');
        if (!versions.has(b.planVersionId as string))
            planError('riskBaseline.planVersionId', 'unknown version');
        positiveDecimal(b.amount, 'riskBaseline.amount', false);
        currency(b.currency, 'riskBaseline.currency');
        if (b.currency === null)
            planError('riskBaseline.currency', 'required');
        choice(b.method, ['planned-price-risk', 'fixed-budget'], 'riskBaseline.method');
        choice(b.methodVersion, ['risk-v1'], 'riskBaseline.methodVersion');
        if (b.correctsBaselineId !== undefined) {
            planString(b.correctsBaselineId, 'riskBaseline.correctsBaselineId');
            const corrected = (p.riskBaselines as Record<string, unknown>[]).find(candidate => candidate.id === b.correctsBaselineId);
            const correctionVersion = versions.get(b.planVersionId as string)!;
            if (!corrected || corrected.id === b.id || correctionVersion.kind !== 'correction' || recallPlanRiskBaseline({ plans: { versions: [...versions.values()], riskBaselines: p.riskBaselines } } as RecallDocument, correctionVersion.parentVersionId!)?.id !== corrected.id)
                planError('riskBaseline.correctsBaselineId', 'must reference the corrected parent baseline');
        }
        const version = versions.get(b.planVersionId as string)!;
        if (version.kind === 'adjustment')
            planError('riskBaseline', 'adjustments inherit the original baseline');
        const risk = calculateRecallPlan(version.input).initialRisk;
        if (b.method === 'fixed-budget' ? (!version.riskBudget || b.decisionId !== version.decisionId || b.scope !== version.riskBudget.scope || b.currency !== version.riskBudget.currency || !new Decimal(b.amount as string).eq(version.riskBudget.amount)) : (b.scope !== 'decision' || b.decisionId !== version.decisionId || b.currency !== version.input.currency || risk.value === null || !new Decimal(b.amount as string).eq(risk.value)))
            planError('riskBaseline', 'must match frozen plan risk');
    }
    void decisions; // Historical captured owners may have been regrouped; current ownership lives in associations.
}
export function upsertRecallPlanDraft(document: RecallDocument, draft: RecallPlanDraft): RecallDocument {
    const next = cloneRecallDocument(document);
    next.plans ??= {
        drafts: [], versions: [], riskBaselines: []
    };
    if (!next.decisions.some(d => d.id === draft.decisionId))
        planError('draft.decisionId', 'unknown decision');
    if (draft.kind === 'initial' && next.plans.versions.some(v => v.planId === draft.planId && v.kind === 'initial'))
        planError('draft', 'retained initial plan is read-only');
    const index = next.plans.drafts.findIndex(d => d.planId === draft.planId);
    if (index < 0)
        next.plans.drafts.push(structuredClone(draft));
    else
        next.plans.drafts[index] = structuredClone(draft);
    next.planAssociations ??= [];
    if (!next.planAssociations.some(a => a.planId === draft.planId))
        next.planAssociations.push({
            planId: draft.planId, decisionId: draft.decisionId, status: 'linked'
        });
    validateRecallPlans(next.plans, next.decisions);
    next.status = draft.kind === 'correction' ? 'needs-confirmation' : 'in-progress';
    next.updatedAt = draft.recordedAt;
    return next;
}
export function freezeRecallPlanDraft(document: RecallDocument, draftId: string, options: {
    versionId: string;
    riskBaselineId: string;
    retainedAt: string;
}): RecallDocument {
    const next = cloneRecallDocument(document);
    const draft = next.plans?.drafts.find(d => d.id === draftId);
    if (!draft)
        planError('draftId', 'unknown draft');
    if (next.plans!.versions.some(v => v.planId === draft.planId && v.kind === 'initial') && draft.kind === 'initial')
        return next;
    if (next.plans!.versions.some(v => v.id === options.versionId) || next.plans!.riskBaselines.some(b => b.id === options.riskBaselineId))
        planError('versionId', 'immutable id already exists');
    const revisionContent = (value: RecallPlanDraft) => { const content = { ...value } as Record<string, unknown>; delete content.id; delete content.retainedAt; return JSON.stringify(content); };
    const sameRevision = next.plans!.versions.find(v => revisionContent(v) === revisionContent(draft));
    if (sameRevision)
        return next;
    const previousBaseline = draft.kind === 'correction' ? recallPlanRiskBaseline(next, draft.parentVersionId!) : undefined;
    next.plans!.versions.push({
        ...structuredClone(draft), id: options.versionId, retainedAt: options.retainedAt
    });
    const result = calculateRecallPlan(draft.input, draft.kind);
    if (draft.kind !== 'adjustment' && (result.initialRisk.value || draft.riskBudget))
        next.plans!.riskBaselines.push({
            id: options.riskBaselineId, scope: draft.riskBudget?.scope ?? 'decision', decisionId: draft.decisionId, planVersionId: options.versionId, amount: draft.riskBudget?.amount ?? result.initialRisk.value!, currency: draft.riskBudget?.currency ?? draft.input.currency!, method: draft.riskBudget ? 'fixed-budget' : 'planned-price-risk', methodVersion: 'risk-v1', frozenAt: options.retainedAt, ...(previousBaseline ? {
                correctsBaselineId: previousBaseline.id
            } : {})
        });
    validateRecallPlans(next.plans, next.decisions);
    if (draft.kind === 'correction')
        next.status = 'needs-confirmation';
    return next;
}
export function resolveRecallPlanAssociation(document: RecallDocument, planId: string, decisionId: string): RecallDocument {
    const next = cloneRecallDocument(document);
    if (!next.decisions.some(d => d.id === decisionId))
        planError('decisionId', 'unknown decision');
    const association = next.planAssociations?.find(a => a.planId === planId);
    if (!association)
        planError('planId', 'unknown association');
    association.executionIds = [...next.decisions.find(d => d.id === decisionId)!.executionIds];
    association.decisionId = decisionId;
    association.status = 'linked';
    next.status = 'in-progress';
    return next;
}
export function validateRecallRiskBudget(value: unknown): void {
    const b = planRecord(value, 'riskBudget');
    positiveDecimal(b.amount, 'riskBudget.amount', false);
    currency(b.currency, 'riskBudget.currency');
    if (b.currency === null)
        planError('riskBudget.currency', 'required');
    choice(b.scope, ['decision', 'episode'], 'riskBudget.scope');
    planString(b.sourceDescription, 'riskBudget.sourceDescription');
    choice(b.provenance, ['retrospective', 'original-evidence'], 'riskBudget.provenance');
    if (b.evidenceReference !== null)
        planString(b.evidenceReference, 'riskBudget.evidenceReference');
    if (b.provenance === 'original-evidence' && !b.evidenceReference)
        planError('riskBudget.evidenceReference', 'required for original evidence');
    const c = planRecord(b.effectiveKnowledgeCutoff, 'riskBudget.effectiveKnowledgeCutoff');
    planTimestamp(c.cursor, 'riskBudget.cursor');
    planString(c.executionCursor, 'riskBudget.executionCursor');
}
export function recallPlanRiskBaseline(document: RecallDocument, versionId: string): import('./types').RecallRiskBaseline | undefined {
    const visited = new Set<string>();
    let id: string | undefined = versionId;
    while (id && !visited.has(id)) {
        visited.add(id);
        const b = document.plans?.riskBaselines.find(b => b.planVersionId === id);
        if (b)
            return b;
        const v = document.plans?.versions.find(v => v.id === id);
        if (v?.kind === 'correction')
            return undefined;
        id = v?.parentVersionId;
    }
    return undefined;
}
export function createRecallPlanRevision(document: RecallDocument, options: Pick<RecallPlanDraft, 'id' | 'planId' | 'recordedAt' | 'recordedPhase' | 'knowledgeCutoff' | 'hasSeenFuture'> & {
    kind: 'adjustment' | 'correction';
    reason: string;
}): RecallDocument {
    planString(options.reason, 'revision.reason');
    const parent = [...document.plans?.versions ?? []].reverse().find(v => v.planId === options.planId);
    if (!parent)
        planError('planId', 'retain an initial plan first');
    const association = document.planAssociations?.find(a => a.planId === options.planId);
    if (association?.status !== 'linked' || !association.decisionId)
        planError('planId', 'resolve plan association first');
    const draft: RecallPlanDraft = { ...structuredClone(parent), ...options, decisionId: association.decisionId, parentVersionId: parent.id, source: 'retrospective' };
    delete (draft as Partial<import('./types').RecallPlanVersion>).retainedAt;
    const next = upsertRecallPlanDraft(document, draft);
    if (options.kind === 'correction')
        next.status = 'needs-confirmation';
    return next;
}
/** Budget eligibility counts opening decisions, never broker execution rows. */
export function recallEpisodeRiskBaseline(document: RecallDocument, episode: TradeEpisode): {
    baseline: import('./types').RecallRiskBaseline | null;
    reason: string | null;
} {
    if (episode.directionKnown === false)
        return { baseline: null, reason: 'unknown-direction' };
    const executions = episode.executions.map((execution, index) => ({ execution, index })).sort((a, b) => Date.parse(a.execution.executedAt) - Date.parse(b.execution.executedAt) || a.index - b.index).map(x => x.execution);
    const openingSide = episode.direction === 'long' ? 'buy' : 'sell';
    const opening = document.decisions.map(d => ({ d, index: Math.min(...d.executionIds.map(id => executions.findIndex(e => e.id === id && e.side === openingSide)).filter(i => i >= 0)) })).filter(x => Number.isFinite(x.index)).sort((a, b) => a.index - b.index);
    const latest = new Map<string,string>();
    for (const version of document.plans?.versions ?? []) latest.set(version.planId,version.id);
    const activeBaselineIds = new Set([...latest.values()].map(id=>recallPlanRiskBaseline(document,id)?.id));
    const candidates = [...document.plans?.riskBaselines ?? []].reverse().filter(b=>activeBaselineIds.has(b.id));
    for (const b of candidates) {
        const v = document.plans?.versions.find(v => v.id === b.planVersionId);
        const budget = v?.riskBudget;
        if (b.scope === 'episode' && budget) {
            const cutoff = budget.effectiveKnowledgeCutoff;
            const knownCursor = cutoff.executionCursor === '__recall_before_first_execution__' || executions.some(e => e.id === cutoff.executionCursor) || Number.isFinite(Date.parse(cutoff.executionCursor));
            const boundary = executionBoundaryForCursor(executions, cutoff.executionCursor);
            if (knownCursor && (opening.length < 2 || (boundary < opening[1].index && Date.parse(cutoff.cursor) < Date.parse(executions[opening[1].index].executedAt))))
                return { baseline: b, reason: null };
        }
    }
    if (opening.length > 1)
        return { baseline: null, reason: 'multiple-opening-decisions-require-prior-episode-budget' };
    const b = candidates.find(b => b.scope === 'decision' && document.planAssociations?.some(a => a.status === 'linked' && a.decisionId === opening[0]?.d.id && document.plans?.versions.some(v => v.id === b.planVersionId && v.planId === a.planId)));
    return { baseline: b ?? null, reason: b ? null : 'missing-initial-risk-baseline' };
}

/** Current explicit relinks take precedence over immutable historical captured ownership. */
export function recallPlanAssociationBoundary(document: RecallDocument, planId: string): string[] | undefined {
    const association = document.planAssociations?.find(a => a.planId === planId);
    if (association?.executionIds) return association.executionIds;
    for (const version of document.plans?.versions ?? []) {
        if (version.planId !== planId) continue;
        const bundle = document.retainedBundles?.find(b => b.planVersionIds.includes(version.id));
        const boundary = bundle?.decisions.find(d => d.id === version.decisionId)?.executionIds;
        if (boundary?.length) return boundary;
    }
    return undefined;
}
