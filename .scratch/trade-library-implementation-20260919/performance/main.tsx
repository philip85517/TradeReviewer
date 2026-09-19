import React from 'react';
import type { TradeExecution } from '../../../app/lib/trades/types';
import type { EpisodeReviewRecord } from '../../../app/lib/reviews/types';
import type { TradeLibraryEntry } from '../../../app/lib/trades/library';
import { createRoot } from 'react-dom/client';
import { TradeLibrary } from '../../../app/components/library/trade-library';
import { DEFAULT_TRADE_LIBRARY_BROWSE_STATE } from '../../../app/components/library/library-browse-state';
import { buildInstrumentTradeSummaries } from '../../../app/lib/trades/instruments';
import { buildTradeLibraryEntries } from '../../../app/lib/trades/library';
import fixture from '../../../.data/library-ux/performance-fixture.json';
import '../../../app/globals.css';
import './performance.css';

// Local-only acceptance harness: immutable fixture, no storage or market writes.
// Production React/component code is built by Vite. Timing begins in native
// capture-phase event handling and ends after two animation frames, never at
// the automation RPC boundary. Page must stay visible/unthrottled for sampling.
const base = buildTradeLibraryEntries(buildInstrumentTradeSummaries(fixture.executions as TradeExecution[]), {}, {}, Object.fromEntries((fixture.reviews as EpisodeReviewRecord[]).map((record)=>[record.episodeId,record])));
const requested = Number(new URLSearchParams(location.search).get('rounds')) || 766;
const rows = base.flatMap(entry => entry.episodes.map(item => ({entry,item})));
const groups = new Map<string, TradeLibraryEntry>();
for (let index=0;index<requested;index++) {
  const {entry,item} = rows[index % rows.length];
  const batch = Math.floor(index/rows.length);
  const suffix = batch ? `:perf-${batch}` : '';
  const instrument = {...entry.instrument,id:entry.instrument.id+suffix,symbol:entry.instrument.symbol+(batch ? `-${batch}` : '')};
  const episode = {...item.episode,id:item.episode.id+suffix,instrument,executions:item.episode.executions.map(fill=>({...fill,id:fill.id+suffix,instrument}))};
  const key = `${entry.groupId || entry.instrument.id}${suffix}`;
  let group = groups.get(key);
  if (!group) { group={...entry,instrument,groupId:key,episodes:[],executions:[]}; groups.set(key,group); }
  const review = requested === 5000 && index % 5 === 0 ? {
    version:1,episodeId:episode.id,instrumentId:instrument.id,updatedAt:'2026-09-19T00:00:00Z',
    plan:{thesis:'',expectedPath:'',invalidationCondition:'',targetRange:'',plannedRiskAmount:'',confidence:null},
    review:{decisionQuality:null,executionQuality:null,riskManagement:'',psychology:'',reusableRule:'',completed:index%10===0,deferredReason:index%10===0?'':'性能夹具暂缓'},confirmedTagIds:[],
  } : item.review;
  group.episodes.push({...item,episode,review,reviewStatus:review?.review.completed?'completed':'pending'}); group.executions.push(...episode.executions);
}
const entries = [...groups.values()].map(entry=>({...entry,episodeCount:entry.episodes.length,tradeCount:entry.executions.length}));
type Measurement = {event:string;label:string;milliseconds?:number;domCommitMilliseconds?:number};
const measurements: Measurement[]=[];
let pendingCommit: { sample:Measurement; startedAt:number } | null = null;
const paintLog = () => {
  const output=document.getElementById('measurements');
  if(output) output.textContent=JSON.stringify(measurements);
};
for(const event of ['click','input','change']) document.addEventListener(event, e=>{
  const el=(e.target as HTMLElement)?.closest('button,input,select,summary');
  if(!el || el.closest('#harness-toolbar')) return;
  const start=performance.now();
  const label=el.getAttribute('aria-label') || el.textContent?.trim().slice(0,80) || el.tagName;
  const sample: Measurement = {event,label};
  measurements.push(sample);
  pendingCommit = {sample,startedAt:start};
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    sample.milliseconds=performance.now()-start;paintLog();
  }));
},true);
// Separate DOM commit from frame scheduling; neither includes automation RPC time.
new MutationObserver(records=>{
  if(!pendingCommit || !records.some(record=> (record.target instanceof Element ? record.target : record.target.parentElement)?.closest('.trade-library'))) return;
  pendingCommit.sample.domCommitMilliseconds=performance.now()-pendingCommit.startedAt;
  pendingCommit=null;paintLog();
}).observe(document.getElementById('root')!,{subtree:true,childList:true,attributes:true,characterData:true});
createRoot(document.getElementById('root')!).render(<>
  <div id="harness-toolbar"><strong>生产组件性能验收 · {requested} 回合 / {entries.length} 分组</strong><button onClick={()=>{measurements.length=0;paintLog();}}>清空测量</button><a href="?rounds=766">766</a><a href="?rounds=5000">5000</a></div>
  <TradeLibrary entries={entries} initialBrowseState={{...DEFAULT_TRADE_LIBRARY_BROWSE_STATE,tradeNature:'all'}} candlesByInstrument={{}} marketDataStatuses={{}} timeframe="1D" onTimeframeChange={()=>{}} onOpenInReview={()=>{}} onSaveReview={()=>{}} reviewsHydrated={true}/>
  <details id="harness-results"><summary>测量结果（事件至两帧后，毫秒）</summary><pre id="measurements">[]</pre></details>
</>);
