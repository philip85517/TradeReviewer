import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {HistoryStatsCards,type HistoryStatsMoney,type HistoryStatsSummary,type HistoryStatsCardsProps} from "../../../../../../app/components/homepage-v25/history-stats-cards";
import "./metrics-harness.css";
// Root's literal controlled display caller: no producer, financial inference or persistence.
function money(value:string|null):HistoryStatsMoney{return {value,available:value!==null,coverage:{total:14,available:value===null?0:14},reasons:value===null?["原始费用或历史汇率证据缺失，未知不能当零"]:[],money:{originalByCurrency:value===null?{}:{CNY:value},targetCurrency:"CNY",conversion:"same-currency",fx:null}};}
function observation(value:string|null){return {value,available:value!==null,reasons:value===null?["原始回合证据未覆盖"]:[]};}
function summary(scenario:string,generation:number):HistoryStatsSummary{
 const result:HistoryStatsSummary={closedNet:money(generation%2?"321480.567800":"-45000.876500"),allocatedFees:money("4680.123400"),closedRounds:observation("14"),winningRounds:observation("9"),winRate:observation("64.285714285714285714")};
 if(scenario==="zero")return {...result,closedNet:money("0.0000"),allocatedFees:money("0.0000"),closedRounds:observation("5"),winningRounds:observation("0"),winRate:observation("0")};
 if(scenario==="hundred")return {...result,closedRounds:observation("14"),winningRounds:observation("14"),winRate:observation("100")};
 if(scenario==="missing")return {...result,closedNet:money(null),allocatedFees:money(null),winRate:observation(null)};
 if(scenario==="countMissing")return {...result,closedRounds:observation(null),winningRounds:observation(null)};
 if(scenario==="empty")return {...result,closedNet:money("0"),allocatedFees:money("0"),closedRounds:observation("0"),winningRounds:observation("0"),winRate:observation(null)};
 if(scenario==="currency")return {...result,closedNet:{...money("123.000100"),money:{...result.closedNet.money,targetCurrency:"USD",originalByCurrency:{USD:"123.000100"}}}};
 if(scenario==="long")return {...result,closedNet:{...money("-123456789012345678901234567890.123456789000"),reasons:["极长原始证据说明 ORIGINAL-ACCOUNT-MARKET-INSTRUMENT-20261015-VERY-LONG-REFERENCE-DO-NOT-TRUNCATE"],money:{targetCurrency:"CNY",conversion:"complete",originalByCurrency:{USD:"123456789012345678901234.123456789000",HKD:"-88888888888888888888888.0000000100"},fx:{id:"ORIGINAL-FX-REFERENCE-VERY-LONG-DO-NOT-TRUNCATE",source:"完整原始汇率证据来源说明，必须可读取全部追溯编号",asOf:"2026-10-15T07:00:00Z",status:"complete"}}},closedRounds:observation("123456789012345678901234567890"),winningRounds:observation("12345678901234567890123456789"),winRate:observation("10.000000000000000000")};
 return result;
}
const choices=[["standard","标准历史指标"],["zero","真实零"],["hundred","100%胜率"],["pending","更新保留旧值"],["initial","首次加载"],["empty","无已平仓回合"],["error","更新失败保留旧值"],["firstError","首次失败"],["missing","金额胜率未知"],["countMissing","回合数未知"],["currency","币种不一致"],["long","极长值与来源"]];
function Harness(){const[scenario,setScenario]=useState("standard"),[generation,setGeneration]=useState(1);const status:HistoryStatsCardsProps["status"]=scenario==="pending"||scenario==="initial"?{kind:"pending",reason:"正在读取新年份，保留原完整历史范围"}:scenario==="error"||scenario==="firstError"?{kind:"error",reason:"新年份读取失败，保留原完整历史范围"}:scenario==="empty"?{kind:"empty",reason:"暂无已平仓回合"}:{kind:"ready"};return <main style={{maxWidth:1374}}><h1>历史四卡独立验收</h1><p>合成受控调用方；无财务投影、无数据库，不代表完整首页接线。</p><div className="fixture-tools"><label>验收情景 <select value={scenario} onChange={e=>setScenario(e.target.value)}>{choices.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button onClick={()=>setGeneration(g=>g+1)}>提交另一历史范围</button><output>版本{generation}</output></div><HistoryStatsCards summary={["initial","firstError"].includes(scenario)?null:summary(scenario,generation)} reportCurrency="CNY" sourceId="root-history-literal" requestGeneration={`${scenario}-${generation}`} status={status}/><section className="next-boundary"><h2>下一模块边界</h2><p>详情须完整可读并可返回原触发卡。</p><button>外部动作</button></section></main>;}
createRoot(document.getElementById("root")!).render(<Harness/>);
