import Decimal from 'decimal.js';
import type { Fact, PracticeRow, ScenarioId } from './contracts';

const known = <T>(value: T): Fact<T> => ({ state: 'known', value });
const unknown = { state: 'unknown', reasonCode: 'missing-end-price', reason: '缺少结束时点价格' } as const;
const samples = [
  ['A', '贵州茅台', '600519', '15', 1, 3, 2, '70', null],
  ['E', '贵州茅台', '600519', '15', 2, 2, 1, '0', '98'],
  ['C', '平安银行', '000001', '16', 1, 2, 1, '0', '354'],
  ['D', '宁德时代', '300750', '17', 1, 2, 1, '0', '-78'],
  ['B', '贵州茅台', '600519', '18', 1, 2, 1, '0', '-104'],
  ['F', '招商银行', '600036', '19', 1, 2, 1, '0', '118'],
] as const;
export function fixtures(scenario: ScenarioId): readonly PracticeRow[] {
  if (scenario === 'empty') return [];
  const entries: readonly (readonly [string, string, string, string, number, number, number, string, string | null])[] = scenario === 'pagination'
    ? [...samples, ...Array.from({length: 7}, (_, i) => [`P${i + 1}`, `测试${i + 1}`, `90000${i}`, String(15 + i % 5), i + 3, 2, 1, '0', '10'] as const)] : samples;
  return entries.map(([id, name, symbol, day, sequence, executions, pairs, open, original]) => {
    const missingPairs = { state: 'unknown', reasonCode: 'missing-pairs', reason: '配对数据缺失' } as const;
    const amount = scenario === 'extreme' && id === 'C' ? '0' : id === 'A' && scenario === 'explicit-end-price' ? '4677' : scenario === 'extreme' && id === 'B' ? '12345678901234567890' : original;
    const net = amount === null ? unknown : known({ amount, currency: 'CNY' });
    return {
      key: { practiceId: id, revisionId: `revision-${id}`, practiceVersion: '1' },
      instrument: { id: symbol, symbol, name: scenario === 'extreme' && id === 'B' ? '贵州茅台超长中文证券名称用于验证完整展示和极端数值布局测试' : name, market: 'CN' },
      account: { id: 'simulation', label: '模拟账户' }, sequence,
      practiceDate: `2026-10-${day}`, practiceDateSource: 'filename',
      historicalFrom: '2022-01-01', historicalTo: '2023-01-01', importedAt: '2026-10-31T00:00:00Z', displayTimezone: 'Asia/Shanghai',
      executionCount: scenario === 'pagination' && id === 'P1' ? 14 : executions, pairCount: scenario === 'extreme' && id === 'D' ? missingPairs : known(scenario === 'pagination' && id === 'P1' ? 7 : pairs), openQuantity: scenario === 'extreme' && id === 'D' ? missingPairs : known(open), net,
      returnRate: amount === null ? unknown : known(new Decimal(amount).div(100000).toFixed()),
    };
  });
}
