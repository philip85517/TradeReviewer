import type {HomeResult} from './contracts';
import type {HomeStore as StoreType} from './store';
import {DatabaseSync} from 'node:sqlite';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {HomeStore} from './store';
import {homeHttp} from './http';
import {release,request} from './test-fixtures';
import {fullRead,retryFull,type FullRefreshStatus} from '../../components/homepage-preview/full-client';
const emptyFilters={assetTypes:[],openOnly:false,review:'all' as const};
const requestOperations=['core','period','holdings','export'] as const;
const opened:DatabaseSync[]=[];afterEach(()=>opened.splice(0).forEach(d=>d.close()));
function setup(published=true){const db=new DatabaseSync(':memory:');opened.push(db);initializeSqlite(db);const store=new HomeStore(db);if(published){store.stage(release());store.publish('r1',null);}return{db,store};}
function req(operation:string,parameters:Record<string,unknown>={request}){const url=new URL(`http://localhost/api/home/${operation}`);for(const[k,v]of Object.entries(parameters))url.searchParams.set(k,JSON.stringify(v));return new Request(url);}
describe('bounded immutable HTTP reads',()=>{
 it('only explicit same-origin repair queues bounded acquisition; reads and invalid requests do not',async()=>{
  const {db}=setup();
  const count=()=>Number(db.prepare('SELECT count(*) n FROM home_source_job').get()!.n);
  for(const input of [new Request('http://localhost/api/home/repair?reader=full-home-v1&from=2026-01-01'),new Request('http://localhost/api/home/repair?reader=full-home-v1&from=2026-01-01',{method:'POST',headers:{origin:'http://other.example'}}),new Request('http://localhost/api/home/repair?reader=full-home-v1&from=bad',{method:'POST'})]){
   expect((await homeHttp(db,'repair',input)).status).toBeGreaterThanOrEqual(400);expect(count()).toBe(0);
  }
  const result=await homeHttp(db,'repair',new Request('http://localhost/api/home/repair?reader=full-home-v1&from=2026-01-01',{method:'POST',headers:{origin:'http://localhost'}}));
  expect(result.status).toBe(200);expect(count()).toBeGreaterThan(0);
  const jobs=count();await homeHttp(db,'status',req('status'));expect(count()).toBe(jobs);
  expect(db.prepare('SELECT count(*) n FROM executions').get()!.n).toBe(0);
 });
 it('keeps old core compatibility while the actual full client requests full recovery for status and retry',async()=>{
  const {db,store}=setup(false);store.stage(release('core-only',0));store.publish('core-only',null);
  expect(await(await homeHttp(db,'status',req('status'))).json()).toMatchObject({state:'ready',fullReady:false});
  const urls:URL[]=[];const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{const url=new URL(String(input),'http://localhost');urls.push(url);return homeHttp(db,url.pathname.split('/').at(-1)!,new Request(url,init));});
  try{
   const changes=db.prepare('SELECT total_changes() n').get()!.n;
   expect(await fullRead<FullRefreshStatus>('status',{})).toMatchObject({state:'updating',fullReady:false,canRetry:true});
   expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(changes);
   db.exec("UPDATE home_refresh SET retry_after=9999999999999,last_error='fixture failed'");
   expect(await retryFull()).toMatchObject({state:'updating',fullReady:false,canRetry:true});
   expect(urls.map(url=>url.searchParams.get('reader'))).toEqual(['full-home-v1','full-home-v1']);
   expect(db.prepare('SELECT retry_after,last_error FROM home_refresh').get()).toMatchObject({retry_after:0,last_error:null});
   expect(store.head()).toBe('core-only');expect(db.prepare('SELECT count(*) n FROM home_release').get()!.n).toBe(1);
  }finally{fetch.mockRestore();}
 });
 it('rejects unknown reader before status or retry can change durable state',async()=>{
  const {db}=setup(false);db.exec("UPDATE home_refresh SET retry_after=9999999999999,last_error='retain me'");
  const before=db.prepare('SELECT total_changes() n').get()!.n;
  for(const operation of ['status','retry']){const response=await homeHttp(db,operation,new Request('http://localhost/api/home/'+operation+'?reader=unknown',{method:operation==='retry'?'POST':'GET'}));expect(response.status).toBe(400);}
  expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(before);expect(db.prepare('SELECT last_error FROM home_refresh').get()!.last_error).toBe('retain me');
 });
 it.each([
  ['null',null],['string','ETF'],['array',[]],['empty object',{}],
  ['missing assetTypes',{openOnly:false,review:'all'}],
  ['missing openOnly',{assetTypes:[],review:'all'}],
  ['missing review',{assetTypes:[],openOnly:false}],
  ['non-array assetTypes',{...emptyFilters,assetTypes:'ETF'}],
  ['non-string assetType',{...emptyFilters,assetTypes:[1]}],
  ['unknown assetType',{...emptyFilters,assetTypes:['期权']}],
  ['mixed unknown assetType',{...emptyFilters,assetTypes:['股票','期权']}],
  ['non-boolean openOnly',{...emptyFilters,openOnly:'false'}],
  ['null openOnly',{...emptyFilters,openOnly:null}],
  ['invalid review',{...emptyFilters,review:'waiting'}],
  ['null review',{...emptyFilters,review:null}],
  ['unknown filter field',{...emptyFilters,unknown:true}],
 ])('rejects malformed filters (%s) across all request reads without writing',async(_label,filters)=>{
  const{db}=setup();const before=db.prepare('SELECT total_changes() n').get()?.n;
  for(const operation of requestOperations){
   const response=await homeHttp(db,operation,req(operation,{request:{...request,filters},version:'r1'}));
   expect(response.status,operation).toBe(400);
   expect(await response.json()).toEqual({error:expect.stringMatching(/无效/)});
  }
  expect(db.prepare('SELECT total_changes() n').get()?.n).toBe(before);
 });
 it.each([
  ['stock',{...emptyFilters,assetTypes:['股票']}],
  ['ETF',{...emptyFilters,assetTypes:['ETF']}],
  ['fund',{...emptyFilters,assetTypes:['基金']}],
  ['all assets',{...emptyFilters,assetTypes:['股票','ETF','基金','股票']}],
  ['open only',{...emptyFilters,openOnly:true}],
  ['pending review',{...emptyFilters,review:'pending'}],
  ['completed review',{...emptyFilters,review:'done'}],
 ])('refuses valid but unsupported filters (%s) instead of returning unfiltered data',async(_label,filters)=>{
  const{db}=setup();const before=db.prepare('SELECT total_changes() n').get()?.n;
  for(const operation of requestOperations){
   const response=await homeHttp(db,operation,req(operation,{request:{...request,filters},version:'r1'}));
   expect(response.status,operation).toBe(422);
   expect(await response.json()).toEqual({error:expect.stringMatching(/筛选.*尚未支持/)});
  }
  expect(db.prepare('SELECT total_changes() n').get()?.n).toBe(before);
 });
 it('treats omitted and explicitly empty filters equally without changing amounts or the three-part stamp',async()=>{
  const{db}=setup();const before=db.prepare('SELECT total_changes() n').get()?.n;
  const base=await homeHttp(db,'core',req('core'));
  const empty=await homeHttp(db,'core',req('core',{request:{...request,filters:emptyFilters}}));
  expect(base.status).toBe(200);expect(empty.status).toBe(200);
  const original=await base.json() as HomeResult,explicit=await empty.json() as HomeResult;
  expect(explicit.metrics).toEqual(original.metrics);expect(explicit.metrics.net.value).toBe('10');
  expect(explicit.holdings).toEqual(original.holdings);expect(explicit.series).toEqual(original.series);
  expect(explicit.metrics.currentMarketValue.value).toBe('9007199254741031.12345678');
  expect(explicit.stamp).toEqual(original.stamp);
  expect(JSON.parse(explicit.stamp.scope)).toEqual(['all','all',{preset:'custom',from:'2026-01-02',to:'2026-01-02'}]);
  for(const operation of ['period','holdings','export']){
   const omitted=await homeHttp(db,operation,req(operation,{request,version:'r1'}));
   const provided=await homeHttp(db,operation,req(operation,{request:{...request,filters:emptyFilters},version:'r1'}));
   expect(omitted.status).toBe(200);expect(provided.status).toBe(200);
   expect(await provided.text()).toBe(await omitted.text());
  }
  expect(db.prepare('SELECT total_changes() n').get()?.n).toBe(before);
 });
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
