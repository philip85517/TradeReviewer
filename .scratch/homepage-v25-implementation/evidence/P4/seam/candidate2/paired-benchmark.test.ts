import { expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import * as candidate from "../../../../../../app/lib/reviews/homepage-v25-performance";
import * as canonical from "../../../../../../app/lib/replay/position-ledger";
import * as frozen from "../../../P2/data/calendar-resume/input-oracle";
import { entriesFor, largeFixture, publicJson } from "../../../P2/data/immutable-sharing/fixtures";
const base=".scratch/homepage-v25-implementation/evidence/P4/seam/candidate2/paired/";

it("measures the unchanged 1866x365 fixture, complete cold and three admitted exact repeats",()=>{
  const shape=process.env.P2_SHAPE,sample=process.env.P2_SAMPLE,run=process.env.P2_RUN??"worker";
  if(shape!=="rounds"&&shape!=="long-prefix"&&shape!=="multimarket")throw new Error("P2_SHAPE must be rounds, long-prefix or multimarket");
  if(!sample||!/^[123]$/.test(sample)||!/^[a-z0-9-]+$/.test(run))throw new Error("P2_SAMPLE must be 1,2,3 and P2_RUN a safe new report prefix");
  const path=base+`${run}-${shape}-${sample}.json`;
  const report:Record<string,unknown>={startedAt:new Date().toISOString(),variant:process.env.P4_VARIANT,runtime:process.version,node:process.execPath,shape,sample,run,stage:"fixture",goals:{coldPreparePlusProjectMs:2000,eachRepeatMs:200,cacheEstimatedBytes:64*1024*1024}};
  const save=(stage:string,extra:Record<string,unknown>={})=>{Object.assign(report,extra,{stage});writeFileSync(path,JSON.stringify(report,null,2));};
  const fixture=largeFixture(shape),{executions,candlesByInstrument,fxObservations,request,expected,revisions}=fixture;
  const upstreamStart=performance.now(),entries=entriesFor(executions,candlesByInstrument),upstreamMs=performance.now()-upstreamStart;
  const input={entries,candlesByInstrument,fxObservations,currentFxSnapshot:null,lifetimeSourceCoverage:[],revisions};
  const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
  save("ready",{upstreamMs,fixture:{fills:executions.length,accounts:new Set(executions.map(e=>e.accountId)).size,markets:new Set(executions.map(e=>e.instrument.market)).size,endpoints:request.endpoints.length,entries:entries.length,rawFillsInEntries:entries.reduce((n,e)=>n+e.executions.length,0),quotes:Object.values(candlesByInstrument).reduce((n,q)=>n+q.length,0),historicalFxObservations:fxObservations.length,inputSha256:sha(JSON.stringify(input)),requestSha256:sha(JSON.stringify(request)),nature:"unchanged controlled explicit live original lineage; no database"}});
  let preparations=0,preparedQueries=0,ordinaryTransitions=0,legacyCalls=0;
  const prepareOriginal=canonical.preparePositionLedger,queryOriginal=canonical.replayPreparedPositionBoundaries,legacyOriginal=canonical.replayPositionAtPrice;
  const prepareSpy=vi.spyOn(canonical,"preparePositionLedger").mockImplementation(input=>{preparations++;const result=prepareOriginal(input);ordinaryTransitions+=result.diagnostics.transitions;return result;});
  const querySpy=vi.spyOn(canonical,"replayPreparedPositionBoundaries").mockImplementation((...args)=>{preparedQueries++;return queryOriginal(...args);});
  const legacySpy=vi.spyOn(canonical,"replayPositionAtPrice").mockImplementation(input=>{legacyCalls++;return legacyOriginal(input);});
  const repeats:{ms:number;identical:boolean;additionalCanonicalQueries:number}[]=[];
  let batch:ReturnType<typeof candidate.projectHomepageV25Boundaries>,coldMs=Infinity,afterCold:ReturnType<typeof candidate.inspectHomepageV25PreparedSource>,afterRepeat:ReturnType<typeof candidate.inspectHomepageV25PreparedSource>;
  try{
    const heapBefore=process.memoryUsage().heapUsed,coldStart=performance.now(),source=candidate.prepareHomepageV25Source(input),prepareMs=performance.now()-coldStart;
    const batchStart=performance.now();batch=candidate.projectHomepageV25Boundaries(source,request);const batchMs=performance.now()-batchStart;coldMs=performance.now()-coldStart;
    afterCold=candidate.inspectHomepageV25PreparedSource(source);
    for(let i=0;i<3;i++){const beforeQueries=preparedQueries,start=performance.now(),again=candidate.projectHomepageV25Boundaries(source,request);repeats.push({ms:performance.now()-start,identical:again===batch,additionalCanonicalQueries:preparedQueries-beforeQueries});}
    afterRepeat=candidate.inspectHomepageV25PreparedSource(source);
    save("candidate-measured",{prepareMs,batchMs,coldMs,repeats,afterCold,afterRepeat,heapBefore,heapAfterRepeat:process.memoryUsage().heapUsed,work:{preparations,ordinaryTransitions,preparedQueries,legacyCalls},all365OraclesMatch:batch.points.every((point,i)=>point.net.value===expected[i]),lastNet:batch.points.at(-1)?.net.value,currentMarketValue:batch.current.currentMarketValue.value,coldGoalMet:coldMs<=2000,repeatGoalMet:repeats.every(r=>r.ms<=200),admitted:afterRepeat.batchEntries===1&&repeats.every(r=>r.identical)});
  }finally{prepareSpy.mockRestore();querySpy.mockRestore();legacySpy.mockRestore();}
  // Frozen baseline work and all serialization/graph walks occur AFTER timing.
  const frozenStart=performance.now(),expectedBatch=frozen.projectHomepageV25Boundaries(frozen.prepareHomepageV25Source(input),request),frozenComparisonMs=performance.now()-frozenStart;
  const serializationStart=performance.now(),actualJson=publicJson(batch),expectedJson=publicJson(expectedBatch),serializationMs=performance.now()-serializationStart,bytesEqual=actualJson===expectedJson;
  const seen=new Set<object>();let objects=0,allFrozen=true;
  const visit=(node:unknown)=>{if(!node||typeof node!=="object"||seen.has(node))return;seen.add(node);objects++;allFrozen&&=Object.isFrozen(node);Object.values(node).forEach(visit);};visit(batch);
  const metricValues=batch.points.flatMap(p=>[p,...p.instruments]).flatMap(p=>[p.periodRealized,p.openingUnrealized,p.closingUnrealized,p.unrealizedChange,p.net,p.lifetimeRealizedNet,p.lifetimeNet,p.marketValue,p.unrealizedNet,p.openFees,p.periodFees]);
  save("complete",{endedAt:new Date().toISOString(),frozenComparisonMs,serializationMs,publicBytes:Buffer.byteLength(actualJson),publicSha256:sha(actualJson),frozenPublicSha256:sha(expectedJson),completePublicBytesEqual:bytesEqual,comparisonExcludedFields:["diagnostics"],publicGraph:{uniqueObjects:objects,allFrozen,metricOccurrences:metricValues.length,uniqueMetricObjects:new Set(metricValues).size},heapAfterComparison:process.memoryUsage().heapUsed});
  expect(bytesEqual,"complete numeric/coverage/reasons/native money/FX clocks/lineage/public bytes").toBe(true);
  expect(batch.points.map(p=>p.net.value)).toEqual(expected);expect(allFrozen).toBe(true);
  expect(preparations).toBe(shape==="multimarket"?3:1);expect(ordinaryTransitions).toBe(1866);expect(legacyCalls).toBe(0);
  expect(afterRepeat.cacheEntries).toBeLessThanOrEqual(8192);expect(afterRepeat.cacheEstimatedBytes).toBeLessThanOrEqual(64*1024*1024);expect(afterRepeat.batchEntries).toBe(1);expect(afterRepeat.batchCacheHits).toBe(3);
  expect(repeats.every(r=>r.identical&&r.additionalCanonicalQueries===0&&r.ms<=200)).toBe(true);
  expect(coldMs).toBeLessThanOrEqual(2000);
},120000);
