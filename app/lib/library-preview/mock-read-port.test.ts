import { describe, expect, it } from 'vitest';
import { createMockReadPort } from './mock-read-port';

const context = () => ({ signal: new AbortController().signal });
const query = { from: '2026-10-01', to: '2026-10-31', market: '', accountId: '', search: '', sort: 'date-asc' as const, pageIndex: 1, pageSize: 6 as const };
describe('mock list port', () => {
  it('reports practice-level totals and unknown open valuation', async () => {
    const page = await createMockReadPort('reference').readPracticePage(query, context());
    expect([page.totalCount, page.calculableCount, page.unknownCount]).toEqual([6, 5, 1]);
    expect(page.scopeNet).toEqual({ state: 'known', value: { amount: '388', currency: 'CNY' } });
    expect(page.scopeWinRate).toEqual({ state: 'known', value: '0.60' });
    expect(page.rows.find(row => row.key.practiceId === 'A')?.openQuantity).toEqual({ state: 'known', value: '70' });
    expect(page.rows.find(row => row.key.practiceId === 'A')?.net.state).toBe('unknown');
  });
  it('filters, sorts and clamps pages without leaking all rows', async () => {
    const port = createMockReadPort('pagination');
    const last = await port.readPracticePage({ ...query, pageIndex: 99 }, context());
    expect([last.totalCount, last.pageCount, last.query.pageIndex, last.rows.length]).toEqual([13, 3, 3, 1]);
    const filtered = await port.readPracticePage({ ...query, search: 'A' }, context());
    expect(filtered.rows.every(row => `${row.instrument.name} ${row.instrument.symbol} ${row.key.practiceId}`.toLowerCase().includes('a'))).toBe(true);
    const empty = await port.readPracticePage({ ...query, market: 'missing' }, context());
    expect([empty.totalCount, empty.pageCount, empty.query.pageIndex, empty.scopeWinRate.state]).toEqual([0, 1, 1, 'unknown']);
    const asc = await port.readPracticePage(query, context());
    const desc = await port.readPracticePage({ ...query, sort: 'date-desc', pageIndex: 3 }, context());
    expect(asc.rows[0].key.practiceId).toBe('A');
    expect(desc.rows[0].practiceDate).toBe('2026-10-15');
  });
  it('honors cancellation and rejects mismatched versions', async () => {
    const port = createMockReadPort('slow');
    const controller = new AbortController();
    const pending = port.readPracticePage(query, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(port.readPracticePage(query, { ...context(), snapshotVersion: 'old' })).rejects.toMatchObject({ code: 'version-expired' });
  });
  it('retries a transient failure within the same session', async () => {
    const port = createMockReadPort('retry');
    await expect(port.readPracticePage(query, context())).rejects.toMatchObject({ code: 'network', retryable: true });
    expect((await port.readPracticePage(query, context())).totalCount).toBe(6);
  });
});

describe('reference identities', () => {
  it('preserves the approved practices and explicit valuation', async () => {
    const port = createMockReadPort('reference');
    const options = await port.readOptions({ mode: 'simulation', from: '', to: '' }, context());
    expect(options.defaultScope).toEqual({ from: '2026-10-15', to: '2026-10-19', market: 'all', accountId: 'all', search: '' });
    const page = await port.readPracticePage({ ...query, ...options.defaultScope }, context());
    expect(page.rows.map(r => [r.key.practiceId, r.instrument.name, r.instrument.symbol, r.practiceDate, r.sequence, r.executionCount, r.pairCount])).toEqual([
      ['A', '贵州茅台', '600519', '2026-10-15', 1, 3, {state:'known',value:2}],
      ['E', '贵州茅台', '600519', '2026-10-15', 2, 2, {state:'known',value:1}],
      ['C', '平安银行', '000001', '2026-10-16', 1, 2, {state:'known',value:1}],
      ['D', '宁德时代', '300750', '2026-10-17', 1, 2, {state:'known',value:1}],
      ['B', '贵州茅台', '600519', '2026-10-18', 1, 2, {state:'known',value:1}],
      ['F', '招商银行', '600036', '2026-10-19', 1, 2, {state:'known',value:1}],
    ]);
    const explicit = await createMockReadPort('explicit-end-price').readPracticePage({ ...query, from:'', to:'', market:'all', accountId:'all' }, context());
    expect(explicit.rows.find(r => r.key.practiceId === 'A')?.net).toEqual({state:'known',value:{amount:'4677',currency:'CNY'}});
    const descending = await port.readPracticePage({ ...query, ...options.defaultScope, sort:'date-desc' }, context());
    expect(descending.rows.slice(-2).map(r => r.key.practiceId)).toEqual(['A','E']);
    expect((await port.readPracticePage({ ...query, ...options.defaultScope, search:'2026-10-15 #02' }, context())).rows.map(r => r.key.practiceId)).toEqual(['E']);
  });
});
