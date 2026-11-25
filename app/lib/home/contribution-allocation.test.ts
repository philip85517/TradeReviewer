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
  const full=validateFull(db,built.release)!;expect(full.modules.allocations[0].categoryMetrics?.map(m=>m.category)).toEqual(['long','short']);expect(full.modules.closeRounds.map(r=>r.category)).toEqual(['long','short']);
  const request=defaultFullRequest('2026-01-09');request.currentPeriod={preset:'custom',from:'2026-01-06',to:'2026-01-08'};
  const view=new FullHomeStore(db).read(request,built.release),long=view.contribution.categories.find(c=>c.category==='long')!,short=view.contribution.categories.find(c=>c.category==='short')!;
  expect(long.realized.value).toBe('150.00');expect(long.unrealizedChange.value).toBe('-100.00');expect(long.net.value).toBe('50.00');expect(short.net.value).toBe('10.00');expect(view.contribution.coverage).toMatchObject({eligibleCount:1,classifiedCount:1,universeComplete:true});
  expect(view.history.coverage.confirmedClosedCount).toBe(2);expect(view.history.coverage.universeComplete).toBe(false);
  const source=readSourceSnapshot(db,'2026-01-09T03:00:00Z');
  // A complete single-direction scope is publishable too; requiring a second
  // category used to hide otherwise proven long profit behind an unclassified
  // whole-object fallback.
  const pureSource={...source,executions:source.executions.filter(e=>e.id==='l1'||e.id==='l2'),executionRefs:source.executionRefs?.filter(r=>r.executionId==='l1'||r.executionId==='l2')};
  const pureOriginal=buildRelease(pureSource,'pure-long').scopes.find(s=>s.market==='all'&&s.accountId==='all')!.metricObjects![0];
  expect(buildContributionMetrics(pureSource.executions,pureSource,pureOriginal)?.map(m=>m.category)).toEqual(['long']);
  const crossing=source.executions.map(e=>e.id==='l2'?{...e,quantity:'11'}:e);expect(partitionContribution(crossing,source)).toBeNull();
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


it('classifies BE-shaped flat segments using source close-long evidence and preserves historical amounts and fees',()=>{
 const dir=mkdtempSync(join(tmpdir(),'be-contribution-')),path=join(dir,'private.sqlite');let db=new DatabaseSync(path);
 try{
  initializeSqlite(db);db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:BE','BE','BE','US','CNY')");
  // Same five flat segments as BE May 2026: short20, long20,
  // short50+50, long40+15, short30. Simple prices allow hand checking.
  const rows=[['s1','sell','07','20','10','open-short'],['s2','buy','11','20','12','close-short'],['l1','buy','18','20','10',null],['l2','sell','19','20','12','close-long'],['s3','sell','20','50','10','open-short'],['s4','sell','21','50','12','open-short'],['s5','buy','22','100','13','close-short'],['l3','buy','23','40','10',null],['l4','buy','24','15','12',null],['l5','sell','25','55','11','close-long'],['s6','sell','28','30','10','open-short'],['s7','buy','29','30','12','close-short']] as const;
  const insert=db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)');
  for(const [id,side,day,q,p,effect] of rows)insert.run(id,'US:BE','A',side,`2026-05-${day}T15:00:00Z`,q,p,'1','live',JSON.stringify({source:{platform:'fixture',row:1,...(effect?{positionEffect:effect}:{})}}));
  const source=readSourceSnapshot(db,'2026-06-01T03:00:00Z');
  const mutate=(id:string,update:Partial<import('../trades/types').TradeExecution>)=>source.executions.map(e=>e.id===id?{...e,...update}:e);
  const execution=(id:string)=>source.executions.find(e=>e.id===id)!;
  // Without the local closing evidence, a later segment's close-long cannot prove this one.
  expect(partitionContribution(mutate('l2',{source:{...execution('l2').source,positionEffect:undefined}}),source)).not.toBeNull();
  expect(partitionContribution(mutate('l2',{quantity:'21'}),source)).toBeNull();
  expect(partitionContribution(mutate('l2',{quantity:'19'}),source)).toBeNull();
  expect(partitionContribution(mutate('l2',{source:{...execution('l2').source,positionEffect:'open-short'}}),source)).toBeNull();
  expect(partitionContribution(mutate('l2',{executedAt:execution('l1').executedAt}),source)).toBeNull();
  expect(partitionContribution(mutate('s1',{source:{...execution('s1').source,positionEffect:undefined}}),source)).toBeNull();
  expect(partitionContribution(mutate('s2',{source:{...execution('s2').source,positionEffect:undefined}}),source)).toBeNull();
  const position={accountId:'A',market:'US',symbol:'BE',quantity:'1',date:'2026-05-31',documentId:'doc',phase:'closing' as const,source:[]};
  expect(partitionContribution(source.executions,{...source,monthly:[{documentId:'doc',templateIds:[],reviewRequired:false,positions:[position],events:[]}]})).not.toBeNull();
  const transfer={accountId:'A',market:'US',symbol:'BE',id:'transfer',kind:'transfer-in' as const,quantity:'1',date:'2026-05-18',description:'Transferred inventory',source:[]};
  expect(partitionContribution(source.executions,{...source,monthly:[{documentId:'doc',templateIds:[],reviewRequired:false,positions:[],events:[transfer]}]})).toBeNull();
  expect(partitionContribution(mutate('l1',{source:{...execution('l1').source,historyIncomplete:['missing']}}),source)).toBeNull();
  const built=buildOnce(path,'2026-06-01T03:00:00Z');db.close();db=new DatabaseSync(path);
  const full=validateFull(db,built.release)!;
  expect(full.modules.allocations[0].categoryMetrics?.map(m=>m.category)).toEqual(['short','long']);
  const request=defaultFullRequest('2026-06-01');request.contribution.mode='historical';request.contribution.category='all';request.historyRange={fromYear:2026,toYear:2026};
  const store=new FullHomeStore(db),view=store.read(request,built.release);
  expect(view.contribution.net.value).toBe('-247.00');expect(view.contribution.fees.value).toBe('12.00');
  expect(view.contribution.categories.find(c=>c.category==='long')).toMatchObject({net:{value:'60.00'},fees:{value:'5.00'}});
  expect(view.contribution.categories.find(c=>c.category==='short')).toMatchObject({net:{value:'-307.00'},fees:{value:'7.00'}});
  for(const [category,net,fees] of [['long','60.00','5.00'],['short','-307.00','7.00']] as const){
   const selected=store.read({...request,contribution:{...request.contribution,category}},built.release).contribution;
   expect(selected.net.value).toBe(net);expect(selected.fees.value).toBe(fees);expect(selected.rows).toHaveLength(1);expect(selected.rows[0].net.value).toBe(net);
  }
  expect(view.contribution.coverage).toMatchObject({eligibleCount:1,classifiedCount:1,universeComplete:true});
  expect(db.prepare('SELECT count(*) AS count,sum(CAST(fee AS REAL)) AS fees FROM executions').get()).toMatchObject({count:12,fees:12});
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
