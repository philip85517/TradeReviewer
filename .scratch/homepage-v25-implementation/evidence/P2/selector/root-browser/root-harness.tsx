import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {PeriodSelector} from "../../../../../../app/components/homepage-v25/period-selector";
import type {HomepagePeriod} from "../../../../../../app/lib/reviews/homepage-v25-state";
import "./root-harness.css";
function Harness(){
 const fixture = new URLSearchParams(window.location.search);
 const [applied,setApplied]=useState<HomepagePeriod>(fixture.has("all") ? {preset:"all",from:null,to:null} : {preset:"ytd",from:"2026-01-01",to:"2026-10-23"});
 const [draft,setDraft]=useState({from:"2026-10-01",to:"2026-10-15"});
 const [open,setOpen]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null);
 const [requested,setRequested]=useState<HomepagePeriod|null>(null),[count,setCount]=useState(0);
 return <main><h1>独立控件验收</h1><p>合成受控调用方；无数据库、无首页金额接线。</p><section className={`placement ${fixture.has("left") ? "placement-left" : ""} ${fixture.has("scroll") ? "placement-scroll" : ""}`}><PeriodSelector applied={applied} draft={draft} open={open} pending={pending} error={error} today={fixture.has("invalid-today") ? "2026-02-30" : "2026-10-23"} allRange={null} onDraftChange={setDraft} onOpenChange={setOpen} onApply={p=>{setCount(c=>c+1);setRequested(p);setError(null);setPending(true)}} /></section><aside><p>请求次数：<output aria-label="请求次数">{count}</output></p><p>调用目标：{JSON.stringify(requested)}</p><button onClick={()=>{setPending(false);setError("验收用受控读取失败")}}>调用方发布失败</button><button onClick={()=>{if(requested){setApplied(requested);setOpen(false);setPending(false);setError(null)}}}>调用方发布成功</button><button onClick={()=>{setPending(false);setError(null);setApplied({preset:"ytd",from:"2026-01-01",to:"2026-10-23"});setDraft({from:"2026-10-01",to:"2026-10-15"});setRequested(null);setCount(0);setOpen(false)}}>重置调用方</button><a href="#outside">外部焦点入口</a></aside></main>
}
createRoot(document.getElementById("root")!).render(<Harness/>);
