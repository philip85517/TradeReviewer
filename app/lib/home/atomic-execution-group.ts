import { hasSettlementCurrencyMismatch, type TradeExecution } from '../trades/types';
import {exactDecimalOperation, sumExactDecimals} from './exact-decimal-operations';
export const ATOMIC_EXECUTION_GROUP_POLICY = 'same-instant-quote-gross-exact-v1';

// Validate calendar fields before Date parsing, and reject precision Date would truncate.
function instant(value: unknown): number | null {
  if(typeof value!=='string') return null;
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})(?![\s\S])/.exec(value);
  if(!m || /[1-9]/.test((m[7]??'').slice(3))) return null;
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(month<1||month>12||day<1||day>days[month-1]||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59) return null;
  if(m[8]!=='Z'&&(Number(m[8].slice(1,3))>23||Number(m[8].slice(4))>59)) return null;
  const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed:null;
}
function decimal(value: unknown,positive=false): value is string {
  return typeof value==='string'&&value.length<=1024&&/^\d+(?:\.\d+)?(?![\s\S])/.test(value)&&(!positive||/[1-9]/.test(value));
}
const equal=(a:string,b:string)=>exactDecimalOperation('add',a,'0',b);
function proveGroup(execution: TradeExecution, sameInstant: boolean): {valid:boolean;issues:string[];start?:number;end?:number} {
  let start:number|undefined,end:number|undefined;
  const issues:string[]=[];
  const fail=(reason:string)=>{issues.push(`aggregated-fill-${reason}`);};
  try {
    const group=execution.source.executionGroup;
    if(group===undefined) return {valid:true,issues};
    if(!group||group.kind!=='order'||!Array.isArray(group.fills)||!group.fills.length) return {valid:false,issues:['aggregated-fill-invalid-group']};
    if(!Number.isSafeInteger(group.fillCount)||group.fillCount<=0||group.fillCount!==group.fills.length) fail('count');
    const parentTime=instant(execution.executedAt);
    if(parentTime===null) fail('parent-time');
    const locations=new Set<string>();const quantities:string[]=[],grosses:string[]=[];
    for(const fill of group.fills){
      if(!fill||!Number.isSafeInteger(fill.page)||fill.page<=0||!Number.isSafeInteger(fill.row)||fill.row<=0){fail('source-location');continue;}
      const key=`${fill.page}:${fill.row}`;
      if(locations.has(key)) fail('duplicate-source');locations.add(key);
      const time=instant(fill.executedAt);
      if(fill.timePrecision!=='second'||!['row','document','user'].includes(fill.timeEvidence??'')||time===null||parentTime===null||(sameInstant&&time!==parentTime)) fail('time-evidence');
      if(time!==null){start=start===undefined?time:Math.min(start,time);end=end===undefined?time:Math.max(end,time);}
      if(!decimal(fill.quantity,true)||!decimal(fill.price)||!decimal(fill.grossAmount)){fail('decimal');continue;}
      quantities.push(fill.quantity);grosses.push(fill.grossAmount);
      if(!exactDecimalOperation('multiply',fill.quantity,fill.price,fill.grossAmount)) fail('gross-product');
    }
    const quantity=sumExactDecimals(quantities),gross=sumExactDecimals(grosses);
    if(!quantity||!gross||!decimal(group.quantity,true)||!decimal(group.grossAmount)||!decimal(execution.quantity,true)||!decimal(execution.price)) fail('summary-decimal');
    else {
      if(!equal(quantity,group.quantity)||!equal(quantity,execution.quantity)) fail('quantity-summary');
      if(!equal(gross,group.grossAmount)||!exactDecimalOperation('multiply',execution.quantity,execution.price,gross)) fail('gross-summary');
      for(const [value,expected] of [[execution.source.grossAmount,gross],[group.reportedQuantity,quantity],[group.reportedGrossAmount,gross]] as const){
        if(value!==undefined&&(!decimal(value)||!equal(value,expected))) fail('reported-summary');
      }
      const settlement=execution.source.settlement;
      if(settlement&&!hasSettlementCurrencyMismatch(execution)){
        if(!decimal(settlement.quantity,true)||!equal(settlement.quantity,quantity)||!decimal(settlement.grossAmount)||!equal(settlement.grossAmount,gross)) fail('settlement-summary');
      }
    }
    if(!sameInstant&&start!==undefined&&parentTime!==start) fail('parent-time');
  } catch {fail('invalid-structure');}
  return {valid:issues.length===0,issues,start,end};
}

export function validateAtomicExecutionGroup(execution: TradeExecution): {valid:boolean;issues:string[]} {
  const {valid,issues}=proveGroup(execution,true);return {valid,issues};
}
/** Independent parent evidence only; this does not prove a non-overlapping scope. */
export function validateChronologicalExecutionGroup(execution: TradeExecution): {valid:boolean;issues:string[]} {
  const {valid,issues}=proveGroup(execution,false);return {valid,issues};
}
export const NONINTERLEAVED_EXECUTION_GROUP_POLICY = 'non-interleaved-final-scope-exact-v1';

// Final complete-scope proof only: these ranges do not support an as-of cursor.
export function validateNonInterleavedExecutionGroups(executions: readonly TradeExecution[]): {valid:boolean;issues:string[];hasMultiInstantGroup:boolean} {
  const issues:string[]=[];
  const ranges:Array<{start:number;end:number}>=[];
  let hasMultiInstantGroup=false;
  try {
    if(!executions.some(e=>e.source.executionGroup!==undefined)) return {valid:true,issues,hasMultiInstantGroup:false};
    for(const execution of executions){
      if(execution.source.executionGroup!==undefined){
        const proof=proveGroup(execution,false);issues.push(...proof.issues);
        if(proof.valid&&proof.start!==undefined&&proof.end!==undefined){
          ranges.push({start:proof.start,end:proof.end});
          hasMultiInstantGroup ||= proof.start<proof.end;
        }
      }
    }
    // Same-instant scopes retain the original atomic guard boundary.
    if(issues.length || !hasMultiInstantGroup) return {valid:issues.length===0,issues,hasMultiInstantGroup:false};
    for(const execution of executions){
      if(execution.source.executionGroup===undefined){
        const time=instant(execution.executedAt);
        if(time===null) issues.push('aggregated-fill-scope-time');
        else ranges.push({start:time,end:time});
      }
    }
    ranges.sort((a,b)=>a.start-b.start);
    let end=-Infinity;
    for(const range of ranges){
      if(range.start<=end) issues.push('aggregated-fill-scope-overlap');
      end=Math.max(end,range.end);
    }
  } catch {issues.push('aggregated-fill-invalid-structure');}
  return {valid:issues.length===0,issues,hasMultiInstantGroup:issues.length===0&&hasMultiInstantGroup};
}
