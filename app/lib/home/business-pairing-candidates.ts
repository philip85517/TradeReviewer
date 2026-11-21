import type {TradeExecution} from '../trades/types';
import type {PairingInspection,PairingRound} from './business-pairing-store';
import {readExecutionMoneyEvidence} from './execution-money-evidence';
import {roundedOrdinaryRounds} from './full-money';

export type PairingCandidate=PairingRound&{manualConfirmationRequired:true};
type Quantity={n:bigint;s:number};
const quantity=(value:string):Quantity=>{const [whole,fraction='']=value.split('.');return {n:BigInt(whole+fraction),s:fraction.length};};
function subtract(a:Quantity,b:Quantity):Quantity{const s=Math.max(a.s,b.s);return {n:a.n*BigInt(10)**BigInt(s-a.s)-b.n*BigInt(10)**BigInt(s-b.s),s};}
function format(q:Quantity){const digits=q.n.toString().padStart(q.s+1,'0');return q.s?(digits.slice(0,-q.s)+'.'+digits.slice(-q.s)).replace(/\.?0+$/,''):digits;}
// The store has validated calendar, timezone, precision and unique instants.
// Keep sub-millisecond order, including timestamps expressed with UTC offsets.
function instant(value:string){const m=/^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/i.exec(value)!;return {second:Date.parse(m[1]+m[3]),fraction:m[2]??''};}
function compare(a:ReturnType<typeof instant>,b:ReturnType<typeof instant>){const width=Math.max(a.fraction.length,b.fraction.length);return a.second-b.second||a.fraction.padEnd(width,'0').localeCompare(b.fraction.padEnd(width,'0'));}

/** A sell is a selectable source, never inferred to be a human decision/round.
 * Full scope inventory includes unconfirmed sells, so later suggestions cannot
 * reuse openings already consumed by an earlier unconfirmed source. */
export function ordinaryPairingCandidates(inspection:PairingInspection,executions:TradeExecution[],now=Date.now()){
 // A stale fact is retained as history, but cannot prevent a user from
 // explicitly reconfirming the freshly inspected, otherwise supported source.
 const reasons=inspection.reasons.filter(reason=>reason!=='source-dependencies-changed');
 if(inspection.status==='snapshot-behind')reasons.push('snapshot-behind');
 if(executions.length>2000)reasons.push('scope-execution-limit');
 if(executions.some(e=>e.source.executionGroup!==undefined))reasons.push('execution-group-confirmation-not-supported');
 if(executions.some(e=>Date.parse(e.executedAt)>now))reasons.push('future-execution');
 if(reasons.length)return {reasons:[...new Set(reasons)],all:[] as PairingCandidate[],pending:[] as PairingCandidate[]};
 const all:PairingCandidate[]=[],stack:{id:string;remaining:Quantity}[]=[];
 for(const e of [...executions].sort((a,b)=>compare(instant(a.executedAt),instant(b.executedAt)))){
  const amount=quantity(e.quantity);
  if(e.side==='buy'){stack.push({id:e.id,remaining:amount});continue;}
  let remaining=amount;
  const pairings:PairingRound['pairings']=[];
  while(remaining.n>BigInt(0)&&stack.length){
   const top=stack[stack.length-1],difference=subtract(top.remaining,remaining),used=difference.n>=BigInt(0)?remaining:top.remaining;
   pairings.push({openingExecutionId:top.id,closingExecutionId:e.id,quantity:format(used)});
   if(difference.n<=BigInt(0))stack.pop();else top.remaining=difference;
   remaining=difference.n>=BigInt(0)?{n:BigInt(0),s:0}:{n:-difference.n,s:difference.s};
  }
  if(remaining.n>BigInt(0))return {reasons:['source-negative-inventory'],all:[],pending:[]};
  all.push({id:e.id,closingExecutionIds:[e.id],manualConfirmationRequired:true,pairings});
 }
 const confirmed=new Set(inspection.status==='current'?inspection.fact?.rounds.flatMap(r=>r.closingExecutionIds):[]);
 return {reasons:[],all,pending:all.filter(c=>!confirmed.has(c.id))};
}

/** Limited display aid for one complete buy/sell, never a confirmed financial
 * fact. Broader pools, FX and unknown/invalid settlement remain unavailable. */
export function simplePairingFinancialPreviews(executions:TradeExecution[],candidates:PairingCandidate[]){
 if(executions.length!==2||candidates.length!==1||candidates[0].pairings.length!==1)return [];
 const buy=executions.find(e=>e.side==='buy'),sell=executions.find(e=>e.side==='sell');
 if(!buy||!sell||subtract(quantity(buy.quantity),quantity(sell.quantity)).n!==BigInt(0)||buy.instrument.currency!==sell.instrument.currency)return [];
 if(executions.some(e=>![e.price,e.quantity,e.fee,e.source.settlement?.grossAmount??'0'].every(v=>/^\d+(?:\.\d+)?$/.test(v)&&v.replace('.','').length<=8)))return [];
 for(const execution of executions){
  const evidence=readExecutionMoneyEvidence(execution);
  if(evidence.fee.status!=='known'||evidence.fee.currency!==execution.instrument.currency||execution.source.settlement&&(evidence.settlementGross.status!=='known'||evidence.settlementGross.currency!==execution.instrument.currency||evidence.signedCashNet.status==='invalid'))return [];
 }
 // The publication helper sorts source strings. Offset representations that
 // would reverse the already proven chronology get no preview here.
 if(buy.executedAt.localeCompare(sell.executedAt)>=0)return [];
 const result=roundedOrdinaryRounds(executions,candidates).get(candidates[0].id);
 return result?[{closingExecutionId:sell.id,previewOnly:true as const,...result}]:[];
}
