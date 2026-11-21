'use client';
import {useEffect,useRef} from 'react';
import type {FullDetail} from '../../lib/home/full-contracts';
import {HoldingDetailPanel} from './holding-detail';
import {BusinessPairingConfirmation} from './business-pairing-confirmation';
function FeeEvidence({detail}:{detail:FullDetail}) {
 const {trades,nextCursor}=detail;
 if(!trades.length)return null;
 return <details className="hp-fee-evidence"><summary>逐笔费用依据（{nextCursor?'前 ':''}{trades.length} 笔）</summary>
  <ul>{trades.map(trade=>{
   const basis=trade.feeBasis;
   const amount=basis?.amount==null?null:`${Number(basis.amount).toFixed(2)} ${basis.currency}`;
   const source=!basis?'该版本未记录费用来源':basis.kind==='market-default-estimate'?'原件缺费，按市场默认值估算':amount===null?'原件费用未知':'原件实报';
   return <li key={trade.id}><span>{trade.date} · {trade.side}</span><span>{amount??'—'} · {source}</span></li>;
  })}</ul>
 </details>;
}
export function FullDetailPanel({detail,onClose,onLibrary,accountName,onPairingSaved}:{detail:FullDetail;onClose:()=>void;onLibrary:(trigger:HTMLElement)=>void;accountName?:string;onPairingSaved:()=>void}){
 const feeEvidence=<FeeEvidence detail={detail}/>;
 const ref=useRef<HTMLDivElement>(null);
 const first=detail.items[0],confirmation=detail.items.length===1&&first?<BusinessPairingConfirmation key={first.id} scope={{accountId:first.accountId,instrumentId:first.instrumentId}} onSaved={onPairingSaved}/>:null;
 useEffect(()=>{if(detail.holding)return;ref.current?.focus();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[detail]);
 if(detail.holding)return <HoldingDetailPanel real detail={{stamp:{version:detail.releaseId,scope:detail.target.sourceContext,asOf:'',reportCurrency:'CNY'},holding:detail.holding,description:detail.description}} trades={null} pending={false} error={null} accountName={accountName} onClose={onClose} onTrades={()=>onLibrary(document.activeElement as HTMLElement)} onBack={()=>{}} onCancel={()=>{}}>{feeEvidence}{confirmation}</HoldingDetailPanel>;
 const item=detail.items[0];return <div className="hp-modal-backdrop"><div className="hp-holding-detail" role="dialog" aria-modal="true" aria-label={`${item?.name} · 标的详情`} ref={ref} tabIndex={-1} onKeyDown={e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary')).filter(e=>e.getClientRects().length);if(e.shiftKey&&(document.activeElement===buttons[0]||document.activeElement===ref.current)){e.preventDefault();buttons.at(-1)?.focus();}else if(!e.shiftKey&&(document.activeElement===buttons.at(-1)||document.activeElement===ref.current)){e.preventDefault();buttons[0]?.focus();}}}}><button className="hp-close" onClick={onClose} aria-label="关闭标的详情">×</button><h2>{item?.name} · 标的详情</h2><p className="hp-detail-meta">{item?.exchange}:{item?.code} · {accountName??item?.accountId} · {item?.currency} · 已平仓</p><p>{detail.description}</p><p>已确认平仓回合 {detail.rounds.length}</p><table><thead><tr><th>平仓日期</th><th>净盈亏(CNY)</th></tr></thead><tbody>{detail.rounds.map(r=><tr key={r.id}><td>{r.closeBusinessDay??'未知'}</td><td title={r.net.reasons.join('；')}>{r.net.value??'—'} {r.net.currency}</td></tr>)}</tbody></table><button type="button" className="hp-primary hp-detail-action" onClick={e=>onLibrary(e.currentTarget)}>查看交易</button>{feeEvidence}{confirmation}</div></div>;
}
