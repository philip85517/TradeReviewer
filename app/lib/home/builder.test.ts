import { describe, expect, it, vi } from 'vitest';
import { buildRelease } from './builder';
import type { SourceSnapshot } from './source';
import { scopeId } from './contracts';
import { projectPeriod } from './period';
import {DatabaseSync} from 'node:sqlite';
import {HOME_SCHEMA} from '../../../db/home-schema';
import {ProjectionCache} from './projection-cache';
import {HomeStore} from './store';
import {initializeSqlite} from '../../../db/sqlite';
import {applyMonthlyHistoryEvidence} from '../import/statement-evidence';
const instrument = { id: 'HK:00001', name: '证券', symbol: '00001', market: 'HK', currency: 'HKD' };
const source = (): SourceSnapshot => ({ sequence: 1, asOf: '2026-01-07T15:59:59.999Z', businessDate: '2026-01-07', executions: [
  { id: 'b', accountId: 'a', accountLabel: 'A', instrument, executedAt: '2026-01-05T02:00:00Z', side: 'buy', quantity: '2', price: '100', fee: '4', source: { platform: 'futu', row: 1, tradeNature: 'live' } },
  { id: 's', accountId: 'a', accountLabel: 'A', instrument, executedAt: '2026-01-06T02:00:00Z', side: 'sell', quantity: '1', price: '120', fee: '1', source: { platform: 'futu', row: 2, tradeNature: 'live' } },
], monthly: [], instruments: [instrument], candles: ['05','06','07'].map(d=>({ instrumentId: instrument.id, tradingDate: `2026-01-${d}`, open:'110', high:'110',low:'110',close:'110',volume:'1', adjustmentMode:'raw', currency:'HKD', provider:'yahoo', providerSymbol:'1', fetchedAt:`2026-01-${d}T12:00:00Z` })), currentFx: {}, historicalFx: [], classification:{live:2,simulation:0,unknown:0} });
describe('fact to release construction', () => {
 it('publishes FX independently without rewriting native daily results and freezes old FX',()=>{
  const db=new DatabaseSync(':memory:');initializeSqlite(db);const store=new HomeStore(db),input=source();
  input.currentFx={HKD:{rate:'0.9',source:'fixture',asOf:'2026-01-07'}};
  const options={cache:new ProjectionCache(db),reusePublished:true};
  const first=store.reuseUnchanged(buildRelease(input,'fx-first',options));store.stage(first);store.publish(first.id,null);
  const request={market:'all' as const,accountId:'all',period:{preset:'custom' as const,from:'2026-01-05',to:'2026-01-07'},query:'',page:1,sort:'marketValue' as const,direction:'desc' as const};
  const old=store.readHome(request),count=db.prepare('SELECT count(*) n FROM home_daily').get()!.n;
  input.currentFx.HKD={rate:'1',source:'fixture',asOf:'2026-01-08'};input.sequence++;
  const next=store.reuseUnchanged(buildRelease(input,'fx-next',options));
  expect(next.scopes).toHaveLength(0);expect(next.reuse).toHaveLength(8);
  store.stage(next);store.publish(next.id,first.id);
  const fresh=store.readHome(request),id=fresh.holdings.rows[0].id;
  expect(db.prepare('SELECT count(*) n FROM home_daily').get()!.n).toBe(count);
  expect(old.metrics.currentMarketValue.value).toBe('99');expect(fresh.metrics.currentMarketValue.value).toBe('110');
  expect(fresh.holdings.rows[0].marketValue.value).toBe('110');expect(fresh.metrics.net.value).toBe('25');
  expect(fresh.fxDate).toBe('2026-01-08');
  expect(store.readHolding(old.stamp,id).holding.marketValue.value).toBe('99');
  expect(store.readHolding(fresh.stamp,id).holding.marketValue.value).toBe('110');
  expect(store.exportHoldings(request,first.id)).toContain('"99"');expect(store.exportHoldings(request,next.id)).toContain('"110"');
  db.close();
 });
 it('includes gap-only monthly evidence before a later flat inventory restores a new lot',()=>{
  const input=source();input.businessDate='2026-03-23';input.asOf='2026-03-23T15:59:59.999Z';
  input.monthly=[{documentId:'jan-gap',month:'2026-01',accountId:'a',historyIncomplete:true,templateIds:[],reviewRequired:true,positions:[],events:[]},{documentId:'feb-flat',month:'2026-02',accountId:'a',templateIds:[],reviewRequired:false,events:[],positions:[{accountId:'a',market:'HK',symbol:'00001',phase:'closing',date:'2026-02-28',quantity:'0',source:[]}]}];
  input.executions=applyMonthlyHistoryEvidence([{...input.executions[0],executedAt:'2026-03-03T02:00:00Z',price:'20',fee:'2'}],input.monthly);
  const hk=buildRelease(input,'r').scopes.find(s=>s.id===scopeId('HK','a'))!;
  expect(hk.holdings[0].row).toMatchObject({quantity:'2',cost:'20'});
  expect(hk.current.buckets.HKD.lifetimeComplete).toBe(false);
 });
 it('revalues historical native results in CNY using current FX without replaying positions',()=>{
  const db=new DatabaseSync(':memory:');initializeSqlite(db);
  try{
   const input=source();input.currentFx={HKD:{rate:'0.8',source:'current',asOf:'2026-01-07'}};
   input.historicalFx=[{date:'2026-01-06',knownAt:'2026-01-06T02:00:00Z',rates:{HKD:{rate:'0.5',source:'old',asOf:'2026-01-06'}}}];
   const cache=new ProjectionCache(db),store=new HomeStore(db);
   const first=buildRelease(input,'first',{cache});store.stage(first);store.publish('first',null);
   const request={market:'HK' as const,accountId:'a',period:{preset:'custom' as const,from:'2026-01-06',to:'2026-01-06'},query:'',sort:'name' as const,direction:'asc' as const,page:1};
   expect(store.readHome(request).metrics.periodRealized).toMatchObject({value:'13.6',currency:'CNY',originals:{HKD:'17'}});
   input.currentFx.HKD.rate='0.9';input.sequence++;const stats={built:0,reused:0};
   const second=buildRelease(input,'second',{cache,stats});store.stage(second);store.publish('second','first');
   expect(stats).toEqual({built:0,reused:1});
   expect(store.readHome(request).metrics.periodRealized.value).toBe('15.3');
   expect(store.readHome(request,'first').metrics.periodRealized.value).toBe('13.6');
   expect(first.scopes[0].days.every(day=>Object.keys(day.fx).length===0)).toBe(true);
  }finally{db.close();}
 });
 it('never publishes profit from a malformed opening price',()=>{
  const input=source();input.executions[0].price='NaN';
  const hk=buildRelease(input,'r').scopes.find(s=>s.id===scopeId('HK','a'))!;
  const baseline=hk.days.find(d=>d.date==='2026-01-05')!,end=hk.days.find(d=>d.date==='2026-01-06')!;
  expect(projectPeriod(baseline,[end],{from:end.date,to:end.date},'HKD',input.businessDate).realized.value).toBeNull();
 });
 it('does not cancel resolved and new missing contributions on the same day',()=>{
  const input=source();input.businessDate='2026-01-22';input.asOf='2026-01-22T15:59:59.999Z';
  const common={accountId:'a',market:'HK',symbol:'00001',currency:'HKD',source:[]};
  const fill=(id:string,day:string,price:string)=>({...input.executions[1],id,quantity:'1',price,executedAt:`${day}T02:00:00Z`});
  input.executions=[fill('old1','2026-01-15','120'),fill('old2','2026-01-16','130'),fill('new1','2026-01-20','120'),fill('new2','2026-01-20','120')];
  input.monthly=[{documentId:'ipo',templateIds:[],reviewRequired:false,positions:[],events:[
   {...common,id:'app',date:'2026-01-08',kind:'ipo',amount:'-220',description:'IPO application'},
   {...common,id:'fee',date:'2026-01-08',kind:'fee',amount:'-2',description:'IPO fee'},
   {...common,id:'allot',date:'2026-01-10',kind:'ipo',quantity:'2',description:'IPO allotment',displayTimePolicy:'session-open'},
   {...common,id:'refund',date:'2026-01-20',kind:'ipo',amount:'20',description:'IPO refund'},
  ]}];
  const hk=buildRelease(input,'r').scopes.find(s=>s.id===scopeId('HK','a'))!;
  const before=hk.days.find(d=>d.date==='2026-01-19')!,after=hk.days.find(d=>d.date==='2026-01-20')!;
  expect(projectPeriod(before,[after],{from:after.date,to:after.date},'HKD',input.businessDate).realized.value).toBeNull();
 });

 it('keeps missing prefixes monotonic when late IPO evidence makes an earlier cost knowable',()=>{
  const input=source();input.businessDate='2026-01-22';input.asOf='2026-01-22T15:59:59.999Z';
  const common={accountId:'a',market:'HK',symbol:'00001',currency:'HKD',source:[]};
  input.executions=[{...input.executions[1],quantity:'2',price:'130',executedAt:'2026-01-15T02:00:00Z'}];
  input.monthly=[{documentId:'ipo',templateIds:[],reviewRequired:false,positions:[],events:[
   {...common,id:'app',date:'2026-01-08',kind:'ipo',amount:'-220',description:'IPO application'},
   {...common,id:'allot',date:'2026-01-10',kind:'ipo',quantity:'2',description:'IPO allotment',displayTimePolicy:'session-open'},
   {...common,id:'refund',date:'2026-01-20',kind:'ipo',amount:'20',description:'IPO refund'},
  ]}];
  const hk=buildRelease(input,'r').scopes.find(s=>s.id===scopeId('HK','a'))!;
  const before=hk.days.find(d=>d.date==='2026-01-19')!,after=hk.days.find(d=>d.date==='2026-01-20')!;
  expect(after.buckets.HKD.realizedMissing).toBeGreaterThan(before.buckets.HKD.realizedMissing);
  expect(projectPeriod(before,[after],{from:after.date,to:after.date},'HKD',input.businessDate).realized.value).toBeNull();
 });
 it('reports a new closed lot after an old gap without making cumulative history complete',()=>{
  const input=source();input.businessDate='2026-01-09';input.asOf='2026-01-09T15:59:59.999Z';
  const fill=(id:string,date:string,side:'buy'|'sell',quantity:string,price:string,fee:string)=>({...input.executions[0],id,executedAt:`${date}T02:00:00Z`,side,quantity,price,fee});
  input.executions=[fill('old','2026-01-02','sell','10','8','0'),fill('old-close','2026-01-06','sell','10','12','0'),fill('new','2026-01-07','buy','10','20','2'),fill('new-close','2026-01-08','sell','5','24','1')];
  input.monthly=[{documentId:'gap',templateIds:[],reviewRequired:false,events:[],positions:[{accountId:'a',market:'HK',symbol:'00001',phase:'closing',date:'2026-01-05',quantity:'10',source:[]},{accountId:'a',market:'HK',symbol:'00001',phase:'closing',date:'2026-01-06',quantity:'0',source:[]}]}];
  const hk=buildRelease(input,'r').scopes.find(s=>s.id===scopeId('HK','a'))!;
  const base=hk.days.find(d=>d.date==='2026-01-07')!,end=hk.days.find(d=>d.date==='2026-01-08')!;
  const projected=projectPeriod(base,[end],{from:end.date,to:end.date},'HKD',input.businessDate);
  expect(projected.realized.value).toBe('18');expect(projected.points[0].realized.value).toBeNull();
 });
 it('limits unclassified warnings to the matching market/account and knowledge boundary',()=>{
  const input=source(); input.classification.unknown=3;
  input.unclassified=[
    {accountId:'a',accountLabel:'A',instrumentId:'HK:00001',market:'HK',knownAt:'2026-01-05T02:00:00Z'},
    {accountId:'b',accountLabel:'B',instrumentId:'US:X',market:'US',knownAt:'2026-01-05T02:00:00Z'},
    {accountId:'a',accountLabel:'A',instrumentId:'HK:00001',market:'HK',knownAt:'2026-01-08T02:00:00Z'},
  ];
  const release=buildRelease(input,'r');
  expect(release.scopes.find(s=>s.id===scopeId('HK','a'))!.reasons.filter(r=>r.includes('交易性质'))).toEqual(['1 条记录交易性质待核实，未计入实盘']);
  expect(release.scopes.find(s=>s.id===scopeId('US','a'))!.reasons.filter(r=>r.includes('交易性质'))).toEqual([]);
  expect(release.accounts.some(a=>a.id==='b')).toBe(true);
 });
 it('reuses account-market history without reopening every unchanged object after restart',()=>{
  const db=new DatabaseSync(':memory:');db.exec(HOME_SCHEMA);const input=source();
  buildRelease(input,'first',{cache:new ProjectionCache(db)});
  const cache=new ProjectionCache(db),read=vi.spyOn(cache,'get');
  const actual=buildRelease(input,'second',{cache});
  expect(actual).toEqual(buildRelease(input,'second'));
  expect(read).not.toHaveBeenCalled();db.close();
 });
 it('keeps cached and fresh financial results identical after every relevant input changes',()=>{
  const db=new DatabaseSync(':memory:');db.exec(HOME_SCHEMA);const input=source(),cache=new ProjectionCache(db);
  buildRelease(input,'first',{cache});
  const changes=[
   ()=>{input.executions[0].price='90';},
   ()=>{input.candles[1].close='125';},
   ()=>{input.currentFx={HKD:{rate:'0.9',source:'test',asOf:'2026-01-07'}};},
   ()=>{input.historicalFx=[{date:'2026-01-06',knownAt:'2026-01-06T09:00:00Z',rates:{HKD:{rate:'0.8',source:'test',asOf:'2026-01-06'}}}];},
   ()=>{input.monthly=[{documentId:'fee-only',templateIds:[],reviewRequired:false,positions:[],events:[{id:'f',accountId:'a',currency:'HKD',date:'2026-01-06',kind:'fee',amount:'-2',description:'service',source:[]}]}];},
   ()=>{input.executions.push({...input.executions[0],id:'account-b',accountId:'b'});},
   ()=>{input.executions=input.executions.filter(e=>e.accountId!=='a');},
   ()=>{input.businessDate='2026-01-08';input.asOf='2026-01-08T02:00:00Z';},
  ];
  changes.forEach((change,i)=>{change();expect(buildRelease(input,`step-${i}`,{cache})).toEqual(buildRelease(input,`step-${i}`));});db.close();
 });
 it('skips unchanged published scope materialization while updating a corrected scope atomically',()=>{
  const db=new DatabaseSync(':memory:');initializeSqlite(db);const input=source(),store=new HomeStore(db);
  const build=(id:string)=>buildRelease(input,id,{cache:new ProjectionCache(db),reusePublished:true});
  store.stage(store.reuseUnchanged(build('first')));store.publish('first',null);
  const same=build('same');expect(same.scopes).toHaveLength(0);expect(same.reuse).toHaveLength(8);
  input.executions[0].price='90';input.sequence=2;
  const changed=build('changed');expect(changed.scopes).toHaveLength(4);expect(changed.reuse).toHaveLength(4);
  expect(changed.scopes).toEqual(buildRelease(input,'changed').scopes.filter(s=>s.market==='all'||s.market==='HK'));
  store.stage(store.reuseUnchanged(changed));store.publish('changed','first');expect(store.head()).toBe('changed');db.close();
 });
 it('never shortcuts a staged scope and keeps reused scope contents equal to a fresh rebuild',()=>{
  const db=new DatabaseSync(':memory:');initializeSqlite(db);const input=source(),store=new HomeStore(db);
  const build=(id:string)=>buildRelease(input,id,{cache:new ProjectionCache(db),reusePublished:true});
  store.stage(store.reuseUnchanged(build('staged')));
  expect(build('retry').scopes).toHaveLength(8);
  store.stage(store.reuseUnchanged(build('first')));store.publish('first',null);
  const changes=[
   ()=>{input.asOf='2026-01-07T16:00:00.000Z';},
   ()=>{input.currentFx={HKD:{rate:'0.9',source:'test',asOf:'2026-01-07'}};},
   ()=>{input.historicalFx=[{date:'2026-01-06',knownAt:'2026-01-06T09:00:00Z',rates:{HKD:{rate:'0.8',source:'test',asOf:'2026-01-06'}}}];},
   ()=>{input.monthly=[{documentId:'fee-only',templateIds:[],reviewRequired:false,positions:[],events:[{id:'f',accountId:'a',currency:'HKD',date:'2026-01-06',kind:'fee',amount:'-2',description:'service',source:[]}]}];},
   ()=>{input.executions.push({...input.executions[0],id:'account-b',accountId:'b'});},
   ()=>{input.executions=input.executions.filter(e=>e.accountId!=='a');},
   ()=>{input.classification.unknown=1;},
   ()=>{input.businessDate='2026-01-08';input.asOf='2026-01-08T02:00:00Z';},
  ];
  changes.forEach((change,i)=>{
   change();input.sequence++;const id=`change-${i}`,old=store.head(),actual=build(id),fresh=buildRelease(input,id);
   store.stage(store.reuseUnchanged(actual));store.publish(id,old);
   const freshDb=new DatabaseSync(':memory:');initializeSqlite(freshDb);const freshStore=new HomeStore(freshDb);
   freshStore.stage(fresh);freshStore.publish(id,null);
   for(const scope of fresh.scopes){
    const saved=db.prepare('SELECT r.* FROM home_scope_result r JOIN home_release_scope s USING(scope_version) WHERE s.release_id=? AND s.scope_id=?').get(id,scope.id)!;
    expect({...JSON.parse(String(saved.current_json)),fx:input.currentFx}).toEqual(scope.current);
    const days=db.prepare('SELECT * FROM home_daily WHERE scope_version=? ORDER BY business_date').all(String(saved.scope_version)).map(r=>({date:r.business_date,buckets:JSON.parse(String(r.native_by_currency_json)),...JSON.parse(String(r.money_context_json))}));
    expect(days).toEqual(scope.days);
    const request={market:scope.market,accountId:scope.accountId,period:{preset:'custom' as const,from:input.executions[0]?.executedAt.slice(0,10)??input.businessDate,to:input.businessDate},query:'',sort:'name' as const,direction:'asc' as const,page:1};
    const reusedHome=store.readHome(request,id),freshHome=freshStore.readHome(request,id);
    expect(reusedHome.holdings).toEqual(freshHome.holdings);
    expect(reusedHome.metrics).toEqual(freshHome.metrics);
    expect(reusedHome.series.points).toEqual(freshHome.series.points);
    expect(store.exportHoldings(request,id)).toEqual(freshStore.exportHoldings(request,id));
   }
   freshDb.close();
  });db.close();
 });
 it('resolves exact completed raw quotes from unordered inputs without carrying a prior close',()=>{
  const input=source(),ordered=buildRelease(input,'r');
  input.candles.reverse();
  expect(buildRelease(input,'r')).toEqual(ordered);
  input.candles=input.candles.filter(c=>c.tradingDate!=='2026-01-07'||c.adjustmentMode!=='raw');
  const result=buildRelease(input,'r').scopes.find(s=>s.id===scopeId('HK','a'))!;
  expect(result.holdings[0].row.price).toBeNull();expect(result.holdings[0].row.priceAsOf).toBeNull();
 });
 it('schedules the next date-only knowledge boundary and the market close before day rollover',()=>{
  const input=source();input.businessDate='2026-01-06';input.asOf='2026-01-06T09:00:00Z';input.executions[1].source.timePrecision='date-only';
  expect(buildRelease(input,'evening').nextRefreshAt).toBe('2026-01-06T15:59:59.999Z');
  input.asOf='2026-01-06T07:00:00Z';
  expect(buildRelease(input,'close').nextRefreshAt).toBe('2026-01-06T08:10:00.000Z');
 });
 it('carries missing-opening uncertainty into period realization rather than zero',()=>{
  const input=source();input.executions=[{...input.executions[0],side:'sell',quantity:'1'}];
  const hk=buildRelease(input,'r').scopes.find(s=>s.id===scopeId('HK','a'))!;
  expect(projectPeriod(hk.days[0],hk.days.slice(1),{from:'2026-01-05',to:'2026-01-07'},'HKD','2026-01-07').realized.value).toBeNull();
 });
 it('invalidates cached inventory at the start of an ambiguous transfer day',()=>{
  const input=source();input.executions=input.executions.slice(0,1);input.businessDate='2026-01-06';input.asOf='2026-01-06T08:00:00Z';
  input.monthly=[{documentId:'transfer',templateIds:[],reviewRequired:false,positions:[],events:[{id:'t',accountId:'a',market:'HK',symbol:'00001',date:'2026-01-06',kind:'transfer-in',quantity:'1',description:'transfer',source:[]}]}];
  const all=buildRelease(input,'r').scopes.find(s=>s.id===scopeId('HK','a'))!;
  expect(all.holdings[0].row.quantity).toBeNull();
 });
 it('reuses published immutable scope versions and rebuilds only scopes whose values changed',()=>{
  const db=new DatabaseSync(':memory:');initializeSqlite(db);const store=new HomeStore(db),input=source();
  const a=buildRelease(input,'a');store.stage(a);store.publish('a',null);
  const b=store.reuseUnchanged(buildRelease({...input,sequence:2,asOf:'2026-01-07T15:59:59.999Z'},'b'));
  expect(b.scopes).toHaveLength(0);expect(b.reuse).toHaveLength(8);store.stage(b);store.publish('b','a');
  input.executions[0].price='90';
  const c=store.reuseUnchanged(buildRelease({...input,sequence:3},'c'));
  expect(c.scopes.map(s=>s.market).sort()).toEqual(['HK','HK','all','all']);
  expect(c.reuse).toHaveLength(4);store.stage(c);store.publish('c','b');db.close();
 });
 it('can return to a still-retained content version after an intervening correction',()=>{
  const db=new DatabaseSync(':memory:');initializeSqlite(db);const store=new HomeStore(db),input=source();
  const a=buildRelease(input,'a');store.stage(store.reuseUnchanged(a));store.publish('a',null);
  const original=input.executions[0].price;input.executions[0].price='90';
  store.stage(store.reuseUnchanged(buildRelease({...input,sequence:2},'b')));store.publish('b','a');
  input.executions[0].price=original;
  const reverted=store.reuseUnchanged(buildRelease({...input,sequence:3},'c'));
  expect(reverted.scopes).toHaveLength(0);expect(reverted.reuse).toHaveLength(8);
  store.stage(reverted);store.publish('c','b');expect(store.head()).toBe('c');db.close();
 });
 it('retries an interrupted scope stage without reusing its partial result',()=>{
  const db=new DatabaseSync(':memory:');initializeSqlite(db);const store=new HomeStore(db),input=source();
  db.exec("CREATE TRIGGER interrupt_home BEFORE INSERT ON home_daily BEGIN SELECT RAISE(ABORT,'simulated crash'); END");
  expect(()=>store.stage(store.reuseUnchanged(buildRelease(input,'broken')))).toThrow(/simulated crash/);
  db.exec('DROP TRIGGER interrupt_home');
  expect(()=>store.stage(store.reuseUnchanged(buildRelease(input,'retry')))).not.toThrow();
  store.publish('retry',null);expect(store.head()).toBe('retry');db.close();
 });
 it('does not expose date-only future-knowledge trades before inventory knows them',()=>{
  const input=source();input.asOf='2026-01-05T08:00:00Z';input.businessDate='2026-01-05';input.executions=input.executions.slice(0,1);input.executions[0].source.timePrecision='date-only';
  expect(buildRelease(input,'r').trades.flatMap(t=>t.trades)).toHaveLength(0);
 });
 it('keeps market-unassigned costs unknown in market scopes instead of reporting zero',()=>{
  const input=source();input.monthly=[{documentId:'s',templateIds:[],reviewRequired:false,positions:[],events:[{id:'fee',accountId:'a',currency:'HKD',date:'2026-01-06',kind:'fee',amount:'-2',description:'service fee',source:[]}]}];
  const hk=buildRelease(input,'r').scopes.find(s=>s.id===scopeId('HK','a'))!;
  expect(projectPeriod(hk.days[0],hk.days.slice(1),{from:'2026-01-05',to:'2026-01-07'},'HKD','2026-01-07').fees.value).toBeNull();
 });
 it('reuses durable object projections after restart and invalidates a historical correction',()=>{
  const db=new DatabaseSync(':memory:');db.exec(HOME_SCHEMA);
  const input=source(), first={reused:0,built:0};
  const a=buildRelease(input,'a',{cache:new ProjectionCache(db),stats:first});
  expect(first).toEqual({reused:0,built:1});
  const second={reused:0,built:0};
  const b=buildRelease(input,'b',{cache:new ProjectionCache(db),stats:second});
  expect(second).toEqual({reused:1,built:0});
  expect(b.scopes[0].current).toEqual(a.scopes[0].current);
  input.executions[0].price='90';
  const corrected={reused:0,built:0};
  const c=buildRelease(input,'c',{cache:new ProjectionCache(db),stats:corrected});
  expect(corrected).toEqual({reused:0,built:1});
  expect(c.scopes.find(s=>s.id===scopeId('HK','a'))!.current.buckets.HKD.realized).toBe('27');
  db.close();
 });
 it('includes statement expenses once in period fees, independently of inventory PnL',()=>{
  const input=source(); input.monthly=[{documentId:'s',templateIds:[],reviewRequired:false,positions:[],events:[{id:'fee',accountId:'a',market:'HK',symbol:'00001',currency:'HKD',date:'2026-01-06',kind:'fee',amount:'-2',description:'service fee',source:[]}]}];
  const hk=buildRelease(input,'r').scopes.find(s=>s.id===scopeId('HK','a'))!;
  expect(projectPeriod(hk.days[0],hk.days.slice(1),{from:'2026-01-05',to:'2026-01-07'},'HKD','2026-01-07').fees.value).toBe('7');
 });
 it('retains statement-only inventory without a security master or assumed currency/cost', () => {
  const input=source(); input.executions=[]; input.instruments=[];
  input.monthly=[{documentId:'statement',templateIds:[],reviewRequired:false,positions:[{accountId:'a',market:'HK',symbol:'06688',phase:'opening',date:'2026-01-05',quantity:'10',source:[]}],events:[]}];
  const hk=buildRelease(input,'r').scopes.find(s=>s.id===scopeId('HK','a'))!;
  expect(hk.holdings).toHaveLength(1);
  expect(hk.holdings[0].row).toMatchObject({code:'06688',quantity:'10',cost:null,currency:'UNKNOWN',marketValue:{value:null}});
 });
 it('publishes all market/account scopes and a full daily calendar with independent current values', () => {
  const release = buildRelease(source(), 'r');
  expect(release.scopes).toHaveLength(8);
  const hk = release.scopes.find(s=>s.id===scopeId('HK','a'))!;
  expect(hk.days.map(d=>d.date)).toEqual(['2026-01-04','2026-01-05','2026-01-06','2026-01-07']);
  expect(hk.current.buckets.HKD).toMatchObject({market:'110',unrealized:'8',realized:'17'});
  expect(hk.holdings[0].row).toMatchObject({quantity:'1',cost:'100',price:'110',priceAsOf:'2026-01-07'});
  expect(hk.marketCutoffs).toEqual({HK:'2026-01-07'});
  const period = projectPeriod(hk.days[0],hk.days.slice(1),{from:'2026-01-05',to:'2026-01-07'},'HKD','2026-01-07');
  expect(period.net.value).toBe('25');
 });
 it('does not backfill historical FX from current FX, and flags an absent completed-session quote', () => {
  const input = source(); input.currentFx.HKD={rate:'0.9',source:'test',asOf:'2026-01-07'};
  input.candles.pop(); const result = buildRelease(input,'r');
  const all = result.scopes.find(s=>s.id===scopeId('all','all'))!;
  expect(all.days[2].fx).toEqual({});
  expect(all.current.buckets.HKD.market).toBeNull();
  expect(all.holdings[0].row.marketValue.value).toBeNull();
 });
});
