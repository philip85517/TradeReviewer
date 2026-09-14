"use client";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import Decimal from "decimal.js";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import type { TradeRevision, TradeRevisionRequest, TradeChange } from "../../lib/storage/trade-revisions";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";
import { useModalFocus } from "../import/use-modal-focus";

type Props = {
 instrument: Instrument; initialAccountId: string; executions: TradeExecution[]; cursor?: string;
 marketSummary: string; marketDetails: string[]; refreshing: boolean;
 onRefresh: () => void; onClose: () => void; onRevise: (input: TradeRevisionRequest) => Promise<void>;
 loadHistory: (instrumentId: string) => Promise<TradeRevision[]>;
 onSupplement: (accountId: string, kind: "file" | "screenshot") => void;
 retainedReviews: Array<{ review?: EpisodeReviewRecord; episodeId: string; drawingCount: number; drawings?: unknown[] }>;
};
const localTime = (value: string) => new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0,19);
const describe = (record: TradeExecution | null) => record ? `${new Date(record.executedAt).toLocaleString("zh-CN", {timeZone:"Asia/Shanghai",hour12:false})} · ${record.side === "buy" ? "买入" : "卖出"} ${record.quantity} @ ${record.price} · 费用 ${record.fee}` : "无记录";
function Changes({ changes }: { changes: TradeChange[] }) {
 return <div className="trade-change-list">{changes.map((change, index) => <div key={index}><p><strong>修改前：</strong>{describe(change.before)}</p><p><strong>修改后：</strong>{describe(change.after)}</p></div>)}</div>;
}
export function StockDataDialog(props: Props) {
 const [revealed, setRevealed] = useState(!props.cursor);
 const [chosenAccountId, setAccountId] = useState(props.initialAccountId);
 const [editing, setEditing] = useState<{ before: TradeExecution | null; remove: boolean }>();
 const [form, setForm] = useState({ time: "", side: "buy", quantity: "", price: "", fee: "0", reason: "" });
 const [preview, setPreview] = useState<TradeRevisionRequest>();
 const [busy, setBusy] = useState(false); const [error, setError] = useState("");
 const [history, setHistory] = useState<TradeRevision[]>([]); const [historyError, setHistoryError] = useState(""); const [historyAttempt, setHistoryAttempt] = useState(0);
 const accountId = chosenAccountId || history[0]?.accountId || "";
 const [saved, setSaved] = useState(false);
 const close = () => { if (!busy) props.onClose(); };
 const dialogRef = useModalFocus(close);
 const accounts = useMemo(() => new Map([[props.initialAccountId, props.executions.find(e=>e.accountId===props.initialAccountId)?.accountLabel ?? props.initialAccountId] as const, ...props.executions.map(e=>[e.accountId,e.accountLabel] as const), ...history.map(revision=>[revision.accountId,(revision.changes[0]?.before ?? revision.changes[0]?.after)?.accountLabel ?? revision.accountId] as const)].filter(([id])=>Boolean(id))), [props.executions,props.initialAccountId,history]);
 const { loadHistory, instrument: { id: historyInstrumentId } } = props;
 const records = props.executions.filter(record=>record.accountId===accountId);
 useEffect(() => {
   if (!revealed) return;
   let active = true;
   loadHistory(historyInstrumentId).then(value=>{if(active){setHistory(value);setHistoryError("");}}).catch(()=>{if(active)setHistoryError("修订历史读取失败，当前成交仍可核对。");});
   return ()=>{active=false;};
 }, [revealed, loadHistory, historyInstrumentId, historyAttempt]);
 function edit(before: TradeExecution | null, remove = false) {
   setEditing({before, remove});setPreview(undefined);setError("");setSaved(false);
   setForm({time: before ? localTime(before.executedAt) : "",side: before?.side ?? "buy",quantity: before?.quantity ?? "",price:before?.price ?? "",fee:before?.fee ?? "0",reason:""});
 }
 function prepare() {
   if (!editing || !form.reason.trim()) {setError("请填写修订原因。");return;}
   try {
     let after: TradeExecution | null = null;
     if (!editing.remove) {
       for (const field of ["quantity","price","fee"] as const) { const value = new Decimal(form[field]); if (!value.isFinite() || (field === "fee" ? value.lt(0) : value.lte(0))) throw new Error(); }
       if (!form.time) throw new Error();
       const timeChanged = !editing.before || form.time !== localTime(editing.before.executedAt);
       const executedAt = timeChanged ? new Date(`${form.time}+08:00`).toISOString() : editing.before!.executedAt;
       after = { id: editing.before?.id ?? `manual:${crypto.randomUUID()}`, instrument: props.instrument, accountId, accountLabel: accounts.get(accountId) ?? accountId, source: { ...(editing.before?.source ?? { platform:"manual", row:0 }), ...(timeChanged ? { timePrecision:"second" as const, sourceTimestampText:form.time.replace("T"," "), sourceTimezone:"Asia/Shanghai" } : {}) }, executedAt, side:form.side === "sell" ? "sell":"buy", quantity:form.quantity,price:form.price,fee:form.fee };
     }
     setPreview({ id:crypto.randomUUID(),instrumentId:props.instrument.id,accountId,reason:form.reason.trim(),changes:[{before:editing.before,after}] });setError("");
   } catch { setError("请输入有效时间、正数数量和价格，以及非负费用。"); }
 }
 async function save() {
   if (!preview || busy) return;setBusy(true);setError("");
   try {await props.onRevise(preview);setPreview(undefined);setEditing(undefined);setSaved(true);setHistoryAttempt(value=>value+1);} catch(e) {setError(e instanceof Error?e.message:"修订未保存，请重试。");} finally{setBusy(false);}
 }
 return <div className="modal-backdrop stock-data-backdrop"><section ref={dialogRef} className="stock-data-dialog" role="dialog" aria-modal="true" aria-label="检查与修复当前股票数据">
   <header><div><small>当前股票数据</small><h2>{props.instrument.name}（{props.instrument.symbol}）</h2></div><button aria-label="关闭数据检查" disabled={busy} onClick={close}><X size={20}/></button></header>
   {!revealed ? <div className="data-reveal-warning"><p>当前回放只显示游标之前的成交，未显示不代表记录缺失。</p><p>数据检查会展示该股票的完整交易历史，包括尚未回放的成交。</p><button className="primary-action" onClick={()=>setRevealed(true)}>查看完整数据并暂停复盘</button></div> : <>
   <label>当前账户<select aria-label="当前账户" disabled={busy || Boolean(editing)} value={accountId} onChange={e=>setAccountId(e.target.value)}>{[...accounts].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <section className="stock-data-market"><h3>行情检查</h3><p role="status">{props.marketSummary}</p>{props.marketDetails.slice(0,3).filter(Boolean).map((line,index)=><p key={index}>{line}</p>)}{props.marketDetails.length>3 && <details><summary>查看覆盖区间与缺口</summary><div className="stock-data-coverage">{props.marketDetails.slice(3).filter(Boolean).map((line,index)=><p key={index}>{line}</p>)}</div></details>}<button disabled={props.refreshing} onClick={props.onRefresh}>{props.refreshing?"正在更新行情…":"更新当前股票行情"}</button></section>
   <p>补充文件只接收当前股票和账户；补充截图的成交将明确归入上方选定账户。</p>
   <div className="stock-data-actions"><button disabled={!accountId || busy || Boolean(editing)} onClick={()=>edit(null)}>补录成交</button><button disabled={!accountId || busy || Boolean(editing)} onClick={()=>props.onSupplement(accountId,"file")}>为本股补充文件</button><button disabled={!accountId || busy || Boolean(editing)} onClick={()=>props.onSupplement(accountId,"screenshot")}>为本股补充截图</button></div>
   <p>当前账户已存 {records.length} 笔{props.cursor ? `，打开检查时已揭示 ${records.filter(e=>Date.parse(e.executedAt)<=Date.parse(props.cursor!)).length} 笔` : ""}。以下时间均为北京时间（UTC+08:00）。</p>
   {!records.length && <p>当前账户没有成交，可补录或补充导入。</p>}
   {records.map(record=><article className="stock-data-record" key={record.id}><strong>{describe(record)}</strong><details><summary>查看来源</summary><p>{record.source.platform} · {record.source.fileName ?? "未记录文件名"} · 第 {record.source.row+1} 行</p><p>来源时间文本：{record.source.sourceTimestampText ?? "未保存"}</p><p>来源时区：{record.source.sourceTimezone ?? "未记录"}</p>{record.source.batchId&&<p>批次：{record.source.batchId}</p>}{record.source.sourceBounds&&<p>截图区域：x={record.source.sourceBounds.x}，y={record.source.sourceBounds.y}</p>}<p>原图/原文件未保存在当前数据库，请依据来源信息核对原凭证。修改前的原始字段保留在修订历史中。</p></details><div><button disabled={busy || Boolean(editing)} onClick={()=>edit(record)}>编辑成交</button><button disabled={busy || Boolean(editing)} onClick={()=>edit(record,true)}>移除此记录</button></div></article>)}
   {editing && <section className="trade-correction"><h3>{editing.remove?"移除误导入记录":editing.before?"编辑成交":"补录成交"}</h3>{!preview ? <form onSubmit={event=>{event.preventDefault();prepare();}}>
     {!editing.remove && <div className="trade-correction-fields"><label>成交时间（北京时间）<input required type="datetime-local" step="1" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></label><label>方向<select value={form.side} onChange={e=>setForm({...form,side:e.target.value})}><option value="buy">买入</option><option value="sell">卖出</option></select></label>{([['quantity','数量'],['price','价格'],['fee','费用']] as const).map(([field,label])=><label key={field}>{label}<input required inputMode="decimal" value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})}/></label>)}</div>}
     <label>修订原因<textarea required value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label><button type="submit">预览修改</button><button type="button" onClick={()=>setEditing(undefined)}>取消修改</button>
   </form> : <><h4>确认本次修订</h4><Changes changes={preview.changes}/><p>原因：{preview.reason}</p><p>修改可能重建回合与统计。原笔记不会自动挂到新回合，历史记录会保留供核对。</p><button disabled={busy} onClick={()=>void save()}>{busy?"正在保存…":"确认保存修订"}</button><button disabled={busy} onClick={()=>setPreview(undefined)}>返回修改</button></>}</section>}
   {error&&<p role="alert">{error}</p>}{saved&&<p role="status">修订已保存，成交与回合已更新。</p>}
   <details className="trade-revision-history"><summary>修订历史（{history.filter(r=>r.accountId===accountId).length}）</summary>{historyError&&<p role="alert">{historyError}<button onClick={()=>setHistoryAttempt(n=>n+1)}>重试读取</button></p>}{history.filter(r=>r.accountId===accountId).map(revision=><article key={revision.id}><strong>{new Date(revision.recordedAt).toLocaleString("zh-CN")} · {revision.reason}</strong><Changes changes={revision.changes}/></article>)}</details>
   {props.retainedReviews.length>0&&<details><summary>原回合保留的笔记与绘图（{props.retainedReviews.length}）</summary>{props.retainedReviews.map(item=><article key={item.episodeId}><p>原回合笔记 · {item.review ? new Date(item.review.updatedAt).toLocaleString("zh-CN") : "保留的绘图"}</p><p>计划：{item.review?.plan.thesis || "未填写"}</p><p>预期路径：{item.review?.plan.expectedPath || "未填写"}</p><p>失效条件：{item.review?.plan.invalidationCondition || "未填写"}</p><p>目标区间：{item.review?.plan.targetRange || "未填写"}</p><p>计划风险：{item.review?.plan.plannedRiskAmount || "未填写"}</p><p>信心评分：{item.review?.plan.confidence ?? "未填写"}</p><p>决策评分：{item.review?.review.decisionQuality ?? "未填写"}，执行评分：{item.review?.review.executionQuality ?? "未填写"}</p><p>风险管理：{item.review?.review.riskManagement || "未填写"}</p><p>心理：{item.review?.review.psychology || "未填写"}</p><p>总结：{item.review?.review.reusableRule || "未填写"}</p><a download="原回合笔记与绘图.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(item,null,2))}`}>导出原笔记与绘图供核对</a><p>绘图：{item.drawingCount} 个，保留在原回合记录中。</p></article>)}</details>}
   </>}
 </section></div>;
}
