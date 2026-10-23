import { expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { prepareHomepageV25Source, projectHomepageV25Boundaries } from "../../../../../../app/lib/reviews/homepage-v25-performance";
import * as canonical from "../../../../../../app/lib/replay/position-ledger";
import { expectedTradingDates } from "../../../../../../app/lib/market/calendar";
import { buildInstrumentTradeSummaries } from "../../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../../app/lib/trades/library";
import type { TradeExecution } from "../../../../../../app/lib/trades/types";
const path = ".scratch/homepage-v25-implementation/evidence/P2/data/p2-a/06-performance.json";
it("measures real canonical 1866 fills by 365 endpoints, without 365 full builders", () => {
 const instrument = { id: "US:AAPL", market: "US", symbol: "AAPL", name: "Apple", currency: "USD" };
 const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0,10);
 const executions: TradeExecution[] = Array.from({length:1866}, (_,i) => ({ id:`controlled-fill-${i}`,accountId:"a",accountLabel:"A",instrument,side:i%2 ? "sell":"buy",quantity:"1",price:i%2 ? "101":"100",fee:"0",executedAt:`${day(Math.floor(i*365/1866))}T14:${String(i%60).padStart(2,"0")}:00Z`,source:{platform:"controlled-scaling",row:i,tradeNature:"live",positionEffect:i%2 ? "close-long":"open-long"} }));
 // Within a day preserve the exact alternating source order independently of
 // synthetic clock minutes, so every sell has its preceding open.
 executions.forEach((e,i)=>{e.executedAt=new Date(Date.parse(`${day(Math.floor(i*365/1866))}T14:00:00Z`)+(i%6)*1000).toISOString();});
 const dates = expectedTradingDates("US","2025-12-31","2026-12-31");
 const quotes = { "US:AAPL":dates.map(tradingDate=>({instrumentId:instrument.id,tradingDate,open:"110",high:"110",low:"110",close:"110",volume:"1",currency:"USD",adjustmentMode:"raw" as const,provider:"controlled",providerSymbol:"AAPL",fetchedAt:`${tradingDate}T23:00:00Z`})) };
 const upstreamStart=performance.now();
 const entries=buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions),quotes,{"US:AAPL":"ready"});
 const upstreamMs=performance.now()-upstreamStart;
 const input={entries,candlesByInstrument:quotes,fxObservations:[],currentFxSnapshot:null,lifetimeSourceCoverage:[],revisions:{trades:"controlled1866",metadata:"none",quotes:"all-sessions",fx:"none"}};
 const query={periodStart:"2026-01-01",asOf:"2027-01-01T23:00:00Z",endpoints:Array.from({length:365},(_,i)=>({key:day(i),at:day(i)}))};
 const original=canonical.replayPositionAtPrice;
 let calls=0,prefixMembers=0;
 const spy=vi.spyOn(canonical,"replayPositionAtPrice").mockImplementation(input=>{calls++;prefixMembers+=input.visibleExecutionIds?.length??0;return original(input);});
 const samples: unknown[]=[];
 const report={runtime:process.version,fixture:{fills:executions.length,groups:1,endpoints:365,quotes:dates.length,nature:"controlled explicit live, no database rows rewritten"},upstreamMs,samples};
 try {
  for(let sample=0;sample<3;sample++){
   calls=0;prefixMembers=0;
   const heapBefore=process.memoryUsage().heapUsed,started=performance.now(),source=prepareHomepageV25Source(input),preparedAt=performance.now(),batch=projectHomepageV25Boundaries(source,query),completed=performance.now();
   const coldMs=completed-started,canonicalCalls=calls,selectedPrefixMembers=prefixMembers;
   const repeatStart=performance.now(),repeat=projectHomepageV25Boundaries(source,query),repeatMs=performance.now()-repeatStart;
   samples.push({sample,prepareMs:preparedAt-started,batchMs:completed-preparedAt,coldMs,repeatMs,canonicalCalls,selectedPrefixMembers,repeatAdditionalCanonicalCalls:calls-canonicalCalls,diagnostics:batch.diagnostics,heapBefore,heapAfter:process.memoryUsage().heapUsed,lastNet:batch.points.at(-1)?.net.value});
   writeFileSync(path,JSON.stringify(report,null,2));
   expect(repeat).toBe(batch);expect(batch.points.at(-1)?.net.value).toBe("933");expect(batch.current.currentMarketValue.value).toBe("0");
   expect(batch.diagnostics.canonicalCalls).toBe(canonicalCalls);
  }
 }finally{spy.mockRestore();writeFileSync(path,JSON.stringify(report,null,2));}
},180000);
