import {expect,it} from 'vitest';
import type {TradeExecution} from '../trades/types';
import type {CrossZeroDiagnostic} from './business-pairing-store';
import {executionContentVersion} from './execution-content-ref';
import {diagnoseCrossZeroQuantity} from './cross-zero-quantity';
import {buildCrossZeroCostDiagnostic} from './cross-zero-cost-diagnostic';

function fixture(rows: Array<[TradeExecution['side'],string,string,string]>=[['buy','10','10','1'],['sell','15','12','3']]) {
 const executions:TradeExecution[]=rows.map(([side,quantity,price,fee],i)=>({id:`e${i}`,side,quantity,price,fee,executedAt:`2026-01-01T00:00:0${i}Z`,accountId:'a',accountLabel:'A',instrument:{id:'i',symbol:'I',name:'I',market:'US',currency:'USD'},source:{platform:'test',row:i,tradeNature:'live'}}));
 const diagnostic:CrossZeroDiagnostic={policy:'source-cross-zero-quantity-v1',scope:{accountId:'a',instrumentId:'i'},sourceSequence:1,fingerprint:'a'.repeat(64),refs:[],status:'candidate',reasons:[],crossing:null,startingInventory:'assumed-zero',financialAllocation:'not-implemented',universeComplete:false};
 const refresh=()=>{
  diagnostic.refs=executions.map(e=>({schemaVersion:1 as const,executionId:e.id,rawVersion:executionContentVersion(e,'raw'),effectiveVersion:executionContentVersion(e,'effective')}));
  const crossing=diagnoseCrossZeroQuantity(executions.map(e=>({executionId:e.id,side:e.side,quantity:e.quantity}))).crossing;
  diagnostic.crossing=crossing?{...crossing,contentRef:{...diagnostic.refs.find(r=>r.executionId===crossing.executionId)!}}:null;
 };
 refresh();return {executions,diagnostic,refresh};
}
const values=(r:ReturnType<typeof buildCrossZeroCostDiagnostic>)=>[r.closeLong?.cost.value,r.closeLong?.gross.value,r.closeLong?.entryFees.map(f=>f.value),r.closeLong?.exitFees.map(f=>f.value),r.closeLong?.totalFees.map(f=>f.value),r.closeLong?.net.value];

it('projects only the close-long share, with exact moving-average cost and fees, without changing source facts',()=>{
 const f=fixture(),sell=f.executions[1];
 sell.source.settlement={currency:'USD',quantity:'15',grossAmount:'180',fees:{commission:'3'},netAmount:'177'};
 sell.source.grossAmount='180';sell.source.cashChange='177';f.refresh();
 const original=structuredClone({executions:f.executions,diagnostic:f.diagnostic}),r=buildCrossZeroCostDiagnostic(f.diagnostic,f.executions);
 expect(r.status).toBe('ready');expect(values(r)).toEqual(['100','20',['1'],['2'],['3'],'17']);
 expect(r.closeLong).toMatchObject({executionId:'e1',contentRef:f.diagnostic.refs[1],sourceQuantity:'15',quantity:'10',openShortQuantity:'5',projection:'derived-close-long-prefix'});
 expect(f.executions).toEqual(original.executions);expect(f.diagnostic).toEqual(original.diagnostic);
});

it('consumes every pending sell before the crossing and preserves authoritative prefix settlement cost',()=>{
 const f=fixture([['buy','10','9.999','1'],['sell','4','12','0.4'],['buy','4','20','0.8'],['sell','15','18','3']]);
 f.executions[0].source.settlement={currency:'USD',quantity:'10',grossAmount:'100',fees:{commission:'1'},netAmount:'-101'};f.refresh();
 expect(values(buildCrossZeroCostDiagnostic(f.diagnostic,[...f.executions].reverse()))).toEqual(['140','40',['1.4'],['2'],['3.4'],'36.6']);
 f.executions[0].source.settlement.quantity='9';f.refresh();
 expect(buildCrossZeroCostDiagnostic(f.diagnostic,f.executions)).toMatchObject({status:'blocked',closeLong:null});
});

it('keeps independently known gross when buy fee is unknown or the last fee split recurs',()=>{
 const f=fixture();f.executions[0].fee='0';f.executions[0].source.feeStatus='unknown';
 f.executions[0].source.settlement={currency:'USD',quantity:'10',grossAmount:'100',fees:{commission:'1'},netAmount:'-101'};f.refresh();
 const r=buildCrossZeroCostDiagnostic(f.diagnostic,f.executions);
 expect(r.status).toBe('ready');expect(values(r)).toEqual(['100','20',[null],['2'],[null],null]);
 expect(r.closeLong?.totalFees[0].knownSubtotal).toBe('2');
 const recurring=fixture();recurring.executions[1].fee='1';recurring.refresh();
 const rr=buildCrossZeroCostDiagnostic(recurring.diagnostic,recurring.executions);
 expect(values(rr)).toEqual(['100','20',['1'],[null],[null],null]);
 expect(rr.closeLong?.exitFees[0].reasons).toContain('non-terminating-decimal');
});

it('keeps fee currencies separate and refuses gross when original last settlement is foreign',()=>{
 const f=fixture();f.executions[1].fee='24';f.executions[1].source.settlement={currency:'HKD',quantity:'15',grossAmount:'1440',fees:{commission:'24'},netAmount:'1416'};f.refresh();
 const r=buildCrossZeroCostDiagnostic(f.diagnostic,f.executions);
 expect(r.status).toBe('ready');expect(values(r)).toEqual([null,null,['1'],['16'],['1','16'],null]);
 expect(r.closeLong?.totalFees.map(a=>a.currency)).toEqual(['USD','HKD']);
 expect(r.closeLong?.gross.reasons).toContain('unsupported-pnl-currency');
});

it('retains the contribution-time precision rejection after final inventory becomes flat',()=>{
 const f=fixture([['buy','1','1','0.3'],['buy','2','2','0.6'],['sell','4','3','0.4']]);
 const r=buildCrossZeroCostDiagnostic(f.diagnostic,f.executions);
 expect(r.status).toBe('ready');expect(values(r)).toEqual([null,null,['0.9'],['0.3'],['1.2'],null]);
 expect(r.closeLong?.gross.reasons).toContain('unsupported-gross-precision');
});

it('sorts full precision time for fees while retaining unsupported submillisecond gross',()=>{
 const f=fixture([['buy','10','10','1'],['sell','4','12','0.4'],['buy','4','20','0.8'],['sell','15','18','3']]);
 f.executions.forEach((e,i)=>{e.executedAt=`2026-01-01T00:00:00.000${i+1}Z`;});f.refresh();
 const r=buildCrossZeroCostDiagnostic(f.diagnostic,[...f.executions].reverse());
 expect(r.status).toBe('ready');expect(values(r)).toEqual([null,null,['1.4'],['2'],['3.4'],null]);
 expect(r.closeLong?.gross.reasons).toContain('unsupported-execution-time');
});

it('blocks invalid money anywhere in the original prefix and cannot wash it through projection',()=>{
 for(const mutate of [
  (e:TradeExecution)=>{e.fee='-1';},
  (e:TradeExecution)=>{e.source.settlement={currency:'USD',quantity:'10',grossAmount:'100',fees:{commission:'1'},netAmount:'-100'};},
 ]){const f=fixture();mutate(f.executions[0]);f.refresh();expect(buildCrossZeroCostDiagnostic(f.diagnostic,f.executions)).toMatchObject({status:'blocked',closeLong:null});}
 const f=fixture();f.executions[1].source.settlement={currency:'USD',quantity:'15',grossAmount:'181',fees:{commission:'3'},netAmount:'178'};f.refresh();
 expect(buildCrossZeroCostDiagnostic(f.diagnostic,f.executions)).toMatchObject({status:'blocked',closeLong:null});
});

it('revalidates refs and quantity, fingerprints all source content, and keeps old results immutable',()=>{
 const f=fixture(),old=buildCrossZeroCostDiagnostic(f.diagnostic,f.executions),copy=structuredClone(old);
 f.diagnostic.sourceSequence++;expect(buildCrossZeroCostDiagnostic(f.diagnostic,[...f.executions].reverse()).fingerprint).toBe(old.fingerprint);
 f.executions[0].fee='2';expect(buildCrossZeroCostDiagnostic(f.diagnostic,f.executions)).toMatchObject({status:'blocked',closeLong:null});
 f.refresh();expect(buildCrossZeroCostDiagnostic(f.diagnostic,f.executions).fingerprint).not.toBe(old.fingerprint);expect(old).toEqual(copy);
 for(const mutate of [
  (q:CrossZeroDiagnostic)=>{q.refs.pop();},
  (q:CrossZeroDiagnostic)=>{q.refs.push({...q.refs[0]});},
  (q:CrossZeroDiagnostic)=>{q.refs[0].effectiveVersion='f'.repeat(64);},
  (q:CrossZeroDiagnostic)=>{q.crossing!.closeLongQuantity='9';},
  (q:CrossZeroDiagnostic)=>{q.crossing!.contentRef.rawVersion='f'.repeat(64);},
 ]){const q=structuredClone(f.diagnostic);mutate(q);expect(buildCrossZeroCostDiagnostic(q,f.executions)).toMatchObject({status:'blocked',closeLong:null});}
});

it('blocks unsupported source and explicit close-long crossing even with freshly matching refs',()=>{
 for(const mutate of [
  (e:TradeExecution)=>{e.source.tradeNature='unknown';},
  (e:TradeExecution)=>{e.source.historyIncomplete=['gap'];},
  (e:TradeExecution)=>{e.source.positionEffect='close-long';},
 ]){const f=fixture();mutate(f.executions[1]);f.refresh();expect(buildCrossZeroCostDiagnostic(f.diagnostic,f.executions)).toMatchObject({status:'blocked',closeLong:null});}
 const f=fixture();f.diagnostic.status='not-applicable';f.diagnostic.crossing=null;
 expect(buildCrossZeroCostDiagnostic(f.diagnostic,f.executions)).toMatchObject({status:'not-applicable',closeLong:null});
});
