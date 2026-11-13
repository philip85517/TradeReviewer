import { describe, expect, it, vi } from 'vitest';
import { createMockReadPort } from './mock-read-port';
import { decodePreviewLocation } from './preview-url';

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

describe('mock detail port', () => {
  it('returns A financial decomposition and its first pair page', async () => {
    const detail = await createMockReadPort('reference').readPracticeDetail({ practiceId: 'A' }, context());
    expect(detail.financial.realizedGross).toEqual({ state: 'known', value: { amount: '1900', currency: 'CNY' } });
    expect(detail.financial.practiceNet.state).toBe('unknown');
    expect(detail.pairs.rows.map(row => row.pairId)).toEqual(['A-1', 'A-2']);
    expect(detail.pairs.rows.map(row => row.net)).toEqual(['990', '894'].map(amount => ({ state: 'known', value: { amount, currency: 'CNY' } })));
  });
  it('keeps same-day practice identities distinct', async () => {
    const port = createMockReadPort('reference');
    const a = await port.readPracticeDetail({ practiceId: 'A' }, context());
    const e = await port.readPracticeDetail({ practiceId: 'E' }, context());
    expect(a.source.name).not.toBe(e.source.name);
    expect(e.practice.sequence).toBe(2);
    expect(e.financial.practiceNet).toEqual({ state: 'known', value: { amount: '98', currency: 'CNY' } });
  });
});

describe('detail edge scenarios', () => {
  it('paginates seven pairs for P1 without mixing identities', async () => {
    const port = createMockReadPort('pagination');
    const detail = await port.readPracticeDetail({ practiceId: 'P1' }, context());
    expect(detail.practice.executionCount).toBe(14);
    expect(detail.practice.pairCount).toEqual({ state: 'known', value: 7 });
    expect(detail.pairs.rows).toHaveLength(6);
    const second = await port.readPairPage(detail.practice.key, { pageIndex: 2, pageSize: 6 }, context());
    expect([second.totalCount, second.pageIndex, second.rows.length, second.rows[0].pairId]).toEqual([7, 2, 1, 'P1-7']);
    expect(second.rows[0].key).toEqual(detail.practice.key);
  });
  it('preserves extreme known zero and missing facts', async () => {
    const port = createMockReadPort('extreme');
    const b = await port.readPracticeDetail({ practiceId: 'B' }, context());
    const c = await port.readPracticeDetail({ practiceId: 'C' }, context());
    const d = await port.readPracticeDetail({ practiceId: 'D' }, context());
    expect(b.practice.instrument.name.length).toBeGreaterThan(20);
    expect(b.practice.net).toEqual({ state: 'known', value: { amount: '12345678901234567890', currency: 'CNY' } });
    expect(c.practice.net).toEqual({ state: 'known', value: { amount: '0', currency: 'CNY' } });
    expect(d.practice.pairCount.state).toBe('unknown');
    expect(d.practice.openQuantity.state).toBe('unknown');
    expect(d.endValuation).toMatchObject({ state: 'unknown', reasonCode: 'missing-open-quantity' });
    expect(d.pairs.completeness).toMatchObject({ state: 'unknown', reasonCode: 'missing-pairs' });
    expect(d.pairs.rows).toEqual([]);
  });
  it('honors abort, version, not found and independent retry', async () => {
    const slow = createMockReadPort('slow');
    const controller = new AbortController();
    const pending = slow.readPracticeDetail({ practiceId: 'A' }, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(slow.readPracticeDetail({ practiceId: 'A' }, { ...context(), snapshotVersion: 'old' })).rejects.toMatchObject({ code: 'version-expired', retryable: false });
    await expect(createMockReadPort('version-expired').readPracticeDetail({ practiceId: 'A' }, context())).rejects.toMatchObject({ code: 'version-expired' });
    await expect(createMockReadPort('not-found').readPracticeDetail({ practiceId: 'A' }, context())).rejects.toMatchObject({ code: 'not-found' });
    const retry = createMockReadPort('retry');
    await expect(retry.readPracticePage(query, context())).rejects.toMatchObject({ code: 'network' });
    await expect(retry.readPracticeDetail({ practiceId: 'A' }, context())).rejects.toMatchObject({ code: 'network' });
    expect((await retry.readPracticeDetail({ practiceId: 'A' }, context())).practice.key.practiceId).toBe('A');
  });
  it('delays stale A longer than B and permits cancellation', async () => {
    const port = createMockReadPort('stale');
    const controller = new AbortController();
    const a = port.readPracticeDetail({ practiceId: 'A' }, { signal: controller.signal });
    const b = await port.readPracticeDetail({ practiceId: 'B' }, context());
    expect(b.practice.key.practiceId).toBe('B');
    controller.abort();
    await expect(a).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('historical time semantics', () => {
  it('keeps pair dates within source history and valuation on the last transaction day', async () => {
    const detail = await createMockReadPort('explicit-end-price').readPracticeDetail({ practiceId: 'A' }, context());
    expect(detail.pairs.rows.map(row => [row.openedAt, row.closedAt])).toEqual([
      ['2022-10-05', '2023-01-01'], ['2022-01-01', '2023-01-01'],
    ]);
    for (const pair of detail.pairs.rows) {
      expect(pair.openedAt >= detail.practice.historicalFrom && pair.closedAt <= detail.practice.historicalTo).toBe(true);
    }
    expect(detail.endValuation).toMatchObject({ state: 'known', value: { barEnd: detail.practice.historicalTo } });
  });
});

describe('pair retry scenario', () => {
  it('provides the pagination fixture and first pair page', async () => {
    const port = createMockReadPort(decodePreviewLocation('?scenario=pair-retry').scenario);
    expect((await port.readPracticePage(query, context())).totalCount).toBe(13);
    const detail = await port.readPracticeDetail({ practiceId: 'P1' }, context());
    expect(detail.practice.executionCount).toBe(14);
    expect(detail.practice.pairCount).toEqual({ state: 'known', value: 7 });
    expect(detail.practice.net).toEqual({ state: 'known', value: { amount: '10', currency: 'CNY' } });
    expect(detail.pairs.rows).toHaveLength(6);
  });
});

it('delays pair requests and preserves the first page-two failure through abort and invalid version', async () => {
  vi.useFakeTimers();
  try {
    const port = createMockReadPort(decodePreviewLocation('?scenario=pair-retry').scenario);
    const detail = await port.readPracticeDetail({ practiceId: 'P1' }, context());
    const key = detail.practice.key;
    const first = port.readPairPage(key, { pageIndex: 1, pageSize: 6 }, context());
    await vi.advanceTimersByTimeAsync(1200);
    expect((await first).rows).toHaveLength(6);
    await expect(port.readPairPage(key, { pageIndex: 2, pageSize: 6 }, { ...context(), snapshotVersion: 'old' })).rejects.toMatchObject({ code: 'version-expired' });
    const controller = new AbortController();
    const aborted = port.readPairPage(key, { pageIndex: 2, pageSize: 6 }, { signal: controller.signal });
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
    let settled = false;
    const failure = port.readPairPage(key, { pageIndex: 2, pageSize: 6 }, context());
    const assertion = expect(failure).rejects.toMatchObject({ code: 'network', message: '暂时无法加载内部配对', retryable: true });
    void failure.catch(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(1199);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    const retry = port.readPairPage({ practiceVersion: key.practiceVersion, revisionId: key.revisionId, practiceId: key.practiceId }, { pageIndex: 2, pageSize: 6 }, context());
    await vi.advanceTimersByTimeAsync(1200);
    const page = await retry;
    expect([page.totalCount, page.rows[0].pairId]).toEqual([7, 'P1-7']);
    expect(page.rows[0].key).toEqual(key);
  } finally { vi.useRealTimers(); }
});
