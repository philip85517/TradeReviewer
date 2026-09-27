import { expect, it } from 'vitest';
import { applyRecallSizing, resolveRecallSizing, validateRecallSizing } from './sizing';
import { emptyRecallPlanInput } from '../../components/recall/recall-plan-sidebar';
const input = () => ({ ...emptyRecallPlanInput('CNY'), entry: '56', sizeInputMode: 'amount' as const, sizeInputValue: '56050', sizing: { quantityStep: '100', stepSource: 'manual-reference' as const, rounding: 'floor' as const, derivedUnroundedQuantity: null, roundingDelta: null } });
it('preserves primary money and shows Decimal floor evidence', () => { const x = applyRecallSizing(input()); expect(x.sizeInputValue).toBe('56050'); expect(x.resolvedQuantity).toBe('1000'); expect(x.sizing?.derivedUnroundedQuantity).toMatch(/^1000.892857/); expect(validateRecallSizing(x)).toBeNull(); expect(validateRecallSizing({ ...x, resolvedQuantity: '1100' })).toBeTruthy(); });
it('percent uses matching known reference currency and does not cap over 100', () => { const x = { ...input(), sizeInputMode: 'ratio' as const, sizeInputValue: '140', capital: { amount: '200000', currency: 'CNY', asOf: null, source: 'manual-reference' as const } }; expect(resolveRecallSizing(x).resolvedQuantity).toBe('5000'); expect(resolveRecallSizing(x).exceedsCapital).toBe(true); expect(resolveRecallSizing({ ...x, capital: { ...x.capital, currency: 'USD' } }).resolvedQuantity).toBeNull(); });
it('invalid raw text and missing basis stay unknown', () => { expect(resolveRecallSizing({ ...input(), entry: 'oops' }).resolvedQuantity).toBeNull(); expect(resolveRecallSizing({ ...input(), sizing: { ...input().sizing, quantityStep: null } }).resolvedQuantity).toBeNull(); });
it('converts scale units on mode change without reinterpreting the number', async () => { const { switchRecallSizeMode } = await import('./sizing'); const x = applyRecallSizing({ ...input(), sizeInputMode: 'quantity', sizeInputValue: '1000' }); expect(switchRecallSizeMode(x, 'amount').sizeInputValue).toBe('56000'); expect(switchRecallSizeMode(x, 'ratio').sizeInputValue).toBeNull(); });
it('preserves one lot through repeating percent conversion and roundtrip', async () => {
    const { switchRecallSizeMode } = await import('./sizing');
    const original = applyRecallSizing({
        ...input(), entry: '3', sizeInputMode: 'quantity', sizeInputValue: '1',
        capital: { amount: '14', currency: 'CNY', asOf: null, source: 'manual-reference' },
        sizing: { ...input().sizing, quantityStep: '1' },
    });
    const percent = switchRecallSizeMode(original, 'ratio');
    expect(percent.sizeInputMode).toBe('ratio');
    expect(percent.resolvedQuantity).toBe('1');
    expect(switchRecallSizeMode(percent, 'quantity').sizeInputValue).toBe('1');
    expect(switchRecallSizeMode(switchRecallSizeMode(original, 'amount'), 'ratio').resolvedQuantity).toBe('1');
    expect(validateRecallSizing(percent)).toBeNull();
    // This manually typed value is genuinely below 3/14, even past default Decimal precision.
    expect(resolveRecallSizing({ ...percent, sizeInputValue: '21.428571428571428571428571428571428571428571428571' }).resolvedQuantity).toBeNull();
});
