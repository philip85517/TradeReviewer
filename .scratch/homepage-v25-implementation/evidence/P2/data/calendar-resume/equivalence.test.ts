import { afterAll, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import * as candidate from "../../../../../../app/lib/reviews/homepage-v25-performance";
import * as frozen from "./fx-stage-oracle";
import * as original from "./input-oracle";
import type { TradeExecution } from "../../../../../../app/lib/trades/types";
import { entriesFor, instruments, publicJson, raw } from "../immutable-sharing/fixtures";
const base=".scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/";
const records:unknown[]=[];
afterAll(()=>writeFileSync(base+"11-calendar-public-equivalence.json",JSON.stringify({runtime:process.version,records},null,2)));
const revision={trades:"immutable-check",quotes:"same-captured",fx:"same-evidence",metadata:"none"};
const fill=(i:number,overrides:Partial<TradeExecution>={}):TradeExecution=>({id:`fill-${i}`,accountId:`a${i%3}`,accountLabel:`A${i%3}`,instrument:instruments[i%3],side:"buy",quantity:"2",price:"100.123456789123456789",fee:"0.123456789123456789",executedAt:"2026-01-05T14:00:00Z",source:{platform:"statement",row:i,tradeNature:"live",positionEffect:"open-long"},...overrides});
const request:candidate.HomepageV25BoundaryInput={periodStart:"2026-01-01",asOf:"2026-02-02T10:00:00Z",targetCurrency:"CNY",endpoints:[{key:"pre",at:"2026-01-02"},{key:"instant",at:"2026-01-05T14:00:00Z"},{key:"late",at:"2026-01-31"},{key:"after",at:"2026-02-02"},{key:"future",at:"2026-03-02"}]};
const observations:candidate.HistoricalFxObservation[]=["2025-12-31","2026-01-02","2026-01-05","2026-01-31","2026-02-02"].map(date=>({id:`fx-${date}`,source:"archive",sourceRevision:`r-${date}`,businessDate:date,rates:{"USD/CNY":"7.123456789123456789","HKD/CNY":"0.9123456789123456789"},status:"complete",publishedAtByPair:{"USD/CNY":`${date}T00:00:00Z`,"HKD/CNY":`${date}T00:00:00Z`},knownAtByPair:{"USD/CNY":`${date}T01:00:00Z`,"HKD/CNY":`${date}T02:00:00Z`},fetchedAt:`${date}T03:00:00Z`,evidenceIds:[`evidence-${date}`]}));
function input(executions:TradeExecution[],extra:Partial<candidate.HomepageV25PrepareInput>={}):candidate.HomepageV25PrepareInput {
  const candlesByInstrument=Object.fromEntries(instruments.map(instrument=>[instrument.id,["2025-12-31","2026-01-02","2026-01-05","2026-01-30","2026-02-02"].map(date=>raw(instrument,date))]));
  return {entries:entriesFor(executions,candlesByInstrument),candlesByInstrument,fxObservations:observations,currentFxSnapshot:{snapshot:{id:"current-separate",baseCurrency:"CNY",asOf:"2026-02-02T09:00:00Z",source:"broker-current",status:"complete",rates:{"USD/CNY":"7.2","HKD/CNY":"0.91"}},fetchedAt:"2026-02-02T09:05:00Z",publishedAtByPair:{"USD/CNY":"2026-02-02T09:00:00Z","HKD/CNY":"2026-02-02T09:00:00Z"},sourceRevision:"current-r",evidenceIds:["current-evidence"]},lifetimeSourceCoverage:executions.map(e=>({accountId:e.accountId,instrumentId:e.instrument.id,nature:"live",simulationRunId:null,state:"complete",coversInception:true,through:"2026-02-02",knownAt:"2026-02-02T00:00:00Z",evidenceIds:[`lifetime-${e.id}`],reasons:[]})),revisions:revision,...extra};
}
function compare(name:string,data:candidate.HomepageV25PrepareInput,queries:candidate.HomepageV25BoundaryInput[]=[request]) {
  const actualSource=candidate.prepareHomepageV25Source(data),expectedSource=frozen.prepareHomepageV25Source(data);
  for(const query of queries){
    const actual=candidate.projectHomepageV25Boundaries(actualSource,query),expected=frozen.projectHomepageV25Boundaries(expectedSource,query);
    const actualJson=publicJson(actual),expectedJson=publicJson(expected),same=actualJson===expectedJson;
    records.push({name,order:query.endpoints.map(p=>p.key),bytes:Buffer.byteLength(actualJson),actualSha256:createHash("sha256").update(actualJson).digest("hex"),frozenSha256:createHash("sha256").update(expectedJson).digest("hex"),completePublicBytesEqual:same,excludedFields:["diagnostics"],inspect:candidate.inspectHomepageV25PreparedSource(actualSource)});
    expect(same,`${name}: all numeric/coverage/reasons/native-money/FX clocks/lineage/public fields`).toBe(true);
    expect(candidate.projectHomepageV25Boundaries(actualSource,query)).toBe(actual);
  }
}
it("matches full precision three currency content, independent current, and reversed query order",()=>compare("complete-three-currency",input([fill(0),fill(1),fill(2)]),[request,{...request,endpoints:[...request.endpoints].reverse()},request]));
it("matches partial/future FX clocks and strict missing completed quote evidence",()=>{
  const data=input([fill(0),fill(1)]);
  data.fxObservations=observations.map(o=>({...o,status:"partial",knownAtByPair:{...o.knownAtByPair,"USD/CNY":"2026-12-31T00:00:00Z"}}));
  data.candlesByInstrument={"US:AAPL":[raw(instruments[0],"2026-01-05")],"HK:00700":[]};
  compare("partial-future-fx-missing-quote",data);
});
it("matches unknown fee, date only execution, duplicate conflicts, and unknown lifetime content",()=>{
  const a=fill(0,{source:{platform:"statement",row:0,tradeNature:"live",feeStatus:"unknown",timePrecision:"date-only",tradingDate:"2026-01-05"},executedAt:"2026-01-05"});
  compare("unknown-and-conflict",input([a,{...a,quantity:"3"}],{lifetimeSourceCoverage:[],fxObservations:[],currentFxSnapshot:null}));
});
it("matches simulation scope and source separated fee facts",()=>{
  const a=fill(0,{source:{platform:"statement",row:0,tradeNature:"simulation",simulationRunId:"run-a"}});
  const b=fill(1,{source:{platform:"statement",row:1,tradeNature:"simulation",simulationRunId:"run-b"}});
  compare("simulation",input([a,b],{scope:{nature:"simulation",simulationRunId:"run-a"},lifetimeSourceCoverage:[]}));
});
it("matches late attached IPO refund without overwriting early knowledge",()=>{
  const common={accountId:"a0",market:"US",symbol:"AAPL",currency:"USD",source:[{page:1,row:2}]};
  const e=fill(0,{id:"sale",side:"sell",quantity:"1",price:"120",fee:"1",executedAt:"2026-01-15T15:00:00Z",source:{platform:"statement",row:1,tradeNature:"live",positionEvents:[{...common,id:"application",kind:"ipo",date:"2026-01-08",amount:"-220",description:"IPO application"},{...common,id:"fee",kind:"fee",date:"2026-01-08",amount:"-2",description:"IPO fee"},{...common,id:"allocation",kind:"ipo",date:"2026-01-10",quantity:"2",displayTimePolicy:"session-open",description:"IPO allocation"},{...common,id:"refund",kind:"ipo",date:"2026-01-20",amount:"20",description:"IPO refund"}]}});
  const query={...request,endpoints:[{key:"late",at:"2026-01-22T10:00:00Z"},{key:"early",at:"2026-01-18"}]};
  compare("late-refund",input([e]),[query,{...query,endpoints:[...query.endpoints].reverse()},query]);
});
it("matches empty and future period classifications",()=>compare("empty-future",input([]),[{...request,periodStart:"2026-03-01",endpoints:[{key:"future",at:"2026-03-02"}]},request]));

it("keeps full original public bytes equal for fully eligible live three-currency facts", () => {
  const data=input([fill(0),fill(1),fill(2)]),query={...request,endpoints:request.endpoints.filter(e=>e.key!=="pre")};
  const actual=candidate.projectHomepageV25Boundaries(candidate.prepareHomepageV25Source(data),query);
  const expected=original.projectHomepageV25Boundaries(original.prepareHomepageV25Source(data),query);
  const actualJson=publicJson(actual),expectedJson=publicJson(expected);
  records.push({name:"original-normal-three-currency",completePublicBytesEqual:actualJson===expectedJson,actualSha256:createHash("sha256").update(actualJson).digest("hex"),originalSha256:createHash("sha256").update(expectedJson).digest("hex"),excludedFields:["diagnostics"]});
  expect(actualJson).toBe(expectedJson);
});
it("records the explicit pre-exposure FX oracle correction without changing its native money", () => {
  const data=input([fill(0),fill(1),fill(2)]),query={...request,endpoints:[request.endpoints[0]]};
  const actual=candidate.projectHomepageV25Boundaries(candidate.prepareHomepageV25Source(data),query);
  const expected=original.projectHomepageV25Boundaries(original.prepareHomepageV25Source(data),query);
  writeFileSync(base+"11-intentional-fx-oracle-delta.json",JSON.stringify({reason:"The old oracle requests FX from future-only groups before their first eligible native fact. This intentional correction is independent of calendar sharing.",actual:JSON.parse(publicJson(actual)),original:JSON.parse(publicJson(expected))},null,2));
  expect(actual.points[0].fxCoverage.requiredPairs).toEqual([]);
  expect(expected.points[0].fxCoverage.requiredPairs).toEqual(["HKD/CNY","USD/CNY"]);
  expect(actual.points[0].marketValue.money.originalByCurrency).toEqual(expected.points[0].marketValue.money.originalByCurrency);
  expect(actual.current).toEqual(expected.current);
});
