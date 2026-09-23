import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it, vi } from "vitest";
const { openSqliteDatabase } = vi.hoisted(()=>({openSqliteDatabase:vi.fn()}));
vi.mock("../../../../db/sqlite", async importOriginal=>({...await importOriginal<typeof import('../../../../db/sqlite')>(),openSqliteDatabase}));
import { initializeSqlite } from "../../../../db/sqlite";
import { SqliteStore } from "../../../lib/storage/sqlite-store";
import { GET, POST } from "./route";
const databases: DatabaseSync[]=[];
afterEach(()=>{databases.splice(0).forEach(db=>db.close());vi.clearAllMocks();});
it("validates scope over HTTP, returns conflict for stale input, and reads the audit",async()=>{
 const db=new DatabaseSync(':memory:');databases.push(db);initializeSqlite(db);openSqliteDatabase.mockReturnValue(db);
 const execution={id:'a',instrument:{id:'US:CTVA',symbol:'CTVA',name:'Corteva',market:'US',currency:'USD'},accountId:'a',accountLabel:'A',executedAt:'2026-07-24T13:48:50Z',side:'buy' as const,quantity:'100',price:'88.77',fee:'0',source:{platform:'tiger',row:0}};
 new SqliteStore(db).mergeTradeData({executions:[execution]});
 const request=(body:unknown)=>new Request('http://localhost/api/storage/trade-revisions',{method:'POST',body:JSON.stringify(body)});
 const body={id:'repair',instrumentId:'US:CTVA',accountId:'a',reason:'核对',changes:[{before:execution,after:{...execution,quantity:'200'}}]};
 expect((await POST(request({...body,accountId:'other'}))).status).toBe(400);
 expect((await POST(request(body))).status).toBe(200);
 expect((await POST(request(body))).status).toBe(200);
 expect((await POST(request({...body,id:'stale'}))).status).toBe(409);
 const history=await GET(new Request('http://localhost/api/storage/trade-revisions?instrumentId=US:CTVA'));
 expect(history.headers.get('cache-control')).toBe('no-store');expect(await history.json()).toHaveLength(1);
 expect((await POST(new Request('http://localhost',{method:'POST',body:'{'}))).status).toBe(400);
});

it("accepts explicit unknown fees and precise source timestamps over HTTP", async () => {
 const db=new DatabaseSync(':memory:');databases.push(db);initializeSqlite(db);openSqliteDatabase.mockReturnValue(db);
 const execution={id:'unknown',instrument:{id:'US:CTVA',symbol:'CTVA',name:'Corteva',market:'US',currency:'USD'},accountId:'a',accountLabel:'A',executedAt:'2026-07-24T13:48:50Z',side:'buy' as const,quantity:'100',price:'88.77',fee:'0',source:{platform:'manual',row:0,feeStatus:'unknown' as const,timePrecision:'second' as const,sourceTimestampText:'2026/07/24 09:48:50',sourceTimezone:'America/New_York'}};
 const store=new SqliteStore(db);store.mergeTradeData({executions:[execution]});
 const request=(body:unknown)=>new Request('http://localhost/api/storage/trade-revisions',{method:'POST',body:JSON.stringify(body)});
 const response=await POST(request({id:'unknown-edit',instrumentId:'US:CTVA',accountId:'a',reason:'核对时间',changes:[{before:execution,after:{...execution,executedAt:'2026-07-24T14:00:00Z',source:{...execution.source,timePrecision:'second',sourceTimestampText:'2026-07-24 10:00:00'}}}]}));
 expect(response.status).toBe(200);
 expect(store.getExecutions()[0]?.source.feeStatus).toBe('unknown');
});
