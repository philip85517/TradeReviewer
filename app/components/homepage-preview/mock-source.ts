import Decimal from 'decimal.js';
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
  const allRows = (): Holding[] => Array.from({ length: counts[options.scenario] ?? 8 }, (_, i) => {
    const seed = seeds[i % seeds.length];
    return { id: `account-${i % 2 + 1}:${seed[2]}:${seed[1]}:${i}`, name: seed[0] + (i >= 8 ? ` · ${i + 1}` : ''), code: seed[1], exchange: seed[2], market: seed[3], accountId: `account-${i % 2 + 1}`, currency: seed[4], quantity: options.scenario === 'extreme' ? '-12345678.123456' : seed[5], cost: options.scenario === 'unknown' && i === 0 ? null : seed[6], price: options.scenario === 'unknown' && i === 0 ? null : seed[7], marketValue: amount(options.scenario === 'extreme' ? '123456789012.3456789' : seed[8]), unrealized: amount(options.scenario === 'unknown' && i === 1 ? '0' : seed[9]) };
  });
  const filtered = (request: HomeRequest) => allRows().filter(row => (request.market === 'all' || row.market === request.market) && (request.accountId === 'all' || row.accountId === request.accountId) && `${row.name} ${row.code} ${row.exchange}`.toLowerCase().includes(request.query.trim().toLowerCase())).sort((a, b) => {
    const order = request.sort === 'name' ? a.id.localeCompare(b.id) : new Decimal(a[request.sort].value ?? '-1e100').comparedTo(b[request.sort].value ?? '-1e100');
    return request.direction === 'asc' ? order : -order;
  });
  const validate = (stamp: Stamp, id: string) => {
    const view = issued.get(stamp.version);
    if (!view || view.stamp.scope !== stamp.scope || view.stamp.asOf !== stamp.asOf || view.stamp.reportCurrency !== stamp.reportCurrency) throw new Error('结果版本或范围不匹配');
    const row = allRows().find(item => item.id === id && (view.request.market === 'all' || item.market === view.request.market) && (view.request.accountId === 'all' || item.accountId === view.request.accountId));
    if (!row) throw new Error('持仓不属于当前范围');
    return row;
  };
  return {
    async readHome(request, signal) {
      await wait(signal);
      const currency = request.market === 'HK' ? 'HKD' : request.market === 'US' ? 'USD' : 'CNY';
      const scopedAmount = (value: string | null, reasons: string[] = []) => amount(value, currency, reasons);
      const rows = filtered(request).map(row => ({ ...row, marketValue: { ...row.marketValue, currency }, unrealized: { ...row.unrealized, currency } }));
      const pages = Math.ceil(rows.length / 8), page = Math.min(Math.max(1, request.page), Math.max(1, pages));
      const missing = options.scenario === 'unknown' || options.scenario === 'partial';
      const reasons = missing ? ['部分行情尚未覆盖，展示值仅为已知部分'] : [];
      const net = request.period.preset === 'month' ? '3240.55' : request.period.preset === 'week' ? '-860.25' : '18420.00';
      const stamp: Stamp = { scope: scopeKey(request), version: JSON.stringify([options.scenario, scopeKey(request), request.query, request.sort, request.direction, page]), asOf: TODAY, reportCurrency: currency };
      // Values are fixture snapshots rather than browser calculations from executions.
      const snapshots = ['1200', '810', '2400', '-650', '4200', '3640', '8800', '7100', '10900', '9600', '14600', net];
      const from = new Date(`${request.period.from}T00:00:00Z`).getTime(), to = new Date(`${request.period.to}T00:00:00Z`).getTime();
      const points = snapshots.map((value, index) => {
        const businessDate = new Date(from + Math.round((to - from) / 86400000 * index / 11) * 86400000).toISOString().slice(0, 10);
        const absent = (options.scenario === 'gaps' || missing) && index === 5;
        return { key: `${index}:${businessDate}`, businessDate, state: absent ? 'source-missing' as const : businessDate > TODAY ? 'future' as const : 'value' as const, plottable: !absent && businessDate <= TODAY, marketValue: scopedAmount('668420.50'), unrealized: scopedAmount('6240'), realized: scopedAmount('12180'), net: scopedAmount(absent ? null : value, absent ? ['该日行情缺失'] : []), periodNet: scopedAmount(absent ? null : value), periodFees: scopedAmount('286.40'), reasons: absent ? ['该日行情缺失，曲线不连接'] : [] };
      });
      const view: HomeView = { stamp, request: { ...request, page }, metrics: { net: scopedAmount(missing ? null : net, reasons), periodRealized: scopedAmount('12180'), unrealizedChange: scopedAmount('6240'), currentMarketValue: scopedAmount(rows.length ? '668420.50' : '0') }, currentUnrealized: scopedAmount('6240'), series: { version: stamp.version, boundary: { effectiveEnd: request.period.to, asOf: TODAY }, points }, holdings: { rows: rows.slice((page - 1) * 8, page * 8), total: rows.length, page, pages, marketValue: scopedAmount(rows.length ? '668420.50' : '0'), unrealized: scopedAmount('6240'), sortAvailable: !missing }, accounts: [{ id: 'all', name: '全部实盘账户' }, { id: 'account-1', name: '招商证券 · 实盘' }, { id: 'account-2', name: '海外证券 · 实盘' }], reasons };
      issued.set(stamp.version, view);
      return view;
    },
    async readHolding(stamp, id, signal) { await wait(signal); return { stamp, holding: validate(stamp, id), description: '模拟持仓详情；身份由账户、交易所和标的代码共同确定。' }; },
    async readTrades(stamp, id, signal) { await wait(signal); const row = validate(stamp, id); return { stamp, holdingId: id, name: row.name, trades: [{ id: `${id}:trade-1`, date: '2026-10-08', side: '买入', quantity: row.quantity, price: row.cost ?? '0', currency: row.currency }] }; },
    async exportHoldings(request, signal) { await wait(signal); return '\uFEFF' + [['名称', '代码', '交易所', '币种', '持有数量', '成本价', '最新价', '市值', '浮盈'], ...filtered(request).map(row => [row.name, row.code, row.exchange, row.currency, row.quantity, row.cost ?? '', row.price ?? '', row.marketValue.value ?? '', row.unrealized.value ?? ''])].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'; },
    async repair(_request, signal) { await wait(signal); return { remainingReasons: options.scenario === 'partial' ? ['Mock 剩余行情仍未覆盖'] : [] }; },
  };
}
