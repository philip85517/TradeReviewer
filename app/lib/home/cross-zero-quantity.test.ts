import { describe, expect, it } from 'vitest';
import { diagnoseCrossZeroQuantity, type CrossZeroExecution } from './cross-zero-quantity';

const e = (executionId: string, side: 'buy' | 'sell', quantity: string): CrossZeroExecution => ({ executionId, side, quantity });
describe('diagnoseCrossZeroQuantity', () => {
  it('splits the final crossing sell exactly', () => {
    expect(diagnoseCrossZeroQuantity([e('a', 'buy', '10'), e('b', 'sell', '15')])).toEqual({ status: 'candidate', reasons: [], crossing: { executionId: 'b', sourceQuantity: '15', closeLongQuantity: '10', openShortQuantity: '5' } });
    expect(diagnoseCrossZeroQuantity([e('a', 'buy', '9007199254740993.1250'), e('b', 'sell', '0.025'), e('c', 'sell', '9007199254740994.2')]).crossing).toEqual({ executionId: 'c', sourceQuantity: '9007199254740994.2', closeLongQuantity: '9007199254740993.1', openShortQuantity: '1.1' });
  });
  it('leaves empty and ordinary long sequences not applicable', () => {
    expect(diagnoseCrossZeroQuantity([]).status).toBe('not-applicable');
    expect(diagnoseCrossZeroQuantity([e('a', 'buy', '2'), e('b', 'sell', '2')]).status).toBe('not-applicable');
  });
  it('rejects the whole scope for invalid or unsupported sequences', () => {
    const cases = [
      [e('a', 'sell', '1')],
      [e('a', 'buy', '1'), e('b', 'sell', '2'), e('c', 'buy', '1')],
      [e('a', 'buy', '1'), e('b', 'sell', '2'), e('c', 'sell', '1')],
      [e('a', 'buy', '1'), e('a', 'sell', '2')],
      [e('a', 'buy', '0')], [e('a', 'buy', '1e2')], [e(' ', 'buy', '1')],
      [e('a', 'buy', '1'.repeat(1025))],
      [{ executionId: 'a', side: 'bad', quantity: '1' } as unknown as CrossZeroExecution],
    ];
    for (const input of cases) {
      const result = diagnoseCrossZeroQuantity(input);
      expect(result.status).toBe('unsupported');
      expect(result.crossing).toBeNull();
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });
});
