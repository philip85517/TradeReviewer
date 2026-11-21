export type FeeAmount = { currency: string; value: string | null; knownSubtotal: string | null; reasons: string[] };
export type FeePoolExecution = { executionId: string; side: 'buy' | 'sell'; quantity: string; fee: { currency: string; value: string | null } };
export type LongFeePoolResult = {
    valid: boolean;
    issues: { code: string; executionId?: string }[];
    entryAllocations: { openingExecutionId: string; closingExecutionId: string | null; amount: FeeAmount }[];
    closes: { closingExecutionId: string; entry: FeeAmount[]; exit: FeeAmount[]; total: FeeAmount[] }[];
    remaining: FeeAmount[];
    sourceConservation: { executionId: string; currency: string; sourceValue: string | null; exactConserved: boolean | null; decimalComplete: boolean }[];
};

// Every operation is reduced: recurring shares stay exact until the public decimal boundary.
type Rational = { n: bigint; d: bigint };
const ZERO = BigInt(0), ONE = BigInt(1), TWO = BigInt(2), FIVE = BigInt(5), TEN = BigInt(10);
const zero: Rational = { n: ZERO, d: ONE };
const MAX_DECIMAL_LENGTH = 1024;
function rational(n: bigint, d = ONE): Rational {
    let a = n < ZERO ? -n : n, b = d;
    while (b !== ZERO) [a, b] = [b, a % b];
    return { n: n / a, d: d / a };
}
function add(a: Rational, b: Rational): Rational { return rational(a.n * b.d + b.n * a.d, a.d * b.d); }
function subtract(a: Rational, b: Rational): Rational { return rational(a.n * b.d - b.n * a.d, a.d * b.d); }
function multiply(a: Rational, b: Rational): Rational { return rational(a.n * b.n, a.d * b.d); }
function divide(a: Rational, b: Rational): Rational { return rational(a.n * b.d, a.d * b.n); }
function parse(value: unknown): Rational | null {
    if (typeof value !== 'string' || value.length > MAX_DECIMAL_LENGTH || !/^\d+(?:\.\d+)?$/.test(value)) return null;
    const [whole, fraction = ''] = value.split('.');
    return rational(BigInt(whole + fraction), TEN ** BigInt(fraction.length));
}
function currencyValid(currency: unknown): currency is string {
    return typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) && currency !== 'XXX';
}
function decimal(value: Rational): { value: string | null; reason?: string } {
    let denominator = value.d, twos = 0, fives = 0;
    while (denominator % TWO === ZERO) { denominator /= TWO; twos++; }
    while (denominator % FIVE === ZERO) { denominator /= FIVE; fives++; }
    if (denominator !== ONE) return { value: null, reason: 'non-terminating-decimal' };
    const scale = Math.max(twos, fives);
    if (scale > MAX_DECIMAL_LENGTH) return { value: null, reason: 'decimal-length-exceeded' };
    const digits = (value.n * TWO ** BigInt(scale - twos) * FIVE ** BigInt(scale - fives)).toString().padStart(scale + 1, '0');
    const output = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/0+$/, '').replace(/\.$/, '') : digits;
    return output.length <= MAX_DECIMAL_LENGTH ? { value: output } : { value: null, reason: 'decimal-length-exceeded' };
}

type ExactAmount = { currency: string; known: Rational; hasKnown: boolean; unknown: boolean; reasons: string[] };
function exact(currency: string, value: Rational | null): ExactAmount {
    return { currency, known: value ?? zero, hasKnown: value !== null, unknown: value === null, reasons: value === null ? ['unknown-source-fee'] : [] };
}
function group(amounts: readonly ExactAmount[]): ExactAmount[] {
    const groups = new Map<string, ExactAmount>();
    for (const amount of amounts) {
        const previous = groups.get(amount.currency);
        if (!previous) groups.set(amount.currency, { ...amount, reasons: [...amount.reasons] });
        else {
            previous.known = add(previous.known, amount.known);
            previous.hasKnown ||= amount.hasKnown;
            previous.unknown ||= amount.unknown;
            previous.reasons = [...new Set([...previous.reasons, ...amount.reasons])];
        }
    }
    return [...groups.values()];
}
function publish(amount: ExactAmount): FeeAmount {
    const subtotal = amount.hasKnown ? decimal(amount.known) : { value: null };
    return {
        currency: amount.currency,
        value: amount.unknown ? null : subtotal.value,
        knownSubtotal: subtotal.value,
        reasons: [...new Set([...amount.reasons, ...(subtotal.reason ? [subtotal.reason] : [])])],
    };
}
function publishGrouped(amounts: readonly ExactAmount[]): FeeAmount[] { return group(amounts).map(publish); }

/** Public aggregation deliberately uses only serializable fields; unknown shares stay unknown. */
export function sumFeeAmounts(amounts: readonly FeeAmount[]): FeeAmount[] {
    return publishGrouped(amounts.map(amount => {
        const known = parse(amount.value === null ? amount.knownSubtotal : amount.value);
        const invalid = !currencyValid(amount.currency) || (amount.value !== null && known === null) || (amount.knownSubtotal !== null && parse(amount.knownSubtotal) === null);
        return {
            currency: amount.currency,
            known: invalid ? zero : known ?? zero,
            hasKnown: known !== null && !invalid,
            unknown: amount.value === null || invalid,
            reasons: [...amount.reasons, ...(invalid ? ['invalid-fee-amount'] : [])],
        };
    }));
}

/** Ordered scope only: every sell consumes the pool, independently of review confirmation/LIFO. */
export function allocateLongFeePool(executions: readonly FeePoolExecution[]): LongFeePoolResult {
    const result: LongFeePoolResult = { valid: false, issues: [], entryAllocations: [], closes: [], remaining: [], sourceConservation: [] };
    const ids = new Set<string>();
    const parsed: { execution: FeePoolExecution; quantity: Rational; fee: Rational | null }[] = [];
    let inventory = zero;
    for (const execution of executions) {
        const issue = (code: string) => result.issues.push({ code, executionId: execution.executionId });
        if (typeof execution.executionId !== 'string' || !execution.executionId.trim() || ids.has(execution.executionId)) issue('invalid-execution-id');
        ids.add(execution.executionId);
        if (execution.side !== 'buy' && execution.side !== 'sell') issue('invalid-side');
        const quantity = parse(execution.quantity);
        const fee = parse(execution.fee?.value);
        if (!quantity || quantity.n === ZERO) issue('invalid-quantity');
        if (execution.fee?.value !== null && !fee) issue('invalid-fee');
        if (!currencyValid(execution.fee?.currency)) issue('invalid-currency');
        if (quantity && quantity.n > ZERO) {
            inventory = execution.side === 'buy' ? add(inventory, quantity) : subtract(inventory, quantity);
            if (inventory.n < ZERO) issue('negative-inventory');
            parsed.push({ execution, quantity, fee });
        }
    }
    // Validation is atomic: no valid prefix is returned as a certified partial scope.
    if (result.issues.length) return result;
    result.valid = true;
    type Source = { execution: FeePoolExecution; original: Rational | null; remaining: Rational | null; consumed: Rational; decimalComplete: boolean; active: boolean };
    const sources: Source[] = [];
    let active: Source[] = [];
    inventory = zero;
    for (const { execution, quantity, fee } of parsed) {
        if (execution.side === 'buy') {
            const source: Source = { execution, original: fee, remaining: fee, consumed: zero, decimalComplete: fee !== null, active: true };
            sources.push(source);
            active.push(source);
            inventory = add(inventory, quantity);
            continue;
        }
        const ratio = divide(quantity, inventory);
        const allClosed = quantity.n * inventory.d === inventory.n * quantity.d;
        const entry: ExactAmount[] = [];
        for (const source of active) {
            const share = source.remaining === null ? null : multiply(source.remaining, ratio);
            const amount = exact(source.execution.fee.currency, share);
            const published = publish(amount);
            result.entryAllocations.push({ openingExecutionId: source.execution.executionId, closingExecutionId: execution.executionId, amount: published });
            entry.push(amount);
            source.decimalComplete &&= published.value !== null;
            if (share !== null) {
                source.consumed = add(source.consumed, share);
                source.remaining = subtract(source.remaining!, share);
            }
            if (allClosed) { source.remaining = zero; source.active = false; }
        }
        const exit = exact(execution.fee.currency, fee);
        result.closes.push({ closingExecutionId: execution.executionId, entry: publishGrouped(entry), exit: [publish(exit)], total: publishGrouped([...entry, exit]) });
        sources.push({ execution, original: fee, remaining: zero, consumed: fee ?? zero, decimalComplete: fee !== null && decimal(fee).value !== null, active: false });
        inventory = subtract(inventory, quantity);
        if (allClosed) active = [];
    }
    const remaining: ExactAmount[] = [];
    for (const source of sources) {
        if (source.execution.side === 'buy') {
            const amount = exact(source.execution.fee.currency, source.remaining);
            const published = publish(amount);
            remaining.push(amount);
            if (source.active) result.entryAllocations.push({ openingExecutionId: source.execution.executionId, closingExecutionId: null, amount: published });
            source.decimalComplete &&= published.value !== null;
        }
        const reconstructed = add(source.consumed, source.remaining ?? zero);
        result.sourceConservation.push({
            executionId: source.execution.executionId,
            currency: source.execution.fee.currency,
            sourceValue: source.execution.fee.value,
            exactConserved: source.original === null ? null : reconstructed.n * source.original.d === source.original.n * reconstructed.d,
            decimalComplete: source.decimalComplete,
        });
    }
    result.remaining = publishGrouped(remaining);
    return result;
}
