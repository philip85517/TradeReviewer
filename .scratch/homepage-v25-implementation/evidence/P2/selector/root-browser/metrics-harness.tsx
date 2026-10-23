import React,{useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {MetricCards, type MetricCardsProps} from "../../../../../../app/components/homepage-v25/metric-cards";
import type {HomepageV25Metric,HomepageV25BoundaryPoint} from "../../../../../../app/lib/reviews/homepage-v25-performance";
import type {HomepageV25SeriesBundle} from "../../../../../../app/lib/reviews/homepage-v25-series";
import "./metrics-harness.css";
// Independent literal display caller: no producer, financial calculation, persistence or IO.
function amount(value:string|null):HomepageV25Metric{return {value,available:value!==null,coverage:{total:3,available:value===null?0:3},reasons:value===null?["缺少期末行情，未知不能当零"]:[],money:{originalByCurrency:value===null?{}:{CNY:value},targetCurrency:"CNY",conversion:"same-currency",fx:null}};}
function bundle(scenario:string,generation:number):HomepageV25SeriesBundle{
 const unknown=scenario==="missing";
 const long=scenario==="long";
 const point:HomepageV25BoundaryPoint={key:"2026-10-15",requestedAt:"2026-10-15",businessDate:"2026-10-15",effectiveCursor:"2026-10-15T15:59:59Z",boundaryPrecision:"day",state:scenario==="future"?"future":unknown?"source-missing":"value",plottable:!unknown,
 net:amount(unknown?null:long?"-123456789012345678901234567890.123456789000":generation%2?"18420.567800":"30000.432100"),periodRealized:amount(scenario==="signs"?"0":generation%2?"12240.5678":"23820.4321"),unrealizedChange:amount(scenario==="signs"?"-6180":"6180"),
 marketValue:amount("888"),unrealizedNet:amount("777"),lifetimeRealizedNet:amount("666"),lifetimeNet:amount("555"),openingUnrealized:amount("900"),closingUnrealized:amount("7080"),openFees:amount("4"),periodFees:amount("640"),instruments:[],quoteCoverage:{},lifetimeCoverage:[],reasons:[],fxCoverage:{state:"not-required",businessDate:"2026-10-15",observationIds:[],requiredPairs:[],pairKnowledge:{},reasons:[]}};
 if(scenario==="currency")point.net.money={...point.net.money,targetCurrency:"USD",originalByCurrency:{USD:"18420.567800"}};
 if(long){point.net.reasons=["极长证据说明：上海收盘边界与行情知识日期逐项对应，原始账户市场证券证据编号 ORIGINAL-ACCOUNT-MARKET-INSTRUMENT-20261015-VERY-LONG-REFERENCE-DO-NOT-TRUNCATE。"];
 point.net.money={...point.net.money,conversion:"complete",fx:{id:"ORIGINAL-FX-REFERENCE-VERY-LONG-DO-NOT-TRUNCATE",source:"原始汇率来源说明：完整保留数据库供应方说明及不可截断的追溯编号",asOf:"2026-10-15T07:00:00Z",status:"complete"},originalByCurrency:{USD:"123456789012345678901234.123456789000",HKD:"-88888888888888888888888.0000000100"}};}
 return {sourceId:"root-independent-metrics-literal",requestGeneration:`${scenario}-${generation}`,points:[point],periodSummary:point,summaryState:point.state,feeFacts:[],tooltipFields:["marketValue","unrealizedNet","lifetimeRealizedNet","lifetimeNet","net","periodFees"],
 revisions:{trades:"literal",metadata:"literal",quotes:"literal",fx:"literal"},policies:{finance:"F3-2026-10-23",feePool:"F3-canonical-prefix",feeFacts:"P2-incurred-knowledge-1",calendar:"exchange-2010-2030-F3",dailyCoverage:"P2-strict-completed-1",fx:"P2-historical-pair-knowledge-1",quoteKnowledgeMode:"retrospective-completed-session"},scope:{nature:"live",simulationRunId:null,includedExecutions:1,excludedExecutions:0,excludedByReason:{}},boundary:{businessTimezone:"Asia/Shanghai",asOf:"2026-10-23T08:00:00Z",periodStart:generation%2?"2026-01-01":"2026-10-01",requestedEnd:"2026-10-15",effectiveEnd:"2026-10-15"},
 current:{asOf:"2026-10-23T08:00:00Z",currentMarketValue:amount("260102.123400"),currentUnrealized:amount("23153.2500"),currentOpenFees:amount("4"),instruments:[],quoteCoverage:{},fxCoverage:{state:"not-required",businessDate:"2026-10-23",observationIds:[],requiredPairs:[],pairKnowledge:{},reasons:[]}}};
}
const choices=[["standard","标准指标"],["signs","正负与零"],["pending","更新保留旧值"],["initial","首次加载"],["empty","空范围"],["error","更新失败保留旧值"],["firstError","首次读取失败"],["missing","缺失净值"],["future","未来期间"],["currency","币种不一致"],["long","极长金额与来源"]];
function Harness(){const[scenario,setScenario]=useState("standard"),[generation,setGeneration]=useState(1);const data=useMemo(()=>bundle(scenario,generation),[scenario,generation]);
 const status:MetricCardsProps["status"]=scenario==="pending"||scenario==="initial"?{kind:"pending",reason:scenario==="initial"?"正在首次读取指标":"正在更新，继续显示原期间"}:scenario==="error"||scenario==="firstError"?{kind:"error",reason:scenario==="firstError"?"首次读取指标超时，尚无已提交数据":"读取超时，新范围未应用；继续显示原期间"}:scenario==="empty"?{kind:"empty",reason:"当前范围没有可计算指标"}:{kind:"ready"};
 return <main><h1>四项指标独立验收</h1><p>合成受控调用方；无财务投影、无数据库，不代表首页财务接线。</p><div className="fixture-tools"><label>验收情景 <select value={scenario} onChange={e=>setScenario(e.target.value)}>{choices.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button onClick={()=>setGeneration(g=>g+1)}>提交另一期间</button><output>版本{generation}</output></div><MetricCards series={["initial","firstError","empty"].includes(scenario)?null:data} reportCurrency="CNY" status={status}/><section className="next-boundary"><h2>下一模块边界</h2><p>详情须完整可读并可返回原触发卡。</p><button>外部动作</button></section></main>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
