import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import type {TradeExecution} from '../trades/types';
import type {PairingInspection,PairingRound} from './business-pairing-store';
import {executionContentVersion} from './execution-content-ref';
import {buildInterleavedPairingDiagnostic,INTERLEAVED_PAIRING_POLICY} from './interleaved-accounting-diagnostic';
import {buildInterleavedRoundFinancialDiagnostic as build} from './interleaved-round-financial';

const time=(n:number)=>`2026-01-10T02:00:0${n}Z`;
const stable=(v:unknown):string=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}':JSON.stringify(v);
function execution(id:string,side:'buy'|'sell',quantity:string,price:string,fee:string,n:number):TradeExecution{
 return {id,side,quantity,price,fee,executedAt:time(n),accountId:'a',accountLabel:'A',instrument:{id:'US:X',symbol:'X',name:'X',market:'US',currency:'USD'},source:{platform:'test',row:n,tradeNature:'live',timePrecision:'second',timeEvidence:'row'}};
}
function fixture(mode:'last'|'both'|'combined'='last',change?:(es:TradeExecution[])=>void){
 const b=execution('b','buy','10','16','1',1);
 b.source.executionGroup={kind:'order',fillCount:2,quantity:'10',grossAmount:'160',fills:[{page:1,row:10,quantity:'4',price:'10',grossAmount:'40',executedAt:time(1),timePrecision:'second',timeEvidence:'row'},{page:1,row:11,quantity:'6',price:'20',grossAmount:'120',executedAt:time(3),timePrecision:'second',timeEvidence:'row'}]};
 const es=[b,execution('s1','sell','2','15','0.2',2),execution('s2','sell','8','25','0.8',4)];change?.(es);
 const input={scope:{accountId:'a',instrumentId:'US:X'},sourceSequence:12,sourceDependencyFingerprint:'0'.repeat(64),sourceIssues:[] as string[],refs:es.map(e=>({schemaVersion:1 as const,executionId:e.id,rawVersion:executionContentVersion(e,'raw'),effectiveVersion:executionContentVersion(e,'effective')}))};
 const pair=(id:string,quantity:string)=>({openingExecutionId:'b',closingExecutionId:id,quantity});
 const rounds:PairingRound[]=mode==='combined'?[{id:'combined',closingExecutionIds:['s1','s2'],pairings:[pair('s1','2'),pair('s2','8')]}]:[...(mode==='both'?[{id:'first',closingExecutionIds:['s1'],pairings:[pair('s1','2')]}]:[]),{id:'last',closingExecutionIds:['s2'],pairings:[pair('s2','8')]}];
 const proof=buildInterleavedPairingDiagnostic(input,es,{confirmedClosingExecutionIds:rounds.flatMap(r=>r.closingExecutionIds),pairings:rounds.flatMap(r=>r.pairings)});
 const dependencies={policy:INTERLEAVED_PAIRING_POLICY,scope:input.scope,refs:proof.refs,sourceProofFingerprint:proof.sourceProofFingerprint};
 const fingerprint=createHash('sha256').update(stable(dependencies)).digest('hex');
 const inspection:PairingInspection={scope:input.scope,revision:1,fingerprint,refs:proof.refs,status:'current',reasons:[],sourceSequence:12,fact:{schemaVersion:1,policy:INTERLEAVED_PAIRING_POLICY,scope:input.scope,revision:1,fingerprint,refs:proof.refs,dependencies,rounds,confirmedBy:'test',basis:'explicit',recordedAt:'fixture',consumedSourceSequence:10,commitSequence:11}};
 return {es,input,inspection};
}
it.each(['last','both','combined'] as const)('aggregates A %s with pending sells consuming moving-average cost and fees',mode=>{
 const {es,input,inspection}=fixture(mode),before=JSON.stringify([es,input,inspection]),r=build(inspection,es,input);
 expect(r.accountingFees.status).toBe('ready');expect(r.accountingPnl.status).toBe('ready');
 expect(r.accountingPnl.rounds.map(p=>[p.gross.value,p.net.value,p.fees[0].value])).toEqual(mode==='last'?[['60','58.4','1.6']]:mode==='both'?[['10','9.6','0.4'],['60','58.4','1.6']]:[['70','68','2']]);
 expect(r.accountingFees).toMatchObject({policy:'interleaved-long-round-fees-v1',sourceSequence:12,revision:1,fingerprint:inspection.fingerprint,sourceRefs:inspection.refs,universeComplete:false,pool:null,sourceMoney:[]});
 expect(r.accountingPnl.policy).toBe('interleaved-long-round-pnl-v1');expect(JSON.stringify(r)).not.toContain('interleaved:fill:');expect(JSON.stringify([es,input,inspection])).toBe(before);
 expect(build({...inspection,sourceSequence:20},es,{...input,sourceSequence:20})).toMatchObject({accountingPnl:{status:'ready'}});
});
it('keeps unknown fees independent from trustworthy gross and cross-currency fees independent from unknown PnL',()=>{
 const unknown=fixture('last',es=>{es[0].source.feeStatus='unknown';});const a=build(unknown.inspection,unknown.es,unknown.input);
 expect(a.accountingPnl.rounds[0]).toMatchObject({gross:{value:'60'},net:{value:null}});expect(a.accountingFees.rounds[0].fees[0].value).toBeNull();
 const cross=fixture('last',es=>{es[0].source.settlement={currency:'HKD',quantity:'10',grossAmount:'1280',netAmount:'-1281',fees:{commission:'1'}};});const b=build(cross.inspection,cross.es,cross.input);
 expect(b.accountingPnl.rounds[0]).toMatchObject({gross:{value:null},net:{value:null}});expect(b.accountingFees.rounds[0].fees).toEqual(expect.arrayContaining([expect.objectContaining({currency:'HKD',value:'0.8'}),expect.objectContaining({currency:'USD',value:'0.8'})]));
});
it.each(['stale','empty','unsupported','snapshot-behind'] as const)('blocks %s even if caller passes otherwise matching facts',status=>{
 const {es,input,inspection}=fixture();const r=build({...inspection,status},es,input);expect(r.accountingFees.status).toBe('blocked');expect(r.accountingPnl.rounds).toEqual([]);
});
const corruptions:Array<[string,(f:ReturnType<typeof fixture>)=>void]>=[
 ['input sequence',f=>{f.input.sourceSequence++;}],
 ['commit in future',f=>{f.inspection.fact!.commitSequence=13;}],
 ['invalid consumed watermark',f=>{f.inspection.fact!.consumedSourceSequence=11;}],
 ['input scope',f=>{f.input={...f.input,scope:{...f.input.scope,accountId:'foreign'}};}],
 ['fact scope',f=>{f.inspection.fact!.scope={...f.input.scope,accountId:'foreign'};}],
 ['revision',f=>{f.inspection.fact!.revision++;}],
 ['fact fingerprint',f=>{f.inspection.fact!.fingerprint='f'.repeat(64);}],
 ['inspection fingerprint',f=>{f.inspection.fingerprint='f'.repeat(64);}],
 ['input raw ref',f=>{f.input.refs=structuredClone(f.input.refs);f.input.refs[0].rawVersion='f'.repeat(64);}],
 ['duplicate input ref',f=>{f.input.refs=[...f.input.refs,f.input.refs[0]];}],
 ['fact refs',f=>{f.inspection.fact!.refs=f.input.refs.slice(1);}],
 ['dependency proof',f=>{f.inspection.fact!.dependencies={...(f.inspection.fact!.dependencies as object),sourceProofFingerprint:'f'.repeat(64)};}],
 ['source dependency',f=>{f.input.sourceDependencyFingerprint='f'.repeat(64);}],
 ['duplicate round',f=>{f.inspection.fact!.rounds.push(structuredClone(f.inspection.fact!.rounds[0]));}],
 ['empty round',f=>{f.inspection.fact!.rounds.push({id:'empty',closingExecutionIds:[],pairings:[]});}],
 ['duplicate close',f=>{f.inspection.fact!.rounds[1].closingExecutionIds.push('s1');}],
 ['unknown close',f=>{f.inspection.fact!.rounds[1].closingExecutionIds=['unknown'];}],
 ['wrong round membership',f=>{const rs=f.inspection.fact!.rounds;[rs[0].pairings,rs[1].pairings]=[rs[1].pairings,rs[0].pairings];}],
 ['wrong LIFO quantity',f=>{f.inspection.fact!.rounds[1].pairings[0].quantity='7';}],
 ['empty facts',f=>{f.inspection.fact!.rounds=[];}],
 ['wrong policy',f=>{f.inspection.fact!.policy='ordinary-live-long-lifo-v1';}],
];
it.each(corruptions)('refuses mixed or malformed confirmation: %s',(_label,corrupt)=>{
 const f=fixture('both');corrupt(f);const r=build(f.inspection,f.es,f.input);expect(r.accountingFees.status).toBe('blocked');expect(r.accountingFees.rounds).toEqual([]);expect(r.accountingPnl.status).toBe('blocked');expect(r.accountingPnl.rounds).toEqual([]);
});
