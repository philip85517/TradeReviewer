'use client';
import {useEffect,useRef,useState} from 'react';
import type {PairingInspection,PairingRound,PairingScope} from '../../lib/home/business-pairing-store';
import {missingReasonText} from './missing-reasons';
import {money} from './holdings';
type Execution={id:string;side:string;executedAt:string;quantity:string;price:string;fee:string;currency:string;origin?:Record<string,unknown>};
type InspectionView={schema:string;inspection:PairingInspection;status:string;reasons:string[];executions:Execution[];candidates:PairingRound[];savedRounds:PairingRound[];financialPreviews?:{closingExecutionId:string;previewOnly:true;net:{currency:string;value:string|null}}[]};
export function BusinessPairingConfirmation({scope,onSaved}:{scope:PairingScope;onSaved:()=>void}){
 const [view,setView]=useState<InspectionView|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null),[conflict,setConflict]=useState(false);
 const [groups,setGroups]=useState<Record<string,string>>({}),[basis,setBasis]=useState(''),[confirmed,setConfirmed]=useState(false),control=useRef<AbortController|null>(null),panel=useRef<HTMLDetailsElement|null>(null);
 const scopeKey=JSON.stringify(scope);
 useEffect(()=>()=>control.current?.abort(),[scopeKey]);
 useEffect(()=>{if(!busy&&panel.current?.open&&document.activeElement===document.body)panel.current.querySelector('summary')?.focus();},[busy]);
 const load=async()=>{
  control.current?.abort();const c=new AbortController();control.current=c;setBusy(true);setError(null);
  try{const response=await fetch('/api/home/pairing?'+new URLSearchParams({scope:scopeKey}),{signal:c.signal,cache:'no-store'});const data=await response.json() as InspectionView&{error?:string};if(!response.ok)throw new Error(data.error??'来源读取失败');if(c.signal.aborted)return;setView(data);const available=new Set(data.executions.filter(e=>e.side==='sell').map(e=>e.id)),initial:Record<string,string>={};let removed=false;for(const round of data.savedRounds)for(const id of round.closingExecutionIds){if(available.has(id))initial[id]=round.id;else removed=true;}for(const candidate of data.candidates)if(!initial[candidate.id])initial[candidate.id]=candidate.id;setGroups(initial);setBasis('');setConfirmed(false);setConflict(false);setMessage(removed?'已移除不在当前来源中的旧卖出，请重新核对分组及依据':null);}
  catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'读取失败');}finally{if(!c.signal.aborted)setBusy(false);}
 };
 const save=async()=>{
  if(!view||!confirmed||!basis.trim()||conflict)return;
  const byGroup=new Map<string,string[]>();for(const [id,group]of Object.entries(groups)){if(!group)continue;const ids=byGroup.get(group)??[];ids.push(id);byGroup.set(group,ids);}
  if(!byGroup.size&&!view.savedRounds.length){setError('请至少选择一个平仓回合');return;}
  control.current?.abort();const c=new AbortController();control.current=c;setBusy(true);setError(null);setMessage(null);
  try{const response=await fetch('/api/home/pairing',{method:'POST',headers:{'Content-Type':'application/json'},signal:c.signal,body:JSON.stringify({schema:'home-pairing-v1',scope,expectedRevision:view.inspection.revision,expectedFingerprint:view.inspection.fingerprint,confirmed:true,basis:basis.trim(),rounds:[...byGroup].map(([id,closingExecutionIds])=>({id,closingExecutionIds}))})});const data=await response.json() as {error?:string;inspection:PairingInspection;refreshWarning?:string};if(response.status===409)setConflict(true);if(!response.ok)throw new Error(data.error??'保存失败');if(c.signal.aborted)return;setView({...view,inspection:data.inspection,savedRounds:data.inspection.fact?.rounds??[],candidates:view.candidates.filter(candidate=>![...byGroup.values()].flat().includes(candidate.id)),status:'current'});setConfirmed(false);setMessage(data.refreshWarning??'确认已保存，统计将在后台发布后更新');onSaved();}
  catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'保存失败');}finally{if(!c.signal.aborted)setBusy(false);}
 };
 const roundIds=[...new Set([...view?.savedRounds.map(r=>r.id)??[],...view?.executions.filter(e=>e.side==='sell').map(e=>e.id)??[]])];
 const closings=view?.executions.filter(e=>e.side==='sell'&&Object.hasOwn(groups,e.id))??[];
 const blocked=!!view?.reasons.length;
 return <details ref={panel} className="hp-pairing-confirmation" onToggle={e=>{if(e.currentTarget.open&&!view&&!busy)void load();}}><summary>核对历史平仓</summary>
  <p>同一账户、同一证券内核对。选择哪些卖出属于同一次主动平仓；买入按后买先卖匹配。保存会替换此证券已有确认，下方已保留有效原分组。全部选择“暂不确认”后保存会撤销当前确认，旧修订仍保留。</p>
  {busy&&<p role="status">正在处理…</p>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {conflict&&<p>来源已变化，当前填写仍保留。重新核对会按最新来源重置分组。<button type="button" onClick={()=>void load()} disabled={busy}>重新核对来源</button></p>}
  {view&&blocked&&<p>此证券暂不能在这里确认：{missingReasonText(view.reasons)||'成交依据不足'}。<span title={view.reasons.join('；')}>需补齐来源后再核对。</span></p>}
  {view&&!blocked&&<><p>已保存 {view.savedRounds.length} 回合 · 修订 {view.inspection.revision}</p>
   <div className="hp-pairing-table"><table><thead><tr>{['成交时间（原记录）','方向','数量','价格','费用','平仓分组'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{view.executions.map(e=><tr key={e.id}><td title={e.id}>{e.executedAt}{e.origin&&<small className="hp-pairing-origin">{[e.origin.fileName,e.origin.page?`第 ${e.origin.page} 页`:null,e.origin.row?`第 ${e.origin.row} 行`:null].filter(Boolean).join(" · ")}</small>}</td><td>{e.side==='buy'?'买入':'卖出'}</td><td>{e.quantity}</td><td>{e.price} {e.currency}</td><td>{e.fee}</td><td>{closings.some(c=>c.id===e.id)?<select aria-label={`${e.executedAt} 卖出分组`} value={groups[e.id]??''} disabled={busy} onChange={event=>{setGroups({...groups,[e.id]:event.target.value});setConfirmed(false);}}><option value="">暂不确认</option>{roundIds.map((id,index)=><option key={id} value={id}>第 {index+1} 回合</option>)}</select>:'—'}</td></tr>)}</tbody></table></div>
   {view.financialPreviews?.filter(p=>view.candidates.some(c=>c.closingExecutionIds.includes(p.closingExecutionId))).map(p=><p key={p.closingExecutionId}>待确认成交试算 · 单笔净盈亏 {money(p.net.value)} {p.net.currency}（分组后的回合结果以保存并发布后的统计为准）</p>)}
   {closings.length>0||view.savedRounds.length>0?<>{!closings.length&&<p>当前已无可确认卖出；保存将仅撤销旧来源的确认。</p>}<label className="hp-pairing-basis">确认依据<textarea maxLength={4000} value={basis} disabled={busy} onChange={e=>{setBasis(e.target.value);setConfirmed(false);}} placeholder="例如：核对原始账单，这两笔卖出属于同一次主动平仓"/></label><label className="hp-pairing-check"><input type="checkbox" checked={confirmed} disabled={busy||conflict} onChange={e=>setConfirmed(e.target.checked)}/>我已核对上述分组及原有回合，确认保存</label><button type="button" className="hp-primary" disabled={busy||conflict||!confirmed||!basis.trim()} onClick={()=>void save()}>保存平仓确认</button></>:<p>没有可确认的卖出记录。</p>}
  </>}
  {!view&&!busy&&<button type="button" onClick={()=>void load()}>读取来源</button>}
 </details>;
}
