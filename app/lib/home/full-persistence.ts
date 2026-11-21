import {metricObjectVersion} from './metric-objects';
import {createHash} from 'node:crypto';
import {encodeSourceEvidence,isStrictExecutionRef,sourceEvidenceDecoder} from './full-source-evidence';
import type {ExecutionContentRef} from './execution-content-ref';
import {decimal} from './period';
import type {DatabaseSync} from 'node:sqlite';
import {FULL_MODULES,FULL_SCHEMA,type FullManifestV1} from './full-contracts';
import {fullCanonical,fullHash,type FullBuild,type FullModules} from './full-projection';
import {HOME_FULL_SCHEMA} from '../../../db/home-full-schema';
import {HOME_POLICY} from './contracts';
const persistedJsonHash=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
export function stageFull(db:DatabaseSync,full:FullBuild){
 db.exec(HOME_FULL_SCHEMA);
 const {manifest,modules}=full;
 manifest.scopeRefs=db.prepare('SELECT scope_id,scope_version FROM home_release_scope WHERE release_id=? ORDER BY scope_id').all(manifest.releaseId).map(r=>({id:String(r.scope_id),version:String(r.scope_version)}));
 manifest.versions={native:HOME_POLICY,closeRound:'confirmed-long-round-v1',allocation:'source-partition-metrics-v4',effectiveReview:'effective-completion-v1',catalog:'catalog-v1',query:'full-home-query-v1'};
 manifest.marketCutoffs=Object.assign({},...db.prepare('SELECT metadata_json FROM home_scope_result s JOIN home_release_scope r USING(scope_version) WHERE r.release_id=?').all(manifest.releaseId).map(r=>JSON.parse(String(r.metadata_json)).marketCutoffs??{}));
 if(manifest.schema!==FULL_SCHEMA||!manifest.moduleComplete)throw new Error('invalid full manifest');
 for(const key of FULL_MODULES){const ref=manifest.modules[key],rows=modules[key];if(!ref?.complete||!Array.isArray(rows)||rows.length!==ref.count||fullHash(rows)!==ref.hash)throw new Error('incomplete full module '+key);}
 const stored=encodeSourceEvidence(modules),evidenceJson=JSON.stringify(stored.refs),payloads=Object.fromEntries(FULL_MODULES.map(key=>[key,JSON.stringify(stored.modules[key])]));
 manifest.modules.sourceEvidence={hash:persistedJsonHash(evidenceJson),count:stored.refs.length,version:'1',complete:true};
 manifest.versions.sourceEvidence='source-ref-dictionary-v1';manifest.versions.storageHash='sha256-json-utf8-v1';
 for(const key of FULL_MODULES)manifest.modules[key]={...manifest.modules[key],version:'2',hash:persistedJsonHash(payloads[key])};
 db.exec('BEGIN IMMEDIATE');try{
 db.prepare('INSERT INTO home_full_release VALUES(?,?,?)').run(manifest.releaseId,JSON.stringify(manifest),Date.now());
 const insert=db.prepare('INSERT INTO home_full_module VALUES(?,?,?)');for(const key of FULL_MODULES)insert.run(manifest.releaseId,key,payloads[key]);insert.run(manifest.releaseId,'sourceEvidence',evidenceJson);
 db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
type ValidationInputs={manifest:string;modules:[string,string][];release:string;scopes:string;trades:Record<string,unknown>[]};
type ValidatedRelease={inputs:ValidationInputs;full:FullBuild;revision:string|null};
/** SQLite counts local writes separately from commits on other connections.
 * A transaction may roll back its validated bytes, so it never supplies a reusable revision. */
function validationRevision(db:DatabaseSync):string|null{
 if(db.isTransaction)return null;
 const row=db.prepare('SELECT total_changes() AS local, data_version AS external, schema_version AS schema FROM pragma_data_version, pragma_schema_version').get()!;
 return [row.local,row.external,row.schema].join('/');
}
const validatedByConnection=new WeakMap<DatabaseSync,Map<string,ValidatedRelease>>();
// The WITHOUT ROWID primary key groups complete trade payloads by ordinal.
// execution_id ordering instead walks the secondary unique index and fetches
// every payload separately; validation's identity maps do not need that order.
function persistedTrades(db:DatabaseSync,tradeSets:string[]){return db.prepare('SELECT s.trade_set_id,s.position_key,s.trade_count,t.execution_id,t.trade_json FROM home_trade_set s LEFT JOIN home_holding_trade t USING(trade_set_id) WHERE s.trade_set_id IN(SELECT value FROM json_each(?)) ORDER BY s.trade_set_id,t.ordinal').all(JSON.stringify(tradeSets));}
function sameTrades(a:Record<string,unknown>[],b:Record<string,unknown>[]){return a.length===b.length&&a.every((row,i)=>['trade_set_id','position_key','trade_count','execution_id','trade_json'].every(key=>row[key]===b[i][key]));}
function freezeValidated(value:unknown,seen=new WeakSet<object>()):void{if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);for(const child of Object.values(value))freezeValidated(child,seen);Object.freeze(value);}
/** Called under publication's writer transaction, again at read to reject corrupt/incomplete candidates. */
export function validateFull(db:DatabaseSync,id:string):FullBuild|null{
 const revision=validationRevision(db),cached=validatedByConnection.get(db)?.get(id);
 if(revision!==null&&cached?.revision===revision)return cached.full;
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='home_full_release'").get())return null;
 const row=db.prepare('SELECT manifest_json FROM home_full_release WHERE release_id=?').get(id);if(!row)return null;
 const manifestText=String(row.manifest_json),moduleRows=db.prepare('SELECT kind,payload_json FROM home_full_module WHERE release_id=? ORDER BY kind').all(id),moduleTexts=moduleRows.map(r=>[String(r.kind),String(r.payload_json)] as [string,string]);
 const release=db.prepare('SELECT source_sequence,computed_at,business_date FROM home_release WHERE release_id=?').get(id);
 const scopes=db.prepare('SELECT scope_id,scope_version FROM home_release_scope WHERE release_id=? ORDER BY scope_id').all(id).map(r=>({id:String(r.scope_id),version:String(r.scope_version)}));
 const releaseText=JSON.stringify(release),scopeText=JSON.stringify(scopes);
 let persisted:ReturnType<typeof persistedTrades>|undefined;
 // Trust only exact persisted inputs previously fully checked, never the id or
 // query-cache state. Every connection observes payload/member corruption here.
 if(cached&&cached.inputs.manifest===manifestText&&cached.inputs.release===releaseText&&cached.inputs.scopes===scopeText&&cached.inputs.modules.length===moduleTexts.length&&moduleTexts.every((entry,i)=>entry[0]===cached.inputs.modules[i][0]&&entry[1]===cached.inputs.modules[i][1])){
  persisted=persistedTrades(db,cached.full.modules.catalog.map(c=>c.tradeSetId));
  if(sameTrades(persisted,cached.inputs.trades)){
   cached.revision=revision!==null&&revision===validationRevision(db)?revision:null;
   return cached.full;
  }
 }
 const manifest=JSON.parse(manifestText) as FullManifestV1;
 if(manifest.schema!==FULL_SCHEMA||manifest.releaseId!==id||!manifest.moduleComplete||['core-v1',FULL_SCHEMA,'catalog-search-v1','fixed-release-detail-v1','global-open-membership-v1','effective-review-unknown-v1'].some(c=>!manifest.capabilities.includes(c))||manifest.fxVersion!==fullHash(manifest.fx))throw new Error('invalid full manifest');
 const byteHash=manifest.versions?.storageHash==='sha256-json-utf8-v1';if(manifest.versions?.storageHash!==undefined&&!byteHash)throw new Error('unsupported full storage hash');
 const modules={} as FullModules;
 let decoder:ReturnType<typeof sourceEvidenceDecoder>|undefined;
 if(manifest.modules.sourceEvidence){
  const ref=manifest.modules.sourceEvidence,evidenceRow=moduleRows.find(row=>row.kind==='sourceEvidence');if(!evidenceRow)throw new Error('missing full module sourceEvidence');
  const refs=JSON.parse(String(evidenceRow.payload_json)) as ExecutionContentRef[];
  if(!ref.complete||ref.version!=='1'||manifest.versions?.sourceEvidence!=='source-ref-dictionary-v1'||!Array.isArray(refs)||refs.length!==ref.count||(byteHash?persistedJsonHash(String(evidenceRow.payload_json)):fullHash(refs))!==ref.hash)throw new Error('invalid full module sourceEvidence');decoder=sourceEvidenceDecoder(refs);
 }
 for(const key of FULL_MODULES){const row=moduleRows.find(row=>row.kind===key);if(!row)throw new Error('missing full module '+key);const rows=JSON.parse(String(row.payload_json));const ref=manifest.modules[key];if(!ref?.complete||!['1','2'].includes(ref.version)||ref.version==='2'&&!decoder||!Array.isArray(rows)||rows.length!==ref.count||(byteHash&&ref.version==='2'?persistedJsonHash(String(row.payload_json)):fullHash(rows))!==ref.hash)throw new Error('invalid full module '+key);(modules[key] as unknown)=ref.version==='2'?decoder!.decode(rows):rows;}
 decoder?.assertComplete();
 if(!release||release.source_sequence!==manifest.sourceSequence||release.computed_at!==manifest.asOf||release.business_date!==manifest.businessDate)throw new Error('full core watermark mismatch');
 if(!manifest.scopeRefs||fullHash(scopes)!==fullHash(manifest.scopeRefs)||manifest.versions?.query!=='full-home-query-v1')throw new Error('invalid full scope refs or versions');
 const coveredScopes=new Set(modules.coverage.map(c=>JSON.stringify([c.accountId,c.instrumentId])));
 const identities=new Set<string>(),catalogByScope=new Map(modules.catalog.map(c=>[JSON.stringify([c.accountId,c.instrumentId]),c]));
 const tradesBySet=new Map<string,{positionKey:string;expected:number;trades:Map<string,{quantity:string;side:string;sourceRef:unknown}>}>();
 persisted=persistedTrades(db,modules.catalog.map(c=>c.tradeSetId));
 for(const row of persisted){const key=String(row.trade_set_id);let set=tradesBySet.get(key);if(!set){set={positionKey:String(row.position_key),expected:Number(row.trade_count),trades:new Map()};tradesBySet.set(key,set);}if(row.trade_json)set.trades.set(String(row.execution_id),JSON.parse(String(row.trade_json)));}
 // Four primitive fields preserve exact canonical identity without allocation;
 // generic/legacy refs retain the complete canonical comparison and memo.
 const referenceIdentities=new WeakMap<object,string>();
 const referenceIdentity=(value:unknown):string=>{if(!value||typeof value!=='object')return fullCanonical(value);let identity=referenceIdentities.get(value);if(identity===undefined){identity=fullCanonical(value);referenceIdentities.set(value,identity);}return identity;};
 const sameReference=(a:unknown,b:unknown):boolean=>isStrictExecutionRef(a)&&isStrictExecutionRef(b)?a.schemaVersion===b.schemaVersion&&a.executionId===b.executionId&&a.rawVersion===b.rawVersion&&a.effectiveVersion===b.effectiveVersion:referenceIdentity(a)===referenceIdentity(b);
 const allocationsByScope=new Map<string,FullModules['allocations'][number]>();
 for(const allocation of modules.allocations){
  if(identities.has(allocation.positionKey))throw new Error('duplicate allocation identity');identities.add(allocation.positionKey);
  const scope=JSON.stringify([allocation.accountId,allocation.instrumentId]),item=catalogByScope.get(scope),trades=item?tradesBySet.get(item.tradeSetId)?.trades:undefined;
  if(!item||item.positionKey!==allocation.positionKey||allocationsByScope.has(scope))throw new Error('allocation scope mismatch');allocationsByScope.set(scope,allocation);
  const refs=new Map(allocation.sourceRefs.map(r=>[r.executionId,r]));if(refs.size!==allocation.sourceRefs.length)throw new Error('duplicate allocation source reference');const seen=new Set<string>();
  for(const part of allocation.parts??[]){
   const trade=trades?.get(part.sourceRef?.executionId);
   if(!part.sourceRef||!refs.has(part.sourceRef.executionId)||seen.has(part.sourceRef.executionId)||!sameReference(refs.get(part.sourceRef.executionId),part.sourceRef)||!trade||!sameReference(trade.sourceRef,part.sourceRef)||!decimal(part.quantity).gt(0)||!decimal(part.quantity).eq(trade.quantity)||part.fee!==null&&decimal(part.fee).lt(0))throw new Error('invalid full allocation part');
   seen.add(part.sourceRef.executionId);if((allocation.category==='long'&&part.role!==(trade.side==='买入'?'open-long':'close-long'))||(allocation.category==='short'&&part.role!==(trade.side==='卖出'?'open-short':'close-short')))throw new Error('missing direction allocation proof');
  }
  if(allocation.category&&seen.size!==trades?.size)throw new Error('incomplete direction allocation');
  if(allocation.categoryMetrics){
   if(manifest.versions?.allocation!=='source-partition-metrics-v4'||allocation.category!==null||allocation.categoryMetrics.length<2||new Set(allocation.categoryMetrics.map(m=>m.category)).size!==allocation.categoryMetrics.length)throw new Error('invalid category metrics');
   const members=new Set<string>();
   for(const {category,executionIds,metric} of allocation.categoryMetrics){
    if(!['long','short','ipo'].includes(category)||metric.positionKey!==allocation.positionKey||!metric.boundaries.length||metric.firstDay!==metric.boundaries[0].date||metric.lastDay!==metric.current.date)throw new Error('invalid category metric identity');
    const {version,...content}=metric;if(metricObjectVersion(content)!==version)throw new Error('invalid category metric hash');
    for(const id of executionIds){if(!seen.has(id)||members.has(id))throw new Error('invalid category metric membership');members.add(id);}
   }
   if(members.size!==seen.size||seen.size!==trades?.size)throw new Error('incomplete category metric membership');
  }

 }
 if(new Set(modules.catalog.map(c=>c.id)).size!==modules.catalog.length||catalogByScope.size!==modules.catalog.length)throw new Error('duplicate full catalog identity');
 for(const item of modules.catalog){const position=JSON.parse(item.positionKey);if(!Array.isArray(position)||position[0]!==item.accountId||position[1]!==item.instrumentId||position[2]!=='live')throw new Error('catalog scope identity mismatch');const set=tradesBySet.get(item.tradeSetId);if(item.id!==item.positionKey||!identities.has(item.positionKey)||!coveredScopes.has(JSON.stringify([item.accountId,item.instrumentId])))throw new Error('incomplete catalog coverage');if(!set||set.positionKey!==item.positionKey||set.expected!==set.trades.size)throw new Error('full catalog reference missing');}
 const roundIds=new Set<string>(),closingIds=new Set<string>(),pairedOpen=new Map<string,ReturnType<typeof decimal>>();
 for(const round of modules.closeRounds){
  const scope=JSON.stringify([round.accountId,round.instrumentId]),allocation=allocationsByScope.get(scope),item=catalogByScope.get(scope);
  if(roundIds.has(round.id)||!item||!allocation||round.id!==JSON.stringify([round.accountId,round.instrumentId,round.revision,round.roundId])||round.category!==allocation.category)throw new Error('invalid close round identity');roundIds.add(round.id);
  const parts=new Map((allocation.parts??[]).map(p=>[p.sourceRef.executionId,p]));const refs=new Map(round.sourceRefs.map(r=>[r.executionId,r]));
  if(refs.size!==round.sourceRefs.length||!round.closingExecutionIds.length||new Set(round.closingExecutionIds).size!==round.closingExecutionIds.length)throw new Error('invalid round source references');
  for(const ref of refs.values())if(!parts.has(ref.executionId)||!sameReference(parts.get(ref.executionId)!.sourceRef,ref))throw new Error('dangling round source reference');
  for(const id of round.closingExecutionIds){const part=parts.get(id),key=JSON.stringify([scope,id]);if(closingIds.has(key)||!part||part.role!=='close-long'||!refs.has(id))throw new Error('duplicate or invalid round close');closingIds.add(key);const sum=round.pairings.filter(p=>p.closingExecutionId===id).reduce((v,p)=>v.plus(p.quantity),decimal('0'));if(!sum.eq(part.quantity))throw new Error('round closing quantity not conserved');}
  for(const pair of round.pairings){const open=parts.get(pair.openingExecutionId);if(!open||open.role!=='open-long'||!round.closingExecutionIds.includes(pair.closingExecutionId)||!refs.has(pair.openingExecutionId)||!decimal(pair.quantity).gt(0))throw new Error('invalid round pairing');const key=JSON.stringify([scope,pair.openingExecutionId]),used=(pairedOpen.get(key)??decimal('0')).plus(pair.quantity);if(used.gt(open.quantity))throw new Error('round opening quantity overallocated');pairedOpen.set(key,used);}
  if(round.gross.value!==null&&round.net.value!==null&&round.fees.every(f=>f.value!==null&&f.currency===round.net.currency)&&!round.fees.reduce((v,f)=>v.minus(f.value!),decimal(round.gross.value)).eq(round.net.value))throw new Error('round money not conserved');
 }
 if(modules.effectiveReview.length!==modules.catalog.length||new Set(modules.effectiveReview.map(r=>r.positionKey)).size!==modules.catalog.length||modules.effectiveReview.some(r=>!identities.has(r.positionKey)))throw new Error('invalid effective review identities');
 const full={manifest,modules};freezeValidated(full);
 let releases=validatedByConnection.get(db);if(!releases){releases=new Map();validatedByConnection.set(db,releases);}if(releases.size>=2&&!releases.has(id))releases.delete(releases.keys().next().value!);
 releases.set(id,{inputs:{manifest:manifestText,modules:moduleTexts,release:releaseText,scopes:scopeText,trades:persisted},full,revision:revision!==null&&revision===validationRevision(db)?revision:null});
 return full;
}
