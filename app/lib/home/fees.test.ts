import {describe,it,expect} from 'vitest';
import {collectFees, feeBoundary, feeWindowsAmount} from './fees';
import type {SourceSnapshot} from './source';
const base: Pick<SourceSnapshot,'executions'|'monthly'>={executions:[],monthly:[]};
const event=(id:string,date:string,amount:string)=>({id,date,amount,accountId:'a',market:'HK',symbol:'00001',currency:'HKD',kind:'fee' as const,description:'IPO申购费',source:[]});
describe('incurred fees independent of inventory allocation',()=>{
 it('counts statement IPO fees on their incurred date, deduplicates attached evidence and accepts refunds',()=>{
  const events=[event('fee','2026-01-08','-2'),event('refund','2026-01-12','1')];
  const fees=collectFees({...base,monthly:[{documentId:'s',templateIds:[],positions:[],events,reviewRequired:false},{documentId:'s2',templateIds:[],positions:[],events,reviewRequired:false}]});
  expect(feeBoundary(fees,'2026-01-09T15:59:59.999Z').HKD).toEqual({known:'2',missing:0});
  expect(feeBoundary(fees,'2026-01-12T15:59:59.999Z').HKD).toEqual({known:'1',missing:0});
 });
 it('preserves one unknown contribution per malformed fee, even when both display zero',()=>{
  const fees=collectFees({...base,monthly:[{documentId:'s',templateIds:[],positions:[],events:[event('x','2026-01-08','NaN'),event('y','2026-01-09','NaN')],reviewRequired:false}]});
  expect(feeBoundary(fees,'2026-01-08T15:59:59.999Z').HKD.missing).toBe(1);
  expect(feeBoundary(fees,'2026-01-09T15:59:59.999Z').HKD.missing).toBe(2);
 });
 it('only assigns a month-only fee to a period that contains that complete month',()=>{
  const fees=collectFees({...base,monthly:[{documentId:'s',templateIds:[],positions:[],events:[event('m','2026-01','-10')],reviewRequired:false}]});
  expect(feeWindowsAmount(fees,'2026-01-01','2026-01-31').HKD).toBe('10');
  expect(feeWindowsAmount(fees,'2026-01-15','2026-01-31').HKD).toBeNull();
  expect(feeWindowsAmount(fees,'2026-02-01','2026-02-28')).toEqual({});
 });
});
