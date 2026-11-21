import {expect,it} from 'vitest';
import type {TradeExecution} from '../trades/types';
import type {PairingInspection,PairingRound} from './business-pairing-store';
import {executionContentVersion} from './execution-content-ref';
import {buildAccountingFeeDiagnostic} from './accounting-fee-diagnostic';
function execution(id:string,side:'buy'|'sell',quantity:string,fee:string,day:number):TradeExecution{return {id,side,quantity,fee,executedAt:`2026-01-${String(day).padStart(2,'0')}T15:00:00Z`,price:'3',accountId:'A',accountLabel:'A',instrument:{id:'US:X',symbol:'X',name:'X',currency:'USD',market:'US'},source:{platform:'fixture',row:day,tradeNature:'live'}};}
function inspection(executions:TradeExecution[],rounds:PairingRound[]):PairingInspection{
 const scope={accountId:'A',instrumentId:'US:X'},refs=executions.map(e=>({schemaVersion:1 as const,executionId:e.id,rawVersion:executionContentVersion(e,'raw'),effectiveVersion:executionContentVersion(e,'effective')}));
 return {scope,revision:1,fingerprint:'fingerprint',refs,status:'current',reasons:[],sourceSequence:9,fact:{schemaVersion:1,policy:'ordinary-live-long-lifo-v1',scope,revision:1,fingerprint:'fingerprint',refs,dependencies:{},rounds,confirmedBy:'test',basis:'test',recordedAt:'test',consumedSourceSequence:8,commitSequence:9}};
}
const round=(buy='buy',sell='sell',quantity='40'):PairingRound=>({id:'round',closingExecutionIds:[sell],pairings:[{openingExecutionId:buy,closingExecutionId:sell,quantity}]});
it('uses settlement HKD cash facts on USD securities without recomputing gross from price',()=>{
 const executions=[execution('buy','buy','100','1',2),execution('sell','sell','40','0.4',3)];
 executions[0].source.settlement={currency:'HKD',quantity:'100',grossAmount:'1000',netAmount:'-1001',fees:{commission:'1'}};
 executions[1].source.settlement={currency:'HKD',quantity:'40',grossAmount:'480',netAmount:'479.6',fees:{commission:'0.4'}};
 const before=structuredClone(executions),view=inspection(executions,[round()]),result=buildAccountingFeeDiagnostic(view,executions);
 expect(result).toMatchObject({status:'ready',sourceSequence:9,revision:1,fingerprint:'fingerprint',sourceRefs:view.refs,rounds:[{fees:[{currency:'HKD',value:'0.8'}],netPnl:null}],pool:{remaining:[{currency:'HKD',value:'0.6'}]}});
 expect(result.sourceMoney[0]).toMatchObject({contentRef:view.refs[0],currency:'HKD',gross:{status:'known',value:'1000'},signedCashNet:{status:'known',value:'-1001'}});expect(executions).toEqual(before);
});
it('keeps unknown fee and absent settlement distinct from a reported zero',()=>{
 const executions=[execution('buy','buy','100','0',2),execution('sell','sell','40','0',3)];executions[0].source.feeStatus='unknown';
 const result=buildAccountingFeeDiagnostic(inspection(executions,[round()]),executions);
 expect(result.sourceMoney[0]).toMatchObject({gross:{status:'unknown',value:null},signedCashNet:{status:'unknown',value:null},fee:{status:'unknown',value:'0'}});
 expect(result.sourceMoney[1].fee).toEqual({status:'known',value:'0'});expect(result.rounds[0].fees[0].value).toBeNull();
});
it('invalidates contradictory settlement without replacing raw amounts or confirmation quantity',()=>{
 const executions=[execution('buy','buy','100','1',2),execution('sell','sell','40','0.4',3)];
 executions[0].source.settlement={currency:'USD',quantity:'99',grossAmount:'1000',netAmount:'-1002',fees:{commission:'2'}};
 const view=inspection(executions,[round()]),before=structuredClone(view),result=buildAccountingFeeDiagnostic(view,executions);
 expect(result.status).toBe('invalid');expect(result.sourceMoney[0]).toMatchObject({gross:{status:'known',value:'1000'},fee:{status:'invalid',value:'1'},signedCashNet:{status:'invalid',value:'-1002'}});
 expect(result.reasons).toEqual(expect.arrayContaining(['settlement-quantity-mismatch','settlement-fee-mismatch','settlement-net-mismatch']));expect(result.rounds[0].fees[0].value).toBeNull();expect(view).toEqual(before);
});
it('validates long exact settlement sums beyond Decimal default precision and preserves missing net',()=>{
 const executions=[execution('buy','buy','100','1.000000000000000000000000000001',2),execution('sell','sell','40','0.4',3)];
 executions[0].source.settlement={currency:'USD',quantity:'100',grossAmount:'1000',netAmount:'-1001.000000000000000000000000000001',fees:{a:'1',b:'0.000000000000000000000000000001'}};
 let result=buildAccountingFeeDiagnostic(inspection(executions,[round()]),executions);expect(result.status).toBe('ready');
 Reflect.deleteProperty(executions[0].source.settlement,'netAmount');
 result=buildAccountingFeeDiagnostic(inspection(executions,[round()]),executions);expect(result.status).toBe('ready');expect(result.sourceMoney[0].signedCashNet).toEqual({status:'unknown',value:null});
});
it('does not certify noncurrent or mismatched source snapshots',()=>{
 const executions=[execution('buy','buy','100','1',2),execution('sell','sell','40','0.4',3)],view=inspection(executions,[round()]);
 for(const status of ['stale','unsupported','empty','snapshot-behind'] as const)expect(buildAccountingFeeDiagnostic({...view,status},executions)).toMatchObject({status:'blocked',sourceMoney:[],pool:null,rounds:[]});
 executions[0].fee='2';expect(buildAccountingFeeDiagnostic(view,executions)).toMatchObject({status:'invalid',reasons:['snapshot-content-ref-mismatch'],pool:null,rounds:[]});
});

it('rejects forged current snapshots with unproven atomic groups',()=>{
 const es=[execution('buy','buy','100','1',2),execution('sell','sell','40','0.4',3)];
 es[0].source.executionGroup={kind:'order',fillCount:1,quantity:'100',grossAmount:'300',fills:[{page:1,row:1,quantity:'100',price:'3',grossAmount:'300'}]};
 const v=inspection(es,[round()]);const result=buildAccountingFeeDiagnostic(v,es);
 expect(result.status).toBe('invalid');expect(result.reasons).toContain('aggregated-fill-time-unsupported');expect(result.reasons.length).toBeGreaterThan(1);
});
