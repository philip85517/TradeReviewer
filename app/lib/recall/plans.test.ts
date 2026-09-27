import { describe, expect, it } from 'vitest';
import * as plans from './plans';
import type { RecallPlanInput } from './types';
const input = {
    direction: 'long', currency: 'USD', priceBasis: 'raw', entry: '10.1', initialStop: '9.9', targets: [{
            id: 't', price: '10.7', quantity: null, ratio: null
        }], sizeInputMode: 'quantity', sizeInputValue: '3', resolvedQuantity: '3', quantityUnit: 'share', capital: null
} as RecallPlanInput;
describe('structured plans', () => {
    it('calculates exact decimal initial risk and R', () => {
        expect(plans.calculateRecallPlan(input).initialRisk.value).toBe('0.6');
        expect(plans.calculateRecallPlan(input).expectedR.value).toBe('3');
    });
    it('keeps missing and invalid relationships explicit', () => {
        expect(plans.calculateRecallPlan({
            ...input, initialStop: null
        }).initialRisk.reason).toBeTruthy();
        expect(plans.calculateRecallPlan({
            ...input, initialStop: '11'
        }).issues.length).toBeGreaterThan(0);
        expect(plans.calculateRecallPlan({
            ...input, direction: 'short', initialStop: '11', targets: [{
                    id: 't', price: '9', quantity: null, ratio: null
                }]
        }).initialRisk.value).toBe('2.7');
    });
});
import { createHash } from 'node:crypto';
import { sha256 } from './retained-digest';
import { createRecallDocument, mergeRecallDecisions, splitRecallDecision, reconcileRecallDocument, retainRecallSnapshot, validateRecallDocument } from './document';
import { freezeRecallSnapshotBundle, validateRecallRetainedState } from './retained-bundles';
import type { TradeEpisode } from '../trades/types';
const episode: TradeEpisode = {
    id: 'episode', accountId: 'a', accountLabel: 'A', instrument: {
        id: 'i', symbol: 'I', name: 'I', market: 'US', currency: 'USD'
    }, direction: 'long', status: 'closed', startedAt: '2026-01-01', endedAt: '2026-01-03', openingQuantity: '2', remainingQuantity: '0', executions: [{
            id: 'buy', accountId: 'a', accountLabel: 'A', instrument: {
                id: 'i', symbol: 'I', name: 'I', market: 'US', currency: 'USD'
            }, side: 'buy', executedAt: '2026-01-01T00:00:00Z', quantity: '2', price: '10', fee: '0', source: {
                platform: 'test', row: 1
            }
        }, {
            id: 'sell', accountId: 'a', accountLabel: 'A', instrument: {
                id: 'i', symbol: 'I', name: 'I', market: 'US', currency: 'USD'
            }, side: 'sell', executedAt: '2026-01-03T00:00:00Z', quantity: '2', price: '12', fee: '0', source: {
                platform: 'test', row: 2
            }
        }]
};
function capture() {
    let d = createRecallDocument(episode);
    d = plans.upsertRecallPlanDraft(d, {
        id: 'draft', planId: 'lineage', decisionId: 'buy', kind: 'initial', input, recordedPhase: 'pre-entry', source: 'retrospective', recordedAt: '2026-01-01', knowledgeCutoff: {
            cursor: '2025-12-31T00:00:00Z', executionCursor: '__recall_before_first_execution__'
        }, hasSeenFuture: false
    });
    d = retainRecallSnapshot(d, {
        id: 's', decisionId: 'buy', phase: 'pre-entry', timeframe: '1D', cursor: '2025-12-31T00:00:00Z', executionCursor: '__recall_before_first_execution__', candles: [], drawings: [], imageDataUrl: 'data:image/png;base64,AAAA', createdAt: '2026-01-01', updatedAt: '2026-01-01'
    });
    return freezeRecallSnapshotBundle(d, 's', {
        bundleId: 'b', retainedAt: '2026-01-01', episode
    });
}
it.each(['abc', '中文证据与💹', 'a'.repeat(200)])('hashes payload %s identically to SHA256', value => expect(sha256(value)).toBe(createHash('sha256').update(value).digest('hex')));
it.each(['NaN', 'Infinity', '-1', '0', '1e2', ' 2', '1.'])('rejects invalid decimal %s', value => expect(() => plans.validateRecallPlanInput({
    ...input, entry: value
})).toThrow());
it('rejects unsupported currency and zero quantity', () => {
    expect(() => plans.validateRecallPlanInput({
        ...input, currency: 'ZZZ'
    })).toThrow();
    expect(() => plans.validateRecallPlanInput({
        ...input, resolvedQuantity: '0', sizeInputValue: '0'
    })).toThrow();
});
it('freezes once, retains initial evidence through regrouping, and explicitly flags removed owner', () => {
    const d = capture();
    expect(() => plans.upsertRecallPlanDraft(d, d.plans!.drafts[0])).toThrow(/read-only/);
    const again = freezeRecallSnapshotBundle(d, 's', {
        bundleId: 'b2', retainedAt: '2026-01-02', episode
    });
    expect(again.plans!.versions).toHaveLength(1);
    const merged = mergeRecallDecisions(d, ['buy', 'sell'], 'buy');
    expect(merged.plans!.versions).toEqual(d.plans!.versions);
    expect(merged.retainedBundles).toEqual(d.retainedBundles);
    const split = splitRecallDecision(merged, 'buy', [{
            id: 'buy', executionIds: ['buy'], snapshotIds: ['s']
        }, {
            id: 'sell2', executionIds: ['sell']
        }]);
    expect(split.planAssociations![0].decisionId).toBe('buy');
    const removed = reconcileRecallDocument(d, {
        ...episode, executions: episode.executions.slice(1)
    }).document;
    expect(removed.planAssociations![0]).toMatchObject({
        decisionId: null, status: 'needs-confirmation'
    });
});
it('rejects forged risk baseline denominators', () => {
    const d = capture();
    d.plans!.riskBaselines[0].amount = '999';
    expect(() => validateRecallDocument(d)).toThrow(/riskBaseline/);
});
it('holding exit capture retains the earlier entry plan', () => {
    let d = capture();
    d = retainRecallSnapshot(d, {
        ...d.snapshots[0], id: 'exit', retainedBundleId: undefined, decisionId: 'sell', phase: 'holding', cursor: '2026-01-03T00:00:00Z', executionCursor: 'sell'
    });
    d = freezeRecallSnapshotBundle(d, 'exit', {
        bundleId: 'exit-b', retainedAt: '2026-01-03', episode
    });
    expect(d.retainedBundles!.at(-1)!.planVersionIds).toEqual(d.retainedBundles![0].planVersionIds);
});
it('rejects invalid ISO dates instead of accepting arbitrary strings', () => {
    const d = capture();
    d.plans!.drafts[0].recordedAt = '2026-02-30';
    expect(() => validateRecallDocument(d)).toThrow(/ISO/);
});
it('rejects rewriting an initial draft after its immutable version exists', () => {
    const d = capture();
    d.plans!.drafts[0].input.targets[0].price = '99';
    expect(() => validateRecallDocument(d)).toThrow(/read-only/);
});
it('keeps incomplete drafts and snapshots without invented risk baselines', () => {
    let d = createRecallDocument(episode);
    d = plans.upsertRecallPlanDraft(d, {
        id: 'partial', planId: 'partial', decisionId: 'buy', kind: 'initial', input: {
            ...input, initialStop: null
        }, recordedPhase: 'pre-entry', source: 'retrospective', recordedAt: '2026-01-01', knowledgeCutoff: {
            cursor: '2025-12-31', executionCursor: '__recall_before_first_execution__'
        }, hasSeenFuture: false
    });
    d = plans.freezeRecallPlanDraft(d, 'partial', {
        versionId: 'partial-v', riskBaselineId: 'partial-risk', retainedAt: '2026-01-01'
    });
    expect(d.plans!.riskBaselines).toEqual([]);
    expect(plans.calculateRecallPlan(d.plans!.versions[0].input).initialRisk).toMatchObject({
        value: null, reason: 'missing-stop'
    });
});
it('revises an initial plan only with new IDs and a preserved parent', () => {
    const d = capture();
    const revised = plans.upsertRecallPlanDraft(d, {
        ...d.plans!.drafts[0], id: 'correction', kind: 'correction', reason:'纠正止损', parentVersionId: d.plans!.versions[0].id, input: {
            ...input, initialStop: '9.8'
        }
    });
    const frozen = plans.freezeRecallPlanDraft(revised, 'correction', {
        versionId: 'correction-v', riskBaselineId: 'correction-b', retainedAt: '2026-01-02'
    });
    expect(frozen.plans!.versions).toHaveLength(2);
    expect(frozen.plans!.versions[0]).toEqual(d.plans!.versions[0]);
    expect(frozen.plans!.riskBaselines[1].correctsBaselineId).toBe(d.plans!.riskBaselines[0].id);
    expect(frozen.status).toBe('needs-confirmation');
});
it('re-captures explicit legacy absence without substituting current plans', () => {
    const d = capture();
    const captured = freezeRecallSnapshotBundle(d, 's', {
        bundleId: 'legacy', retainedAt: '2026-01-02', episode, sourceBundleId: null
    });
    expect(captured.retainedBundles!.at(-1)!.planVersionIds).toEqual([]);
});
it('adjustment preserves initial risk denominator and requires an explanation', () => {
 const d = capture();
 expect(() => plans.createRecallPlanRevision(d, {planId:'lineage',kind:'adjustment',reason:'',id:'adj',recordedAt:'2026-01-02',recordedPhase:'holding',knowledgeCutoff:{cursor:'2026-01-02',executionCursor:'buy'},hasSeenFuture:false})).toThrow();
 let n = plans.createRecallPlanRevision(d, {planId:'lineage',kind:'adjustment',reason:'结构收紧',id:'adj',recordedAt:'2026-01-02',recordedPhase:'holding',knowledgeCutoff:{cursor:'2026-01-02',executionCursor:'buy'},hasSeenFuture:false});
 n.plans!.drafts[0].input.initialStop='10';
 n=plans.freezeRecallPlanDraft(n,'adj',{versionId:'av',riskBaselineId:'ar',retainedAt:'2026-01-02'});
 expect(n.plans!.riskBaselines).toEqual(d.plans!.riskBaselines);
 expect(plans.recallPlanRiskBaseline(n,'av')?.id).toBe(d.plans!.riskBaselines[0].id);
});
it('captures an adjusted plan together with its original denominator source',()=>{
 let d=capture(); d.retainedBundles![0].documentRevision=1;
 d=plans.createRecallPlanRevision(d,{planId:'lineage',kind:'adjustment',reason:'减仓',id:'adjust',recordedAt:'2026-01-02',recordedPhase:'holding',knowledgeCutoff:{cursor:'2026-01-02',executionCursor:'buy'},hasSeenFuture:false});
 d.plans!.drafts[0].input={...input,resolvedQuantity:'1',sizeInputValue:'1'};
 d=retainRecallSnapshot(d,{...d.snapshots[0],id:'holding',retainedBundleId:undefined,cursor:'2026-01-02',executionCursor:'buy',phase:'holding'});
 d=freezeRecallSnapshotBundle(d,'holding',{bundleId:'holding-b',retainedAt:'2026-01-02',episode});
 expect(d.retainedBundles!.at(-1)!.planVersionIds).toHaveLength(2);
 expect(d.retainedBundles!.at(-1)!.riskBaselineIds).toEqual(d.retainedBundles![0].riskBaselineIds);
});
it('uses sourced budgets without inventing stop risk and guards second opening decisions, not fills',()=>{
 let d=capture();
 d=plans.createRecallPlanRevision(d,{planId:'lineage',kind:'correction',reason:'补记原风险预算',id:'budget',recordedAt:'2026-01-02',recordedPhase:'holding',knowledgeCutoff:{cursor:'2026-01-02',executionCursor:'buy'},hasSeenFuture:false});
 d.plans!.drafts[0].input.initialStop=null;
 d.plans!.drafts[0].riskBudget={amount:'50',currency:'USD',scope:'episode',sourceDescription:'交易日记的预算',evidenceReference:null,provenance:'retrospective',effectiveKnowledgeCutoff:{cursor:'2026-01-02',executionCursor:'buy'}};
 d=plans.freezeRecallPlanDraft(d,'budget',{versionId:'budget-v',riskBaselineId:'budget-b',retainedAt:'2026-01-02'});
 expect(d.plans!.riskBaselines.at(-1)!.method).toBe('fixed-budget');
 const add={...episode.executions[0],id:'add',executedAt:'2026-01-01T12:00:00Z'};
 const e={...episode,executions:[episode.executions[0],add,episode.executions[1]]};
 d.decisions.find(x=>x.id==='buy')!.executionIds.push('add');
 expect(plans.recallEpisodeRiskBaseline(d,e).baseline?.id).toBe('budget-b');
 d.decisions.find(x=>x.id==='buy')!.executionIds=['buy']; d.decisions.push({id:'add',executionIds:['add']});
 expect(plans.recallEpisodeRiskBaseline(d,e)).toMatchObject({baseline:null,reason:'multiple-opening-decisions-require-prior-episode-budget'});
});
it('freezes changed budget evidence as a new correction and never accepts missing revision reasons',()=>{
 let d=capture(); d=plans.createRecallPlanRevision(d,{planId:'lineage',kind:'correction',reason:'预算更正',id:'budget-edit',recordedAt:'2026-01-02',recordedPhase:'holding',knowledgeCutoff:{cursor:'2026-01-02',executionCursor:'buy'},hasSeenFuture:false});
 d.plans!.drafts[0].riskBudget={amount:'50',currency:'USD',scope:'decision',sourceDescription:'日记',evidenceReference:null,provenance:'retrospective',effectiveKnowledgeCutoff:{cursor:'2026-01-02',executionCursor:'buy'}};
 d=plans.freezeRecallPlanDraft(d,'budget-edit',{versionId:'budget-one',riskBaselineId:'risk-one',retainedAt:'2026-01-02'});
 d.plans!.drafts[0].riskBudget!.amount='60';
 d=plans.freezeRecallPlanDraft(d,'budget-edit',{versionId:'budget-two',riskBaselineId:'risk-two',retainedAt:'2026-01-02'});
 expect(d.plans!.versions.at(-1)!.riskBudget!.amount).toBe('60');
 expect(d.plans!.riskBaselines.at(-1)!.amount).toBe('60');
 delete d.plans!.drafts[0].reason; expect(()=>plans.validateRecallPlans(d.plans,d.decisions)).toThrow(/reason/);
});
it.each([['long','10.1'],['long','10.2'],['short','10.1'],['short','10']] as const)('retains %s protective adjustment stop %s without replacing initial risk', (direction,stop)=>{
 let d=capture();
 if(direction==='short'){d.plans!.drafts[0].input={...input,direction:'short',initialStop:'10.3',targets:[]};d.plans!.versions[0].input=structuredClone(d.plans!.drafts[0].input);}
 d=plans.createRecallPlanRevision(d,{planId:'lineage',kind:'adjustment',reason:'保护盈利',id:'protect',recordedAt:'2026-01-02',recordedPhase:'holding',knowledgeCutoff:{cursor:'2026-01-02',executionCursor:'buy'},hasSeenFuture:false});
 d=plans.upsertRecallPlanDraft(d,{...d.plans!.drafts[0],input:{...d.plans!.drafts[0].input,initialStop:stop}});
 const frozen=plans.freezeRecallPlanDraft(d,'protect',{versionId:'protected',riskBaselineId:'unused',retainedAt:'2026-01-02'});
 expect(frozen.plans!.riskBaselines).toEqual(d.plans!.riskBaselines);
 expect(()=>plans.validateRecallPlans(JSON.parse(JSON.stringify(frozen.plans)),frozen.decisions)).not.toThrow();
});
it('invalidates disappeared captured plan fills within a surviving merged decision, preserving explicit relinks',()=>{
 const original=capture(); const merged=mergeRecallDecisions(original,['buy','sell'],'buy');
 const removed=reconcileRecallDocument(merged,{...episode,executions:episode.executions.slice(1)}).document;
 expect(removed.planAssociations![0]).toMatchObject({decisionId:null,status:'needs-confirmation'});
 expect(removed.plans!.versions).toEqual(original.plans!.versions);
 expect(removed.retainedBundles).toEqual(original.retainedBundles);
 const linked=plans.resolveRecallPlanAssociation(removed,'lineage','buy');
 expect(reconcileRecallDocument(linked,{...episode,executions:episode.executions.slice(1)}).document.planAssociations![0].status).toBe('linked');
 expect(reconcileRecallDocument(merged,episode).document.planAssociations![0].status).toBe('linked');
});
it('rejects duplicate evaluation references before a projection insert',()=>{
 const d=capture();
 (d as unknown as {exitEvaluations:unknown}).exitEvaluations={drafts:[],versions:[{id:'evaluation-version'}],associations:[]};
 d.retainedBundles![0].evaluationRevisionIds=['evaluation-version','evaluation-version'];
 expect(()=>validateRecallRetainedState(d)).toThrow(/duplicate revision/);
});
it('preserves captured broker split-fill ownership while all its fills survive regrouping',()=>{
 let d=capture(); const splitFill={...episode.executions[0],id:'buy-part-2'};
 const e={...episode,executions:[episode.executions[0],splitFill,episode.executions[1]]};
 d.decisions[0].executionIds.push(splitFill.id);
 d=freezeRecallSnapshotBundle(d,'s',{bundleId:'split-bundle',retainedAt:'2026-01-02',episode:e});
 d=mergeRecallDecisions(d,['buy','sell'],'buy');
 expect(reconcileRecallDocument(d,e).document.planAssociations![0].status).toBe('linked');
});
