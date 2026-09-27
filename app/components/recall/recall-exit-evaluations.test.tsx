import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { RecallExitEvaluations } from './recall-exit-evaluations';
import { createRecallDocument, mergeRecallDecisions } from '../../lib/recall/document';
import type { TradeEpisode } from '../../lib/trades/types';
import { reconcileRecallExitEvaluationAssociations, upsertRecallExitEvaluationDraft, type RecallExitEvaluationDraft } from '../../lib/recall/exit-evaluations';

const instrument = { id: 'I', symbol: 'I', name: 'I', market: 'US', currency: 'USD' };
const episode: TradeEpisode = {
  id: 'episode', accountId: 'a', accountLabel: 'A', instrument, direction: 'long', status: 'closed', startedAt: '2026-01-01', openingQuantity: '10', remainingQuantity: '0',
  executions: [
    { id: 'a', source: { platform: 'test', row: 1 }, accountId: 'a', accountLabel: 'A', instrument, side: 'sell', executedAt: '2026-01-02', quantity: '3', price: '11', fee: '0' },
    { id: 'b', source: { platform: 'test', row: 2 }, accountId: 'a', accountLabel: 'A', instrument, side: 'sell', executedAt: '2026-01-03', quantity: '7', price: '12', fee: '0' },
  ],
};
const props = { document: createRecallDocument(episode), episode, phase: 'post-review' as const, knowledgeCutoff: { cursor: '2026-01-04', executionCursor: 'b' }, hasSeenFuture: true, onChangeDocument: vi.fn() };
afterEach(cleanup);

function earlyGroup() {
  return within(screen.getByRole('group', { name: '提前退出' }));
}

it('is absent before post-review and keeps real quantity readonly', () => {
  const { rerender } = render(<RecallExitEvaluations {...props} phase="holding" />);
  expect(screen.queryByRole('group', { name: '提前退出' })).not.toBeInTheDocument();
  rerender(<RecallExitEvaluations {...props} />);
  expect(screen.getByText(/实际退出数量：3/)).toBeInTheDocument();
  expect(earlyGroup().getByRole('radio', { name: '未评价' })).toBeChecked();
  expect(screen.getByLabelText('比较计划版本')).toHaveValue('');
});

it('identifies each exit with date, reduce-or-close action, quantity, and weighted price', () => {
  render(<RecallExitEvaluations {...props} />);
  expect(screen.getByRole('option', { name: /2026-01-02.*减仓.*3.*均价 11/ })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /2026-01-03.*清仓.*7.*均价 12/ })).toBeInTheDocument();
});

it('switches two exits independently and preserves invalid other reason locally', () => {
  const onChange = vi.fn();
  render(<RecallExitEvaluations {...props} onChangeDocument={onChange} />);
  fireEvent.click(earlyGroup().getByRole('radio', { name: '是' }));
  fireEvent.change(screen.getByLabelText('退出决策'), { target: { value: 'b' } });
  expect(earlyGroup().getByRole('radio', { name: '未评价' })).toBeChecked();
  fireEvent.click(earlyGroup().getByRole('radio', { name: '不确定' }));
  fireEvent.change(screen.getByLabelText('退出决策'), { target: { value: 'a' } });
  expect(earlyGroup().getByRole('radio', { name: '是' })).toBeChecked();
  const calls = onChange.mock.calls.length;
  fireEvent.change(screen.getByLabelText('退出原因'), { target: { value: 'other' } });
  expect(screen.getByRole('alert')).toHaveTextContent('说明');
  expect(onChange).toHaveBeenCalledTimes(calls);
  fireEvent.change(screen.getByLabelText('其他原因说明'), { target: { value: '主动保护' } });
  expect(onChange).toHaveBeenCalledTimes(calls + 1);
});

it('keeps historical absence explicit instead of filling from current drafts', () => {
  render(<RecallExitEvaluations {...props} readOnly evaluationRevisionIds={[]} />);
  expect(screen.getByText('此留存未记录退出评价')).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: '提前退出' })).not.toBeInTheDocument();
});

it('reports invalid local input to parent capture guard and clears guard on unmount', () => {
  const onValidationChange = vi.fn();
  const { unmount } = render(<RecallExitEvaluations {...props} onValidationChange={onValidationChange} />);
  fireEvent.change(screen.getByLabelText('退出原因'), { target: { value: 'other' } });
  expect(onValidationChange).toHaveBeenLastCalledWith(expect.stringContaining('说明'));
  fireEvent.change(screen.getByLabelText('退出决策'), { target: { value: 'b' } });
  expect(onValidationChange).toHaveBeenLastCalledWith(expect.stringContaining('说明'));
  fireEvent.change(screen.getByLabelText('退出决策'), { target: { value: 'a' } });
  fireEvent.change(screen.getByLabelText('其他原因说明'), { target: { value: '说明' } });
  expect(onValidationChange).toHaveBeenLastCalledWith(null);
  unmount();
  expect(onValidationChange).toHaveBeenLastCalledWith(null);
});

it('offers actionable current evaluation selection after merging two rated exits', () => {
  const make = (id: string, earlyExit: 'yes' | 'no'): RecallExitEvaluationDraft => ({
    id: `d-${id}`, evaluationId: `e-${id}`, decisionId: id, earlyExit, adherence: null, reason: null, reasonDetail: null, comparedPlanVersionId: null, comparedTargetId: null, tags: [], tagDictionaryVersion: 'manual-v1', evidence: [], source: 'manual-retrospective', recordedBy: 'user', recordedPhase: 'post-review', recordedAt: '2026-01-04', knowledgeCutoff: props.knowledgeCutoff, hasSeenFuture: true,
  });
  let initial = upsertRecallExitEvaluationDraft(props.document, make('a', 'yes'));
  initial = upsertRecallExitEvaluationDraft(initial, make('b', 'no'));
  initial = reconcileRecallExitEvaluationAssociations(mergeRecallDecisions(initial, ['a', 'b'], 'a'));
  function Harness() {
    const [document, setDocument] = useState(initial);
    return <RecallExitEvaluations {...props} document={document} onChangeDocument={setDocument} />;
  }
  render(<Harness />);
  expect(earlyGroup().getByRole('radio', { name: '未评价' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('当前采用的退出评价'), { target: { value: 'e-b' } });
  expect(earlyGroup().getByRole('radio', { name: '否' })).toBeEnabled();
  expect(earlyGroup().getByRole('radio', { name: '否' })).toBeChecked();
  expect(screen.getByText(/已评价 1\/1/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('当前采用的退出评价'), { target: { value: 'e-a' } });
  expect(earlyGroup().getByRole('radio', { name: '是' })).toBeChecked();
});
