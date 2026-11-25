import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect,it} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {buildOnce} from '../../../scripts/home-build-entry';
import {replaceFxSnapshot} from '../fx/storage';
import {FullHomeStore} from './full-store';
import {defaultFullRequest} from './full-contracts';

it('adds historical published cents identically across markets and detail rows',()=>{
 const directory=mkdtempSync(join(tmpdir(),'history-cents-')),path=join(directory,'private.sqlite'),db=new DatabaseSync(path);
 try{
  initializeSqlite(db);
  replaceFxSnapshot(db,{version:1,baseCurrency:'CNY',rates:{CNY:1,HKD:0.8518608870967743,USD:7.123456},source:{id:'frankfurter-ecb',label:'fixture',url:'https://example.com',attributionUrl:'https://example.com'},rateDate:'2026-01-05',fetchedAt:'2026-01-06T00:00:00Z',lastAttemptedAt:'2026-01-06T00:00:00Z',cacheStatus:'fresh'});
  for(const [market,currency] of [['CN-SH','CNY'],['HK','HKD'],['US','USD']])for(let n=0;n<3;n++){
   const id=`${market}:X${n}`;
   db.prepare('INSERT INTO instruments(id,symbol,name,market,currency)VALUES(?,?,?,?,?)').run(id,`X${n}`,id,market,currency);
   for(const [side,date,price] of [['buy','02','10'],['sell','05',n===2?'9.97':'10.03']])db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(`${id}-${side}`,id,'A',side,`2026-01-${date}T06:00:00Z`,'1',price,'0.001','live',JSON.stringify({source:{positionEffect:side==='buy'?'open-long':'close-long'}}));
  }
  const built=buildOnce(path,'2026-01-08T03:00:00Z'),request=defaultFullRequest('2026-01-08');request.historyRange={fromYear:2026,toYear:2026};request.contribution.mode='historical';request.contribution.category='all';
  const store=new FullHomeStore(db),all=store.read(request,built.release),cents=(value:string|null)=>Math.round(Number(value)*100);
  for(const field of ['net','fees'] as const){
   expect(cents(all.contribution[field].value)).toBe(all.contribution.markets.filter(m=>m.market!=='all').reduce((s,m)=>s+cents(m[field].value),0));
   let total=0;
   for(let page=1;page<=2;page++){request.contribution.page=page;total+=store.read(request,built.release).contribution.rows.reduce((s,row)=>s+cents(row[field].value),0);}
   expect(cents(all.contribution[field].value)).toBe(total);
   expect(all.history[field].value).toBe(all.contribution[field].value);
  }
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});

it('reconciles mixed HK/USD historical category cents after SQLite reopen',()=>{
 const directory=mkdtempSync(join(tmpdir(),'history-mixed-cents-')),path=join(directory,'private.sqlite');
 const db=new DatabaseSync(path);
 try{
  initializeSqlite(db);
  replaceFxSnapshot(db,{version:1,baseCurrency:'CNY',rates:{CNY:1,HKD:0.8518608870967743,USD:7.123456},source:{id:'frankfurter-ecb',label:'fixture',url:'https://example.com',attributionUrl:'https://example.com'},rateDate:'2026-01-05',fetchedAt:'2026-01-06T00:00:00Z',lastAttemptedAt:'2026-01-06T00:00:00Z',cacheStatus:'fresh'});
  for(const [market,currency] of [['HK','HKD'],['US','USD']]){
   const id=`${market}:MIXED`;
   db.prepare('INSERT INTO instruments(id,symbol,name,market,currency)VALUES(?,?,?,?,?)').run(id,'MIXED',id,market,currency);
   const executions=[
    ['buy','02','10','open-long'],['sell','05','10.03','close-long'],
    ['sell','10','10','open-short'],['buy','13','9.97','close-short'],
   ] as const;
   for(const [side,date,price,positionEffect] of executions)db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(`${id}-${side}-${date}`,id,'A',side,`2026-01-${date}T06:00:00Z`,'1',price,'0.01','live',JSON.stringify({source:{positionEffect}}));
  }
  const built=buildOnce(path,'2026-01-15T03:00:00Z');
  db.close();
  const reopened=new DatabaseSync(path);
  try{
   const request=defaultFullRequest('2026-01-15');request.historyRange={fromYear:2026,toYear:2026};request.contribution.mode='historical';request.contribution.category='all';
   const result=new FullHomeStore(reopened).read(request,built.release),cents=(value:string|null)=>Math.round(Number(value)*100);
   expect(result.contribution.categories.find(v=>v.category==='all')?.net.value).toBe(result.contribution.net.value);
   expect(result.contribution.categories.find(v=>v.category==='all')?.fees.value).toBe(result.contribution.fees.value);
   for(const field of ['net','fees'] as const){
    const categories=result.contribution.categories.filter(v=>v.category!=='all');
    expect(cents(result.contribution[field].value)).toBe(categories.reduce((sum,category)=>sum+cents(category[field].value),0));
   }
   expect(result.contribution.categories.find(v=>v.category==='long')?.count).toBe(2);
   expect(result.contribution.categories.find(v=>v.category==='short')?.count).toBe(2);
   expect(result.contribution.net.value).toBe('0.16');
   expect(result.contribution.fees.value).toBe('0.31');
   expect(result.contribution.categories.find(v=>v.category==='long')?.net.value).toBe('0.08');
   expect(result.contribution.categories.find(v=>v.category==='short')?.net.value).toBe('0.08');
   for(const field of ['net','fees'] as const){
    expect(cents(result.contribution[field].value)).toBe(result.contribution.markets.filter(v=>v.market!=='all').reduce((sum,market)=>sum+cents(market[field].value),0));
    expect(cents(result.contribution[field].value)).toBe(result.contribution.rows.reduce((sum,row)=>sum+cents(row[field].value),0));
   }
  }finally{reopened.close();}
 }finally{try{db.close();}catch{}rmSync(directory,{recursive:true,force:true});}
});
