import Decimal from 'decimal.js';
import type { Amount, HomeRequest, HomepageSource, HomeView, Scenario, Stamp } from '../display-contract';
import { amount, createMockSource, TODAY } from '../mock-source';
import { EMPTY_FILTERS, type MockInstrument } from './contracts';

// Explicit illustrative presentation fixtures. Not a valuation engine or a backend proposal.
const SEEDS = [
  ['贵州茅台','600519','SSE','CN','CNY','100','1680.25','1820.50','182050','14025'],
  ['腾讯控股','00700','HKEX','HK','HKD','400','305.50','338.20','123892','11979.6'],
  ['Apple Inc.','AAPL','NASDAQ','US','USD','50','175.80','188.36','67472.54','4499.58'],
  ['平安银行','000001','SZSE','CN','CNY','2000','11.85','12.76','25520','1820'],
  ['长和','000001','HKEX','HK','HKD','1000','41.35','38.60','35350','-2518.50'],
  ['宁德时代','300750','SZSE','CN','CNY','300','206.40','219.80','65940','4020'],
  ['Microsoft Corp.','MSFT','NASDAQ','US','USD','20','328.50','338.10','48444.38','1375.49'],
  ['沪深300ETF','510300','SSE','CN','CNY','5000','3.82','3.95','19750','650'],
] as const;
export function mockInstruments(scenario:Scenario):MockInstrument[] {
  const count=({empty:0,one:1,five:5,nine:9,ten:10,twenty:20,'fifty-pages':400} as Partial<Record<Scenario,number>>)[scenario]??8;
  const open = Array.from({length:count},(_,i):MockInstrument=>{
    const s=SEEDS[i%8], extreme=scenario==='extreme', unknown=scenario==='unknown'&&i===0;
    return {id:`account-${i%2+1}:${s[2]}:${s[1]}:${i}`,name:s[0]+(extreme?' · 超长名称完整展示边界示例':'')+(i>=8?` · ${i+1}`:''),code:s[1],exchange:s[2],market:s[3],currency:s[4],accountId:`account-${i%2+1}`,assetType:i%8===7?'ETF':'股票',open:true,review:i%3===0?'pending':'done',holdingDays:[288,207,101,0,null,55,100,365][i%8],quantity:extreme?'-12345678.123456':s[5],cost:unknown?null:s[6],price:unknown?null:s[7],marketValue:amount(unknown?null:extreme?'123456789012.3456789':s[8]),unrealized:amount(unknown?null:s[9])};
  });
  if(scenario==='empty') return [];
  const closed=SEEDS.slice(0,4).map((s,i):MockInstrument=>({...open[i%open.length],id:`closed:${s[2]}:${s[1]}`,name:s[0],code:s[1],exchange:s[2],market:s[3],currency:s[4],accountId:`account-${i%2+1}`,assetType:'股票',open:false,review:'done',quantity:'0',marketValue:amount('0'),unrealized:amount('0')}));
  return [...open,...closed];
}
const sum=(rows:MockInstrument[],key:'marketValue'|'unrealized')=>rows.some(row=>row[key].value===null)?null:rows.reduce((n,row)=>n.add(row[key].value??0),new Decimal(0)).toFixed();
export function matchesScope(row:MockInstrument,request:HomeRequest) {
  const f=request.filters??EMPTY_FILTERS;
  return (request.market==='all'||row.market===request.market)&&(request.accountId==='all'||row.accountId===request.accountId)&&(!f.assetTypes.length||f.assetTypes.includes(row.assetType))&&(!f.openOnly||row.open)&&(f.review==='all'||row.review===f.review);
}
export function createCompleteMockSource(scenario:Scenario,delayMs=30):HomepageSource {
  const base=createMockSource({scenario,delayMs}), instruments=mockInstruments(scenario), issued=new Map<string,HomeView>();
  const holdings=(request:HomeRequest)=>instruments.filter(row=>row.open&&matchesScope(row,request));
  const search=(request:HomeRequest)=>holdings(request).filter(row=>`${row.name} ${row.exchange} ${row.code}`.toLowerCase().includes(request.query.toLowerCase().trim())).sort((a,b)=>{
    const order=request.sort==='name'?a.name.localeCompare(b.name,'zh-CN'):new Decimal(a[request.sort].value??'-1e100').comparedTo(b[request.sort].value??'-1e100');
    return request.direction==='asc'?order:-order;
  });
  function validate(stamp:Stamp,id:string) {
    const view=issued.get(stamp.version);
    if(!view||JSON.stringify(view.stamp)!==JSON.stringify(stamp))throw new Error('展示版本不匹配，请重新打开');
    const row=instruments.find(row=>row.id===id);
    if(!row)throw new Error('找不到该标的');
    return row;
  }
  const pause=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
    if(signal.aborted){reject(new DOMException('Cancelled','AbortError'));return;}
    const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},delayMs);signal.addEventListener('abort',abort,{once:true});
  });
  return {
    async readHome(request,signal) {
      const original=await base.readHome({...request,market:'all'},signal);
      const scoped=holdings(request), rows=search(request), pages=Math.ceil(rows.length/8), page=Math.min(Math.max(1,request.page),Math.max(1,pages));
      const full=instruments.filter(row=>row.open), factor=full.length?new Decimal(scoped.length).div(full.length):new Decimal(0);
      const scale=(v:Amount)=>amount(v.value===null?null:new Decimal(v.value).mul(factor).toFixed(2),'CNY',v.reasons);
      const version=JSON.stringify([scenario,request,page]), stamp={scope:JSON.stringify([request.market,request.accountId,request.period]),version,asOf:TODAY,reportCurrency:'CNY'};
      const view:HomeView={...original,stamp,request:{...request,page},metrics:{net:scale(original.metrics.net),periodRealized:scale(original.metrics.periodRealized),unrealizedChange:scale(original.metrics.unrealizedChange),currentMarketValue:amount(sum(scoped,'marketValue'))},currentUnrealized:amount(sum(scoped,'unrealized')),series:{...original.series,version,points:original.series.points.map(p=>({...p,marketValue:scale(p.marketValue),unrealized:scale(p.unrealized),realized:scale(p.realized),net:scale(p.net),periodNet:scale(p.periodNet),periodFees:scale(p.periodFees)}))},holdings:{rows:rows.slice((page-1)*8,page*8),total:rows.length,page,pages,marketValue:amount(sum(rows,'marketValue')),unrealized:amount(sum(rows,'unrealized')),sortAvailable:!['unknown','partial'].includes(scenario)}};
      issued.set(version,view);return view;
    },
    async readHolding(stamp,id,signal){await pause(signal);return {stamp,holding:validate(stamp,id),description:'Mock 标的详情'};},
    async readTrades(stamp,id,signal){await pause(signal);const row=validate(stamp,id);return {stamp,holdingId:id,name:row.name,trades:[{id:`${id}:buy`,date:'2026-03-02',side:'买入',quantity:row.open?row.quantity??'100':'100',price:row.cost,currency:row.currency},...(!row.open?[{id:`${id}:sell`,date:'2026-08-12',side:'卖出',quantity:'100',price:row.price,currency:row.currency}]:[])]};},
    async exportHoldings(request,signal){await pause(signal);const csv=(s:string)=>`"${s.replaceAll('"','""')}"`;return '\uFEFF'+[['名称','代码','交易所','资产类型','账户','原币','数量','市值(CNY)','浮动盈亏(CNY)'],...search(request).map(row=>[row.name,row.code,row.exchange,row.assetType,row.accountId,row.currency,row.quantity??'',row.marketValue.value??'',row.unrealized.value??''])].map(row=>row.map(csv).join(',')).join('\r\n');},
    async repair(_request,signal){await pause(signal);return {remainingReasons:scenario==='partial'?['部分行情尚未覆盖']:[]};},
  };
}
