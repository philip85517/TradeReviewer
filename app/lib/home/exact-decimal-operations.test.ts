import { describe, expect, it } from 'vitest';
import { exactDecimalOperation, sumExactDecimals } from './exact-decimal-operations';

describe('exact decimal operations', () => {
  it('checks exact arithmetic without rounding', () => {
    expect(exactDecimalOperation('add', '0.1', '0.2', '0.3')).toBe(true);
    expect(exactDecimalOperation('subtract', '-1.2', '0.3', '-1.5')).toBe(true);
    expect(exactDecimalOperation('multiply', '-2.5', '2', '-5')).toBe(true);
    expect(exactDecimalOperation('divide', '1', '8', '0.125')).toBe(true);
    expect(exactDecimalOperation('divide', '1', '3', '0.' + '3'.repeat(48))).toBe(false);
    expect(exactDecimalOperation('add', '1', '0', '1.' + '0'.repeat(48) + '1')).toBe(false);
    expect(exactDecimalOperation('add', '-0', '0', '-0.0')).toBe(true);
    expect(exactDecimalOperation('divide', '1', '0', '0')).toBe(false);
    expect(exactDecimalOperation('add', '1e2', '0', '100')).toBe(false);
  });
  it('sums signed values and enforces bounds', () => {
    expect(sumExactDecimals(['999999999999999999999999999999', '1', '-0.10'])).toBe('999999999999999999999999999999.9');
    expect(sumExactDecimals([])).toBe('0');
    expect(sumExactDecimals(['-0.0', '0'])).toBe('0');
    expect(sumExactDecimals(['9'.repeat(1024), '1'])).toBeNull();
    expect(sumExactDecimals(['.1'])).toBeNull();
    expect(sumExactDecimals(['1.2\n'])).toBeNull();
    expect(exactDecimalOperation('add', '1\n', '0', '1')).toBe(false);
    expect(sumExactDecimals(['1'.repeat(1025)])).toBeNull();
  });
});
