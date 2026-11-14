import { describe, expect, it } from 'vitest';
import { createCompleteMockSource, mockInstruments } from './mock-source';
import { DEFAULT_REQUEST } from '../mock-source';
const signal = () => new AbortController().signal;
describe('complete homepage Mock display contract', () => {
  it('combines filter dimensions with AND, persists applied filters and reports CNY in every market', async () => {
    const source = createCompleteMockSource('normal',0);
    const request = { ...DEFAULT_REQUEST, filters: {assetTypes:['ETF'],openOnly:true,review:'all' as const} };
    const view = await source.readHome(request,signal());
    expect(view.holdings.total).toBe(1);
    expect(view.holdings.rows[0].assetType).toBe('ETF');
    expect(view.request.filters).toEqual(request.filters);
    for(const market of ['HK','US'] as const) {
      const result = await source.readHome({...DEFAULT_REQUEST,market},signal());
      expect(result.stamp.reportCurrency).toBe('CNY');
      expect(result.holdings.rows.every(row=>row.marketValue.currency==='CNY')).toBe(true);
    }
  });
  it('opens global search and closed instrument details without changing the frozen home scope', async () => {
    const source = createCompleteMockSource('normal',0);
    const home = await source.readHome({...DEFAULT_REQUEST,market:'CN'},signal());
    const outside = mockInstruments('normal').find(row=>row.market==='US'&&!row.open)!;
    const detail = await source.readHolding(home.stamp,outside.id,signal());
    expect(detail.stamp).toEqual(home.stamp);
    expect(detail.holding.assetType).toBe('股票');
    expect((await source.readTrades(home.stamp,outside.id,signal())).trades).toHaveLength(2);
    await expect(source.readHolding({...home.stamp,version:'invalid'},outside.id,signal())).rejects.toThrow();
  });
});
