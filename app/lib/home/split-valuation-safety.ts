import {decimal} from './period';

/** Verified issuer action; projected inventory never rewrites source executions. */
export const verifiedSplitBoundaries=[{
 instrumentId:'US:SNDK',effectiveAt:'2026-11-19T21:01:00.000Z',firstSession:'2026-11-20',ratio:'8',
 source:'https://www.sec.gov/Archives/edgar/data/2023554/000162828026075127/sndk-20261119.htm',
}] as const;
export function splitQuoteUnitReason(instrumentId:string,cursor:string,session:string):string|null {
 const event=verifiedSplitBoundaries.find(e=>e.instrumentId===instrumentId);
 if(!event)return null;
 const inventoryAfter=Date.parse(cursor)>=Date.parse(event.effectiveAt),quoteAfter=session>=event.firstSession;
 return inventoryAfter!==quoteAfter ? `${instrumentId.split(':')[1]} 拆股前后持仓与 ${session} 收盘报价单位不一致，暂停估值` : null;
}

/** Normalize a completed raw observation to the inventory's visible unit basis. */
export function splitValuationQuote(instrumentId:string,cursor:string,session:string|null|undefined,raw:string|null):{price:string|null;notes:string[]} {
 if(raw===null||!session)return {price:raw,notes:[]};
 const event=verifiedSplitBoundaries.find(e=>e.instrumentId===instrumentId);
 if(!event||!splitQuoteUnitReason(instrumentId,cursor,session))return {price:raw,notes:[]};
 if(Date.parse(cursor)<Date.parse(event.effectiveAt))return {price:null,notes:[]};
 return {price:decimal(raw).div(event.ratio).toFixed(),notes:[`拆股推算：${instrumentId.split(':')[1]} ${session} 拆前收盘价按 1 拆 ${event.ratio} 换算为当前单位，暂估，待拆后报价更新`]};
}
