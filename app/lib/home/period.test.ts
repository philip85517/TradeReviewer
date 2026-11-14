import { describe, expect, it } from 'vitest';
import { projectPeriod, convertNative } from './period';
import type { NativeDay, NativeBucket } from './contracts';

const bucket = (patch: Partial<NativeBucket> = {}): NativeBucket => ({ market: '0', unrealized: '0', realized: '0', realizedMissing: 0, fees: '0', feesMissing: 0, count: 1, marketKnown: 1, unrealizedKnown: 1, lifetimeComplete: true, reasons: [], ...patch });
const day = (date: string, patch: Partial<NativeBucket> = {}, rate = '8'): NativeDay => ({ date, buckets: { USD: bucket(patch) }, fx: { USD: { rate, source: 'test/known-at-boundary', asOf: date } }, reasons: [] });

describe('native boundary projection', () => {
  it('does not assign a month-only expense to an arbitrary day inside that month',()=>{
    const end=day('2026-01-31'); end.feeWindows=[{id:'f',accountId:'a',market:'US',currency:'USD',from:'2026-01-01',to:'2026-01-31',knownAt:'2026-01-31T15:59:59.999Z',amount:'10'}];
    expect(projectPeriod(day('2025-12-31'),[end],{from:'2026-01-01',to:end.date},'USD',end.date).fees.value).toBe('10');
    expect(projectPeriod(day('2026-01-14'),[end],{from:'2026-01-15',to:end.date},'USD',end.date).fees.value).toBeNull();
  });
  it('subtracts native values before using endpoint FX; fees are not deducted twice', () => {
    const result = projectPeriod(day('2026-01-01', { unrealized: '20' }, '7'), [day('2026-01-02', { realized: '30', fees: '2' })], { from: '2026-01-02', to: '2026-01-02' }, 'CNY', '2026-01-02');
    expect(result.realized.value).toBe('240');
    expect(result.unrealizedChange.value).toBe('-160');
    expect(result.net.value).toBe('80');
    expect(result.fees.value).toBe('16');
    expect(result.points[0].periodNet.value).toBe('80');
  });
  it('isolates old unknown realized contributions but preserves unknown cost endpoints', () => {
    const base = day('2026-01-01', { realizedMissing: 1, unrealized: null, unrealizedKnown: 0 });
    const end = day('2026-01-02', { realized: '3', realizedMissing: 1 });
    const result = projectPeriod(base, [end], { from: end.date, to: end.date }, 'USD', end.date);
    expect(result.realized.value).toBe('3');
    expect(result.unrealizedChange.value).toBeNull();
    expect(result.net.value).toBeNull();
  });
  it('does not substitute zero for missing historical FX or unknown inception', () => {
    const end = { ...day('2026-01-02', { realized: '10' }), fx: {} };
    expect(projectPeriod(day('2026-01-01'), [end], { from: end.date, to: end.date }, 'CNY', end.date).net.value).toBeNull();
    expect(projectPeriod(null, [day('2026-01-02')], { from: '2025-01-01', to: '2026-01-02' }, 'USD', '2026-01-02').net.value).toBeNull();
  });
  it('converts proven zero without FX while preserving unknown and nonzero dependencies', () => {
    expect(convertNative({ CNY: '0' }, 'CNY', {}).value).toBe('0');
    expect(convertNative({ CNY: '10', USD: '0' }, 'CNY', {}).value).toBe('10');
    expect(convertNative({ USD: null }, 'CNY', {}).value).toBeNull();
    expect(convertNative({ USD: '1' }, 'CNY', {})).toMatchObject({ value: null, fxSource: '所需汇率缺失' });
  });
  it('keeps exact decimals and marks future dates without synthetic zero points', () => {
    const result = projectPeriod(day('2026-01-01'), [day('2026-01-02', { realized: '9007199254740993.12345678' }, '1')], { from: '2026-01-02', to: '2026-01-04' }, 'USD', '2026-01-02');
    expect(result.net.value).toBe('9007199254740993.12345678');
    expect(result.points.map(p => [p.businessDate, p.state, p.periodNet.value])).toEqual([
      ['2026-01-02', 'value', '9007199254740993.12345678'], ['2026-01-03', 'future', null], ['2026-01-04', 'future', null],
    ]);
  });
  it('rejects decreasing missing prefixes instead of publishing invented precision', () => {
    expect(() => projectPeriod(day('2026-01-01', { realizedMissing: 2 }), [day('2026-01-02')], { from: '2026-01-02', to: '2026-01-02' }, 'USD', '2026-01-02')).toThrow(/prefix/);
  });
});
