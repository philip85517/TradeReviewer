import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { validateRecallDocument } from './document';
import type { RecallDocument, RecallPlanVersion } from './types';
/** Internal projection/repair primitive: caller owns the enclosing transaction. JSON remains authoritative. */
export function rebuildRecallPlanProjections(database: DatabaseSync, document: RecallDocument, versionKind: 'draft' | 'formal'): void {
    validateRecallDocument(document);
    const prefix = [document.episodeId, versionKind, document.revision];
    for (const table of ['recall_plan_associations', 'recall_bundle_plans', 'recall_bundle_baselines', 'recall_plan_targets', 'recall_risk_baselines', 'recall_retained_bundles', 'recall_plan_versions'])
        database.prepare(`delete from ${table} where episode_id=? and version_kind=?`).run(document.episodeId, versionKind);
    const insert = (table: string, columns: string[], values: SQLInputValue[]) => database.prepare(`insert into ${table} (${columns.join(',')}) values (${columns.map(() => '?').join(',')})`).run(...values);
    const base = ['episode_id', 'version_kind', 'document_revision'];
    for (const a of document.planAssociations ?? [])
        insert('recall_plan_associations', [...base, 'plan_id', 'decision_id', 'status'], [...prefix, a.planId, a.decisionId, a.status]);
    for (const [state, plans] of [['draft', document.plans?.drafts ?? []], ['retained', document.plans?.versions ?? []]] as const)
        for (const plan of plans) {
            const i = plan.input;
            const c = i.capital;
            insert('recall_plan_versions', [...base, 'entity_id', 'state', 'plan_id', 'decision_id', 'parent_version_id', 'kind', 'direction', 'currency', 'price_basis', 'entry', 'initial_stop', 'size_input_mode', 'size_input_value', 'resolved_quantity', 'quantity_unit', 'capital_amount', 'capital_currency', 'capital_as_of', 'capital_source', 'capital_snapshot_ref', 'recorded_phase', 'source', 'recorded_at', 'knowledge_cursor', 'execution_cursor', 'has_seen_future', 'retained_at'], [...prefix, plan.id, state, plan.planId, plan.decisionId, plan.parentVersionId ?? null, plan.kind, i.direction, i.currency, i.priceBasis, i.entry, i.initialStop, i.sizeInputMode, i.sizeInputValue, i.resolvedQuantity, i.quantityUnit, c?.amount ?? null, c?.currency ?? null, c?.asOf ?? null, c?.source ?? null, c?.snapshotRef ?? null, plan.recordedPhase, plan.source, plan.recordedAt, plan.knowledgeCutoff.cursor, plan.knowledgeCutoff.executionCursor, plan.hasSeenFuture ? 1 : 0, (plan as RecallPlanVersion).retainedAt ?? null]);
            const budget = plan.riskBudget;
            database.prepare(`update recall_plan_versions set revision_reason=?,quantity_step=?,step_source=?,rounding=?,derived_unrounded_quantity=?,rounding_delta=?,budget_amount=?,budget_currency=?,budget_scope=?,budget_source_description=?,budget_evidence_reference=?,budget_provenance=?,budget_knowledge_cursor=?,budget_execution_cursor=? where episode_id=? and version_kind=? and entity_id=?`).run(plan.reason ?? null, i.sizing?.quantityStep ?? null, i.sizing?.stepSource ?? null, i.sizing?.rounding ?? null, i.sizing?.derivedUnroundedQuantity ?? null, i.sizing?.roundingDelta ?? null, budget?.amount ?? null, budget?.currency ?? null, budget?.scope ?? null, budget?.sourceDescription ?? null, budget?.evidenceReference ?? null, budget?.provenance ?? null, budget?.effectiveKnowledgeCutoff.cursor ?? null, budget?.effectiveKnowledgeCutoff.executionCursor ?? null, document.episodeId, versionKind, plan.id);
            for (const [ordinal, t] of i.targets.entries())
                insert('recall_plan_targets', [...base, 'plan_entity_id', 'entity_id', 'ordinal', 'price', 'quantity', 'ratio'], [...prefix, plan.id, t.id, ordinal, t.price, t.quantity, t.ratio]);
        }
    for (const b of document.plans?.riskBaselines ?? [])
        insert('recall_risk_baselines', [...base, 'entity_id', 'scope', 'decision_id', 'plan_version_id', 'amount', 'currency', 'method', 'method_version', 'frozen_at', 'corrects_baseline_id'], [...prefix, b.id, b.scope, b.decisionId ?? null, b.planVersionId, b.amount, b.currency, b.method, b.methodVersion, b.frozenAt, b.correctsBaselineId ?? null]);
    for (const b of document.retainedBundles ?? []) {
        insert('recall_retained_bundles', [...base, 'entity_id', 'snapshot_id', 'capture_revision', 'retained_at', 'evidence_digest', 'evidence_json', 'decisions_json', 'capture_phase', 'capture_cursor', 'capture_execution_cursor', 'capture_timeframe', 'capture_viewport_json', 'capture_has_seen_future'], [...prefix, b.id, b.snapshotId, b.documentRevision, b.retainedAt, b.executionEvidence.digest, JSON.stringify(b.executionEvidence), JSON.stringify(b.decisions), b.captureContext.phase ?? null, b.captureContext.cursor, b.captureContext.executionCursor, b.captureContext.timeframe, b.captureContext.viewport ? JSON.stringify(b.captureContext.viewport) : null, b.captureContext.hasSeenFuture === undefined ? null : b.captureContext.hasSeenFuture ? 1 : 0]);
        for (const id of b.planVersionIds)
            insert('recall_bundle_plans', [...base, 'bundle_id', 'plan_version_id'], [...prefix, b.id, id]);
        for (const id of b.riskBaselineIds)
            insert('recall_bundle_baselines', [...base, 'bundle_id', 'baseline_id'], [...prefix, b.id, id]);
    }
}
