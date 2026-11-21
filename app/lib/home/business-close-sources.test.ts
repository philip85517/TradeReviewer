import { describe, expect, it } from 'vitest';
import { validateBusinessCloseSources, type BusinessCloseInput } from './business-close-sources';
type MutableFixture = {
    [K in keyof BusinessCloseInput]: Array<BusinessCloseInput[K][number]>;
};
function fixture(): MutableFixture {
    const sources = ['o', 'c'].map((executionId, i) => ({ executionId, version: '1', quantity: i ? '40' : '100', amounts: [], accountId: 'a', instrumentId: 'i', side: i ? 'sell' as const : 'buy' as const, tradeNature: 'live' as const }));
    return { sources, parts: sources.map(s => ({ ...s, partId: s.executionId, role: s.executionId === 'o' ? 'open-long' : 'close-long' })), evidence: [{ id: 'd', version: '1', kind: 'active-close', status: 'confirmed', sourceRefs: [{ executionId: 'c', version: '1' }] }, { id: 'p', version: '1', kind: 'opening-pair', status: 'confirmed', sourceRefs: sources.map(s => ({ executionId: s.executionId, version: s.version })) }], rounds: [{ id: 'r', version: '1', accountId: 'a', instrumentId: 'i', direction: 'long', closingPartIds: ['c'], decisionEvidenceId: 'd', decisionEvidenceVersion: '1' }], pairings: [{ id: 'p', version: '1', roundId: 'r', openingPartId: 'o', closingPartId: 'c', quantity: '40', evidenceId: 'p', evidenceVersion: '1' }] };
}
describe('explicit business sources', () => {
    it('accepts partial opening consumption without mutating input', () => {
        const x = fixture();
        const before = JSON.stringify(x);
        expect(validateBusinessCloseSources(x)).toMatchObject({ valid: true, universeComplete: false, eligibleRoundIds: ['r'] });
        expect(JSON.stringify(x)).toBe(before);
    });
    it.each(['quantity', 'evidence', 'nature', 'account', 'side', 'version', 'missing', 'duplicate'])('rejects %s', kind => {
        const x = fixture();
        if (kind === 'quantity')
            x.pairings[0].quantity = '39';
        if (kind === 'evidence')
            x.evidence[0].sourceRefs.push({ executionId: 'o', version: '1' });
        if (kind === 'nature')
            x.sources[0].tradeNature = 'unknown';
        if (kind === 'account')
            x.sources[0].accountId = 'other';
        if (kind === 'side')
            x.sources[0].side = 'sell';
        if (kind === 'version')
            x.sources[0].version = '2';
        if (kind === 'missing')
            x.rounds = [];
        if (kind === 'duplicate')
            x.pairings.push({ ...x.pairings[0], id: 'p2' });
        expect(validateBusinessCloseSources(x)).toMatchObject({ valid: false, eligibleRoundIds: [] });
    });
    it('rejects empty history', () => expect(validateBusinessCloseSources({ sources: [], parts: [], rounds: [], pairings: [], evidence: [] }).valid).toBe(false));
});
describe('extended acceptance', () => {
    it('accepts exact quantities beyond 20 digits and tiny fractions', () => {
        const x = fixture();
        x.sources[0].quantity = '100000000000000000000000.00000000000000000001';
        x.parts[0].quantity = x.sources[0].quantity;
        x.sources[1].quantity = '40.00000000000000000001';
        x.parts[1].quantity = x.sources[1].quantity;
        x.pairings[0].quantity = x.sources[1].quantity;
        expect(validateBusinessCloseSources(x).valid).toBe(true);
        x.pairings[0].quantity = '40.00000000000000000002';
        expect(validateBusinessCloseSources(x).valid).toBe(false);
    });
    it('retains known fee and unknown net', () => {
        const x = fixture();
        for (const s of x.sources)
            s.amounts = [{ kind: 'fee', currency: 'USD', value: '2' }, { kind: 'net', currency: 'USD', value: null }];
        for (const p of x.parts)
            p.amounts = [{ kind: 'fee', currency: 'USD', value: '2' }, { kind: 'net', currency: 'USD', value: null }];
        const result = validateBusinessCloseSources(x);
        expect(result.valid).toBe(true);
        expect(result.allocation.financialKnown).toBe(false);
        expect(result.allocation.sources[0].amounts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'fee', status: 'conserved' }), expect.objectContaining({ kind: 'net', status: 'unknown' })]));
    });
    it('accepts cross-zero split without treating new short as closing', () => {
        const x = fixture();
        x.sources[1].quantity = '45';
        x.parts.push({ ...x.parts[1], partId: 'short', quantity: '5', role: 'open-short' });
        expect(validateBusinessCloseSources(x).eligibleRoundIds).toEqual(['r']);
    });
    it('accepts two closing parts in one round then a later round', () => {
        const x = fixture();
        x.sources[1].quantity = '50';
        x.parts[1].quantity = '20';
        x.parts.push({ ...x.parts[1], partId: 'c2' }, { ...x.parts[1], partId: 'c3', quantity: '10' });
        x.rounds[0].closingPartIds.push('c2');
        x.evidence.push({ ...x.evidence[0], id: 'd2' });
        x.rounds.push({ ...x.rounds[0], id: 'r2', closingPartIds: ['c3'], decisionEvidenceId: 'd2' });
        x.pairings[0].quantity = '20';
        x.pairings.push({ ...x.pairings[0], id: 'p2', closingPartId: 'c2' }, { ...x.pairings[0], id: 'p3', roundId: 'r2', closingPartId: 'c3', quantity: '10' });
        expect(validateBusinessCloseSources(x).eligibleRoundIds).toEqual(['r', 'r2']);
        x.rounds[1].decisionEvidenceId = 'd';
        expect(validateBusinessCloseSources(x).valid).toBe(false);
    });
    it.each(['instrument', 'status', 'kind', 'duplicate-ref', 'overlong', 'exponent'])('rejects %s', kind => {
        const x = fixture();
        if (kind === 'instrument')
            x.sources[0].instrumentId = 'other';
        if (kind === 'status')
            x.evidence[0].status = 'unconfirmed';
        if (kind === 'kind')
            x.evidence[0].kind = 'opening-pair';
        if (kind === 'duplicate-ref')
            x.evidence[0].sourceRefs.push({ ...x.evidence[0].sourceRefs[0] });
        if (kind === 'overlong')
            x.pairings[0].quantity = '1'.repeat(1025);
        if (kind === 'exponent')
            x.pairings[0].quantity = '4e1';
        expect(validateBusinessCloseSources(x).valid).toBe(false);
    });
    it('accepts multiple opening sources and rejects aggregate overconsumption', () => {
        const x = fixture();
        x.sources.push({ ...x.sources[0], executionId: 'o2' });
        x.parts.push({ ...x.parts[0], partId: 'o2', executionId: 'o2' });
        x.pairings[0].quantity = '20';
        x.evidence.push({ ...x.evidence[1], id: 'p2', sourceRefs: [{ executionId: 'o2', version: '1' }, { executionId: 'c', version: '1' }] });
        x.pairings.push({ ...x.pairings[0], id: 'p2', openingPartId: 'o2', evidenceId: 'p2' });
        expect(validateBusinessCloseSources(x).valid).toBe(true);
        x.sources[0].quantity = '10';
        x.parts[0].quantity = '10';
        expect(validateBusinessCloseSources(x).valid).toBe(false);
    });
});
