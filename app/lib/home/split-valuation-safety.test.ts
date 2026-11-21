import {expect,it} from 'vitest';
import {nativePosition} from './finance';
import {splitQuoteUnitReason} from './split-valuation-safety';
import type {TradeExecution} from '../trades/types';
import type {MonthlyStatement,StatementPosition,StatementEvent} from '../import/monthly-statement';
const instrument={id:'US:SNDK',market:'US',symbol:'SNDK',currency:'USD',name:'Sandisk'};
const buy:TradeExecution={id:'b',accountId:'a',accountLabel:'A',instrument,side:'buy',quantity:'2',price:'1363',fee:'2',executedAt:'2026-08-12T18:14:39.000Z',source:{platform:'fixture',row:1,tradeNature:'live'}};
const sell:TradeExecution={...buy,id:'s',side:'sell',quantity:'1',price:'1789.63',fee:'2.03',executedAt:'2026-08-17T18:14:39.000Z'};
const run=(cursor='2026-11-21T06:00:00Z',executions=[buy,sell],evidence:MonthlyStatement[]=[])=>nativePosition({executions,evidence,cursor,markPrice:'79.24'});
const statement=(quantity:string,cost:string):MonthlyStatement=>({documentId:'actual',templateIds:[],reviewRequired:false,events:[],positions:[{accountId:'a',market:'US',symbol:'SNDK',phase:'closing',date:'2026-11-20',quantity,cost,source:[{page:1,row:1}]}]});
it('scales inventory at the exact boundary, preserving realized and remaining fee cost',()=>{
 expect(run('2026-11-19T21:00:59.999Z')).toMatchObject({quantity:'1',averageCost:'1363',openFees:'1',knownRealized:'423.6',splitEstimates:[]});
 expect(run('2026-11-19T21:01:00.000Z')).toMatchObject({quantity:'8',averageCost:'170.375',openFees:'1',knownRealized:'423.6',unrealized:'-730.08'});
 expect(run().splitEstimates?.join()).toContain('拆股推算：SNDK');
 expect(splitQuoteUnitReason(instrument.id,'2026-11-20T16:00:00Z','2026-11-19')).toContain('单位不一致');
 expect(splitQuoteUnitReason(instrument.id,'2026-11-21T06:00:00Z','2026-11-20')).toBeNull();
});
it('executes a later sale in new units; a flat reopened lot is not estimated',()=>{
 const after={...sell,id:'after',quantity:'4',price:'200',fee:'1',executedAt:'2026-11-20T15:00:00Z'};
 expect(run(undefined,[buy,sell,after])).toMatchObject({quantity:'4',openFees:'0.5',knownRealized:'540.6',unrealized:'-365.04'});
 expect(run(undefined,[buy,sell,after]).realizedValuationNotes).toHaveLength(1);
 const closed={...after,quantity:'8'};
 const flat=run(undefined,[buy,sell,closed]);expect(flat.quantity).toBe('0');expect(flat.splitEstimates).toEqual([]);expect(flat.realizedValuationNotes).toHaveLength(1);
 const before={...sell,quantity:'2'};
 expect(run(undefined,[buy,before,{...buy,id:'new',quantity:'2',executedAt:'2026-11-20T15:00:00Z'}]).splitEstimates).toEqual([]);
});
it('actual account quantity and inclusive cost replace projection without duplicating fees or inventing realized gains',()=>{
 const equal=run(undefined,[buy,sell],[statement('8','170.5')]);
 expect(equal).toMatchObject({quantity:'8',averageCost:'170.375',openFees:'1',knownRealized:'423.6',splitEstimates:[],realizedMissing:0,unrealized:'-730.08'});
 const differing=run(undefined,[buy,sell],[statement('10','150')]);
 expect(differing).toMatchObject({quantity:'10',averageCost:'149.9',openFees:'1',knownRealized:'423.6',splitEstimates:[],realizedMissing:1,unrealized:'-707.6'});
 const next={...sell,id:'later',quantity:'2',price:'160',fee:'1',executedAt:'2026-11-23T16:00:00Z'};
 expect(run('2026-11-24T06:00:00Z',[buy,sell,next],[statement('10','150')])).toMatchObject({quantity:'8',knownRealized:'442.6',openFees:'0.8'});
});
it('handles statement-only inventory and deduplicates a dated real broker split',()=>{
 const opening=statement('1','1364');opening.positions[0].date='2026-10-31';
 const only=nativePosition({executions:[],evidence:[opening],inventoryIdentity:{accountId:'a',symbol:'SNDK',market:'US',currency:'USD'},markPrice:'79.24',cursor:'2026-11-21T06:00:00Z'});
 expect(only).toMatchObject({quantity:'8',averageCost:'170.5',unrealized:'-730.08'});
 const event={id:'split',accountId:'a',market:'US',symbol:'SNDK',date:'2026-11-20',kind:'corporate-action' as const,quantity:'7',description:'Stock split 8-for-1',source:[]};
 const broker={...statement('8','170.5'),positions:[] as StatementPosition[],events:[event,event]};
 expect(run(undefined,[buy,sell],[broker])).toMatchObject({quantity:'8',averageCost:'170.375',knownRealized:'423.6',splitEstimates:[]});
 const unrelated=run(undefined,[{...buy,instrument:{...instrument,id:'US:OTHER',symbol:'OTHER'}}]);expect(unrelated.quantity).toBe('2');expect(unrelated.splitEstimates).toEqual([]);
});

it('does not mistake a dated pre-split closing statement learned after legal effect for split confirmation',()=>{
 const old=statement('1','1364');old.positions[0].date='2026-11-19';
 const actual=run(undefined,[buy,sell],[old]);
 expect(actual).toMatchObject({quantity:'8',averageCost:'170.375',openFees:'1',knownRealized:'423.6',realizedMissing:0,unrealized:'-730.08'});
 expect(actual.splitEstimates?.join()).toContain('拆股推算：SNDK');
});

it('preserves signed short inventory basis and takes over inclusive broker short cost',()=>{
 const short={...buy,side:'sell' as const,price:'100',quantity:'2',fee:'2',source:{...buy.source,positionEffect:'open-short' as const}};
 const actual=nativePosition({executions:[short],cursor:'2026-11-21T06:00:00Z',markPrice:'10'});
 expect(actual).toMatchObject({quantity:'-16',averageCost:'12.5',openFees:'2',unrealized:'38',splitCostBasis:true});
 const proof=nativePosition({executions:[short],evidence:[statement('-16','12.375')],cursor:'2026-11-21T06:00:00Z',markPrice:'10'});
 expect(proof).toMatchObject({quantity:'-16',averageCost:'12.5',openFees:'2',unrealized:'38',splitEstimates:[]});
});

it('confirms only exact corporate-action ratios and matching credited deltas',()=>{
 const event={id:'split',accountId:'a',market:'US',symbol:'SNDK',date:'2026-11-20',kind:'corporate-action' as const,quantity:'7',description:'Stock split 8-for-1',source:[]};
 const check=(overrides:Partial<StatementEvent>)=>run(undefined,[buy,sell],[{...statement('8','170.5'),positions:[],events:[{...event,...overrides}]}]);
 for(const description of ['Stock split 1:80','Stock split 18-for-1','Stock split 8-for-10','Stock split 8-for-1 / 1:80']){
  const actual=check({description});expect(actual.splitEstimates).toHaveLength(1);expect(actual.reasons).toContain('position-event');
 }
 for(const description of ['Stock split 8-for-1','拆股 1拆8','拆股 1:8'])expect(check({description}).splitEstimates).toEqual([]);
 expect(check({kind:'other'}).splitEstimates).toHaveLength(1);
 expect(check({kind:'fee'}).splitEstimates).toHaveLength(1);
 expect(check({accountId:'other'}).splitEstimates).toHaveLength(1);
 expect(check({symbol:'OTHER'}).splitEstimates).toHaveLength(1);
 for(const quantity of ['8','70','-7','bad'])expect(check({quantity}).reasons).toContain('position-event');
 const after={...sell,id:'after',quantity:'4',price:'200',fee:'1',executedAt:'2026-11-20T15:00:00Z'};
 const broker={...statement('8','170.5'),positions:[],events:[event]};
 expect(run(undefined,[buy,sell,after],[broker])).toMatchObject({quantity:'4',splitEstimates:[]});
});
