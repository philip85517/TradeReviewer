import { describe, it, expect } from 'vitest';
import { validateAllocationConservation as validate } from './allocation-conservation';
describe('allocation conservation', () => {
    it('checks quantities and amounts without rounding', () => {
        const input = { sources: [{ executionId: 'e', version: '1', quantity: '15', amounts: [{ kind: 'fee' as const, currency: 'USD', value: '3' }] }], parts: [{ partId: 'a', executionId: 'e', version: '1', quantity: '10', amounts: [{ kind: 'fee' as const, currency: 'USD', value: '2' }] }, { partId: 'b', executionId: 'e', version: '1', quantity: '5', amounts: [{ kind: 'fee' as const, currency: 'USD', value: '1' }] }] };
        const before = JSON.stringify(input);
        expect(validate(input)).toMatchObject({ valid: true, quantityComplete: true, financialKnown: true });
        expect(JSON.stringify(input)).toBe(before);
        input.parts[1].amounts[0].value = '3';
        expect(validate(input).valid).toBe(false);
    });
    it('rejects empty input', () => expect(validate({ sources: [], parts: [] })).toMatchObject({ valid: false, quantityComplete: false, financialKnown: false }));
});
describe('contract edge cases', () => {
    const amount = (kind: 'fee' | 'gross' | 'net', currency: string, value: string | null) => ({ kind, currency, value });
    const source = (quantity = '15', amounts = [amount('fee', 'USD', '3')]) => ({ executionId: 'e', version: '1', quantity, amounts });
    const part = (id: string, quantity: string, amounts = [amount('fee', 'USD', '1')]) => ({ partId: id, executionId: 'e', version: '1', quantity, amounts });
    it('reports invalid amounts on dangling parts', () => {
        const result = validate({ sources: [source()], parts: [{ ...part('a', '15'), executionId: 'missing', amounts: [amount('fee', 'usd', 'NaN')] }] });
        expect(result.issues.some(i => i.code === 'amount_invalid' && i.partId === 'a')).toBe(true);
    });
    it('marks duplicated dimensions invalid', () => {
        const result = validate({ sources: [source('15', [amount('fee', 'USD', '3'), amount('fee', 'USD', '3')])], parts: [part('a', '15', [amount('fee', 'USD', '3')])] });
        expect(result.sources[0].amounts[0].status).toBe('invalid');
    });
    it('rejects copied fee, gross and net', () => {
        for (const kind of ['fee', 'gross', 'net'] as const) {
            const result = validate({ sources: [source('15', [amount(kind, 'USD', '3')])], parts: [part('a', '10', [amount(kind, 'USD', '3')]), part('b', '5', [amount(kind, 'USD', '3')])] });
            expect(result.valid).toBe(false);
            expect(result.sources[0].amounts[0].status).toBe('mismatch');
        }
    });
    it('separates currencies and retains known fee when net is unknown', () => {
        const result = validate({ sources: [source('15', [amount('fee', 'USD', '3'), amount('fee', 'CNY', '4'), amount('net', 'USD', null)])], parts: [part('a', '10', [amount('fee', 'USD', '2'), amount('fee', 'CNY', '3'), amount('net', 'USD', '-4')]), part('b', '5', [amount('fee', 'USD', '1'), amount('fee', 'CNY', '1'), amount('net', 'USD', null)])] });
        expect(result).toMatchObject({ valid: true, quantityComplete: true, financialKnown: false });
        expect(result.sources[0].amounts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'fee', currency: 'USD', status: 'conserved' }), expect.objectContaining({ kind: 'fee', currency: 'CNY', status: 'conserved' }), expect.objectContaining({ kind: 'net', status: 'unknown', knownSubtotal: '-4' })]));
    });
    it('treats absent dimension as unknown, not zero', () => {
        const r = validate({ sources: [source()], parts: [part('a', '15', [])] });
        expect(r.sources[0].amounts[0]).toMatchObject({ status: 'unknown', allocatedValue: null, knownSubtotal: null });
        expect(r).toMatchObject({ valid: true, financialKnown: false });
    });
    it('rejects identity, reference and version defects', () => {
        const s = source(), p = part('a', '15', [amount('fee', 'USD', '3')]);
        for (const input of [{ sources: [s, s], parts: [p] }, { sources: [s], parts: [p, p] }, { sources: [s], parts: [{ ...p, version: '2' }] }, { sources: [s], parts: [{ ...p, executionId: 'x' }] }, { sources: [{ ...s, executionId: '' }], parts: [p] }])
            expect(validate(input).valid).toBe(false);
    });
    it('rejects malformed and oversized decimals', () => {
        for (const v of ['', ' 1', '1e3', 'Infinity', 'NaN', '.1', '1.', '1'.repeat(1025), '0', '-1'])
            expect(validate({ sources: [source(v)], parts: [part('a', '1')] }).quantityComplete).toBe(false);
        expect(validate({ sources: [source('1'.repeat(1024), [])], parts: [part('a', '1'.repeat(1024), [])] }).quantityComplete).toBe(true);
        for (const v of ['1e3', '1'.repeat(1025), 'NaN'])
            expect(validate({ sources: [source('1', [amount('net', 'USD', v)])], parts: [part('a', '1', [amount('net', 'USD', '0')])] }).valid).toBe(false);
    });
    it('preserves large integer and tiny decimal differences', () => {
        for (const [a, b] of [['123456789012345678901', '123456789012345678900'], ['0.000000000000000000001', '0.000000000000000000002']]) {
            const r = validate({ sources: [source('1', [amount('net', 'USD', a)])], parts: [part('a', '1', [amount('net', 'USD', b)])] });
            expect(r.sources[0].amounts[0].status).toBe('mismatch');
        }
    });
    it('sums positive and negative cash and is independent of part order', () => {
        const s = source('2', [amount('net', 'USD', '-2')]);
        const a = part('a', '1', [amount('net', 'USD', '5')]);
        const b = part('b', '1', [amount('net', 'USD', '-7')]);
        const input = { sources: [s], parts: [a, b] };
        const before = JSON.stringify(input);
        expect(validate(input).sources).toEqual(validate({ sources: [s], parts: [b, a] }).sources);
        expect(validate(input).financialKnown).toBe(true);
        expect(JSON.stringify(input)).toBe(before);
    });
});
