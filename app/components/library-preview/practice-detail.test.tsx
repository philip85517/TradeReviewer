import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PracticeDetailView } from './practice-detail';
import { createMockReadPort } from '../../lib/library-preview/mock-read-port';

const load = (scenario: 'reference' | 'pagination' | 'extreme' = 'reference', practiceId = 'A') => createMockReadPort(scenario).readPracticeDetail({ practiceId }, { signal: new AbortController().signal });
const callbacks = () => ({ onBack: vi.fn(), onPairPage: vi.fn(), onRetry: vi.fn() });
afterEach(cleanup);

describe('practice detail', () => {
  it('retains pair rows through pending and error and retries the failed request', async () => {
    const detail = await load('pagination', 'P1'); const retry = vi.fn();
    const props = { detail, pairs: detail.pairs, status: 'ready' as const, error: '', ...callbacks(), onPairRetry: retry };
    const { rerender } = render(<PracticeDetailView {...props} />);
    const table = screen.getByRole('table', { name: '内部配对' });
    const row = table.querySelector('tbody tr');
    const slot = screen.getByTestId('pair-status');
    rerender(<PracticeDetailView {...props} pairPending />);
    expect(screen.getByTestId('pair-status')).toBe(slot);
    expect(table.querySelector('tbody tr')).toBe(row);
    expect(slot).toHaveTextContent('正在读取内部配对');
    rerender(<PracticeDetailView {...props} pairError="配对读取失败" />);
    expect(table.querySelector('tbody tr')).toBe(row);
    fireEvent.click(screen.getByRole('button', { name: '重试配对' }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it('exposes the full extreme amount through a focusable disclosure', async () => {
    const detail = await load('extreme', 'B');
    render(<PracticeDetailView detail={detail} pairs={detail.pairs} status="ready" error="" {...callbacks()} />);
    const trigger = screen.getAllByRole('button', { name: '查看完整数值' })[0];
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(detail.financial.closedNet.state === 'known' ? detail.financial.closedNet.value.amount : '');
  });
  it('keeps closed metrics distinct from the unknown whole practice net', async () => {
    const detail = await load();
    render(<PracticeDetailView detail={detail} pairs={detail.pairs} status="ready" error="" {...callbacks()} />);
    expect(screen.getByText(/1884\.00/)).toBeInTheDocument();
    expect(screen.getByText(/16\.00/)).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText(/7\.00/)).toBeInTheDocument();
    expect(screen.getAllByText(/缺少结束时点价格/).length).toBeGreaterThan(0);
  });
  it('shows full source and independently sourced practice, historical and import times', async () => {
    const detail = await load();
    render(<PracticeDetailView detail={detail} pairs={detail.pairs} status="ready" error="" {...callbacks()} />);
    for (const value of [detail.source.name, detail.practice.practiceDate, detail.practice.historicalFrom, detail.practice.historicalTo]) expect(screen.getAllByText(new RegExp(value)).length).toBeGreaterThan(0);
    expect(screen.getByText(/2026-10-31/)).toBeInTheDocument();
  });
  it('navigates a seven-pair result with the supplied callback', async () => {
    const detail = await load('pagination', 'P1'); const props = callbacks();
    render(<PracticeDetailView detail={detail} pairs={detail.pairs} status="ready" error="" {...props} />);
    expect(screen.getByRole('button', { name: /上一页/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(props.onPairPage).toHaveBeenCalledWith(2);
  });
  it('clears stale detail during loading and error while retaining back and retry', async () => {
    const detail = await load(); const props = callbacks();
    const { rerender } = render(<PracticeDetailView detail={detail} pairs={detail.pairs} status="loading" error="" {...props} />);
    expect(screen.queryByText(detail.source.name)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /返回/ })); expect(props.onBack).toHaveBeenCalledOnce();
    rerender(<PracticeDetailView detail={detail} pairs={detail.pairs} status="error" error="读取失败" {...props} />);
    expect(screen.queryByText(detail.source.name)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重试/ })); expect(props.onRetry).toHaveBeenCalledOnce();
  });
  it('explains disabled replay without making it unfocusable', async () => {
    const detail = await load();
    render(<PracticeDetailView detail={detail} pairs={detail.pairs} status="ready" error="" {...callbacks()} />);
    const replay = screen.getAllByRole('button', { name: /回放/ })[0];
    expect(replay).toHaveAttribute('aria-disabled', 'true');
    expect(replay).not.toBeDisabled();
    expect(replay).toHaveAccessibleDescription();
  });
  it('distinguishes a known zero from missing pairs', async () => {
    const detail = await load();
    const missing = { state: 'unknown' as const, reasonCode: 'missing-pairs', reason: '配对数据缺失' };
    const pairs = { ...detail.pairs, rows: [], totalCount: 0, completeness: missing };
    const modified = { ...detail, financial: { ...detail.financial, closedFees: { state: 'known' as const, value: { amount: '0', currency: 'CNY' } } } };
    render(<PracticeDetailView detail={modified} pairs={pairs} status="ready" error="" {...callbacks()} />);
    expect(screen.getByText(/^0\.00$/)).toBeInTheDocument();
    expect(screen.getByText('配对数据缺失')).toBeInTheDocument();
    expect(screen.queryByText('无内部配对')).not.toBeInTheDocument();
  });

  it('formats known return ratios as percentages and preserves unknown reasons', async () => {
    const detail = await load(); const props = callbacks();
    const withRate = (returnRate: typeof detail.financial.returnRate) => ({ ...detail, financial: { ...detail.financial, returnRate } });
    const { rerender } = render(<PracticeDetailView detail={withRate({ state: 'known', value: '0.125' })} pairs={detail.pairs} status="ready" error="" {...props} />);
    expect(screen.getByText('12.5%')).toBeInTheDocument();
    rerender(<PracticeDetailView detail={withRate({ state: 'known', value: '0' })} pairs={detail.pairs} status="ready" error="" {...props} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    rerender(<PracticeDetailView detail={withRate({ state: 'unknown', reasonCode: 'missing', reason: '收益率缺失' })} pairs={detail.pairs} status="ready" error="" {...props} />);
    expect(screen.getByText('收益率缺失')).toBeInTheDocument();
  });

});
