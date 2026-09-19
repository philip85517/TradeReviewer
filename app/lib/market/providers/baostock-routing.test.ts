import {describe, expect, it, vi} from 'vitest';
import type {IntradayCandleRequest, IntradayProviderResult, MarketDataProvider} from '../contracts';
import {createProviderRouter} from './router';

const request: IntradayCandleRequest={instrumentId:'CN-SZ:000519',symbol:'000519',market:'CN-SZ',interval:'1h',startTime:'2023-06-20T01:00:00.000Z',endTime:'2023-06-20T07:00:00.000Z'};
function historicalProvider(): MarketDataProvider {
 return {id:'baostock',supports:market=>market==='CN-SH'||market==='CN-SZ',fetchDaily:vi.fn(),fetchIntraday:vi.fn(async():Promise<IntradayProviderResult>=>({provider:'baostock',providerSymbol:'sz.000519',interval:'1h',fetchedAt:'2026-09-15T00:00:00.000Z',warnings:[],candles:[{timestamp:'2023-06-20T01:30:00.000Z',knowledgeAt:'2023-06-20T02:30:00.000Z',open:'17.85',high:'18.04',low:'17.68',close:'18.02',volume:'8922397'}]}))};
}
describe('BaoStock historical hourly routing',()=>{
 it('uses anonymous historical bars after the recent Tencent window fails',async()=>{
  const provider=historicalProvider(),fetcher=vi.fn(async()=>new Response('unavailable',{status:503}));
  const router=createProviderRouter(fetcher,{baostockProvider:provider});
  const result=await router.fetchIntraday(request);
  expect(result.provider).toBe('baostock');expect(result.candles[0]?.close).toBe('18.02');expect(provider.fetchIntraday).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls).toHaveLength(1);
 });
 it('does not send Hong Kong requests to BaoStock',async()=>{
  const provider=historicalProvider(),fetcher=vi.fn(async()=>new Response('unavailable',{status:503}));
  const router=createProviderRouter(fetcher,{baostockProvider:provider});
  await expect(router.fetchIntraday({...request,instrumentId:'HK:700',symbol:'700',market:'HK'})).rejects.toThrow();
  expect(provider.fetchIntraday).not.toHaveBeenCalled();
 });
});
