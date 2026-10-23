import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {HistoryControls,type HistoryRangeOption} from "../../../../../../app/components/homepage-v25/history-controls";
import type {HomepageHistoryRange,HomepageHistoryChartMode} from "../../../../../../app/lib/reviews/homepage-v25-state";
import "../../../../../../app/components/homepage-v25/home-surface.css";
import "./root-harness.css";
const options:HistoryRangeOption[]=[{id:"year-2026",label:"2026",range:{mode:"year",year:2026}},{id:"this-year",label:"今年",range:{mode:"this-year",year:2026}},{id:"years-2024-2026",label:"2024–2026",range:{mode:"years",fromYear:2024,toYear:2026}},{id:"all",label:"全部",range:{mode:"all"}}];
function Harness(){
 const [applied,setApplied]=useState<HomepageHistoryRange>(options[0].range),[mode,setMode]=useState<HomepageHistoryChartMode>("period-pnl"),[requested,setRequested]=useState<HomepageHistoryRange|null>(null);
 const [pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[count,setCount]=useState(0),[empty,setEmpty]=useState(false),[long,setLong]=useState(false);
 return <main className="hp-home-surface" style={{height:"auto"}}><h1>历史组合控件独立验收</h1><p>合成受控调用方；无图表、数据库或业务范围推断。</p><section className="placement"><HistoryControls appliedRange={applied} chartMode={mode} rangeOptions={empty?[]:long?options.map(o=>({...o,label:o.id==="years-2024-2026"?"2024–2026 全部已经确认可用的很长历史年度范围":o.label})):options} pending={pending} error={error} onRangeApply={r=>{setRequested(r);setCount(c=>c+1);setPending(true);setError(null)}} onChartModeChange={setMode}/></section><aside><p>范围请求次数：<output aria-label="范围请求次数">{count}</output></p><p>调用目标：{JSON.stringify(requested)}</p><button onClick={()=>{setPending(false);setError("验收用历史范围读取失败；保留原已应用范围，可再次选择重试。")}}>调用方发布失败</button><button onClick={()=>{if(requested){setApplied(requested);setPending(false);setError(null)}}}>调用方发布成功</button><button onClick={()=>{setApplied(options[0].range);setMode("period-pnl");setRequested(null);setPending(false);setError(null);setCount(0);setEmpty(false);setLong(false)}}>重置调用方</button><button onClick={()=>setEmpty(v=>!v)}>切换空选项</button><button onClick={()=>setLong(v=>!v)}>切换长范围</button><a href="#outside">外部焦点入口</a></aside></main>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
