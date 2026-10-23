import { expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { prepareHomepageV25Source, projectHomepageV25Boundaries, inspectHomepageV25PreparedSource } from "../../../../../../app/lib/reviews/homepage-v25-performance";
import { expectedTradingDates } from "../../../../../../app/lib/market/calendar";
import { buildInstrumentTradeSummaries } from "../../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../../app/lib/trades/library";
import type { TradeExecution } from "../../../../../../app/lib/trades/types";

const base=".scratch/homepage-v25-implementation/evidence/P2/data/p2-a/";
const instruments=[{id:"US:AAPL",market:"US",symbol:"AAPL",name:"US",currency:"USD"},{id:"HK:00700",market:"HK",symbol:"00700",name:"HK",currency:"HKD"},{id:"CN-SH:600000",market:"CN-SH",symbol:"600000",name:"CN",currency:"CNY"}];
const day=(i:number)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10);
const raw=(instrument:typeof instruments[number],tradingDate:string)=>({instrumentId:instrument.id,tradingDate,open:"110",high:"110",low:"110",close:"110",volume:"1",currency:instrument.currency,adjustmentMode:"raw" as const,provider:"controlled",providerSymbol:instrument.symbol,fetchedAt:`${tradingDate}T23:00:00Z`});
const revisions={trades:"controlled-variants",quotes:"complete-sessions",fx:"controlled-dated-observations",metadata:"none"};

it("measures fixed 3-account/3-market 1866-fill 365-day shape and three exact repeats",()=>{
  const startedAt=new Date().toISOString();
  const executions:TradeExecution[]=Array.from({length:1866},(_,i)=>({id:`variant-${i}`,accountId:`a${i%3}`,accountLabel:`A${i%3}`,instrument:instruments[i%3],side:"buy",quantity:"1",price:"100",fee:"0",executedAt:new Date(Date.parse(`${day(Math.floor(i*365/1866))}T14:00:00Z`)+i).toISOString(),source:{platform:"controlled-scaling",row:i,tradeNature:"live",positionEffect:"open-long"}}));
  const candlesByInstrument=Object.fromEntries(instruments.map(instrument=>[instrument.id,expectedTradingDates(instrument.market,"2025-12-31","2026-12-31").map(date=>raw(instrument,date))]));
  const fxObservations=Array.from({length:365},(_,i)=>{const date=day(i),at=`${date}T00:00:00Z`;return {id:`controlled-fx-${date}`,source:"controlled-historical-fixture",sourceRevision:"fixture-1",businessDate:date,rates:{"USD/CNY":"7","HKD/CNY":"0.9"},status:"complete" as const,publishedAtByPair:{"USD/CNY":at,"HKD/CNY":at},knownAtByPair:{"USD/CNY":at,"HKD/CNY":at},fetchedAt:at,evidenceIds:[`fixture-fx-${date}`]};});
  const upstreamStart=performance.now(),entries=buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions),candlesByInstrument,Object.fromEntries(instruments.map(i=>[i.id,"ready" as const]))),upstreamMs=performance.now()-upstreamStart;
  const heapBefore=process.memoryUsage().heapUsed,coldStart=performance.now(),source=prepareHomepageV25Source({entries,candlesByInstrument,fxObservations,currentFxSnapshot:null,lifetimeSourceCoverage:[],revisions}),prepareMs=performance.now()-coldStart;
  const request={periodStart:"2026-01-01",asOf:"2027-01-01T23:00:00Z",targetCurrency:"CNY",endpoints:Array.from({length:365},(_,i)=>({key:day(i),at:day(i)}))};
  const queryStart=performance.now(),batch=projectHomepageV25Boundaries(source,request),batchMs=performance.now()-queryStart,coldMs=performance.now()-coldStart;
  const beforeRepeat=inspectHomepageV25PreparedSource(source),repeats=[];
  for(let i=0;i<3;i++){const start=performance.now(),again=projectHomepageV25Boundaries(source,request);repeats.push({ms:performance.now()-start,identical:again===batch});}
  const afterRepeat=inspectHomepageV25PreparedSource(source),serializationStart=performance.now(),json=JSON.stringify(batch),serializationMs=performance.now()-serializationStart;
  const expected=Array.from({length:365},(_,i)=>{const counts=[0,0,0],cursor=Date.parse(`${day(i)}T15:59:59.999Z`);executions.forEach((e,index)=>{if(Date.parse(e.executedAt)<=cursor)counts[index%3]++;});return String(counts[0]*70+counts[1]*9+counts[2]*10);});
  const report={startedAt,endedAt:new Date().toISOString(),runtime:process.version,fixture:{fills:executions.length,accounts:3,markets:3,endpoints:365,entries:entries.length,rawFillsInEntries:entries.reduce((n,e)=>n+e.executions.length,0),quotes:Object.values(candlesByInstrument).reduce((n,q)=>n+q.length,0),historicalFxObservations:fxObservations.length,nature:"controlled explicit live original lineage; no database"},upstreamMs,prepareMs,batchMs,coldMs,repeats,beforeRepeat,afterRepeat,heapBefore,heapAfterSerialization:process.memoryUsage().heapUsed,serializationMs,serializationBytes:Buffer.byteLength(json),all365OraclesMatch:batch.points.every((p,i)=>p.net.value===expected[i]),lastNet:batch.points.at(-1)?.net.value};
  writeFileSync(base+"41-final-multimarket.json",JSON.stringify(report,null,2));
  expect(batch.points.map(p=>p.net.value)).toEqual(expected);expect(afterRepeat.cacheEstimatedBytes).toBeLessThanOrEqual(64*1024*1024);expect(afterRepeat.batchEntries).toBeLessThanOrEqual(4);
},120000);

it("measures exact attached late-refund contexts without overwriting early knowledge",()=>{
  const instrument=instruments[0],common={accountId:"a",market:"US",symbol:"AAPL",currency:"USD",source:[{page:1,row:2}]};
  const executions:TradeExecution[]=[{id:"sale",accountId:"a",accountLabel:"A",instrument,side:"sell",quantity:"1",price:"120",fee:"1",executedAt:"2026-01-15T15:00:00Z",source:{platform:"statement",row:1,tradeNature:"live",positionEvents:[
    {...common,id:"application",kind:"ipo",date:"2026-01-08",amount:"-220",description:"IPO application"},
    {...common,id:"fee",kind:"fee",date:"2026-01-08",amount:"-2",description:"IPO fee"},
    {...common,id:"allocation",kind:"ipo",date:"2026-01-10",quantity:"2",displayTimePolicy:"session-open",description:"IPO allocation"},
    {...common,id:"refund",kind:"ipo",date:"2026-01-20",amount:"20",description:"IPO refund"}
  ]}}];
  const candlesByInstrument={[instrument.id]:["2026-01-16","2026-01-21","2026-01-30"].map(date=>raw(instrument,date))},entries=buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions),candlesByInstrument,{[instrument.id]:"ready"});
  const startedAt=new Date().toISOString(),start=performance.now(),source=prepareHomepageV25Source({entries,candlesByInstrument,fxObservations:[],currentFxSnapshot:null,lifetimeSourceCoverage:[],revisions}),prepareMs=performance.now()-start;
  const query={periodStart:"2026-01-01",asOf:"2026-02-02T10:00:00Z",endpoints:[{key:"late",at:"2026-01-22T10:00:00Z"},{key:"early",at:"2026-01-18"}]};
  const queryStart=performance.now(),first=projectHomepageV25Boundaries(source,query),batchMs=performance.now()-queryStart;
  const reversed=projectHomepageV25Boundaries(source,{...query,endpoints:[...query.endpoints].reverse()});
  const repeats=[];for(let i=0;i<3;i++){const at=performance.now(),again=projectHomepageV25Boundaries(source,query);repeats.push({ms:performance.now()-at,identical:again===first});}
  const values=(point:typeof first.points[number])=>({key:point.key,fees:point.periodFees.value,realized:point.periodRealized.value,unrealized:point.unrealizedNet.value,net:point.net.value,openFees:point.openFees.value,canonicalFees:point.instruments[0].canonicalKnownFees.value});
  const report={startedAt,endedAt:new Date().toISOString(),runtime:process.version,fixture:{fills:1,events:4,accounts:1,markets:1,endpoints:2,quotes:3,historicalFxObservations:0},prepareMs,batchMs,coldMs:performance.now()-start,repeats,diagnostics:inspectHomepageV25PreparedSource(source),first:first.points.map(values),reverse:reversed.points.map(values)};
  writeFileSync(base+"42-final-late-refund.json",JSON.stringify(report,null,2));
  expect(report.first).toEqual([{key:"late",fees:"3",realized:"18",unrealized:"9",net:"27",openFees:"1",canonicalFees:"3"},{key:"early",fees:"3",realized:null,unrealized:null,net:null,openFees:null,canonicalFees:"1"}]);
  expect(report.reverse).toEqual([...report.first].reverse());expect(report.diagnostics.canonicalSweeps).toBe(0);expect(report.diagnostics.canonicalCalls).toBeGreaterThan(0);expect(repeats.every(r=>r.identical)).toBe(true);
});
