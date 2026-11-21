import {expect,it} from 'vitest';
import type {TradeExecution} from '../trades/types';
import {executionContentVersion} from './execution-content-ref';
import {buildInterleavedAccountingDiagnostic as build} from './interleaved-accounting-diagnostic';

const time=(n:number)=>`2026-01-10T02:00:0${n}Z`;
function single(id:string,side:'buy'|'sell',quantity:string,price:string,fee:string,n:number):TradeExecution {
 return {id,side,quantity,price,fee,executedAt:time(n),accountId:'a',accountLabel:'A',instrument:{id:'US:X',symbol:'X',name:'X',market:'US',currency:'USD'},source:{platform:'test',row:n,tradeNature:'live',timePrecision:'second',timeEvidence:'row'}};
}
function group(e:TradeExecution,quantities:string[],prices:string[],grosses:string[],times:number[]):TradeExecution {
 e.source.executionGroup={kind:'order',fillCount:2,quantity:e.quantity,grossAmount:grosses.reduce((n,s)=>n+Number(s),0).toString(),fills:quantities.map((quantity,i)=>({page:1,row:10+i,quantity,price:prices[i],grossAmount:grosses[i],executedAt:time(times[i]),timePrecision:'second',timeEvidence:'row'}))};return e;
}
function sampleA(){return [group(single('b','buy','10','16','1',1),['4','6'],['10','20'],['40','120'],[1,3]),single('s1','sell','2','15','0.2',2),single('s2','sell','8','25','0.8',4)];}
function sampleB(){return [single('b','buy','10','10','1',1),group(single('s','sell','10','21','1',2),['4','6'],['15','25'],['60','150'],[2,4]),single('b2','buy','6','20','0.6',3)];}
function input(es:TradeExecution[]){return {scope:{accountId:'a',instrumentId:'US:X'},sourceSequence:1,sourceDependencyFingerprint:'0'.repeat(64),sourceIssues:[] as string[],refs:es.map(e=>({schemaVersion:1 as const,executionId:e.id,rawVersion:executionContentVersion(e,'raw'),effectiveVersion:executionContentVersion(e,'effective')}))};}
function values(result:ReturnType<typeof build>){return result.closes.map(c=>({id:c.executionId,q:c.quantity,cost:c.cost.value,gross:c.gross.value,net:c.net.value,entry:c.entryFees[0]?.value,exit:c.exitFees[0]?.value}));}
it('accounts buy fills only when they occur (A), without mutating original parents or refs',()=>{
 const es=sampleA(),i=input(es),before=JSON.stringify([es,i]);const r=build(i,es);
 expect(r.status).toBe('ready');expect(values(r)).toEqual([{id:'s1',q:'2',cost:'20',gross:'10',net:'9.6',entry:'0.2',exit:'0.2'},{id:'s2',q:'8',cost:'140',gross:'60',net:'58.4',entry:'0.8',exit:'0.8'}]);
 expect(r.remainingFees[0].value).toBe('0');expect(JSON.stringify([es,i])).toBe(before);
});
it('aggregates sell fills after intermediate buys (B)',()=>{
 const es=sampleB(),r=build(input(es),es);expect(r.status).toBe('ready');expect(values(r)).toEqual([{id:'s',q:'10',cost:'130',gross:'80',net:'78',entry:'1',exit:'1'}]);expect(r.remainingFees[0].value).toBe('0.6');
});

it('preserves output under input permutation and binds dependency content but not sequence',()=>{
 const es=sampleA(),i=input(es),r=build(i,es);
 expect(build({...i,refs:[...i.refs].reverse()},[...es].reverse())).toEqual(r);
 expect(build({...i,sourceSequence:99},es)).toEqual({...r,sourceSequence:99});
 const blocked={...i,sourceIssues:['monthly','unknown']};
 const b=build(blocked,es);
 expect(build({...blocked,sourceIssues:['unknown','monthly']},es)).toEqual(b);
 expect(build({...blocked,sourceDependencyFingerprint:'1'.repeat(64)},es).fingerprint).not.toBe(b.fingerprint);
 expect(b.status).toBe('blocked');expect(b.closes).toEqual([]);
});
it('keeps gross and cost known with unknown fees, including untrusted settlement fee placeholders',()=>{
 const es=sampleA();es[0].source.feeStatus='unknown';
 es[0].source.settlement={currency:'USD',quantity:'10',grossAmount:'160',netAmount:'-999',fees:{commission:'9'}};
 const r=build(input(es),es);expect(r.status).toBe('ready');
 expect(r.closes[0].gross.value).toBe('10');expect(r.closes[0].cost.value).toBe('20');expect(r.closes[0].net.value).toBeNull();
 expect(r.parentFeeAllocations[0]).toMatchObject({sourceValue:null,valueStatus:'unknown',exactConserved:null,decimalComplete:false});
});
it('publishes recurring first-layer shares as unknown without a tail adjustment',()=>{
 const es=[group(single('b','buy','3','10','1',1),['1','2'],['10','10'],['10','20'],[1,3]),single('s','sell','3','20','0',4)];
 const r=build(input(es),es);expect(r.status).toBe('ready');
 expect(r.parentFeeAllocations[0]).toMatchObject({sourceValue:'1',exactConserved:true,decimalComplete:false,fills:[{value:null,reasons:['non-terminating-decimal']},{value:null,reasons:['non-terminating-decimal']}]});
 expect(r.closes[0].gross.value).toBe('30');expect(r.closes[0].net.value).toBeNull();expect(r.closes[0].entryFees[0].value).toBeNull();
});
it('retains a true zero gross and independently known fees',()=>{
 const es=sampleA();es[1].price='10';const r=build(input(es),es);
 expect(r.status).toBe('ready');expect(r.closes[0].gross.value).toBe('0');expect(r.closes[0].net.value).toBe('-0.4');
});
it('keeps cross-currency money unknown while retaining fees',()=>{
 const es=sampleA();es[0].source.settlement={currency:'HKD',quantity:'10',grossAmount:'1280',netAmount:'-1281',fees:{commission:'1'}};
 const r=build(input(es),es);expect(r.status).toBe('ready');
 expect(r.closes[0].gross.value).toBeNull();expect(r.closes[0].cost.value).toBeNull();expect(r.closes[0].net.value).toBeNull();
 expect(r.closes[0].entryFees[0]).toMatchObject({currency:'HKD',value:'0.2'});
 const mixed=sampleA();mixed[1].instrument={...mixed[1].instrument,currency:'HKD'};
 expect(build(input(mixed),mixed).closes[0].gross.value).toBeNull();
});
it('does not recalculate ordinary settlement turnover from its displayed price',()=>{
 const es=sampleA();es[1].price='999';es[1].source.settlement={currency:'USD',quantity:'2',grossAmount:'30',netAmount:'29.8',fees:{commission:'0.2'}};
 const r=build(input(es),es);expect(r.status).toBe('ready');expect(r.closes[0].gross.value).toBe('10');expect(r.closes[0].cost.value).toBe('20');
});
it('keeps a ledger-unsupported recurring average unknown',()=>{
 const es=[group(single('b','buy','2','0.5','0',1),['1','1'],['0','1'],['0','1'],[1,2]),single('b2','buy','1','0','0',3),single('s','sell','1','1','0',4)];
 const r=build(input(es),es);expect(r.status).toBe('ready');expect(r.closes[0].gross.value).toBeNull();expect(r.closes[0].gross.reasons).toContain('unsupported-gross-precision');
});
const invalid: Array<[string,(es:TradeExecution[])=>void]>=[
 ['future fill inventory',es=>{es[1].quantity='5';}],
 ['equivalent timezone simultaneous instant',es=>{es[1].executedAt='2026-01-10T10:00:01+08:00';}],
 ['meaningful submillisecond',es=>{es[1].executedAt='2026-01-10T02:00:02.0001Z';}],
 ['invalid calendar',es=>{es[1].executedAt='2026-02-30T02:00:02Z';}],
 ['bad group summary',es=>{es[0].source.executionGroup!.grossAmount='1';}],
 ['bad original settlement net',es=>{es[0].source.settlement={currency:'USD',quantity:'10',grossAmount:'160',netAmount:'-160',fees:{commission:'1'}};}],
 ['non-live source',es=>{es[0].source.tradeNature='simulation';}],
 ['unreliable parent time',es=>{es[0].source.timeEvidence='inferred';}],
 ['unresolved parent time candidates',es=>{es[0].source.timeCandidates=[{at:'invalid'} as never];}],
 ['wrong direction',es=>{es[1].source.positionEffect='open-long';}],
 ['grey-market',es=>{es[0].source.tradingSession='grey-market';}],
 ['incomplete history',es=>{es[0].source.historyIncomplete=['missing'];}],
];
it.each(invalid)('atomically blocks %s',(_name,mutate)=>{
 const es=sampleA();mutate(es);const r=build(input(es),es);expect(r.status).toBe('blocked');expect(r.closes).toEqual([]);expect(r.parentFeeAllocations).toEqual([]);expect(r.remainingFees).toEqual([]);
});
it('rejects missing, duplicate, stale, malformed refs and invalid dependency identity',()=>{
 const es=sampleA(),i=input(es);
 for(const refs of [i.refs.slice(1),[...i.refs,i.refs[0]],i.refs.map((r,n)=>n===0?{...r,effectiveVersion:'0'.repeat(64)}:r),i.refs.map((r,n)=>n===0?{...r,rawVersion:'raw'}:r)])expect(build({...i,refs},es).status).toBe('blocked');
 expect(build({...i,sourceDependencyFingerprint:''},es).status).toBe('blocked');
 const stale=build(i,es),before=JSON.stringify(stale);es[0].source.executionGroup!.fills[1].price='25';es[0].source.executionGroup!.fills[1].grossAmount='150';es[0].source.executionGroup!.grossAmount='190';es[0].price='19';
 expect(build(i,es).status).toBe('blocked');const fresh=build(input(es),es);expect(fresh.status).toBe('ready');expect(fresh.fingerprint).not.toBe(stale.fingerprint);expect(fresh.closes[1].gross.value).toBe('30');expect(JSON.stringify(stale)).toBe(before);
});
it('blocks duplicate execution IDs and mismatched scopes without partial results',()=>{
 const es=sampleA();es[1].id=es[0].id;expect(build(input(es),es).status).toBe('blocked');
 const other=sampleA();other[1].accountId='other';expect(build(input(other),other).status).toBe('blocked');
});
it('rejects proven duplicate document locations across parents or ordinary rows, never by filename alone',()=>{
 const es=sampleA();es[0].source.fileFingerprint='file';es[1].source.fileFingerprint='file';es[1].source.page=1;es[1].source.row=10;
 expect(build(input(es),es).reasons).toContain('duplicate-source-location');
 es[1].source.fileFingerprint='other';expect(build(input(es),es).status).toBe('ready');
 delete es[0].source.fileFingerprint;delete es[1].source.fileFingerprint;es[0].source.fileName='same.pdf';es[1].source.fileName='same.pdf';expect(build(input(es),es).status).toBe('ready');
 const bs=sampleB();bs[1].source.fileFingerprint='file';bs[1].source.page=1;bs[1].source.row=10;bs[0].source.fileFingerprint='file';bs[0].source.page=1;bs[0].source.row=10;
 expect(build(input(bs),bs).status).toBe('blocked');
});
it('does not let parent time metadata move later fills to the first trading day',()=>{
 const es=sampleA();es[0].source.tradingDate='1900-01-01';es[0].source.marketCalendarDate='1900-01-01';
 expect(values(build(input(es),es))).toEqual(values(build(input(sampleA()),sampleA())));
});
it('handles malformed persisted groups without throwing and leaves ordinary scopes to the old path',()=>{
 const es=sampleA();es[0].source.executionGroup!.fills[0]=null as never;
 expect(()=>build(input(es),es)).not.toThrow();expect(build(input(es),es).status).toBe('blocked');
 const ordinary=[single('b','buy','1','10','0',1)];expect(build(input(ordinary),ordinary).status).toBe('not-applicable');
});

it('detects source-location conflict between distinct parents despite distinct timestamps',()=>{
 const es=sampleA();es[0].source.fileFingerprint='file';
 const other=group(single('b2','buy','10','16','1',5),['4','6'],['10','20'],['40','120'],[5,6]);other.source.fileFingerprint='file';es.push(other);
 expect(build(input(es),es).reasons).toContain('duplicate-source-location');
 other.source.fileFingerprint='different';expect(build(input(es),es).status).toBe('ready');
});
it('prevents crafted source IDs from colliding with private fill/whole namespaces',()=>{
 const es=sampleA();es[1].id='interleaved:fill:["b",1,10]';es[2].id='parent';
 const r=build(input(es),es);expect(r.status).toBe('ready');expect(r.closes.map(c=>c.gross.value)).toEqual(['10','60']);
});

import {buildInterleavedPairingDiagnostic} from './interleaved-accounting-diagnostic';
it('validates B by fill time with parent identities and keeps source proof independent of command',()=>{
 const es=sampleB(),i=input(es),command={confirmedClosingExecutionIds:['s'],pairings:[{openingExecutionId:'b',closingExecutionId:'s',quantity:'4'},{openingExecutionId:'b2',closingExecutionId:'s',quantity:'6'}]};
 const good=buildInterleavedPairingDiagnostic(i,es,command);
 expect(good.status).toBe('ready');expect(good.policy).toBe('ordinary-live-long-fill-lifo-v1');expect(good.refs).toEqual(build(i,es).refs);
 const bad=buildInterleavedPairingDiagnostic(i,es,{...command,pairings:[{openingExecutionId:'b',closingExecutionId:'s',quantity:'10'}]});
 expect(bad.status).toBe('blocked');expect(bad.reasons).toContain('allocation-mismatch');expect(bad.sourceProofFingerprint).toBe(good.sourceProofFingerprint);
 expect(buildInterleavedPairingDiagnostic({...i,refs:[...i.refs].reverse()},[...es].reverse(),command)).toEqual(good);
});
it('consumes pending sells in A and rejects future inventory',()=>{
 const es=sampleA(),command={confirmedClosingExecutionIds:['s2'],pairings:[{openingExecutionId:'b',closingExecutionId:'s2',quantity:'8'}]};
 expect(buildInterleavedPairingDiagnostic(input(es),es,command).status).toBe('ready');
 es[1].quantity='5';expect(buildInterleavedPairingDiagnostic(input(es),es,command).status).toBe('blocked');
});

import {createHash} from 'node:crypto';
it('retains the exact original two-argument financial JSON',()=>{
 const a=sampleA(),b=sampleB(),i=input(a);
 const outputs=[build(i,a),build(input(b),b),build({...i,sourceIssues:['unknown','monthly']},a),build(input([single('b','buy','1','10','0',1)]),[single('b','buy','1','10','0',1)])];
 expect(createHash('sha256').update(JSON.stringify(outputs)).digest('hex')).toBe('afa1ad2f159c6cb8b86313effa532db58acdbd6f2cc1f88f33f1e126522ec259');
});
