import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeSqlite, withSqliteTransaction } from '../../../db/sqlite';
import { getSqliteStore } from '../storage/sqlite-store';
import { buildTradeEpisodes } from '../trades/episodes';
import type { TradeExecution } from '../trades/types';
import { createRecallDocument, retainRecallSnapshot } from './document';
import { freezeRecallSnapshotBundle } from './retained-bundles';
import { getRecallDocument, RecallConflictError, saveRecallDocument } from './server-repository';
import { rebuildRecallMetricProjections } from './metric-projections';

const databases: DatabaseSync[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
function fixture() {
    const db = new DatabaseSync(':memory:');
    databases.push(db); initializeSqlite(db);
    const fills: TradeExecution[] = [
        ['buy', 'buy', '1000', '56', '20', '2026-01-01'],
        ['exit-1', 'sell', '600', '64', '12', '2026-01-02'],
        ['exit-2', 'sell', '400', '61', '8', '2026-01-03'],
    ].map(([id, side, quantity, price, fee, executedAt]) => ({
        id, side: side as 'buy' | 'sell', quantity, price, fee, executedAt,
        accountId: 'account', accountLabel: 'Test', source: { platform: 'test', row: 0 },
        instrument: { id: 'US:TEST', symbol: 'TEST', name: 'Test', market: 'US', currency: 'USD' },
    }));
    getSqliteStore(db).mergeExecutions(fills);
    const episode = buildTradeEpisodes(getSqliteStore(db).getExecutions())[0];
    let document = createRecallDocument(episode);
    for (const decisionId of [...document.decisions.map(decision => decision.id), 'global']) {
        document = retainRecallSnapshot(document, {
            id: decisionId, decisionId, phase: 'post-review', timeframe: '1D', cursor: '2026-01-04', executionCursor: 'exit-2',
            candles: [], drawings: [], imageDataUrl: 'data:image/png;base64,AAAA', createdAt: '2026-01-04', updatedAt: '2026-01-04',
        });
    }
    document = freezeRecallSnapshotBundle(document, 'global', { bundleId: 'bundle', retainedAt: '2026-01-04', episode });
    return { db, document };
}
function metrics(db: DatabaseSync, kind = 'draft') {
    return db.prepare('select * from recall_actual_metrics where version_kind=? order by scope,scope_id,metric_key').all(kind);
}

describe('frozen actual metric projections', () => {
    it('persists exact whole and exit metrics with typed source, missing reason and references', () => {
        const { db, document } = fixture();
        // An older or malicious client cannot author the new financial result.
        Object.assign(document.retainedBundles![0], { actualMetrics: { methodVersion: 'forged', metrics: { netPnl: { value: '999999' } } } });
        const saved = saveRecallDocument(db, { document, expectedRevision: 0 });
        expect(db.prepare("select value,reason,currency,unit,method_version from recall_actual_metrics where scope='bundle' and metric_key='netPnl'").get())
            .toMatchObject({ value: '6760', reason: null, currency: 'USD', unit: 'money', method_version: 'actual-v1' });
        expect(db.prepare("select scope_id,value from recall_actual_metrics where scope='exit' and metric_key='netPnl' order by scope_id").all())
            .toEqual([{ scope_id: 'exit-1', value: '4776' }, { scope_id: 'exit-2', value: '1984' }]);
        expect(db.prepare("select value,reason from recall_actual_metrics where scope='bundle' and metric_key='actualR'").get())
            .toMatchObject({ value: null, reason: 'missing-initial-risk-baseline' });
        expect(db.prepare('select document_revision,capture_revision,status,method_version,evidence_digest from recall_actual_metric_sources').get())
            .toMatchObject({ document_revision: 1, capture_revision: 1, status: 'available', method_version: 'actual-v1', evidence_digest: saved.document.retainedBundles![0].executionEvidence.digest });
        expect(db.prepare("select ref_id from recall_actual_metric_refs where ref_kind='execution' order by ref_id").all())
            .toEqual([{ ref_id: 'buy' }, { ref_id: 'exit-1' }, { ref_id: 'exit-2' }]);
        expect(db.prepare('select quantity from recall_actual_metric_exits order by execution_id').all())
            .toEqual([{ quantity: '600' }, { quantity: '400' }]);
    });

    it('rebuilds frozen values after newer underlying trades change without recalculation', () => {
        const { db, document } = fixture();
        const saved = saveRecallDocument(db, { document, expectedRevision: 0 });
        const before = metrics(db);
        const fills = getSqliteStore(db).getExecutions(); fills[0].fee = '900';
        getSqliteStore(db).mergeExecutions(fills);
        db.exec('delete from recall_actual_metric_sources');
        withSqliteTransaction(db, () => rebuildRecallMetricProjections(db, saved.document, 'draft'));
        expect(metrics(db)).toEqual(before);
    });

    it('rolls back JSON and every metric partition on projection failure and stale CAS', () => {
        const { db, document } = fixture();
        const saved = saveRecallDocument(db, { document, expectedRevision: 0 });
        const before = metrics(db);
        db.exec("create trigger fail_metric before insert on recall_actual_metrics begin select raise(abort,'metric projection failed'); end");
        expect(() => saveRecallDocument(db, { document: saved.document, expectedRevision: 1 })).toThrow('metric projection failed');
        expect(getRecallDocument(db, document.episodeId)?.revision).toBe(1);
        expect(metrics(db)).toEqual(before);
        expect(() => saveRecallDocument(db, { document, expectedRevision: 0 })).toThrow(RecallConflictError);
        expect(metrics(db)).toEqual(before);
    });

    it('keeps formal metric projections and capture provenance frozen during draft autosave', () => {
        const { db, document } = fixture();
        const saved = saveRecallDocument(db, { document, expectedRevision: 0, finalize: true });
        const before = metrics(db, 'formal');
        const draft = structuredClone(saved.document); draft.working.cursor = '2026-01-02';
        saveRecallDocument(db, { document: draft, expectedRevision: 1 });
        expect(metrics(db, 'formal')).toEqual(before);
        expect(db.prepare("select document_revision,capture_revision from recall_actual_metric_sources where version_kind='draft'").get())
            .toMatchObject({ document_revision: 2, capture_revision: 1 });
        expect(getRecallDocument(db, document.episodeId)?.lastCompleted?.retainedBundles![0].actualMetrics)
            .toEqual(saved.document.retainedBundles![0].actualMetrics);
    });

    it('represents accepted legacy absence explicitly without backfilling financial history', () => {
        const { db, document } = fixture();
        const saved = saveRecallDocument(db, { document, expectedRevision: 0 });
        const legacy = structuredClone(saved.document); delete legacy.retainedBundles![0].actualMetrics;
        db.prepare('update recall_documents set draft_json=? where episode_id=?').run(JSON.stringify(legacy), legacy.episodeId);
        const resaved = saveRecallDocument(db, { document: legacy, expectedRevision: 1 });
        expect(resaved.document.retainedBundles![0].actualMetrics).toBeUndefined();
        expect(metrics(db)).toEqual([]);
        expect(db.prepare('select status,missing_reason,method_version from recall_actual_metric_sources').get())
            .toMatchObject({ status: 'legacy-absent', missing_reason: 'legacy-capture-without-actual-metrics', method_version: null });
    });

    it('rejects replacing an accepted server metric while leaving retained data unchanged', () => {
        const { db, document } = fixture();
        const saved = saveRecallDocument(db, { document, expectedRevision: 0 });
        const changed = structuredClone(saved.document);
        changed.retainedBundles![0].actualMetrics!.metrics.netPnl.value = '999999';
        expect(() => saveRecallDocument(db, { document: changed, expectedRevision: 1 })).toThrow(/immutable/);
        expect(getRecallDocument(db, document.episodeId)?.retainedBundles![0].actualMetrics!.metrics.netPnl.value).toBe('6760');
    });
});
