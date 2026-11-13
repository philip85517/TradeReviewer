import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PracticeList } from './practice-list';
import { createMockReadPort } from '../../lib/library-preview/mock-read-port';
import type { PracticeQuery } from '../../lib/library-preview/contracts';

const query: PracticeQuery = { from: '2026-10-15', to: '2026-10-19', market: 'all', accountId: 'all', search: '', sort: 'date-asc', pageIndex: 1, pageSize: 6 };
const load = () => createMockReadPort('reference').readPracticePage(query, { signal: new AbortController().signal });
afterEach(cleanup);

describe('practice list controls', () => {
  it('waits for IME composition to finish before submitting search', async () => {
    const page = await load(); const change = vi.fn();
    render(<PracticeList page={page} error="" onRefresh={() => {}} appliedQuery={query} onQueryChange={change} />);
    const input = screen.getByLabelText('搜索');
    fireEvent.compositionStart(input); fireEvent.change(input, { target: { value: '茅台' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(change).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input); fireEvent.keyDown(input, { key: 'Enter' });
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith({ ...query, search: '茅台', pageIndex: 1 });
  });
  it('clears only search while retaining scope and sorting', async () => {
    const page = await load(); const change = vi.fn(); const applied = { ...query, search: '茅台', sort: 'date-desc' as const, pageIndex: 2 };
    render(<PracticeList page={page} error="" onRefresh={() => {}} appliedQuery={applied} onQueryChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: /清.*搜索/ }));
    expect(change).toHaveBeenCalledWith({ ...applied, search: '', pageIndex: 1 });
  });
  it('sorts by date and navigates pages with native boundary disabling', async () => {
    const page = { ...(await load()), pageCount: 3, totalCount: 13 }; const change = vi.fn();
    const { rerender } = render(<PracticeList page={page} error="" onRefresh={() => {}} appliedQuery={query} onQueryChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: /练习日期/ }));
    expect(change).toHaveBeenCalledWith({ ...query, sort: 'date-desc', pageIndex: 1 });
    expect(screen.getByRole('button', { name: /上一页/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(change).toHaveBeenLastCalledWith({ ...query, pageIndex: 2 });
    const last = { ...query, pageIndex: 3 };
    rerender(<PracticeList page={{ ...page, query: last }} error="" onRefresh={() => {}} appliedQuery={last} onQueryChange={change} />);
    expect(screen.getByRole('button', { name: /下一页/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-current', 'page');
  });
  it('opens the exact row identity and passes its trigger element', async () => {
    const page = await load(); const open = vi.fn();
    render(<PracticeList page={page} error="" onRefresh={() => {}} onOpen={open} />);
    const row = page.rows[0]; const trigger = document.getElementById(`practice-row-${row.key.practiceId}`)!;
    fireEvent.click(trigger);
    expect(open).toHaveBeenCalledWith(row.key, trigger);
  });
  it('distinguishes unknown count, empty result and error while preserving old rows', async () => {
    const page = await load(); const retry = vi.fn();
    const { rerender } = render(<PracticeList page={null} error="" onRefresh={() => {}} />);
    expect(screen.getByText(/— 次练习/)).toBeInTheDocument();
    rerender(<PracticeList page={{ ...page, rows: [], totalCount: 0 }} error="" onRefresh={() => {}} />);
    expect(screen.getByText(/0 次练习/)).toBeInTheDocument();
    expect(screen.getByText(/暂无练习/)).toBeInTheDocument();
    rerender(<PracticeList page={page} error="读取失败" onRefresh={() => {}} onRetry={retry} />);
    expect(screen.getByText(/读取失败/)).toBeInTheDocument();
    expect(screen.getByText(/新范围.*未生效|新范围.*未应用/)).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(page.rows[0].instrument.name)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /重试/ })); expect(retry).toHaveBeenCalledOnce();
  });
});
