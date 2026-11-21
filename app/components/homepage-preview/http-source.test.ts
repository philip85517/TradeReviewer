import {describe,expect,it,vi} from 'vitest';
import {createHttpSource} from './http-source';
import {createMockSource,DEFAULT_REQUEST} from './mock-source';
import {parseLocation} from './location-state';
import {DatabaseSync} from 'node:sqlite';
import {initializeSqlite} from '../../../db/sqlite';
import {HomeStore} from '../../lib/home/store';
import {homeHttp} from '../../lib/home/http';
import {release,request as publishedRequest} from '../../lib/home/test-fixtures';
import type {HomeFilters,HomeView} from './display-contract';
const emptyFilters:HomeFilters={assetTypes:[],openOnly:false,review:'all'};
describe('HTTP homepage adapter',()=>{
 it.each([
  {assetTypes:['ETF'],openOnly:false,review:'all'},
  {assetTypes:['基金'],openOnly:false,review:'all'},
  {assetTypes:[],openOnly:true,review:'all'},
  {assetTypes:[],openOnly:false,review:'pending'},
  {assetTypes:[],openOnly:false,review:'done'},
 ] satisfies HomeFilters[])('reads a whole core result for a filters-only change (%j)',async filters=>{
  const signal=new AbortController().signal;
  const previous=await createMockSource({scenario:'normal',delayMs:0}).readHome(DEFAULT_REQUEST,signal);
  const request={...DEFAULT_REQUEST,filters};
  const replacement={...previous,request,metrics:{...previous.metrics,net:{...previous.metrics.net,value:'321.09'}},holdings:{...previous.holdings,rows:[]}};
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json(replacement));const source=createHttpSource(fetcher);
  const next=await source.readChange!(previous,request,signal);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const called=new URL(String(fetcher.mock.calls[0][0]),'http://localhost');
  expect(called.pathname).toBe('/api/home/core');
  expect(JSON.parse(called.searchParams.get('request')!)).toEqual(request);
  expect(next.request.filters).toEqual(filters);expect(next.metrics.net.value).toBe('321.09');expect(next.holdings.rows).toEqual([]);
  expect(previous.request.filters).toBeUndefined();expect(previous.holdings.rows).toHaveLength(8);
 });
 it('propagates a real unsupported-filter response without relabelling or returning the old result',async()=>{
  const db=new DatabaseSync(':memory:');
  try{
   initializeSqlite(db);const store=new HomeStore(db);store.stage(release());store.publish('r1',null);
   const signal=new AbortController().signal;
   const previous=await(await homeHttp(db,'core',new Request(`http://localhost/api/home/core?request=${encodeURIComponent(JSON.stringify(publishedRequest))}`))).json() as HomeView;
   const before=JSON.stringify(previous),writes=db.prepare('SELECT total_changes() n').get()?.n;
   const fetcher=vi.fn(async(input:RequestInfo|URL)=>{const url=new URL(String(input),'http://localhost');return homeHttp(db,url.pathname.split('/').at(-1)!,new Request(url));});
   const source=createHttpSource(fetcher);
   await expect(source.readChange!(previous,{...publishedRequest,filters:{...emptyFilters,openOnly:true}},signal)).rejects.toThrow(/筛选.*尚未支持/);
   expect(fetcher).toHaveBeenCalledTimes(1);expect(String(fetcher.mock.calls[0][0])).toContain('/core?');
   expect(JSON.stringify(previous)).toBe(before);expect(db.prepare('SELECT total_changes() n').get()?.n).toBe(writes);
  }finally{db.close();}
 });
 it.each([false,true])('avoids a core read for omitted/empty filter equivalence (empty first: %s)',async emptyFirst=>{
  const signal=new AbortController().signal,first={...DEFAULT_REQUEST,...(emptyFirst?{filters:emptyFilters}:{})};
  const previous=await createMockSource({scenario:'normal',delayMs:0}).readHome(first,signal);
  const fetcher=vi.fn(async()=>{throw new Error('equivalent filters must not fetch');});
  const next=await createHttpSource(fetcher).readChange!(previous,{...DEFAULT_REQUEST,...(emptyFirst?{}:{filters:emptyFilters})},signal);
  expect(fetcher).not.toHaveBeenCalled();expect(next.metrics).toBe(previous.metrics);expect(next.holdings).toBe(previous.holdings);
 });
 it('ignores asset order and duplicates when deciding whether filters changed',async()=>{
  const signal=new AbortController().signal;
  const previous=await createMockSource({scenario:'normal',delayMs:0}).readHome({...DEFAULT_REQUEST,filters:{...emptyFilters,assetTypes:['股票','ETF','基金']}},signal);
  const fetcher=vi.fn(async()=>{throw new Error('equivalent filters must not fetch');});
  const next=await createHttpSource(fetcher).readChange!(previous,{...DEFAULT_REQUEST,filters:{...emptyFilters,assetTypes:['基金','ETF','股票','ETF']}},signal);
  expect(fetcher).not.toHaveBeenCalled();expect(next.metrics).toBe(previous.metrics);
 });
 it('preserves the period-only optimization when empty filters are made explicit',async()=>{
  const signal=new AbortController().signal,request={...DEFAULT_REQUEST,filters:emptyFilters,period:{preset:'month' as const,from:'2026-10-01',to:'2026-10-15'}};
  const previous=await createMockSource({scenario:'normal',delayMs:0}).readHome(DEFAULT_REQUEST,signal);
  const stamp={...previous.stamp,scope:JSON.stringify([request.market,request.accountId,request.period])};
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({stamp,period:{net:previous.metrics.net,realized:previous.metrics.periodRealized,unrealizedChange:previous.metrics.unrealizedChange,effectiveEnd:request.period.to,points:[]}}));
  const next=await createHttpSource(fetcher).readChange!(previous,request,signal);
  expect(fetcher).toHaveBeenCalledTimes(1);expect(String(fetcher.mock.calls[0][0])).toContain('/period?');
  expect(next.holdings).toBe(previous.holdings);expect(next.request.period).toEqual(request.period);
 });
 it('preserves real account identities in restored URLs',()=>{
  expect(parseLocation('?account=broker-actual',{...DEFAULT_REQUEST,accountId:'all'},true).request.accountId).toBe('broker-actual');
 });
 it('uses only the holdings endpoint for pagination and keeps the complete version and metrics',async()=>{
  const previous=await createMockSource({scenario:'normal',delayMs:0}).readHome(DEFAULT_REQUEST,new AbortController().signal);
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({stamp:previous.stamp,holdings:{...previous.holdings,page:2,rows:previous.holdings.rows.slice(0,1)}}));
  const source=createHttpSource(fetcher);const next=await source.readChange!(previous,{...DEFAULT_REQUEST,filters:emptyFilters,page:2},new AbortController().signal);
  expect(String(fetcher.mock.calls[0][0])).toContain('/holdings?');expect(fetcher).toHaveBeenCalledTimes(1);
  expect(next.metrics).toBe(previous.metrics);expect(next.series).toBe(previous.series);expect(next.stamp.version).toBe(previous.stamp.version);expect(next.holdings.page).toBe(2);
 });
 it('refuses to combine partial results from a different version',async()=>{
  const previous=await createMockSource({scenario:'normal',delayMs:0}).readHome(DEFAULT_REQUEST,new AbortController().signal);
  const source=createHttpSource(async()=>Response.json({stamp:{...previous.stamp,version:'other'},holdings:previous.holdings}));
  await expect(source.readChange!(previous,{...DEFAULT_REQUEST,page:2},new AbortController().signal)).rejects.toThrow(/版本/);
 });
});
