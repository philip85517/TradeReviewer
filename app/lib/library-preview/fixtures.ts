import type { Fact, PracticeRow, ScenarioId } from './contracts';

const known = <T>(value: T): Fact<T> => ({ state: 'known', value });
const unknown = { state: 'unknown', reasonCode: 'missing-end-price', reason: '缺少结束时点价格' } as const;
const amounts = [null, '-104', '354', '-78', '98', '118'];
export function fixtures(scenario: ScenarioId): readonly PracticeRow[] {
  if (scenario === 'empty') return [];
  const count = scenario === 'pagination' ? 13 : 6;
  return Array.from({ length: count }, (_, i) => {
    const id = String.fromCharCode(65 + i);
    const amount = i === 0 && scenario === 'explicit-end-price' ? '0' : amounts[i % 6];
    const net = amount === null ? unknown : known({ amount: scenario === 'extreme' && i === 1 ? '12345678901234567890' : amount, currency: 'CNY' });
    return {
      key: { practiceId: id, revisionId: `revision-${id}`, practiceVersion: '1' },
      instrument: { id: `instrument-${id}`, symbol: `60000${i}`, name: `练习 ${id}`, market: 'CN' },
      account: { id: 'simulation', label: '模拟账户' }, sequence: i + 1,
      practiceDate: `2026-10-${String(i + 1).padStart(2, '0')}`, practiceDateSource: 'filename',
      historicalFrom: '2022-01-01', historicalTo: '2023-01-01', importedAt: '2026-10-31T00:00:00Z', displayTimezone: 'Asia/Shanghai',
      executionCount: 2, pairCount: known(1), openQuantity: known(i === 0 ? '70' : '0'), net,
      returnRate: net.state === 'known' ? known(String(Number(net.value.amount) / 100000)) : unknown,
    };
  });
}
