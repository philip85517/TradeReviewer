import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { RecallActualMetric } from './actual-metrics';
import type { RecallDocument } from './types';

/** Rebuild the selected partition from frozen documents, never from current trade/plan drafts.
 * Caller owns the enclosing transaction, including any preceding plan projection rebuild.
 */
export function rebuildRecallMetricProjections(database: DatabaseSync, document: RecallDocument, versionKind: 'draft' | 'formal'): void {
    database.prepare('delete from recall_actual_metric_sources where episode_id=? and version_kind=?').run(document.episodeId, versionKind);
    const base = ['episode_id', 'version_kind', 'document_revision', 'bundle_id'];
    const insert = (table: string, columns: string[], values: SQLInputValue[]) =>
        database.prepare(`insert into ${table} (${columns.join(',')}) values (${columns.map(() => '?').join(',')})`).run(...values);
    for (const bundle of document.retainedBundles ?? []) {
        const prefix: SQLInputValue[] = [document.episodeId, versionKind, document.revision, bundle.id];
        const result = bundle.actualMetrics;
        const denominator = result?.denominator;
        insert('recall_actual_metric_sources', [...base, 'status', 'missing_reason', 'method_version', 'capture_revision', 'evidence_digest', 'computed_at', 'source_bundle_id', 'risk_baseline_id', 'risk_plan_version_id', 'risk_amount', 'risk_currency', 'risk_scope', 'risk_method'],
            [...prefix, result ? 'available' : 'legacy-absent', result ? null : 'legacy-capture-without-actual-metrics', result?.methodVersion ?? null, result?.source.documentRevision ?? bundle.documentRevision, result?.source.evidenceDigest ?? bundle.executionEvidence.digest, result?.source.computedAt ?? null, result?.source.bundleId ?? null, denominator?.riskBaselineId ?? null, denominator?.planVersionId ?? null, denominator?.amount ?? null, denominator?.currency ?? null, denominator?.scope ?? null, denominator?.method ?? null]);
        if (!result) continue;
        const metric = (scope: 'bundle' | 'exit', scopeId: string, key: string, value: RecallActualMetric) =>
            insert('recall_actual_metrics', [...base, 'scope', 'scope_id', 'metric_key', 'value', 'reason', 'currency', 'unit', 'method_version'],
                [...prefix, scope, scopeId, key, value.value, value.reason, value.currency, value.unit, value.methodVersion]);
        for (const [key, value] of Object.entries(result.metrics)) metric('bundle', '', key, value);
        for (const [kind, ids] of [['execution', result.executionIds], ['plan', result.planVersionIds], ['risk', result.riskBaselineIds]] as const)
            for (const id of ids) insert('recall_actual_metric_refs', [...base, 'ref_kind', 'ref_id'], [...prefix, kind, id]);
        for (const exit of result.exitAllocations) {
            insert('recall_actual_metric_exits', [...base, 'execution_id', 'decision_id', 'quantity'], [...prefix, exit.executionId, exit.decisionId, exit.quantity]);
            for (const key of ['entryFee', 'exitFee', 'grossPnl', 'netPnl'] as const) metric('exit', exit.executionId, key, exit[key]);
        }
    }
}
