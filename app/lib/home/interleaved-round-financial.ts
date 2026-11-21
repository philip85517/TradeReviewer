import {createHash} from 'node:crypto';
import type {TradeExecution} from '../trades/types';
import type {PairingInspection,PairingScope} from './business-pairing-store';
import {buildInterleavedAccountingDiagnostic,buildInterleavedPairingDiagnostic,INTERLEAVED_PAIRING_POLICY,type InterleavedAccountingInput} from './interleaved-accounting-diagnostic';
import {sumExactDecimals} from './exact-decimal-operations';
import {sumFeeAmounts,type FeeAmount} from './long-fee-pool';
import type {SourceMoney} from './accounting-fee-diagnostic';

type Money={currency:string;value:string|null;reasons:string[]};
type Binding={sourceSequence:number;revision:number;fingerprint:string;sourceRefs:PairingInspection['refs'];status:'ready'|'blocked';reasons:string[];universeComplete:false};
export type InterleavedRoundFees=Binding&{
 policy:'interleaved-long-round-fees-v1';sourceMoney:SourceMoney[];pool:null;poolExplanation:string;
 rounds:{roundId:string;closingExecutionIds:string[];fees:FeeAmount[];entryFees:FeeAmount[];exitFees:FeeAmount[];netPnl:null;reasons:string[]}[];
};
export type InterleavedRoundPnl=Binding&{
 policy:'interleaved-long-round-pnl-v1';closes:{closingExecutionId:string;gross:Money}[];
 rounds:{roundId:string;closingExecutionIds:string[];gross:Money;net:Money;fees:FeeAmount[]}[];
};
// This is the dependency serialization used by the confirmation store. It is
// deliberately distinct from the quantity proof and accounting fingerprints.
function stable(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';
 return JSON.stringify(value);
}
const sameScope=(a:PairingScope,b:PairingScope)=>stable(a)===stable(b);
const refMultiset=(refs:PairingInspection['refs'])=>refs.map(stable).sort();
const sameRefs=(a:PairingInspection['refs'],b:PairingInspection['refs'])=>stable(refMultiset(a))===stable(refMultiset(b));
const unique=(reasons:string[])=>[...new Set(reasons)].sort();
function aggregate(parts:Money[]):Money{
 const currency=parts[0].currency;
 const reasons=unique(parts.flatMap(p=>[...p.reasons,...(p.currency!==currency?['mixed-quote-currency']:[])]));
 const value=reasons.length||parts.some(p=>p.value===null)?null:sumExactDecimals(parts.map(p=>p.value!));
 return {currency,value,reasons:value===null&&!reasons.length?['round-money-unavailable']:reasons};
}
/** Revalidate the saved quantity decision, then aggregate complete-scope ledger
 * amounts by original sell identity. LIFO allocations never become cost inputs. */
export function buildInterleavedRoundFinancialDiagnostic(inspection:PairingInspection,executions:readonly TradeExecution[],input:InterleavedAccountingInput):{accountingFees:InterleavedRoundFees;accountingPnl:InterleavedRoundPnl}{
 const binding:Binding={sourceSequence:inspection.sourceSequence,revision:inspection.revision,fingerprint:inspection.fingerprint,sourceRefs:inspection.refs,status:'blocked',reasons:[],universeComplete:false};
 const accountingFees:InterleavedRoundFees={...binding,policy:'interleaved-long-round-fees-v1',sourceMoney:[],pool:null,poolExplanation:'Private fill fee-pool details are not exposed; null does not imply zero remaining fees.',rounds:[]};
 const accountingPnl:InterleavedRoundPnl={...binding,policy:'interleaved-long-round-pnl-v1',closes:[],rounds:[]};
 const blocked=(reasons:string[])=>{accountingFees.status='blocked';accountingPnl.status='blocked';accountingFees.rounds=[];accountingPnl.rounds=[];accountingPnl.closes=[];accountingFees.reasons=unique(reasons);accountingPnl.reasons=unique(reasons);return {accountingFees,accountingPnl};};
 try{
  const fact=inspection.fact;
  if(inspection.status!=='current'||!fact)return blocked([`pairing-${inspection.status}`,...inspection.reasons]);
  if(fact.policy!==INTERLEAVED_PAIRING_POLICY)return blocked(['unsupported-pairing-policy']);
  if(!fact.rounds.length)return blocked(['pairing-empty']);
  if(!Number.isSafeInteger(inspection.sourceSequence)||inspection.sourceSequence<0||input.sourceSequence!==inspection.sourceSequence||!Number.isSafeInteger(fact.consumedSourceSequence)||fact.consumedSourceSequence<0||!Number.isSafeInteger(fact.commitSequence)||fact.consumedSourceSequence>=fact.commitSequence||fact.commitSequence>inspection.sourceSequence||!Number.isSafeInteger(inspection.revision)||inspection.revision<=0||fact.revision!==inspection.revision||fact.schemaVersion!==1||!sameScope(input.scope,inspection.scope)||!sameScope(fact.scope,inspection.scope)||!sameRefs(input.refs,inspection.refs)||!sameRefs(fact.refs,inspection.refs))return blocked(['snapshot-confirmation-mismatch']);
  // Validate before flattening: flattening alone loses round membership.
  const roundIds=new Set<string>(),closeIds=new Set<string>();
  for(const round of fact.rounds){
   if(typeof round.id!=='string'||!round.id.trim()||roundIds.has(round.id)||!Array.isArray(round.closingExecutionIds)||!round.closingExecutionIds.length||!Array.isArray(round.pairings))return blocked(['invalid-confirmed-round']);
   roundIds.add(round.id);
   for(const id of round.closingExecutionIds){if(typeof id!=='string'||!id.trim()||closeIds.has(id))return blocked(['duplicate-or-invalid-confirmed-close']);closeIds.add(id);}
   if(round.pairings.some(p=>!round.closingExecutionIds.includes(p.closingExecutionId)))return blocked(['pairing-round-mismatch']);
  }
  const quantity=buildInterleavedPairingDiagnostic(input,executions,{confirmedClosingExecutionIds:fact.rounds.flatMap(r=>r.closingExecutionIds),pairings:fact.rounds.flatMap(r=>r.pairings)});
  if(quantity.status!=='ready')return blocked(['quantity-proof-unavailable',...quantity.reasons]);
  const deps={policy:INTERLEAVED_PAIRING_POLICY,scope:input.scope,refs:quantity.refs,sourceProofFingerprint:quantity.sourceProofFingerprint};
  const fingerprint=createHash('sha256').update(stable(deps)).digest('hex');
  if(stable(fact.dependencies)!==stable(deps)||inspection.fingerprint!==fingerprint||fact.fingerprint!==fingerprint)return blocked(['confirmation-dependencies-mismatch']);
  const accounting=buildInterleavedAccountingDiagnostic(input,executions);
  if(accounting.status!=='ready')return blocked(['accounting-proof-unavailable',...accounting.reasons]);
  const closes=new Map<string,typeof accounting.closes>();
  for(const close of accounting.closes){const matches=closes.get(close.executionId)??[];matches.push(close);closes.set(close.executionId,matches);}
  if([...closeIds].some(id=>closes.get(id)?.length!==1))return blocked(['confirmed-close-accounting-mismatch']);
  for(const round of fact.rounds){
   const members=round.closingExecutionIds.map(id=>closes.get(id)![0]);
   const fees=sumFeeAmounts(members.flatMap(c=>c.totalFees));
   accountingFees.rounds.push({roundId:round.id,closingExecutionIds:[...round.closingExecutionIds],fees,entryFees:sumFeeAmounts(members.flatMap(c=>c.entryFees)),exitFees:sumFeeAmounts(members.flatMap(c=>c.exitFees)),netPnl:null,reasons:unique(fees.flatMap(f=>f.reasons))});
   accountingPnl.rounds.push({roundId:round.id,closingExecutionIds:[...round.closingExecutionIds],gross:aggregate(members.map(c=>c.gross)),net:aggregate(members.map(c=>c.net)),fees});
  }
  accountingPnl.closes=accounting.closes.map(c=>({closingExecutionId:c.executionId,gross:c.gross}));
  accountingFees.status='ready';accountingPnl.status='ready';
  return {accountingFees,accountingPnl};
 }catch{return blocked(['invalid-confirmation-structure']);}
}
