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
