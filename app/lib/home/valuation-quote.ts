import type {DailyCandleRecord,SupportedMarket} from '../market/contracts';
import {expectedTradingDates,CalendarOutOfRangeError} from '../market/calendar';
import {requiredMarketDataRange} from '../market/sync-range';
import {decimal,nextDay} from './period';
type Quote=Pick<DailyCandleRecord,'instrumentId'|'tradingDate'|'adjustmentMode'|'currency'|'provider'|'close'>;
/** The exact raw observation accepted by the native valuation builder. */
export function valuationRawClose(quote:Quote|undefined,id:string,currency:string,session:string):string|null{
 if(!quote||quote.instrumentId!==id||quote.tradingDate!==session||quote.adjustmentMode!=='raw'||quote.currency!==currency||!quote.provider)return null;
 try{return decimal(quote.close).gte(0)?decimal(quote.close).toFixed():null;}catch{return null;}
}
/** Historical Beijing day-end needs session dates; live times need exact closes. */
export function valuationSession(market:SupportedMarket,at:Date):string{
 const iso=at.toISOString();
 if(iso.endsWith('T15:59:59.999Z')){
  const day=iso.slice(0,10),last=market==='US'?nextDay(day,-1):day;
  const session=expectedTradingDates(market,nextDay(last,-31),last).at(-1);
  if(!session)throw new CalendarOutOfRangeError(`无法确认 ${market} ${day} 的历史收盘日`);
  return session;
 }
 return requiredMarketDataRange(iso,iso,{open:true,market,now:at}).endDate;
}
