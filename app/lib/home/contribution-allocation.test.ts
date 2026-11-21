import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {buildOnce} from '../../../scripts/home-build-entry';
import {FullHomeStore} from './full-store';
import {defaultFullRequest} from './full-contracts';
import {validateFull} from './full-persistence';
import {readSourceSnapshot} from './source';
import {partitionContribution,buildContributionMetrics} from './contribution-allocation';
import {buildRelease} from './builder';
it('publishes separate long/short native contributions, deducts opening U, reopens and never confirms business rounds',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mixed-contribution-')),path=join(dir,'private.sqlite');let db=new DatabaseSync(path);
 try{
  initializeSqlite(db);db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','Mixed','US','CNY')");
  const insert=db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)');
  for(const [id,side,day,q,p,effect] of [['l1','buy','05','10','10','open-long'],['l2','sell','06','10','25','close-long'],['s1','sell','07','1','30','open-short'],['s2','buy','08','1','20','close-short']])insert.run(id,'US:X','A',side,`2026-01-${day}T15:00:00Z`,q,p,'0','live',JSON.stringify({source:{platform:'fixture',row:1,positionEffect:effect}}));
  db.exec("INSERT INTO daily_candles(instrument_id,date,adjustment_mode,open,high,low,close,currency,provider)VALUES('US:X','2026-01-02','raw','20','20','20','20','CNY','yahoo')");
  const built=buildOnce(path,'2026-01-09T03:00:00Z');db.close();db=new DatabaseSync(path);
  const full=validateFull(db,built.release)!;expect(full.modules.allocations[0].categoryMetrics?.map(m=>m.category)).toEqual(['long','short']);expect(full.modules.closeRounds).toEqual([]);
  const request=defaultFullRequest('2026-01-09');request.currentPeriod={preset:'custom',from:'2026-01-06',to:'2026-01-08'};
  const view=new FullHomeStore(db).read(request,built.release),long=view.contribution.categories.find(c=>c.category==='long')!,short=view.contribution.categories.find(c=>c.category==='short')!;
  expect(long.realized.value).toBe('150.00');expect(long.unrealizedChange.value).toBe('-100.00');expect(long.net.value).toBe('50.00');expect(short.net.value).toBe('10.00');expect(view.contribution.coverage).toMatchObject({eligibleCount:1,classifiedCount:1,universeComplete:true});
  expect(view.history.coverage.confirmedClosedCount).toBe(0);expect(view.history.coverage.universeComplete).toBe(false);
  const source=readSourceSnapshot(db,'2026-01-09T03:00:00Z');const crossing=source.executions.map(e=>e.id==='l2'?{...e,quantity:'11'}:e);expect(partitionContribution(crossing,source)).toBeNull();
  db.prepare('UPDATE executions SET price=? WHERE id=?').run('24','l2');const next=buildOnce(path,'2026-01-09T03:00:00Z');
  expect(new FullHomeStore(db).read(request,next.release).contribution.categories.find(c=>c.category==='long')!.net.value).toBe('40.00');
  expect(new FullHomeStore(db).read(request,built.release).contribution.categories.find(c=>c.category==='long')!.net.value).toBe('50.00');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

it('keeps verified allotments separate from later purchases and refuses overlapping source inventory',()=>{
 const event={documentId:'doc',id:'allotment',accountId:'A',market:'HK',symbol:'06049',date:'2026-01-02',kind:'ipo' as const,quantity:'200',displayTimePolicy:'session-open' as const,description:'Dep - IPO Allotment 5653048',source:[{page:1,row:37,role:'stock' as const}]};
 const instrument={id:'HK:6049',symbol:'06049',name:'IPO','market':'HK',currency:'HKD'};
 const buy:import('../trades/types').TradeExecution={id:'ipo',accountId:'A',accountLabel:'A',instrument,side:'buy',quantity:'200',price:'35',fee:'0',executedAt:'2026-01-02T00:00:00Z',source:{platform:'futu',row:1,inputKind:'statement',fileFingerprint:'a'.repeat(64),formatRuleId:'manual/verified-ipo-allotment@1',sourceTradeId:'5653048',positionEffect:'open-long',displayTimePolicy:'session-open',marketCalendarDate:'2026-01-02',positionEvents:[event]}};
 const sell={...buy,id:'ipo-close',side:'sell' as const,price:'40',executedAt:'2026-01-02T08:00:00Z',source:{platform:'futu',tradeNature:'live' as const,row:2,positionEffect:'close-long' as const}};
 const ordinary={...buy,id:'ordinary',executedAt:'2026-01-05T02:00:00Z',source:{platform:'futu',row:3,positionEffect:'open-long' as const}};
 const source:import('./source').SourceSnapshot={sequence:1,asOf:'2026-01-06T03:00:00Z',businessDate:'2026-01-06',executions:[buy,sell,ordinary],monthly:[{documentId:'doc',templateIds:[],reviewRequired:false,positions:[],events:[event]}],instruments:[],candles:[],currentFx:{},historicalFx:[],classification:{live:3,unknown:0,simulation:0},reviewFacts:{schemaVersion:1,legacy:[],recall:[]}};
 expect([...partitionContribution(source.executions,source)!.keys()]).toEqual(['ipo','long']);
 const original=buildRelease(source,'ipo-original').scopes.find(s=>s.market==='all'&&s.accountId==='all')!.metricObjects![0];
 const metrics=buildContributionMetrics(source.executions,source,original)!;expect(metrics.map(m=>m.category)).toEqual(['ipo','long']);
 expect(metrics.find(m=>m.category==='ipo')!.metric.current.buckets.HKD.realized).toBe('1000');
 expect(metrics.find(m=>m.category==='long')!.metric.current.buckets.HKD.unrealized).toBeNull();
 expect(partitionContribution([buy,{...ordinary,executedAt:'2026-01-02T02:00:00Z'},sell],source)).toBeNull();
});
