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
import {buildAccountingPnlDiagnostic} from './accounting-pnl-diagnostic';
it('uses the native moving average gross and exact allocated fees',()=>{
 const es=[execution('buy','buy','100','1',2),execution('sell','sell','40','0.4',3)];es[0].price='10';es[1].price='12';
 const view=inspection(es,[round()]);const result=buildAccountingPnlDiagnostic(view,es,buildAccountingFeeDiagnostic(view,es));
 expect(result.rounds[0]).toMatchObject({gross:{value:'80'},net:{value:'79.2'}});
});
it('keeps gross independent of unknown fees and refuses a recurring average until proven flat',()=>{
 const es=[execution('b','buy','100','1',2),execution('b2','buy','50','2',3),execution('s','sell','80','0.8',4),execution('s2','sell','70','0.7',5),execution('b3','buy','10','0',6),execution('s3','sell','10','0',7)];
 es.forEach(e=>{e.price='20';});es[0].price='10';es[5].price='21';
 const view=inspection(es,[{id:'round',closingExecutionIds:['s'],pairings:[{openingExecutionId:'b2',closingExecutionId:'s',quantity:'50'},{openingExecutionId:'b',closingExecutionId:'s',quantity:'30'}]}]);let result=buildAccountingPnlDiagnostic(view,es,buildAccountingFeeDiagnostic(view,es));
 expect(result.reasons).toEqual([]);expect(result.closes.map(c=>c.gross.value)).toEqual([null,null,'10']);expect(result.rounds[0].fees[0].value).toBe('2.4');
 const simple=[execution('buy','buy','100','1',2),execution('sell','sell','40','0.4',3)];simple[0].price='10';simple[1].price='12';simple[0].source.feeStatus='unknown';
 const v=inspection(simple,[round()]);result=buildAccountingPnlDiagnostic(v,simple,buildAccountingFeeDiagnostic(v,simple));expect(result.rounds[0].gross.value).toBe('80');expect(result.rounds[0].net.value).toBeNull();
});
it('uses weighted accounting cost rather than review LIFO and preserves signed zero',()=>{
 const es=[execution('b','buy','100','1',2),execution('b2','buy','100','2',3),execution('s','sell','50','0.5',4)];es[0].price='10';es[1].price='20';es[2].price='18';
 const v=inspection(es,[round('b2','s','50')]);let result=buildAccountingPnlDiagnostic(v,es,buildAccountingFeeDiagnostic(v,es));expect(result.rounds[0]).toMatchObject({gross:{value:'150'},net:{value:'148.75'}});
 es[2].price='15';const z=inspection(es,[round('b2','s','50')]);result=buildAccountingPnlDiagnostic(z,es,buildAccountingFeeDiagnostic(z,es));expect(result.rounds[0].gross.value).toBe('0');
 es[2].price='14';const l=inspection(es,[round('b2','s','50')]);expect(buildAccountingPnlDiagnostic(l,es,buildAccountingFeeDiagnostic(l,es)).rounds[0].gross.value).toBe('-50');
});
it('binds snapshot versions, rejects bad settlement and precise times without losing fee evidence',()=>{
 const es=[execution('buy','buy','100','1',2),execution('sell','sell','40','0.4',3)];es[0].price='10';es[1].price='12';
 let v=inspection(es,[round()]),f=buildAccountingFeeDiagnostic(v,es);
 expect(buildAccountingPnlDiagnostic({...v,status:'stale'},es,f).status).toBe('blocked');
 expect(buildAccountingPnlDiagnostic(v,es,{...f,revision:2}).status).toBe('invalid');
 es[0].source.settlement={currency:'USD',quantity:'99',grossAmount:'1000',netAmount:'-1001',fees:{commission:'1'}};
 v=inspection(es,[round()]);f=buildAccountingFeeDiagnostic(v,es);expect(buildAccountingPnlDiagnostic(v,es,f).rounds[0].gross.value).toBeNull();
 delete es[0].source.settlement;es[0].executedAt='2026-01-02T15:00:00.0001Z';v=inspection(es,[round()]);f=buildAccountingFeeDiagnostic(v,es);
 const result=buildAccountingPnlDiagnostic(v,es,f);expect(result.rounds[0].gross.value).toBeNull();expect(result.rounds[0].fees).toEqual(f.rounds[0].fees);
});

it('rejects forged current snapshots with unproven atomic groups',()=>{
 const es=[execution('buy','buy','100','1',2),execution('sell','sell','40','0.4',3)];
 es[0].source.executionGroup={kind:'order',fillCount:1,quantity:'100',grossAmount:'300',fills:[{page:1,row:1,quantity:'100',price:'3',grossAmount:'300'}]};
 const v=inspection(es,[round()]);const result=buildAccountingPnlDiagnostic(v,es,buildAccountingFeeDiagnostic(v,es));
 expect(result.status).toBe('invalid');expect(result.reasons).toContain('aggregated-fill-time-unsupported');expect(result.reasons.length).toBeGreaterThan(1);
});
