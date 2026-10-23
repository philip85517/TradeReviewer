import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector/promises";
import { performance } from "node:perf_hooks";
import * as candidate from "../../../../../../app/lib/reviews/homepage-v25-performance";
import * as frozen from "./frozen-performance";
import { base, entriesFor, largeFixture, publicJson } from "./fixtures";

it("captures one explicitly authorized diagnostic cold CPU profile with unchanged full output",async()=>{
  if(process.env.P2_ALLOW_DIAGNOSTIC_PROFILE!=="1")throw new Error("Explicit root authorization and P2_ALLOW_DIAGNOSTIC_PROFILE=1 required");
  const prefix=base+"diagnostic-multimarket";
  if(existsSync(prefix+".started.json"))throw new Error("One diagnostic attempt already exists; never overwrite or retry silently");
  const sha=(value:string|Buffer)=>createHash("sha256").update(value).digest("hex");
  const sourceSha=sha(readFileSync("app/lib/reviews/homepage-v25-performance.ts"));
  expect(sourceSha).toBe("094b24161c7714149535cb3c1893ed2fe8304d140ed090ec26a81df3decacd5a");
  const {executions,candlesByInstrument,fxObservations,request,expected,revisions}=largeFixture("multimarket");
  const upstreamStart=performance.now(),entries=entriesFor(executions,candlesByInstrument),upstreamMs=performance.now()-upstreamStart;
  const input={entries,candlesByInstrument,fxObservations,currentFxSnapshot:null,lifetimeSourceCoverage:[],revisions};
  const inputSha256=sha(JSON.stringify(input)),requestSha256=sha(JSON.stringify(request));
  expect(inputSha256).toBe("befe3b83a976e5016b0602d475f18980a1d323e9d83316073240943f3e2c490c");
  expect(requestSha256).toBe("7e6b24950ade6eb6b41899df76771ad999bb01bf6712908a276fffa9522285e9");
  const record={startedAt:new Date().toISOString(),runtime:process.version,node:process.execPath,sourceSha,inputSha256,requestSha256,fixture:{fills:executions.length,endpoints:request.endpoints.length,accounts:3,markets:3,quotes:Object.values(candlesByInstrument).reduce((n,q)=>n+q.length,0),historicalFxObservations:fxObservations.length},upstreamMs,formalPerformanceSample:false,formalP2:"0/3; preserved cold failure and remaining NOT VERIFIED",scope:"One CPU diagnostic; profiler overhead forbids using these durations as formal threshold evidence"};
  writeFileSync(prefix+".started.json",JSON.stringify(record,null,2),{flag:"wx"});
  const session=new Session();session.connect();
  let batch:ReturnType<typeof candidate.projectHomepageV25Boundaries>,source:ReturnType<typeof candidate.prepareHomepageV25Source>,prepareMs:number,batchMs:number,profiledColdMs:number;
  try{
    await session.post("Profiler.enable");
    await session.post("Profiler.setSamplingInterval",{interval:1000});
    await session.post("Profiler.start");
    const coldStart=performance.now();source=candidate.prepareHomepageV25Source(input);prepareMs=performance.now()-coldStart;
    const batchStart=performance.now();batch=candidate.projectHomepageV25Boundaries(source,request);batchMs=performance.now()-batchStart;profiledColdMs=performance.now()-coldStart;
    const {profile}=await session.post("Profiler.stop");
    writeFileSync(prefix+".cpuprofile",JSON.stringify(profile));
  }finally{session.disconnect();}
  // Preserve every public field. Comparison, repeats and serialization occur
  // after Profiler.stop, outside its CPU capture and the diagnostic cold clock.
  writeFileSync(prefix+".batch.json",JSON.stringify(batch));
  const repeats=[];
  for(let i=0;i<3;i++){const start=performance.now(),again=candidate.projectHomepageV25Boundaries(source,request);repeats.push({ms:performance.now()-start,identical:again===batch});}
  const actualJson=publicJson(batch),expectedJson=publicJson(frozen.projectHomepageV25Boundaries(frozen.prepareHomepageV25Source(input),request));
  const same=actualJson===expectedJson,oracleMatch=batch.points.every((p,i)=>p.net.value===expected[i]);
  const report={...record,endedAt:new Date().toISOString(),prepareMs,batchMs,profiledColdMs,repeats,inspect:candidate.inspectHomepageV25PreparedSource(source),publicSha256:sha(actualJson),frozenPublicSha256:sha(expectedJson),publicBytes:Buffer.byteLength(actualJson),completePublicBytesEqual:same,comparisonExcludedFields:["diagnostics"],all365OraclesMatch:oracleMatch,formalThresholdEvaluation:"NOT APPLICABLE: explicitly instrumented diagnostic; root-independent-multimarket-1.json cold FAIL remains binding"};
  writeFileSync(prefix+".report.json",JSON.stringify(report,null,2));
  expect(same).toBe(true);expect(oracleMatch).toBe(true);expect(repeats.every(r=>r.identical)).toBe(true);
},120000);
