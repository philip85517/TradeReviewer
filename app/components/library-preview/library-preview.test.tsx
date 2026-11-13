import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
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
