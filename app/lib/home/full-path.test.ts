import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,copyFileSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect,it} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {BusinessPairingStore} from './business-pairing-store';
import {buildOnce} from '../../../scripts/home-build-entry';
import {FullHomeStore} from './full-store';
import {defaultFullRequest,initialFullRequest,FULL_MODULES} from './full-contracts';
import {validateFull} from './full-persistence';
import {HomeStore} from './store';
import {HomeRefresh} from './refresh';
import {readSourceSnapshot} from './source';
import {buildRelease} from './builder';
import {buildFullRelease,fullHash} from './full-projection';
import {homeHttp} from './http';
import {replaceFxSnapshot} from '../fx/storage';
function setup(){const dir=mkdtempSync(join(tmpdir(),'full-home-')),path=join(dir,'sample.sqlite'),db=new DatabaseSync(path);initializeSqlite(db);return {dir,path,db};}
it('real isolated confirmation/build/stage/publication/read paths preserve partial close, closed search/details, unknowns and old releases',async()=>{
 const {dir,path,db}=setup();try{
 db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','Partial','US','USD'),('US:Y','Y','Closed','US','USD'),('US:Z','Z','Unconfirmed','US','USD')");
 const add=(id:string,i:string,side:string,q:string,p:string,day:string)=>db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,i,'A',side,day+'T15:00:00Z',q,p,'0','live',JSON.stringify({source:{platform:'fixture'},accountLabel:'A'}));
 add('xb','US:X','buy','10','10','2026-01-02');add('xs','US:X','sell','4','15','2026-01-05');
 add('yb','US:Y','buy','2','20','2026-01-02');add('ys','US:Y','sell','2','25','2026-01-05');
 add('zb','US:Z','buy','2','20','2026-01-02');add('zs','US:Z','sell','2','25','2026-01-05');
 for(const [i,b,s,q] of [['US:X','xb','xs','4'],['US:Y','yb','ys','2']]){const pairing=new BusinessPairingStore(db),scope={accountId:'A',instrumentId:i},v=pairing.inspectScope(scope);pairing.save({scope,expectedRevision:v.revision,expectedFingerprint:v.fingerprint,confirmedBy:'fixture',basis:'explicit close',rounds:[{id:'round',closingExecutionIds:[s],pairings:[{openingExecutionId:b,closingExecutionId:s,quantity:q}]}]});}
 db.exec("INSERT INTO daily_candles(instrument_id,date,adjustment_mode,open,high,low,close,currency,provider)VALUES('US:X','2026-01-06','raw','12','12','12','12','USD','yahoo')");
 const first=buildOnce(path,'2026-01-07T23:00:00Z');const store=new FullHomeStore(db),r=defaultFullRequest('2026-01-08');r.currentPeriod={preset:'custom',from:'2026-01-02',to:'2026-01-08'};r.historyRange={fromYear:2026,toYear:2026};
 const view=store.read(r,first.release);expect(view.accountIdsByMarket).toEqual({CN:[],HK:[],US:['A']});expect(store.read(r,first.release).accountIdsByMarket).toEqual(view.accountIdsByMarket);expect(view.manifest.moduleComplete).toBe(true);expect(view.history.coverage.closedCount).toBeNull();expect(view.history.coverage.confirmedClosedCount).toBe(2);expect(view.history.winRate).toBeNull();expect(view.history.buckets).toHaveLength(12);expect(store.evidence(view.releaseId,view.history.coverage.sourceRefsKey).sourceRefs).toHaveLength(6);expect(JSON.stringify(view)).not.toContain('affectedSourceRefs');
 // Published financial partitions share the original algorithms and evidence,
 // survive query eviction, and are independent of holding-table controls.
 const published=store.publishFinancialPartitions(first.release,[r]);expect(published.count).toBe(1);
 const partitionRequest=structuredClone(r);partitionRequest.holdings.sort='marketValue';partitionRequest.holdings.direction='desc';partitionRequest.holdings.page=2;
 db.exec('DELETE FROM home_full_query');expect(store.read(r,first.release)).toEqual(view);const partitionView=store.read(partitionRequest,first.release);
 expect(partitionView.history).toEqual(view.history);expect(partitionView.contribution).toEqual(view.contribution);
 expect(store.evidence(first.release,partitionView.history.coverage.sourceRefsKey).count).toBe(6);
 // A changed current period must reuse identical history without reusing its contribution.
 const baseRequest={...r,currentPeriod:initialFullRequest(view.manifest.businessDate).currentPeriod,contribution:initialFullRequest(view.manifest.businessDate).contribution};
 const changed=structuredClone(baseRequest);changed.currentPeriod={preset:'custom',from:'2026-01-06',to:'2026-01-07'};
 db.exec('DELETE FROM home_full_query');const expectedChanged=store.read(changed,first.release);
 const baseline=store.read(baseRequest,first.release);const extra=store.publishFinancialPartitions(first.release,[baseRequest]);
 db.exec('DELETE FROM home_full_query');const changedPublished=store.read(changed,first.release);
 expect(changedPublished).toEqual(expectedChanged);expect(changedPublished.history).toEqual(baseline.history);
 expect(changedPublished.contribution).not.toEqual(baseline.contribution);
 db.prepare('DELETE FROM home_full_financial WHERE release_id=? AND partition_key=?').run(first.release,extra.keys[0]);
 const publishedRow=db.prepare('SELECT * FROM home_full_financial WHERE release_id=?').get(first.release)!;
 db.prepare('UPDATE home_full_financial SET payload_json=payload_json||? WHERE release_id=?').run(' ',first.release);db.exec('DELETE FROM home_full_query');
 expect(()=>store.read(partitionRequest,first.release)).toThrow('invalid financial partition payload hash');
 db.prepare('UPDATE home_full_financial SET payload_json=?,algorithm=? WHERE release_id=?').run(String(publishedRow.payload_json),'obsolete',first.release);
 expect(store.read(partitionRequest,first.release).history).toEqual(view.history);
 db.prepare('DELETE FROM home_full_financial WHERE release_id=?').run(first.release);db.exec('DELETE FROM home_full_query');
 const inline=store.inline(view);expect(inline.sourceRefsByKey![view.history.coverage.sourceRefsKey]).toEqual(store.evidence(first.release,view.history.coverage.sourceRefsKey).sourceRefs);expect(view.sourceRefsByKey).toBeUndefined();expect(view.evidenceTransport).toBe('release-key-v2');
 const unfold=(value:unknown):unknown=>{if(Array.isArray(value))return value.map(unfold);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).filter(([key])=>!['evidenceTransport','sourceRefsByKey'].includes(key)).map(([key,child])=>key==='sourceRefsKey'?['affectedSourceRefs',inline.sourceRefsByKey![String(child)]]:[key,unfold(child)]));};expect(unfold(inline)).toEqual(unfold(view));
 db.prepare('DELETE FROM home_full_query WHERE release_id=?').run(first.release);expect(new FullHomeStore(db).evidence(first.release,view.history.coverage.sourceRefsKey).count).toBe(6);
 const evidenceResponse=await homeHttp(db,'evidence',new Request('http://localhost/api/home/evidence?version='+encodeURIComponent(JSON.stringify(first.release))+'&key='+encodeURIComponent(JSON.stringify(view.history.coverage.sourceRefsKey))));expect(evidenceResponse.status).toBe(200);expect(await evidenceResponse.json()).toMatchObject({releaseId:first.release});
 expect((await homeHttp(db,'evidence',new Request('http://localhost/api/home/evidence?version='+encodeURIComponent(JSON.stringify(first.release))+'&key='+encodeURIComponent(JSON.stringify('unknown'))))).status).toBe(404);
 expect((await homeHttp(db,'evidence',new Request('http://localhost/api/home/evidence?version='+encodeURIComponent(JSON.stringify('expired'))+'&key='+encodeURIComponent(JSON.stringify(view.history.coverage.sourceRefsKey))))).status).toBe(410);
 const found=store.search(first.release,'Closed');expect(found.items).toHaveLength(1);expect(found.items[0].open).toBe(false);expect(store.detail(first.release,{kind:'position',id:found.items[0].id,accountScope:['A'],sourceContext:'search'}).trades).toHaveLength(2);
 const open=structuredClone(r);open.selection.globalOpenOnly=true;const openView=store.read(open,first.release);expect(openView.accountIdsByMarket).toEqual(view.accountIdsByMarket);expect(openView.history.coverage.confirmedClosedCount).toBe(1);expect(openView.core.holdings.total).toBe(1);
 const holdingTarget={kind:'position' as const,id:openView.core.holdings.rows[0].id,accountScope:['A'],sourceContext:'holdings'};
 expect(store.detail(first.release,holdingTarget).trades.map(t=>t.id)).toEqual(['xb','xs']);
 expect(()=>store.detail(first.release,{...holdingTarget,accountScope:['B']})).toThrow('该版本目录中没有这个对象');
 db.prepare('DELETE FROM home_full_evidence WHERE release_id=? AND source_key=?').run(first.release,openView.history.coverage.sourceRefsKey);expect(store.read(open,first.release)).toEqual(openView);expect(store.evidence(first.release,openView.history.coverage.sourceRefsKey).count).toBe(2);
 const historical=structuredClone(r);historical.contribution.mode='historical';expect(store.read(historical,first.release).contribution.rows).toHaveLength(3);
 // Financial closes include Z despite absent manual business-round confirmation.
 expect(store.read(historical,first.release).contribution.rows.find(row=>row.code==='Z')?.roundCount).toBe(0);
 // Direction and current-period finance do not require a confirmed business close.
 expect(view.contribution.rows.find(row=>row.code==='Z')?.realized).toMatchObject({value:null,reasons:expect.arrayContaining([expect.stringMatching(/汇率/)])});
 expect(view.contribution.coverage).toMatchObject({classifiedCount:3,eligibleCount:3,universeComplete:true});
 expect(view.history.coverage.universeComplete).toBe(false);
 // Validation memo identity includes every persisted trade's complete raw JSON,
 // regardless of the index/order used to retrieve those immutable members.
 const trade=db.prepare('SELECT trade_set_id,ordinal,trade_json FROM home_holding_trade ORDER BY trade_set_id,ordinal LIMIT 1').get()!;
 // Key insertion order changes raw bytes, but preserves strict ref identity.
 const reordered=JSON.parse(String(trade.trade_json)),beforeReorder=validateFull(db,first.release)!;reordered.sourceRef=Object.fromEntries(Object.entries(reordered.sourceRef).reverse());
 db.prepare('UPDATE home_holding_trade SET trade_json=? WHERE trade_set_id=? AND ordinal=?').run(JSON.stringify(reordered),String(trade.trade_set_id),Number(trade.ordinal));expect(validateFull(db,first.release)).not.toBe(beforeReorder);expect(store.read(r,first.release)).toEqual(view);
 db.prepare('UPDATE home_holding_trade SET trade_json=? WHERE trade_set_id=? AND ordinal=?').run(String(trade.trade_json),String(trade.trade_set_id),Number(trade.ordinal));
 for(const crossConnection of [false,true]){const writer=crossConnection?new DatabaseSync(path):db;try{
  const validated=validateFull(db,first.release),original=String(trade.trade_json);
  writer.prepare('UPDATE home_holding_trade SET trade_json=? WHERE trade_set_id=? AND ordinal=?').run(original+' ',String(trade.trade_set_id),Number(trade.ordinal));expect(validateFull(db,first.release)).not.toBe(validated);
  const corrupt=JSON.parse(original);corrupt.sourceRef.rawVersion='corrupt';writer.prepare('UPDATE home_holding_trade SET trade_json=? WHERE trade_set_id=? AND ordinal=?').run(JSON.stringify(corrupt),String(trade.trade_set_id),Number(trade.ordinal));expect(()=>store.read(r,first.release)).toThrow('invalid full allocation part');
  writer.prepare('UPDATE home_holding_trade SET trade_json=? WHERE trade_set_id=? AND ordinal=?').run(original,String(trade.trade_set_id),Number(trade.ordinal));expect(store.read(r,first.release)).toEqual(view);
 }finally{if(crossConnection)writer.close();}}
 // A validation inside a savepoint may observe bytes that never commit.
 const committed=validateFull(db,first.release);
 db.exec('SAVEPOINT verify_snapshot');
 let speculative;
 try{
  db.prepare('UPDATE home_holding_trade SET trade_json=? WHERE trade_set_id=? AND ordinal=?').run(String(trade.trade_json)+' ',String(trade.trade_set_id),Number(trade.ordinal));
  speculative=validateFull(db,first.release);
  expect(speculative).not.toBe(committed);
 }finally{db.exec('ROLLBACK TO verify_snapshot; RELEASE verify_snapshot');}
 const restored=validateFull(db,first.release);
 expect(restored).not.toBe(speculative);
 expect(restored).toEqual(committed);
 expect(store.export(r,first.release)).toContain(first.release);
 const response=await homeHttp(db,'full',new Request('http://localhost/api/home/full?request='+encodeURIComponent(JSON.stringify(r))+'&version='+encodeURIComponent(JSON.stringify(first.release))));expect(response.status).toBe(200);
 // Exercise both actual persisted formats with the same release identities,
 // not a decoder-only fixture. The v1 logical result must equal v2 exactly.
 const compactManifest=String(db.prepare('SELECT manifest_json FROM home_full_release WHERE release_id=?').get(first.release)!.manifest_json),compactRows=db.prepare('SELECT kind,payload_json FROM home_full_module WHERE release_id=?').all(first.release),logical=validateFull(db,first.release)!,legacyManifest=JSON.parse(compactManifest);
 // Recompute raw storage proof to reach dictionary identity/completeness checks.
 const dictionaryRow=compactRows.find(row=>row.kind==='sourceEvidence')!,dictionary=JSON.parse(String(dictionaryRow.payload_json));
 const dictionaryCase=(extra:unknown[],error:string)=>{const refs=[...dictionary,...extra],payload=JSON.stringify(refs),manifest=JSON.parse(compactManifest);manifest.modules.sourceEvidence.count=refs.length;manifest.modules.sourceEvidence.hash=createHash('sha256').update(payload).digest('hex');try{
  db.prepare("UPDATE home_full_module SET payload_json=? WHERE release_id=? AND kind='sourceEvidence'").run(payload,first.release);db.prepare('UPDATE home_full_release SET manifest_json=? WHERE release_id=?').run(JSON.stringify(manifest),first.release);expect(()=>validateFull(db,first.release)).toThrow(error);
 }finally{db.prepare("UPDATE home_full_module SET payload_json=? WHERE release_id=? AND kind='sourceEvidence'").run(String(dictionaryRow.payload_json),first.release);db.prepare('UPDATE home_full_release SET manifest_json=? WHERE release_id=?').run(compactManifest,first.release);}};
 dictionaryCase([Object.fromEntries(Object.entries(dictionary[0]).reverse())],'invalid full source evidence identities');
 const escaped='雪\u0000"\\[],|';dictionaryCase([{schemaVersion:1,executionId:'a|b',rawVersion:'c',effectiveVersion:escaped},{effectiveVersion:escaped,rawVersion:'b|c',executionId:'a',schemaVersion:1}],'unused full source evidence identity');
 delete legacyManifest.modules.sourceEvidence;delete legacyManifest.versions.sourceEvidence;delete legacyManifest.versions.storageHash;
 for(const key of FULL_MODULES){legacyManifest.modules[key]={...legacyManifest.modules[key],version:'1',hash:fullHash(logical.modules[key])};db.prepare('UPDATE home_full_module SET payload_json=? WHERE release_id=? AND kind=?').run(JSON.stringify(logical.modules[key]),first.release,key);}
 db.prepare("DELETE FROM home_full_module WHERE release_id=? AND kind='sourceEvidence'").run(first.release);db.prepare('UPDATE home_full_release SET manifest_json=? WHERE release_id=?').run(JSON.stringify(legacyManifest),first.release);db.prepare('DELETE FROM home_full_query WHERE release_id=?').run(first.release);
 const legacy=store.read(r,first.release);expect({...legacy,manifest:undefined}).toEqual({...view,manifest:undefined});
 // Legacy/generic refs retain complete canonical identity, including extra keys.
 const legacyRaw=String(db.prepare('SELECT manifest_json FROM home_full_release WHERE release_id=?').get(first.release)!.manifest_json),legacyTrades=db.prepare('SELECT trade_set_id,ordinal,trade_json FROM home_holding_trade').all(),generic=JSON.parse(JSON.stringify(logical.modules),(key,value)=>value&&typeof value==='object'&&'executionId' in value&&'rawVersion' in value?{...value,legacyTag:'kept'}:value),genericManifest=JSON.parse(legacyRaw);
 try{
  for(const key of FULL_MODULES){genericManifest.modules[key].hash=fullHash(generic[key]);db.prepare('UPDATE home_full_module SET payload_json=? WHERE release_id=? AND kind=?').run(JSON.stringify(generic[key]),first.release,key);}
  db.prepare('UPDATE home_full_release SET manifest_json=? WHERE release_id=?').run(JSON.stringify(genericManifest),first.release);
  for(const row of legacyTrades){const payload=JSON.parse(String(row.trade_json));payload.sourceRef.legacyTag='kept';db.prepare('UPDATE home_holding_trade SET trade_json=? WHERE trade_set_id=? AND ordinal=?').run(JSON.stringify(payload),String(row.trade_set_id),Number(row.ordinal));}
  expect(validateFull(db,first.release)!.modules).toEqual(generic);
  const unequal=JSON.parse(String(trade.trade_json));unequal.sourceRef.legacyTag='changed';db.prepare('UPDATE home_holding_trade SET trade_json=? WHERE trade_set_id=? AND ordinal=?').run(JSON.stringify(unequal),String(trade.trade_set_id),Number(trade.ordinal));expect(()=>validateFull(db,first.release)).toThrow('invalid full allocation part');
 }finally{
  for(const key of FULL_MODULES)db.prepare('UPDATE home_full_module SET payload_json=? WHERE release_id=? AND kind=?').run(JSON.stringify(logical.modules[key]),first.release,key);
  for(const row of legacyTrades)db.prepare('UPDATE home_holding_trade SET trade_json=? WHERE trade_set_id=? AND ordinal=?').run(String(row.trade_json),String(row.trade_set_id),Number(row.ordinal));db.prepare('UPDATE home_full_release SET manifest_json=? WHERE release_id=?').run(legacyRaw,first.release);
 }
 expect(validateFull(db,first.release)!.modules).toEqual(logical.modules);
 for(const row of compactRows)db.prepare('INSERT OR REPLACE INTO home_full_module VALUES(?,?,?)').run(first.release,row.kind,row.payload_json);db.prepare('UPDATE home_full_release SET manifest_json=? WHERE release_id=?').run(compactManifest,first.release);db.prepare('DELETE FROM home_full_query WHERE release_id=?').run(first.release);
 db.exec("UPDATE executions SET price='11' WHERE id='xb'");const second=buildOnce(path,'2026-01-07T23:00:00Z');expect(second.release).not.toBe(first.release);expect(()=>store.evidence(second.release,view.history.coverage.sourceRefsKey)).toThrow('证据键不存在');expect(store.read(r,first.release).history.coverage.confirmedClosedCount).toBe(2);expect(store.read(r,second.release).history.coverage.confirmedClosedCount).toBe(1);
 process.stdout.write('FULL_REAL_SAMPLE '+JSON.stringify({first:first.release,second:second.release,confirmed:view.history.coverage.confirmedClosedCount,universeComplete:view.history.coverage.universeComplete,closedSearch:found.items[0].id,openConfirmed:openView.history.coverage.confirmedClosedCount,historyRows:store.read(historical,first.release).contribution.total,buildMs:first.totalMs})+'\n');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
},60000);
it('rejects a missing full module and requires publication fence',()=>{
 const {dir,db}=setup();try{
 const source=readSourceSnapshot(db,'2026-01-08T03:00:00Z'),pairing=new BusinessPairingStore(db);const core=buildRelease(source,'full-fence');core.full=buildFullRelease(source,core,{inspections:pairing.readFullInspections(source),financial:pairing.readAll(source)});const store=new HomeStore(db);store.stage(core);
 expect(()=>store.publish(core.id,null)).toThrow('requires fence');const refresh=new HomeRefresh(db);expect(refresh.claim('test',Date.now(),60000,true)).toBe(true);db.prepare("DELETE FROM home_full_module WHERE release_id=? AND kind='catalog'").run(core.id);expect(()=>store.publish(core.id,null,{owner:'test',now:Date.now()})).toThrow('missing full module');expect(store.head()).toBeNull();
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
it.runIf(!!process.env.FULL_HOME_SNAPSHOT)('builds and reads an immutable full release from an explicit private copy of the real snapshot',()=>{
 const {dir,path,db}=setup();db.close();try{
 copyFileSync(process.env.FULL_HOME_SNAPSHOT!,path);chmodSync(path,0o600);const built=buildOnce(path);const read=new DatabaseSync(path);try{initializeSqlite(read);const store=new FullHomeStore(read),r=defaultFullRequest(new Date(Date.now()+8*3600000).toISOString().slice(0,10));const start=performance.now(),view=store.read(r,built.release);expect(view.schema).toBe('full-home-v1');expect(view.catalogCount).toBeGreaterThan(0);process.stdout.write('FULL_SNAPSHOT '+JSON.stringify({release:built.release,executions:built.executions,catalog:view.catalogCount,sourceSequence:view.manifest.sourceSequence,readMs:performance.now()-start,buildMs:built.totalMs,coverage:{...view.history.coverage,affectedSourceRefs:store.evidence(view.releaseId,view.history.coverage.sourceRefsKey).sourceRefs.length}})+'\n');}finally{read.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
},120000);
it('includes opening floating profit in current contribution and fixes financial order to the release FX',()=>{
 const {dir,path,db}=setup();try{
 db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('CN-SH:X','X','Current','CN-SH','CNY'),('CN-SH:Y','Y','Seventy','CN-SH','CNY'),('US:U','U','TenUSD','US','USD')");
 const add=(id:string,i:string,side:string,q:string,p:string,at:string)=>db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,i,'A',side,at,q,p,'0','live',JSON.stringify({source:{platform:'fixture'},accountLabel:'A'}));
 add('xb','CN-SH:X','buy','10','10','2026-01-12T06:00:00Z');add('xs','CN-SH:X','sell','10','25','2026-01-14T06:00:00Z');add('yb','CN-SH:Y','buy','1','70','2026-01-12T06:00:00Z');add('ub','US:U','buy','1','10','2026-01-12T15:00:00Z');
 const quote=(i:string,d:string,p:string,c:string)=>db.prepare("INSERT INTO daily_candles(instrument_id,date,adjustment_mode,open,high,low,close,currency,provider)VALUES(?,?,'raw',?,?,?,?,?,'yahoo')").run(i,d,p,p,p,p,c);
 quote('CN-SH:X','2026-01-12','20','CNY');quote('CN-SH:X','2026-01-13','20','CNY');quote('CN-SH:X','2026-01-14','25','CNY');quote('CN-SH:Y','2026-01-13','70','CNY');quote('US:U','2026-01-12','10','USD');quote('CN-SH:Y','2026-01-15','70','CNY');quote('US:U','2026-01-15','10','USD');quote('CN-SH:Y','2026-01-16','70','CNY');quote('US:U','2026-01-16','10','USD');
 const pairing=new BusinessPairingStore(db),scope={accountId:'A',instrumentId:'CN-SH:X'},v=pairing.inspectScope(scope);pairing.save({scope,expectedRevision:v.revision,expectedFingerprint:v.fingerprint,confirmedBy:'fixture',basis:'close',rounds:[{id:'round',closingExecutionIds:['xs'],pairings:[{openingExecutionId:'xb',closingExecutionId:'xs',quantity:'10'}]}]});
 const fx=(rate:number)=>replaceFxSnapshot(db,{version:1,baseCurrency:'CNY',rates:{CNY:1,HKD:1,USD:rate},source:{id:'frankfurter-ecb',label:'fixture',url:'https://example.com',attributionUrl:'https://example.com'},rateDate:'2026-01-15',fetchedAt:'2026-01-16T00:00:00Z',lastAttemptedAt:'2026-01-16T00:00:00Z',cacheStatus:'fresh'});
 fx(8);const first=buildOnce(path,'2026-01-17T03:00:00Z'),r=defaultFullRequest('2026-01-17');r.currentPeriod={preset:'custom',from:'2026-01-14',to:'2026-01-17'};r.holdings.sort='marketValue';r.holdings.direction='desc';
 const store=new FullHomeStore(db),old=store.read(r,first.release),x=old.contribution.rows.find(v=>v.code==='X')!;expect(x.realized.value).toBe('150.00');expect(x.unrealizedChange.value).toBe('-100.00');expect(x.net.value).toBe('50.00');expect(old.core.holdings.rows[0].code).toBe('U');
 r.contribution.localOpenOnly=true;const openOnly=store.read(r,first.release).contribution;
 expect(openOnly.rows.map(v=>v.code).sort()).toEqual(['U','Y']);expect(openOnly.net.value).toBe('0.00');expect(openOnly.markets.find(v=>v.market==='all')!.net.value).toBe('0.00');
 expect(openOnly.categories.find(v=>v.category==='long')).toMatchObject({net:{value:'0.00'},realized:{value:'0.00'},unrealizedChange:{value:'0.00'},count:2});
 expect(openOnly.coverage).toEqual(old.contribution.coverage);
 r.contribution.localOpenOnly=false;expect(store.read(r,first.release).contribution.categories.find(v=>v.category==='long')!.net.value).toBe('50.00');
 r.contribution.drillMarket='US';const drilled=store.read(r,first.release).contribution;expect(drilled.net.value).toBe('0.00');expect(drilled.categories.find(v=>v.category==='long')!.net.value).toBe('50.00');r.contribution.drillMarket='all';
 fx(6);const second=buildOnce(path,'2026-01-17T03:00:00Z');expect(store.read(r,second.release).core.holdings.rows[0].code).toBe('Y');expect(store.read(r,first.release).core.holdings.rows[0].code).toBe('U');expect(store.export(r,first.release).split('\n')[1]).toContain('TenUSD');expect(store.export(r,second.release).split('\n')[1]).toContain('Seventy');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
},60000);

it('conserves round cents, reads real asset metadata, scopes review absence and rejects malformed full candidates',()=>{
 const {dir,path,db}=setup();try{
 const metadata=JSON.stringify({market:'CN-SH',symbol:'X',name:'Cents',assetType:'stock',source:'statement',confidence:'statement',resolvedAt:'2026-01-01T00:00:00Z'});
 db.prepare("INSERT INTO instruments(id,symbol,name,market,currency,metadata_json)VALUES('CN-SH:X','X','Cents','CN-SH','CNY',?)").run(metadata);
 const add=(id:string,side:string,q:string,p:string,fee:string,day:string)=>db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,'CN-SH:X','A',side,day+'T06:00:00Z',q,p,fee,'live',JSON.stringify({source:{platform:'fixture'},accountLabel:'A'}));
 add('buy','buy','2','1','0.01','2026-01-12');add('sell1','sell','1','2.004','0','2026-01-13');add('sell2','sell','1','2.004','0','2026-01-14');
 const pairing=new BusinessPairingStore(db),scope={accountId:'A',instrumentId:'CN-SH:X'},v=pairing.inspectScope(scope);pairing.save({scope,expectedRevision:v.revision,expectedFingerprint:v.fingerprint,confirmedBy:'fixture',basis:'two explicit closes',rounds:['sell1','sell2'].map(id=>({id,closingExecutionIds:[id],pairings:[{openingExecutionId:'buy',closingExecutionId:id,quantity:'1'}]}))});
 db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:OTHER','OTHER','Other','US','USD')");
 db.prepare('INSERT INTO reviews(episode_id,instrument_id,review_json,updated_at)VALUES(?,?,?,?)').run('unrelated','US:OTHER',JSON.stringify({episodeId:'unrelated',instrumentId:'US:OTHER',review:{completed:true}}),'2026-01-15T00:00:00Z');
 const built=buildOnce(path,'2026-01-17T03:00:00Z'),store=new FullHomeStore(db),r=defaultFullRequest('2026-01-17');r.selection.assetTypes=['stock'];r.selection.review='pending';r.historyRange={fromYear:2026,toYear:2026};
 const view=store.read(r,built.release);expect(view.history.coverage.confirmedClosedCount).toBe(2);expect(view.history.fees.value).toBe('0.01');expect(view.capabilities.assetTypes).toBe(true);
 const detail=store.detail(built.release,{kind:'instrument',id:'CN-SH:X',accountScope:['A'],sourceContext:'test'});expect(detail.rounds.map(r=>r.fees[0].value)).toEqual(['0.01','0.00']);expect(detail.rounds[0].net.value).toBe('0.99');expect(detail.rounds[1].gross.value).toBe('1.01');
 const original=JSON.parse(String(db.prepare("SELECT payload_json FROM home_full_module WHERE release_id=? AND kind='closeRounds'").get(built.release)!.payload_json)),duplicate=[...original,original[0]],manifest=JSON.parse(String(db.prepare('SELECT manifest_json FROM home_full_release WHERE release_id=?').get(built.release)!.manifest_json));manifest.modules.closeRounds.count=duplicate.length;manifest.modules.closeRounds.hash=manifest.versions?.storageHash==='sha256-json-utf8-v1'?createHash('sha256').update(JSON.stringify(duplicate)).digest('hex'):fullHash(duplicate);db.prepare("UPDATE home_full_module SET payload_json=? WHERE release_id=? AND kind='closeRounds'").run(JSON.stringify(duplicate),built.release);db.prepare('UPDATE home_full_release SET manifest_json=? WHERE release_id=?').run(JSON.stringify(manifest),built.release);expect(()=>store.read(r,built.release)).toThrow('invalid close round identity');
 db.prepare('DELETE FROM home_full_release WHERE release_id=?').run(built.release);expect(()=>new HomeStore(db).publish(built.release,built.release)).toThrow('required full manifest missing');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
},60000);

it('publishes financial closes independently of business round confirmation and allocates only closed fees',()=>{
 const {dir,path,db}=setup();try{
 db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('CN-SH:F','F','Financial','CN-SH','CNY')");
 const add=(id:string,side:string,q:string,p:string,fee:string,day:string)=>db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,'CN-SH:F','A',side,day+'T06:00:00Z',q,p,fee,'live',JSON.stringify({source:{platform:'fixture'},accountLabel:'A'}));
 add('open','buy','100','10','2','2025-12-29');add('partial','sell','40','12','1','2026-01-05');
 const built=buildOnce(path,'2026-02-17T03:00:00Z'),store=new FullHomeStore(db),r=defaultFullRequest('2026-02-17');r.historyRange={fromYear:2026,toYear:2026};
 const v=store.read(r,built.release);expect(v.history.coverage.confirmedClosedCount).toBe(0);expect(v.history.coverage.closedCount).toBeNull();
 // 40*(12-10) - 2*(40/100) - 1 = 78.2; entry fee for 60 open shares is excluded.
 const queriesBefore=Number(db.prepare('SELECT count(*) n FROM home_full_query').get()!.n);expect(store.publishFinancialPartitions(built.release,[r]).count).toBe(1);expect(Number(db.prepare('SELECT count(*) n FROM home_full_query').get()!.n)).toBe(queriesBefore);
 db.exec('DELETE FROM home_full_query');expect(store.read(r,built.release).history).toEqual(v.history);
 expect(v.history.net.value).toBe('78.20');expect(v.history.fees.value).toBe('1.80');expect(v.history.buckets[0]).toMatchObject({net:{value:'78.20'},fees:{value:'1.80'},cumulativeNet:{value:'78.20'}});
 expect(v.history.buckets[1].net).toMatchObject({value:null,reasons:['no-closed-transactions']});expect(v.history.buckets[1].cumulativeNet.value).toBe('78.20');
 r.contribution.mode='historical';expect(store.read(r,built.release).contribution.rows[0]).toMatchObject({net:{value:'78.20'},fees:{value:'1.80'},roundCount:0});
 r.historyRange={fromYear:2025,toYear:2026};expect(store.read(r,built.release).history.years[1].net.value).toBe('78.20');
 const full=validateFull(db,built.release)!;
 const legacy=store['objects'](full,new Set(full.modules.catalog.map(c=>c.positionKey)));
 for(const object of legacy)for(const day of [object.current,...object.boundaries])for(const b of Object.values(day.buckets)){delete b.closedFees;delete b.closedFeesMissing;delete b.closedTransactions;}
 expect(store['historicalFinancial'](full,legacy,'2026-01-01','2026-01-31',false)).toMatchObject({net:{value:'78.20'},fees:{value:null,reasons:['closed-fees-not-published']}});
 expect(store['historicalFinancial'](full,legacy,'2026-02-01','2026-02-17',false).net).toMatchObject({value:null,reasons:['closed-transactions-not-published']});

 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
},60000);
it('rounds financial history only after aggregating securities and computes cumulative directly from native prefixes',()=>{
 const {dir,path,db}=setup();try{
 for(const code of ['A','B']){
 db.prepare('INSERT INTO instruments(id,symbol,name,market,currency)VALUES(?,?,?,?,?)').run('CN-SH:'+code,code,code,'CN-SH','CNY');
 for(const [suffix,side,price,day] of [['b','buy','1','2026-01-02'],['s','sell','1.004',code==='A'?'2026-01-05':'2026-02-05']])db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(code+suffix,'CN-SH:'+code,'A',side,day+'T06:00:00Z','1',price,'0','live',JSON.stringify({source:{platform:'fixture'},accountLabel:'A'}));
 }
 const built=buildOnce(path,'2026-03-17T03:00:00Z'),r=defaultFullRequest('2026-03-17');r.historyRange={fromYear:2026,toYear:2026};const h=new FullHomeStore(db).read(r,built.release).history;
 expect(h.net.value).toBe('0.01');expect(h.buckets[0].net.value).toBe('0.00');expect(h.buckets[1].net.value).toBe('0.00');expect(h.buckets[1].cumulativeNet.value).toBe('0.01');expect(h.years[0].net.value).toBe('0.01');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
},60000);
it('publishes fee-only market membership for daily, ranged and unknown-amount evidence without inferring unassigned markets',()=>{
 const {dir,db}=setup();try{
  const source=readSourceSnapshot(db,'2026-02-08T03:00:00Z');
  source.monthly.push({documentId:'fee-proof',templateIds:[],positions:[],reviewRequired:false,events:[
   {id:'day',accountId:'daily',market:'HK',date:'2026-01-02',kind:'fee',amount:'-2',currency:'HKD',description:'fee',source:[]},
   {id:'month',accountId:'monthly',market:'US',date:'2026-01',kind:'fee',amount:'-3',currency:'USD',description:'fee',source:[]},
   {id:'unknown-value',accountId:'unknown-value',market:'CN-SH',date:'2026-01-02',kind:'fee',description:'fee',source:[]},
   {id:'unknown-market',accountId:'unassigned',date:'2026-01-02',kind:'fee',amount:'-1',currency:'USD',description:'fee',source:[]},
  ]});
  const core=buildRelease(source,'fee-directory'),pairing=new BusinessPairingStore(db);
  const full=buildFullRelease(source,core,{inspections:pairing.readFullInspections(source),financial:pairing.readAll(source)});
  expect(full.manifest.accountIdsByMarket).toEqual({CN:['unknown-value'],HK:['daily'],US:['monthly']});
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
