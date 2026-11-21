import {normalizeTradeLibraryBrowseState} from '../library/library-browse-state';
import {tradeExecutionTradingDate,type TradeLibraryEntry} from '../../lib/trades/library';
/** Keep whole review episodes that have actual activity in the inclusive source trading-date range. */
export function fullLibraryActivityEntries(entries:readonly TradeLibraryEntry[],range:{from:string|null;to:string|null}|null):TradeLibraryEntry[]{
 if(!range||(!range.from&&!range.to))return [...entries];
 return entries.flatMap(entry=>{const episodes=entry.episodes.filter(({episode})=>episode.executions.some(execution=>{const day=tradeExecutionTradingDate(execution);return (!range.from||day>=range.from)&&(!range.to||day<=range.to);}));return episodes.length?[{...entry,episodes}]:[];});
}
export function fullLibraryEntry(params:Record<string,string|string[]|undefined>){
 const get=(key:string)=>typeof params[key]==='string'?params[key]:undefined;const notices:string[]=[];
 let accounts:string[]=[];try{const raw=JSON.parse(get('accounts')??'[]');if(!Array.isArray(raw)||raw.some(v=>typeof v!=='string'||!v||v==='all'))throw new Error();accounts=[...new Set(raw)];}catch{notices.push('账户参数无效，已恢复全部实盘账户');}
 if(!accounts.length&&!notices.length)notices.push('未指定账户，已恢复全部实盘账户');
 const rawMarket=get('market')??'all',market=['all','CN','HK','US'].includes(rawMarket)?rawMarket:'all';if(market!==rawMarket)notices.push('市场参数无效，已恢复全部市场');
 const day=(key:string)=>{const s=get(key);return s&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:null;};
 let from=get('rangeMode')==='all'?null:day('from'),to=get('rangeMode')==='all'?null:day('to');
 if(get('rangeMode')!=='all'&&(!from||!to||from>to)){from=null;to=null;notices.push('成交期间参数无效，已恢复全部期间');}
 return {accounts,market,from,to,instrumentId:get('instrument'),returnTo:get('returnTo')==='/home'?'/home':undefined,notice:notices.join('；')};
}

export function fullLibraryBrowse(entry:{accounts:string[];market:string;instrumentId?:string}){
 return normalizeTradeLibraryBrowseState({mode:'stocks',selectedInstrumentId:null,market:entry.market==='CN'?'a-share':entry.market,accounts:entry.accounts,tradeNature:'live',closeDateFrom:null,closeDateTo:null,roomFilters:{assetCategory:'all',assetType:'all',query:'',instrumentIds:entry.instrumentId?[entry.instrumentId]:[],markets:[],currencies:[],reviewStatuses:[]}},'stocks');
}
