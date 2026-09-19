import {afterEach, describe, expect, it, vi} from 'vitest';
import {createIntradayGetForTest} from './route';
const url='http://localhost/api/market-data/intraday?market=CN-SZ&symbol=000519&interval=1h&start=2023-06-20T01%3A00%3A00.000Z&end=2023-06-20T07%3A00%3A00.000Z';
afterEach(()=>vi.useRealTimers());
describe('intraday native source cancellation',()=>{
 it('passes the route deadline to native provider work',async()=>{
  vi.useFakeTimers();let signal: AbortSignal|undefined;
  const get=createIntradayGetForTest((_fetch,sourceSignal)=>{signal=sourceSignal;return {fetchDaily:vi.fn(),fetchIntraday:()=>new Promise(()=>{})};});
  const pending=get(new Request(url));await vi.advanceTimersByTimeAsync(12000);
  expect((await pending).status).toBe(502);expect(signal?.aborted).toBe(true);
 });
 it('aborts native work when the browser cancels the request',async()=>{
  const controller=new AbortController();let signal:AbortSignal|undefined;
  const get=createIntradayGetForTest((_fetch,sourceSignal)=>{signal=sourceSignal;return {fetchDaily:vi.fn(),fetchIntraday:()=>new Promise((_resolve,reject)=>{sourceSignal.addEventListener('abort',()=>reject(sourceSignal.reason),{once:true});})};});
  const pending=get(new Request(url,{signal:controller.signal}));controller.abort();
  expect(signal?.aborted).toBe(true);expect((await pending).status).toBe(502);
 });
});
