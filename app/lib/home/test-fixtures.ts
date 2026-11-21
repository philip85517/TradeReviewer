import {decimal} from './period';
import type {ReleaseInput,ScopeProjection} from './contracts';
import type {HomeRequest,Holding} from '../../components/homepage-preview/display-contract';
export const request: HomeRequest = { market: 'all', accountId: 'all', period: { preset: 'custom', from: '2026-01-02', to: '2026-01-02' }, query: '', sort: 'marketValue', direction: 'desc', page: 1 };
const money = (value: string) => ({ value, currency: 'CNY', reasons: [], coverage: { available: 1, total: 1 }, originals: { CNY: value }, fxSource: '原币' });
export function release(id = 'r1', sequence = 1): ReleaseInput {
  const holdings = ['2', '10', '9007199254740993.12345678', '1', '3', '4', '5', '6', '7'].map((value, index) => {
    const row: Holding = { id: `a:CN:${index}`, accountId: 'a', market: 'CN', name: `证券${index}`, code: `${index}`, exchange: 'SH', currency: 'CNY', holdingDays: 1, quantity: '1', cost: '1', price: value, marketValue: money(value), unrealized: money('0') };
    return { row, instrumentId: `CN:${index}`, positionKey: row.id, tradeSetId: `set:${index}`, description: '同版本详情' };
  });
  const total = holdings.reduce((sum, h) => sum.plus(h.row.marketValue.value!), decimal('0')).toString();
  const scopes: ScopeProjection[] = ['all', 'a'].flatMap(accountId => (['all', 'CN', 'HK', 'US'] as const).map(market => ({ id: JSON.stringify([market, accountId]), version: `${id}/${market}/${accountId}`, market, accountId, currency: 'CNY', sourceSequence: sequence, computedAt: '2026-01-02T16:00:00Z', valuationCutoff: '2026-01-02T15:00:00Z', businessDate: '2026-01-02', days: ['2026-01-01', '2026-01-02'].map(date => ({ date, buckets: { CNY: { market: date.endsWith('02') ? '25' : '20', unrealized: '0', realized: date.endsWith('02') ? '10' : '0', realizedMissing: 0, fees: '0', feesMissing: 0, count: 1, marketKnown: 1, unrealizedKnown: 1, lifetimeComplete: true, reasons: [] } }, fx: {}, reasons: [] })), current: { date: '2026-01-02', buckets: { CNY: { market: market === 'all' || market === 'CN' ? total : '0', unrealized: '0', realized: '10', realizedMissing: 0, fees: '0', feesMissing: 0, count: 1, marketKnown: 1, unrealizedKnown: 1, lifetimeComplete: true, reasons: [] } }, fx: {}, reasons: [] }, holdings: market === 'all' || market === 'CN' ? holdings : [], reasons: [] })));
  return { id, sourceSequence: sequence, computedAt: '2026-01-02T16:00:00Z', businessDate: '2026-01-02', accounts: [{ id: 'all', name: '全部实盘账户' }, { id: 'a', name: '账户A' }], scopes, trades: holdings.map(h => ({ id: h.tradeSetId, positionKey: h.positionKey, trades: [{ id: `${h.row.id}:t`, date: '2026-01-01', side: '买入', quantity: '1', price: '1', currency: 'CNY' }] })) };
}
