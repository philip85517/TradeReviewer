import React,{useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {ContributionBars,type ContributionMetric,type CurrentContributionRow,type HistoricalContributionRow,type ContributionIdentity,type ContributionReadState} from "../../../../../../app/components/homepage-v25/contribution-bars";
import "./metrics-harness.css";
import "./bars-harness.css";
// Independent literal presentation caller; no projector, financial aggregation, IO or database.
function metric(value:string|null):ContributionMetric{return {value,available:value!==null,coverage:{total:3,available:value===null?2:3},reasons:value===null?["缺少期末估值，未知不能当零"]:[],money:{originalByCurrency:value===null?{}:{CNY:value},targetCurrency:"CNY",conversion:"same-currency",fx:null}};}
const markets=["A股","港股","美股"];
const symbols=["招商银行","贵州茅台","中国平安","宁德时代","中信证券","比亚迪","长江电力","中国中免"];
function prepared(scenario:string,generation:number){
 const market=scenario==="markets";const names=market?markets:symbols;
 const rows:CurrentContributionRow[]=names.map((label,i)=>{
 const identity:ContributionIdentity=market?{kind:"market",market:["a","hk","us"][i]}:{kind:"instrument",accountId:`literal-account-${i}`,instrumentId:`SSE:LITERAL${i}`,market:"a",nature:"live",simulationRunId:null};
 const values=scenario==="negative"?["-12000.10","-3000.20","-15000.30"]:scenario==="positive"?["12000.10","3000.20","15000.30"]:scenario==="zero"?["0","0.004","0"]:i%2?["-9000","3000","-6000"]:["12000","-4000","8000"];
 const long=scenario==="long"&&i===0;
 const missing=scenario==="unknown"&&i===0;
 let net=metric(missing?null:long?"-123456789012345678901234567890.123456789000":generation%2?values[2]:"30000.432100");
 if(long)net={...net,reasons:["完整原币与汇率证据 ORIGINAL-ACCOUNT-MARKET-INSTRUMENT-VERY-LONG-REFERENCE-DO-NOT-TRUNCATE"],money:{...net.money,conversion:"complete",originalByCurrency:{USD:"123456789012345678901234.123456789000",HKD:"-88888888888888888888888.0000000100"},fx:{id:"FX-VERY-LONG-ORIGINAL-REFERENCE-DO-NOT-TRUNCATE",source:"完整来源说明，不可截断追溯编号",asOf:"2026-10-15T07:00:00Z",status:"complete"}}};
 return {key:`${identity.kind}-${i}`,label:long?"极长中文证券名称与账户来源保持完整可追溯的唯一目标":label,accessibleLabel:`打开${label}的准确贡献来源`,identity,periodRealized:metric(missing?null:values[0]),unrealizedChange:metric(values[1]),net};
 });
 const history:HistoricalContributionRow[]=rows.map((row,i)=>({key:row.key,label:row.label,accessibleLabel:row.accessibleLabel,identity:row.identity,closedResult:metric(i%2?"-6000.123400":"8000.567800")}));
 return {rows,history,total:metric("98765.123400")};
}
const choices=[["mixed","异号八标的"],["markets","三个市场"],["positive","同正连续堆叠"],["negative","同负连续堆叠"],["zero","零与小于一分"],["unknown","估值缺失"],["history","历史已平仓"],["pending","更新保留旧值"],["initial","首次加载"],["error","读取失败保留旧值"],["empty","无结果"],["long","极长身份金额来源"]];
function Harness(){const[scenario,setScenario]=useState("mixed"),[generation,setGeneration]=useState(1),[currency,setCurrency]=useState("CNY"),[activated,setActivated]=useState("尚未激活");const data=useMemo(()=>prepared(scenario,generation),[scenario,generation]);
 const readState:ContributionReadState=scenario==="initial"||scenario==="pending"?{kind:"pending",reason:scenario==="initial"?"首次读取贡献中":"更新中，继续显示已提交贡献"}:scenario==="error"?{kind:"error",reason:"读取失败，原范围与贡献保留"}:scenario==="empty"?{kind:"empty",reason:"当前范围没有贡献，不能当作零金额"}:{kind:"ready"};
 return <main><h1>贡献条形独立验收</h1><p>字面受控调用方；无财务投影、无数据库，不代表首页接线。</p><div className="fixture-tools"><label>验收情景 <select value={scenario} onChange={e=>setScenario(e.target.value)}>{choices.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>报表币种 <select value={currency} onChange={e=>setCurrency(e.target.value)}><option>CNY</option><option>USD</option></select></label><button onClick={()=>setGeneration(g=>g+1)}>提交另一版本</button><output>版本{generation}</output></div>
 {scenario==="history"?<ContributionBars mode="history" rows={data.history} fullTotal={data.total} reportCurrency={currency} readState={readState} onActivate={id=>setActivated(JSON.stringify(id))}/>:<ContributionBars mode="current" rows={scenario==="initial"?null:scenario==="empty"?[]:data.rows} fullTotal={scenario==="initial"||scenario==="empty"?null:data.total} reportCurrency={currency} readState={readState} onActivate={id=>setActivated(JSON.stringify(id))}/>}
 <section className="next-boundary"><h2>来源激活与下一模块</h2><output aria-label="准确来源对象">{activated}</output><p>合计由调用方明确提供，不等于本页八行相加。</p><button>外部阅读位置</button></section></main>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
