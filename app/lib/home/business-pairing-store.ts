import {ATOMIC_EXECUTION_GROUP_POLICY,NONINTERLEAVED_EXECUTION_GROUP_POLICY,validateNonInterleavedExecutionGroups} from './atomic-execution-group';
import {createHash} from 'node:crypto';
import {buildInterleavedAccountingDiagnostic,buildInterleavedPairingDiagnostic,INTERLEAVED_PAIRING_POLICY,type InterleavedAccountingInput,type InterleavedAccountingDiagnostic} from './interleaved-accounting-diagnostic';
import {buildInterleavedRoundFinancialDiagnostic} from './interleaved-round-financial';
import {buildAccountingFeeDiagnostic} from './accounting-fee-diagnostic';
import {buildAccountingPnlDiagnostic} from './accounting-pnl-diagnostic';
import {buildCrossZeroMoneyDiagnostic,type CrossZeroMoneyDiagnostic} from './cross-zero-money-diagnostic';
import {buildCrossZeroCostDiagnostic,type CrossZeroCostDiagnostic} from './cross-zero-cost-diagnostic';
import type {DatabaseSync} from 'node:sqlite';
import {canonicalInstrumentId} from '../instruments/display-name';
import type {TradeExecution} from '../trades/types';
import {readSourceSnapshot,type SourceSnapshot} from './source';
import {executionContentVersion,type ExecutionContentRef} from './execution-content-ref';
import {diagnoseCrossZeroQuantity,type CrossZeroQuantityResult} from './cross-zero-quantity';
import {validateLongPairingOrder} from './long-pairing-order';
import {validateBusinessCloseSources,type BusinessCloseInput} from './business-close-sources';

export type CrossZeroDiagnostic={policy:'source-cross-zero-quantity-v1';scope:PairingScope;sourceSequence:number;fingerprint:string;refs:ExecutionContentRef[];status:'candidate'|'not-applicable'|'blocked';reasons:string[];crossing:(NonNullable<CrossZeroQuantityResult['crossing']>&{contentRef:ExecutionContentRef})|null;startingInventory:'assumed-zero';financialAllocation:'not-implemented';universeComplete:false};
export type PairingScope={accountId:string;instrumentId:string};
export type PairingRound={id:string;closingExecutionIds:string[];pairings:{openingExecutionId:string;closingExecutionId:string;quantity:string}[]};
export type SavePairingCommand={scope:PairingScope;expectedRevision:number;expectedFingerprint:string;confirmedBy:string;basis:string;rounds:PairingRound[]};
export type PairingFact={schemaVersion:1;policy:'ordinary-live-long-lifo-v1'|typeof INTERLEAVED_PAIRING_POLICY;scope:PairingScope;revision:number;fingerprint:string;refs:ExecutionContentRef[];dependencies:unknown;rounds:PairingRound[];confirmedBy:string;basis:string;recordedAt:string;consumedSourceSequence:number;commitSequence:number};
export type PairingStatus='current'|'stale'|'unsupported'|'empty'|'snapshot-behind';
export type PairingInspection={scope:PairingScope;revision:number;fingerprint:string;refs:ExecutionContentRef[];fact:PairingFact|null;status:PairingStatus;reasons:string[];sourceSequence:number};
export class BusinessPairingError extends Error {
 constructor(public readonly code:'invalid-command'|'source-conflict'|'revision-conflict'|'unsupported'|'invalid-pairing',message:string){super(message);this.name='BusinessPairingError';}
}
const key=(s:PairingScope)=>JSON.stringify([s.accountId,s.instrumentId]);
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
function shape(v:unknown,keys:string[]):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
function scopeCheck(s:unknown):asserts s is PairingScope{
 if(!shape(s,['accountId','instrumentId'])||!text(s.accountId)||!text(s.instrumentId)||s.accountId==='all'||s.instrumentId==='all')throw new BusinessPairingError('invalid-command','Invalid exact account/instrument scope');
}
function commandCheck(c:SavePairingCommand){
 scopeCheck(c?.scope);
 if(!shape(c,['scope','expectedRevision','expectedFingerprint','confirmedBy','basis','rounds'])||!Number.isSafeInteger(c.expectedRevision)||c.expectedRevision<0||!text(c.expectedFingerprint)||!text(c.confirmedBy)||!text(c.basis)||!Array.isArray(c.rounds))throw new BusinessPairingError('invalid-command','Invalid command or confirmation metadata');
 const rounds=new Set<string>(),closes=new Set<string>();
 for(const r of c.rounds){
  if(!shape(r,['id','closingExecutionIds','pairings'])||!text(r.id)||rounds.has(r.id)||!Array.isArray(r.closingExecutionIds)||!r.closingExecutionIds.length||!Array.isArray(r.pairings))throw new BusinessPairingError('invalid-command','Invalid round');
  rounds.add(r.id);
  for(const id of r.closingExecutionIds){if(!text(id)||closes.has(id))throw new BusinessPairingError('invalid-command','Duplicate or invalid closing identity');closes.add(id);}
  for(const p of r.pairings)if(!shape(p,['openingExecutionId','closingExecutionId','quantity'])||!text(p.openingExecutionId)||!text(p.closingExecutionId)||!text(p.quantity)||!r.closingExecutionIds.includes(p.closingExecutionId))throw new BusinessPairingError('invalid-command','Invalid pairing');
 }
}
// Sorted object keys and sorted dependency members avoid input-order fingerprints.
function stable(v:unknown):string{
 if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
 if(v&&typeof v==='object')return '{'+Object.entries(v).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';
 return JSON.stringify(v);
}
const sorted=<T,>(items:T[])=>items.sort((a,b)=>stable(a).localeCompare(stable(b)));
type ScopedSource={executions:TradeExecution[];refs:ExecutionContentRef[];unknown:NonNullable<SourceSnapshot['unclassified']>;monthly:unknown[]};
function grouped(source:SourceSnapshot){
 const groups=new Map<string,ScopedSource>();
 const get=(s:PairingScope)=>{const k=key(s);let g=groups.get(k);if(!g){g={executions:[],refs:[],unknown:[],monthly:[]};groups.set(k,g);}return g;};
 const refs=new Map(source.executionRefs?.map(r=>[r.executionId,r]));
 for(const e of source.executions){const g=get({accountId:e.accountId,instrumentId:e.instrument.id});g.executions.push(e);const r=refs.get(e.id);if(r)g.refs.push(r);}
 for(const u of source.unclassified??[])get(u).unknown.push(u);
 // A monthly row without an instrument identity may affect every saved scope on its account.
 const ambiguous: {accountId?:string;value:unknown}[]=[];
 // Persisted execution IDs may predate canonical instrument IDs. Monthly rows
 // resolve by actual instrument metadata and affect every alias, not one winner.
 const actualByCanonical=new Map<string,Set<string>>();
 for(const instrument of source.instruments){
  const canonical=canonicalInstrumentId(instrument.symbol,instrument.market);
  let ids=actualByCanonical.get(canonical);if(!ids){ids=new Set();actualByCanonical.set(canonical,ids);}ids.add(instrument.id);
 }
 for(const m of source.monthly){
  const byScope=new Map<string,{scope:PairingScope;positions:typeof m.positions;events:typeof m.events}>();
  const row=(p:{accountId:string;market?:string;symbol?:string})=>{
   if(!p.market||!p.symbol)return null;
   const scope={accountId:p.accountId,instrumentId:canonicalInstrumentId(p.symbol,p.market)},k=key(scope);
   let group=byScope.get(k);if(!group){group={scope,positions:[],events:[]};byScope.set(k,group);}return group;
  };
  for(const p of m.positions){const g=row(p);if(g)g.positions.push(p);else ambiguous.push({accountId:p.accountId,value:{documentId:m.documentId,position:p}});}
  for(const e of m.events){const g=row(e);if(g)g.events.push(e);else ambiguous.push({accountId:e.accountId,value:{documentId:m.documentId,event:e}});}
  for(const g of byScope.values()){
   const actualIds=actualByCanonical.get(g.scope.instrumentId)??new Set([g.scope.instrumentId]);
   for(const instrumentId of actualIds)get({...g.scope,instrumentId}).monthly.push({...m,positions:sorted(g.positions),events:sorted(g.events)});
  }
  if(m.historyIncomplete||m.incompleteInstruments?.length)ambiguous.push({accountId:m.accountId,value:m});
 }
 const refsById=new Map<string,ExecutionContentRef[]>(),idCounts=new Map<string,number>();
 for(const ref of source.executionRefs??[]){const rows=refsById.get(ref.executionId)??[];rows.push(ref);refsById.set(ref.executionId,rows);}
 for(const e of source.executions)idCounts.set(e.id,(idCounts.get(e.id)??0)+1);
 const monthlyByAccount=new Map<string,unknown[]>(),globalMonthly:unknown[]=[];
 for(const row of ambiguous){
  if(!row.accountId){globalMonthly.push(row.value);continue;}
  const rows=monthlyByAccount.get(row.accountId)??[];rows.push(row.value);monthlyByAccount.set(row.accountId,rows);
 }
 return {groups,ambiguous,refsById,idCounts,monthlyByAccount,globalMonthly,sourceSequence:source.sequence};
}
function interleavedInput(scope:PairingScope,g:ScopedSource,index:ReturnType<typeof grouped>):InterleavedAccountingInput {
 const ids=new Set(g.executions.map(e=>e.id)),refs=[...ids].flatMap(id=>index.refsById.get(id)??[]);
 const monthly=sorted([...g.monthly,...(index.monthlyByAccount.get(scope.accountId)??[]),...index.globalMonthly]);
 const sourceIssues:string[]=[];
 try{scopeCheck(scope);}catch{sourceIssues.push('invalid-scope');}
 if(g.unknown.length)sourceIssues.push('unknown-source');
 if(monthly.length)sourceIssues.push('monthly-inventory-or-event');
 if([...ids].some(id=>(index.idCounts.get(id)??0)>1))sourceIssues.push('duplicate-execution-id');
 const sourceDependencyFingerprint=createHash('sha256').update(stable({unknown:sorted([...g.unknown]),monthly})).digest('hex');
 return {scope,sourceSequence:index.sourceSequence,refs,sourceIssues,sourceDependencyFingerprint};
}
function dependencies(scope:PairingScope,index:ReturnType<typeof grouped>){
 const g=index.groups.get(key(scope))??{executions:[],refs:[],unknown:[],monthly:[]};
 const monthly=sorted([...g.monthly,...(index.monthlyByAccount.get(scope.accountId)??[]),...index.globalMonthly]);
 const refs=sorted([...g.refs]);
 const proof=validateNonInterleavedExecutionGroups(g.executions);
 // A structurally valid chronological group rejected solely by overlap is the
 // only entry to the separately versioned fill policy. All older deps stay exact.
 if(!proof.valid&&proof.issues.length&&proof.issues.every(issue=>issue==='aggregated-fill-scope-overlap')){
  const input=interleavedInput(scope,g,index);
  const diagnostic=buildInterleavedPairingDiagnostic(input,g.executions,{confirmedClosingExecutionIds:[],pairings:[]});
  const deps={policy:INTERLEAVED_PAIRING_POLICY,scope,refs:diagnostic.refs,sourceProofFingerprint:diagnostic.sourceProofFingerprint};
  const fingerprint=createHash('sha256').update(stable(deps)).digest('hex');
  return {g,refs:diagnostic.refs,deps,fingerprint,reasons:diagnostic.status==='ready'?[]:['aggregated-fill-time-unsupported',...new Set([...proof.issues,...diagnostic.reasons])],interleavedInput:input};
 }
 const deps={policy:'ordinary-live-long-lifo-v1',scope,refs,unknown:sorted([...g.unknown]),monthly,...(g.executions.some(e=>e.source.executionGroup!==undefined)?(proof.hasMultiInstantGroup?{nonInterleavedExecutionGroupPolicy:NONINTERLEAVED_EXECUTION_GROUP_POLICY}:{atomicExecutionGroupPolicy:ATOMIC_EXECUTION_GROUP_POLICY}):{})};
 const fingerprint=createHash('sha256').update(stable(deps)).digest('hex');
 const reasons:string[]=[];
 if(g.unknown.length)reasons.push('unknown-source');
 if(monthly.length)reasons.push('monthly-inventory-or-event');
 if(g.refs.length!==g.executions.length)reasons.push('missing-content-ref');
 if(!proof.valid)reasons.push('aggregated-fill-time-unsupported',...proof.issues);
 for(const e of g.executions){const s=e.source;
  if(s.openingPosition||s.statementPositions?.length||s.positionEvents?.length||s.historyIncomplete?.length||s.tradingSession==='grey-market'||s.positionEffect?.includes('short')||(s.positionEffect&&s.positionEffect!==(e.side==='buy'?'open-long':'close-long')))reasons.push('unsupported-inventory-or-direction');
  if(s.timePrecision==='date-only'||s.sourceTimeKind==='date'||s.sourceTimeKind==='order'||s.timeEvidence==='inferred'||s.timeCandidates?.length)reasons.push('unproven-execution-time');
 }
 const order=validateLongPairingOrder({executions:g.executions.map(e=>({executionId:e.id,side:e.side,executedAt:e.executedAt,quantity:e.quantity})),confirmedClosingExecutionIds:[],pairings:[]});
 if(!order.valid)reasons.push(...order.issues.map(i=>'source-'+i.code));
 return {g,refs,deps,fingerprint,reasons:[...new Set(reasons)],interleavedInput:undefined};
}
// Called only after the existing validator has accepted every timestamp. Keep the
// complete fractional second: Date.parse alone collapses sub-millisecond order.
function crossZeroTime(value:string){
 const match=/^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/i.exec(value)!;
 return {second:Date.parse(match[1]+match[3]),fraction:(match[2]??'').replace(/0+$/,'')};
}
function crossZeroDiagnostic(scope:PairingScope,g:ScopedSource,index:ReturnType<typeof grouped>,source:SourceSnapshot,refsById:Map<string,ExecutionContentRef[]>,scopeIdsById:Map<string,Set<string>>):CrossZeroDiagnostic{
 const reasons:string[]=[];
 try{scopeCheck(scope);}catch{reasons.push('invalid-scope');}
 const monthly=sorted([...g.monthly,...index.ambiguous.filter(m=>!m.accountId||m.accountId===scope.accountId).map(m=>m.value)]);
 // Use the original multiset, never grouped().refs (whose ordinary legacy Map
 // intentionally remains unchanged). Invalid duplicate refs are hash members too.
 const ids=new Set(g.executions.map(e=>e.id));
 const refs=sorted([...ids].flatMap(id=>refsById.get(id)??[]));
 const deps={policy:'source-cross-zero-quantity-v1' as const,scope,refs,unknown:sorted([...g.unknown]),monthly};
 const fingerprint=createHash('sha256').update(stable(deps)).digest('hex');
 if(g.unknown.length)reasons.push('unknown-source');
 if(monthly.length)reasons.push('monthly-inventory-or-event');
 for(const e of g.executions){
  const matches=refsById.get(e.id)??[];
  if(!matches.length)reasons.push('missing-content-ref');
  else if(matches.length!==1)reasons.push('duplicate-content-ref');
  else {
   const ref=matches[0];
   if(ref.schemaVersion!==1||typeof ref.rawVersion!=='string'||!/^[a-f0-9]{64}$/.test(ref.rawVersion)||!text(ref.effectiveVersion)||ref.effectiveVersion!==executionContentVersion(e,'effective'))reasons.push('invalid-content-ref');
  }
  if((scopeIdsById.get(e.id)?.size??0)!==1)reasons.push('invalid-content-ref-scope');
  const s=e.source;
  if(s.executionGroup!==undefined)reasons.push('aggregated-fill-time-unsupported');
  if(s.openingPosition||s.statementPositions?.length||s.positionEvents?.length||s.historyIncomplete?.length||s.tradingSession==='grey-market'||s.positionEffect?.includes('short')||(s.positionEffect&&s.positionEffect!==(e.side==='buy'?'open-long':'close-long')))reasons.push('unsupported-inventory-or-direction');
  if(s.timePrecision==='date-only'||s.sourceTimeKind==='date'||s.sourceTimeKind==='order'||s.timeEvidence==='inferred'||s.timeCandidates?.length)reasons.push('unproven-execution-time');
 }
 const order=validateLongPairingOrder({executions:g.executions.map(e=>({executionId:e.id,side:e.side,executedAt:e.executedAt,quantity:e.quantity})),confirmedClosingExecutionIds:[],pairings:[]});
 const orderErrors=order.issues.filter(i=>i.code!=='negative-inventory');
 reasons.push(...orderErrors.map(i=>'source-'+i.code));
 let quantity:CrossZeroQuantityResult={status:'unsupported',reasons:[],crossing:null};
 if(!orderErrors.length){
  const ordered=g.executions.map(execution=>({execution,time:crossZeroTime(execution.executedAt)})).sort((a,b)=>{
   if(a.time.second!==b.time.second)return a.time.second-b.time.second;
   const width=Math.max(a.time.fraction.length,b.time.fraction.length),x=a.time.fraction.padEnd(width,'0'),y=b.time.fraction.padEnd(width,'0');
   return x<y?-1:x>y?1:0;
  });
  quantity=diagnoseCrossZeroQuantity(ordered.map(({execution:e})=>({executionId:e.id,side:e.side,quantity:e.quantity})));
  if(quantity.status==='unsupported')reasons.push(...quantity.reasons);
 }
 // Only the independent whole-scope kernel's final crossing can explain the
 // ordinary validator's negative inventory; all other order issues still block.
 if(quantity.status!=='candidate')reasons.push(...order.issues.filter(i=>i.code==='negative-inventory').map(i=>'source-'+i.code));
 if(quantity.crossing&&g.executions.find(e=>e.id===quantity.crossing!.executionId)?.source.positionEffect==='close-long')reasons.push('explicit-close-long-crossing');
 const uniqueReasons=[...new Set(reasons)];
 const crossing=!uniqueReasons.length&&quantity.crossing?{...quantity.crossing,contentRef:refsById.get(quantity.crossing.executionId)![0]}:null;
 return {policy:deps.policy,scope,sourceSequence:source.sequence,fingerprint,refs,status:uniqueReasons.length?'blocked':quantity.status==='candidate'?'candidate':'not-applicable',reasons:uniqueReasons,crossing,startingInventory:'assumed-zero',financialAllocation:'not-implemented',universeComplete:false};
}
function rebuild(scope:PairingScope,rounds:PairingRound[],g:ScopedSource):BusinessCloseInput{
 const ids=new Set(rounds.flatMap(r=>[...r.closingExecutionIds,...r.pairings.flatMap(p=>[p.openingExecutionId,p.closingExecutionId])]));
 const refs=new Map(g.refs.map(r=>[r.executionId,r]));
 const sources=g.executions.filter(e=>ids.has(e.id)).map(e=>({executionId:e.id,version:stable(refs.get(e.id)),quantity:e.quantity,amounts:[],accountId:e.accountId,instrumentId:e.instrument.id,side:e.side,tradeNature:'live' as const}));
 const parts=sources.map(s=>({...s,partId:s.executionId,role:(s.side==='buy'?'open-long':'close-long') as 'open-long'|'close-long'}));
 const sourceRefs=(ids:string[])=>ids.map(executionId=>({executionId,version:sources.find(s=>s.executionId===executionId)?.version??'missing'}));
 const evidence:BusinessCloseInput['evidence'][number][]=[],outRounds:BusinessCloseInput['rounds'][number][]=[],pairings:BusinessCloseInput['pairings'][number][]=[];
 for(const [i,r] of rounds.entries()){
  const id=`decision-${i}`,version='1';evidence.push({id,version,kind:'active-close',status:'confirmed',sourceRefs:sourceRefs(r.closingExecutionIds)});
  outRounds.push({id:r.id,version,...scope,direction:'long',closingPartIds:r.closingExecutionIds,decisionEvidenceId:id,decisionEvidenceVersion:version});
  for(const [j,p] of r.pairings.entries()){
   const id=`pair-${i}-${j}`;evidence.push({id,version,kind:'opening-pair',status:'confirmed',sourceRefs:sourceRefs([p.openingExecutionId,p.closingExecutionId])});
   pairings.push({id,version,roundId:r.id,openingPartId:p.openingExecutionId,closingPartId:p.closingExecutionId,quantity:p.quantity,evidenceId:id,evidenceVersion:version});
  }
 }
 return {sources,parts,evidence,rounds:outRounds,pairings};
}
/** Trusted internal command service. Metadata records provenance, not authentication. */
export class BusinessPairingStore{
 constructor(private readonly db:DatabaseSync){}
 readRevision(scope:PairingScope,revision:number):PairingFact|null{
  scopeCheck(scope);const row=this.db.prepare('SELECT fact_json FROM home_business_pairing_revision WHERE scope_key=? AND revision=?').get(key(scope),revision);
  return row?JSON.parse(String(row.fact_json)) as PairingFact:null;
 }
 private head(scope:PairingScope){return Number(this.db.prepare('SELECT revision FROM home_business_pairing_head WHERE scope_key=?').get(key(scope))?.revision??0);}
 private inspect(scope:PairingScope,source:SourceSnapshot,index:ReturnType<typeof grouped>):PairingInspection{
  const d=dependencies(scope,index),revision=this.head(scope),fact=revision?this.readRevision(scope,revision):null;
  let status:PairingStatus=fact?'current':'empty',reasons=d.reasons;
  if(fact&&fact.commitSequence>source.sequence){status='snapshot-behind';reasons=['snapshot-behind'];}
  else if(fact&&fact.fingerprint!==d.fingerprint){status='stale';reasons=['source-dependencies-changed',...reasons];}
  else if(reasons.length)status='unsupported';
  else if(!fact?.rounds.length)status='empty';
  return {scope,revision,fingerprint:d.fingerprint,refs:d.refs,fact,status,reasons,sourceSequence:source.sequence};
 }
 inspectScope(scope:PairingScope):PairingInspection{scopeCheck(scope);const source=readSourceSnapshot(this.db);return this.inspect(scope,source,grouped(source));}
 /** Source rows and confirmation head are observed in one read transaction. */
 readScopeSource(scope:PairingScope):{inspection:PairingInspection;executions:TradeExecution[]}{
  scopeCheck(scope);
  let result!:{inspection:PairingInspection;executions:TradeExecution[]};
  readSourceSnapshot(this.db,new Date().toISOString(),source=>{
   const index=grouped(source);
   result={inspection:this.inspect(scope,source,index),executions:index.groups.get(key(scope))?.executions??[]};
  });
  return result;
 }
 readInterleavedAccountingDiagnostics(source:SourceSnapshot):InterleavedAccountingDiagnostic[]{
  const index=grouped(source);
  return [...index.groups].sort(([a],[b])=>a.localeCompare(b)).map(([scopeKey,g])=>{
   const [accountId,instrumentId]=JSON.parse(scopeKey) as [string,string];
   return buildInterleavedAccountingDiagnostic(interleavedInput({accountId,instrumentId},g,index),g.executions);
  });
 }

 readCrossZeroDiagnostics(source:SourceSnapshot):CrossZeroDiagnostic[]{
  return this.crossZeroDiagnostics(source,grouped(source));
 }
 private crossZeroDiagnostics(source:SourceSnapshot,index:ReturnType<typeof grouped>):CrossZeroDiagnostic[]{
  const refsById=new Map<string,ExecutionContentRef[]>(),scopeIdsById=new Map<string,Set<string>>();
  for(const ref of source.executionRefs??[]){const refs=refsById.get(ref.executionId)??[];refs.push(ref);refsById.set(ref.executionId,refs);}
  for(const [scopeKey,g] of index.groups)for(const e of g.executions){const scopes=scopeIdsById.get(e.id)??new Set<string>();scopes.add(scopeKey);scopeIdsById.set(e.id,scopes);}
  return [...index.groups].sort(([a],[b])=>a.localeCompare(b)).map(([scopeKey,g])=>{
   const [accountId,instrumentId]=JSON.parse(scopeKey) as [string,string];
   return crossZeroDiagnostic({accountId,instrumentId},g,index,source,refsById,scopeIdsById);
  });
 }
 readCrossZeroMoneyDiagnostics(source:SourceSnapshot):CrossZeroMoneyDiagnostic[]{
  const index=grouped(source);
  // The same complete scope index supplies both source eligibility and amounts;
  // saved heads never filter diagnostics, and no second source read is needed.
  return this.crossZeroDiagnostics(source,index).map(quantity=>buildCrossZeroMoneyDiagnostic(quantity,index.groups.get(key(quantity.scope))!.executions));
 }
 readCrossZeroCostDiagnostics(source:SourceSnapshot):CrossZeroCostDiagnostic[]{
  const index=grouped(source);
  return this.crossZeroDiagnostics(source,index).map(quantity=>buildCrossZeroCostDiagnostic(quantity,index.groups.get(key(quantity.scope))!.executions));
 }
 readFullInspections(source:SourceSnapshot):PairingInspection[]{
  const index=grouped(source),scopes=new Map([...index.groups.keys()].map(k=>{const [accountId,instrumentId]=JSON.parse(k);return [k,{accountId,instrumentId}];}));
  for(const row of this.db.prepare('SELECT account_id,instrument_id FROM home_business_pairing_head h JOIN home_business_pairing_revision r USING(scope_key,revision)').all()){const scope={accountId:String(row.account_id),instrumentId:String(row.instrument_id)};scopes.set(key(scope),scope);}
  return [...scopes.values()].map(scope=>this.inspect(scope,source,index));
 }
 readAll(source:SourceSnapshot){
  const index=grouped(source);
  return this.db.prepare('SELECT r.account_id,r.instrument_id FROM home_business_pairing_head h JOIN home_business_pairing_revision r USING(scope_key,revision) ORDER BY h.scope_key').all().map(row=>{
   const r=this.inspect({accountId:String(row.account_id),instrumentId:String(row.instrument_id)},source,index);
   const executions=index.groups.get(key(r.scope))?.executions??[];
   const financial=r.fact?.policy===INTERLEAVED_PAIRING_POLICY
    ?buildInterleavedRoundFinancialDiagnostic(r,executions,interleavedInput(r.scope,index.groups.get(key(r.scope))??{executions:[],refs:[],unknown:[],monthly:[]},index))
    :(()=>{const accountingFees=buildAccountingFeeDiagnostic(r,executions);return {accountingFees,accountingPnl:buildAccountingPnlDiagnostic(r,executions,accountingFees)};})();
   return {...financial,scope:r.scope,revision:r.revision,status:r.status,reasons:r.reasons,roundCount:r.fact?.rounds.length??null,sourceSequence:source.sequence,consumedSourceSequence:r.fact?.consumedSourceSequence,commitSequence:r.fact?.commitSequence};
  });
 }
 save(command:SavePairingCommand):PairingInspection{
  commandCheck(command);
  const source=readSourceSnapshot(this.db),index=grouped(source),d=dependencies(command.scope,index);
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const sequence=Number(this.db.prepare('SELECT coalesce(max(seq),0) n FROM home_source_change').get()!.n);
   if(sequence!==source.sequence)throw new BusinessPairingError('source-conflict','Source watermark changed; inspect again');
   if(this.head(command.scope)!==command.expectedRevision)throw new BusinessPairingError('revision-conflict','Confirmation revision changed');
   if(command.expectedFingerprint!==d.fingerprint)throw new BusinessPairingError('source-conflict','Observed scope fingerprint changed');
   if(command.rounds.length){
    if(d.reasons.length||!d.g.executions.length)throw new BusinessPairingError('unsupported',d.reasons.join(',')||'empty-source');
    const pairing={confirmedClosingExecutionIds:command.rounds.flatMap(r=>r.closingExecutionIds),pairings:command.rounds.flatMap(r=>r.pairings)};
    const fill=d.interleavedInput?buildInterleavedPairingDiagnostic(d.interleavedInput,d.g.executions,pairing):null;
    const order=fill?{valid:fill.status==='ready',issues:fill.reasons.map(code=>({code}))}:validateLongPairingOrder({executions:d.g.executions.map(e=>({executionId:e.id,side:e.side,executedAt:e.executedAt,quantity:e.quantity})),...pairing});
    const result=validateBusinessCloseSources(rebuild(command.scope,command.rounds,d.g));
    if(!order.valid||!result.valid)throw new BusinessPairingError('invalid-pairing',[...order.issues,...result.issues].map(i=>i.code).join(','));
   }
   const revision=command.expectedRevision+1,recordedAt=new Date().toISOString(),scopeKey=key(command.scope);
   const event=this.db.prepare("INSERT INTO home_source_change(entity_kind,entity_key,effective_from,committed_at,change_json)VALUES('business-pairing',?,'0001-01-01',?,?)").run(scopeKey,recordedAt,JSON.stringify({schemaVersion:1,action:'confirm-scope',scope:command.scope,beforeRevision:command.expectedRevision,afterRevision:revision,dependencyKinds:['pairing'],boundary:{kind:'conservative-full'}}));
   const commitSequence=Number(event.lastInsertRowid);
   const fact:PairingFact={schemaVersion:1,policy:d.interleavedInput?INTERLEAVED_PAIRING_POLICY:'ordinary-live-long-lifo-v1',scope:command.scope,revision,fingerprint:d.fingerprint,refs:d.refs,dependencies:d.deps,rounds:command.rounds,confirmedBy:command.confirmedBy,basis:command.basis,recordedAt,consumedSourceSequence:source.sequence,commitSequence};
   this.db.prepare('INSERT INTO home_business_pairing_revision VALUES(?,?,?,?,?,?,?,?)').run(scopeKey,revision,command.scope.accountId,command.scope.instrumentId,d.fingerprint,source.sequence,commitSequence,JSON.stringify(fact));
   if(command.expectedRevision===0)this.db.prepare('INSERT INTO home_business_pairing_head VALUES(?,?)').run(scopeKey,revision);
   else if(this.db.prepare('UPDATE home_business_pairing_head SET revision=? WHERE scope_key=? AND revision=?').run(revision,scopeKey,command.expectedRevision).changes!==1)throw new BusinessPairingError('revision-conflict','Confirmation head CAS failed');
   const result:PairingInspection={scope:command.scope,revision,fingerprint:d.fingerprint,refs:d.refs,fact:JSON.parse(JSON.stringify(fact)) as PairingFact,status:d.reasons.length?'unsupported':command.rounds.length?'current':'empty',reasons:d.reasons,sourceSequence:commitSequence};
   this.db.exec('COMMIT');
   return result;
  }catch(error){this.db.exec('ROLLBACK');throw error;}
 }
}
