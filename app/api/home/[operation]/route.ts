import {openSqliteDatabase} from '../../../../db/sqlite';
import {homeHttp} from '../../../lib/home/http';
export const runtime='nodejs';
async function handle(request:Request,context:{params:Promise<{operation:string}>}){
 const {operation}=await context.params;
 return homeHttp(openSqliteDatabase(),operation,request);
}
export const GET=handle;
export const POST=handle;
