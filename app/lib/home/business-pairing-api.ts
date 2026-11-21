import type {DatabaseSync} from 'node:sqlite';
import {BusinessPairingError,BusinessPairingStore,type PairingScope,type PairingRound} from './business-pairing-store';
import {ordinaryPairingCandidates,simplePairingFinancialPreviews} from './business-pairing-candidates';
import {HomeRefresh} from './refresh';
import type {TradeExecution} from '../trades/types';

const schema='home-pairing-v1',bodyLimit=131072;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const text=(v:unknown,max=500):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
function shape(v:unknown,keys:string[]):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
function scope(v:unknown):PairingScope{
 if(!shape(v,['accountId','instrumentId'])||!text(v.accountId)||!text(v.instrumentId)||v.accountId==='all'||v.instrumentId==='all')throw new BusinessPairingError('invalid-command','需要单一账户与证券范围');
 return {accountId:v.accountId,instrumentId:v.instrumentId};
}
function executionOrigin(e:TradeExecution){
 const s=e.source;
 const short=(v:unknown)=>typeof v==='string'?v.slice(0,500):undefined;
 return {platform:short(s.platform),fileName:typeof s.fileName==='string'?s.fileName.split(/[\\/]/).at(-1)?.slice(0,500):undefined,sheet:short(s.sheet),page:Number.isSafeInteger(s.page)?s.page:undefined,row:Number.isSafeInteger(s.row)?s.row:undefined,statementMonth:short(s.statementMonth),sourceTimestampText:short(s.sourceTimestampText),sourceTimezone:short(s.sourceTimezone),orderReference:short(s.executionGroup?.orderReference)};
}
async function body(request:Request){
 const reader=request.body?.getReader();if(!reader)throw new BusinessPairingError('invalid-command','缺少确认内容');
 let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>bodyLimit){await reader.cancel();return undefined;}chunks.push(next.value);}}finally{reader.releaseLock();}
 const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data)) as unknown;}catch{throw new BusinessPairingError('invalid-command','确认内容必须为有效 JSON');}
}

/** Exact-scope read and explicit human confirmation. Client allocations and
 * confirmation identity are deliberately absent from the public command. */
export async function pairingHttp(db:DatabaseSync,request:Request):Promise<Response>{
 let requestedScope:PairingScope|undefined;
 const store=new BusinessPairingStore(db);
 try{
  if(request.method==='GET'){
   const url=new URL(request.url),rawScope=url.searchParams.get('scope');
   if(!rawScope||rawScope.length>4096)throw new BusinessPairingError('invalid-command','需要有界单一配对范围');
   requestedScope=scope(JSON.parse(rawScope));
   const {inspection,executions}=store.readScopeSource(requestedScope),candidates=ordinaryPairingCandidates(inspection,executions);
   const refs=new Map(inspection.refs.map(ref=>[ref.executionId,ref]));
   return json({schema,scope:requestedScope,inspection,status:candidates.reasons.length?'blocked':candidates.pending.length?'pending':inspection.status==='current'?'current':'no-closes',reasons:candidates.reasons,
    executions:executions.length>2000?[]:executions.map(e=>({id:e.id,side:e.side,executedAt:e.executedAt,quantity:e.quantity,price:e.price,fee:e.fee,currency:e.instrument.currency,sourceRef:refs.get(e.id)??null,origin:executionOrigin(e)})),
    candidates:candidates.pending,financialPreviews:candidates.reasons.length?[]:simplePairingFinancialPreviews(executions,candidates.pending),savedRounds:inspection.fact?.rounds??[],replacementSemantics:'all-rounds-in-scope'});
  }
  if(request.method!=='POST')return json({schema,error:'不支持的请求方法'},405);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return json({schema,error:'只接受同源确认'},403);
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return json({schema,error:'需要 application/json'},415);
  const size=request.headers.get('content-length');if(size&&Number(size)>bodyLimit)return json({schema,error:'确认内容过大'},413);
  const input=await body(request);if(input===undefined)return json({schema,error:'确认内容过大'},413);
  if(!shape(input,['schema','scope','expectedRevision','expectedFingerprint','confirmed','basis','rounds'])||input.schema!==schema||input.confirmed!==true||!text(input.basis,4000)||!Number.isSafeInteger(input.expectedRevision)||Number(input.expectedRevision)<0||!text(input.expectedFingerprint,64)||!/^[a-f0-9]{64}$/.test(input.expectedFingerprint)||!Array.isArray(input.rounds)||input.rounds.length>1000)throw new BusinessPairingError('invalid-command','需要明确确认、依据及完整修订条件');
  requestedScope=scope(input.scope);
  const rounds:{id:string;closingExecutionIds:string[]}[]=[],ids=new Set<string>(),closes=new Set<string>();
  for(const r of input.rounds){
   if(!shape(r,['id','closingExecutionIds'])||!text(r.id)||ids.has(r.id)||!Array.isArray(r.closingExecutionIds)||!r.closingExecutionIds.length||r.closingExecutionIds.length>2000)throw new BusinessPairingError('invalid-command','无效或重复回合');
   ids.add(r.id);const closingExecutionIds:string[]=[];
   for(const id of r.closingExecutionIds){if(!text(id)||closes.has(id))throw new BusinessPairingError('invalid-command','无效或重复平仓来源');closes.add(id);closingExecutionIds.push(id);}
   rounds.push({id:r.id,closingExecutionIds});
  }
  const observed=store.readScopeSource(requestedScope),inspection=observed.inspection;
  if(inspection.revision!==input.expectedRevision||inspection.fingerprint!==input.expectedFingerprint)return json({schema,scope:requestedScope,error:'确认修订或来源已变化，请重新核对',code:'confirmation-conflict',inspection},409);
  const candidates=ordinaryPairingCandidates(inspection,observed.executions);
  if(candidates.reasons.length)return json({schema,scope:requestedScope,error:'此范围尚不支持确认',code:'unsupported',reasons:candidates.reasons,inspection},422);
  const available=new Map(candidates.all.map(c=>[c.id,c]));
  const computed:PairingRound[]=rounds.map(r=>({id:r.id,closingExecutionIds:r.closingExecutionIds,pairings:r.closingExecutionIds.flatMap(id=>{const candidate=available.get(id);if(!candidate)throw new BusinessPairingError('invalid-command','平仓来源不属于当前可确认范围');return candidate.pairings;})}));
  const saved=store.save({scope:requestedScope,expectedRevision:Number(input.expectedRevision),expectedFingerprint:input.expectedFingerprint,confirmedBy:'user:local-home',basis:input.basis.trim(),rounds:computed});
  // The durable source-change event exists before requesting asynchronous retry.
  let refreshWarning:string|undefined;
  try{new HomeRefresh(db,true).retry();}catch{refreshWarning='确认已保存；后台刷新重试请求未完成，持久化来源事件仍待发布';}
  return json({schema,inspection:saved,publication:'pending',commitSequence:saved.fact!.commitSequence,...(refreshWarning?{refreshWarning}:{})});
 }catch(error){
  if(error instanceof BusinessPairingError){
   const status=error.code==='source-conflict'||error.code==='revision-conflict'?409:error.code==='unsupported'?422:400;
   return json({schema,scope:requestedScope??null,error:error.message,code:error.code,...(status===409&&requestedScope?{inspection:store.inspectScope(requestedScope)}:{})},status);
  }
  if(error instanceof SyntaxError)return json({schema,scope:requestedScope??null,error:'无效范围 JSON',code:'invalid-command'},400);
  return json({schema,scope:requestedScope??null,status:'blocked',error:'配对来源读取或保存失败',reasons:['pairing-source-unavailable']},503);
 }
}
