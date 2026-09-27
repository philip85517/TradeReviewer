import Decimal from 'decimal.js';
import type { RecallPlanInput } from './types';
export type RecallSizingEvidence = {
    quantityStep: string | null;
    stepSource: 'manual-reference';
    rounding: 'floor';
    derivedUnroundedQuantity: string | null;
    roundingDelta: string | null;
};
// Sum of finite-decimal operand widths bounds the distance of a non-integral
// quotient from the next integer. Guard digits keep floor strict for long input.
function arithmeticPrecision(input: RecallPlanInput): number {
    return 40 + [input.sizeInputValue, input.entry, input.capital?.amount,
        input.sizing?.quantityStep].reduce<number>((sum, value) => sum + (value?.length ?? 0), 0);
}
function positive(value: string | null | undefined, Constructor = Decimal): Decimal | null {
    if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) return null;
    const decimal = new Constructor(value);
    return decimal.gt(0) ? decimal : null;
}
export function resolveRecallSizing(input: RecallPlanInput) {
    const Arithmetic = Decimal.clone({ precision: arithmeticPrecision(input) });
    const value = positive(input.sizeInputValue, Arithmetic);
    const entry = positive(input.entry, Arithmetic);
    const capital = positive(input.capital?.amount, Arithmetic);
    const matched = !!input.currency && input.capital?.currency === input.currency;
    let reason: string | null = !value ? '请输入有效规模' : null;
    let raw = value;
    if (input.sizeInputMode !== 'quantity') {
        if (!entry) {
            raw = null;
            reason = '缺少有效入场价';
        }
        else if (input.sizeInputMode === 'ratio') {
            if (!capital || !matched) {
                raw = null;
                reason = '参考资金缺失或币种不同，比例未知';
            }
            else
                raw = value?.div(100).mul(capital).div(entry) ?? null;
        }
        else
            raw = value?.div(entry) ?? null;
    }
    const step = positive(input.sizing?.quantityStep, Arithmetic);
    let quantity = raw;
    if (input.sizing) {
        if (!step) {
            quantity = null;
            reason = '请输入有效数量步长';
        }
        else
            quantity = raw?.div(step).floor().mul(step) ?? null;
    }
    if (quantity?.isZero()) {
        quantity = null;
        reason = '规模小于数量步长';
    }
    const notional = quantity && entry ? quantity.mul(entry) : null;
    const percent = notional && capital && matched ? notional.div(capital).mul(100) : null;
    return {
        resolvedQuantity: quantity?.toFixed() ?? null,
        derivedUnroundedQuantity: raw?.toFixed() ?? null,
        roundingDelta: raw && quantity ? raw.minus(quantity).toFixed() : null,
        notionalAmount: notional?.toFixed() ?? null,
        capitalPercent: percent?.toFixed() ?? null,
        reason,
        exceedsCapital: !!(raw && entry && capital && matched && raw.mul(entry).gt(capital)),
    };
}
export function applyRecallSizing(input: RecallPlanInput): RecallPlanInput {
    const result = resolveRecallSizing(input);
    return {
        ...input,
        resolvedQuantity: result.resolvedQuantity,
        ...(input.sizing ? {
            sizing: {
                ...input.sizing,
                derivedUnroundedQuantity: result.derivedUnroundedQuantity,
                roundingDelta: result.roundingDelta
            }
        } : {})
    };
}
export function validateRecallSizing(input: RecallPlanInput): string | null {
    if (!input.sizing)
        return null;
    const s = input.sizing;
    if (s.stepSource !== 'manual-reference' || s.rounding !== 'floor' ||
        (s.quantityStep !== null && !positive(s.quantityStep)))
        return 'invalid sizing step or provenance';
    const result = resolveRecallSizing(input);
    if (input.resolvedQuantity !== result.resolvedQuantity ||
        s.derivedUnroundedQuantity !== result.derivedUnroundedQuantity ||
        s.roundingDelta !== result.roundingDelta)
        return 'sizing evidence does not match primary input';
    return null;
}
/** Switch units using the currently resolved quantity; missing reference money stays unknown. */
export function switchRecallSizeMode(input: RecallPlanInput, mode: RecallPlanInput['sizeInputMode']): RecallPlanInput {
    if (mode === input.sizeInputMode)
        return input;
    const result = resolveRecallSizing(input);
    let value = mode === 'quantity' ? result.resolvedQuantity
        : mode === 'amount' ? result.notionalAmount : result.capitalPercent;
    if (mode === 'ratio' && value !== null && result.resolvedQuantity) {
        // Only a generated percent is rounded upward. A repeating quotient must
        // not lose a whole lot on conversion back. User text never uses CEIL.
        const Conversion = Decimal.clone({
            precision: arithmeticPrecision(input),
            rounding: Decimal.ROUND_CEIL,
        });
        value = new Conversion(result.resolvedQuantity)
            .mul(input.entry!).mul(100).div(input.capital!.amount!).toFixed();
    }
    const converted = applyRecallSizing({
        ...input,
        sizeInputMode: mode,
        sizeInputValue: value,
        sizing: input.sizing ?? {
            quantityStep: '1',
            stepSource: 'manual-reference',
            rounding: 'floor',
            derivedUnroundedQuantity: null,
            roundingDelta: null
        }
    });
    // Fail closed on a conversion that cannot preserve the existing lot count.
    // Unknown basis still switches to an empty primary field as before.
    if (value !== null && result.resolvedQuantity !== null &&
        converted.resolvedQuantity !== result.resolvedQuantity) return input;
    return converted;
}
