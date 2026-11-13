import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LibraryPreview } from './library-preview';
import { createMockReadPort } from '../../lib/library-preview/mock-read-port';
import type { PracticePage } from '../../lib/library-preview/contracts';

afterEach(cleanup);
describe('preview port wiring', () => {
  it('renders the injected page and refreshes through the same port', async () => {
    const port = createMockReadPort('reference');
    const original = port.readPracticePage;
    port.readPracticePage = vi.fn(async (query, context) => {
      const page = await original(query, context);
      return { ...page, rows: [{ ...page.rows[0], instrument: { ...page.rows[0].instrument, name: '独特标的' } }] };
    });
    render(<LibraryPreview port={port} initialLocation="" />);
    expect(await screen.findAllByText(/独特标的/)).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('刷新'));
    await waitFor(() => expect(port.readPracticePage).toHaveBeenCalledTimes(2));
  });
  it('does not let a stale response overwrite a newer refresh', async () => {
    const port = createMockReadPort('reference');
    const original = port.readPracticePage;
    let resolveOld!: (page: PracticePage) => void;
    let oldPage!: PracticePage;
    let calls = 0;
    port.readPracticePage = vi.fn(async (query, context) => {
      const page = await original(query, context);
      calls++;
      if (calls === 1) { oldPage = page; return new Promise<PracticePage>(resolve => { resolveOld = resolve; }); }
      return { ...page, rows: [{ ...page.rows[0], instrument: { ...page.rows[0].instrument, name: '新结果' } }] };
    });
    render(<LibraryPreview port={port} initialLocation="" />);
    await waitFor(() => expect(resolveOld).toBeDefined());
    fireEvent.click(screen.getByLabelText('刷新'));
    expect(await screen.findAllByText(/新结果/)).toHaveLength(2);
    resolveOld(oldPage);
    await waitFor(() => expect(screen.getAllByText(/新结果/)).toHaveLength(2));
  });
});

import { beforeEach } from 'vitest';
import { decodePreviewLocation, encodePreviewLocation } from '../../lib/library-preview/preview-url';

beforeEach(() => { window.history.replaceState(null, '', '/'); window.sessionStorage.clear(); });

it('consumes the complete initial location in the real port', async () => {
  const port = createMockReadPort('pagination');
  port.readPracticePage = vi.fn(port.readPracticePage);
  const location = decodePreviewLocation('?scenario=pagination&page=3&from=2026-10-15&to=2026-10-19&search=abc&sort=date-desc');
  render(<LibraryPreview port={port} initialLocation={location} />);
  await waitFor(() => expect(port.readPracticePage).toHaveBeenCalledWith(location.query, expect.anything()));
});

it('submits search once after composition and clears it without losing market', async () => {
  const port = createMockReadPort('reference');
  port.readPracticePage = vi.fn(port.readPracticePage);
  render(<LibraryPreview port={port} initialLocation="" />);
  await waitFor(() => expect(port.readPracticePage).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('市场'), { target: { value: 'CN' } });
  await waitFor(() => expect(port.readPracticePage).toHaveBeenCalledTimes(2));
  const input = screen.getByLabelText('搜索');
  fireEvent.compositionStart(input); fireEvent.change(input, { target: { value: '茅台' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(port.readPracticePage).toHaveBeenCalledTimes(2);
  fireEvent.compositionEnd(input); fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(port.readPracticePage).toHaveBeenCalledTimes(3));
  fireEvent.click(screen.getByRole('button', { name: /清.*搜索/ }));
  await waitFor(() => expect(port.readPracticePage).toHaveBeenCalledTimes(4));
  expect(vi.mocked(port.readPracticePage).mock.calls[3][0]).toMatchObject({ search: '', market: 'CN' });
});

it('resets page three to page one on market change', async () => {
  const port = createMockReadPort('pagination'); port.readPracticePage = vi.fn(port.readPracticePage);
  const location = decodePreviewLocation('?scenario=pagination&page=3');
  render(<LibraryPreview port={port} initialLocation={location} />);
  await waitFor(() => expect(port.readPracticePage).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('市场'), { target: { value: 'CN' } });
  await waitFor(() => expect(port.readPracticePage).toHaveBeenCalledTimes(2));
  expect(vi.mocked(port.readPracticePage).mock.calls[1][0]).toMatchObject({ market: 'CN', pageIndex: 1 });
});

it('keeps rows on refresh failure and retries the same target', async () => {
  const port = createMockReadPort('reference'); const original = port.readPracticePage;
  let calls = 0;
  port.readPracticePage = vi.fn(async (query, context) => {
    if (++calls === 2) throw new Error('读取失败');
    return original(query, context);
  });
  render(<LibraryPreview port={port} initialLocation="" />);
  await waitFor(() => expect(port.readPracticePage).toHaveBeenCalledTimes(1));
  const page = await original(vi.mocked(port.readPracticePage).mock.calls[0][0], { signal: new AbortController().signal });
  expect(await screen.findAllByText(new RegExp(page.rows[0].instrument.name))).not.toHaveLength(0);
  fireEvent.click(screen.getByLabelText('刷新'));
  expect(await screen.findByText(/读取失败/)).toBeInTheDocument();
  expect(screen.getAllByText(new RegExp(page.rows[0].instrument.name))).not.toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: /重试/ }));
  await waitFor(() => expect(port.readPracticePage).toHaveBeenCalledTimes(3));
  expect(vi.mocked(port.readPracticePage).mock.calls[2][0]).toEqual(vi.mocked(port.readPracticePage).mock.calls[1][0]);
});

it('clears nondefault filters while retaining search and sort', async () => {
  const port = createMockReadPort('pagination'); port.readPracticePage = vi.fn(port.readPracticePage);
  const location = decodePreviewLocation('?scenario=pagination&from=2026-10-16&to=2026-10-18&market=CN&account=simulation&search=abc&sort=date-desc');
  render(<LibraryPreview port={port} initialLocation={location} />);
  await waitFor(() => expect(port.readPracticePage).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
  await waitFor(() => expect(port.readPracticePage).toHaveBeenCalledTimes(2));
  expect(vi.mocked(port.readPracticePage).mock.calls[1][0]).toMatchObject({ from: '2026-10-15', to: '2026-10-19', market: 'all', accountId: 'all', search: 'abc', sort: 'date-desc' });
});

it('restores scroll and row focus on history navigation, falling back for missing rows and malformed storage', async () => {
  const port = createMockReadPort('pagination'); port.readPracticePage = vi.fn(port.readPracticePage);
  const location = decodePreviewLocation('?scenario=pagination&page=2');
  window.history.replaceState(null, '', '/?scenario=pagination&page=2');
  const { container } = render(<LibraryPreview port={port} initialLocation={location} />);
  await waitFor(() => { expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page'); expect(screen.getByRole('status')).not.toHaveTextContent('加载中'); });
  const scroller = container.querySelector<HTMLElement>('.library-preview')!;
  const row = container.querySelector<HTMLButtonElement>('[id^="practice-row-"]')!;
  row.focus(); scroller.scrollTop = 123; fireEvent.scroll(scroller);
  fireEvent.click(screen.getByRole('button', { name: '1' }));
  await waitFor(() => { expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page'); expect(screen.getByRole('status')).not.toHaveTextContent('加载中'); });
  window.history.replaceState(null, '', '/?scenario=pagination&page=2'); act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await waitFor(() => { expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page'); expect(screen.getByRole('status')).not.toHaveTextContent('加载中'); });
  expect(scroller.scrollTop).toBe(123); expect(document.activeElement?.id).toBe(row.id);
  const storageKey = 'library-preview:return:' + encodePreviewLocation(location);
  window.history.replaceState(null, '', '/?scenario=pagination&page=1'); act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await waitFor(() => { expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page'); expect(screen.getByRole('status')).not.toHaveTextContent('加载中'); });
  sessionStorage.setItem(storageKey, JSON.stringify({ scrollTop: 45, focusId: 'practice-row-missing' }));
  window.history.replaceState(null, '', '/?scenario=pagination&page=2'); act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await waitFor(() => { expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page'); expect(screen.getByRole('status')).not.toHaveTextContent('加载中'); });
  expect(document.activeElement?.id).toBe('practice-list-heading'); expect(scroller.scrollTop).toBe(45);
  window.history.replaceState(null, '', '/?scenario=pagination&page=1'); act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await waitFor(() => { expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page'); expect(screen.getByRole('status')).not.toHaveTextContent('加载中'); });
  sessionStorage.setItem(storageKey, '{bad');
  window.history.replaceState(null, '', '/?scenario=pagination&page=2'); act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await waitFor(() => { expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page'); expect(screen.getByRole('status')).not.toHaveTextContent('加载中'); });
  expect(document.activeElement?.id).toBe('practice-list-heading');
});
