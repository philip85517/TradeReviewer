import Decimal from 'decimal.js';
import { LibraryReadError, type Fact, type LibraryReadPort, type PracticeQuery, type ReadContext, type ScenarioId } from './contracts';
import { fixtures } from './fixtures';

const version = 'mock-2026-10';
const known = <T>(value: T): Fact<T> => ({ state: 'known', value });
const noSamples = { state: 'unknown', reasonCode: 'no-calculable-practices', reason: '没有可计算的练习' } as const;
const defaultScope = { from: '2026-10-01', to: '2026-10-31', market: '', accountId: '', search: '' };
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
  return {
    async readOptions(_input, context) {
      await ready(context, scenario === 'slow' ? 300 : 0);
      return { snapshotVersion: version, defaultScope, markets: [{ id: 'CN', label: 'A股' }], accounts: [{ id: 'simulation', label: '模拟账户' }] };
    },
    async readPracticePage(query: PracticeQuery, context) {
      await ready(context, scenario === 'slow' ? 300 : 0);
      if (scenario === 'retry' && attempts++ === 0) throw new LibraryReadError('network', '暂时无法加载', true);
      const search = query.search.trim().toLowerCase();
      const filtered = rows.filter(row => row.practiceDate >= query.from && row.practiceDate <= query.to && (!query.market || row.instrument.market === query.market) && (!query.accountId || row.account.id === query.accountId) && (!search || `${row.instrument.name} ${row.instrument.symbol} ${row.key.practiceId}`.toLowerCase().includes(search)));
      filtered.sort ( (a, b) => (a.practiceDate.localeCompare(b.practiceDate) || a.sequence - b.sequence || a.key.practiceId.localeCompare(b.key.practiceId)) * (query.sort === 'date-asc' ? 1 : -1));
      const calculated = filtered.filter(row => row.net.state === 'known');
      const total = calculated.reduce((sum, row) => sum.plus(row.net.state === 'known' ? row.net.value.amount : 0), new Decimal(0));
      const winners = calculated.filter(row => row.net.state === 'known' && new Decimal(row.net.value.amount).greaterThan(0)).length;
      const pageCount = Math.max(1, Math.ceil(filtered.length / 6));
      const pageIndex = Math.min(pageCount, Math.max(1, Math.floor(query.pageIndex) || 1));
      return { query: { ...query, pageIndex }, rows: filtered.slice((pageIndex - 1) * 6, pageIndex * 6), pageCount, totalCount: filtered.length, calculableCount: calculated.length, unknownCount: filtered.length - calculated.length, scopeNet: known({ amount: total.toString(), currency: 'CNY' }), scopeWinRate: calculated.length ? known(new Decimal(winners).div(calculated.length).toFixed(2)) : noSamples, snapshotVersion: version };
    },
    async readPracticeDetail(_key, context) { await ready(context); throw new LibraryReadError('contract', '详情暂不可用', true); },
    async readPairPage(_key, _page, context) { await ready(context); throw new LibraryReadError('contract', '配对暂不可用', true); },
  };
}
