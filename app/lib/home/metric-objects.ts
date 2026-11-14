import {createHash} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {Amount,ConfirmedSubtotal} from '../../components/homepage-preview/display-contract';
import type {FxRates,MetricObject,NativeDay} from './contracts';
import {convertNative,currentAmounts,decimal,nextDay,periodAmounts,validDay} from './period';

export function metricObjectVersion(object:Omit<MetricObject,'version'>) {
 return createHash('sha256').update(JSON.stringify(object)).digest('hex');
}
const transaction=(db:DatabaseSync,write:()=>void)=>{db.exec('BEGIN IMMEDIATE');try{write();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}};

/** Shared by the four account/market scopes. Only complete objects can be referenced. */
export function stageMetricObjects(db:DatabaseSync,objects:MetricObject[]) {
 for(const object of new Map(objects.map(o=>[o.version,o])).values()) {
  const {version,...content}=object;
  if(metricObjectVersion(content)!==version||!object.boundaries.length||object.boundaries[0].date!==object.firstDay||object.current.date!==object.lastDay)throw new Error('invalid metric object identity');
  let previous:NativeDay|undefined;
  for(const day of [...object.boundaries,object.current]) {
   if(!validDay(day.date)||day.date<object.firstDay||day.date>object.lastDay||!Number.isSafeInteger(day.activity)||day.activity!<0)throw new Error('invalid metric boundary');
   if(previous&&(day.date<previous.date||day.activity!<previous.activity!))throw new Error('non-monotonic metric boundary');
   for(const [code,b]of Object.entries(day.buckets)) {
    for(const field of ['market','unrealized','realized','fees'] as const)if(b[field]!==null)decimal(b[field]!);
    if(previous&&(b.realizedMissing<(previous.buckets[code]?.realizedMissing??0)||b.feesMissing<(previous.buckets[code]?.feesMissing??0)))throw new Error('non-monotonic metric prefix');
   }
   previous=day;
  }
  const saved=db.prepare('SELECT complete FROM home_metric_object WHERE object_version=?').get(version);
  if(saved?.complete===1)continue;
  const metadata=JSON.stringify({accountId:object.accountId,code:object.code,name:object.name});
  transaction(db,()=>{db.prepare('INSERT OR IGNORE INTO home_metric_object VALUES(?,?,?,?,?,?,?,0)').run(version,object.positionKey,object.firstDay,object.lastDay,JSON.stringify(object.current),metadata,object.boundaries.length);});
  for(let offset=0;offset<object.boundaries.length;offset+=256)transaction(db,()=>{
   const insert=db.prepare('INSERT OR IGNORE INTO home_metric_boundary VALUES(?,?,?)');
   for(const day of object.boundaries.slice(offset,offset+256))insert.run(version,day.date,JSON.stringify(day));
  });
  transaction(db,()=>{
   const count=db.prepare('SELECT count(*) n FROM home_metric_boundary WHERE object_version=?').get(version)!.n;
   if(count!==object.boundaries.length)throw new Error('incomplete metric object');
   db.prepare('UPDATE home_metric_object SET complete=1 WHERE object_version=?').run(version);
  });
 }
}

type Identity=ConfirmedSubtotal['missing'][number];
type Endpoint={identity:Omit<Identity,'reasons'>;current:NativeDay;baseline:NativeDay|null;end:NativeDay|null};
/** Two PK seeks per member, independent of the number of historical executions/days. */
function endpoints(db:DatabaseSync,version:string,from:string,to:string,fx:FxRates):Endpoint[] {
 const rows=db.prepare(`SELECT o.current_json,o.metadata_json,o.first_day,o.last_day,
  (SELECT b.native_json FROM home_metric_boundary b WHERE b.object_version=o.object_version AND b.business_date<=? ORDER BY b.business_date DESC LIMIT 1) baseline_json,
  (SELECT b.native_json FROM home_metric_boundary b WHERE b.object_version=o.object_version AND b.business_date<=? ORDER BY b.business_date DESC LIMIT 1) end_json
  FROM home_metric_member m JOIN home_metric_object o USING(object_version)
  WHERE m.scope_version=? AND o.complete=1 ORDER BY m.position_key`).all(nextDay(from,-1),to,version);
 return rows.map(row=>{
  const read=(raw:unknown,date:string)=>raw&&date>=String(row.first_day)&&date<=String(row.last_day)?{...JSON.parse(String(raw)),date,fx} as NativeDay:null;
  return {identity:JSON.parse(String(row.metadata_json)),current:{...JSON.parse(String(row.current_json)),fx},baseline:read(row.baseline_json,nextDay(from,-1)),end:read(row.end_json,to)};
 });
}
function subtotal(members:{identity:Omit<Identity,'reasons'>;amount:Amount;reasons:string[]}[],currency:string,fx:FxRates):ConfirmedSubtotal {
 const originals:Record<string,string>={},missing:Identity[]=[];
 let available=0;
 for(const member of members){
  // Include every currency of a calculable object, or none of that object.
  if(member.amount.value===null){if(missing.length<8)missing.push({...member.identity,reasons:[...new Set([...member.reasons,...member.amount.reasons])]});continue;}
  available++;
  for(const [code,value]of Object.entries(member.amount.originals))originals[code]=decimal(originals[code]??'0').plus(value).toFixed();
 }
 const converted=convertNative(originals,currency,fx);
 return {value:available===0&&members.length>0?null:converted.value,currency,originals,fxSource:converted.fxSource,coverage:{available,total:members.length,unit:'account-security',scope:'imported'},missing};
}
const hasPosition=(day:NativeDay|null)=>day&&Object.values(day.buckets).some(b=>b.count>0);
function computeObjectSubtotals(db:DatabaseSync,version:string,period:{from:string;to:string},currency:string,fx:FxRates){
 const objects=endpoints(db,version,period.from,period.to,fx);
 const reasons=(day:NativeDay|null)=>day?[...new Set(Object.values(day.buckets).flatMap(b=>b.reasons))]:['期间边界结果未覆盖'];
 const current=objects.filter(o=>hasPosition(o.current));
 // A round trip can be flat at both endpoints, including zero-profit round trips.
 // Unknown/uncovered boundaries remain in the denominator, never disappear.
 const active=objects.filter(o=>!o.baseline||!o.end||hasPosition(o.baseline)||hasPosition(o.end)||o.end.activity!==o.baseline.activity);
 const evaluated=active.map(o=>({...o,values:periodAmounts(o.baseline,o.end??undefined,period.from,currency)}));
 const currentMetric=(field:'marketValue'|'unrealized')=>subtotal(current.map(o=>({identity:o.identity,amount:currentAmounts(o.current,currency)[field],reasons:reasons(o.current)})),currency,fx);
 const periodMetric=(field:'realized'|'unrealizedChange'|'net')=>subtotal(evaluated.map(o=>({identity:o.identity,amount:o.values[field],reasons:[...reasons(o.baseline),...reasons(o.end)]})),currency,fx);
 return {marketValue:currentMetric('marketValue'),unrealized:currentMetric('unrealized'),realized:periodMetric('realized'),unrealizedChange:periodMetric('unrealizedChange'),net:periodMetric('net')};
}

// A published scope is immutable. Include its release FX overlay as well as
// the requested endpoints; FX-only publications can reuse the native scope.
// Connection ownership prevents cross-database reuse and permits collection
// after a connection closes. This is an optional bounded read accelerator.
const subtotalCaches=new WeakMap<DatabaseSync,Map<string,ReturnType<typeof computeObjectSubtotals>>>();
export const objectSubtotalKey=(version:string,period:{from:string;to:string},currency:string,fx:FxRates)=>JSON.stringify([version,period.from,period.to,currency,fx]);
export function objectSubtotals(db:DatabaseSync,version:string,period:{from:string;to:string},currency:string,fx:FxRates){
 const key=objectSubtotalKey(version,period,currency,fx);
 let cache=subtotalCaches.get(db);
 if(!cache){cache=new Map();subtotalCaches.set(db,cache);}
 let result=cache.get(key);
 if(!result){
  result=computeObjectSubtotals(db,version,period,currency,fx);
  if(cache.size>=128)cache.delete(cache.keys().next().value!);
  cache.set(key,result);
 }
 // Callers receive mutable response objects, never the cached financial value.
 return structuredClone(result);
}
