import {expect,it} from 'vitest';
import type {TradeExecution} from '../trades/types';
import type {CrossZeroDiagnostic} from './business-pairing-store';
import {executionContentVersion} from './execution-content-ref';
import {buildCrossZeroMoneyDiagnostic} from './cross-zero-money-diagnostic';

function fixture(buy='10',sell='15',price='12',fee='3') {
 const executions:TradeExecution[]=[['b','buy',buy],['s','sell',sell]].map(([id,side,quantity],i)=>({id,side:side as 'buy'|'sell',quantity,price,fee,executedAt:`2026-01-01T00:00:0${i}Z`,accountId:'a',accountLabel:'A',instrument:{id:'i',symbol:'I',name:'I',market:'US',currency:'USD'},source:{platform:'test',row:i,tradeNature:'live'}}));
 const diagnostic:CrossZeroDiagnostic={policy:'source-cross-zero-quantity-v1',scope:{accountId:'a',instrumentId:'i'},sourceSequence:1,fingerprint:'a'.repeat(64),refs:executions.map(e=>({schemaVersion:1,executionId:e.id,rawVersion:executionContentVersion(e,'raw'),effectiveVersion:executionContentVersion(e,'effective')})),status:'candidate',reasons:[],crossing:null,startingInventory:'assumed-zero',financialAllocation:'not-implemented',universeComplete:false};
 const refresh=()=>{diagnostic.refs=executions.map(e=>({schemaVersion:1,executionId:e.id,rawVersion:executionContentVersion(e,'raw'),effectiveVersion:executionContentVersion(e,'effective')}));if(diagnostic.crossing)diagnostic.crossing.contentRef={...diagnostic.refs[1]};};
 diagnostic.crossing={executionId:'s',contentRef:{...diagnostic.refs[1]},sourceQuantity:sell,closeLongQuantity:buy,openShortQuantity:'5'};
 return {executions,diagnostic,refresh};
}

it('conserves the crossing sell cash dimensions without allocating entry costs',()=>{
 const f=fixture();f.executions[1].source.settlement={currency:'USD',quantity:'15',grossAmount:'180',fees:{commission:'3'},netAmount:'177'};f.refresh();
 const result=buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions);
 expect(result.status).toBe('allocated');
 expect(result.crossing?.amounts.map(a=>[a.kind,a.currency,a.sourceValue,a.closeLongValue,a.openShortValue,a.status])).toEqual([
  ['quote-gross','USD','180','120','60','conserved'],['fee','USD','3','2','1','conserved'],['settlement-gross','USD','180','120','60','conserved'],['settlement-net','USD','177','118','59','conserved'],
 ]);
 expect(result.costAllocation).toBe('not-implemented');expect(result.universeComplete).toBe(false);
});

it('keeps quote and foreign settlement dimensions separate',()=>{
 const f=fixture();f.executions[1].source.settlement={currency:'EUR',quantity:'15',grossAmount:'150',fees:{commission:'2',tax:'1'},netAmount:'147'};f.refresh();
 const r=buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions);
 expect(r.crossing?.amounts.map(a=>[a.currency,a.closeLongValue,a.openShortValue])).toEqual([['USD','120','60'],['EUR','2','1'],['EUR','100','50'],['EUR','98','49']]);
});

it('preserves independent gross when fee is recurring, unknown or settlement absent',()=>{
 const f=fixture('1','3','2','1');f.diagnostic.crossing!.openShortQuantity='2';
 let r=buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions);
 expect(r.status).toBe('allocated');expect(r.crossing?.amounts[0].closeLongValue).toBe('2');
 expect(r.crossing?.amounts[1]).toMatchObject({sourceValue:'1',status:'unknown',closeLongValue:null,openShortValue:null,reasons:['non-terminating-decimal']});
 expect(r.crossing?.amounts[3]).toMatchObject({status:'unknown',sourceValue:null});
 f.executions[1].source.feeStatus='unknown';f.refresh();r=buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions);
 expect(r.crossing?.amounts[1]).toMatchObject({sourceValue:null,status:'unknown'});
 f.executions[1].source.settlement={currency:'USD',quantity:'3',grossAmount:'6',fees:{commission:'99'},netAmount:'5'};f.refresh();r=buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions);
 expect(r.status).toBe('allocated');expect(r.crossing?.amounts[3]).toMatchObject({status:'unknown',closeLongValue:null});
});

it('allocates exact fractional quantities, signed cash, and zero without rounding',()=>{
 const f=fixture('0.5','0.625','8','0.125');f.diagnostic.crossing!.openShortQuantity='0.125';
 let r=buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions);
 expect(r.crossing?.amounts.slice(0,2).map(a=>[a.sourceValue,a.closeLongValue,a.openShortValue])).toEqual([['5','4','1'],['0.125','0.1','0.025']]);
 const signed=fixture();signed.executions[1].fee='183';signed.executions[1].source.settlement={currency:'USD',quantity:'15',grossAmount:'180',fees:{commission:'183'},netAmount:'-3'};signed.refresh();
 r=buildCrossZeroMoneyDiagnostic(signed.diagnostic,signed.executions);expect(r.crossing?.amounts[3]).toMatchObject({sourceValue:'-3',closeLongValue:'-2',openShortValue:'-1'});
 const z=fixture('1','3','2','0');z.diagnostic.crossing!.openShortQuantity='2';expect(buildCrossZeroMoneyDiagnostic(z.diagnostic,z.executions).crossing?.amounts[1]).toMatchObject({status:'conserved',closeLongValue:'0',openShortValue:'0'});
});

it('blocks inconsistent settlement dimensions while retaining trustworthy quote and fee',()=>{
 for(const change of [{quantity:'14'},{grossAmount:'181'},{fees:{commission:'2'}},{netAmount:'176'},{currency:'XXX'}]){
  const f=fixture();f.executions[1].source.settlement={currency:'USD',quantity:'15',grossAmount:'180',fees:{commission:'3'},netAmount:'177',...change};f.refresh();
  const r=buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions);expect(r.status).toBe('blocked');
  expect(r.crossing?.amounts[0].status).toBe('conserved');
  for(const a of r.crossing?.amounts.filter(a=>a.status==='invalid')??[]){expect([a.sourceValue,a.closeLongValue,a.openShortValue]).toEqual([null,null,null]);expect(a.reasons.length).toBeGreaterThan(0);}
  expect(r.crossing?.amounts[3].status).toBe('invalid');
 }
});

it('blocks a numeric settlement currency from persisted JSON while retaining quote gross',()=>{
 const f=fixture();
 f.executions[1].source.settlement=JSON.parse('{"currency":42,"quantity":"15","grossAmount":"180","fees":{"commission":"3"},"netAmount":"177"}');
 f.refresh();
 const r=buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions);
 expect(r.status).toBe('blocked');
 expect(r.crossing?.amounts[0]).toMatchObject({currency:'USD',status:'conserved',sourceValue:'180',closeLongValue:'120',openShortValue:'60'});
 expect(r.crossing?.amounts.slice(1).map(a=>[a.currency,a.status,a.sourceValue,a.closeLongValue,a.openShortValue])).toEqual([
  ['','invalid',null,null,null],['','invalid',null,null,null],['','invalid',null,null,null],
 ]);
 expect(r.reasons).toEqual(expect.arrayContaining(['invalid-fee-currency','invalid-settlement-currency']));
});

it('rejects forged identity, content, quantity and main-price inputs atomically',()=>{
 const changes:Array<(f:ReturnType<typeof fixture>)=>void>=[
  f=>{f.diagnostic.policy='fake' as CrossZeroDiagnostic['policy'];},
  f=>{f.diagnostic.refs.push({...f.diagnostic.refs[0]});},f=>{f.diagnostic.refs.pop();},
  f=>{f.diagnostic.refs[1].executionId=42 as unknown as string;},
  f=>{f.executions.push({...f.executions[1]});},f=>{f.executions[1].accountId='other';f.refresh();},
  f=>{f.executions[1].fee='4';},f=>{f.diagnostic.crossing!.contentRef.rawVersion='f'.repeat(64);},
  f=>{f.diagnostic.crossing!.closeLongQuantity='9';f.diagnostic.crossing!.openShortQuantity='6';},
  f=>{f.executions[1].price='1e2';f.refresh();},f=>{f.executions[1].source.grossAmount='181';f.refresh();},
  f=>{f.diagnostic.fingerprint='bad';},f=>{f.diagnostic.reasons=['unknown-source'];},
 ];
 for(const change of changes){const f=fixture();change(f);const r=buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions);expect(r.status).toBe('blocked');expect(r.crossing).toBeNull();expect(r.reasons.length).toBeGreaterThan(0);}
 const f=fixture();f.diagnostic.status='not-applicable';f.diagnostic.crossing=null;expect(buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions).crossing).toBeNull();
});

it('fingerprints actual effective content independently of source sequence and keeps prior results immutable',()=>{
 const f=fixture();const before=structuredClone(f.executions);const old=buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions);const oldCopy=structuredClone(old);
 f.diagnostic.sourceSequence++;expect(buildCrossZeroMoneyDiagnostic(f.diagnostic,[...f.executions].reverse()).fingerprint).toBe(old.fingerprint);
 f.executions[1].fee='6';f.refresh();expect(buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions).fingerprint).not.toBe(old.fingerprint);
 expect(old).toEqual(oldCopy);expect(before[1].fee).toBe('3');
});

it('refuses unsupported decimal widths and negative fees without losing independent dimensions',()=>{
 const f=fixture('1','2','2','0.'+'0'.repeat(1021)+'1');f.diagnostic.crossing!.openShortQuantity='1';
 let r=buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions);
 expect(r.crossing?.amounts[1]).toMatchObject({status:'unknown',sourceValue:f.executions[1].fee,closeLongValue:null,openShortValue:null,reasons:['decimal-length-exceeded']});
 f.executions[1].price='9'.repeat(1024);f.refresh();r=buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions);
 expect(r.crossing?.amounts[0]).toMatchObject({status:'unknown',sourceValue:null,reasons:['decimal-length-exceeded']});
 f.executions[1].price='1'.repeat(1025);f.refresh();expect(buildCrossZeroMoneyDiagnostic(f.diagnostic,f.executions).crossing).toBeNull();
 const negative=fixture();negative.executions[1].fee='-1';negative.refresh();r=buildCrossZeroMoneyDiagnostic(negative.diagnostic,negative.executions);
 expect(r.status).toBe('blocked');expect(r.crossing?.amounts[0].status).toBe('conserved');expect(r.crossing?.amounts[1]).toMatchObject({status:'invalid',sourceValue:null,closeLongValue:null,openShortValue:null});
});
