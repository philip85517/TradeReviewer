export type AllocationAmount = {
    kind: 'fee' | 'gross' | 'net';
    currency: string;
    value: string | null;
};
export type AllocationSource = {
    executionId: string;
    version: string;
    quantity: string;
    amounts: AllocationAmount[];
};
export type AllocationPart = {
    partId: string;
    executionId: string;
    version: string;
    quantity: string;
    amounts: AllocationAmount[];
};
export type AllocationIssue = {
    code: string;
    executionId?: string;
    partId?: string;
    kind?: AllocationAmount['kind'];
    currency?: string;
};
export type AmountConservation = {
    kind: AllocationAmount['kind'];
    currency: string;
    status: 'conserved' | 'mismatch' | 'unknown' | 'invalid';
    sourceValue: string | null;
    allocatedValue: string | null;
    knownSubtotal: string | null;
};
export type AllocationSourceResult = {
    executionId: string;
    version: string;
    quantity: {
        status: 'conserved' | 'mismatch' | 'invalid';
        sourceValue: string | null;
        allocatedValue: string | null;
    };
    amounts: AmountConservation[];
};
/** financialKnown covers only declared dimensions; it does not establish that net or all real financial metrics were supplied. */
export type AllocationValidation = {
    valid: boolean;
    quantityComplete: boolean;
    financialKnown: boolean;
    sources: AllocationSourceResult[];
    issues: AllocationIssue[];
};
type Decimal = {
    n: bigint;
    s: number;
};
const zero = BigInt(0);
function parse(v: string, positive = false): Decimal | null {
    if (typeof v !== 'string' || v.length > 1024 || !/^-?\d+(?:\.\d+)?$/.test(v))
        return null;
    const [whole, fraction = ''] = v.split('.');
    const n = BigInt(whole + fraction);
    return positive && n <= zero ? null : { n, s: fraction.length };
}
function add(a: Decimal, b: Decimal): Decimal {
    const s = Math.max(a.s, b.s);
    return { n: a.n * BigInt(10) ** BigInt(s - a.s) + b.n * BigInt(10) ** BigInt(s - b.s), s };
}
function format(d: Decimal): string {
    const negative = d.n < zero;
    let digits = (negative ? -d.n : d.n).toString().padStart(d.s + 1, '0');
    if (d.s)
        digits = digits.slice(0, -d.s) + '.' + digits.slice(-d.s);
    digits = digits.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
    return (negative ? '-' : '') + digits;
}
const eq = (a: Decimal, b: Decimal) => add(a, { n: -b.n, s: b.s }).n === zero;
export function validateAllocationConservation(input: {
    sources: readonly AllocationSource[];
    parts: readonly AllocationPart[];
}): AllocationValidation {
    const issues: AllocationIssue[] = [];
    let quantityValid = true;
    const issue = (code: string, details: Omit<AllocationIssue, 'code'> = {}, quantity = false) => { issues.push({ code, ...details }); if (quantity)
        quantityValid = false; };
    const sourceMap = new Map<string, AllocationSource>();
    const groups = new Map<string, AllocationPart[]>();
    for (const source of input.sources) {
        if (!source.executionId || !source.version || sourceMap.has(source.executionId))
            issue('source_identity', { executionId: source.executionId }, true);
        else
            sourceMap.set(source.executionId, source);
    }
    const partIds = new Set<string>();
    for (const part of input.parts) {
        if (!part.partId || partIds.has(part.partId) || !part.executionId || !part.version)
            issue('part_identity', { partId: part.partId }, true);
        partIds.add(part.partId);
        const source = sourceMap.get(part.executionId);
        if (!source || source.version !== part.version)
            issue('reference', { partId: part.partId, executionId: part.executionId }, true);
        else {
            let group = groups.get(part.executionId);
            if (!group) {
                group = [];
                groups.set(part.executionId, group);
            }
            group.push(part);
        }
        if (!parse(part.quantity, true))
            issue('quantity', { partId: part.partId }, true);
        if (!source || source.version !== part.version) {
            const seen = new Set<string>();
            for (const a of part.amounts) {
                const key = JSON.stringify([a.kind, a.currency]);
                if (!['fee', 'gross', 'net'].includes(a.kind) || !/^[A-Z]{3}$/.test(a.currency) || seen.has(key) || (a.value !== null && !parse(a.value)))
                    issue('amount_invalid', { executionId: part.executionId, partId: part.partId, kind: a.kind, currency: a.currency });
                seen.add(key);
            }
        }
    }
    const results: AllocationSourceResult[] = input.sources.map(source => {
        const parts = groups.get(source.executionId) || [];
        const sq = parse(source.quantity, true);
        if (!sq)
            issue('quantity', { executionId: source.executionId }, true);
        let total: Decimal = { n: zero, s: 0 };
        let bad = !sq;
        for (const part of parts) {
            const q = parse(part.quantity, true);
            if (!q)
                bad = true;
            else
                total = add(total, q);
        }
        const status = bad ? 'invalid' : eq(sq!, total) ? 'conserved' : 'mismatch';
        if (status === 'mismatch')
            issue('quantity_mismatch', { executionId: source.executionId }, true);
        const dimensions = new Map<string, {
            kind: AllocationAmount['kind'];
            currency: string;
        }>();
        const invalidDimensions = new Set<string>();
        const maps = [source.amounts, ...parts.map(p => p.amounts)].map((amounts, index) => {
            const map = new Map<string, AllocationAmount>();
            for (const a of amounts) {
                const key = JSON.stringify([a.kind, a.currency]);
                dimensions.set(key, { kind: a.kind, currency: a.currency });
                if (!['fee', 'gross', 'net'].includes(a.kind) || !/^[A-Z]{3}$/.test(a.currency) || map.has(key) || (a.value !== null && !parse(a.value))) {
                    invalidDimensions.add(key);
                    issue('amount_invalid', { executionId: source.executionId, partId: index ? parts[index - 1].partId : undefined, kind: a.kind, currency: a.currency });
                }
                map.set(key, a);
            }
            return map;
        });
        const amounts: AmountConservation[] = [...dimensions.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, dim]) => {
            const entries = maps.map(m => m.get(key));
            let subtotal: Decimal = { n: zero, s: 0 }, known = false, invalid = invalidDimensions.has(key);
            for (const a of entries.slice(1))
                if (a && a.value !== null) {
                    const d = parse(a.value);
                    if (d) {
                        subtotal = add(subtotal, d);
                        known = true;
                    }
                    else
                        invalid = true;
                }
            const sourceAmount = entries[0];
            const value = sourceAmount?.value == null ? null : parse(sourceAmount.value);
            if (sourceAmount?.value != null && !value)
                invalid = true;
            const unknown = entries.some(a => !a || a.value === null);
            const amountStatus = invalid ? 'invalid' : unknown ? 'unknown' : eq(value!, subtotal) ? 'conserved' : 'mismatch';
            if (amountStatus === 'mismatch')
                issue('amount_mismatch', { executionId: source.executionId, ...dim });
            return { ...dim, status: amountStatus, sourceValue: sourceAmount?.value ?? null, allocatedValue: unknown || invalid ? null : format(subtotal), knownSubtotal: known ? format(subtotal) : null };
        });
        return { executionId: source.executionId, version: source.version, quantity: { status, sourceValue: sq ? source.quantity : null, allocatedValue: bad ? null : format(total) }, amounts };
    });
    const nonempty = input.sources.length > 0 && input.parts.length > 0;
    const valid = nonempty && issues.length === 0;
    const quantityComplete = nonempty && quantityValid && results.every(r => r.quantity.status === 'conserved');
    return { valid, quantityComplete, financialKnown: valid && quantityComplete && results.every(r => r.amounts.length > 0 && r.amounts.every(a => a.status === 'conserved')), sources: results, issues };
}
