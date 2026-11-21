import { validateAllocationConservation, type AllocationSource, type AllocationPart, type AllocationValidation } from './allocation-conservation';
export type BusinessSource = AllocationSource & {
    accountId: string;
    instrumentId: string;
    side: 'buy' | 'sell';
    tradeNature: 'live' | 'simulation' | 'unknown';
};
export type BusinessPart = AllocationPart & {
    role: 'open-long' | 'open-short' | 'close-long' | 'close-short';
};
export type BusinessEvidence = {
    id: string;
    version: string;
    kind: 'active-close' | 'opening-pair';
    status: 'confirmed' | 'unconfirmed';
    sourceRefs: {
        executionId: string;
        version: string;
    }[];
};
export type BusinessRound = {
    id: string;
    version: string;
    accountId: string;
    instrumentId: string;
    direction: 'long' | 'short';
    closingPartIds: string[];
    decisionEvidenceId: string;
    decisionEvidenceVersion: string;
};
export type BusinessPairing = {
    id: string;
    version: string;
    roundId: string;
    openingPartId: string;
    closingPartId: string;
    quantity: string;
    evidenceId: string;
    evidenceVersion: string;
};
export type BusinessCloseInput = {
    sources: readonly BusinessSource[];
    parts: readonly BusinessPart[];
    evidence: readonly BusinessEvidence[];
    rounds: readonly BusinessRound[];
    pairings: readonly BusinessPairing[];
};
type Decimal = {
    n: bigint;
    s: number;
};
function decimal(v: string): Decimal | null {
    if (typeof v !== 'string' || v.length > 1024 || !/^\d+(\.\d+)?$/.test(v))
        return null;
    const [a, b = ''] = v.split('.');
    const n = BigInt(a + b);
    return n > BigInt(0) ? { n, s: b.length } : null;
}
function add(a: Decimal, b: Decimal): Decimal {
    const s = Math.max(a.s, b.s);
    return { n: a.n * BigInt(10) ** BigInt(s - a.s) + b.n * BigInt(10) ** BigInt(s - b.s), s };
}
function compare(a: Decimal, b: Decimal): bigint {
    const s = Math.max(a.s, b.s);
    return a.n * BigInt(10) ** BigInt(s - a.s) - b.n * BigInt(10) ** BigInt(s - b.s);
}
const nonempty = (v: string) => typeof v === 'string' && v.trim().length > 0;
const refKey = (r: {
    executionId: string;
    version: string;
}) => JSON.stringify([r.executionId, r.version]);
/** Validates only caller-supplied evidence structure and exact quantities. Confirmed is a caller assertion,
 * not proof of authority; this module neither discovers decisions nor proves universe coverage. */
export function validateBusinessCloseSources(input: BusinessCloseInput): {
    valid: boolean;
    universeComplete: false;
    eligibleRoundIds: string[];
    issues: {
        code: string;
    }[];
    allocation: AllocationValidation;
} {
    const allocation = validateAllocationConservation(input);
    const issues: {
        code: string;
    }[] = [];
    const fail = (code: string) => {
        issues.push({ code });
    };
    if (!allocation.valid || !allocation.quantityComplete)
        fail('allocation');
    function index<T extends {
        id: string;
        version: string;
    }>(items: readonly T[]): Map<string, T> {
        const m = new Map<string, T>();
        for (const x of items) {
            if (!nonempty(x.id) || !nonempty(x.version) || m.has(x.id))
                fail('identity');
            m.set(x.id, x);
        }
        return m;
    }
    const evidence = index(input.evidence), rounds = index(input.rounds);
    index(input.pairings);
    const sources = new Map(input.sources.map(s => [s.executionId, s]));
    const parts = new Map(input.parts.map(p => [p.partId, p]));
    const evidenceRefs = new Map<string, Set<string>>();
    for (const e of input.evidence) {
        const refs = new Set<string>();
        const versions = new Map<string, string>();
        for (const ref of e.sourceRefs) {
            const source = sources.get(ref.executionId);
            const key = refKey(ref);
            if (!nonempty(ref.executionId) || !nonempty(ref.version) || refs.has(key) || versions.has(ref.executionId) || !source || source.version !== ref.version)
                fail('evidence-ref');
            refs.add(key);
            versions.set(ref.executionId, ref.version);
        }
        evidenceRefs.set(e.id, refs);
        if (!['active-close', 'opening-pair'].includes(e.kind) || !['confirmed', 'unconfirmed'].includes(e.status))
            fail('evidence-shape');
    }
    function checkEvidence(id: string, version: string, kind: BusinessEvidence['kind'], expected: Set<string>) {
        const e = evidence.get(id);
        const refs = evidenceRefs.get(id);
        if (!e || e.version !== version || e.kind !== kind || e.status !== 'confirmed' || !refs || refs.size !== expected.size || [...expected].some(k => !refs.has(k)))
            fail('evidence-mismatch');
    }
    function participant(p: BusinessPart, r: BusinessRound, role: string) {
        const s = sources.get(p.executionId);
        if (p.role !== role || !s || s.tradeNature !== 'live' || s.accountId !== r.accountId || s.instrumentId !== r.instrumentId || s.side !== (['open-long', 'close-short'].includes(role) ? 'buy' : 'sell'))
            fail('participant');
    }
    const owners = new Map<string, string>(), decisions = new Set<string>();
    for (const p of input.parts)
        if (!['open-long', 'open-short', 'close-long', 'close-short'].includes(p.role))
            fail('role');
    for (const r of input.rounds) {
        if (!nonempty(r.accountId) || !nonempty(r.instrumentId) || !['long', 'short'].includes(r.direction) || !r.closingPartIds.length)
            fail('round');
        const expected = new Set<string>();
        for (const id of r.closingPartIds) {
            const p = parts.get(id);
            if (!p || owners.has(id)) {
                fail('closing-owner');
                continue;
            }
            owners.set(id, r.id);
            participant(p, r, `close-${r.direction}`);
            expected.add(refKey(p));
        }
        if (decisions.has(r.decisionEvidenceId))
            fail('decision-reuse');
        decisions.add(r.decisionEvidenceId);
        checkEvidence(r.decisionEvidenceId, r.decisionEvidenceVersion, 'active-close', expected);
    }
    const used = new Map<string, Decimal>();
    for (const pair of input.pairings) {
        const r = rounds.get(pair.roundId), o = parts.get(pair.openingPartId), c = parts.get(pair.closingPartId), q = decimal(pair.quantity);
        if (!r || !o || !c || !q || owners.get(pair.closingPartId) !== pair.roundId) {
            fail('pairing');
            continue;
        }
        participant(o, r, `open-${r.direction}`);
        participant(c, r, `close-${r.direction}`);
        checkEvidence(pair.evidenceId, pair.evidenceVersion, 'opening-pair', new Set([refKey(o), refKey(c)]));
        for (const p of [o, c])
            used.set(p.partId, add(used.get(p.partId) ?? { n: BigInt(0), s: 0 }, q));
    }
    for (const p of input.parts) {
        const q = decimal(p.quantity), sum = used.get(p.partId) ?? { n: BigInt(0), s: 0 };
        if (!q) {
            fail('quantity');
            continue;
        }
        if (p.role.startsWith('close-')) {
            if (!owners.has(p.partId) || compare(sum, q) !== BigInt(0))
                fail('closing-incomplete');
        }
        else if (compare(sum, q) > BigInt(0))
            fail('opening-overconsumed');
    }
    if (!input.rounds.length)
        fail('no-explicit-rounds');
    const valid = issues.length === 0;
    return { valid, universeComplete: false, eligibleRoundIds: valid ? input.rounds.map(r => r.id) : [], issues, allocation };
}
