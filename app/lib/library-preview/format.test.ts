import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';
describe('money formatting', () => {
  it('distinguishes zero and unknown', () => {
    expect(formatMoney({state:'known',value:{amount:'0',currency:'CNY'}})).toEqual({display:'0.00',fullValue:'0.00 CNY'});
    expect(formatMoney({state:'unknown',reasonCode:'missing',reason:'缺失'})).toEqual({display:'—',fullValue:'缺失'});
  });
  it('formats signed thresholds and preserves huge full values', () => {
    expect(formatMoney({state:'known',value:{amount:'-10000',currency:'CNY'}}).display).toBe('-1.00万');
    expect(formatMoney({state:'known',value:{amount:'100000000',currency:'CNY'}}).display).toBe('+1.00亿');
    expect(formatMoney({state:'known',value:{amount:'12345678901234567890.12',currency:'CNY'}}).fullValue).toBe('+12345678901234567890.12 CNY');
  });
});
