import type {DatabaseSync} from 'node:sqlite';
import {deflateSync,inflateSync} from 'node:zlib';
import {HOME_POLICY,type MetricObject,type NativeDay} from './contracts';
import type {NativePosition} from './finance';
import {compactSeries} from './native-series';
export type ObjectProjection={metric?:MetricObject;days:NativeDay[];current:NativeDay;state:NativePosition;price:string|null;opened:string|null};
export type BaseProjection={days:NativeDay[];positions:Record<string,Omit<ObjectProjection,'days'>>};
/** Rebuildable background-only cache. Never part of the published read contract. */
export class ProjectionCache {
 constructor(private db:DatabaseSync){}
 /** Only complete retained publications are eligible, even if a prior build crashed. */
 scopeReuse(sequence:number):(key:string,fingerprint:string)=>string|null{
  const published=new Map(this.db.prepare(`SELECT r.scope_id,r.scope_version,r.metadata_json FROM home_scope_result r
   WHERE r.policy_version=? AND r.built_from_sequence<=? AND EXISTS(
    SELECT 1 FROM home_release_scope s JOIN home_publication p USING(release_id) WHERE s.scope_version=r.scope_version)`)
   .all(HOME_POLICY,sequence).map(row=>[JSON.stringify([row.scope_id,JSON.parse(String(row.metadata_json)).contentHash??row.scope_version]),String(row.scope_version)]));
  const read=this.db.prepare('SELECT payload FROM home_object_projection WHERE position_key=? AND fingerprint=?');
  return (key,fingerprint)=>{
   const row=read.get(`scope:${key}`,fingerprint);if(!row)return null;
   try {const hash=JSON.parse(inflateSync(row.payload as Uint8Array).toString());return typeof hash==='string'?published.get(JSON.stringify([key,hash]))??null:null;}
   catch{return null;}
  };
 }
 putScope(key:string,fingerprint:string,contentHash:string){
  this.db.prepare('INSERT INTO home_object_projection VALUES(?,?,?) ON CONFLICT(position_key) DO UPDATE SET fingerprint=excluded.fingerprint,payload=excluded.payload').run(`scope:${key}`,fingerprint,deflateSync(JSON.stringify(contentHash)));
 }
 getBase(key:string,fingerprint:string):BaseProjection|null{
  const row=this.db.prepare('SELECT payload FROM home_object_projection WHERE position_key=? AND fingerprint=?').get(`base:${key}`,fingerprint);
  if(!row)return null;
  try{return JSON.parse(inflateSync(row.payload as Uint8Array).toString()) as BaseProjection;}catch{return null;}
 }
 putBase(key:string,fingerprint:string,projection:BaseProjection){
  this.db.prepare('INSERT INTO home_object_projection VALUES(?,?,?) ON CONFLICT(position_key) DO UPDATE SET fingerprint=excluded.fingerprint,payload=excluded.payload').run(`base:${key}`,fingerprint,deflateSync(JSON.stringify({...projection,days:compactSeries(projection.days)}),{level:1}));
 }
 get(key:string,fingerprint:string):ObjectProjection|null{
  const row=this.db.prepare('SELECT payload FROM home_object_projection WHERE position_key=? AND fingerprint=?').get(key,fingerprint);
  if(!row)return null;
  try{
   const value=JSON.parse(inflateSync(row.payload as Uint8Array).toString()) as ObjectProjection&{layout?:number};
   if(value.layout!==2){value.days=compactSeries(value.days);this.put(key,fingerprint,value);}
   return value;
  }catch{return null;}
 }
 put(key:string,fingerprint:string,projection:ObjectProjection){
  this.db.prepare('INSERT INTO home_object_projection VALUES(?,?,?) ON CONFLICT(position_key) DO UPDATE SET fingerprint=excluded.fingerprint,payload=excluded.payload').run(key,fingerprint,deflateSync(JSON.stringify({...projection,days:compactSeries(projection.days),layout:2}),{level:1}));
 }
}
