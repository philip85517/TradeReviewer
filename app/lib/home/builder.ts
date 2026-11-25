import { carryGiftAcquisitionEvidence, isGiftAcquisitionEvidence } from "../trades/gift-acquisition-evidence";
import {verifiedSplitBoundaries,splitValuationQuote} from './split-valuation-safety';
import {homeExecutionFeeBasis} from './execution-fee-basis';
import {valuationRawClose,valuationSession} from './valuation-quote';
import { createHash } from 'node:crypto';
import type { Instrument, TradeExecution } from '../trades/types';
import {isMonthlyEvidenceScope,type MonthlyStatement} from '../import/monthly-statement';
import {hasVerifiedIpoImportEvidence} from '../trades/nature-resolution';
import {isExecutionBackedIpoAllocation,statementEventAt} from '../import/statement-evidence';
import {withCashInventoryPositions} from '../import/statement-evidence';
import { canonicalInstrumentId } from '../instruments/display-name';
import { nativeExecutionAt } from '../replay/native-boundary';
import { nativeEvidenceBoundaries } from '../replay/position-ledger';
import { requiredMarketDataRange, nextMarketSessionCutoff } from '../market/sync-range';
import { CalendarOutOfRangeError } from '../market/calendar';
import { confirmedPrelistingClose } from '../market/prelisting-close';
import type { SupportedMarket } from '../market/contracts';
import { lifetimeCoverageNotice, type Holding, type Market } from '../../components/homepage-preview/display-contract';
import { HOME_POLICY, HOME_METRIC_ORDERING, scopeId, type HomeCategory, type NativeBucket, type NativeDay, type ReleaseInput, type ScopeProjection, type SourceFifoProof, type SourceLotProof } from './contracts';
import { convertNative, decimal, nextDay, validDay } from './period';
import { businessDay, executionBusinessDay, nativePosition, type NativePosition } from './finance';
import type { SourceSnapshot } from './source';
import { collectFees } from './fees';
import type {ProjectionCache} from './projection-cache';
import {nativeOrdering,validateNativeOrdering} from './full-window';
import {metricObjectVersion} from './metric-objects';
import {compactSeries,NativeSeriesAccumulator} from './native-series';
import {resolveIpoAcquisitionCost} from '../trades/ipo-cost';
import {executionContentVersion} from './execution-content-ref';
import {fullCanonical,fullHash} from './full-projection';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const HOME_SOURCE_FIFO_PROOF_VERSION = 'source-fifo-proof-v3-confirmed-gift-source-lots';
const marketOf = (market: string): Market => market.startsWith('CN-') ? 'CN' : market === 'HK' || market === 'US' ? market : 'all';
const empty = (): NativeBucket => ({ market:'0', unrealized:'0', realized:'0', realizedMissing:0, fees:'0',feesMissing:0,count:0,marketKnown:0,unrealizedKnown:0,lifetimeComplete:true,reasons:[] });
const sum = (a: string | null, b: string | null) => a === null || b === null ? null : a === '0' ? b : b === '0' ? a : decimal(a).plus(b).toFixed();
function trackMissingContributions(current: NativePosition['realizedContributions'], prior: NativePosition['realizedContributions'], counts: Record<string,number>) {
  for(const [key,value] of Object.entries(current)) {
    const changed=Object.hasOwn(prior,key)?prior[key].amount!==value.amount||prior[key].currency!==value.currency:value.amount===null;
    if(changed)counts[value.currency]=(counts[value.currency]??0)+1;
  }
  for(const [key,value] of Object.entries(prior))if(!Object.hasOwn(current,key))counts[value.currency]=(counts[value.currency]??0)+1;
}
type Group = { key: string; accountId: string; instrument: Instrument; executions: TradeExecution[]; evidence: MonthlyStatement[] };
type Projection = { metric:import('./contracts').MetricObject; group: Group; current: NativeDay; state: NativePosition; price: string | null; opened: string | null; categories?:import('./projection-cache').CategoryProjection[] };

/**
 * Project native source-FIFO facts into a category boundary.  This is an
 * intentionally small adapter: it accepts only facts emitted by the native
 * transition and reuses the parent day's quote, deferred/prelisting decision,
 * FX and reasons.  No category replay or valuation is performed here.
 */
export function canonicalCategoryNativeDay(state: NativePosition, parent: NativeDay, category: HomeCategory, currency: string, price: string|null): NativeDay|null {
  const facts=state.sourceFifo as (typeof state.sourceFifo & {realizedByCategory?:Record<string,string>;closedFeesByCategory?:Record<string,string>;openFeesByCategory?:Record<string,string>;remainingByCategory?:Record<string,string>;remainingCashCostByCategory?:Record<string,string>})|undefined;
  if(!facts||facts.version!==1)return null;
  const q=facts.remainingByCategory?.[category]??'0';
  const cost=facts.remainingCashCostByCategory?.[category]??'0';
  const openFees=facts.openFeesByCategory?.[category]??'0';
  const noPosition=q==='0';
  const parentBucket=parent.buckets[currency];
  const deferred=parentBucket?.market==='0'&&parentBucket.unrealized==='0'&&decimal(q).gt(0);
  const market=deferred||noPosition?'0':q==='0'?'0':parentBucket?.market===null||price===null?null:decimal(q).mul(price).toFixed();
  const unrealized=deferred||noPosition?'0':market===null?null:decimal(market).minus(cost).minus(openFees).toFixed();
  const reasons=[...(parentBucket?.reasons??parent.reasons)];
  const closingIds=new Set((facts.consumptions??[]).filter((c:any)=>c.category===category).map((c:any)=>c.closingId));
  const closedFees=facts.closedFeesByCategory?.[category]??'0';
  const bucket:NativeBucket={market,unrealized,realized:facts.realizedByCategory?.[category as 'ipo'|'long']??'0',realizedMissing:parentBucket?.realizedMissing??0,fees:facts.feesByCategory?.[category as 'ipo'|'long']??closedFees,feesMissing:parentBucket?.feesMissing??0,closedFees,closedFeesMissing:0,closedTransactions:closingIds.size,count:noPosition?0:1,marketKnown:market===null?0:noPosition?0:1,unrealizedKnown:unrealized===null?0:noPosition?0:1,lifetimeComplete:parentBucket?.lifetimeComplete??true,reasons};
  return {date:parent.date,buckets:{[currency]:bucket},fx:parent.fx,reasons:[...new Set(reasons)],...(parent.activity===undefined?{}:{activity:parent.activity})};
}

/** Build the immutable v6 seam from the same source snapshot as the native day.
 * No P/L is recomputed here: quantities and cash costs are copied from native
 * consumption/remaining facts, while event-only IPO lots are resolved through
 * the existing immutable monthly cash resolver.
 */
function sourceFifoProofFor(group:Group, state:NativePosition, source:SourceSnapshot, refs:Map<string,import('./execution-content-ref').ExecutionContentRef>):SourceFifoProof|undefined {
  const facts=state.sourceFifo as (typeof state.sourceFifo & {remaining?:Array<{sourceKey:string;category:HomeCategory;quantity:string;cashCost:string}>})|undefined;
  if(!facts||facts.version!==1||(!(facts.consumptions?.length)&&!(facts.remaining?.length)))return undefined;
  const executionById=new Map(group.executions.map(e=>[e.id,e]));
  const attachedEvents=[...group.evidence.flatMap(s=>s.events),...group.executions.flatMap(e=>e.source.positionEvents??[])];
  const events=carryGiftAcquisitionEvidence(attachedEvents,attachedEvents);
  const eventById=new Map<string,typeof events[number]>();for(const event of events){const prior=eventById.get(event.id);if(prior&&fullHash(prior)!==fullHash(event))return undefined;eventById.set(event.id,event);}const uniqueEvents=[...eventById.values()];
  const instrumentIdentity=canonicalInstrumentId(group.instrument.symbol,group.instrument.market);
  const matchesGroup=(event:typeof uniqueEvents[number])=>event.accountId===group.accountId&&!!event.symbol&&!!event.market&&canonicalInstrumentId(event.symbol,event.market)===instrumentIdentity;
  const scopedEvents=uniqueEvents.filter(matchesGroup);
  const eventLots:SourceLotProof[]=scopedEvents.filter(e=>e.kind==='ipo'&&e.quantity!==undefined&&Number(e.quantity)>0&&!group.executions.some(x=>isExecutionBackedIpoAllocation(e,[x]))).map(e=>{
    const resolved=resolveIpoAcquisitionCost(e,uniqueEvents,group.executions,group.instrument.currency);if(!resolved)return undefined;
    const dependencyIds=[e.id,...resolved.evidenceIds.filter(id=>id!==e.id)];
    const payload={sourceKey:`event:${e.accountId}:${e.id}`,category:'ipo' as const,quantity:e.quantity!,cashCost:resolved.cashCost,at:statementEventAt(e),dependencyHashes:dependencyIds.map(id=>fullHash(uniqueEvents.find(x=>x.id===id)??id))};
    return {...payload,proofHash:fullHash(payload),executionId:undefined};
  }).filter((x):x is NonNullable<typeof x>=>!!x);
  // Only emit gift lots actually referenced by this native state. Preserve the
  // original acquisition quantity and its user confirmation even after all
  // shares are consumed; a remaining fragment is not an immutable source lot.
  const usedSourceKeys=new Set([...(facts.remaining??[]).map(l=>l.sourceKey),...facts.consumptions.map(c=>c.openingSourceKey)]);
  for(const event of scopedEvents){
    const sourceKey=`event:${event.accountId}:${event.id}`;
    if(!usedSourceKeys.has(sourceKey)||!isGiftAcquisitionEvidence(event)||event.giftAcquisition!.currency!==group.instrument.currency)continue;
    const at=nativeEvidenceBoundaries([],[{positions:[],events:[event]}],group.instrument.market)[0];
    const payload={sourceKey,category:'long' as const,quantity:event.quantity!,cashCost:'0',at,dependencyHashes:[fullHash(event)]};
    eventLots.push({...payload,proofHash:fullHash(payload),executionId:undefined});
  }
  const remaining=new Map((facts.remaining??[]).map(l=>[l.sourceKey,l]));
  const categoryFor=new Map<string,HomeCategory>();
  for(const l of facts.remaining??[])categoryFor.set(l.sourceKey,l.category);
  for(const c of facts.consumptions)categoryFor.set(c.openingSourceKey,c.category);
  const lots:SourceLotProof[]=[...remaining.values()].filter(l=>!(l.sourceKey.startsWith('execution:')&&executionById.has(l.sourceKey.slice('execution:'.length)))&&!eventLots.some(e=>e.sourceKey===l.sourceKey)).map(l=>{const payload={sourceKey:l.sourceKey,category:l.category,quantity:l.quantity,cashCost:l.cashCost,at:'',dependencyHashes:[] as string[]};return {...payload,proofHash:fullHash(payload)};});
  for(const e of group.executions){const key=`execution:${e.id}`;if(!categoryFor.has(key))continue;if(lots.some(l=>l.sourceKey===key))continue;const payload={sourceKey:key,category:categoryFor.get(key)!,quantity:e.quantity,cashCost:decimal(e.price).mul(e.quantity).toFixed(),at:e.executedAt,dependencyHashes:refs.has(e.id)?[refs.get(e.id)!.effectiveVersion]:[],executionId:e.id};lots.push({...payload,proofHash:fullHash(payload)});}
  lots.push(...eventLots);
  if(!lots.length||lots.some(l=>!l.dependencyHashes.length))return undefined;
  const sourceQuantities=[] as NonNullable<SourceFifoProof['sourceQuantities']>;
  for(const e of group.executions){const close=facts.consumptions.filter(c=>c.closingId===e.id);if(close.length){for(const category of ['ipo','long'] as const){const quantity=close.filter(c=>c.category===category).reduce((n,c)=>n.plus(c.quantity),decimal('0'));if(quantity.gt(0))sourceQuantities.push({executionId:e.id,sourceKey:`execution:${e.id}`,category,role:'close-long',quantity:quantity.toFixed(),sourceRef:refs.get(e.id)});}const residual=remaining.get(`execution:${e.id}`);if(residual)sourceQuantities.push({executionId:e.id,sourceKey:`execution:${e.id}`,category:residual.category,role:'open-long',quantity:residual.quantity,sourceRef:refs.get(e.id)});}else if(categoryFor.has(`execution:${e.id}`)){const category=categoryFor.get(`execution:${e.id}`)!;sourceQuantities.push({executionId:e.id,sourceKey:`execution:${e.id}`,category,role:'open-long',quantity:e.quantity,sourceRef:refs.get(e.id)});}}
  if(!sourceQuantities.length&&!eventLots.length)return undefined;
  return {version:1,sourceQuantities,consumptions:facts.consumptions.map(c=>({closingExecutionId:c.closingId,openingSourceKey:c.openingSourceKey,category:c.category,quantity:c.quantity,cashCost:c.cashCost})),lots};
}

/** CPU-only construction. HTTP reads never call this module. */
export function buildRelease(source: SourceSnapshot, id: string, options: {cache?:ProjectionCache;reusePublished?:boolean;stats?:{reused:number;built:number};timings?:Record<string,number>} = {}): ReleaseInput {
  let phaseStart=performance.now();
  const phase=(name:string)=>{const now=performance.now();if(options.timings)options.timings[name]=now-phaseStart;phaseStart=now;};
  const executionRefs = new Map<string,import('./execution-content-ref').ExecutionContentRef>();
  if(source.executionRefs!==undefined){
    if(!Array.isArray(source.executionRefs))throw new Error('Invalid execution refs');
    const ids=new Set(source.executions.map(e=>e.id));
    for(const ref of source.executionRefs){
      if(!ref||ref.schemaVersion!==1||typeof ref.executionId!=='string'||!ids.has(ref.executionId)||executionRefs.has(ref.executionId)||typeof ref.rawVersion!=='string'||typeof ref.effectiveVersion!=='string'||!/^[a-f0-9]{64}$/.test(ref.rawVersion)||!/^[a-f0-9]{64}$/.test(ref.effectiveVersion))throw new Error('Invalid execution ref');
      executionRefs.set(ref.executionId,ref);
    }
    if(executionRefs.size!==source.executions.length)throw new Error('Incomplete execution refs');
  }
  const refSchema=source.executionRefs===undefined?'legacy-no-execution-refs':'execution-content-ref-v1';
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
  const cashInventoryDates = new Set<string>();
  for (const group of groups.values()) {
    const identity=canonicalInstrumentId(group.instrument.symbol,group.instrument.market);
    const indexed=evidenceByIdentity.get(JSON.stringify([group.accountId,identity]));
    const statements=withCashInventoryPositions(source.monthly, {accountId:group.accountId, market:group.instrument.market, symbol:group.instrument.symbol}, group.executions);
    // Gap-only statements have no position/event row to index. Keep their dated
    // boundary so a later proven flat inventory can recover new positions.
    group.evidence=statements.filter((statement,index)=>{
      if(statement.evidenceScope!==undefined&&(!isMonthlyEvidenceScope(statement.evidenceScope)||statement.evidenceScope.accountId!==group.accountId||statement.evidenceScope.instrumentId!==identity))return false;
      const original=source.monthly[index];
      if(statement.positions.length>original.positions.length){
        for(const position of statement.positions.slice(original.positions.length))cashInventoryDates.add(position.date);
        return true;
      }
      if(indexed?.has(original))return true;
      return (!statement.accountId||statement.accountId===group.accountId)&&Boolean(statement.historyIncomplete||statement.incompleteInstruments?.some(i=>canonicalInstrumentId(i.symbol,i.market)===identity));
    });
  }
  const sourceDates = [...cashInventoryDates,...source.executions.map(executionBusinessDay),...source.monthly.flatMap(s=>[...s.positions,...s.events].map(p=>p.date.length===7?`${p.date}-01`:p.date.slice(0,10)))].filter(validDay);
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
      try { completed.set(key,valuationSession(market as SupportedMarket,new Date(cursor))); }
      catch (e) { if (!(e instanceof CalendarOutOfRangeError)) throw e; completed.set(key,null); }
    }
    const end=completed.get(key),rows=rawByInstrument.get(group.instrument.id)??[];
    let lo=0,hi=rows.length;
    if(end)while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].tradingDate<=end)lo=mid+1;else hi=mid;}
    const quote=end&&lo>0&&rows[lo-1].tradingDate===end?rows[lo-1]:undefined;
    return end?valuationRawClose(quote,group.instrument.id,group.instrument.currency,end):null;
  };
  // Daily projections hold native facts only. The published current FX snapshot
  // converts any selected interval at read time; changing FX never reruns the ledger.
  const fxByDay = new Map<string,import('./contracts').FxRates>();
  const projections: Projection[] = [];
  const categoryObjectsByPosition=new Map<string,import('./projection-cache').CategoryProjection[]>();
  const aggregateDays=new Map<string,NativeDay[]>(), aggregateCurrent=new Map<string,NativeDay>();
  const baseSeries=new Map<string,{accountId:string;market:Market;series:NativeSeriesAccumulator}>();
  const add=(day:NativeDay,native:NativeDay)=>{
    for(const [code,b]of Object.entries(native.buckets)){
      const a=day.buckets[code];
      day.buckets[code]=!a?{...b}:{market:sum(a.market,b.market),unrealized:sum(a.unrealized,b.unrealized),realized:sum(a.realized,b.realized)!,realizedMissing:a.realizedMissing+b.realizedMissing,fees:sum(a.fees,b.fees)!,feesMissing:a.feesMissing+b.feesMissing,count:a.count+b.count,marketKnown:a.marketKnown+b.marketKnown,unrealizedKnown:a.unrealizedKnown+b.unrealizedKnown,lifetimeComplete:a.lifetimeComplete&&b.lifetimeComplete,...(a.realizedValuationNotes?.length||b.realizedValuationNotes?.length?{realizedValuationNotes:[...new Set([...(a.realizedValuationNotes??[]),...(b.realizedValuationNotes??[])])],realizedValuationCount:(a.realizedValuationCount??0)+(b.realizedValuationCount??0)}:{}),reasons:[...new Set([...a.reasons,...b.reasons])]};
      if(!a&&b.closedTransactions!==undefined){
        delete day.buckets[code].closedTransactions;
        delete day.buckets[code].closedFees;
        delete day.buckets[code].closedFeesMissing;
      }
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
    if(projection.metric&&Object.hasOwn(projection.metric,'ordering'))validateNativeOrdering(projection.metric.ordering,projection.metric.firstDay,projection.metric.lastDay);
    const boundaries=compactSeries(projection.days);
    const content={positionKey:group.key,accountId:group.accountId,code:group.instrument.symbol,name:group.instrument.localizedName?.name??group.instrument.name,firstDay:first,lastDay:source.businessDate,current:native,boundaries,ordering:nativeOrdering(boundaries)};
    const metric=projection.metric?.ordering?projection.metric:{...content,version:metricObjectVersion(content)};
    projections.push({group,...small,metric});
    if(projection.categories?.length)categoryObjectsByPosition.set(group.key,projection.categories);
  };
  phase('prepare');
  const preparedGroups = [...groups.values()].map(group => {
    if(group.executions.some(e=>e.instrument.currency!==group.instrument.currency))throw new Error('同一持仓原币冲突，不能发布');
    const context = [
      ...group.executions.map(nativeExecutionAt),
      ...nativeEvidenceBoundaries(group.executions, group.evidence,group.instrument.market),
      ...verifiedSplitBoundaries.filter(e=>e.instrumentId===group.instrument.id).map(e=>e.effectiveAt),
    ].sort();
    context.forEach(considerBoundary);
    // Invalidate only objects affected by the verified acquisition ordering fix;
    // their parent scopes inherit this fingerprint, including FX-only reuse.
    const orderingPolicy=group.executions.some(e=>e.source.displayTimePolicy==='session-open'&&e.source.positionEffect==='open-long')?`${HOME_POLICY}/verified-session-open-v1`:HOME_POLICY;
    const fingerprint=digest([HOME_METRIC_ORDERING,HOME_SOURCE_FIFO_PROOF_VERSION,refSchema,group.executions.map(e=>executionRefs.get(e.id)),orderingPolicy,group,dates[0],source.businessDate,context.filter(at=>at<=source.asOf).length,quoteAt(group,source.asOf),candlesByInstrument.get(group.instrument.id)??[]]);
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
    const common=digest([HOME_METRIC_ORDERING,refSchema,HOME_POLICY,first,source.businessDate,source.classification.unknown,unknown]);
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
    const fingerprint=digest(['account-market-v1',HOME_METRIC_ORDERING,HOME_POLICY,members.map(p=>[p.group.key,p.fingerprint])]);
    baseFingerprints.set(key,fingerprint);
    const cached=options.cache?.getBase(key,fingerprint);
    if(cached&&members.every(p=>{
      const metric=cached.positions[p.group.key]?.metric;
      if(metric&&Object.hasOwn(metric,'ordering'))validateNativeOrdering(metric.ordering,metric.firstDay,metric.lastDay);
      return !!metric?.ordering;
    })){
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
    const missingCloseFees:Record<string,number>={};
    const nativeDay = (date:string,cursor:string,current=false): NativeDay => {
      const state=stateAt(cursor), quotedPrice=quoteAt(group,cursor), noPosition=state.quantity==='0';
      if (noPosition) opened=null; else if (!previous || previous.quantity==='0') opened=date;
      const session=completed.get(`${group.instrument.market}/${cursor}`);
      const valuation=splitValuationQuote(group.instrument.id,cursor,session,quotedPrice);
      const price=valuation.price;
      const listing=session&&confirmedPrelistingClose(group.instrument.id,session);
      const matching=(e:{accountId:string;symbol?:string;market?:string})=>e.accountId===group.accountId&&!!e.symbol&&!!e.market&&canonicalInstrumentId(e.symbol,e.market)===canonicalInstrumentId(group.instrument.symbol,group.instrument.market);
      const candidate=price===null&&!!listing&&state.quantity!==null&&decimal(state.quantity).gt(0)&&state.averageCost!==null&&state.openFees!==null;
      const visible=candidate?group.executions.filter(e=>nativeExecutionAt(e)<=cursor):[];
      const events=candidate?group.evidence.flatMap(s=>s.events).filter(e=>matching(e)&&(statementEventAt(e)<=cursor||isExecutionBackedIpoAllocation(e,visible))):[];
      const allocations=events.filter(e=>e.kind==='ipo'&&e.quantity!==undefined&&decimal(e.quantity).gt(0));
      const deferred=price===null&&!!listing&&state.quantity!==null&&decimal(state.quantity).gt(0)&&state.averageCost!==null&&state.openFees!==null&&allocations.length>0
        &&visible.filter(e=>e.side==='buy').every(e=>hasVerifiedIpoImportEvidence(e)||allocations.some(a=>isExecutionBackedIpoAllocation(a,[e])))
        &&!events.some(e=>e.quantity!==undefined&&e.kind!=='ipo')
        &&!group.evidence.some(s=>s.positions.some(p=>matching(p)&&p.date<=date&&decimal(p.quantity).gt(0)));
      const market=deferred?'0':noPosition?'0':state.quantity===null||price===null?null:decimal(state.quantity).mul(price).toFixed();
      const unrealized=deferred?'0':noPosition?'0':state.quantity===null||price===null||state.averageCost===null||state.openFees===null?null:decimal(state.quantity).mul(decimal(price).minus(state.averageCost)).minus(state.openFees).toFixed();
      // A late refund/correction can resolve an old ledger gap. The daily
      // prefix still marks that knowledge transition, never an invented gain.
      if (state !== previous) {
        trackMissingContributions(state.realizedContributions,previous?.realizedContributions??{},missingR);
        trackMissingContributions(state.closedFeeContributions,previous?.closedFeeContributions??{},missingCloseFees);
        missingF+=Math.max(0,state.feesMissing-(previous?.feesMissing??0));
      }
      previous=state;
      const reasons=[...state.reasons,...(!state.lifetimeComplete?[lifetimeCoverageNotice]:[]),...(!noPosition&&state.quantity!==null&&price!==null?[...(state.splitEstimates??[]),...valuation.notes]:[])];
      if (deferred) reasons.push('上市前获配，暂不纳入业绩');
      if (!deferred && !noPosition && price === null) {
        reasons.push(listing
          ? `${group.instrument.symbol} 于 ${listing.listingDate} 上市，估值所需的 ${session} 尚无正式收盘价`
          : '已完成交易日行情缺失');
      }
      const buckets:Record<string,NativeBucket>={[group.instrument.currency]:{market,unrealized,realized:state.knownRealized,realizedMissing:missingR[group.instrument.currency]??0,fees:state.knownFees,feesMissing:missingF,count:noPosition?0:1,marketKnown:market===null?0:noPosition?0:1,unrealizedKnown:unrealized===null?0:noPosition?0:1,lifetimeComplete:state.lifetimeComplete,reasons,...(state.realizedValuationNotes?.length?{realizedValuationNotes:state.realizedValuationNotes,realizedValuationCount:state.realizedValuationCount??0}:{})}};
      for(const code of new Set([...Object.keys(state.realizedByCurrency),...Object.keys(state.openFeesByCurrency??{}),...Object.keys(missingR),...Object.keys(missingCloseFees)])) {
        if(code===group.instrument.currency)continue;
        buckets[code]={...empty(),realized:state.realizedByCurrency[code]??'0',realizedMissing:missingR[code]??0,unrealized:deferred||noPosition?'0':state.openFeesByCurrency===null?null:decimal(state.openFeesByCurrency[code]??'0').negated().toFixed(),lifetimeComplete:state.lifetimeComplete,reasons:reasons.filter(r=>!r.startsWith('拆股推算：'))};
      }
      for(const [code,bucket] of Object.entries(buckets)){
        bucket.closedFees=state.closedFeesByCurrency[code]??'0';
        bucket.closedFeesMissing=missingCloseFees[code]??0;
        // A multi-currency close is one transaction even when it has several fee legs.
        bucket.closedTransactions=code===group.instrument.currency?state.closedCount:0;
      }
      let lo=0,hi=context.length;while(lo<hi){const mid=(lo+hi)>>>1;if(context[mid]<=cursor)lo=mid+1;else hi=mid;}
      return {date,buckets,activity:lo,fx:current?source.currentFx:fxByDay.get(date)??{},reasons};
    };
    const days=dates.map(date=>nativeDay(date,date===source.businessDate?source.asOf:`${date}T15:59:59.999Z`));
    const current=nativeDay(source.businessDate,source.asOf,true), state=stateAt(source.asOf);
    const categoryDaysByCategory=new Map<HomeCategory,NativeDay[]>(), categoryCurrent:import('./projection-cache').CategoryProjection[]=[];
    for(const category of ['long','ipo'] as const){
      const projected=days.map(day=>{const cursor=day.date===source.businessDate?source.asOf:`${day.date}T15:59:59.999Z`;return canonicalCategoryNativeDay(stateAt(cursor),day,category,group.instrument.currency,splitValuationQuote(group.instrument.id,cursor,completed.get(`${group.instrument.market}/${cursor}`),quoteAt(group,cursor)).price)}).filter((day):day is NativeDay=>!!day);
      const rawCurrentCategory=canonicalCategoryNativeDay(state,current,category,group.instrument.currency,splitValuationQuote(group.instrument.id,source.asOf,completed.get(`${group.instrument.market}/${source.asOf}`),quoteAt(group,source.asOf)).price);
      // Category metric objects follow the native metric cache contract: the
      // current FX snapshot is read-time release data, not ledger content.
      // Keep historical day FX intact, but normalize the cached current.
      const currentCategory=rawCurrentCategory?{...rawCurrentCategory,fx:{}}:null;
      if(projected.length&&currentCategory){
        const categorySeries=projected.some(day=>day.date===currentCategory.date)?projected:[...projected,currentCategory].sort((a,b)=>a.date.localeCompare(b.date));
        const boundaries=compactSeries(categorySeries), content={positionKey:group.key,accountId:group.accountId,code:group.instrument.symbol,name:group.instrument.localizedName?.name??group.instrument.name,firstDay:boundaries[0].date,lastDay:currentCategory.date,current:currentCategory,boundaries,ordering:nativeOrdering(boundaries)};
        const fifo=sourceFifoProofFor(group,state,source,executionRefs);
        categoryCurrent.push({category,metric:{...content,version:metricObjectVersion(content)},days:projected,current:currentCategory,...(fifo?{sourceFifo:fifo}: {})});
      }
    }
    const projection={days,current,state,price:splitValuationQuote(group.instrument.id,source.asOf,completed.get(`${group.instrument.market}/${source.asOf}`),quoteAt(group,source.asOf)).price,opened,categories:categoryCurrent};
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
    const trades=p.group.executions.filter(e=>executionBusinessDay(e)<=source.businessDate && Date.parse(nativeExecutionAt(e))<=Date.parse(source.asOf)).sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.id.localeCompare(b.id)).map(e=>({id:e.id,date:executionBusinessDay(e),side:e.side==='buy'?'买入':'卖出',quantity:e.quantity,price:e.price,currency:e.instrument.currency,feeBasis:homeExecutionFeeBasis(e),...(executionRefs.has(e.id)?{sourceRef:executionRefs.get(e.id)!}:{})}));
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
      // Performance exclusion never establishes an actual holding valuation.
      const unpriced=p.price===null||native.market===null;
      const deferred=unpriced&&native.market==='0'&&native.unrealized==='0'&&p.state.quantity!==null&&decimal(p.state.quantity).gt(0);
      const valuationReasons=deferred?['上市前获配，暂不纳入业绩；持仓尚无正式估值']:native.reasons.filter(reason=>reason.includes('暂停估值'));
      const valuationNotes=native.reasons.filter(r=>r.startsWith('拆股推算：'));
      const splitCost=p.state.splitCostBasis&&p.state.quantity!==null&&p.state.quantity!=='0'&&p.state.averageCost!==null&&p.state.openFees!==null ? decimal(p.state.averageCost).plus(decimal(p.state.openFees).div(decimal(p.state.quantity))).toFixed():p.state.averageCost;
      const row:Holding={...(valuationNotes.length?{valuationNotes}:{}),id:digest(p.group.key),name:i.localizedName?.name??i.name,code:i.symbol,exchange:i.market,market:marketOf(i.market),accountId:p.group.accountId,currency:i.currency,holdingDays:p.state.quantity!==null&&p.opened?Math.floor((Date.parse(source.businessDate)-Date.parse(p.opened))/86400000):null,quantity:p.state.quantity,cost:splitCost,price:p.price,priceAsOf:p.price===null?null:completed.get(`${i.market}/${source.asOf}`)??null,marketValue:convertNative({[i.currency]:unpriced?null:native.market},currency,source.currentFx,[...valuationReasons,...valuationNotes]),unrealized:convertNative(Object.fromEntries(Object.entries(p.current.buckets).map(([code,bucket])=>[code,unpriced?null:bucket.unrealized])),currency,source.currentFx,[...valuationReasons,...valuationNotes])};
      return {row,instrumentId:i.id,positionKey:p.group.key,tradeSetId:tradeSetByKey.get(p.group.key)!,description:[i.name,...native.reasons].join(' · ')};
    });
    const marketCutoffs:Record<string,string|null>={};
    for(const holding of holdings){const market=holding.row.exchange,at=holding.row.priceAsOf??null;marketCutoffs[market]=marketCutoffs[market]===null?null:at;}
    const categoryMetricObjects=selected.flatMap(p=>(categoryObjectsByPosition.get(p.group.key)??[]).map(c=>({positionKey:p.group.key,category:c.category,metric:c.metric,...(c.sourceFifo?{sourceFifo:c.sourceFifo}: {})})));
    scopes.push({metricObjects:selected.map(p=>p.metric),...(categoryMetricObjects.length?{categoryMetricObjects}:{}),marketCutoffs,id:scopeId(market,account.id),version:digest([HOME_METRIC_ORDERING,HOME_POLICY,market,account.id,source.businessDate,days,current,holdings,selected.map(p=>p.metric.version),categoryMetricObjects.map(v=>v.metric.version),unknownCount(market,account.id)]),market,accountId:account.id,currency,sourceSequence:source.sequence,computedAt:source.asOf,valuationCutoff:source.asOf,businessDate:source.businessDate,days,current,holdings,reasons:[...current.reasons,...(unknownCount(market,account.id)?[`${unknownCount(market,account.id)} 条记录交易性质待核实，未计入实盘`]:[])]});
    const signature=scopeSignatures.get(key);if(signature)options.cache?.putScope(key,signature,scopes[scopes.length-1].version);
  }
  phase('scopes');
  return {id,fx:source.currentFx,nextRefreshAt,sourceSequence:source.sequence,computedAt:source.asOf,businessDate:source.businessDate,accounts,scopes,trades:tradeSets,...(options.reusePublished?{reuse:[...reusedScopes].map(([id,version])=>({id,version}))}:{})};
}
