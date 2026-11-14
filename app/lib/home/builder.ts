import { createHash } from 'node:crypto';
import type { Instrument, TradeExecution } from '../trades/types';
import {isMonthlyEvidenceScope,type MonthlyStatement} from '../import/monthly-statement';
import { canonicalInstrumentId } from '../instruments/display-name';
import { nativeExecutionAt } from '../replay/native-boundary';
import { nativeEvidenceBoundaries } from '../replay/position-ledger';
import { requiredMarketDataRange, nextMarketSessionCutoff } from '../market/sync-range';
import { CalendarOutOfRangeError } from '../market/calendar';
import type { SupportedMarket } from '../market/contracts';
import type { Holding, Market } from '../../components/homepage-preview/display-contract';
import { HOME_POLICY, scopeId, type NativeBucket, type NativeDay, type ReleaseInput, type ScopeProjection } from './contracts';
import { convertNative, decimal, nextDay, validDay } from './period';
import { businessDay, executionBusinessDay, nativePosition, type NativePosition } from './finance';
import type { SourceSnapshot } from './source';
import { collectFees } from './fees';
import type {ProjectionCache} from './projection-cache';
import {metricObjectVersion} from './metric-objects';
import {compactSeries,NativeSeriesAccumulator} from './native-series';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const marketOf = (market: string): Market => market.startsWith('CN-') ? 'CN' : market === 'HK' || market === 'US' ? market : 'all';
const empty = (): NativeBucket => ({ market:'0', unrealized:'0', realized:'0', realizedMissing:0, fees:'0',feesMissing:0,count:0,marketKnown:0,unrealizedKnown:0,lifetimeComplete:true,reasons:[] });
const sum = (a: string | null, b: string | null) => a === null || b === null ? null : a === '0' ? b : b === '0' ? a : decimal(a).plus(b).toFixed();
type Group = { key: string; accountId: string; instrument: Instrument; executions: TradeExecution[]; evidence: MonthlyStatement[] };
type Projection = { metric:import('./contracts').MetricObject; group: Group; current: NativeDay; state: NativePosition; price: string | null; opened: string | null };

/** CPU-only construction. HTTP reads never call this module. */
export function buildRelease(source: SourceSnapshot, id: string, options: {cache?:ProjectionCache;reusePublished?:boolean;stats?:{reused:number;built:number};timings?:Record<string,number>} = {}): ReleaseInput {
  let phaseStart=performance.now();
  const phase=(name:string)=>{const now=performance.now();if(options.timings)options.timings[name]=now-phaseStart;phaseStart=now;};
  const fees = collectFees(source);
  let nextRefreshAt = new Date(Date.parse(`${nextDay(source.businessDate)}T00:00:00.000Z`) - 8 * 3600000).toISOString();
  const considerBoundary = (at: string) => { if (Date.parse(at) > Date.parse(source.asOf) && Date.parse(at) < Date.parse(nextRefreshAt)) nextRefreshAt = new Date(at).toISOString(); };
  fees.forEach(f => considerBoundary(f.knownAt));
  const groups = new Map<string, Group>();
  const groupFor = (accountId: string, instrument: Instrument) => {
    const key = JSON.stringify([accountId,instrument.id,'live']); let group = groups.get(key);
    if (!group) { group = { key,accountId,instrument,executions:[],evidence:[] }; groups.set(key,group); } return group;
  };
  for (const execution of source.executions) groupFor(execution.accountId, execution.instrument).executions.push(execution);
  const instruments = new Map(source.instruments.map(i=>[canonicalInstrumentId(i.symbol,i.market),i]));
  const currenciesByIdentity=new Map<string,Set<string>>();
  const evidenceByIdentity=new Map<string,Set<MonthlyStatement>>();
  for(const statement of source.monthly)for(const item of [...statement.positions,...statement.events]){
    if(!item.symbol||!item.market)continue;
    const identity=canonicalInstrumentId(item.symbol,item.market);
    const key=JSON.stringify([item.accountId,identity]);
    const evidence=evidenceByIdentity.get(key)??new Set<MonthlyStatement>();evidence.add(statement);evidenceByIdentity.set(key,evidence);
    if('currency' in item&&item.currency){const currencies=currenciesByIdentity.get(identity)??new Set<string>();currencies.add(item.currency);currenciesByIdentity.set(identity,currencies);}
  }
  for (const statement of source.monthly) for (const item of [...statement.positions,...statement.events]) {
    if (!item.symbol || !item.market || !('quantity' in item) || item.quantity === undefined) continue;
    const identity = canonicalInstrumentId(item.symbol,item.market);
    // A statement establishes identity and inventory, but not the listing currency.
    // In particular, a market's usual currency is not proof for dual-currency listings.
    const currencies = currenciesByIdentity.get(identity)??new Set<string>();
    const instrument = instruments.get(identity) ?? {id:identity,symbol:item.symbol,market:item.market,name:item.symbol,currency:currencies.size===1?[...currencies][0]:'UNKNOWN'};
    groupFor(item.accountId,instrument);
  }
  for (const group of groups.values()) {
    const identity=canonicalInstrumentId(group.instrument.symbol,group.instrument.market);
    const evidence=new Set(evidenceByIdentity.get(JSON.stringify([group.accountId,identity]))??[]);
    // Gap-only statements have no position/event row to index. Keep their dated
    // boundary so a later proven flat inventory can recover new positions.
    for(const statement of source.monthly){
      if(statement.evidenceScope!==undefined&&(!isMonthlyEvidenceScope(statement.evidenceScope)||statement.evidenceScope.accountId!==group.accountId||statement.evidenceScope.instrumentId!==group.instrument.id))continue;
      if((!statement.accountId||statement.accountId===group.accountId)&&(statement.historyIncomplete||statement.incompleteInstruments?.some(i=>canonicalInstrumentId(i.symbol,i.market)===identity)))evidence.add(statement);
    }
    group.evidence=[...evidence];
  }
  const sourceDates = [...source.executions.map(executionBusinessDay),...source.monthly.flatMap(s=>[...s.positions,...s.events].map(p=>p.date.length===7?`${p.date}-01`:p.date.slice(0,10)))].filter(validDay);
  const first = nextDay(sourceDates.sort()[0] ?? source.businessDate,-1);
  const dates: string[] = []; for (let day=first;day<=source.businessDate;day=nextDay(day)) dates.push(day);
  if (!dates.length) throw new Error('源材料的起点晚于本次计算时间');
  const candlesByInstrument=new Map<string,typeof source.candles>();
  for(const candle of source.candles){const rows=candlesByInstrument.get(candle.instrumentId)??[];rows.push(candle);candlesByInstrument.set(candle.instrumentId,rows);}
  const rawByInstrument=new Map([...candlesByInstrument].map(([id,rows])=>[id,rows.filter(c=>c.adjustmentMode==='raw').sort((a,b)=>a.tradingDate.localeCompare(b.tradingDate))]));
  const completed = new Map<string,string|null>();
  const quoteAt = (group: Group, cursor: string) => {
    const market = group.instrument.market;
    if (!['CN-SH','CN-SZ','HK','US'].includes(market)) return null;
    const key = `${market}/${cursor}`;
    if (!completed.has(key)) {
      try { completed.set(key,requiredMarketDataRange(cursor,cursor,{market:market as SupportedMarket,open:true,now:new Date(cursor)}).endDate); }
      catch (e) { if (!(e instanceof CalendarOutOfRangeError)) throw e; completed.set(key,null); }
    }
    const end=completed.get(key),rows=rawByInstrument.get(group.instrument.id)??[];
    let lo=0,hi=rows.length;
    if(end)while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].tradingDate<=end)lo=mid+1;else hi=mid;}
    const quote=end&&lo>0&&rows[lo-1].tradingDate===end?rows[lo-1]:undefined;
    if (!quote || quote.currency !== group.instrument.currency || !quote.provider) return null;
    try { return decimal(quote.close).gte(0) ? decimal(quote.close).toFixed() : null; } catch { return null; }
  };
  // Daily projections hold native facts only. The published current FX snapshot
  // converts any selected interval at read time; changing FX never reruns the ledger.
  const fxByDay = new Map<string,import('./contracts').FxRates>();
  const projections: Projection[] = [];
  const aggregateDays=new Map<string,NativeDay[]>(), aggregateCurrent=new Map<string,NativeDay>();
  const baseSeries=new Map<string,{accountId:string;market:Market;series:NativeSeriesAccumulator}>();
  const add=(day:NativeDay,native:NativeDay)=>{
    for(const [code,b]of Object.entries(native.buckets)){
      const a=day.buckets[code];
      day.buckets[code]=!a?{...b}:{market:sum(a.market,b.market),unrealized:sum(a.unrealized,b.unrealized),realized:sum(a.realized,b.realized)!,realizedMissing:a.realizedMissing+b.realizedMissing,fees:sum(a.fees,b.fees)!,feesMissing:a.feesMissing+b.feesMissing,count:a.count+b.count,marketKnown:a.marketKnown+b.marketKnown,unrealizedKnown:a.unrealizedKnown+b.unrealizedKnown,lifetimeComplete:a.lifetimeComplete&&b.lifetimeComplete,reasons:[...new Set([...a.reasons,...b.reasons])]};
    }
  };
  const accept=(group:Group,projection:import('./projection-cache').ObjectProjection)=>{
    const baseKey=scopeId(marketOf(group.instrument.market),group.accountId);
    let base=baseSeries.get(baseKey);
    if(!base){base={accountId:group.accountId,market:marketOf(group.instrument.market),series:new NativeSeriesAccumulator()};baseSeries.set(baseKey,base);}
    base.series.add(projection.days);
    for(const account of new Set(['all',group.accountId]))for(const market of new Set<Market>(['all',marketOf(group.instrument.market)])){
      const key=scopeId(market,account);
      const current=aggregateCurrent.get(key)??{date:source.businessDate,buckets:{},fx:source.currentFx,reasons:[]};add(current,projection.current);aggregateCurrent.set(key,current);
    }
    const {days:_,...small}=projection;
    const native={...projection.current,fx:{}};
    const content={positionKey:group.key,accountId:group.accountId,code:group.instrument.symbol,name:group.instrument.localizedName?.name??group.instrument.name,firstDay:first,lastDay:source.businessDate,current:native,boundaries:compactSeries(projection.days)};
    const metric=projection.metric??{...content,version:metricObjectVersion(content)};
    projections.push({group,...small,metric});
  };
  phase('prepare');
  const preparedGroups = [...groups.values()].map(group => {
    if(group.executions.some(e=>e.instrument.currency!==group.instrument.currency))throw new Error('同一持仓原币冲突，不能发布');
    const context = [
      ...group.executions.map(nativeExecutionAt),
      ...nativeEvidenceBoundaries(group.executions, group.evidence,group.instrument.market),
    ].sort();
    context.forEach(considerBoundary);
    // Invalidate only objects affected by the verified acquisition ordering fix;
    // their parent scopes inherit this fingerprint, including FX-only reuse.
    const orderingPolicy=group.executions.some(e=>e.source.displayTimePolicy==='session-open'&&e.source.positionEffect==='open-long')?`${HOME_POLICY}/verified-session-open-v1`:HOME_POLICY;
    const fingerprint=digest([orderingPolicy,group,dates[0],source.businessDate,context.filter(at=>at<=source.asOf).length,quoteAt(group,source.asOf),candlesByInstrument.get(group.instrument.id)??[]]);
    return {group,context,fingerprint};
  });
  const unknown=(source.unclassified??[]).filter(e=>Date.parse(e.knownAt)<=Date.parse(source.asOf));
  const unknownCount=(market:Market,account:string)=>source.unclassified===undefined?(market==='all'&&account==='all'?source.classification.unknown:0):unknown.filter(e=>(account==='all'||e.accountId===account)&&(market==='all'||marketOf(e.market)===market)).length;
  const accountIds=['all',...[...new Set([...groups.values()].map(g=>g.accountId).concat(fees.map(f=>f.accountId),unknown.map(e=>e.accountId)))].sort()];
  const scopeSignatures=new Map<string,string>(), reusedScopes=new Map<string,string>();
  if(options.reusePublished&&options.cache){
    const findPublished=options.cache.scopeReuse(source.sequence);
    // Native scopes retain knowledge/quote boundaries. FX is independently
    // frozen on the release, so changing rates never rewrites native history.
    const common=digest([HOME_POLICY,first,source.businessDate,source.classification.unknown,unknown]);
    for(const account of accountIds)for(const market of ['all','CN','HK','US'] as const){
      const members=preparedGroups.filter(p=>(account==='all'||p.group.accountId===account)&&(market==='all'||marketOf(p.group.instrument.market)===market));
      const scopedFees=fees.filter(f=>(account==='all'||f.accountId===account)&&(market==='all'||f.market===null||marketOf(f.market)===market));
      const signature=digest(['published-scope-v1',common,account,market,members.map(p=>[p.group.key,p.fingerprint,completed.get(`${p.group.instrument.market}/${source.asOf}`)??null]),scopedFees.map(f=>[f,Date.parse(f.knownAt)<=Date.parse(source.asOf)])]);
      const key=scopeId(market,account);scopeSignatures.set(key,signature);
      const version=findPublished(key,signature);if(version)reusedScopes.set(key,version);
    }
  }
  const baseGroups=new Map<string,typeof preparedGroups>();
  for(const prepared of preparedGroups){
    const key=scopeId(marketOf(prepared.group.instrument.market),prepared.group.accountId);
    const members=baseGroups.get(key)??[];members.push(prepared);baseGroups.set(key,members);
  }
  phase('fingerprints');
  const baseFingerprints=new Map<string,string>(),reusedBases=new Set<string>();
  for(const [key,members]of baseGroups){
    const fingerprint=digest(['account-market-v1',HOME_POLICY,members.map(p=>[p.group.key,p.fingerprint])]);
    baseFingerprints.set(key,fingerprint);
    const cached=options.cache?.getBase(key,fingerprint);
    if(cached&&members.every(p=>cached.positions[p.group.key])){
      const first=members[0].group,series=new NativeSeriesAccumulator();series.add(cached.days);
      baseSeries.set(key,{accountId:first.accountId,market:marketOf(first.instrument.market),series});
      for(const {group}of members){accept(group,{...cached.positions[group.key],days:[]});if(options.stats)options.stats.reused++;}
      reusedBases.add(key);continue;
    }
    for(const {group,context,fingerprint}of members){
    const cached=options.cache?.get(group.key,fingerprint);
    if(cached){accept(group,cached);if(options.stats)options.stats.reused++;continue;}
    if(options.stats)options.stats.built++;
    const stateCache = new Map<string,NativePosition>();
    const stateAt = (cursor: string) => {
      let lo=0,hi=context.length;while(lo<hi){const mid=(lo+hi)>>>1;if(context[mid]<=cursor)lo=mid+1;else hi=mid;}
      const key=String(lo);let state=stateCache.get(key);
      if (!state) { state=nativePosition({executions:group.executions,markPrice:'0',cursor,inventoryIdentity:{accountId:group.accountId,symbol:group.instrument.symbol,market:group.instrument.market,currency:group.instrument.currency},evidence:group.evidence});stateCache.set(key,state); }
      return state;
    };
    let previous: NativePosition|undefined, opened:string|null=null, missingF=0;
    const missingR:Record<string,number>={};
    const nativeDay = (date:string,cursor:string,current=false): NativeDay => {
      const state=stateAt(cursor), price=quoteAt(group,cursor), noPosition=state.quantity==='0';
      if (noPosition) opened=null; else if (!previous || previous.quantity==='0') opened=date;
      const market=noPosition?'0':state.quantity===null||price===null?null:decimal(state.quantity).mul(price).toFixed();
      const unrealized=noPosition?'0':state.quantity===null||price===null||state.averageCost===null||state.openFees===null?null:decimal(state.quantity).mul(decimal(price).minus(state.averageCost)).minus(state.openFees).toFixed();
      // A late refund/correction can resolve an old ledger gap. The daily
      // prefix still marks that knowledge transition, never an invented gain.
      if (state !== previous) {
        const prior=previous?.realizedContributions??{};
        for(const [key,value]of Object.entries(state.realizedContributions)) {
          if(Object.hasOwn(prior,key) ? prior[key].amount !== value.amount || prior[key].currency !== value.currency : value.amount === null) missingR[value.currency]=(missingR[value.currency]??0)+1;
        }
        for(const key of Object.keys(prior))if(!Object.hasOwn(state.realizedContributions,key))missingR[prior[key].currency]=(missingR[prior[key].currency]??0)+1;
        missingF+=Math.max(0,state.feesMissing-(previous?.feesMissing??0));
      }
      previous=state;
      const reasons=[...state.reasons,...(!state.lifetimeComplete?['累计历史起点尚未获得完整性证明']:[]),...(!noPosition&&price===null?['已完成交易日行情缺失']:[])];
      const buckets:Record<string,NativeBucket>={[group.instrument.currency]:{market,unrealized,realized:state.knownRealized,realizedMissing:missingR[group.instrument.currency]??0,fees:state.knownFees,feesMissing:missingF,count:noPosition?0:1,marketKnown:market===null?0:noPosition?0:1,unrealizedKnown:unrealized===null?0:noPosition?0:1,lifetimeComplete:state.lifetimeComplete,reasons}};
      for(const code of new Set([...Object.keys(state.realizedByCurrency),...Object.keys(state.openFeesByCurrency??{}),...Object.keys(missingR)])) {
        if(code===group.instrument.currency)continue;
        buckets[code]={...empty(),realized:state.realizedByCurrency[code]??'0',realizedMissing:missingR[code]??0,unrealized:noPosition?'0':state.openFeesByCurrency===null?null:decimal(state.openFeesByCurrency[code]??'0').negated().toFixed(),lifetimeComplete:state.lifetimeComplete,reasons};
      }
      let lo=0,hi=context.length;while(lo<hi){const mid=(lo+hi)>>>1;if(context[mid]<=cursor)lo=mid+1;else hi=mid;}
      return {date,buckets,activity:lo,fx:current?source.currentFx:fxByDay.get(date)??{},reasons};
    };
    const days=dates.map(date=>nativeDay(date,date===source.businessDate?source.asOf:`${date}T15:59:59.999Z`));
    const current=nativeDay(source.businessDate,source.asOf,true), state=stateAt(source.asOf);
    const projection={days,current,state,price:quoteAt(group,source.asOf),opened};
    options.cache?.put(group.key,fingerprint,projection);
    accept(group,projection);
  }
  }
  phase('objects');
  for(const [key,base]of baseSeries){
    const rows=base.series.finish(dates,date=>fxByDay.get(date)??{});
    if(options.cache&&!reusedBases.has(key)){
      const positions=Object.fromEntries(projections.filter(p=>p.group.accountId===base.accountId&&marketOf(p.group.instrument.market)===base.market).map(p=>{
        const {group,...small}=p;return [group.key,small];
      }));
      options.cache.putBase(key,baseFingerprints.get(key)!,{days:rows,positions});
    }
    for(const account of new Set(['all',base.accountId]))for(const market of new Set<Market>(['all',base.market])){
      const key=scopeId(market,account);
      if(reusedScopes.has(key))continue;
      let daily=aggregateDays.get(key);
      if(!daily){daily=dates.map(date=>({date,buckets:{},fx:fxByDay.get(date)??{},reasons:[]}));aggregateDays.set(key,daily);}
      rows.forEach((day,i)=>add(daily![i],day));
    }
  }
  phase('aggregate');
  for(const market of new Set([...groups.values()].map(g=>g.instrument.market))) {
    if(!['CN-SH','CN-SZ','HK','US'].includes(market))continue;
    try { const at=nextMarketSessionCutoff(market as SupportedMarket,new Date(source.asOf));if(at)considerBoundary(at); }
    catch(error){if(!(error instanceof CalendarOutOfRangeError))throw error;}
  }
  const accounts=[{id:'all',name:'全部实盘账户'},...[...new Set([...groups.values()].map(g=>g.accountId).concat(fees.map(f=>f.accountId),unknown.map(e=>e.accountId)))].sort().map(accountId=>({id:accountId,name:source.executions.find(e=>e.accountId===accountId)?.accountLabel||unknown.find(e=>e.accountId===accountId)?.accountLabel||accountId}))];
  const labelCounts=new Map<string,number>();for(const account of accounts)labelCounts.set(account.name,(labelCounts.get(account.name)??0)+1);
  for(const account of accounts)if(labelCounts.get(account.name)!>1)account.name+=`（${account.id.slice(-6)}）`;
  const tradeSets=projections.map(p=>{
    const trades=p.group.executions.filter(e=>executionBusinessDay(e)<=source.businessDate && Date.parse(nativeExecutionAt(e))<=Date.parse(source.asOf)).sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.id.localeCompare(b.id)).map(e=>({id:e.id,date:executionBusinessDay(e),side:e.side==='buy'?'买入':'卖出',quantity:e.quantity,price:e.price,currency:e.instrument.currency}));
    return {id:digest([HOME_POLICY,p.group.key,trades]),positionKey:p.group.key,accountId:p.group.accountId,market:marketOf(p.group.instrument.market),trades};
  });
  const tradeSetByKey=new Map(tradeSets.map(s=>[s.positionKey,s.id]));
  phase('trades');
  const scopes:ScopeProjection[]=[];
  for(const account of accounts)for(const market of ['all','CN','HK','US'] as const){
    const key=scopeId(market,account.id);if(reusedScopes.has(key))continue;
    const selected=projections.filter(p=>(account.id==='all'||p.group.accountId===account.id)&&(market==='all'||marketOf(p.group.instrument.market)===market));
    const currency='CNY';
    const scopedFees=fees.filter(f=>(account.id==='all'||f.accountId===account.id)&&(market==='all'||f.market===null||marketOf(f.market)===market)).map(f=>market!=='all'&&f.market===null?{...f,amount:null}:f);
    const preciseFees=scopedFees.filter(f=>f.from===f.to).sort((a,b)=>a.knownAt.localeCompare(b.knownAt));
    const windows=scopedFees.filter(f=>f.from!==f.to);
    let feeIndex=0;
    const running:Record<string,{known:string;missing:number}>={};
    const withFees=(day:NativeDay,cursor:string)=>{
      while(feeIndex<preciseFees.length&&Date.parse(preciseFees[feeIndex].knownAt)<=Date.parse(cursor)){
        const f=preciseFees[feeIndex++],b=running[f.currency]??{known:'0',missing:0};
        if(f.amount===null)b.missing++;else b.known=decimal(b.known).plus(f.amount).toFixed();running[f.currency]=b;
      }
      for(const code of new Set([...Object.keys(day.buckets),...Object.keys(running)])){
        const b=day.buckets[code]??empty();day.buckets[code]={...b,fees:running[code]?.known??'0',feesMissing:running[code]?.missing??0};
      }
      const knownWindows=windows.filter(f=>Date.parse(f.knownAt)<=Date.parse(cursor));if(knownWindows.length)day.feeWindows=knownWindows;
      return day;
    };
    const nativeDays=aggregateDays.get(key)??dates.map(date=>({date,buckets:{},fx:fxByDay.get(date)??{},reasons:[]}));
    const finish=(day:NativeDay)=>{day.reasons=[...new Set(Object.values(day.buckets).flatMap(b=>b.reasons))];return day;};
    const days=nativeDays.map(day=>withFees(finish(day),day.date===source.businessDate?source.asOf:`${day.date}T15:59:59.999Z`));
    const current=withFees(finish(aggregateCurrent.get(key)??{date:source.businessDate,buckets:{},fx:source.currentFx,reasons:[]}),source.asOf);
    const holdings=selected.filter(p=>p.state.quantity!=='0').map(p=>{
      const native=p.current.buckets[p.group.instrument.currency], i=p.group.instrument;
      const row:Holding={id:digest(p.group.key),name:i.localizedName?.name??i.name,code:i.symbol,exchange:i.market,market:marketOf(i.market),accountId:p.group.accountId,currency:i.currency,holdingDays:p.state.quantity!==null&&p.opened?Math.floor((Date.parse(source.businessDate)-Date.parse(p.opened))/86400000):null,quantity:p.state.quantity,cost:p.state.averageCost,price:p.price,priceAsOf:p.price===null?null:completed.get(`${i.market}/${source.asOf}`)??null,marketValue:convertNative({[i.currency]:native.market},currency,source.currentFx),unrealized:convertNative(Object.fromEntries(Object.entries(p.current.buckets).map(([code,bucket])=>[code,bucket.unrealized])),currency,source.currentFx)};
      return {row,instrumentId:i.id,positionKey:p.group.key,tradeSetId:tradeSetByKey.get(p.group.key)!,description:[i.name,...native.reasons].join(' · ')};
    });
    const marketCutoffs:Record<string,string|null>={};
    for(const holding of holdings){const market=holding.row.exchange,at=holding.row.priceAsOf??null;marketCutoffs[market]=marketCutoffs[market]===null?null:at;}
    scopes.push({metricObjects:selected.map(p=>p.metric),marketCutoffs,id:scopeId(market,account.id),version:digest([HOME_POLICY,market,account.id,source.businessDate,days,current,holdings,selected.map(p=>p.metric.version),unknownCount(market,account.id)]),market,accountId:account.id,currency,sourceSequence:source.sequence,computedAt:source.asOf,valuationCutoff:source.asOf,businessDate:source.businessDate,days,current,holdings,reasons:[...current.reasons,...(unknownCount(market,account.id)?[`${unknownCount(market,account.id)} 条记录交易性质待核实，未计入实盘`]:[])]});
    const signature=scopeSignatures.get(key);if(signature)options.cache?.putScope(key,signature,scopes[scopes.length-1].version);
  }
  phase('scopes');
  return {id,fx:source.currentFx,nextRefreshAt,sourceSequence:source.sequence,computedAt:source.asOf,businessDate:source.businessDate,accounts,scopes,trades:tradeSets,...(options.reusePublished?{reuse:[...reusedScopes].map(([id,version])=>({id,version}))}:{})};
}
