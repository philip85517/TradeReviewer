import type { Candle } from '../market/types';
import type { TradeEpisode } from '../trades/types';
import { orderedRecallExecutions, revealableCandlesThroughCursor, visibleRecallExecutions } from '../replay/recall-replay';
import { canonicalRecallJson, captureRecallExecutionEvidence, validateRecallRetainedState } from './retained-bundles';
import type { RecallDocument, RecallPhase, RecallRetainedBundle, RecallSnapshot } from './types';

type WorkingView = {
  phase: RecallPhase;
  cursor: string;
  executionCursor: string;
  candles: Candle[];
  mode: 'history' | 'replay';
};
type Input = { document: RecallDocument; episode: TradeEpisode } & (
  { snapshotId: string; working?: never } | { snapshotId?: never; working: WorkingView }
);
type ViewSource = {
  kind: 'working' | 'retained' | 'legacy-unavailable';
  episode: TradeEpisode | null;
  allExecutions: TradeEpisode['executions'];
  executions: TradeEpisode['executions'];
  decisions: RecallDocument['decisions'];
  context: Pick<RecallSnapshot, 'cursor' | 'executionCursor' | 'priceBasis'> & { phase: RecallPhase };
  candles: Candle[];
  bundle: RecallRetainedBundle | null;
  actualMetrics: NonNullable<RecallRetainedBundle['actualMetrics']> | null;
};

/** Select one financial authority for every structured view of a chart.
 * Current display names never replace the identity or financial fields in a capture.
 * Binding rules remain owned by the existing retained-state validator.
 */
export function readRecallViewSource(input: Input): ViewSource {
  const { document, episode } = input;
  if (input.working) return {
    kind: 'working', episode, allExecutions: episode.executions,
    executions: input.working.mode === 'history' ? orderedRecallExecutions(episode.executions) : visibleRecallExecutions(episode.executions, input.working.executionCursor, input.working.cursor), decisions: document.decisions,
    context: { phase: input.working.phase, cursor: input.working.cursor, executionCursor: input.working.executionCursor, priceBasis: 'raw' },
    candles: input.working.candles, bundle: null, actualMetrics: null,
  };
  const snapshot = document.snapshots.find(item => item.id === input.snapshotId);
  const context = { phase: snapshot?.phase ?? 'holding', cursor: snapshot?.cursor ?? '', executionCursor: snapshot?.executionCursor ?? '', priceBasis: snapshot?.priceBasis };
  const unavailable: ViewSource = {
    kind: 'legacy-unavailable', episode: null, allExecutions: [], executions: [], decisions: [], context,
    candles: snapshot ? revealableCandlesThroughCursor(snapshot.candles, snapshot.cursor) : [],
    bundle: null, actualMetrics: null,
  };
  const bundle = document.retainedBundles?.find(item => item.id === snapshot?.retainedBundleId && item.snapshotId === snapshot?.id);
  if (!snapshot || !bundle) return unavailable;
  try {
    validateRecallRetainedState(document);
  } catch {
    return unavailable;
  }
  const actual = bundle.actualMetrics;
  if (actual && (actual.source.bundleId !== bundle.id
    || actual.source.documentRevision !== bundle.documentRevision
    || actual.source.evidenceDigest !== bundle.executionEvidence.digest)) return unavailable;
  const payload = bundle.executionEvidence.payload;
  const retainedEpisode: TradeEpisode = {
    ...payload.episode, accountLabel: '',
    instrument: { ...payload.episode.instrument, name: payload.episode.instrument.symbol },
    executions: payload.executions.map(execution => ({ ...execution, accountLabel: '', instrument: { ...execution.instrument, name: execution.instrument.symbol } })),
  };
  return {
    kind: 'retained', episode: retainedEpisode, allExecutions: retainedEpisode.executions,
    executions: visibleRecallExecutions(retainedEpisode.executions, bundle.captureContext.executionCursor, bundle.captureContext.cursor),
    decisions: bundle.decisions,
    context: { phase: bundle.captureContext.phase ?? 'holding', cursor: bundle.captureContext.cursor, executionCursor: bundle.captureContext.executionCursor, priceBasis: bundle.captureContext.priceBasis },
    candles: revealableCandlesThroughCursor(snapshot.candles, bundle.captureContext.cursor),
    bundle, actualMetrics: actual ?? null,
  };
}

/** New capture bundles must still be attestable by today's server authority.
 * The returned token binds the source across the asynchronous image capture.
 */
export function recallSnapshotUpdateAuthority(input: {
  document: RecallDocument; episode: TradeEpisode; snapshotId: string; expectedAuthority?: string;
}): string {
  const source = readRecallViewSource(input);
  const reject = () => { throw new Error('成交或决策已变更，请返回工作图重新留存'); };
  if (!source.bundle) return reject();
  const currentEvidence = captureRecallExecutionEvidence(input.episode);
  if (canonicalRecallJson(currentEvidence) !== canonicalRecallJson(source.bundle.executionEvidence)
    || canonicalRecallJson(input.document.decisions) !== canonicalRecallJson(source.decisions)) return reject();
  const authority = canonicalRecallJson(source.bundle);
  if (input.expectedAuthority !== undefined && input.expectedAuthority !== authority) return reject();
  return authority;
}
