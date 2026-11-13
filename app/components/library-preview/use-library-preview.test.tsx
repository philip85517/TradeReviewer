import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockReadPort } from '../../lib/library-preview/mock-read-port';
import { decodePreviewLocation, encodePreviewLocation } from '../../lib/library-preview/preview-url';
import type { LibraryOptions, PracticePage } from '../../lib/library-preview/contracts';
import { useLibraryPreview } from './use-library-preview';

beforeEach(() => { window.history.replaceState({}, '', '/library-preview'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('library request state', () => {
  it('loads the initial page', async () => {
    const port = createMockReadPort('reference');
    const { result } = renderHook(() => useLibraryPreview(port));
    await waitFor(() => expect(result.current.page).not.toBeNull());
    expect(result.current.options).not.toBeNull();
    expect(result.current.appliedLocation.query).toEqual(result.current.page?.query);
  });

  it('preserves the applied result on failure and retries the target', async () => {
    const port = createMockReadPort('reference');
    const original = port.readPracticePage;
    let fail = true;
    port.readPracticePage = vi.fn(async (query, context) => {
      if (query.search === 'new' && fail) { fail = false; throw new Error('offline'); }
      return original(query, context);
    });
    const { result } = renderHook(() => useLibraryPreview(port));
    await waitFor(() => expect(result.current.page).not.toBeNull());
    const old = result.current.page;
    act(() => result.current.changeQuery({ ...result.current.appliedLocation.query, search: 'new' }));
    await waitFor(() => expect(result.current.error).toContain('offline'));
    expect(result.current.error).toContain('新范围未应用');
    expect(result.current.page).toBe(old);
    expect(result.current.appliedLocation.query.search).toBe('');
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.appliedLocation.query.search).toBe('new'));
  });

  it('ignores a late noncooperative page', async () => {
    const port = createMockReadPort('reference');
    const original = port.readPracticePage;
    let resolveOld!: (page: PracticePage) => void;
    port.readPracticePage = vi.fn(async (query, context) => {
      const page = await original(query, context);
      if (query.search === 'old') return new Promise<PracticePage>(resolve => { resolveOld = resolve; });
      return page;
    });
    const { result } = renderHook(() => useLibraryPreview(port));
    await waitFor(() => expect(result.current.page).not.toBeNull());
    act(() => result.current.changeQuery({ ...result.current.appliedLocation.query, search: 'old' }));
    await waitFor(() => expect(resolveOld).toBeDefined());
    act(() => result.current.changeQuery({ ...result.current.appliedLocation.query, search: 'new' }));
    await waitFor(() => expect(result.current.appliedLocation.query.search).toBe('new'));
    const current = result.current.page!;
    const currentUrl = window.location.href;
    await act(async () => { resolveOld({ ...current, query: { ...current.query, search: 'old' } }); });
    expect(result.current.appliedLocation.query.search).toBe('new');
    expect(window.location.href).toBe(currentUrl);
  });

  it('does not request a page after stale options resolve', async () => {
    const port = createMockReadPort('reference');
    const originalOptions = port.readOptions;
    const originalPage = port.readPracticePage;
    let resolveOld!: (options: LibraryOptions) => void;
    let oldOptions!: LibraryOptions;
    port.readOptions = vi.fn(async (input, context) => {
      const options = await originalOptions(input, context);
      if (input.from === '2026-10-16') {
        oldOptions = options;
        return new Promise<LibraryOptions>(resolve => { resolveOld = resolve; });
      }
      return options;
    });
    port.readPracticePage = vi.fn(originalPage);
    const { result } = renderHook(() => useLibraryPreview(port));
    await waitFor(() => expect(result.current.page).not.toBeNull());
    act(() => result.current.changeQuery({ ...result.current.appliedLocation.query, from: '2026-10-16' }));
    await waitFor(() => expect(resolveOld).toBeDefined());
    act(() => result.current.changeQuery({ ...result.current.appliedLocation.query, search: 'new' }));
    await waitFor(() => expect(result.current.appliedLocation.query.search).toBe('new'));
    const committed = { options: result.current.options, page: result.current.page, location: result.current.appliedLocation };
    const calls = vi.mocked(port.readPracticePage).mock.calls.length;
    await act(async () => { resolveOld(oldOptions); });
    expect(port.readPracticePage).toHaveBeenCalledTimes(calls);
    expect(result.current.options).toBe(committed.options);
    expect(result.current.page).toBe(committed.page);
    expect(result.current.appliedLocation).toBe(committed.location);
  });

  it('rejects invalid dates without calls and normalizes unknown options', async () => {
    const port = createMockReadPort('reference');
    port.readOptions = vi.fn(port.readOptions);
    const { result } = renderHook(() => useLibraryPreview(port));
    await waitFor(() => expect(result.current.page).not.toBeNull());
    const count = vi.mocked(port.readOptions).mock.calls.length;
    act(() => result.current.changeQuery({ ...result.current.appliedLocation.query, from: 'bad' }));
    expect(result.current.error).toBeTruthy();
    expect(port.readOptions).toHaveBeenCalledTimes(count);
    act(() => result.current.changeQuery({ ...decodePreviewLocation('').query, market: 'missing', accountId: 'missing' }));
    await waitFor(() => expect(result.current.notice).toBeTruthy());
    expect(result.current.appliedLocation.query.market).toBe('all');
    expect(result.current.appliedLocation.query.accountId).toBe('all');
  });
  it('normalizes initial URL and pushes a retried change only on success', async () => {
    const initial = decodePreviewLocation('?market=missing');
    const port = createMockReadPort('reference');
    const original = port.readPracticePage;
    let fail = true;
    port.readPracticePage = vi.fn(async (query, context) => {
      if (query.search === 'failed' && fail) { fail = false; throw new Error('offline'); }
      return original(query, context);
    });
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');
    const { result } = renderHook(() => useLibraryPreview(port, initial));
    await waitFor(() => expect(result.current.page).not.toBeNull());
    expect(decodePreviewLocation(window.location.search).query.market).toBe('all');
    expect(replace).toHaveBeenCalled();
    const oldUrl = window.location.href;
    act(() => result.current.changeQuery({ ...result.current.appliedLocation.query, search: 'failed' }));
    await waitFor(() => expect(result.current.error).toContain('offline'));
    expect(window.location.href).toBe(oldUrl);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.appliedLocation.query.search).toBe('failed'));
    expect(decodePreviewLocation(window.location.search).query.search).toBe('failed');
    expect(push).toHaveBeenCalledTimes(1);
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('handles pop without pushing and replaces a clamped page', async () => {
    const port = createMockReadPort('reference');
    const push = vi.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useLibraryPreview(port));
    await waitFor(() => expect(result.current.page).not.toBeNull());
    const target = { ...result.current.appliedLocation, query: { ...result.current.appliedLocation.query, pageIndex: 99 } };
    act(() => {
      window.history.replaceState({}, '', encodePreviewLocation(target));
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(push).not.toHaveBeenCalled();
    expect(decodePreviewLocation(window.location.search).query.pageIndex).toBe(result.current.page!.query.pageIndex);
    expect(result.current.page!.query.pageIndex).not.toBe(99);
  });

  it('restores the applied URL and page when pop fails', async () => {
    const port = createMockReadPort('reference');
    const original = port.readPracticePage;
    port.readPracticePage = vi.fn(async (query, context) => {
      if (query.search === 'failed') throw new Error('offline');
      return original(query, context);
    });
    const { result } = renderHook(() => useLibraryPreview(port));
    await waitFor(() => expect(result.current.page).not.toBeNull());
    const oldPage = result.current.page;
    const oldUrl = window.location.href;
    const target = { ...result.current.appliedLocation, query: { ...result.current.appliedLocation.query, search: 'failed' } };
    act(() => {
      window.history.replaceState({}, '', encodePreviewLocation(target));
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(result.current.error).toContain('新范围未应用'));
    expect(result.current.page).toBe(oldPage);
    expect(window.location.href).toBe(oldUrl);
  });

});

describe('detail request state', () => {
  it('loads a direct detail without list or pair requests', async () => {
    const port = createMockReadPort('reference');
    port.readPracticeDetail = vi.fn(port.readPracticeDetail);
    port.readOptions = vi.fn(port.readOptions);
    port.readPracticePage = vi.fn(port.readPracticePage);
    port.readPairPage = vi.fn(port.readPairPage);
    const initial = decodePreviewLocation('?practice=A');
    window.history.replaceState({}, '', encodePreviewLocation(initial));
    const { result } = renderHook(() => useLibraryPreview(port, initial));
    await waitFor(() => expect(result.current.detail?.practice.key.practiceId).toBe('A'));
    expect(port.readPracticeDetail).toHaveBeenCalledTimes(1);
    expect(port.readOptions).not.toHaveBeenCalled();
    expect(port.readPracticePage).not.toHaveBeenCalled();
    expect(port.readPairPage).not.toHaveBeenCalled();
  });

  it('ignores an old noncooperative detail response after opening B', async () => {
    const port = createMockReadPort('reference');
    const original = port.readPracticeDetail;
    let resolveA!: (value: Awaited<ReturnType<typeof original>>) => void;
    const a = await original({ practiceId: 'A' }, { signal: new AbortController().signal });
    port.readPracticeDetail = vi.fn((key, context) => key.practiceId === 'A'
      ? new Promise<Awaited<ReturnType<typeof original>>>(resolve => { resolveA = resolve; }) : original(key, context));
    const { result } = renderHook(() => useLibraryPreview(port));
    await waitFor(() => expect(result.current.page).not.toBeNull());
    act(() => result.current.openDetail(a.practice.key));
    await waitFor(() => expect(resolveA).toBeDefined());
    const b = await original({ practiceId: 'B' }, { signal: new AbortController().signal });
    act(() => result.current.openDetail(b.practice.key));
    await waitFor(() => expect(result.current.detail?.practice.key.practiceId).toBe('B'));
    await act(async () => { resolveA(a); });
    expect(result.current.detail?.practice.key.practiceId).toBe('B');
  });
});

it('retains the applied list and URL when page snapshot differs from options', async () => {
  const port = createMockReadPort('reference');
  const original = port.readPracticePage;
  port.readPracticePage = vi.fn(async (query, context) => {
    const page = await original(query, context);
    return query.search === 'mismatch' ? { ...page, snapshotVersion: 'other' } : page;
  });
  const { result } = renderHook(() => useLibraryPreview(port));
  await waitFor(() => expect(result.current.page).not.toBeNull());
  const old = result.current.page; const url = window.location.href;
  act(() => result.current.changeQuery({ ...result.current.appliedLocation.query, search: 'mismatch' }));
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.page).toBe(old);
  expect(result.current.appliedLocation.query.search).toBe('');
  expect(window.location.href).toBe(url);
});

it('opens exact A and E identities and clears the previous detail immediately', async () => {
  const port = createMockReadPort('reference');
  const a = await port.readPracticeDetail({ practiceId: 'A' }, { signal: new AbortController().signal });
  const e = await port.readPracticeDetail({ practiceId: 'E' }, { signal: new AbortController().signal });
  const { result } = renderHook(() => useLibraryPreview(port));
  await waitFor(() => expect(result.current.page).not.toBeNull());
  act(() => result.current.openDetail(a.practice.key));
  await waitFor(() => expect(result.current.detail?.practice.key).toEqual(a.practice.key));
  act(() => result.current.openDetail(e.practice.key));
  expect(result.current.detail).toBeNull();
  expect(result.current.desiredLocation.detail).toEqual(e.practice.key);
  await waitFor(() => expect(result.current.detail?.practice.key).toEqual(e.practice.key));
});

it.each(['practice', 'pair-key', 'pair-row', 'snapshot'] as const)('rejects mismatched detail %s', async mismatch => {
  const port = createMockReadPort('reference'); const original = port.readPracticeDetail;
  port.readPracticeDetail = vi.fn(async (key, context) => {
    const detail = await original(key, context);
    const badKey = { ...detail.practice.key, practiceVersion: 'bad' };
    if (mismatch === 'practice') return { ...detail, practice: { ...detail.practice, key: badKey } };
    if (mismatch === 'pair-key') return { ...detail, pairs: { ...detail.pairs, key: badKey } };
    if (mismatch === 'pair-row') return { ...detail, pairs: { ...detail.pairs, rows: detail.pairs.rows.map(row => ({ ...row, key: badKey })) } };
    return { ...detail, pairs: { ...detail.pairs, snapshotVersion: 'bad' } };
  });
  const key = (await original({ practiceId: 'A' }, { signal: new AbortController().signal })).practice.key;
  const initial = { ...decodePreviewLocation(''), detail: key };
  const { result } = renderHook(() => useLibraryPreview(port, initial));
  await waitFor(() => expect(result.current.detailStatus).toBe('error'));
  expect(result.current.detail).toBeNull(); expect(result.current.detailError).toBeTruthy();
});

it('retries the failed pair target with the detail key and snapshot', async () => {
  const port = createMockReadPort('pagination'); const original = port.readPairPage; let fail = true;
  port.readPairPage = vi.fn(async (key, page, context) => { if (fail) { fail = false; throw new Error('offline'); } return original(key, page, context); });
  const initial = { ...decodePreviewLocation('?scenario=pagination'), detail: { practiceId: 'P1' } };
  const { result } = renderHook(() => useLibraryPreview(port, initial));
  await waitFor(() => expect(result.current.detailStatus).toBe('ready'));
  const old = result.current.pairs;
  act(() => { void result.current.changePairPage(2); });
  await waitFor(() => expect(result.current.pairError).toBeTruthy());
  expect(result.current.pairs).toBe(old);
  act(() => result.current.retryPairs());
  await waitFor(() => expect(result.current.pairs?.pageIndex).toBe(2));
  expect(vi.mocked(port.readPairPage).mock.calls[1][0]).toEqual(result.current.detail!.practice.key);
  expect(vi.mocked(port.readPairPage).mock.calls[1][1]).toEqual({ pageIndex: 2, pageSize: 6 });
  expect(vi.mocked(port.readPairPage).mock.calls[1][2].snapshotVersion).toBe(result.current.detail!.snapshotVersion);
});

it('returns from a directly opened missing detail to a canonical list', async () => {
  const port = createMockReadPort('reference'); const initial = decodePreviewLocation('?practice=missing&search=abc');
  window.history.replaceState({}, '', encodePreviewLocation(initial));
  const { result } = renderHook(() => useLibraryPreview(port, initial));
  await waitFor(() => expect(result.current.detailError?.code).toBe('not-found'));
  act(() => result.current.backToList());
  await waitFor(() => expect(result.current.page).not.toBeNull());
  expect(decodePreviewLocation(window.location.search).detail).toBeUndefined();
  expect(result.current.appliedLocation.query.search).toBe('abc');
});

it('ignores a late pair response after opening another detail', async () => {
  const port = createMockReadPort('pagination'); const originalPair = port.readPairPage;
  let resolveOld!: (value: Awaited<ReturnType<typeof originalPair>>) => void;
  let old!: Awaited<ReturnType<typeof originalPair>>;
  port.readPairPage = vi.fn(async (key, page, context) => {
    old = await originalPair(key, page, context);
    return new Promise<Awaited<ReturnType<typeof originalPair>>>(resolve => { resolveOld = resolve; });
  });
  const initial = { ...decodePreviewLocation('?scenario=pagination'), detail: { practiceId: 'P1' } };
  const { result } = renderHook(() => useLibraryPreview(port, initial));
  await waitFor(() => expect(result.current.detailStatus).toBe('ready'));
  act(() => { void result.current.changePairPage(2); });
  await waitFor(() => expect(resolveOld).toBeDefined());
  const next = await port.readPracticeDetail({ practiceId: 'P2' }, { signal: new AbortController().signal });
  act(() => result.current.openDetail(next.practice.key));
  await waitFor(() => expect(result.current.detail?.practice.key.practiceId).toBe('P2'));
  await act(async () => { resolveOld(old); });
  expect(result.current.pairs?.key).toEqual(next.practice.key);
});

it.each(['key', 'row', 'snapshot'] as const)('rejects pair page with mismatched %s', async mismatch => {
  const port = createMockReadPort('pagination'); const original = port.readPairPage;
  port.readPairPage = vi.fn(async (key, page, context) => {
    const pairs = await original(key, page, context); const badKey = { ...key, revisionId: 'bad' };
    if (mismatch === 'key') return { ...pairs, key: badKey };
    if (mismatch === 'row') return { ...pairs, rows: pairs.rows.map(row => ({ ...row, key: badKey })) };
    return { ...pairs, snapshotVersion: 'bad' };
  });
  const initial = { ...decodePreviewLocation('?scenario=pagination'), detail: { practiceId: 'P1' } };
  const { result } = renderHook(() => useLibraryPreview(port, initial));
  await waitFor(() => expect(result.current.detailStatus).toBe('ready'));
  const old = result.current.pairs;
  act(() => { void result.current.changePairPage(2); });
  await waitFor(() => expect(result.current.pairError).toBeTruthy());
  expect(result.current.pairError?.retryable).toBe(false); expect(result.current.pairs).toBe(old);
});

it('returns directly to the list after detail-to-detail navigation', async () => {
  window.history.replaceState({ preserved: 'yes' }, '', '/library-preview');
  const port = createMockReadPort('reference');
  const a = await port.readPracticeDetail({ practiceId: 'A' }, { signal: new AbortController().signal });
  const b = await port.readPracticeDetail({ practiceId: 'B' }, { signal: new AbortController().signal });
  const { result } = renderHook(() => useLibraryPreview(port));
  await waitFor(() => expect(result.current.page).not.toBeNull());
  act(() => result.current.openDetail(a.practice.key));
  await waitFor(() => expect(result.current.detailStatus).toBe('ready'));
  act(() => result.current.openDetail(b.practice.key));
  await waitFor(() => expect(result.current.detail?.practice.key.practiceId).toBe('B'));
  act(() => result.current.backToList());
  await waitFor(() => expect(result.current.desiredLocation.detail).toBeUndefined());
  expect(decodePreviewLocation(window.location.search).detail).toBeUndefined();
  expect(window.history.state.preserved).toBe('yes');
});
