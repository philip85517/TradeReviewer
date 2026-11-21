import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {describe,it,expect} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {buildRelease} from './builder';
import {HomeStore} from './store';
import {ProjectionCache} from './projection-cache';
import type {SourceSnapshot} from './source';
import type {TradeExecution} from '../trades/types';
import type {HomeRequest} from '../../components/homepage-preview/display-contract';

const request:HomeRequest={market:'all',accountId:'all',period:{preset:'custom',from:'2026-01-05',to:'2026-01-07'},query:'',page:1,sort:'name',direction:'asc'};
function source():SourceSnapshot {
 const instruments=['A','B','C','D'].map(symbol=>({id:`HK:${symbol}`,symbol,name:symbol,market:'HK',currency:'HKD'}));
 const fill=(id:string,index:number,day:string,side:'buy'|'sell',quantity:string,price:string,fee='0'):TradeExecution=>({id,accountId:'a',accountLabel:'A',instrument:instruments[index],executedAt:`2026-01-${day}T02:00:00Z`,side,quantity,price,fee,source:{platform:'futu',row:1,tradeNature:'live'}});
 return {sequence:1,asOf:'2026-01-07T15:59:59.999Z',businessDate:'2026-01-07',instruments,executions:[fill('a-buy',0,'05','buy','2','100','4'),fill('a-sell',0,'06','sell','1','120','1'),fill('b-orphan',1,'05','sell','1','10'),fill('c-buy',2,'05','buy','1','50'),fill('c-close',2,'06','sell','1','60'),fill('d-bad-cost',3,'05','buy','1','NaN')],monthly:[],candles:instruments.flatMap(i=>['05','06','07'].map(d=>({instrumentId:i.id,tradingDate:`2026-01-${d}`,open:'110',high:'110',low:'110',close:'110',volume:'1',adjustmentMode:'raw' as const,currency:'HKD',provider:'yahoo',providerSymbol:i.symbol,fetchedAt:`2026-01-${d}T12:00:00Z`}))),currentFx:{HKD:{rate:'0.8',source:'fixture',asOf:'2026-01-07'}},historicalFx:[],reviewFacts:{schemaVersion:1,legacy:[],recall:[]},classification:{live:6,simulation:0,unknown:0}};
}

describe('object-based confirmed subtotals',()=>{
 it('serves every shortcut on a cold connection while custom boundaries retain indexed calculation',()=>{
  const dir=mkdtempSync(join(tmpdir(),'home-shortcuts-')),path=join(dir,'read.sqlite');
  const db=new DatabaseSync(path);initializeSqlite(db);
  try{
   const store=new HomeStore(db),input=source();input.businessDate='2026-02-07';input.asOf='2026-02-07T15:59:59.999Z';
   store.stage(buildRelease(input,'shortcuts'));store.publish('shortcuts',null);
   const periods:HomeRequest['period'][]=[{preset:'ytd',from:'2026-01-01',to:'2026-02-07'},{preset:'month',from:'2026-02-01',to:'2026-02-07'},{preset:'week',from:'2026-02-02',to:'2026-02-07'}];
   const expected=periods.map(period=>store.readHome({...request,period}));
   const reader=new DatabaseSync(path);
   try{
    const prepare=reader.prepare.bind(reader);reader.prepare=(sql:string)=>{if(sql.includes('FROM home_metric_member m'))throw new Error('shortcut read performed object seeks');return prepare(sql);};
    const cold=new HomeStore(reader);
    for(const [i,period]of periods.entries())expect(cold.readHome({...request,period})).toEqual(expected[i]);
    expect(()=>cold.readHome({...request,period:{preset:'custom',from:'2026-02-03',to:'2026-02-07'}})).toThrow('shortcut read performed object seeks');
   }finally{reader.close();}
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
 });
 it('persists default market subtotals across connection restart with release-specific FX',()=>{
  const dir=mkdtempSync(join(tmpdir(),'home-prepared-')),path=join(dir,'read.sqlite');
  const db=new DatabaseSync(path);initializeSqlite(db);
  try{
   const store=new HomeStore(db),input=source();
   store.stage(buildRelease(input,'first'));store.publish('first',null);
   input.currentFx.HKD={rate:'1',source:'new source',asOf:'2026-01-08'};input.sequence++;
   store.stage(store.reuseUnchanged(buildRelease(input,'second')));
   const defaultRequest={...request,period:{preset:'ytd' as const,from:'2026-01-01',to:'2026-01-07'}};
   const expectedFirst=store.readHome(defaultRequest,'first');
   store.publish('second','first');const expectedSecond=store.readHome(defaultRequest,'second');
   const reader=new DatabaseSync(path);
   try{
    const prepare=reader.prepare.bind(reader);
    reader.prepare=(sql:string)=>{if(sql.includes('FROM home_metric_member m'))throw new Error('cold request recalculated object subtotals');return prepare(sql);};
    const cold=new HomeStore(reader);
    expect(cold.readHome(defaultRequest,'first')).toEqual(expectedFirst);
    expect(cold.readHome(defaultRequest,'second')).toEqual(expectedSecond);
    expect(cold.readHome(defaultRequest).metrics.currentMarketValue.partial?.value).toBe('220');
    expect(cold.readHome(defaultRequest,'first').metrics.currentMarketValue.partial?.value).toBe('176');
    expect(()=>cold.readHome({...defaultRequest,period:{preset:'custom',from:'2026-01-06',to:'2026-01-07'}})).toThrow('cold request recalculated');
   }finally{reader.close();}
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
 });
 it('rejects missing or wrong-scope object membership before publishing',()=>{
  const db=new DatabaseSync(':memory:');initializeSqlite(db);
  try{
   const store=new HomeStore(db),missing=buildRelease(source(),'missing');
   missing.scopes.find(s=>s.market==='all'&&s.accountId==='all')!.metricObjects=[];
   expect(()=>store.stage(missing)).toThrow('metric scope membership');expect(store.head()).toBeNull();
   const misplaced=buildRelease(source(),'misplaced'),all=misplaced.scopes.find(s=>s.market==='all'&&s.accountId==='all')!;
   misplaced.scopes.find(s=>s.market==='CN'&&s.accountId==='all')!.metricObjects=[all.metricObjects![0]];
   expect(()=>store.stage(misplaced)).toThrow('metric scope membership');expect(store.head()).toBeNull();
  }finally{db.close();}
 });
 it('collects expired object versions while retained publications remain readable',()=>{
  const db=new DatabaseSync(':memory:');initializeSqlite(db);
  try{
   const store=new HomeStore(db);
   for(let i=0;i<4;i++){
    const input=source();input.sequence=i+1;input.executions[0].price=String(100+i);
    const release=store.reuseUnchanged(buildRelease(input,`r${i}`));store.stage(release);store.publish(release.id,i?`r${i-1}`:null);
    db.prepare('UPDATE home_publication SET published_at=? WHERE release_id=?').run(i+1,release.id);
   }
   store.collect(Date.now());
   expect(db.prepare('SELECT count(*) n FROM home_publication').get()!.n).toBe(2);
   expect(db.prepare('SELECT count(*) n FROM home_metric_object o WHERE NOT EXISTS(SELECT 1 FROM home_metric_member m WHERE m.object_version=o.object_version)').get()!.n).toBe(0);
   expect(store.readHome(request,'r2').metrics.net.partial).toBeDefined();expect(store.readHome(request,'r3').metrics.net.partial).toBeDefined();
   expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  }finally{db.close();}
 });
 it('keeps unknown totals, includes closed objects in the period, and counts each metric independently',()=>{
  const db=new DatabaseSync(':memory:');initializeSqlite(db);
  try {
   const store=new HomeStore(db),input=buildRelease(source(),'one');store.stage(input);store.publish(input.id,null);
   const home=store.readHome(request);
   expect(home.metrics.currentMarketValue.value).toBeNull();
   expect(home.metrics.currentMarketValue.partial).toMatchObject({value:'176',originals:{HKD:'220'},coverage:{available:2,total:3,unit:'account-security',scope:'imported'}});
   expect(home.currentUnrealized.partial).toMatchObject({value:'6.4',coverage:{available:1,total:3}});
   expect(home.metrics.periodRealized.partial).toMatchObject({value:'21.6',coverage:{available:3,total:4}});
   expect(home.metrics.unrealizedChange.partial).toMatchObject({value:'6.4',coverage:{available:2,total:4}});
   // Only A and C have both components; never add independent R/U subtotals.
   expect(home.metrics.net.partial).toMatchObject({value:'28',originals:{HKD:'35'},coverage:{available:2,total:4}});
   expect(home.holdings.total).toBe(3);expect(home.holdings.sortAvailable).toBe(false);
   expect(home.series.points.at(-1)?.periodNet.value).toBeNull();
   expect(store.readPeriod(request,'one').period.net.partial).toEqual(home.metrics.net.partial);
   expect(store.readHoldings({...request,query:'D'},'one').holdings.marketValue.partial).toEqual(home.metrics.currentMarketValue.partial);
  }finally{db.close();}
 });
 it('freezes old FX, reuses native object versions, and does not expose a staged partial',()=>{
  const db=new DatabaseSync(':memory:');initializeSqlite(db);
  try {
   const store=new HomeStore(db),input=source(),options={cache:new ProjectionCache(db),reusePublished:true};
   const first=store.reuseUnchanged(buildRelease(input,'first',options));store.stage(first);store.publish('first',null);
   input.currentFx.HKD={rate:'1',source:'new fixture',asOf:'2026-01-08'};input.sequence++;
   const next=store.reuseUnchanged(buildRelease(input,'next',options));expect(next.scopes).toHaveLength(0);
   store.stage(next);expect(store.readHome(request).metrics.net.partial?.value).toBe('28');
   store.publish('next','first');expect(store.readHome(request).metrics.net.partial?.value).toBe('35');
   expect(store.readHome(request,'first').metrics.currentMarketValue.partial?.value).toBe('176');
  }finally{db.close();}
 });
 it('does not turn zero known objects or uncovered endpoints into a zero subtotal',()=>{
  const db=new DatabaseSync(':memory:');initializeSqlite(db);
  try{
   const input=source();input.executions=input.executions.filter(e=>e.id==='b-orphan');input.instruments=[input.instruments[1]];
   const store=new HomeStore(db),release=buildRelease(input,'unknown');store.stage(release);store.publish('unknown',null);
   const home=store.readHome(request);expect(home.metrics.currentMarketValue.partial).toMatchObject({value:null,coverage:{available:0,total:1}});
   const early=store.readHome({...request,period:{preset:'custom',from:'2025-12-01',to:'2026-01-07'}});
   expect(early.metrics.net.partial).toMatchObject({value:null,coverage:{available:0,total:1}});
  }finally{db.close();}
 });
});
