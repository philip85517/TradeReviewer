import {describe,expect,it,vi} from 'vitest';
import {createHttpSource} from './http-source';
import {createMockSource,DEFAULT_REQUEST} from './mock-source';
import {parseLocation} from './location-state';
describe('HTTP homepage adapter',()=>{
 it('preserves real account identities in restored URLs',()=>{
  expect(parseLocation('?account=broker-actual',{...DEFAULT_REQUEST,accountId:'all'},true).request.accountId).toBe('broker-actual');
 });
 it('uses only the holdings endpoint for pagination and keeps the complete version and metrics',async()=>{
  const previous=await createMockSource({scenario:'normal',delayMs:0}).readHome(DEFAULT_REQUEST,new AbortController().signal);
  const fetcher=vi.fn(async(_input:RequestInfo|URL,_init?:RequestInit)=>Response.json({stamp:previous.stamp,holdings:{...previous.holdings,page:2,rows:previous.holdings.rows.slice(0,1)}}));
  const source=createHttpSource(fetcher);const next=await source.readChange!(previous,{...DEFAULT_REQUEST,page:2},new AbortController().signal);
  expect(String(fetcher.mock.calls[0][0])).toContain('/holdings?');expect(fetcher).toHaveBeenCalledTimes(1);
  expect(next.metrics).toBe(previous.metrics);expect(next.series).toBe(previous.series);expect(next.stamp.version).toBe(previous.stamp.version);expect(next.holdings.page).toBe(2);
 });
 it('refuses to combine partial results from a different version',async()=>{
  const previous=await createMockSource({scenario:'normal',delayMs:0}).readHome(DEFAULT_REQUEST,new AbortController().signal);
  const source=createHttpSource(async()=>Response.json({stamp:{...previous.stamp,version:'other'},holdings:previous.holdings}));
  await expect(source.readChange!(previous,{...DEFAULT_REQUEST,page:2},new AbortController().signal)).rejects.toThrow(/版本/);
 });
});
