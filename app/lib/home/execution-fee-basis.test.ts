import {it,expect} from 'vitest';
import {overlayHomeExecutionFee,homeExecutionFeeBasis} from './execution-fee-basis';
import type {TradeExecution} from '../trades/types';
const execution=(symbol='513010',market='CN-SH',status:'unknown'|'reported'='unknown'):TradeExecution=>({id:'e',accountId:'a',accountLabel:'A',instrument:{id:`${market}:${symbol}`,symbol,market,currency:'CNY',name:'test'},side:'buy',executedAt:'2026-01-01T00:00:00Z',quantity:'100',price:'10',fee:'0',source:{platform:'test',row:1,tradeNature:'live',feeStatus:status}});
it('estimates explicit missing zero placeholders without mutating original; reported zero wins',()=>{
 const original=execution();const projected=overlayHomeExecutionFee(original);
 expect(projected.fee).toBe('5');expect(projected.source.homeFeeBasis).toMatchObject({originalFee:'0',originalFeeStatus:'unknown',currency:'CNY'});
 expect(original.source.feeStatus).toBe('unknown');expect(original.fee).toBe('0');
 expect(overlayHomeExecutionFee(projected)).toBe(projected);
 expect(overlayHomeExecutionFee(execution('513010','CN-SH','reported')).fee).toBe('0');
});
it('does not invent other market, bond or simulation charges',()=>{
 expect(overlayHomeExecutionFee(execution('00001','HK')).fee).toBe('0');
 expect(overlayHomeExecutionFee(execution('113001')).fee).toBe('0');
 const simulated=execution();simulated.source.tradeNature='simulation';expect(overlayHomeExecutionFee(simulated).fee).toBe('0');
});
it('matches independently calculated reference totals',()=>{
 const fee=Number(overlayHomeExecutionFee(execution()).fee);
 expect(56.8-28*fee-13.95).toBeCloseTo(-97.15,8);
 expect(1020-2*Number(overlayHomeExecutionFee(execution('000858','CN-SZ')).fee)).toBe(1010);
});
import {nativePosition} from './finance';
import {collectFees,feeBoundary} from './fees';
it('feeds actual native position and incurred expense paths for Wuliangye',()=>{
 const buy=execution('000858','CN-SZ');buy.price='100';
 const sell={...execution('000858','CN-SZ'),id:'s',side:'sell' as const,price:'110.2',executedAt:'2026-01-02T00:00:00Z'};
 const projected=[buy,sell].map(e=>overlayHomeExecutionFee(e));
 expect(nativePosition({executions:projected,markPrice:'110.2',cursor:'2026-01-03T00:00:00Z'})).toMatchObject({quantity:'0',realized:'1010'});
 expect(feeBoundary(collectFees({executions:projected,monthly:[]}),'2026-01-03T00:00:00Z').CNY).toEqual({known:'10',missing:0});
});
it('uses explicit asset classification before conservative prefix inference',()=>{
 expect(overlayHomeExecutionFee(execution('513010'),'bond').fee).toBe('0');
 expect(overlayHomeExecutionFee(execution('999999'),'stock').fee).toBe('5');
 for(const [symbol,market] of [['500001','CN-SH'],['160001','CN-SZ'],['010001','CN-SZ'],['900001','CN-SH']])expect(overlayHomeExecutionFee(execution(symbol,market)).fee).toBe('0');
 expect(overlayHomeExecutionFee(execution('999999')).fee).toBe('0');
});
it('never relabels the CNY default as foreign settlement fees',()=>{
 for(const currency of ['USD','EUR']){
 const e=execution();e.source.settlement={currency,quantity:'100',grossAmount:'1000',netAmount:'-1000',fees:{commission:'0'}};
 expect(overlayHomeExecutionFee(e)).toBe(e);
 }
});

it('does not re-estimate a projection rejected by explicit classification',()=>{
 const rejected=overlayHomeExecutionFee(execution(),'bond');
 expect(homeExecutionFeeBasis(rejected).amount).toBeNull();
 expect(feeBoundary(collectFees({executions:[rejected],monthly:[]}),'2026-01-03T00:00:00Z').CNY).toEqual({known:'0',missing:1});
});
