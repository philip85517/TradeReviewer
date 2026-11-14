import type {FxRates,NativeBucket,NativeDay} from './contracts';
import {decimal} from './period';

/** Object projections contain change points; FX is attached once at scope level. */
export function compactSeries(days:NativeDay[]):NativeDay[]{
 let previous='';
 return days.flatMap(day=>{
  const key=JSON.stringify([day.buckets,day.activity]);
  if(key===previous)return [];
  previous=key;return [{date:day.date,buckets:day.buckets,fx:{},reasons:[],...(day.activity===undefined?{}:{activity:day.activity})}];
 });
}
const amounts=['market','unrealized','realized','fees'] as const;
const counts=['realizedMissing','feesMissing','count','marketKnown','unrealizedKnown'] as const;
type Vector={values:Record<typeof amounts[number],string>;numbers:Record<typeof counts[number],number>;marketMissing:number;unrealizedMissing:number;incomplete:number;members:number;reasons:Map<string,number>};
const zero=():Vector=>({values:{market:'0',unrealized:'0',realized:'0',fees:'0'},numbers:{realizedMissing:0,feesMissing:0,count:0,marketKnown:0,unrealizedKnown:0},marketMissing:0,unrealizedMissing:0,incomplete:0,members:0,reasons:new Map()});
function accumulate(target:Vector,bucket:NativeBucket,sign:number){
 for(const field of amounts)if(bucket[field]!==null&&bucket[field]!=='0')target.values[field]=decimal(target.values[field]).plus(decimal(bucket[field]!).mul(sign)).toFixed();
 for(const field of counts)target.numbers[field]+=sign*bucket[field];
 target.marketMissing+=sign*Number(bucket.market===null);target.unrealizedMissing+=sign*Number(bucket.unrealized===null);
 target.incomplete+=sign*Number(!bucket.lifetimeComplete);target.members+=sign;
 for(const reason of bucket.reasons)target.reasons.set(reason,(target.reasons.get(reason)??0)+sign);
}
function apply(target:Vector,delta:Vector){
 for(const field of amounts)if(delta.values[field]!=='0')target.values[field]=decimal(target.values[field]).plus(delta.values[field]).toFixed();
 for(const field of counts)target.numbers[field]+=delta.numbers[field];
 target.marketMissing+=delta.marketMissing;target.unrealizedMissing+=delta.unrealizedMissing;target.incomplete+=delta.incomplete;target.members+=delta.members;
 for(const [reason,count]of delta.reasons)target.reasons.set(reason,(target.reasons.get(reason)??0)+count);
}
/** Difference events avoid adding every unchanged object on every calendar day. */
export class NativeSeriesAccumulator{
 private events=new Map<string,Map<string,Vector>>();
 add(days:NativeDay[]){
  let previous:Record<string,NativeBucket>={};
  for(const day of compactSeries(days)){
   const event=this.events.get(day.date)??new Map<string,Vector>();this.events.set(day.date,event);
   for(const code of new Set([...Object.keys(previous),...Object.keys(day.buckets)])){
    const delta=event.get(code)??zero();event.set(code,delta);
    if(previous[code])accumulate(delta,previous[code],-1);
    if(day.buckets[code])accumulate(delta,day.buckets[code],1);
   }
   previous=day.buckets;
  }
 }
 finish(dates:string[],fx:(date:string)=>FxRates):NativeDay[]{
  const running=new Map<string,Vector>();
  return dates.map(date=>{
   for(const [code,delta]of this.events.get(date)??[]){const current=running.get(code)??zero();apply(current,delta);running.set(code,current);}
   const buckets:Record<string,NativeBucket>={};
   for(const [code,b]of running)if(b.members>0)buckets[code]={...b.numbers,...b.values,market:b.marketMissing?null:b.values.market,unrealized:b.unrealizedMissing?null:b.values.unrealized,lifetimeComplete:b.incomplete===0,reasons:[...b.reasons].filter(([,n])=>n>0).map(([reason])=>reason)};
   return {date,buckets,fx:fx(date),reasons:[]};
  });
 }
}
