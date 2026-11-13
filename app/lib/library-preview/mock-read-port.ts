import Decimal from 'decimal.js';
import { LibraryReadError, type Fact, type LibraryReadPort, type PracticeQuery, type PracticeKey, type PracticeRow, type PairPage, type ReadContext, type ScenarioId } from './contracts';
import { fixtures } from './fixtures';

const version = 'mock-2026-10';
const known = <T>(value: T): Fact<T> => ({ state: 'known', value });
const noSamples = { state: 'unknown', reasonCode: 'no-calculable-practices', reason: '没有可计算的练习' } as const;
const defaultScope = { from: '2026-10-15', to: '2026-10-19', market: 'all', accountId: 'all', search: '' };
function abortError() { return new DOMException('Aborted', 'AbortError'); }
async function ready(context: ReadContext, delay = 0) {
  if (context.signal.aborted) throw abortError();
  if (context.snapshotVersion && context.snapshotVersion !== version) throw new LibraryReadError('version-expired', '快照已过期', false);
  if (delay) await new Promise<void>((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => { context.signal.removeEventListener('abort', onAbort); resolve(); }, delay);
    context.signal.addEventListener('abort', onAbort, { once: true });
  });
  if (context.signal.aborted) throw abortError();
}
export function createMockReadPort(scenario: ScenarioId): LibraryReadPort {
  const rows = fixtures(scenario);
  let attempts = 0;
  let detailAttempts = 0;
  const money = (amount: string) => known({ amount, currency: 'CNY' });
  const missing = { state: 'unknown', reasonCode: 'missing-end-price', reason: '缺少结束时点价格' } as const;
  const noValuation = { state: 'unknown', reasonCode: 'no-open-position', reason: '没有剩余持仓，无需估值' } as const;
  function lookup(key: { practiceId: string } & Partial<Omit<PracticeKey, 'practiceId'>>): PracticeRow {
    const row = rows.find(item => item.key.practiceId === key.practiceId);
    if (!row || scenario === 'not-found') throw new LibraryReadError('not-found', '练习不存在', false);
    if (scenario === 'version-expired' || (key.revisionId !== undefined && key.revisionId !== row.key.revisionId) || (key.practiceVersion !== undefined && key.practiceVersion !== row.key.practiceVersion)) throw new LibraryReadError('version-expired', '版本已过期', false);
    return row;
  }
  function pairs(row: PracticeRow, pageIndex: number): PairPage {
    const id = row.key.practiceId;
    const values = scenario === 'extreme' && id === 'D' ? [] : scenario === 'pagination' && id === 'P1' ? Array.from({ length: 7 }, (_, i) => ['2022-01-01', '2023-01-01', '1', i === 6 ? '4' : '1']) : id === 'A' ? [['2022-10-05', '2023-01-01', '50', '990'], ['2022-01-01', '2023-01-01', '30', '894']] : [['2022-01-01', '2023-01-01', '1', row.net.state === 'known' ? row.net.value.amount : '0']];
    const all = values.map(([openedAt, closedAt, quantity, net], index) => ({ pairId: `${id}-${index + 1}`, key: row.key, openedAt, closedAt, quantity, net: money(net) }));
    const pageCount = Math.max(1, Math.ceil(all.length / 6));
    const current = Math.min(pageCount, Math.max(1, Math.floor(pageIndex) || 1));
    return { key: row.key, snapshotVersion: version, pageIndex: current, pageCount, totalCount: all.length, rows: all.slice((current - 1) * 6, current * 6), completeness: scenario === 'extreme' && id === 'D' ? { state: 'unknown', reasonCode: 'missing-pairs', reason: '配对数据缺失' } : known('complete') };
  }
  return {
    async readOptions(_input, context) {
      await ready(context, scenario === 'slow' ? 300 : 0);
      return { snapshotVersion: version, defaultScope, markets: [{ id: 'CN', label: 'A股' }], accounts: [{ id: 'simulation', label: '模拟账户' }] };
    },
    async readPracticePage(query: PracticeQuery, context) {
      await ready(context, scenario === 'slow' ? 300 : 0);
      if (scenario === 'retry' && attempts++ === 0) throw new LibraryReadError('network', '暂时无法加载', true);
      const search = query.search.trim().toLowerCase();
      const filtered = rows.filter(row => (!query.from || row.practiceDate >= query.from) && (!query.to || row.practiceDate <= query.to) && (!query.market || query.market === 'all' || row.instrument.market === query.market) && (!query.accountId || query.accountId === 'all' || row.account.id === query.accountId) && (!search || `${row.instrument.name} ${row.instrument.symbol} ${row.key.practiceId} ${row.practiceDate} #${String(row.sequence).padStart(2, '0')}`.toLowerCase().includes(search)));
      filtered.sort ( (a, b) => a.practiceDate.localeCompare(b.practiceDate) * (query.sort === 'date-asc' ? 1 : -1) || a.sequence - b.sequence || a.key.practiceId.localeCompare(b.key.practiceId));
      const calculated = filtered.filter(row => row.net.state === 'known');
      const total = calculated.reduce((sum, row) => sum.plus(row.net.state === 'known' ? row.net.value.amount : 0), new Decimal(0));
      const winners = calculated.filter(row => row.net.state === 'known' && new Decimal(row.net.value.amount).greaterThan(0)).length;
      const pageCount = Math.max(1, Math.ceil(filtered.length / 6));
      const pageIndex = Math.min(pageCount, Math.max(1, Math.floor(query.pageIndex) || 1));
      return { query: { ...query, pageIndex }, rows: filtered.slice((pageIndex - 1) * 6, pageIndex * 6), pageCount, totalCount: filtered.length, calculableCount: calculated.length, unknownCount: filtered.length - calculated.length, scopeNet: known({ amount: total.toString(), currency: 'CNY' }), scopeWinRate: calculated.length ? known(new Decimal(winners).div(calculated.length).toFixed(2)) : noSamples, snapshotVersion: version };
    },
    async readPracticeDetail(key, context) {
      await ready(context, scenario === 'slow' ? 300 : scenario === 'stale' ? (key.practiceId === 'A' ? 800 : 40) : 0);
      if (scenario === 'retry' && detailAttempts++ === 0) throw new LibraryReadError('network', '暂时无法加载详情', true);
      const practice = lookup(key);
      const isA = practice.key.practiceId === 'A';
      const explicit = isA && scenario === 'explicit-end-price';
      const amount = practice.net.state === 'known' ? practice.net.value.amount : '0';
      return {
        practice, snapshotVersion: version,
        source: { name: `${practice.instrument.symbol}_${practice.practiceDate}_${String(practice.sequence).padStart(2, '0')}.csv`, format: 'CSV' },
        financial: {
          realizedGross: money(isA ? '1900' : new Decimal(amount).plus(2).toString()),
          unrealizedGross: isA ? (explicit ? money('2800') : missing) : money('0'),
          totalFees: money(isA ? '23' : '2'), practiceNet: practice.net,
          closedNet: money(isA ? '1884' : amount), closedFees: money(isA ? '16' : '2'), retainedOpenFees: money(isA ? '7' : '0'), returnRate: practice.returnRate,
        },
        capital: { value: money('100000'), origin: 'default', version: '1' },
        endValuation: isA ? (explicit ? known({ price: '140', currency: 'CNY', barEnd: '2023-01-01' }) : missing) : noValuation,
        pairs: pairs(practice, 1),
        actions: [
          { id: 'import', label: '导入', available: false, reasonCode: 'not-connected', reason: '当前阶段尚未接入导入' },
          { id: 'save-capital', label: '保存资本', available: false, reasonCode: 'not-connected', reason: '当前阶段尚未接入保存' },
          { id: 'replay', label: '回放', available: false, reasonCode: 'missing-real-cycle', reason: '模拟练习尚无真实周期，当前阶段未接入回放' },
        ],
      };
    },
    async readPairPage(key, page, context) { await ready(context, scenario === 'slow' ? 300 : 0); if (!key.revisionId || !key.practiceVersion) throw new LibraryReadError('version-expired', '版本已过期', false); return pairs(lookup(key), page.pageIndex); },
  };
}
