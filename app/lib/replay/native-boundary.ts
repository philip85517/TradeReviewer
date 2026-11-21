import {Temporal} from '@js-temporal/polyfill';
import type {TradeExecution} from '../trades/types';
import {replayExecutionAt} from '../import/statement-evidence';

const boundaries=new Map<string,string>();
/** Date-only statement evidence is known at the source market's civil boundary,
 * not at UTC midnight or a fabricated execution time. Handles US DST. */
export function nativeMarketBoundary(wall:string,market:string|undefined):string {
 const zone=market==='US'?'America/New_York':'Asia/Shanghai',key=`${zone}/${wall}`;
 let result=boundaries.get(key);
 if(!result){
  result=new Date(Number(Temporal.PlainDateTime.from(wall.replace(/Z$/,'')).toZonedDateTime(zone).epochMilliseconds)).toISOString();
  if(boundaries.size>=20000)boundaries.clear();boundaries.set(key,result);
 }
 return result;
}
export function nativeExecutionAt(execution:TradeExecution):string {
 const at=replayExecutionAt(execution);
 return execution.source.timePrecision==='date-only'||execution.executedAt.length===10?nativeMarketBoundary(at,execution.instrument.market):at;
}

export function nativeExecutionDay(execution:TradeExecution):string {
 if(execution.source.timePrecision==='date-only'||execution.executedAt.length===10)return replayExecutionAt(execution).slice(0,10);
 return execution.source.marketCalendarDate??execution.source.tradingDate??Temporal.Instant.from(execution.executedAt).toZonedDateTimeISO(execution.instrument.market==='US'?'America/New_York':'Asia/Shanghai').toPlainDate().toString();
}
