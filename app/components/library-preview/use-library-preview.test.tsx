import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockReadPort } from '../../lib/library-preview/mock-read-port';
import { decodePreviewLocation } from '../../lib/library-preview/preview-url';
import type { PracticePage } from '../../lib/library-preview/contracts';
import { useLibraryPreview } from './use-library-preview';

afterEach(cleanup);
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
    await act(async () => { resolveOld({ ...current, query: { ...current.query, search: 'old' } }); });
    expect(result.current.appliedLocation.query.search).toBe('new');
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
});
