import Decimal from 'decimal.js';
import fixtureTotals from './mock-snapshots.json';
import type { Amount, Holding, HomeRequest, HomepageSource, HomeView, Scenario, Stamp } from './display-contract';

export const TODAY = '2026-10-15';
export const SCENARIOS: Scenario[] = ['normal', 'empty', 'one', 'five', 'nine', 'ten', 'twenty', 'fifty-pages', 'extreme', 'gaps', 'unknown', 'partial'];
export const DEFAULT_REQUEST: HomeRequest = { market: 'all', accountId: 'all', period: { preset: 'ytd', from: '2026-01-01', to: TODAY }, query: '', sort: 'name', direction: 'asc', page: 1 };
const seeds = [
  ['贵州茅台', '600519', 'SSE', 'CN', 'CNY', '100', '1680.25', '1820.50', '182050', '14025'],
  ['腾讯控股', '00700', 'HKEX', 'HK', 'HKD', '400', '305.50', '338.20', '123892', '11979.6'],
  ['Apple Inc.', 'AAPL', 'NASDAQ', 'US', 'USD', '50', '175.80', '188.36', '67472.54', '4499.58'],
  ['平安银行', '000001', 'SZSE', 'CN', 'CNY', '2000', '11.85', '12.76', '25520', '1820'],
  ['长和', '000001', 'HKEX', 'HK', 'HKD', '1000', '41.35', '38.60', '35350', '-2518.50'],
  ['宁德时代', '300750', 'SZSE', 'CN', 'CNY', '300', '206.40', '219.80', '65940', '4020'],
  ['Microsoft Corp.', 'MSFT', 'NASDAQ', 'US', 'USD', '20', '328.50', '338.10', '48444.38', '1375.49'],
  ['沪深300ETF', '510300', 'SSE', 'CN', 'CNY', '5000', '3.82', '3.95', '19750', '650'],
] as const;
const counts: Partial<Record<Scenario, number>> = { empty: 0, one: 1, five: 5, nine: 9, ten: 10, twenty: 20, 'fifty-pages': 400 };
export function amount(value: string | null, currency = 'CNY', reasons: string[] = []): Amount {
  return { value, currency, reasons, coverage: { available: value === null ? 0 : 8, total: 8 }, originals: value === null ? {} : { [currency]: value }, fxSource: 'Mock 固定展示快照 · 2026-10-15（非实时汇率）' };
}
const scopeKey = (request: HomeRequest) => JSON.stringify([request.market, request.accountId, request.period]);
const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** Deterministic supplied display snapshots. Never reads trades, a database or the network. */
export function createMockSource(options: { scenario: Scenario; delayMs?: number; failNext?: boolean }): HomepageSource {
  let failNext = options.failNext ?? false;
  const issued = new Map<string, HomeView>();
  const wait = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); if (failNext) { failNext = false; reject(new Error('模拟读取失败，请保留当前视图后重试')); } else resolve(); }, options.delayMs ?? 30);
    signal.addEventListener('abort', abort, { once: true });
  });
  const allRows = (market: HomeRequest['market'] = 'all'): Holding[] => Array.from({ length: counts[options.scenario] ?? 8 }, (_, i) => {
    const seed = seeds[i % seeds.length];
    const native = [['182050','14025'],['135280','13080'],['9418','628'],['25520','1820'],['38600','-2750'],['65940','4020'],['6762','192'],['19750','650']][i % 8];
    const currency = market === 'HK' ? 'HKD' : market === 'US' ? 'USD' : 'CNY';
    return { id: `account-${i % 2 + 1}:${seed[2]}:${seed[1]}:${i}`, name: (options.scenario === 'extreme' ? `${seed[0]} · 超长持仓名称用于核对完整名称与精度的边界展示` : seed[0]) + (i >= 8 ? ` · ${i + 1}` : ''), code: seed[1], exchange: seed[2], market: seed[3], accountId: `account-${i % 2 + 1}`, currency: seed[4], holdingDays: [288,207,101,0,null,55,100,365][i % 8], quantity: options.scenario === 'extreme' ? '-12345678.123456' : seed[5], cost: options.scenario === 'unknown' && i === 0 ? null : seed[6], price: options.scenario === 'unknown' && i === 0 ? null : seed[7], marketValue: amount(options.scenario === 'unknown' && i === 0 ? null : options.scenario === 'extreme' ? '123456789012.3456789' : market === 'all' || market === 'CN' ? seed[8] : native[0], currency), unrealized: amount(options.scenario === 'unknown' && i === 1 ? '0' : market === 'all' || market === 'CN' ? seed[9] : native[1], currency) };
  });
  const filtered = (request: HomeRequest) => allRows(request.market).filter(row => (request.market === 'all' || row.market === request.market) && (request.accountId === 'all' || row.accountId === request.accountId) && `${row.name} ${row.code} ${row.exchange}`.toLowerCase().includes(request.query.trim().toLowerCase())).sort((a, b) => {
    const order = request.sort === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : new Decimal(a[request.sort].value ?? '-1e100').comparedTo(b[request.sort].value ?? '-1e100');
    return request.direction === 'asc' ? order : -order;
  });
  const validate = (stamp: Stamp, id: string) => {
    const view = issued.get(stamp.version);
    if (!view || view.stamp.scope !== stamp.scope || view.stamp.asOf !== stamp.asOf || view.stamp.reportCurrency !== stamp.reportCurrency) throw new Error('结果版本或范围不匹配');
    const row = allRows(view.request.market).find(item => item.id === id && (view.request.market === 'all' || item.market === view.request.market) && (view.request.accountId === 'all' || item.accountId === view.request.accountId));
    if (!row) throw new Error('持仓不属于当前范围');
    return row;
  };
  return {
    async readHome(request, signal) {
      await wait(signal);
      const currency = request.market === 'HK' ? 'HKD' : request.market === 'US' ? 'USD' : 'CNY';
      const scopedAmount = (value: string | null, reasons: string[] = []) => amount(value, currency, reasons);
      const rows = filtered(request);
      const totals = (fixtureTotals as Record<string, { marketValue: string; unrealized: string }>)[`${options.scenario}:${request.market}:${request.accountId}`];
      const pages = Math.ceil(rows.length / 8), page = Math.min(Math.max(1, request.page), Math.max(1, pages));
      const missing = options.scenario === 'unknown' || options.scenario === 'partial';
      const reasons = missing ? ['部分行情尚未覆盖，展示值仅为已知部分'] : [];
      const periodValues = request.period.preset === 'month' ? ['3240.55','2400','840.55'] : request.period.preset === 'week' ? ['-860.25','-500','-360.25'] : ['18420.00','12180','6240'];
      const scopedPeriods = request.period.preset === 'month' ? (request.market === 'US' ? ['1040','800','240'] : request.market === 'HK' ? ['640','500','140'] : periodValues) : request.period.preset === 'week' ? (request.market === 'US' ? ['-240','-180','-60'] : request.market === 'HK' ? ['-160','-100','-60'] : periodValues) : request.market === 'all' && request.accountId === 'all' ? periodValues : request.market === 'US' ? ['5420','4000','1420'] : request.market === 'HK' ? ['3000','2000','1000'] : ['10000','6180','3820'];
      const [net, realized, change] = scopedPeriods;
      const stamp: Stamp = { scope: scopeKey(request), version: JSON.stringify([options.scenario, scopeKey(request), request.query, request.sort, request.direction, page]), asOf: TODAY, reportCurrency: currency };
      // Values are fixture snapshots rather than browser calculations from executions.
      const snapshots = ['1200', '810', '2400', '-650', '4200', '3640', '8800', '7100', '10900', '9600', '14600', net];
      const from = new Date(`${request.period.from}T00:00:00Z`).getTime(), to = new Date(`${request.period.to}T00:00:00Z`).getTime();
      // One point per calendar date; values select supplied illustrative snapshots, never trade calculations.
      const dayCount = Math.max(1, Math.min(3660, Math.round((to - from) / 86400000) + 1));
      const points = Array.from({ length: dayCount }, (_, index) => {
        const businessDate = new Date(from + index * 86400000).toISOString().slice(0, 10);
        const fixtureIndex = Math.min(11, Math.floor(index * 12 / dayCount));
        const absent = (options.scenario === 'gaps' || missing) && index === Math.floor(dayCount / 2);
        const latest = index === dayCount - 1;
        const historicalMarketValue = request.market === 'US' ? '14000.1234' : request.market === 'HK' ? '165000.4567' : '520000.123456';
        return { key: `${index}:${businessDate}`, businessDate, state: absent ? 'source-missing' as const : businessDate > TODAY ? 'future' as const : 'value' as const, plottable: !absent && businessDate <= TODAY, marketValue: scopedAmount(latest ? totals.marketValue : historicalMarketValue), unrealized: scopedAmount(latest ? totals.unrealized : '2400.123456'), realized: scopedAmount(realized), net: scopedAmount(absent ? null : snapshots[fixtureIndex], absent ? ['该日行情缺失'] : []), periodNet: scopedAmount(absent ? null : snapshots[fixtureIndex]), periodFees: scopedAmount('286.40'), reasons: absent ? ['该日行情缺失，曲线不连接'] : [] };
      });
      const view: HomeView = { stamp, request: { ...request, page }, metrics: { net: scopedAmount(missing ? null : net, reasons), periodRealized: scopedAmount(realized), unrealizedChange: scopedAmount(change), currentMarketValue: scopedAmount(totals.marketValue) }, currentUnrealized: scopedAmount(totals.unrealized), series: { version: stamp.version, boundary: { effectiveEnd: request.period.to, asOf: TODAY }, points }, holdings: { rows: rows.slice((page - 1) * 8, page * 8), total: rows.length, page, pages, marketValue: scopedAmount(totals.marketValue), unrealized: scopedAmount(totals.unrealized), sortAvailable: !missing }, accounts: [{ id: 'all', name: '全部实盘账户' }, { id: 'account-1', name: '招商证券 · 实盘' }, { id: 'account-2', name: '海外证券 · 实盘' }], reasons };
      issued.set(stamp.version, view);
      return view;
    },
    async readHolding(stamp, id, signal) { await wait(signal); return { stamp, holding: validate(stamp, id), description: '模拟持仓详情；身份由账户、交易所和标的代码共同确定。' }; },
    async readTrades(stamp, id, signal) { await wait(signal); const row = validate(stamp, id); return { stamp, holdingId: id, name: row.name, trades: [{ id: `${id}:trade-1`, date: '2026-10-08', side: '买入', quantity: row.quantity??'未知', price: row.cost, currency: row.currency }] }; },
    async exportHoldings(request, signal) { await wait(signal); return '\uFEFF' + [['名称', '代码', '交易所', '原币', '持有数量', '成本价', '最新价', '报告币种', '市值', '浮盈'], ...filtered(request).map(row => [row.name, row.code, row.exchange, row.currency, row.quantity, row.cost ?? '', row.price ?? '', row.marketValue.currency, row.marketValue.value ?? '', row.unrealized.value ?? ''])].map(row => row.map(value=>csvCell(value??'未知')).join(',')).join('\r\n') + '\r\n'; },
    async repair(_request, signal) { await wait(signal); return { remainingReasons: options.scenario === 'partial' ? ['Mock 剩余行情仍未覆盖'] : [] }; },
  };
}
