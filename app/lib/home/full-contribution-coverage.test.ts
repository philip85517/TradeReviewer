import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect,it} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {buildOnce} from '../../../scripts/home-build-entry';
import {FullHomeStore} from './full-store';
import {defaultFullRequest,initialFullRequest} from './full-contracts';

it('preserves unknown-only source coverage through actual isolated publication and current contribution read',()=>{
 const directory=mkdtempSync(join(tmpdir(),'contribution-unknown-')),path=join(directory,'private.sqlite'),previous=process.env.TRADEREVIEW_DB_PATH;
 process.env.TRADEREVIEW_DB_PATH=path;const db=new DatabaseSync(path);
 try{
  initializeSqlite(db);
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','Unknown source','US','USD'); INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES('unknown-fill','US:X','A','buy','2026-01-07T15:00:00Z','1','10','0','unknown','{}')");
  const built=buildOnce(path,'2026-01-08T03:00:00Z'),request=defaultFullRequest('2026-01-08');
  const view=new FullHomeStore(db).read(request,built.release);
  expect(view.catalogCount).toBe(0);expect(view.contribution.rows).toEqual([]);
  expect(view.contribution.coverage.universeComplete).toBe(false);
  expect(view.contribution.coverage.reasons).toContain('unknown-trading-nature');
  expect(view.contribution.net.value).toBeNull();expect(view.contribution.coverage.eligibleCount).toBe(1);
  expect(view.history.coverage.confirmedClosedCount).toBe(0);expect(view.history.coverage.universeComplete).toBe(false);
  const allRequest=structuredClone(request);allRequest.contribution.category='all';
  const allStore=new FullHomeStore(db),all=allStore.read(allRequest,built.release).contribution;
  expect(all.net.value).toBeNull();
  expect(all.markets.find(market=>market.market==='US')?.net.value).toBeNull();
  expect(all.markets.find(market=>market.market==='CN')?.net).toEqual({value:'0.00',currency:'CNY',reasons:[]});
  allRequest.contribution.drillMarket='CN';
  expect(allStore.read(allRequest,built.release).contribution.net.value).toBe('0.00');
  // A known live row creates catalog/metric membership for this same scope;
  // it must not erase the other source whose trading nature remains unknown.
  db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run('known-fill','US:X','A','buy','2026-01-07T16:00:00Z','1','10','0','live',JSON.stringify({source:{platform:'fixture',row:2,positionEffect:'open-long'}}));
  const second=buildOnce(path,'2026-01-08T03:00:00Z'),mixed=new FullHomeStore(db).read(request,second.release);
  expect(mixed.catalogCount).toBe(1);expect(mixed.contribution.coverage.universeComplete).toBe(false);
  expect(mixed.contribution.coverage.reasons).toContain('unknown-trading-nature');expect(mixed.contribution.coverage.eligibleCount).toBe(1);expect(mixed.contribution.coverage.classifiedCount).toBe(0);expect(mixed.contribution.rows).toEqual([]);expect(mixed.contribution.net.value).toBeNull();
 }finally{db.close();rmSync(directory,{recursive:true,force:true});if(previous===undefined)delete process.env.TRADEREVIEW_DB_PATH;else process.env.TRADEREVIEW_DB_PATH=previous;}
});

it('keeps a historical classified subtotal when another market remains unknown',()=>{
 const directory=mkdtempSync(join(tmpdir(),'contribution-historical-')),path=join(directory,'private.sqlite'),db=new DatabaseSync(path);
 try{
  initializeSqlite(db);
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('CN-SH:KNOWN','KNOWN','Known CN','CN-SH','CNY'),('US:UNKNOWN','UNKNOWN','Unknown US','US','USD')");
  const add=(id:string,instrument:string,side:string,at:string,quantity:string,price:string,nature:string)=>db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,instrument,'A',side,at,quantity,price,'0',nature,JSON.stringify({source:{platform:'fixture',positionEffect:side==='buy'?'open-long':'close-long'}}));
  add('cn-buy','CN-SH:KNOWN','buy','2026-01-02T06:00:00Z','1','100','live');
  add('cn-sell','CN-SH:KNOWN','sell','2026-01-05T06:00:00Z','1','120','live');
  add('us-unknown','US:UNKNOWN','buy','2026-01-03T15:00:00Z','1','10','unknown');
  const built=buildOnce(path,'2026-01-08T03:00:00Z'),request=defaultFullRequest('2026-01-08');request.historyRange={fromYear:2026,toYear:2026};request.contribution.mode='historical';
  const contribution=new FullHomeStore(db).read(request,built.release).contribution;
  expect(contribution.rows.find(row=>row.code==='KNOWN')?.net.value).toBe('20.00');
  expect(contribution.net.value).toBe('20.00');
  expect(contribution.net.reasons).toContain('unknown-trading-nature');
  expect(contribution.markets.find(market=>market.market==='CN')?.net.value).toBe('20.00');
  expect(contribution.markets.find(market=>market.market==='US')?.net.value).toBeNull();
  expect(contribution.markets.find(market=>market.market==='US')?.net.reasons).toContain('unknown-trading-nature');
  const allRequest=structuredClone(request);allRequest.contribution.category='all';
  const all=new FullHomeStore(db).read(allRequest,built.release).contribution;
  expect(all.rows.find(row=>row.code==='KNOWN')?.net.value).toBe('20.00');
  expect(all.categories.find(category=>category.category==='all')?.net.value).toBe('20.00');
  expect(all.markets.find(market=>market.market==='CN')?.net.value).toBe('20.00');
  expect(all.markets.find(market=>market.market==='US')?.net.value).toBeNull();
  expect(all.coverage.reasons).toContain('unknown-trading-nature');
  expect(all.coverage.universeComplete).toBe(false);
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});

it('returns zero for a proven complete historical scope with no closes',()=>{
 const directory=mkdtempSync(join(tmpdir(),'contribution-historical-empty-')),path=join(directory,'private.sqlite'),db=new DatabaseSync(path);
 try{
  initializeSqlite(db);
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('CN-SH:OPEN','OPEN','Open only','CN-SH','CNY'); INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES('open-only','CN-SH:OPEN','A','buy','2026-01-03T06:00:00Z','1','100','0','live','{\"source\":{\"platform\":\"fixture\",\"positionEffect\":\"open-long\"}}')");
  const built=buildOnce(path,'2026-01-08T03:00:00Z'),request=defaultFullRequest('2026-01-08');request.historyRange={fromYear:2026,toYear:2026};request.contribution.mode='historical';
  const contribution=new FullHomeStore(db).read(request,built.release).contribution;
  expect(contribution.net.value).toBe('0.00');expect(contribution.net.reasons).toEqual([]);expect(contribution.coverage.universeComplete).toBe(true);
  request.contribution.category='all';
  const all=new FullHomeStore(db).read(request,built.release).contribution;
  expect(all.net.value).toBe('0.00');expect(all.coverage.universeComplete).toBe(true);
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});

it('resolves fresh all-history across years and includes financially known unclassified scopes exactly once',()=>{
 const directory=mkdtempSync(join(tmpdir(),'contribution-all-history-')),path=join(directory,'private.sqlite'),db=new DatabaseSync(path);
 try{
  initializeSqlite(db);
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','Cross year','US','CNY')");
  const add=(id:string,side:string,date:string,price:string)=>db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,'US:X','A',side,date,'1',price,'0','live',JSON.stringify({source:{timePrecision:'date-only',sourceTimeKind:'date',tradingDate:date.slice(0,10)}}));
  // Distinct bill dates plus complete flat-to-flat quantity chains prove the
  // long-only attribution across both years. Jan 1 tests the baseline year.
  add('buy-2025','buy','2025-01-01T06:00:00Z','100');add('sell-2025','sell','2025-02-01T06:00:00Z','120');
  add('buy-2026','buy','2026-01-02T06:00:00Z','100');add('sell-2026','sell','2026-01-05T06:00:00Z','130');
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('CN-SH:LATER','LATER','Later CN','CN-SH','CNY'); INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES('later-cn','CN-SH:LATER','A','buy','2026-01-03T06:00:00Z','1','100','0','live','{\"source\":{\"positionEffect\":\"open-long\"}}')");
  const built=buildOnce(path,'2026-01-08T03:00:00Z'),request=initialFullRequest('2026-01-08');request.contribution.mode='historical';
  const store=new FullHomeStore(db),all=store.read(request,built.release);
  expect(all.request.historyRange).toEqual({fromYear:2025,toYear:2026,scope:'all'});
  expect(all.historyBounds).toEqual({fromYear:2025,toYear:2026});
  const cnRequest=structuredClone(request);cnRequest.selection.market='CN';
  const cn=store.read(cnRequest,built.release);
  expect(cn.historyBounds).toEqual({fromYear:2025,toYear:2026});
  expect(all.contribution.rows).toHaveLength(1);expect(all.contribution.net.value).toBe('50.00');
  expect(all.contribution.net.value).toBe(all.history.net.value);
  expect(all.contribution.coverage.universeComplete).toBe(true);
  expect(all.contribution.categories.find(c=>c.category==='long')?.coverage.universeComplete).toBe(true);
  request.historyRange={fromYear:2026,toYear:2026};
  const year=store.read(request,built.release);
  expect(year.request.historyRange.scope).toBeUndefined();expect(year.contribution.net.value).toBe('30.00');
  expect(year.history.net.value).toBe('30.00');
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});

it('keeps CN subtotal while US missing FX and preserves membership uncertainty in drill scope',()=>{
 const directory=mkdtempSync(join(tmpdir(),'contribution-historical-fx-')),path=join(directory,'private.sqlite'),db=new DatabaseSync(path);
 try{
  initializeSqlite(db);
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('CN-SH:KNOWN','KNOWN','Known CN','CN-SH','CNY'),('US:NOFX','NOFX','No FX US','US','USD')");
  const add=(id:string,instrument:string,side:string,at:string,price:string)=>db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,instrument,'A',side,at,'1',price,'0','live',JSON.stringify({source:{platform:'fixture',positionEffect:side==='buy'?'open-long':'close-long'}}));
  add('cn-buy','CN-SH:KNOWN','buy','2026-01-02T06:00:00Z','100');add('cn-sell','CN-SH:KNOWN','sell','2026-01-05T06:00:00Z','120');
  add('us-buy','US:NOFX','buy','2026-01-02T15:00:00Z','10');add('us-sell','US:NOFX','sell','2026-01-05T15:00:00Z','12');
  const built=buildOnce(path,'2026-01-08T03:00:00Z'),request=defaultFullRequest('2026-01-08');request.historyRange={fromYear:2026,toYear:2026};request.contribution.mode='historical';
  const contribution=new FullHomeStore(db).read(request,built.release).contribution;
  expect(contribution.net.value).toBe('20.00');expect(contribution.coverage.universeComplete).toBe(false);
  expect(contribution.markets.find(market=>market.market==='CN')?.net).toMatchObject({value:'20.00'});
  expect(contribution.markets.find(market=>market.market==='US')?.net.value).toBeNull();
  expect(contribution.markets.find(market=>market.market==='US')?.coverage.universeComplete).toBe(false);
  expect(contribution.categories.find(category=>category.category==='long')?.coverage.universeComplete).toBe(false);
  const filtered=structuredClone(request);filtered.selection.assetTypes=['etf'];filtered.contribution.drillMarket='CN';
  const filteredContribution=new FullHomeStore(db).read(filtered,built.release).contribution;
  expect(filteredContribution.coverage.reasons).toContain('selection-membership-unknown');
  expect(filteredContribution.markets.find(market=>market.market==='CN')?.coverage.reasons).toContain('selection-membership-unknown');
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});
