import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {HistoryChart,type HistoryChartData,type HistoryMoneyMetric} from "../../../../../../app/components/homepage-v25/history-chart";
import type {HomepageHistoryChartMode} from "../../../../../../app/lib/reviews/homepage-v25-state";
import "./metrics-harness.css";
function money(value:string|null):HistoryMoneyMetric{return {value,available:value!==null,reasons:value===null?["该期间金额缺失"]:[],coverage:{total:7,available:value===null?0:7},money:{originalByCurrency:value===null?{}:{CNY:value},targetCurrency:"CNY",conversion:"same-currency",fx:null}}}
const scalar=(value:string)=>({value,available:true,reasons:[]});
const data:HistoryChartData={sourceId:"root-minimal-history",requestGeneration:"literal-1",grain:"month",range:{label:"2026",start:"2026-01-01",end:"2026-12-31",timeZone:"Asia/Shanghai"},points:[
 {key:"01",label:"1月",start:"2026-01-01",end:"2026-01-31",state:"value",reasons:[],periodNet:money("0"),cumulativeNet:money("98765.432100"),roundCount:scalar("3"),winningRounds:scalar("2"),winRate:scalar("12.345")},
 {key:"02",label:"2月",start:"2026-02-01",end:"2026-02-28",state:"no-rounds",reasons:["该期间无已关闭回合"],periodNet:money(null),cumulativeNet:money("98765.432100"),roundCount:scalar("0"),winningRounds:scalar("0"),winRate:{value:null,available:false,reasons:["无已平仓回合"]}},
 {key:"03",label:"3月",start:"2026-03-01",end:"2026-03-31",state:"value",reasons:[],periodNet:money("-12345.678900"),cumulativeNet:money("86419.753200"),roundCount:scalar("7"),winningRounds:scalar("5"),winRate:scalar("71.428571")}
]};
function Harness(){const[mode,setMode]=useState<HomepageHistoryChartMode>("period-pnl");return <main><h1>历史曲线最小真实链路</h1><p>只读字面数据调用方，无金融聚合或数据库；所有模式值故意独立。</p><div className="fixture-tools"><label>图表模式 <select value={mode} onChange={e=>setMode(e.target.value as HomepageHistoryChartMode)}><option value="period-pnl">各期净盈亏</option><option value="cumulative-pnl">累计净盈亏</option><option value="win-rate">各期胜率</option><option value="round-count">各期回合数</option></select></label></div><HistoryChart data={data} mode={mode} reportCurrency="CNY" readState={{kind:"ready"}}/><section className="next-boundary"><h2>下一个模块</h2><button>外部动作</button></section></main>}
createRoot(document.getElementById("root")!).render(<Harness/>);
