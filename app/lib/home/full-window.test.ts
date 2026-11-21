import {expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {MetricObject,NativeBucket,NativeDay} from './contracts';
import {NativeSeriesAccumulator} from './native-series';
import * as windowing from './full-window';
import {initializeSqlite} from '../../../db/sqlite';
import {buildOnce} from '../../../scripts/home-build-entry';
import {HomeStore} from './store';
import {FullHomeStore} from './full-store';
import {defaultFullRequest,FULL_SCHEMA,coreRequest} from './full-contracts';
import {fullHash} from './full-projection';
import {evidenceKeys} from './full-evidence';
import {metricObjectVersion,stageMetricObjects} from './metric-objects';
import {BusinessPairingStore} from './business-pairing-store';

it('windows cumulative prefixes while preserving historical currency/reason insertion order',()=>{
 const bucket=(reasons:string[],realized='0'):NativeBucket=>({market:'10',unrealized:'2',realized,fees:'0',realizedMissing:0,feesMissing:0,count:1,marketKnown:1,unrealizedKnown:1,lifetimeComplete:true,reasons});
 const day=(date:string,buckets:NativeDay['buckets']):NativeDay=>({date,buckets,fx:{},reasons:[]});
 const objects:MetricObject[]=[{version:'a',positionKey:'a',accountId:'A',code:'A',name:'A',firstDay:'2025-01-01',lastDay:'2026-02-01',current:day('2026-02-01',{}),boundaries:[day('2025-01-01',{USD:bucket(['first'])}),day('2025-12-01',{USD:bucket(['second'])}),day('2026-01-02',{USD:bucket(['second','first'],'3')})]},
 {version:'b',positionKey:'b',accountId:'A',code:'B',name:'B',firstDay:'2024-01-01',lastDay:'2026-02-01',current:day('2026-02-01',{}),boundaries:[day('2024-01-01',{HKD:bucket(['older']),USD:bucket(['prior'])}),day('2025-12-02',{HKD:bucket([]),USD:bucket([])})]}];
 const dates=[...new Set(objects.flatMap(o=>o.boundaries.map(d=>d.date)).concat(['2025-12-31','2026-02-01']))].sort();
 const before=new NativeSeriesAccumulator();for(const o of objects)before.add(o.boundaries);const expected=before.finish(dates,()=>({})).filter(d=>d.date>='2025-12-31');
 const reduced=windowing.windowNativeObjects(objects,'2025-12-31');expect(reduced.objects.reduce((n,o)=>n+o.boundaries.length,0)).toBe(3);
 const after=new NativeSeriesAccumulator();for(const o of reduced.objects)after.add(o.boundaries);const actual=reduced.restoreOrder(after.finish([...new Set(reduced.objects.flatMap(o=>o.boundaries.map(d=>d.date)).concat(['2025-12-31','2026-02-01']))].sort(),()=>({}))).filter(d=>d.date>='2025-12-31');
 expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
 const capable=objects.map(object=>({...object,ordering:windowing.nativeOrdering(object.boundaries)}));
 const sliced=capable.map(object=>({...object,boundaries:object.boundaries.filter((day,i,all)=>day.date>'2025-12-31'||i===all.findLastIndex(d=>d.date<='2025-12-31'))}));
 const metadataWindow=windowing.windowNativeObjects(sliced,'2025-12-31');
 const viaMetadata=new NativeSeriesAccumulator();for(const o of metadataWindow.objects)viaMetadata.add(o.boundaries);
 expect(JSON.stringify(metadataWindow.restoreOrder(viaMetadata.finish([...new Set(sliced.flatMap(o=>o.boundaries.map(d=>d.date)).concat(['2025-12-31','2026-02-01']))].sort(),()=>({}))).filter(d=>d.date>='2025-12-31'))).toBe(JSON.stringify(expected));
 const tieObjects=[...objects, {...objects[0],positionKey:'tie',boundaries:[day('2025-01-01',{USD:bucket(['tie-first','first'])})]}];
 for(const selection of [tieObjects,[...tieObjects].reverse()]){
  const ties=windowing.windowNativeObjects(selection,'2025-12-31'),metadataTies=windowing.windowNativeObjects(selection.map(o=>({...o,ordering:windowing.nativeOrdering(o.boundaries)})),'2025-12-31');
  const evaluate=(window:ReturnType<typeof windowing.windowNativeObjects>)=>{const accumulator=new NativeSeriesAccumulator();for(const object of window.objects)accumulator.add(object.boundaries);return window.restoreOrder(accumulator.finish(dates,()=>({}))).filter(d=>d.date>='2025-12-31');};
  expect(JSON.stringify(evaluate(metadataTies))).toBe(JSON.stringify(evaluate(ties)));
 }

 // Same-date first appearances remain observable on the retained prefix.
 const prefix=day('2025-12-01',{USD:bucket(['first','second']),HKD:bucket([])});
 const prefixObject={...objects[0],boundaries:[prefix],ordering:windowing.nativeOrdering([prefix])};
 for(const opening of [prefix.date,'2025-12-31']){
  const currencyMismatch=structuredClone(prefixObject);
  currencyMismatch.ordering.currencies[0].index=1;currencyMismatch.ordering.currencies[1].index=0;
  expect(()=>windowing.validateNativeOrdering(currencyMismatch.ordering,prefixObject.firstDay,prefixObject.lastDay)).not.toThrow();
  expect.soft(()=>windowing.windowNativeObjects([currencyMismatch],opening)).toThrow('ordering currency');
  const reasonMismatch=structuredClone(prefixObject);
  reasonMismatch.ordering.currencies[0].reasons[0].index=1;reasonMismatch.ordering.currencies[0].reasons[1].index=0;
  expect(()=>windowing.validateNativeOrdering(reasonMismatch.ordering,prefixObject.firstDay,prefixObject.lastDay)).not.toThrow();
  expect.soft(()=>windowing.windowNativeObjects([reasonMismatch],opening)).toThrow('ordering reason');
 }
 const invalid=structuredClone(capable);Object.defineProperty(invalid[0].ordering,'version',{value:2});
 expect(()=>windowing.windowNativeObjects(invalid,'2025-12-31')).toThrow('ordering');
 const validOrdering=capable[0].ordering;
 for(const bad of [null,{...validOrdering,version:2},{...validOrdering,currencies:[...validOrdering.currencies,...validOrdering.currencies]}, {...validOrdering,currencies:validOrdering.currencies.map(c=>({...c,index:-1}))},{...validOrdering,currencies:validOrdering.currencies.map(c=>({...c,date:'2027-01-01'}))}])expect(()=>windowing.validateNativeOrdering(bad,objects[0].firstDay,objects[0].lastDay)).toThrow('ordering');
 for(const opening of ['2023-01-01','2027-01-01'])expect(windowing.windowNativeObjects(capable,opening).objects.map(o=>o.boundaries)).toEqual(windowing.windowNativeObjects(objects,opening).objects.map(o=>o.boundaries));
 const incomplete=structuredClone(capable);incomplete[0].ordering.currencies[0].reasons=[];
 expect(()=>windowing.windowNativeObjects(incomplete,'2025-12-31')).toThrow('ordering');
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  const content={...capable[0],boundaries:capable[0].boundaries.map(d=>({...d,activity:0})),current:{...capable[0].current,activity:0}};const {version:_,...unsigned}=content;const staged={...unsigned,version:metricObjectVersion(unsigned)};
  const incompleteContent={...unsigned,ordering:{...unsigned.ordering,currencies:[]}};
  expect(()=>stageMetricObjects(db,[{...incompleteContent,version:metricObjectVersion(incompleteContent)}])).toThrow('ordering');
  const {ordering:legacyOrdering,...legacyContent}=unsigned;
  const legacyObject={...legacyContent,version:metricObjectVersion(legacyContent)};
  stageMetricObjects(db,[legacyObject]);
  expect(Object.hasOwn(JSON.parse(String(db.prepare('SELECT metadata_json FROM home_metric_object WHERE object_version=?').get(legacyObject.version)!.metadata_json)),'ordering')).toBe(false);
  stageMetricObjects(db,[staged]);stageMetricObjects(db,[staged]);
  db.prepare('UPDATE home_metric_object SET complete=0 WHERE object_version=?').run(staged.version);
  db.prepare("UPDATE home_metric_boundary SET native_json=native_json||' ' WHERE object_version=? AND business_date=?").run(staged.version,staged.boundaries[0].date);
  expect(()=>stageMetricObjects(db,[staged])).toThrow('metric');
  db.prepare('DELETE FROM home_metric_boundary WHERE object_version=? AND business_date=?').run(staged.version,staged.boundaries[0].date);
  stageMetricObjects(db,[staged]);expect(db.prepare('SELECT complete FROM home_metric_object WHERE object_version=?').get(staged.version)!.complete).toBe(1);
  db.prepare("UPDATE home_metric_object SET metadata_json=metadata_json||' ' WHERE object_version=?").run(staged.version);
  expect(()=>stageMetricObjects(db,[staged])).toThrow('metric');
 }finally{db.close();}

});

it('matches actual published full-history results for filtered windows and custom historical ends',()=>{
 const dir=mkdtempSync(join(tmpdir(),'full-window-')),path=join(dir,'isolated.sqlite'),db=new DatabaseSync(path);initializeSqlite(db);
 try{
 const ids=['PART','CLOSED','STILL','UNKNOWN'];
 for(const id of ids)db.prepare('INSERT INTO instruments(id,symbol,name,market,currency,metadata_json)VALUES(?,?,?,?,?,?)').run('CN-SH:'+id,id,id,'CN-SH','CNY',JSON.stringify({assetType:'stock'}));
 const add=(id:string,symbol:string,side:string,q:string,p:string,day:string)=>db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,'CN-SH:'+symbol,'A',side,day+'T06:00:00Z',q,p,'0','live',JSON.stringify({source:{platform:'fixture'},accountLabel:'A'}));
 for(const symbol of ids)add(symbol+'b',symbol,'buy','10','10','2025-12-22');add('PARTs','PART','sell','4','15','2026-01-05');add('CLOSEDs','CLOSED','sell','10','15','2026-01-06');
 for(const symbol of ['PART','CLOSED']){const pairing=new BusinessPairingStore(db),scope={accountId:'A',instrumentId:'CN-SH:'+symbol},v=pairing.inspectScope(scope);pairing.save({scope,expectedRevision:v.revision,expectedFingerprint:v.fingerprint,confirmedBy:'fixture',basis:'explicit',rounds:[{id:symbol,closingExecutionIds:[symbol+'s'],pairings:[{openingExecutionId:symbol+'b',closingExecutionId:symbol+'s',quantity:symbol==='PART'?'4':'10'}]}]});}
 for(const symbol of ['PART','CLOSED','STILL'])for(const day of ['2025-12-22','2025-12-23','2025-12-24','2025-12-25','2025-12-26','2025-12-29','2025-12-30','2025-12-31','2026-01-02','2026-01-05','2026-01-06','2026-01-07','2026-01-08','2026-01-09','2026-01-12'])db.prepare("INSERT INTO daily_candles(instrument_id,date,adjustment_mode,open,high,low,close,currency,provider)VALUES(?,?,'raw','12','12','12','12','CNY','yahoo')").run('CN-SH:'+symbol,day);
 db.prepare("UPDATE daily_candles SET close='13' WHERE instrument_id='CN-SH:STILL' AND date='2026-01-12'").run();
 const built=buildOnce(path,'2026-01-13T03:00:00Z'),r=defaultFullRequest('2026-01-13');r.selection.assetTypes=['stock'];r.historyRange={fromYear:2025,toYear:2026};r.currentPeriod={preset:'custom',from:'2026-01-05',to:'2026-01-09'};
 for(const variant of ['stock','open','pending'] as const){const request=structuredClone(r);request.selection.globalOpenOnly=variant==='open';request.selection.review=variant==='pending'?'pending':'all';
  // Reference lane reads complete native history, seeing ordering as absent.
  // Persisted objects are never changed, and normal prefix arithmetic is retained.
  const prepare=db.prepare.bind(db),legacy=vi.spyOn(db,'prepare').mockImplementation(sql=>{
   const statement=prepare(sql);
   if(sql.startsWith('SELECT o.* FROM')){
    const all=statement.all.bind(statement);
    vi.spyOn(statement,'all').mockImplementation((...args)=>all(...args).map(row=>{const meta=JSON.parse(String(row.metadata_json));if(variant!=='pending'||row.position_key===db.prepare('SELECT position_key FROM home_metric_object ORDER BY object_version LIMIT 1').get()!.position_key)delete meta.ordering;return {...row,metadata_json:JSON.stringify(meta)};}));
   }
   return statement;
  });
  const before=new FullHomeStore(db).read(request,built.release);legacy.mockRestore();db.prepare('DELETE FROM home_full_query WHERE release_id=?').run(built.release);
  const after=new FullHomeStore(db).read(request,built.release);expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  if(variant==='stock'){const part=after.contribution.rows.find(row=>row.code==='PART')!,closed=after.contribution.rows.find(row=>row.code==='CLOSED')!;expect([part.realized.value,part.unrealizedChange.value,part.net.value]).toEqual(['20.00','-8.00','12.00']);expect([closed.realized.value,closed.unrealizedChange.value,closed.net.value]).toEqual(['50.00','-20.00','30.00']);process.stdout.write('FULL_WINDOW_SAMPLE '+JSON.stringify({release:built.release,part:{realized:part.realized.value,unrealizedChange:part.unrealizedChange.value,net:part.net.value},closed:{realized:closed.realized.value,unrealizedChange:closed.unrealizedChange.value,net:closed.net.value},currentMarketValue:after.core.metrics.currentMarketValue.value})+'\n');}
  expect(new FullHomeStore(db).inline(after)).toEqual(new FullHomeStore(db).inline(before));
  expect(after.core.metrics.currentMarketValue.value).toBeNull();
  const missing=new HomeStore(db).readHome(coreRequest(request),built.release).metrics.currentMarketValue.partial?.missing??[];
  expect(missing.length).toBeGreaterThan(0);
  for(const identity of missing)expect(Object.keys(identity).sort()).toEqual(['accountId','code','name','reasons']);
  if(variant==='stock'){expect(after.core.holdings.rows.find(h=>h.code==='STILL')!.marketValue.value).toBe('130');expect(after.contribution.rows.find(h=>h.code==='STILL')!.net.value).toBe('0.00');}
  expect(JSON.stringify(after)).not.toContain('"ordering"');
  if(variant==='stock'){
   const legacy=structuredClone(after);legacy.queryArtifactId=fullHash([fullHash([built.release,request,after.manifest.fxVersion,FULL_SCHEMA]),'release-key-v2',evidenceKeys(after).sort()]);
   const text=JSON.stringify(legacy),oldKey=fullHash([FULL_SCHEMA,'release-key-v2-hash1',request,after.manifest.fxVersion]);db.prepare('DELETE FROM home_full_query WHERE release_id=?').run(built.release);db.prepare('INSERT INTO home_full_query VALUES(?,?,?,?)').run(built.release,oldKey,createHash('sha256').update(text).digest('hex'),text);
   const rebuilt=new FullHomeStore(db).read(request,built.release);expect(rebuilt.queryArtifactId).not.toBe(legacy.queryArtifactId);expect({...rebuilt,queryArtifactId:undefined}).toEqual({...after,queryArtifactId:undefined});expect(db.prepare('SELECT COUNT(*) n FROM home_full_query WHERE release_id=?').get(built.release)!.n).toBe(2);
  }
 }
 const metadataRow=db.prepare('SELECT object_version,metadata_json FROM home_metric_object LIMIT 1').get()!;
 const meta=JSON.parse(String(metadataRow.metadata_json));meta.ordering=null;
 db.prepare('DELETE FROM home_full_query WHERE release_id=?').run(built.release);
 db.prepare('UPDATE home_metric_object SET metadata_json=? WHERE object_version=?').run(JSON.stringify(meta),metadataRow.object_version);
 expect(()=>new FullHomeStore(db).read(r,built.release)).toThrow('ordering');
 db.prepare('UPDATE home_metric_object SET metadata_json=? WHERE object_version=?').run(metadataRow.metadata_json,metadataRow.object_version);
 }finally{vi.restoreAllMocks();db.close();rmSync(dir,{recursive:true,force:true});}
},60000);
