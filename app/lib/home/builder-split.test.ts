import {it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildRelease} from './builder';
import {nativePosition} from './finance';
import {scopeId} from './contracts';
import {HomeStore} from './store';
import {initializeSqlite} from '../../../db/sqlite';
import type {SourceSnapshot} from './source';
import type {TradeExecution} from '../trades/types';
const stock={id:'US:SNDK',name:'Sandisk',symbol:'SNDK',market:'US',currency:'USD'};
const trades:TradeExecution[]=[
 ['b1','buy','10','419.70','2.03','2026-01-15T16:00:00Z'],
 ['s1','sell','10','493.83','2.03','2026-01-22T16:00:00Z'],
 ['b2','buy','2','1363','2','2026-08-12T18:14:39Z'],
 ['s2','sell','1','1789.63','2.03','2026-08-17T16:00:00Z'],
].map(([id,side,quantity,price,fee,executedAt],row)=>({id,side:side as 'buy'|'sell',quantity,price,fee,executedAt,instrument:stock,accountId:'tiger',accountLabel:'Tiger',source:{platform:'fixture',row,tradeNature:'live'}}));
function sample():SourceSnapshot{return {
 sequence:1,asOf:'2026-11-21T08:08:27.951Z',businessDate:'2026-11-21',executions:trades,monthly:[],instruments:[stock],
 candles:[['2026-11-19','755.16'],['2026-11-20','79.24']].map(([tradingDate,close])=>({instrumentId:stock.id,tradingDate,open:close,high:close,low:close,close,volume:'1',adjustmentMode:'raw',currency:'USD',provider:'yahoo',providerSymbol:'SNDK',fetchedAt:`${tradingDate}T22:00:00Z`})),
 currentFx:{USD:{rate:'6.67779632721202',source:'fixture',asOf:'2026-11-20'}},historicalFx:[],reviewFacts:{schemaVersion:1,legacy:[],recall:[]},classification:{live:4,simulation:0,unknown:0},
};}
it('reproduces the independent four-fill ledger across old/new quotes and isolated persistence/reopen',()=>{
 const input=sample(),original=JSON.stringify(input),release=buildRelease(input,'split-persist');
 const us=release.scopes.find(s=>s.id===scopeId('US','tiger'))!;
 expect(us.current.buckets.USD).toMatchObject({market:'633.92',unrealized:'-730.08',realized:'1160.84'});
 expect(us.holdings[0].row).toMatchObject({quantity:'8',cost:'170.5',price:'79.24',priceAsOf:'2026-11-20'});
 const old=us.days.find(d=>d.date==='2026-11-20')!;
 expect(old.buckets.USD).toMatchObject({market:'755.16',unrealized:'-608.84',realized:'1160.84'});
 expect(old.reasons.join()).toContain('2026-11-19 拆前收盘价');
 expect(us.days.find(d=>d.date==='2026-11-19')!.reasons.some(r=>r.startsWith('拆股推算：'))).toBe(false);
 const dir=mkdtempSync(join(tmpdir(),'tradereview-split-')),file=join(dir,'acceptance.sqlite');
 try {
  const db=new DatabaseSync(file);initializeSqlite(db);const store=new HomeStore(db);store.stage(release);store.publish(release.id,null);db.close();
  const reopened=new DatabaseSync(file);const reader=new HomeStore(reopened);
  const home=reader.readHome({market:'US',accountId:'tiger',period:{preset:'custom',from:'2026-01-01',to:'2026-11-21'},query:'',page:1,sort:'marketValue',direction:'desc'});
  expect(home.holdings.rows[0]).toMatchObject({quantity:'8',cost:'170.5',price:'79.24'});
  expect(home.holdings.rows[0].valuationNotes?.join()).toContain('拆股推算：SNDK');
  reopened.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
 expect(JSON.stringify(input)).toBe(original);
});
it('replaces provisional current inventory with differing real evidence then applies the next sale in those actual units',()=>{
 const input=sample();input.monthly=[{documentId:'real',templateIds:[],reviewRequired:false,events:[],positions:[{accountId:'tiger',market:'US',symbol:'SNDK',phase:'closing',date:'2026-11-20',quantity:'10',cost:'150',source:[{page:1,row:1}]}]}];
 const us=buildRelease(input,'real').scopes.find(s=>s.id===scopeId('US','tiger'))!;
 expect(us.holdings[0].row).toMatchObject({quantity:'10',cost:'150',price:'79.24'});
 expect(us.holdings[0].row.valuationNotes).toBeUndefined();
 expect(us.current.buckets.USD).toMatchObject({market:'792.4',unrealized:'-707.6',realized:'1160.84',realizedMissing:1});
 const sale={...trades[3],id:'after-real',quantity:'2',price:'160',fee:'1',executedAt:'2026-11-23T16:00:00Z'};
 const actual=nativePosition({executions:[...trades,sale],evidence:input.monthly,cursor:'2026-11-24T06:00:00Z',markPrice:'160'});
 expect(actual).toMatchObject({quantity:'8',knownRealized:'1179.84',unrealized:'80',openFees:'0.8',splitEstimates:[]});
});
it('normalizes the known old close for live intraday units and processes a new-unit premarket fill',()=>{
 const input=sample();input.asOf='2026-11-20T13:00:00Z';input.businessDate='2026-11-20';
 const premarket={...trades[3],id:'pre-market',quantity:'4',price:'200',fee:'1',executedAt:'2026-11-20T12:00:00Z'};
 input.executions=[...trades,premarket];
 const us=buildRelease(input,'intraday').scopes.find(s=>s.id===scopeId('US','tiger'))!;
 expect(us.holdings[0].row).toMatchObject({quantity:'4',cost:'170.5',price:'94.395',priceAsOf:'2026-11-19'});
 expect(us.current.buckets.USD).toMatchObject({market:'377.58',unrealized:'-304.42',realized:'1277.84'});
 expect(us.current.buckets.USD.realizedValuationNotes?.join()).toContain('拆股推算：SNDK');
 expect(us.holdings[0].row.valuationNotes?.join()).toContain('拆前收盘价');
});
