import {openSqliteDatabase} from '../../../../db/sqlite';
import {pairingHttp} from '../../../lib/home/business-pairing-api';
import {DatabaseSync} from 'node:sqlite';
import {resolveRuntimeConfig} from '../../../../scripts/runtime-config.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 let database:DatabaseSync|undefined;
 try{
  // Candidate reads never create a DB, apply migrations or request a refresh.
  database=new DatabaseSync(resolveRuntimeConfig().databasePath,{readOnly:true});
  return await pairingHttp(database,request);
 }catch{
  let scope:unknown=null;try{scope=JSON.parse(new URL(request.url).searchParams.get('scope')??'null');}catch{}
  return Response.json({schema:'home-pairing-v1',scope,status:'blocked',reasons:['pairing-database-unavailable'],error:'配对来源数据库暂不可读取'},{status:503,headers:{'Cache-Control':'no-store'}});
 }finally{database?.close();}
}
export async function POST(request:Request){return pairingHttp(openSqliteDatabase(),request);}
