import type {MetricObject,NativeDay,NativeOrdering} from './contracts';

import {validDay} from './period';

/** Complete first appearances, collected only from original published boundaries. */
export function nativeOrdering(days:NativeDay[]):NativeOrdering{
 const currencies=new Map<string,NativeOrdering['currencies'][number]>();
 const seen=new Map<string,Set<string>>();
 for(const day of days)Object.entries(day.buckets).forEach(([code,bucket],index)=>{
  let entry=currencies.get(code);
  if(!entry){entry={code,date:day.date,index,reasons:[]};currencies.set(code,entry);seen.set(code,new Set());}
  bucket.reasons.forEach((reason,index)=>{if(!seen.get(code)!.has(reason)){seen.get(code)!.add(reason);entry!.reasons.push({reason,date:day.date,index});}});
 });
 return {version:1,currencies:[...currencies.values()]};
}
/** Presence is strict: malformed metadata never silently becomes legacy. */
export function validateNativeOrdering(value:unknown,first:string,last:string):asserts value is NativeOrdering{
 const bad=()=>{throw new Error('invalid native ordering metadata');};
 const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const point=(v:Record<string,unknown>)=>typeof v.date==='string'&&validDay(v.date)&&v.date>=first&&v.date<=last&&Number.isSafeInteger(v.index)&&Number(v.index)>=0;
 if(!record(value)||!exact(value,['version','currencies'])||value.version!==1||!Array.isArray(value.currencies))return bad();
 const codes=new Set<string>(),positions=new Set<string>();
 for(const c of value.currencies){
  if(!record(c)||!exact(c,['code','date','index','reasons'])||typeof c.code!=='string'||!c.code||codes.has(c.code)||!point(c)||!Array.isArray(c.reasons))return bad();
  codes.add(c.code);const position=JSON.stringify([c.date,c.index]);if(positions.has(position))return bad();positions.add(position);
  const reasons=new Set<string>(),indices=new Set<string>();
  for(const r of c.reasons){
   if(!record(r)||!exact(r,['reason','date','index'])||typeof r.reason!=='string'||reasons.has(r.reason)||!point(r)||String(r.date)<String(c.date))return bad();
   reasons.add(r.reason);const at=JSON.stringify([r.date,r.index]);if(indices.has(at))return bad();indices.add(at);
  }
 }
}

type Appearance={date:string;object:number;index:number};
const earlier=(a:Appearance,b:Appearance)=>a.date.localeCompare(b.date)||a.object-b.object||a.index-b.index;

/** Prefix buckets are cumulative. Retain the opening state and subsequent
 * changes, but preserve the accumulator's historical insertion order as well.
 * Older published objects do not carry ordering metadata, so inspect their
 * sparse boundaries without replaying the old Decimal amount deltas. */
export function windowNativeObjects(objects:MetricObject[],opening:string){
 const currencies=new Map<string,Appearance>(),reasons=new Map<string,Map<string,Appearance>>();
 const remember=(map:Map<string,Appearance>,key:string,at:Appearance)=>{const prior=map.get(key);if(!prior||earlier(at,prior)<0)map.set(key,at);};
 const reduced=objects.map((object,objectIndex)=>{
  const seen=new Map<string,Set<string>>();let prefix:NativeDay|undefined;const following:NativeDay[]=[];
  if(Object.hasOwn(object,'ordering')){
   validateNativeOrdering(object.ordering,object.firstDay,object.lastDay);
   const metadata=new Map(object.ordering!.currencies.map(c=>[c.code,c]));
   for(const c of metadata.values()){
    remember(currencies,c.code,{date:c.date,object:objectIndex,index:c.index});
    let order=reasons.get(c.code);if(!order){order=new Map();reasons.set(c.code,order);}
    for(const r of c.reasons)remember(order,r.reason,{date:r.date,object:objectIndex,index:r.index});
   }
   const observed=nativeOrdering(object.boundaries);
   for(const c of observed.currencies){
    const saved=metadata.get(c.code);
    if(!saved||saved.date>c.date||(saved.date===c.date&&saved.index!==c.index)||(saved.date>opening&&saved.date!==c.date))throw new Error('inconsistent native ordering currency');
    const known=new Map(saved.reasons.map(r=>[r.reason,r]));
    for(const r of c.reasons){const prior=known.get(r.reason);if(!prior||prior.date>r.date||(prior.date===r.date&&prior.index!==r.index)||(prior.date>opening&&prior.date!==r.date))throw new Error('inconsistent native ordering reason');}
   }
   for(const c of metadata.values()){
    if(c.date>opening&&!observed.currencies.some(v=>v.code===c.code&&v.date===c.date))throw new Error('missing native ordering appearance');
    for(const r of c.reasons)if(r.date>opening&&!observed.currencies.find(v=>v.code===c.code)?.reasons.some(v=>v.reason===r.reason&&v.date===r.date))throw new Error('missing native ordering reason appearance');
   }
   for(const day of object.boundaries){if(day.date<=opening)prefix=day;else following.push(day);}
   return {...object,boundaries:prefix?[prefix,...following]:following};
  }
  for(const day of object.boundaries){
   if(day.date<=opening)prefix=day;else following.push(day);
   let index=0;
   for(const [code,bucket]of Object.entries(day.buckets)){
    let known=seen.get(code);
    if(!known){known=new Set();seen.set(code,known);remember(currencies,code,{date:day.date,object:objectIndex,index});}
    let order=reasons.get(code);if(!order){order=new Map();reasons.set(code,order);}
    bucket.reasons.forEach((reason,reasonIndex)=>{if(!known.has(reason)){known.add(reason);remember(order,reason,{date:day.date,object:objectIndex,index:reasonIndex});}});
    index++;
   }
  }
  return {...object,boundaries:prefix?[prefix,...following]:following};
 });
 const rank=(order:Map<string,Appearance>)=>new Map([...order].sort((a,b)=>earlier(a[1],b[1])).map(([key],i)=>[key,i]));
 const currencyRank=rank(currencies),reasonRanks=new Map([...reasons].map(([code,order])=>[code,rank(order)]));
 return {objects:reduced,restoreOrder:(days:NativeDay[])=>days.map(day=>({...day,buckets:Object.fromEntries(Object.entries(day.buckets).sort(([a],[b])=>currencyRank.get(a)!-currencyRank.get(b)!).map(([code,bucket])=>{
  const order=reasonRanks.get(code)!;
  return [code,{...bucket,reasons:[...bucket.reasons].sort((a,b)=>order.get(a)!-order.get(b)!)}];
 }))}))};
}
