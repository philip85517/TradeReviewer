import { buildInstrumentTradeSummaries } from "../trades/instruments";
import { applyMonthlyHistoryEvidence, selectMonthlyEvidenceHistory } from "../import/statement-evidence";
import { createRecallDocument } from "../recall/document";
import { saveRecallDocument } from "../recall/server-repository";
import { LIBRARY_ACCOUNT_DIRECTORY_SQL } from "../../../db/library-scope-schema";
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it, vi } from 'vitest';
import { openSqliteDatabase } from '../../../db/sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStore } from './sqlite-store';
import { buildTradeEpisodes } from '../trades/episodes';
import { createEmptyEpisodeReviewRecord } from '../reviews/review-metrics';
import type { TradeExecution } from '../trades/types';
const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0))
        rmSync(d, {
            recursive: true, force: true
        });
});
function fixture() {
    const d = mkdtempSync(join(tmpdir(), 'library-scope-'));
    dirs.push(d);
    const db = openSqliteDatabase(join(d, 'test.sqlite'));
    return {
        db, store: new SqliteStore(db)
    };
}
const execution: TradeExecution = {
    id: 'e1', accountId: 'a', accountLabel: '主账户', instrument: {
        id: 'HK:700', market: 'HK', symbol: '00700', name: '腾讯', currency: 'HKD'
    }, side: 'buy', quantity: '10', price: '100', fee: '1', executedAt: '2026-01-02T03:00:00.000Z', source: {
        platform: 'futu', row: 1, tradeNature: 'live'
    }
};
it('reads the complete target history and related evidence/reviews without full-library methods', () => {
    const { db, store } = fixture();
    const es = [execution, {
            ...execution, id: 'e2', side: 'sell' as const, executedAt: '2026-02-02T03:00:00.000Z'
        }, {
            ...execution, id: 'other-account', accountId: 'b', accountLabel: '另一账户'
        }, {
            ...execution, id: 'other-stock', instrument: {
                ...execution.instrument, id: 'HK:9988', symbol: '9988'
            }
        }];
    store.mergeExecutions(es);
    const episodes = buildTradeEpisodes(es), target = episodes.find(e => e.accountId === 'a' && e.instrument.id === 'HK:700')!;
    store.putReview(createEmptyEpisodeReviewRecord(target.id, 'HK:700'));
    const other = episodes.find(e => e.accountId === 'b')!;
    store.putReview(createEmptyEpisodeReviewRecord(other.id, 'HK:700'));
    const entry = {
        id: 'monthly', fileName: 'monthly.pdf', sourceLabel: '富途', importedAt: '2026-02-03T00:00:00Z', tradeCount: 0, instrumentCount: 2, excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 0, unresolvedInstrumentCount: 0, monthly: {
            documentId: 'monthly', accountId: 'a', templateIds: [], positions: [], reviewRequired: false, events: [{
                    id: 'ipo', accountId: 'a', market: 'HK', symbol: '00700', date: '2026-01-01', kind: 'ipo', quantity: '10', description: 'allocation', source: []
                }, {
                    id: 'cancel', accountId: 'a', market: 'HK', symbol: '00700', date: '2026-01-01', kind: 'corporate-action', ipoAction: 'ipo-cancellation', reversesEventId: 'ipo', quantity: '-10', description: 'cancel', source: []
                }]
        }
    };
    db.prepare('INSERT INTO import_batches(id,imported_at,reconciliation_json)VALUES(?,?,?)').run(entry.id, entry.importedAt, JSON.stringify(entry));
    const full = store.getBootstrap();
    vi.spyOn(store, 'getBootstrap').mockImplementation(() => {
        throw Error('full forbidden');
    });
    vi.spyOn(store, 'getExecutions').mockImplementation(() => {
        throw Error('all executions forbidden');
    });
    vi.spyOn(store, 'getImportHistory').mockImplementation(() => {
        throw Error('all imports forbidden');
    });
    vi.spyOn(store, 'getReviews').mockImplementation(() => {
        throw Error('all reviews forbidden');
    });
    const result = store.getLibraryScope({
        accountId: 'a', instrumentId: 'HK:700'
    });
    expect(result.scope).toEqual({
        accountId: 'a', instrumentId: 'HK:700'
    });
    expect(result.bootstrap.executions).toEqual(full.executions.filter(e => e.accountId === 'a' && e.instrument.id === 'HK:700'));
    expect(result.bootstrap.importHistory).toEqual([entry]);
    expect(result.bootstrap.reviews).toEqual([full.reviews.find(r => r.episodeId === target.id)]);
    expect(result.bootstrap.instruments.map(i => i.id)).toEqual(['HK:700']);
    expect(result.accountDirectory.map(a => a.id)).toEqual(['a', 'b']);
    expect(result.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(db.isTransaction).toBe(false);
    db.close();
});
it('rejects empty, noncanonical and nonexistent scopes rather than broadening a read', () => {
    const { db, store } = fixture();
    store.mergeExecutions([execution]);
    for (const scope of [{
            accountId: '', instrumentId: 'HK:700'
        }, {
            accountId: 'all', instrumentId: 'HK:700'
        }, {
            accountId: 'a', instrumentId: ''
        }, {
            accountId: 'a', instrumentId: 'HK:00700'
        }, {
            accountId: 'no-account', instrumentId: 'HK:700'
        }, {
            accountId: 'a', instrumentId: 'US:NOPE'
        }])
        expect(() => store.getLibraryScope(scope)).toThrow();
    expect(db.isTransaction).toBe(false);
    db.close();
});

it('keeps settings and trades in one read snapshot during a concurrent commit', () => {
  const { db, store } = fixture();
  store.mergeExecutions([execution]);
  store.putSettings({ scopeMarker: 'before' });
  const location = db.prepare('pragma database_list').get() as { file: string };
  const writer = new DatabaseSync(location.file);
  const readSettings = store.getSettings.bind(store);
  vi.spyOn(store, 'getSettings').mockImplementation(() => {
    writer.prepare("update app_settings set value_json=? where key='scopeMarker'").run(JSON.stringify('after'));
    return readSettings();
  });
  const result = store.getLibraryScope({ accountId: 'a', instrumentId: 'HK:700' });
  expect(result.bootstrap.settings.scopeMarker).toBe('before');
  expect(readSettings().scopeMarker).toBe('after');
  expect(db.isTransaction).toBe(false);
  writer.close();
  db.close();
});

it('uses the directory index while preserving mixed labels and trade natures', () => {
  const { db, store } = fixture();
  store.mergeExecutions([
    execution,
    { ...execution, id: 'simulation', accountLabel: '其他标签', source: { platform: 'tradingview', row: 2, tradeNature: 'simulation', simulationRunId: 'run', simulationTradeId: '2', simulationRole: 'entry', timePrecision: 'date-only', sourceTimezone: 'Asia/Shanghai' } },
  ]);
  const result = store.getLibraryScope({ accountId: 'a', instrumentId: 'HK:700' });
  expect(result.accountDirectory[0].natures.sort()).toEqual(['live', 'simulation']);
  const query = LIBRARY_ACCOUNT_DIRECTORY_SQL;
  const plan = db.prepare('explain query plan ' + query).all();
  expect(JSON.stringify(plan)).toContain('COVERING INDEX executions_library_account_directory');
  db.close();
});

it('returns only target Recall drafts and bridges the same formal completion as full reads', () => {
  const { db, store } = fixture();
  store.mergeExecutions([execution, { ...execution, id: 'other-recall', accountId: 'b' }]);
  const episodes = buildTradeEpisodes(store.getExecutions());
  for (const episode of episodes) {
    const document = createRecallDocument(episode, '2026-02-01T00:00:00.000Z');
    saveRecallDocument(db, { document, expectedRevision: 0 });
    // This read bridge consumes only the existing immutable completion marker.
    db.prepare('update recall_documents set finalized_json=? where episode_id=?')
      .run(JSON.stringify({ status: 'completed', completedAt: '2026-02-02T00:00:00.000Z' }), episode.id);
  }
  const full = store.getBootstrap();
  const result = store.getLibraryScope({ accountId: 'a', instrumentId: 'HK:700' });
  const id = episodes.find(e => e.accountId === 'a')!.id;
  expect(result.recallSummaries.map(s => s.episodeId)).toEqual([id]);
  expect(result.bootstrap.reviews).toEqual(full.reviews.filter(r => r.episodeId === id));
  expect(result.bootstrap.reviews[0].review.completed).toBe(true);
  db.close();
});

it('retains persisted reviews and Recall drafts for statement-generated effective episodes', () => {
  const { db, store } = fixture();
  store.mergeExecutions([{ ...execution, side: 'sell', executedAt: '2026-02-02T03:00:00.000Z' }]);
  const entry = {
    id: 'ipo-monthly', fileName: 'ipo.pdf', sourceLabel: '富途', importedAt: '2026-02-03T00:00:00Z',
    tradeCount: 0, instrumentCount: 1, excludedInstrumentCount: 0, excludedRecordCount: 0,
    duplicateTradeCount: 0, unresolvedInstrumentCount: 0,
    monthly: { documentId: 'ipo-monthly', accountId: 'a', templateIds: [], positions: [], reviewRequired: false,
      events: [{ id: 'ipo-allocation', accountId: 'a', market: 'HK', symbol: '00700', date: '2026-01-01',
        kind: 'ipo', quantity: '10', amount: '-900', currency: 'HKD', description: 'IPO allocation', source: [] }] },
  };
  db.prepare('insert into import_batches(id,imported_at,reconciliation_json) values(?,?,?)')
    .run(entry.id, entry.importedAt, JSON.stringify(entry));
  const full = store.getBootstrap();
  const effective = applyMonthlyHistoryEvidence(full.executions, selectMonthlyEvidenceHistory(full.importHistory));
  const episode = buildTradeEpisodes(effective)[0];
  expect(episode.id).not.toBe(buildTradeEpisodes(full.executions)[0].id);
  store.putReview(createEmptyEpisodeReviewRecord(episode.id, 'HK:700'));
  saveRecallDocument(db, { document: createRecallDocument(episode, '2026-02-03T12:00:00.000Z'), expectedRevision: 0 });
  const before = db.prepare('select review_json from reviews').all();
  const result = store.getLibraryScope({ accountId: 'a', instrumentId: 'HK:700' });
  expect(result.bootstrap.reviews).toEqual(store.getBootstrap().reviews);
  expect(result.bootstrap.reviews[0].review.completed).toBe(false);
  expect(result.recallSummaries.map(r => r.episodeId)).toEqual([episode.id]);
  expect(db.prepare('select review_json from reviews').all()).toEqual(before);
  db.close();
});

it('keeps historical FB review identity while existing display rules name Meta', () => {
  const { db, store } = fixture();
  const oldTrade = { ...execution, id: 'old-fb', executedAt: '2020-01-02T15:00:00.000Z', instrument: { id: 'US:FB', market: 'US', symbol: 'FB', name: 'Facebook', currency: 'USD' } };
  store.mergeExecutions([oldTrade]);
  const episode = buildTradeEpisodes(store.getExecutions())[0];
  store.putReview(createEmptyEpisodeReviewRecord(episode.id, 'US:FB'));
  const result = store.getLibraryScope({ accountId: 'a', instrumentId: 'US:FB' });
  expect(result.bootstrap.reviews).toEqual(store.getBootstrap().reviews);
  expect(result.bootstrap.reviews[0].episodeId).toBe(episode.id);
  expect(buildInstrumentTradeSummaries(result.bootstrap.executions)[0].instrument.name).toContain('historical FB');
  db.close();
});
