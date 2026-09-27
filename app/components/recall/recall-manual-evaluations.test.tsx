import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createRecallDocument } from '../../lib/recall/document';
import type { RecallDocument } from '../../lib/recall/types';
import type { TradeEpisode } from '../../lib/trades/types';
import { upsertRecallManualEvaluationDraft } from '../../lib/recall/manual-evaluations';
import { RecallManualEvaluations } from './recall-manual-evaluations';

const instrument = { id: 'I', symbol: 'I', name: 'I', market: 'US', currency: 'USD' };
const execution = { id: 'entry', source: { platform: 'test', row: 0 }, accountId: 'a', accountLabel: 'A', instrument, side: 'buy' as const, executedAt: '2026-01-01T00:00:00Z', quantity: '10', price: '10', fee: '0' };
const episode: TradeEpisode = { id: 'episode', accountId: 'a', accountLabel: 'A', instrument, direction: 'long', status: 'open', startedAt: execution.executedAt, openingQuantity: '10', remainingQuantity: '10', executions: [execution] };
const base = createRecallDocument(episode);
const props = { document: base, episode, phase: 'post-review' as const, target: { scope: 'episode' as const, decisionId: null }, knowledgeCutoff: { cursor: '2026-01-02T00:00:00Z', executionCursor: 'entry' }, hasSeenFuture: true, onChangeDocument: vi.fn() };
afterEach(cleanup);

it('only renders in post-review and writes the episode tags through onChangeDocument', () => {
  const onChangeDocument = vi.fn();
  const { rerender } = render(<RecallManualEvaluations {...props} onChangeDocument={onChangeDocument} phase="pre-entry" />);
  expect(screen.queryByRole('group', { name: /人工回合标签/ })).toBeNull();
  rerender(<RecallManualEvaluations {...props} onChangeDocument={onChangeDocument} />);
  expect(screen.getByRole('group', { name: /人工回合标签/ })).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('仓位'));
  expect(onChangeDocument).toHaveBeenCalledWith(expect.objectContaining({ manualEvaluations: expect.objectContaining({ drafts: [expect.objectContaining({ target: props.target, tags: ['position'] })] }) }));
  expect(screen.queryByLabelText('退出')).toBeNull();
});

it('reads only selected immutable bundle revisions and shows explicit historical absence', () => {
  const version = { id: 'bundle:manual:old', evaluationId: 'old', target: props.target, tags: ['analysis' as const], tagDictionaryVersion: 'manual-v1' as const, evidence: [{ kind: 'snapshot' as const, snapshotId: 'missing-snapshot' }], source: 'manual-retrospective' as const, recordedBy: 'user' as const, recordedPhase: 'post-review' as const, recordedAt: '2026-01-01', knowledgeCutoff: props.knowledgeCutoff, hasSeenFuture: true, retainedAt: '2026-01-02', executionIds: ['entry'] };
  const retained = { ...base, manualEvaluations: { drafts: [], versions: [version], associations: [{ evaluationId: 'old', decisionId: null, status: 'linked' as const }] } } satisfies RecallDocument;
  render(<RecallManualEvaluations {...props} document={retained} readOnly manualEvaluationRevisionIds={[version.id]} />);
  expect(screen.getByLabelText('判断')).toBeChecked();
  expect(screen.getByText(/快照 missing-snapshot/)).toBeInTheDocument();
  expect(screen.queryByText(/manual-v1/)).toBeNull();
  cleanup();
  render(<RecallManualEvaluations {...props} document={base} readOnly manualEvaluationRevisionIds={[]} />);
  expect(screen.getByText('此留存未记录回合人工标签')).toBeInTheDocument();
});

it('shows an explicit confirmation action when the current episode execution set changed', () => {
  const onChangeDocument = vi.fn();
  const withDraft = upsertRecallManualEvaluationDraft(base, {
    id: 'manual-draft', evaluationId: 'manual-evaluation', target: props.target, tags: ['analysis'], tagDictionaryVersion: 'manual-v1', evidence: [],
    source: 'manual-retrospective', recordedBy: 'user', recordedPhase: 'post-review', recordedAt: '2026-01-02', knowledgeCutoff: props.knowledgeCutoff, hasSeenFuture: true,
  });
  withDraft.manualEvaluations!.associations[0].status = 'needs-confirmation';
  render(<RecallManualEvaluations {...props} document={withDraft} onChangeDocument={onChangeDocument} />);
  expect(screen.getByText(/成交集合已变化/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '确认使用当前回合成交' }));
  expect(onChangeDocument).toHaveBeenCalledWith(expect.objectContaining({ manualEvaluations: expect.objectContaining({ associations: [expect.objectContaining({ status: 'linked', executionIds: ['entry'] })] }) }));
});
