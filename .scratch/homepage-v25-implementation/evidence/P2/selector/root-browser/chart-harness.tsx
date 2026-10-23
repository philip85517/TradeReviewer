import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {PerformanceChart} from "../../../../../../app/components/homepage-v25/performance-chart";
import type {HomepageV25BoundaryPoint, HomepageV25Metric} from "../../../../../../app/lib/reviews/homepage-v25-performance";
import type {HomepageV25SeriesBundle} from "../../../../../../app/lib/reviews/homepage-v25-series";
import "./chart-harness.css";

// Coordinator's independent literal visual caller, not a financial oracle or builder.
function metric(value: string|null, reasons: string[] = []): HomepageV25Metric {
 return {value,available:value!==null,coverage:{total:1,available:value===null?0:1},reasons,
 money:{originalByCurrency:value===null?{}:{CNY:value},targetCurrency:"CNY",conversion:"same-currency",fx:null}};
}
const dates=["2026-01-01","2026-02-15","2026-04-01","2026-05-15","2026-06-30","2026-08-15","2026-09-15","2026-10-15"];
const amounts=["0","5200","4900","10400","9800","14400","13900","18420"];
function point(date:string,index:number,scenario:string):HomepageV25BoundaryPoint {
 const isMissing=scenario==="gaps" && (index===0 || index===3 || index===4);
 const isFuture=scenario==="gaps" && index>=6;
 const longReason="历史数据覆盖说明：该日期有一笔跨市场资金及费用仍待原始凭证确认；证据编号 ORIGINAL-ACCOUNT-MARKET-INSTRUMENT-20261015-VERY-LONG-REFERENCE。不得以当前金额替代历史金额。";
 const value=isMissing?null:scenario==="zero"?"0":amounts[index];
 const net=metric(value,scenario==="long"?[longReason]:[]);
 if(scenario==="currency") net.money={...net.money,targetCurrency:"USD",originalByCurrency:{USD:value??"0"}};
 const data:HomepageV25BoundaryPoint={key:date,requestedAt:date,businessDate:date,effectiveCursor:`${date}T15:59:59Z`,boundaryPrecision:"day",
 state:isFuture?"future":isMissing?"source-missing":"value",plottable:!isMissing,
 marketValue:metric(scenario==="long"?"26010212345678901234567890.1234567890123400":"260102"),
 unrealizedNet:metric("23153"),lifetimeRealizedNet:metric("12240"),lifetimeNet:metric("35393"),net,periodFees:metric("640"),
 periodRealized:metric("0"),openingUnrealized:metric("0"),closingUnrealized:metric("0"),unrealizedChange:metric("0"),openFees:metric("0"),
 instruments:[],quoteCoverage:{},lifetimeCoverage:[],
 fxCoverage:{state:"not-required",businessDate:date,observationIds:[],requiredPairs:[],pairKnowledge:{},reasons:[]},
 reasons:isMissing?["缺少完成交易日收盘价，保留断点，不补零"]:scenario==="long"?[longReason]:[]};
 return data;
}
function series(scenario:string,generation:number):HomepageV25SeriesBundle {
 const points=scenario==="empty"?[]:dates.map((day,index)=>point(day,index,scenario));
 return {sourceId:"root-independent-literal",requestGeneration:`${scenario}-${generation}`,points,
 revisions:{trades:"literal",metadata:"literal",quotes:"literal",fx:"literal"},
 policies:{finance:"F3-2026-10-23",feePool:"F3-canonical-prefix",feeFacts:"P2-incurred-knowledge-1",calendar:"exchange-2010-2030-F3",dailyCoverage:"P2-strict-completed-1",fx:"P2-historical-pair-knowledge-1",quoteKnowledgeMode:"retrospective-completed-session"},
 scope:{nature:"live",simulationRunId:null,includedExecutions:0,excludedExecutions:0,excludedByReason:{}},
 boundary:{businessTimezone:"Asia/Shanghai",asOf:"2026-10-15T10:00:00Z",periodStart:"2026-01-01",requestedEnd:"2026-10-15",effectiveEnd:scenario==="gaps"?"2026-08-15":"2026-10-15"},
 periodSummary:points.at(-1)??null,summaryState:points.at(-1)?.state??"source-missing",feeFacts:[],
 tooltipFields:["marketValue","unrealizedNet","lifetimeRealizedNet","lifetimeNet","net","periodFees"],
 current:{asOf:"2026-10-15T10:00:00Z",currentMarketValue:metric("999999999"),currentUnrealized:metric("999999999"),currentOpenFees:metric("999999999"),instruments:[],quoteCoverage:{},fxCoverage:{state:"not-required",businessDate:"2026-10-15",observationIds:[],requiredPairs:[],pairKnowledge:{},reasons:[]}}};
}
function Harness(){
 const [scenario,setScenario]=useState("standard"),[generation,setGeneration]=useState(1);
 const readStatus=scenario==="read"?{"2026-04-01":{state:"loading" as const,reason:"该日行情正在加载"},"2026-08-15":{state:"error" as const,reason:"该日读取失败，旧值不可使用"}}:undefined;
 return <main><h1>收益曲线独立验收</h1><p>合成受控调用方；无数据库、无财务计算，不代表首页接线已通过。</p>
 <label>验收情景 <select value={scenario} onChange={e=>setScenario(e.target.value)}>
 <option value="standard">标准历史</option><option value="zero">全部零值</option><option value="gaps">缺口与未来</option><option value="read">加载与失败</option><option value="currency">币种不一致</option><option value="long">极长金额与来源</option><option value="empty">空数据</option><option value="disabled">不可用</option></select></label>
 <div className="chart-slot"><PerformanceChart series={scenario==="disabled"?null:series(scenario,generation)} reportCurrency="CNY" pointStatus={readStatus} unavailableReason={scenario==="disabled"?"该批次历史数据不可用":undefined}/></div>
 <section className="next-module"><h2>下一模块边界</h2><p>此区域不应被曲线详情遮挡。</p><button onClick={()=>setGeneration(g=>g+1)}>切换数据版本</button><output>版本 {generation}</output></section>
 </main>
}
createRoot(document.getElementById("root")!).render(<Harness/>);
