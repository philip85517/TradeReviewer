import { describe, expect, it } from 'vitest';
import { createMockSource, DEFAULT_REQUEST } from './mock-source';

const signal = () => new AbortController().signal;
describe('homepage presentation source', () => {
  it('filters the complete set, paginates eight slots, exports every matched row', async () => {
    const source = createMockSource({ scenario: 'nine' });
    const last = await source.readHome({ ...DEFAULT_REQUEST, page: 2 }, signal());
    expect(last.holdings.rows).toHaveLength(1);
    expect(last.holdings.total).toBe(9);
    const filtered = await source.readHome({ ...DEFAULT_REQUEST, query: '腾讯' }, signal());
    expect(filtered.holdings.rows.map(row => row.name)).toEqual(['腾讯控股']);
    const csv = await source.exportHoldings({ ...DEFAULT_REQUEST, page: 2 }, signal());
    expect(csv.trim().split('\r\n')).toHaveLength(10);
  });
  it('changes period results without changing current holdings or market value', async () => {
    const source = createMockSource({ scenario: 'normal' });
    const year = await source.readHome(DEFAULT_REQUEST, signal());
    const month = await source.readHome({ ...DEFAULT_REQUEST, period: { preset: 'month', from: '2026-10-01', to: '2026-10-15' } }, signal());
    expect(month.metrics.net.value).not.toBe(year.metrics.net.value);
    expect(month.metrics.currentMarketValue).toEqual(year.metrics.currentMarketValue);
    expect(month.holdings).toEqual(year.holdings);
  });
  it('preserves unknown and actual zero distinctly', async () => {
    const view = await createMockSource({ scenario: 'unknown' }).readHome(DEFAULT_REQUEST, signal());
    expect(view.holdings.rows.find(row => row.code === "600519")?.cost).toBeNull();
    expect(view.holdings.rows.find(row => row.code === "00700")?.unrealized.value).toBe('0');
    expect(view.series.points.some(point => point.net.value === null)).toBe(true);
  });
  it('resolves full identities and rejects a stamp from a different scope', async () => {
    const source = createMockSource({ scenario: 'normal' });
    const view = await source.readHome(DEFAULT_REQUEST, signal());
    const duplicates = view.holdings.rows.filter(row => row.code === '000001');
    expect(duplicates).toHaveLength(2);
    const details = await Promise.all(duplicates.map(row => source.readHolding(view.stamp, row.id, signal())));
    expect(details[0].holding.exchange).not.toBe(details[1].holding.exchange);
    await expect(source.readHolding({ ...view.stamp, scope: 'wrong' }, duplicates[0].id, signal())).rejects.toThrow('范围');
    const trades = await source.readTrades(view.stamp, duplicates[0].id, signal());
    expect(trades.holdingId).toBe(duplicates[0].id);
  });
  it('keeps current totals independent of local search and changes scope snapshots coherently', async () => {
    const source = createMockSource({ scenario: 'normal' });
    const all = await source.readHome(DEFAULT_REQUEST, signal());
    const none = await source.readHome({ ...DEFAULT_REQUEST, query: 'no-match' }, signal());
    expect(none.metrics.currentMarketValue).toEqual(all.metrics.currentMarketValue);
    expect(none.holdings.marketValue).toEqual(all.holdings.marketValue);
    const us = await source.readHome({ ...DEFAULT_REQUEST, market: 'US' }, signal());
    expect(us.metrics.net.value).not.toEqual(all.metrics.net.value);
    const row = us.holdings.rows[0];
    const detail = await source.readHolding(us.stamp, row.id, signal());
    expect(detail.holding.marketValue).toEqual(row.marketValue);
    expect(Object.keys(row.marketValue.originals)).toEqual(['USD']);
  });
  it('supplies unique daily dates, historical snapshots and period changes in every scope', async () => {
    const source = createMockSource({ scenario: 'normal', delayMs: 0 });
    const week = await source.readHome({ ...DEFAULT_REQUEST, market: 'US', period: { preset: 'week', from: '2026-10-12', to: '2026-10-15' } }, signal());
    const year = await source.readHome({ ...DEFAULT_REQUEST, market: 'US' }, signal());
    expect(week.series.points.map(point => point.businessDate)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']);
    expect(week.metrics.net.value).not.toBe(year.metrics.net.value);
    expect(year.series.points[0].marketValue.value).not.toBe(year.metrics.currentMarketValue.value);
    expect(year.series.points.at(-1)?.marketValue).toEqual(year.metrics.currentMarketValue);
  });
  it('never substitutes zero for an unknown trade price', async () => {
    const source = createMockSource({ scenario: 'unknown', delayMs: 0 });
    const view = await source.readHome(DEFAULT_REQUEST, signal());
    const row = view.holdings.rows.find(item => item.cost === null)!;
    const result = await source.readTrades(view.stamp, row.id, signal());
    expect(result.trades[0].price).toBeNull();
  });
  it('stops an aborted read', async () => {
    const controller = new AbortController();
    const request = createMockSource({ scenario: 'normal', delayMs: 50 }).readHome(DEFAULT_REQUEST, controller.signal);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
