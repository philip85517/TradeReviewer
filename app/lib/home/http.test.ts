import type {HomeResult} from './contracts';
import type {HomeStore as StoreType} from './store';
import {DatabaseSync} from 'node:sqlite';
import {afterEach,describe,expect,it} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {HomeStore} from './store';
import {homeHttp} from './http';
import {release,request} from './test-fixtures';
const opened:DatabaseSync[]=[];afterEach(()=>opened.splice(0).forEach(d=>d.close()));
function setup(published=true){const db=new DatabaseSync(':memory:');opened.push(db);initializeSqlite(db);const store=new HomeStore(db);if(published){store.stage(release());store.publish('r1',null);}return{db,store};}
function req(operation:string,parameters:Record<string,unknown>={request}){const url=new URL(`http://localhost/api/home/${operation}`);for(const[k,v]of Object.entries(parameters))url.searchParams.set(k,JSON.stringify(v));return new Request(url);}
describe('bounded immutable HTTP reads',()=>{
 it('serves the whole page, period, paginated rows, detail and trade collection from the same release',async()=>{
  const{db}=setup();const home=await(await homeHttp(db,'core',req('core'))).json() as HomeResult;
  expect(home.stamp.version).toBe('r1');expect(home.metrics.net.value).toBe('10');
  const holdings=await(await homeHttp(db,'holdings',req('holdings',{request:{...request,page:2},version:'r1'}))).json() as ReturnType<StoreType['readHoldings']>;expect(holdings.holdings.rows).toHaveLength(1);
  const period=await(await homeHttp(db,'period',req('period',{request,version:'r1'}))).json() as ReturnType<StoreType['readPeriod']>;expect(period.period.net.value).toBe('10');
  const id=home.holdings.rows[0].id;
  expect((await(await homeHttp(db,'holding',req('holding',{stamp:home.stamp,id}))).json() as ReturnType<StoreType['readHolding']>).holding.id).toBe(id);
  expect((await(await homeHttp(db,'trades',req('trades',{stamp:home.stamp,id,cursor:0}))).json() as ReturnType<StoreType['readTrades']>).trades).toHaveLength(1);
  const exported=await homeHttp(db,'export',req('export',{request:{...request,query:'证券0',page:2},version:'r1'}));
  expect(exported.headers.get('content-type')).toContain('text/csv');expect((await exported.text()).split('\n')).toHaveLength(2);
 });
 it('distinguishes first recovery, invalid input, unknown identities and expired versions; GET is read only',async()=>{
  const{db,store}=setup(false);expect((await homeHttp(db,'core',req('core'))).status).toBe(503);
  store.stage(release());store.publish('r1',null);
  expect((await homeHttp(db,'core',req('core',{request:{...request,period:{preset:'custom',from:'bad',to:'2026-01-01'}}}))).status).toBe(400);
  expect((await homeHttp(db,'core',req('core',{request:{...request,accountId:'missing'}}))).status).toBe(404);
  expect((await homeHttp(db,'period',req('period',{request,version:'missing'}))).status).toBe(410);
  const before=db.prepare('SELECT total_changes() n').get()?.n;
  await homeHttp(db,'status',req('status'));await homeHttp(db,'core',req('core'));
  expect(db.prepare('SELECT total_changes() n').get()?.n).toBe(before);
  expect((await homeHttp(db,'retry',req('retry'))).status).toBe(405);
 });
});
