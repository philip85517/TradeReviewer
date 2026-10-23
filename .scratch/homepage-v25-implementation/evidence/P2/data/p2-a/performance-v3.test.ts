import { expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { prepareHomepageV25Source, projectHomepageV25Boundaries, inspectHomepageV25PreparedSource } from "../../../../../../app/lib/reviews/homepage-v25-performance";
import * as canonical from "../../../../../../app/lib/replay/position-ledger";
import { expectedTradingDates } from "../../../../../../app/lib/market/calendar";
import { buildInstrumentTradeSummaries } from "../../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../../app/lib/trades/library";
import type { TradeExecution } from "../../../../../../app/lib/trades/types";

it("measures captured-source cold/repeat, exact work, memory and all365 independent oracles",()=>{
  const sample=process.env.P2_SAMPLE??"unset",shape=process.env.P2_SHAPE??"rounds";
  const path=`.scratch/homepage-v25-implementation/evidence/P2/data/p2-a/benchmark-v3-${shape}-${sample}.json`;
  const report:Record<string,unknown>={runtime:process.version,node:process.execPath,sample,shape,fixture:{fills:1866,endpoints:365,nature:"controlled explicit live original lineage; no database"},startedAt:new Date().toISOString()};
  const stage=(name:string,more:Record<string,unknown>={})=>{Object.assign(report,more,{stage:name,stageStartedAt:Date.now()});writeFileSync(path,JSON.stringify(report,null,2));};
  const instrument={id:"US:AAPL",market:"US",symbol:"AAPL",name:"Apple",currency:"USD"};
  const day=(i:number)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10);
  const executions:TradeExecution[]=Array.from({length:1866},(_,i)=>({id:`controlled-fill-${i}`,accountId:"a",accountLabel:"A",instrument,side:shape==="long-prefix"?"buy":i%2?"sell":"buy",quantity:"1",price:shape==="long-prefix"?"100":i%2?"101":"100",fee:"0",executedAt:new Date(Date.parse(`${day(Math.floor(i*365/1866))}T14:00:00Z`)+i).toISOString(),source:{platform:"controlled-scaling",row:i,tradeNature:"live",positionEffect:shape==="long-prefix"?"open-long":i%2?"close-long":"open-long"}}));
  const dates=expectedTradingDates("US","2025-12-31","2026-12-31");
  const candlesByInstrument={"US:AAPL":dates.map(tradingDate=>({instrumentId:instrument.id,tradingDate,open:"110",high:"110",low:"110",close:"110",volume:"1",currency:"USD",adjustmentMode:"raw" as const,provider:"controlled",providerSymbol:"AAPL",fetchedAt:`${tradingDate}T23:00:00Z`}))};
  const start=performance.now();stage("upstream");
  const entries=buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions),candlesByInstrument,{"US:AAPL":"ready"});
  const upstreamMs=performance.now()-start;
  const input={entries,candlesByInstrument,fxObservations:[],currentFxSnapshot:null,lifetimeSourceCoverage:[],revisions:{trades:`controlled1866-${shape}`,quotes:"full-sessions",fx:"none",metadata:"none"}};
  const request={periodStart:"2026-01-01",asOf:"2027-01-01T23:00:00Z",endpoints:Array.from({length:365},(_,i)=>({key:day(i),at:day(i)}))};
  let preparations=0,preparedQueries=0,ordinaryTransitions=0,legacyCalls=0;
  const prepareOriginal=canonical.preparePositionLedger,queryOriginal=canonical.replayPreparedPositionBoundaries,legacyOriginal=canonical.replayPositionAtPrice;
  const prepareSpy=vi.spyOn(canonical,"preparePositionLedger").mockImplementation(input=>{preparations++;const result=prepareOriginal(input);ordinaryTransitions+=result.diagnostics.transitions;return result;});
  const querySpy=vi.spyOn(canonical,"replayPreparedPositionBoundaries").mockImplementation((...args)=>{preparedQueries++;return queryOriginal(...args);});
  const legacySpy=vi.spyOn(canonical,"replayPositionAtPrice").mockImplementation(input=>{legacyCalls++;return legacyOriginal(input);});
  try{
    const heapBeforePrepare=process.memoryUsage().heapUsed;stage("prepare",{upstreamMs,heapBeforePrepare,entries:entries.length,rawFillsInEntries:entries.reduce((n,e)=>n+e.executions.length,0),quotes:dates.length});
    const coldStart=performance.now(),source=prepareHomepageV25Source(input),prepareMs=performance.now()-coldStart,heapAfterPrepare=process.memoryUsage().heapUsed;
    stage("batch",{prepareMs,heapAfterPrepare});const batchStart=performance.now();
    const batch=projectHomepageV25Boundaries(source,request),batchMs=performance.now()-batchStart,coldMs=performance.now()-coldStart;
    const afterCold=inspectHomepageV25PreparedSource(source),heapAfterCold=process.memoryUsage().heapUsed;
    stage("repeat",{batchMs,coldMs,afterCold,heapAfterCold,work:{preparations,ordinaryTransitions,preparedQueries,legacyCalls}});
    const beforeRepeatQueries=preparedQueries,repeatStart=performance.now(),repeat=projectHomepageV25Boundaries(source,request),repeatMs=performance.now()-repeatStart,afterRepeat=inspectHomepageV25PreparedSource(source);
    const serializationStart=performance.now(),json=JSON.stringify(batch),serializationMs=performance.now()-serializationStart;
    const expected=Array.from({length:365},(_,i)=>{
      const visible=executions.filter(e=>Date.parse(e.executedAt)<=Date.parse(`${day(i)}T15:59:59.999Z`)).length;
      return shape==="long-prefix"?String(visible*10):String(Math.floor(visible/2)+(visible%2?10:0));
    });
    stage("complete",{repeatMs,repeatAdditionalCanonicalQueries:preparedQueries-beforeRepeatQueries,afterRepeat,heapAfterRepeat:process.memoryUsage().heapUsed,serializationMs,serializationBytes:Buffer.byteLength(json),lastNet:batch.points.at(-1)?.net.value,currentMV:batch.current.currentMarketValue.value,all365OraclesMatch:batch.points.every((point,i)=>point.net.value===expected[i]),coldGoalMet:coldMs<=2000,repeatGoalMet:repeatMs<=200});
    expect(batch.points.map(p=>p.net.value)).toEqual(expected);expect(repeat).toBe(batch);expect(legacyCalls).toBe(0);expect(preparations).toBe(1);expect(ordinaryTransitions).toBe(1866);expect(preparedQueries-beforeRepeatQueries).toBe(0);
    expect(afterRepeat.cacheEntries).toBeLessThanOrEqual(8192);expect(afterRepeat.cacheEstimatedBytes).toBeLessThanOrEqual(64*1024*1024);expect(afterRepeat.batchEntries).toBe(1);expect(afterRepeat.batchCacheHits).toBe(1);
    expect(coldMs).toBeLessThanOrEqual(2000);expect(repeatMs).toBeLessThanOrEqual(200);
  }finally{prepareSpy.mockRestore();querySpy.mockRestore();legacySpy.mockRestore();}
},120000);
