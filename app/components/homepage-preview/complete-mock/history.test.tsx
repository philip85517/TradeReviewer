import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REQUEST } from '../mock-source';
import { HistoricalStatistics } from './historical-statistics';
import { historySeries, readHistorySnapshot } from './history-data';
import type { HistoryRange } from './contracts';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const year = { fromYear: 2026, toYear: 2026 };
function Harness({ scenario = 'normal' as const }: { scenario?: 'normal' | 'partial' }) {
  const [range, setRange] = useState<HistoryRange>(year);
  return <HistoricalStatistics request={DEFAULT_REQUEST} scenario={scenario} range={range} onRangeChange={setRange} />;
}
describe('historical closed presentation', () => {
  it('uses weighted aggregate win rate and keeps current period/search independent', () => {
    const original = readHistorySnapshot(DEFAULT_REQUEST, year, 'normal');
    expect(original.stats).toEqual({ net: 30000, closed: 14, wins: 9, fees: 2440 });
    expect(readHistorySnapshot({ ...DEFAULT_REQUEST, query: '不存在', page: 9, period: { preset: 'week', from: '2026-10-09', to: '2026-10-15' } }, year, 'normal')).toEqual(original);
    const filtered = readHistorySnapshot({ ...DEFAULT_REQUEST, filters: { assetTypes: ['基金'], openOnly: false, review: 'all' } }, year, 'normal');
    expect(filtered.stats.closed).toBe(0);
    expect(filtered.state).toBe('empty');
    expect(readHistorySnapshot({ ...DEFAULT_REQUEST, market: 'HK' }, year, 'normal').stats.net).not.toBe(original.stats.net);
  });
  it('distinguishes true zero, no closed rounds, missing and future; missing breaks cumulative', () => {
    const one = readHistorySnapshot(DEFAULT_REQUEST, year, 'one');
    expect(one.periods[0]).toMatchObject({ net: 0, closed: 1, state: 'value' });
    expect(one.periods[1].state).toBe('empty');
    expect(one.periods[10].state).toBe('future');
    expect(readHistorySnapshot(DEFAULT_REQUEST, { fromYear: 2027, toYear: 2027 }, 'normal')).toMatchObject({ state: 'future', stats: { net: null, closed: null, wins: null, fees: null } });
    const missing = historySeries(readHistorySnapshot(DEFAULT_REQUEST, year, 'gaps').periods, 'cumulative');
    const absent = missing.findIndex(p => p.state === 'source-missing');
    expect(absent).toBeGreaterThan(0);
    expect(missing.slice(absent).every(p => p.value === null)).toBe(true);
  });
  it('applies a year range only on apply and changes monthly to annual labels', async () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '历史年份范围：2026' }));
    fireEvent.change(screen.getByLabelText('年份范围类型'), { target: { value: 'range' } });
    fireEvent.change(screen.getByLabelText('起始年份'), { target: { value: '2024' } });
    expect(screen.getByRole('heading', { name: '每月净盈亏' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '应用年份范围' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    expect(screen.getByRole('heading', { name: '每年净盈亏' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '历史年份范围：2024–2026' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('历史图表指标'), { target: { value: 'win' } });
    expect(screen.getByRole('heading', { name: '各期胜率' })).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    fireEvent.focus(screen.getByRole('button', { name: /2024年.*%/ }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('盈利 / 全部回合');
    fireEvent.keyDown(screen.getByRole('button', { name: /2024年.*%/ }), { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('empty has no fake profit line or zero percent', () => {
    render(<HistoricalStatistics request={DEFAULT_REQUEST} scenario="empty" range={year} onRangeChange={() => {}} />);
    expect(screen.getByText('暂无已平仓回合')).toBeInTheDocument();
    expect(within(screen.getByTestId('history-win')).getByText('—')).toBeInTheDocument();
    expect(screen.getByTestId('history-chart').querySelector('polyline')).toBeNull();
    expect(document.querySelector('.hp-history-card strong')).toHaveTextContent('—');
  });
  it('keeps a recorded zero-profit round visible as zero', () => {
    render(<HistoricalStatistics request={DEFAULT_REQUEST} scenario="one" range={year} onRangeChange={() => {}} />);
    expect(document.querySelector('.hp-history-card strong')).toHaveTextContent('0');
    expect(document.querySelector('.hp-history-card strong')).not.toHaveTextContent('—');
  });
  it('failed range read retains committed range and data; retry applies the requested range', async () => {
    vi.useFakeTimers();
    render(<Harness scenario="partial" />);
    fireEvent.click(screen.getByRole('button', { name: '历史年份范围：2026' }));
    fireEvent.change(screen.getByLabelText('单年'), { target: { value: '2025' } });
    fireEvent.click(screen.getByRole('button', { name: '应用年份范围' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(450); });
    expect(screen.getByRole('alert')).toHaveTextContent('仍显示2026');
    expect(screen.getByRole('button', { name: '历史年份范围：2026' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试历史读取' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    expect(screen.getByRole('button', { name: '历史年份范围：2025' })).toBeInTheDocument();
  });
});
