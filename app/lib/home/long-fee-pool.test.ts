import { describe, expect, it } from 'vitest';
import { allocateLongFeePool, sumFeeAmounts, type FeePoolExecution } from './long-fee-pool';

const execution = (executionId: string, side: 'buy' | 'sell', quantity: string, value: string | null, currency = 'USD'): FeePoolExecution => ({ executionId, side, quantity, fee: { currency, value } });
const amount = (value: string | null, knownSubtotal = value, reasons: string[] = []) => ({ currency: 'USD', value, knownSubtotal, reasons });

describe('exact ordinary long accounting fee pool', () => {
    it('allocates partial entry cost, exit fee and remaining independently without mutating input', () => {
        const input = [execution('b', 'buy', '100', '1'), execution('s', 'sell', '40', '0.4')];
        const before = JSON.stringify(input);
        const result = allocateLongFeePool(input);
        expect(result.valid).toBe(true);
        expect(result.closes[0]).toEqual({ closingExecutionId: 's', entry: [amount('0.4')], exit: [amount('0.4')], total: [amount('0.8')] });
        expect(result.remaining).toEqual([amount('0.6')]);
        expect(result.sourceConservation.every(source => source.exactConserved && source.decimalComplete)).toBe(true);
        expect(JSON.stringify(input)).toBe(before);
    });
    it.each([
        ['75', '75', '0.75', '0.75', '1.5', '1.5', '2.25', '2.25', true],
        ['80', '70', '0.8', '0.7', '1.6', '1.4', '2.4', '2.1', false],
    ])('uses the whole moving pool for closes %s / %s, independently of LIFO', (q1, q2, f1, f2, e1, e2, t1, t2, decimalComplete) => {
        const r = allocateLongFeePool([execution('b1', 'buy', '100', '1'), execution('b2', 'buy', '50', '2'), execution('s1', 'sell', q1, f1), execution('s2', 'sell', q2, f2)]);
        expect(r.valid).toBe(true);
        expect(r.closes.map(close => close.entry)).toEqual([[amount(e1)], [amount(e2)]]);
        expect(r.closes.map(close => close.total)).toEqual([[amount(t1)], [amount(t2)]]);
        expect(r.remaining).toEqual([amount('0')]);
        expect(r.sourceConservation.slice(0, 2)).toEqual(['b1', 'b2'].map((executionId, i) => ({ executionId, currency: 'USD', sourceValue: String(i + 1), exactConserved: true, decimalComplete })));
        if (decimalComplete) {
            expect(r.entryAllocations.map(part => part.amount)).toEqual([amount('0.5'), amount('1'), amount('0.5'), amount('1')]);
        }
        if (!decimalComplete) {
            const shares = r.entryAllocations.filter(part => part.closingExecutionId === 's1');
            expect(shares.every(part => part.amount.value === null && part.amount.reasons.includes('non-terminating-decimal'))).toBe(true);
            expect(sumFeeAmounts(shares.map(part => part.amount))).toEqual([amount(null, null, ['non-terminating-decimal'])]);
        }
    });
    it('preserves unknown sources, known subtotals, explicit zero and separate currencies', () => {
        const r = allocateLongFeePool([execution('u', 'buy', '1', null), execution('k', 'buy', '1', '2'), execution('z', 'buy', '1', '0', 'CNY'), execution('s', 'sell', '3', '0')]);
        expect(r.valid).toBe(true);
        expect(r.closes[0].total).toEqual([amount(null, '2', ['unknown-source-fee']), { currency: 'CNY', value: '0', knownSubtotal: '0', reasons: [] }]);
        expect(r.sourceConservation[0].exactConserved).toBeNull();
        expect(sumFeeAmounts([amount('2'), amount(null, '3', ['unknown-source-fee'])])).toEqual([amount(null, '5', ['unknown-source-fee'])]);
        expect(sumFeeAmounts(JSON.parse(JSON.stringify(r.closes[0].total)))).toEqual(sumFeeAmounts(r.closes[0].total));
        expect(sumFeeAmounts([amount('2'), amount('3', 'NaN')])).toEqual([amount(null, '2', ['invalid-fee-amount'])]);
        expect(sumFeeAmounts([])).toEqual([]);
        expect(allocateLongFeePool([]).remaining).toEqual([]);
    });
    it('retains more than 20 decimal digits and does not manufacture rounded finite output', () => {
        const value = '123456789012345678901.000000000000000000001';
        const r = allocateLongFeePool([execution('b', 'buy', '2', value), execution('s', 'sell', '1', '0')]);
        expect(r.closes[0].entry).toEqual([amount('61728394506172839450.5000000000000000000005')]);
        const tiny = allocateLongFeePool([execution('b', 'buy', '10', `0.${'0'.repeat(1021)}1`), execution('s', 'sell', '1', '0')]);
        expect(tiny.closes[0].entry[0]).toMatchObject({ value: null, reasons: ['decimal-length-exceeded'] });
    });
    it.each(['0', '-1', 'NaN', '1e2', '.1', '1'.repeat(1025)])('rejects unsafe quantity %s with no certified allocation', quantity => {
        const r = allocateLongFeePool([execution('b', 'buy', quantity, '1')]);
        expect(r).toMatchObject({ valid: false, entryAllocations: [], closes: [], remaining: [], sourceConservation: [] });
    });
    it('rejects oversell, duplicate IDs, invalid currencies and malformed fees atomically', () => {
        for (const input of [
            [execution('b', 'buy', '1', '1'), execution('s', 'sell', '2', '0')],
            [execution('b', 'buy', '1', '1'), execution('b', 'buy', '1', '1')],
            ...['XXX', 'UNKNOWN', 'usd', ''].map(currency => [execution('b', 'buy', '1', '1', currency)]),
            ...['-1', 'NaN', '1e2'].map(fee => [execution('b', 'buy', '1', fee)]),
        ]) expect(allocateLongFeePool(input)).toMatchObject({ valid: false, entryAllocations: [], closes: [], remaining: [], sourceConservation: [] });
    });
});
