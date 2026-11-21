import {validateNonInterleavedExecutionGroups} from './atomic-execution-group';
import type {PairingInspection} from './business-pairing-store';
import type {AccountingFeeDiagnostic} from './accounting-fee-diagnostic';
import type {FeeAmount} from './long-fee-pool';
import {executionContentVersion} from './execution-content-ref';
import type {TradeExecution} from '../trades/types';
import {resolvedTradeNatureOf} from '../trades/nature-resolution';
import {replayPositionAtPrice,type NativePositionFacts} from '../replay/position-ledger';
import {sumExactDecimals} from './exact-decimal-operations';
type Money={currency:string;value:string|null;reasons:string[]};
export type AccountingPnlDiagnostic={policy:'ordinary-long-accounting-pnl-exact-v1';sourceSequence:number;revision:number;fingerprint:string;sourceRefs:PairingInspection['refs'];status:'ready'|'blocked'|'invalid';reasons:string[];closes:{closingExecutionId:string;gross:Money}[];rounds:{roundId:string;closingExecutionIds:string[];gross:Money;net:Money;fees:FeeAmount[]}[];universeComplete:false};
const plain=(v:unknown):v is string=>typeof v==='string'&&v.length<=1024&&/^\d+(?:\.\d+)?$/.test(v);
/** Pure, version-bound diagnostic: fees and executions must share one source snapshot. */
export function buildAccountingPnlDiagnostic(inspection:PairingInspection,executions:readonly TradeExecution[],fees:AccountingFeeDiagnostic):AccountingPnlDiagnostic{
 const result:AccountingPnlDiagnostic={policy:'ordinary-long-accounting-pnl-exact-v1',sourceSequence:inspection.sourceSequence,revision:inspection.revision,fingerprint:inspection.fingerprint,sourceRefs:inspection.refs,status:'blocked',reasons:[],closes:[],rounds:[],universeComplete:false};
 if(inspection.fact?.policy==='ordinary-live-long-fill-lifo-v1'){result.reasons=['interleaved-round-financial-attribution-not-implemented'];return result;}
 if(inspection.status!=='current'||!inspection.fact){result.reasons=[`pairing-${inspection.status}`];return result;}
 const groupIssues=validateNonInterleavedExecutionGroups(executions).issues;
 if(groupIssues.length){result.status='invalid';result.reasons=[...new Set(['aggregated-fill-time-unsupported',...groupIssues])];return result;}
 const refs=new Map(inspection.refs.map(r=>[r.executionId,r]));
 if(fees.policy!=='ordinary-long-accounting-fees-exact-v1'||fees.sourceSequence!==inspection.sourceSequence||fees.revision!==inspection.revision||fees.fingerprint!==inspection.fingerprint||JSON.stringify(fees.sourceRefs)!==JSON.stringify(inspection.refs)||refs.size!==executions.length||refs.size!==inspection.refs.length||executions.some(e=>e.accountId!==inspection.scope.accountId||e.instrument.id!==inspection.scope.instrumentId||refs.get(e.id)?.effectiveVersion!==executionContentVersion(e,'effective'))){result.status='invalid';result.reasons=['snapshot-content-ref-mismatch'];return result;}
 const unsupported:string[]=[];
 for(const e of executions){
  if(!plain(e.quantity)||!/[1-9]/.test(e.quantity)||!plain(e.price)||!plain(e.fee))unsupported.push('invalid-execution-number');
  if(!Number.isFinite(Date.parse(e.executedAt))||!/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(e.executedAt)||/\.\d{3}\d*[1-9]\d*(?:Z|[+-]\d{2}:\d{2})$/i.test(e.executedAt))unsupported.push('unsupported-execution-time');
  if(resolvedTradeNatureOf(e)!=='live'||e.source.historyIncomplete?.length||e.source.openingPosition||e.source.statementPositions?.length||e.source.positionEvents?.length||e.source.positionEffect&& !['open-long','close-long'].includes(e.source.positionEffect))unsupported.push('unsupported-execution-source');
  if(!/^[A-Z]{3}$/.test(e.instrument.currency)||e.instrument.currency==='XXX'||e.instrument.currency!==executions[0]?.instrument.currency||e.source.settlement&&e.source.settlement.currency!==e.instrument.currency)unsupported.push('unsupported-pnl-currency');
 }
 if(fees.status!=='ready')unsupported.push(...fees.reasons,'fee-diagnostic-unavailable');
 let facts:NativePositionFacts|undefined;
 if(!unsupported.length)replayPositionAtPrice({executions:[...executions],markPrice:'0',cursor:'9999-12-31T23:59:59.999Z',visibleExecutionIds:executions.map(e=>e.id),certifyOrdinaryLongGross:true,nativeFacts:value=>{facts=value;}});
 result.status='ready';result.reasons=[...new Set(unsupported)];
 const money=(ids:string[]):Money=>{
  const parts=ids.map(id=>facts?.grossContributions?.[id]);
  const reasons=[...new Set([...unsupported,...parts.flatMap(p=>p?.reasons??['gross-contribution-unavailable'])])];
  const currency=executions[0]?.instrument.currency??'UNKNOWN';
  const value=reasons.length||parts.some(p=>!p||p.amount===null||p.currency!==currency)?null:sumExactDecimals(parts.map(p=>p!.amount!));
  if(value===null&&!reasons.length)reasons.push('unsupported-gross-precision');
  return {currency,value,reasons};
 };
 result.closes=executions.filter(e=>e.side==='sell').map(e=>({closingExecutionId:e.id,gross:money([e.id])}));
 result.rounds=inspection.fact.rounds.map(round=>{
  const gross=money(round.closingExecutionIds),feeRound=fees.rounds.find(r=>r.roundId===round.id),amounts=feeRound?.fees??[];
  const reasons=[...gross.reasons];
  if(!feeRound||!amounts.length||amounts.some(f=>f.value===null||f.currency!==gross.currency))reasons.push('round-fees-unavailable');
  const value=gross.value===null||reasons.length?null:sumExactDecimals([gross.value,...amounts.map(f=>f.value!.startsWith('-')?f.value!.slice(1):'-'+f.value)]);
  if(value===null&&!reasons.length)reasons.push('unsupported-net-precision');
  return {roundId:round.id,closingExecutionIds:round.closingExecutionIds,gross,net:{currency:gross.currency,value,reasons},fees:amounts};
 });
 return result;
}
