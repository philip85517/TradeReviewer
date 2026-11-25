import {expect,it} from 'vitest';
import type {StatementEvent,MonthlyStatement} from '../import/monthly-statement';
import type {TradeExecution} from './types';
import {replayPositionAtPrice} from '../replay/position-ledger';
import {buildTradeEpisodes} from './episodes';
import {summarizeTradeEpisode} from './episode-metrics';
import {selectMonthlyEvidenceHistory,applyMonthlyHistoryEvidence} from '../import/statement-evidence';
import {partitionContribution,buildContributionMetrics} from '../home/contribution-allocation';
import {buildRelease} from '../home/builder';
import type {SourceSnapshot} from '../home/source';
const gift:StatementEvent={documentId:'doc',id:'gift',accountId:'A',market:'US',symbol:'LI',date:'2020-12-22T03:31:04.000Z',kind:'transfer-in',quantity:'2',reportedUnitCost:'0.0000',currency:'USD',description:'Transfer in',source:[{page:3,row:22}],giftAcquisition:{kind:'user-confirmed-zero-cost-gift',source:'user',note:'Software gift confirmed by user',confirmedAt:'2026-11-25T00:00:00.000Z',currency:'USD'}};
const sell:TradeExecution={id:'sell',accountId:'A',accountLabel:'A',instrument:{id:'US:LI',symbol:'LI',market:'US',name:'LI',currency:'USD'},side:'sell',quantity:'2',price:'32.10',fee:'2.98',executedAt:'2020-12-22T15:15:28Z',source:{platform:'tiger',row:1,tradeNature:'live',positionEffect:'close-long',timePrecision:'second'}};
const monthly=(event:StatementEvent):MonthlyStatement=>({documentId:'doc',templateIds:[],positions:[],events:[event],reviewRequired:false});
it('uses explicit gift evidence through ledger, episodes and contribution without synthesizing a buy',()=>{
 const evidence=[monthly(gift)],executions=[{...sell,source:{...sell.source,positionEvents:[gift]}}];
 const ledger=replayPositionAtPrice({executions,evidence,markPrice:'0'});expect(ledger.accuracy).toBeUndefined();expect(ledger.netPnl).toBe('61.22');
 const episodes=buildTradeEpisodes(executions,evidence);expect(episodes).toHaveLength(1);expect(episodes[0].direction).toBe('long');expect(episodes[0].accuracy).toBeUndefined();expect(summarizeTradeEpisode(episodes[0])).toMatchObject({netPnl:'61.22',buyCount:0,sellCount:1});
 const source:SourceSnapshot={sequence:1,asOf:'2020-12-23T00:00:00Z',businessDate:'2020-12-23',executions,monthly:evidence,instruments:[],candles:[],currentFx:{},historicalFx:[],classification:{live:1,unknown:0,simulation:0},reviewFacts:{schemaVersion:1,legacy:[],recall:[]}};
 expect([...partitionContribution(executions,source)!.keys()]).toEqual(['long']);
 const original=buildRelease(source,'gift-original').scopes.find(s=>s.market==='all'&&s.accountId==='all')!.metricObjects![0];
 expect(original.current.buckets.USD.realized).toBe('61.22');
 expect(original.current.buckets.USD.fees).toBe('2.98');
 const contribution=buildContributionMetrics(executions,source,original);
 expect(contribution?.[0].category).toBe('long');expect(contribution?.[0].metric.current.buckets.USD.realized).toBe('61.22');
});
it('does not interpret raw zero cost as a gift, and rejects currency mismatch',()=>{
 for(const event of [{...gift,giftAcquisition:undefined},{...gift,currency:'HKD'}]){
  expect(replayPositionAtPrice({executions:[sell],evidence:[monthly(event)],markPrice:'0'}).accuracy).toBeDefined();
  expect(buildTradeEpisodes([sell],[monthly(event)])[0].accuracy).toBeDefined();
 }
});
it('preserves confirmation across JSON roundtrip and full reimport only for identical raw event facts',()=>{
 const old=JSON.parse(JSON.stringify(monthly(gift)));old.evidenceScope={accountId:'A',instrumentId:'US:LI'};
 const raw={...gift,giftAcquisition:undefined};
 const entries=[{id:'old',importedAt:'2026-11-24',monthly:old},{id:'new',importedAt:'2026-11-25',monthly:monthly(raw)}];
 const selected=selectMonthlyEvidenceHistory(entries);expect(selected).toHaveLength(1);expect(selected[0].events[0].giftAcquisition).toEqual(gift.giftAcquisition);
 expect(applyMonthlyHistoryEvidence([{...sell,source:{...sell.source,positionEvents:[gift]}}],[monthly(raw)])[0].source.positionEvents![0].giftAcquisition).toEqual(gift.giftAcquisition);
 for(const patch of [{quantity:'3'},{currency:'HKD'},{reportedUnitCost:'1'},{date:'2020-12-21'},{documentId:'other'}]){
  const changed=monthly({...raw,...patch});
  expect(selectMonthlyEvidenceHistory([entries[0],{...entries[1],monthly:changed}]).at(-1)!.events[0].giftAcquisition).toBeUndefined();
 }
});
it('collapses repeated attachment references and fails closed for distinct duplicate source IDs',()=>{
 const raw={...gift,giftAcquisition:undefined};
 const executions=[{...sell,source:{...sell.source,positionEvents:[gift,gift]}}];
 const evidence=[monthly(raw)];
 expect(replayPositionAtPrice({executions,evidence,markPrice:'0'})).toMatchObject({netPnl:'61.22',fees:'2.98'});
 expect(replayPositionAtPrice({executions,evidence,markPrice:'0'}).accuracy).toBeUndefined();
 const episodes=buildTradeEpisodes(executions,evidence);expect(episodes).toHaveLength(1);expect(summarizeTradeEpisode(episodes[0]).netPnl).toBe('61.22');
 const duplicate={...gift,id:'duplicate'};
 expect(replayPositionAtPrice({executions,evidence:[{...monthly(gift),events:[gift,duplicate]}],markPrice:'0'}).accuracy?.reasons).toContain('duplicate-position-event');
 expect(buildTradeEpisodes(executions,[{...monthly(gift),events:[gift,duplicate]}])[0].accuracy?.reasons).toContain('duplicate-position-event');
});

it('uses confirmation independently from the broker reported unit cost',()=>{
 const event={...gift,reportedUnitCost:'999.99'};
 expect(replayPositionAtPrice({executions:[sell],evidence:[monthly(event)],markPrice:'0'})).toMatchObject({netPnl:'61.22'});
 expect(replayPositionAtPrice({executions:[sell],evidence:[monthly(event)],markPrice:'0'}).accuracy).toBeUndefined();
});
it('does not carry confirmation to another row or another event ID with matching economic facts',()=>{
 const prior={id:'old',importedAt:'2026-11-24',monthly:monthly(gift)};
 for(const patch of [{id:'different-row'}, {source:[{page:3,row:23}]}]){
  const raw={...gift,...patch,giftAcquisition:undefined};
  const selected=selectMonthlyEvidenceHistory([prior,{id:'new',importedAt:'2026-11-25',monthly:monthly(raw)}]);
  expect(selected[0].events[0].giftAcquisition).toBeUndefined();
  expect(applyMonthlyHistoryEvidence([{...sell,source:{...sell.source,positionEvents:[gift]}}],[monthly(raw)])[0].source.positionEvents![0].giftAcquisition).toBeUndefined();
 }
});
it('fails closed before deduplication for conflicting same-ID raw attachments in either source order',()=>{
 for(const patch of [{quantity:'1'},{reportedUnitCost:'1'},{currency:'HKD'},{source:[{page:3,row:23}]}]){
  const conflict={...gift,...patch,giftAcquisition:undefined};
  for(const pair of [[gift,conflict],[conflict,gift]]){
   const evidence=[{...monthly(gift),events:pair}];
   const ledger=replayPositionAtPrice({executions:[sell],evidence,markPrice:'0'});
   expect(ledger.accuracy?.reasons).toContain('duplicate-position-event');
   const episodes=buildTradeEpisodes([sell],evidence);
   expect(episodes.some(e=>e.accuracy?.reasons.includes('duplicate-position-event'))).toBe(true);
   expect(episodes.every(e=>summarizeTradeEpisode(e).pnlAvailable===false)).toBe(true);
   const source:SourceSnapshot={sequence:1,asOf:'2020-12-23T00:00:00Z',businessDate:'2020-12-23',executions:[sell],monthly:evidence,instruments:[],candles:[],currentFx:{},historicalFx:[],classification:{live:1,unknown:0,simulation:0},reviewFacts:{schemaVersion:1,legacy:[],recall:[]}};
   expect(partitionContribution([sell],source)).toBeNull();
  }
 }
});
it('rejects conflicting confirmation metadata before dedup while allowing absent broker cost',()=>{
 for(const giftAcquisition of [{...gift.giftAcquisition!,currency:'HKD'},{...gift.giftAcquisition!,note:'Different confirmation'}]){
  const conflict={...gift,giftAcquisition};
  for(const events of [[gift,conflict],[conflict,gift]]){
   const evidence=[{...monthly(gift),events}];
   expect(replayPositionAtPrice({executions:[sell],evidence,markPrice:'0'}).accuracy?.reasons).toContain('duplicate-position-event');
   expect(buildTradeEpisodes([sell],evidence)[0].accuracy?.reasons).toContain('duplicate-position-event');
  }
 }
 for(const reportedUnitCost of [undefined,'']){
  const evidence=[monthly({...gift,reportedUnitCost})];
  expect(replayPositionAtPrice({executions:[sell],evidence,markPrice:'0'}).accuracy).toBeUndefined();
 }
 expect(replayPositionAtPrice({executions:[sell],evidence:[monthly({...gift,currency:undefined})],markPrice:'0'}).accuracy).toBeDefined();
});
it('proves an initial gift start and exposes its native FIFO lot without certifying earlier unknown basis',()=>{
 let native:import('../replay/position-ledger').NativePositionFacts|undefined;
 replayPositionAtPrice({executions:[sell],evidence:[monthly(gift)],markPrice:'0',nativeFacts:f=>{native=f;}});
 expect(native?.lifetimeComplete).toBe(true);expect(native?.sourceFifo).toBeDefined();
 const earlier={...gift,id:'earlier',date:'2020-12-21T03:31:04Z',giftAcquisition:undefined};
 replayPositionAtPrice({executions:[sell],evidence:[{...monthly(gift),events:[earlier,gift]}],markPrice:'0',nativeFacts:f=>{native=f;}});
 expect(native?.lifetimeComplete).toBe(false);expect(native?.sourceFifo).toBeUndefined();
});
it('publishes and reopens the real minimal LI gift-sale full-home path with an immutable gift source lot',async()=>{
 const {DatabaseSync}=await import('node:sqlite');
 const {mkdtempSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {initializeSqlite}=await import('../../../db/sqlite');
 const {SqliteStore}=await import('../storage/sqlite-store');
 const {readSourceSnapshot}=await import('../home/source');
 const {BusinessPairingStore}=await import('../home/business-pairing-store');
 const {buildFullRelease,fullHash}=await import('../home/full-projection');
 const {HomeStore}=await import('../home/store');
 const {FullHomeStore}=await import('../home/full-store');
 const {defaultFullRequest}=await import('../home/full-contracts');
 const {validateFull}=await import('../home/full-persistence');
 const dir=mkdtempSync(join(tmpdir(),'gift-full-home-')),file=join(dir,'isolated.sqlite');
 let db=new DatabaseSync(file);
 try{
  initializeSqlite(db);
  const store=new SqliteStore(db);
  const laterBuy:TradeExecution={...sell,id:'later-buy',side:'buy',quantity:'124',price:'35.75',fee:'2.98',executedAt:'2021-01-21T16:10:16.000Z',source:{...sell.source,positionEffect:'open-long'}};
  const laterSell:TradeExecution={...sell,id:'later-sell',quantity:'124',price:'35.5',fee:'3.08',executedAt:'2021-01-21T17:16:11.000Z',source:{...sell.source,positionEffect:'close-long'}};
  store.mergeTradeData({executions:[{...sell,source:{...sell.source,positionEvents:[gift]}},laterBuy,laterSell],importHistory:[{id:'gift-import',fileName:'fixture.pdf',sourceLabel:'fixture',importedAt:'2026-11-25T00:00:00Z',tradeCount:1,instrumentCount:1,excludedInstrumentCount:0,excludedRecordCount:0,duplicateTradeCount:0,unresolvedInstrumentCount:0,monthly:{...monthly(gift),events:[gift,{...gift,id:'future-gift',date:'2021-02-10T03:31:04.000Z',source:[{page:3,row:23}]}]}}]});
  const source=readSourceSnapshot(db,'2021-01-22T03:00:00Z');
  const before=JSON.stringify(source),core=buildRelease(source,'gift-full-publish'),pairing=new BusinessPairingStore(db);
  core.full=buildFullRelease(source,core,{inspections:pairing.readFullInspections(source),financial:pairing.readAll(source)});
  const publisher=new HomeStore(db);publisher.stage(core);const {HomeRefresh}=await import('../home/refresh');const now=Date.now();expect(new HomeRefresh(db).claim('gift-publisher',now,60000,true)).toBe(true);publisher.publish(core.id,null,{owner:'gift-publisher',now});
  db.close();db=new DatabaseSync(file);
  const full=validateFull(db,core.id)!;
  const lot=full.modules.allocations[0].sourceLots!.find(l=>l.sourceKey===`event:${gift.accountId}:${gift.id}`)!;
  expect(lot).toMatchObject({category:'long',quantity:'2',cashCost:'0',at:gift.date,dependencyHashes:[fullHash(gift)]});
  const {proofHash,...payload}=lot;expect(proofHash).toBe(fullHash(payload));
  expect(full.modules.allocations[0].sourceLots!.some(l=>l.sourceKey.endsWith(':future-gift'))).toBe(false);
  const request=defaultFullRequest(source.businessDate);
  const view=new FullHomeStore(db).read(request,core.id);
  expect(view.history.coverage.confirmedClosedCount).toBe(2);
  expect(JSON.stringify(source)).toBe(before);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
