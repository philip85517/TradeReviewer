import { describe, expect, it } from 'vitest';
import { createRecallDocument } from './document';
import { confirmRecallRetainedState, freezeRecallSnapshotBundle } from './retained-bundles';
import { retainRecallActualMetrics } from './metric-retention';
import { replayPositionAtPrice } from '../replay/position-ledger';
import { NO_REVEALED_EXECUTIONS } from '../replay/recall-replay';
import type { TradeEpisode } from '../trades/types';
import type { RecallPhase } from './types';
import { readRecallViewSource, recallSnapshotUpdateAuthority } from './view-source';

function fixture(phase: RecallPhase = 'holding') {
  const instrument = { id: 'CN-SH:600199', symbol: '600199', name: 'name', market: 'CN', currency: 'CNY' };
  const common = { accountId: 'a', accountLabel: 'A', instrument, source: { platform: 'test', row: 1 } };
  const episode: TradeEpisode = {
    id: 'episode', accountId: 'a', accountLabel: 'A', instrument, direction: 'long', status: 'open',
    startedAt: '2026-10-20T02:00:00Z', openingQuantity: '2', remainingQuantity: '1',
    executions: [
      { ...common, id: 'buy', side: 'buy', quantity: '2', price: '100', fee: '1', executedAt: '2026-10-20T02:00:00Z' },
      { ...common, id: 'sell', side: 'sell', quantity: '1', price: '120', fee: 'invalid', executedAt: '2026-10-21T02:00:00Z' },
    ],
  };
  let document = createRecallDocument(episode, '2026-10-22T00:00:00Z');
  document.snapshots = [{
    id: 'snapshot', decisionId: 'sell', phase, timeframe: '1D', cursor: '2026-10-21T07:00:00Z',
    executionCursor: phase === 'pre-entry' ? NO_REVEALED_EXECUTIONS : 'sell', priceBasis: 'raw',
    candles: [{ time: '2026-10-21T00:00:00Z', knowledgeAt: '2026-10-21T07:00:00Z', open: 100, high: 120, low: 90, close: 110, volume: 1 }],
    drawings: [], viewport: { version: 1, logicalRange: null, barSpacing: 6, rightOffset: 0, width: 600, height: 400 },
    imageDataUrl: 'data:image/png;base64,AA==', createdAt: '2026-10-22T00:00:00Z', updatedAt: '2026-10-22T00:00:00Z',
  }];
  document = freezeRecallSnapshotBundle(document, 'snapshot', { bundleId: 'old', retainedAt: '2026-10-22T00:00:00Z', episode });
  confirmRecallRetainedState(undefined, document, episode, 6);
  retainRecallActualMetrics(undefined, document);
  document.revision = 6;
  return { episode, document };
}

describe('one Recall viewing authority', () => {
  it('RS01/02 keeps frozen unknown fees and full gross separate from current full net and Actual realized net', () => {
    const { episode: old, document } = fixture();
    const bytes = JSON.stringify(document);
    const current = structuredClone(old);
    current.executions[1].fee = '2';
    const source = readRecallViewSource({ episode: current, document, snapshotId: 'snapshot' });
    expect(source.kind).toBe('retained');
    const position = replayPositionAtPrice({ executions: source.executions, markPrice: '110' });
    expect(position).toMatchObject({ quantity: '1', averageCost: '100', realizedPnl: '20', unrealizedPnl: '10', fees: null, netPnl: null });
    expect(source.actualMetrics?.metrics.realizedNet).toMatchObject({ value: null, reason: 'unknown-fees' });
    expect(source.actualMetrics?.metrics.netPnl).toMatchObject({ value: null, reason: 'episode-open' });
    const working = readRecallViewSource({ episode: current, document, working: { phase: 'holding', cursor: '2026-10-21T07:00:00Z', executionCursor: 'sell', candles: document.snapshots[0].candles, mode: 'replay' } });
    expect(replayPositionAtPrice({ executions: working.executions, markPrice: '110' })).toMatchObject({ netPnl: '27', fees: '3' });
    expect(JSON.stringify(document)).toBe(bytes);
    expect(old.executions[1].fee).toBe('invalid');
  });

  it('RS03 binds markers, identity, currency and decisions to retained raw even after same-ID corrections', () => {
    const { episode, document } = fixture();
    const current = structuredClone(episode);
    Object.assign(current.executions[0], { quantity: '90', price: '999', executedAt: '2026-10-23T02:00:00Z' });
    current.instrument.currency = 'USD';
    document.decisions.reverse();
    const source = readRecallViewSource({ episode: current, document, snapshotId: 'snapshot' });
    expect(source.executions.map(e => [e.id, e.quantity, e.price, e.executedAt])).toEqual([
      ['buy', '2', '100', '2026-10-20T02:00:00Z'], ['sell', '1', '120', '2026-10-21T02:00:00Z'],
    ]);
    expect(source.episode?.instrument.currency).toBe('CNY');
    expect(source.decisions.map(d => d.id)).toEqual(['buy', 'sell']);
    expect(source.context).toMatchObject({ phase: 'holding', cursor: '2026-10-21T07:00:00Z', executionCursor: 'sell', priceBasis: 'raw' });
  });

  it.each(['pre-entry', 'holding', 'post-review'] as const)('RS04 preserves %s and the independent execution cutoff', phase => {
    const { episode, document } = fixture(phase);
    const source = readRecallViewSource({ episode, document, snapshotId: 'snapshot' });
    expect(source.context.phase).toBe(phase);
    expect(source.candles.map(c => c.close)).toEqual([110]);
    expect(source.executions.map(e => e.id)).toEqual(phase === 'pre-entry' ? [] : ['buy', 'sell']);
  });

  it.each(['missing', 'snapshot', 'digest', 'revision', 'actual-source'] as const)('RS05 refuses unverifiable %s rather than borrowing current financial inputs', failure => {
    const { episode, document } = fixture();
    if (failure === 'missing') delete document.snapshots[0].retainedBundleId;
    if (failure === 'snapshot') document.snapshots[0].cursor = '2026-10-23T07:00:00Z';
    if (failure === 'digest') document.retainedBundles![0].executionEvidence.payload.executions[1].fee = '2';
    if (failure === 'revision') document.retainedBundles![0].documentRevision = -1;
    if (failure === 'actual-source') document.retainedBundles![0].actualMetrics!.source.evidenceDigest = 'different';
    const source = readRecallViewSource({ episode, document, snapshotId: 'snapshot' });
    expect(source.kind).toBe('legacy-unavailable');
    expect(source.episode).toBeNull();
    expect(source.executions).toEqual([]);
    expect(source.actualMetrics).toBeNull();
    expect(document.snapshots[0].imageDataUrl).toBe('data:image/png;base64,AA==');
    expect(() => recallSnapshotUpdateAuthority({ episode, document, snapshotId: 'snapshot' })).toThrow(/成交或决策已变更/);
  });

  it('RS05 does not backfill absent legacy Actual while preserving provable financial evidence', () => {
    const { episode, document } = fixture();
    delete document.retainedBundles![0].actualMetrics;
    const source = readRecallViewSource({ episode, document, snapshotId: 'snapshot' });
    expect(source.kind).toBe('retained');
    expect(source.executions[1].fee).toBe('invalid');
    expect(source.actualMetrics).toBeNull();
  });

  it.each(['fee', 'decisions', 'bundle'] as const)('RS06 detects %s authority changes across a capture barrier', change => {
    const { episode, document } = fixture();
    const authority = recallSnapshotUpdateAuthority({ episode, document, snapshotId: 'snapshot' });
    if (change === 'fee') episode.executions[1].fee = '2';
    if (change === 'decisions') document.decisions.reverse();
    if (change === 'bundle') document.retainedBundles![0].documentRevision += 1;
    expect(() => recallSnapshotUpdateAuthority({ episode, document, snapshotId: 'snapshot', expectedAuthority: authority })).toThrow(/成交或决策已变更/);
  });

  it('RS04/06 filters corrected current facts at both preserved cutoffs when returning from a snapshot', () => {
    const { episode, document } = fixture();
    episode.executions[1].fee = '2';
    const working = { phase: 'holding' as const, cursor: '2026-10-21T07:00:00Z', executionCursor: 'sell', candles: document.snapshots[0].candles, mode: 'replay' as const };
    expect(replayPositionAtPrice({ executions: readRecallViewSource({ episode, document, working }).executions, markPrice: '110' }).netPnl).toBe('27');
    Object.assign(episode.executions[1], { quantity: '0.5', price: '999', executedAt: '2026-10-22T02:00:00Z' });
    const returned = readRecallViewSource({ episode, document, working });
    expect(returned.executions.map(fill => fill.id)).toEqual(['buy']);
    expect(replayPositionAtPrice({ executions: returned.executions, markPrice: '110' })).toMatchObject({ quantity: '2', averageCost: '100', fees: '1', netPnl: '19' });
    expect(readRecallViewSource({ episode, document, snapshotId: 'snapshot' }).executions[1]).toMatchObject({ quantity: '1', price: '120', fee: 'invalid' });
    expect(readRecallViewSource({ episode, document, working: { ...working, mode: 'history' } }).executions.map(fill => fill.id)).toEqual(['buy', 'sell']);
  });
});
