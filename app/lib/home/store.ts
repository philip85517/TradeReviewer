import {stageFull,validateFull} from './full-persistence';
import {FullHomeStore} from './full-store';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { Amount, Holding, HoldingDetail, HomeRequest, Stamp, TradeCollection } from '../../components/homepage-preview/display-contract';
import { HOME_FINANCIAL_PARTITION_VERSION, HOME_POLICY, HOME_PREPARED_SUBTOTAL_VERSION, scopeId, type HomeResult, type NativeDay, type ReleaseInput, type ScopeProjection } from './contracts';
import { currentAmounts, decimal, nextDay, projectPeriod, revalueAmount, validDay } from './period';

import {objectSubtotalKey,objectSubtotals,stageMetricObjects} from './metric-objects';

type Row = Record<string, string | number | null>;
type PreparedSubtotal = {key:string;value:ReturnType<typeof objectSubtotals>;periods?:PreparedSubtotal[]};
const encode = JSON.stringify;
export class HomeReadError extends Error { constructor(readonly status: number, message: string) { super(message); } }
function validateDay(day: NativeDay) {
  if (!validDay(day.date)) throw new Error('invalid day');
  for (const b of Object.values(day.buckets)) {
    for (const field of ['market', 'unrealized', 'realized', 'fees'] as const) if (b[field] !== null) decimal(b[field]!);
    for (const field of ['realizedMissing', 'feesMissing', 'count', 'marketKnown', 'unrealizedKnown'] as const) if (!Number.isSafeInteger(b[field]) || b[field] < 0) throw new Error('invalid coverage');
    if (b.marketKnown > b.count || b.unrealizedKnown > b.count) throw new Error('invalid coverage');
  }
  for (const fx of Object.values(day.fx)) if (!decimal(fx.rate).isPositive() || !fx.source || !fx.asOf) throw new Error('invalid FX');
}
function validateAmount(amount: Amount) {
  if (amount.value === null) { if (!amount.reasons.length) throw new Error('unknown without reason'); }
  else decimal(amount.value);
}
function validateScope(scope: ScopeProjection) {
  if (scope.id !== scopeId(scope.market, scope.accountId) || !scope.version || !scope.days.length) throw new Error('invalid scope');
  let previous: NativeDay | undefined;
  for (const day of scope.days) {
    validateDay(day);
    if (previous) {
      if (nextDay(previous.date) !== day.date) throw new Error('non-contiguous daily result');
      for (const [c, b] of Object.entries(previous.buckets)) if ((day.buckets[c]?.realizedMissing ?? 0) < b.realizedMissing || (day.buckets[c]?.feesMissing ?? 0) < b.feesMissing) throw new Error('non-monotonic missing prefix');
    }
    previous = day;
  }
  validateDay(scope.current);
  const ids = new Set<string>();
  for (const h of scope.holdings) {
    if (ids.has(h.row.id) || !h.positionKey || !h.instrumentId || scope.accountId !== 'all' && h.row.accountId !== scope.accountId || scope.market !== 'all' && h.row.market !== scope.market) throw new Error('invalid holding identity');
    if (h.row.marketValue.currency !== scope.currency || h.row.unrealized.currency !== scope.currency) throw new Error('holding currency mismatch');
    ids.add(h.row.id); validateAmount(h.row.marketValue); validateAmount(h.row.unrealized);
    if (h.row.quantity !== null) decimal(h.row.quantity); if (h.row.cost !== null) decimal(h.row.cost); if (h.row.price !== null) decimal(h.row.price);
  }
  const totals = currentAmounts(scope.current, scope.currency);
  for (const key of ['marketValue', 'unrealized'] as const) {
    if (totals[key].value === null) continue;
    if (scope.holdings.some(h => h.row[key].value === null)) throw new Error('known summary with unknown holding');
    const sum = scope.holdings.reduce((sum, h) => sum.plus(h.row[key].value!), decimal('0'));
    if (!sum.eq(totals[key].value!)) throw new Error('holding summary mismatch');
  }
}
function compareRows(a: Holding, b: Holding, key: HomeRequest['sort']) {
  if (key === 'name') return a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id);
  const av = a[key].value, bv = b[key].value;
  return av === null || bv === null ? av === bv ? a.id.localeCompare(b.id) : av === null ? 1 : -1 : decimal(av).comparedTo(bv) || a.id.localeCompare(b.id);
}

/** Read paths only query immutable projections. Construction is explicitly invoked by the worker. */
export class HomeStore {
  constructor(private readonly db: DatabaseSync) {}
  private get(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).get(...args) as Row | undefined; }
  private all(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).all(...args) as Row[]; }
  private run(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).run(...args); }
  private transaction<T>(fn: () => T) { this.db.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  private readSnapshot<T>(read:()=>T):T {
    this.db.exec('BEGIN');
    try { const value=read();this.db.exec('COMMIT');return value; }
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  collect(now=Date.now()) {
    // Builders may reuse an object/trade set before inserting its new member.
    // Check under the same writer lock used to claim the build lease, on EVERY
    // batch, so cleanup cannot erase that temporary unreferenced dependency.
    const maintenance=<T>(fn:()=>T)=>this.transaction(()=>{
      if(this.get('SELECT 1 FROM home_refresh WHERE singleton=1 AND lease_owner IS NOT NULL'))return null;
      return {value:fn()};
    });
    const expired=this.all(`SELECT release_id FROM home_publication WHERE published_at<?
      AND release_id NOT IN(SELECT release_id FROM home_publication ORDER BY published_at DESC,release_id DESC LIMIT 2)
      AND release_id NOT IN(SELECT release_id FROM home_head)
      UNION SELECT release_id FROM home_release WHERE computed_at<? AND release_id NOT IN(SELECT release_id FROM home_publication) AND release_id NOT IN(SELECT release_id FROM home_head)`,now-30*60000,new Date(now-30*60000).toISOString());
    for(const row of expired){
      const scopes=this.all('SELECT scope_version FROM home_release_scope WHERE release_id=?',row.release_id);
      if(!maintenance(()=>{
        if(this.get('SELECT 1 FROM home_head WHERE release_id=?',row.release_id)||this.get('SELECT 1 FROM home_publication WHERE release_id=? AND published_at>=?',row.release_id,now-30*60000)||this.all('SELECT release_id FROM home_publication ORDER BY published_at DESC,release_id DESC LIMIT 2').some(r=>r.release_id===row.release_id))return;
        for(const table of ['home_full_financial','home_full_evidence','home_full_query','home_full_module','home_full_release']){
          if(this.get("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",table))this.run(`DELETE FROM ${table} WHERE release_id=?`,row.release_id);
        }
        this.run('DELETE FROM home_release_scope WHERE release_id=?',row.release_id);
        this.run('DELETE FROM home_publication WHERE release_id=?',row.release_id);
        this.run('DELETE FROM home_release WHERE release_id=?',row.release_id);
      }))return;
      for(const {scope_version:version}of scopes){
        // Reference check and deletion must share one writer transaction. A new
        // publication may reuse this scope between batches; partial deletion
        // would otherwise corrupt the complete result it just referenced.
        const batch=maintenance(()=>{
          if(this.get('SELECT 1 FROM home_release_scope WHERE scope_version=? LIMIT 1',version))return [];
          const owned=this.all('SELECT DISTINCT trade_set_id FROM home_holding WHERE scope_version=?',version);
          if(this.get("SELECT 1 FROM sqlite_master WHERE type='table' AND name='home_metric_member'")){
            const objects=this.all('SELECT object_version FROM home_metric_member WHERE scope_version=?',version);
            this.run('DELETE FROM home_metric_member WHERE scope_version=?',version);
            for(const {object_version:id}of objects)if(!this.get('SELECT 1 FROM home_metric_member WHERE object_version=? LIMIT 1',id)){
              this.run('DELETE FROM home_metric_boundary WHERE object_version=?',id);
              this.run('DELETE FROM home_metric_object WHERE object_version=?',id);
            }
          }
          for(const table of ['home_holding_order','home_daily','home_holding'])this.run(`DELETE FROM ${table} WHERE scope_version=?`,version);
          this.run('DELETE FROM home_scope_result WHERE scope_version=?',version);
          return owned;
        });
        if(!batch)return;
        for(const {trade_set_id:id}of batch.value)if(!maintenance(()=>{
          if(this.get('SELECT 1 FROM home_holding WHERE trade_set_id=? LIMIT 1',id))return;
          if(this.get("SELECT 1 FROM sqlite_master WHERE name='home_full_module'")&&this.get("SELECT 1 FROM home_full_module m,json_each(m.payload_json) c WHERE m.kind='catalog' AND json_extract(c.value,'$.tradeSetId')=? LIMIT 1",id))return;
          this.run('DELETE FROM home_holding_trade WHERE trade_set_id=?',id);
          this.run('DELETE FROM home_trade_set WHERE trade_set_id=?',id);
        }))return;
      }
    }
    // Closed positions are retained by the immutable full catalog even when
    // absent from current holdings. Exclude them in one read before claiming
    // any writer lock; parsing every catalog again under thousands of writer
    // transactions can starve readers which must persist evidence recipes.
    // The final reference checks below remain inside the deletion transaction:
    // a publication or builder may acquire a reference after this candidate read.
    const catalogTradeSets=new Set(this.get("SELECT 1 FROM sqlite_master WHERE name='home_full_module'")
      ?this.all("SELECT DISTINCT json_extract(c.value,'$.tradeSetId') AS id FROM home_full_module m,json_each(m.payload_json) c WHERE m.kind='catalog'").map(row=>row.id)
      :[]);
    const orphanSets=this.all('SELECT trade_set_id FROM home_trade_set WHERE trade_set_id NOT IN(SELECT trade_set_id FROM home_holding)')
      .filter(row=>!catalogTradeSets.has(row.trade_set_id));
    for(const {trade_set_id:id}of orphanSets)if(!maintenance(()=>{
      if(this.get('SELECT 1 FROM home_holding WHERE trade_set_id=? LIMIT 1',id))return;
      if(this.get("SELECT 1 FROM sqlite_master WHERE name='home_full_module'")&&this.get("SELECT 1 FROM home_full_module m,json_each(m.payload_json) c WHERE m.kind='catalog' AND json_extract(c.value,'$.tradeSetId')=? LIMIT 1",id))return;
      this.run('DELETE FROM home_holding_trade WHERE trade_set_id=?',id);this.run('DELETE FROM home_trade_set WHERE trade_set_id=?',id);
    }))return;
  }
  head() { return this.get('SELECT release_id FROM home_head WHERE singleton=1')?.release_id as string | undefined ?? null; }

  reuseUnchanged(input:ReleaseInput):ReleaseInput {
    // Content identity is independent from a staging attempt. Reverted content
    // may reuse any retained publication; an abandoned partial stage never can.
    const published=new Map(this.all(`SELECT r.scope_id,r.scope_version,r.metadata_json FROM home_scope_result r
      WHERE r.policy_version=? AND r.built_from_sequence<=? AND EXISTS(
        SELECT 1 FROM home_release_scope s JOIN home_publication p USING(release_id) WHERE s.scope_version=r.scope_version)`,HOME_POLICY,input.sourceSequence)
      .map(r=>[JSON.stringify([r.scope_id,JSON.parse(String(r.metadata_json)).contentHash??r.scope_version]),String(r.scope_version)]));
    const scopes:ScopeProjection[]=[],reuse=[...(input.reuse??[])];
    for(const scope of input.scopes){
      const hash=scope.contentHash??scope.version,version=published.get(JSON.stringify([scope.id,hash]));
      if(version)reuse.push({id:scope.id,version});
      else scopes.push({...scope,contentHash:hash,version:JSON.stringify([input.id,scope.id,hash])});
    }
    return {...input,scopes,reuse};
  }

  stage(input: ReleaseInput) {
    if (!Number.isSafeInteger(input.sourceSequence) || input.sourceSequence < 0 || !input.id) throw new Error('invalid release');
    if(input.fx)validateDay({date:input.businessDate,buckets:{},fx:input.fx,reasons:[]});
    const required = input.accounts.flatMap(a => (['all', 'CN', 'HK', 'US'] as const).map(m => scopeId(m, a.id)));
    const supplied = [...input.scopes.map(s => s.id), ...(input.reuse ?? []).map(s => s.id)];
    if (new Set(required).size !== required.length || new Set(supplied).size !== supplied.length || required.length !== supplied.length || required.some(id => !supplied.includes(id))) throw new Error('incomplete scope manifest');
    const sets = new Map(input.trades.map(t => [t.id, t]));
    if (sets.size !== input.trades.length) throw new Error('duplicate trade set');
    for (const scope of input.scopes) {
      validateScope(scope);
      if(scope.metricObjects){
        const expected=input.trades.filter(t=>(scope.accountId==='all'||t.accountId===scope.accountId)&&(scope.market==='all'||t.market===scope.market)).map(t=>t.positionKey).sort();
        const actual=scope.metricObjects.map(o=>o.positionKey).sort();
        if(input.trades.some(t=>!t.accountId||!t.market)||new Set(actual).size!==actual.length||encode(actual)!==encode(expected))throw new Error('metric scope membership mismatch');
        const active=scope.metricObjects.filter(o=>Object.values(o.current.buckets).some(b=>b.count>0)).map(o=>o.positionKey).sort();
        if(encode(active)!==encode(scope.holdings.map(h=>h.positionKey).sort()))throw new Error('metric holding membership mismatch');
        for(const object of scope.metricObjects)if(object.firstDay!==scope.days[0].date||object.lastDay!==scope.businessDate||!input.trades.some(t=>t.positionKey===object.positionKey&&t.accountId===object.accountId))throw new Error('metric scope boundary mismatch');
      }

      if (scope.sourceSequence !== input.sourceSequence || scope.businessDate !== input.businessDate) throw new Error('scope watermark mismatch');
      for (const h of scope.holdings) {
        const set = sets.get(h.tradeSetId) ?? this.get('SELECT position_key AS positionKey FROM home_trade_set WHERE trade_set_id=?', h.tradeSetId);
        if (!set || set.positionKey !== h.positionKey) throw new Error('trade reference mismatch');
      }
    }
    // Validated input is written in bounded transactions; a crash leaves only unreferenced staging.
    this.transaction(() => {
      this.run('INSERT INTO home_release VALUES(?,?,?,?,?,?,?,?,?)', input.id, input.sourceSequence, HOME_POLICY, input.computedAt, input.computedAt, input.businessDate, 'staging', encode(input.accounts), encode({requiresFull:!!input.full,scopes:required,nextRefreshAt:input.nextRefreshAt??null,...(input.fx?{fx:input.fx}:{})}));
      for (const reuse of input.reuse ?? []) {
        const prior = this.get('SELECT s.* FROM home_scope_result s WHERE scope_version=? AND scope_id=? AND policy_version=? AND EXISTS(SELECT 1 FROM home_release_scope r JOIN home_publication p USING(release_id) WHERE r.scope_version=s.scope_version)', reuse.version, reuse.id, HOME_POLICY);
        if (!prior || Number(prior.built_from_sequence) > input.sourceSequence) throw new Error('invalid reused scope');
        this.run('INSERT INTO home_release_scope VALUES(?,?,?,?)', input.id, reuse.id, reuse.version, input.sourceSequence);
      }
    });
    for (const set of input.trades) {
      const prior = this.get('SELECT position_key,trade_count FROM home_trade_set WHERE trade_set_id=?', set.id);
      let completed=0;
      if (prior) {
        const saved=this.all('SELECT trade_json FROM home_holding_trade WHERE trade_set_id=? ORDER BY ordinal',set.id).map(t=>JSON.parse(String(t.trade_json)));
        if(prior.position_key!==set.positionKey||prior.trade_count!==set.trades.length||saved.length>set.trades.length||encode(saved)!==encode(set.trades.slice(0,saved.length)))throw new Error('trade set identity collision');
        completed=saved.length;
        if(completed===set.trades.length)continue;
        if(this.get('SELECT 1 FROM home_holding h JOIN home_release_scope r USING(scope_version) JOIN home_publication p USING(release_id) WHERE h.trade_set_id=? LIMIT 1',set.id))throw new Error('published trade set incomplete');
      }
      if (new Set(set.trades.map(t => t.id)).size !== set.trades.length) throw new Error('duplicate trade');
      if(!prior)this.transaction(()=>this.run('INSERT INTO home_trade_set VALUES(?,?,?,?,?)', set.id, set.positionKey, input.sourceSequence, set.trades.length, HOME_POLICY));
      for(let offset=completed;offset<set.trades.length;offset+=256)this.transaction(()=>{
        const insert=this.db.prepare('INSERT INTO home_holding_trade VALUES(?,?,?,?)');
        set.trades.slice(offset,offset+256).forEach((trade,i)=>insert.run(set.id,offset+i+1,trade.id,encode(trade)));
      });
    }
    stageMetricObjects(this.db,input.scopes.flatMap(s=>s.metricObjects??[]));
    for (const scope of input.scopes) {
      this.transaction(() => this.run('INSERT INTO home_scope_result VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', scope.version, scope.id, scope.currency, scope.sourceSequence, HOME_POLICY, scope.computedAt, scope.valuationCutoff, scope.businessDate, scope.days[0].date, scope.days.at(-1)!.date, encode(scope.current), encode({ metricObjects:scope.metricObjects!==undefined,reasons: scope.reasons,marketCutoffs:scope.marketCutoffs??{},contentHash:scope.contentHash??scope.version }), scope.holdings.length));
      if(scope.metricObjects)this.transaction(()=>{
        const insert=this.db.prepare('INSERT INTO home_metric_member VALUES(?,?,?)');
        for(const object of scope.metricObjects!)insert.run(scope.version,object.positionKey,object.version);
      });
      for (let offset = 0; offset < scope.days.length; offset += 256) this.transaction(() => {
        const insert = this.db.prepare('INSERT INTO home_daily VALUES(?,?,?,?)');
        for (const day of scope.days.slice(offset, offset + 256)) insert.run(scope.version, day.date, encode(day.buckets), encode({ fx: day.fx, reasons: day.reasons, feeWindows: day.feeWindows }));
      });
      for (let offset = 0; offset < scope.holdings.length; offset += 128) this.transaction(() => {
        const insert = this.db.prepare('INSERT INTO home_holding VALUES(?,?,?,?,?,?,?, ?,?)');
        for (const h of scope.holdings.slice(offset, offset + 128)) insert.run(scope.version, h.row.id, h.row.accountId, h.instrumentId, h.positionKey, h.tradeSetId, `${h.row.name} ${h.row.code} ${h.row.exchange}`.toLocaleLowerCase(), encode(h.row), encode({ description: h.description }));
      });
      for (const key of ['name', 'marketValue', 'unrealized'] as const) for (const direction of ['asc', 'desc'] as const) {
        const ordered = [...scope.holdings].sort((a, b) => compareRows(a.row, b.row, key) * (direction === 'asc' ? 1 : -1));
        for (let offset = 0; offset < ordered.length; offset += 256) this.transaction(() => { const insert = this.db.prepare('INSERT INTO home_holding_order VALUES(?,?,?,?,?)'); ordered.slice(offset, offset + 256).forEach((h, i) => insert.run(scope.version, key, direction, offset + i + 1, h.row.id)); });
      }
      this.transaction(() => this.run('INSERT INTO home_release_scope VALUES(?,?,?,?)', input.id, scope.id, scope.version, input.sourceSequence));
    }
    // All three period shortcuts must survive a cold process, including the
    // first month/week switch. Keep the original year entry readable by older
    // consumers; extra exact-boundary entries share this release's FX.
    const preparedSubtotals:Record<string,PreparedSubtotal>= {};
    const weekStart=nextDay(input.businessDate,-(new Date(`${input.businessDate}T00:00:00Z`).getUTCDay()+6)%7);
    const periods=[...new Set([`${input.businessDate.slice(0,4)}-01-01`,`${input.businessDate.slice(0,7)}-01`,weekStart])].map(from=>({from,to:input.businessDate}));
    for(const scope of this.all('SELECT s.* FROM home_release_scope r JOIN home_scope_result s USING(scope_version) WHERE r.release_id=? AND r.scope_id IN(?,?,?,?)',input.id,...(['all','CN','HK','US'] as const).map(m=>scopeId(m,'all')))){
      if(!JSON.parse(String(scope.metadata_json)).metricObjects)continue;
      const current=JSON.parse(String(scope.current_json)) as NativeDay,fx=input.fx??current.fx,version=String(scope.scope_version),currency=String(scope.report_currency);
      const [year,...extra]=periods.map(period=>({key:objectSubtotalKey(version,period,currency,fx),value:objectSubtotals(this.db,version,period,currency,fx)}));
      preparedSubtotals[String(scope.scope_id)]={...year,periods:extra};
    }
    if(input.full){
      stageFull(this.db,input.full);
      new FullHomeStore(this.db).publishFinancialPartitions(input.id);
    }
    this.transaction(() => {
      for(const set of input.trades)if(Number(this.get('SELECT count(*) n FROM home_holding_trade WHERE trade_set_id=?',set.id)?.n)!==set.trades.length)throw new Error('incomplete trade publication');
      const actual = this.all('SELECT scope_id FROM home_release_scope WHERE release_id=?', input.id);
      if (actual.length !== required.length) throw new Error('incomplete scope publication');
      const manifest=JSON.parse(String(this.get('SELECT manifest_json FROM home_release WHERE release_id=?',input.id)!.manifest_json));
      const financialVersion=input.full?{financialPartitionVersion:HOME_FINANCIAL_PARTITION_VERSION}:{};
      this.run("UPDATE home_release SET state='validated',manifest_json=? WHERE release_id=?",encode({...manifest,preparedSubtotals,preparedSubtotalVersion:HOME_PREPARED_SUBTOTAL_VERSION,...financialVersion}),input.id);
    });
  }

  publish(id: string, expected: string | null, fence?: {owner:string;now:number}, publishedAt=Date.now()) {
    this.transaction(() => {
      if (fence && !this.get('SELECT 1 FROM home_refresh WHERE singleton=1 AND lease_owner=? AND lease_until>?',fence.owner,fence.now)) throw new Error('publication lease expired');
      if (this.head() !== expected) throw new Error('publication head changed');
      const release = this.get("SELECT * FROM home_release WHERE release_id=? AND state='validated'", id);
      if (!release) throw new Error('release not validated');
      const previous = expected ? this.get('SELECT source_sequence FROM home_release WHERE release_id=?', expected) : null;
      const full=validateFull(this.db,id);
      if(JSON.parse(String(release.manifest_json)).requiresFull&&!full)throw new Error('required full manifest missing');
      if(full&&!fence)throw new Error('full publication requires fence');
      if (previous && Number(previous.source_sequence) > Number(release.source_sequence)) throw new Error('older release');
      this.run('INSERT OR IGNORE INTO home_publication VALUES(?,?)',id,publishedAt);
      this.run('INSERT INTO home_head VALUES(1,?) ON CONFLICT(singleton) DO UPDATE SET release_id=excluded.release_id', id);
    });
  }

  private resolve(request: HomeRequest, releaseId?: string) {
    const id = releaseId ?? this.head();
    if (!id) throw new HomeReadError(503, '首页结果未就绪，后台正在准备');
    const release = this.get("SELECT r.* FROM home_release r JOIN home_publication p USING(release_id) WHERE release_id=? AND state='validated'", id);
    if (!release) throw new HomeReadError(410, '结果版本已过期，请重新读取首页');
    const scope = this.get('SELECT s.* FROM home_release_scope r JOIN home_scope_result s ON s.scope_version=r.scope_version WHERE r.release_id=? AND r.scope_id=?', id, scopeId(request.market, request.accountId));
    if (!scope) throw new HomeReadError(404, '账户或市场范围不存在');
    const manifest=JSON.parse(String(release.manifest_json));
    if(manifest.fx!==undefined)scope.current_json=encode({...JSON.parse(String(scope.current_json)),fx:manifest.fx});
    scope.prepared_subtotal_json=encode(manifest.preparedSubtotals?.[String(scope.scope_id)]??null);
    const stamp: Stamp = { scope: encode([request.market, request.accountId, request.period]), version: id, asOf: String(scope.valuation_cutoff), reportCurrency: String(scope.report_currency) };
    return { release, scope, stamp };
  }
  private day(row: Row | undefined): NativeDay | null { return row ? { date: String(row.business_date), buckets: JSON.parse(String(row.native_by_currency_json)), ...JSON.parse(String(row.money_context_json)) } : null; }
  private period(scope: Row, request: HomeRequest, partial=this.partials(scope,request)) {
    const baseline = this.day(this.get('SELECT * FROM home_daily WHERE scope_version=? AND business_date=?', scope.scope_version, nextDay(request.period.from, -1)));
    const days = this.all('SELECT * FROM home_daily WHERE scope_version=? AND business_date BETWEEN ? AND ? ORDER BY business_date', scope.scope_version, request.period.from, request.period.to).map(row => this.day(row)!);
    const fx=JSON.parse(String(scope.current_json)).fx;
    const values=projectPeriod(baseline&&{...baseline,fx}, days.map(day=>({...day,fx})), request.period, String(scope.report_currency), String(scope.business_date));
    if(partial)for(const key of ['net','realized','unrealizedChange'] as const)values[key]={...values[key],partial:partial[key]};
    return values;
  }
  private partials(scope:Row,request:HomeRequest){
    if(!JSON.parse(String(scope.metadata_json)).metricObjects)return null;
    const current=JSON.parse(String(scope.current_json)) as NativeDay;
    const version=String(scope.scope_version),period={from:request.period.from,to:request.period.to<String(scope.business_date)?request.period.to:String(scope.business_date)},currency=String(scope.report_currency);
    const prepared=JSON.parse(String(scope.prepared_subtotal_json??'null')) as PreparedSubtotal|null;
    const key=objectSubtotalKey(version,period,currency,current.fx);
    const match=prepared&&[prepared,...(prepared.periods??[])].find(entry=>entry.key===key);
    if(match)return match.value;
    return objectSubtotals(this.db,version,period,currency,current.fx);
  }
  private current(scope:Row,request:HomeRequest,partial=this.partials(scope,request)){
    const values=currentAmounts(JSON.parse(String(scope.current_json)),String(scope.report_currency));
    if(partial)for(const key of ['marketValue','unrealized'] as const)values[key]={...values[key],partial:partial[key]};
    return values;
  }
  private holdings(scope: Row, request: HomeRequest, partial=this.partials(scope,request)) {
    const current = this.current(scope,request,partial);
    const sortAvailable = current.marketValue.value !== null && current.unrealized.value !== null;
    const sort = sortAvailable ? request.sort : 'name';
    const total = Number(this.get('SELECT count(*) AS n FROM home_holding WHERE scope_version=? AND instr(search_text,?)>0', scope.scope_version, request.query.toLocaleLowerCase())!.n);
    const pages = Math.max(1, Math.ceil(total / 8)), page = Math.max(1, Math.min(request.page, pages));
    // Name paging stays indexed. Monetary ranking must use this release's FX,
    // and only scans current holdings, never historical trades/daily results.
    const rows = sort==='name'
      ?this.all('SELECT h.row_json FROM home_holding_order o JOIN home_holding h ON h.scope_version=o.scope_version AND h.holding_id=o.holding_id WHERE o.scope_version=? AND o.sort_key=? AND o.direction=? AND instr(h.search_text,?)>0 ORDER BY o.ordinal LIMIT 8 OFFSET ?', scope.scope_version, sort, request.direction, request.query.toLocaleLowerCase(), (page - 1) * 8).map(r=>this.revalueHolding(scope,r))
      :this.orderedHoldings(scope,request,sort).slice((page-1)*8,page*8);
    return { rows, total, page, pages, ...current, sortAvailable };
  }
  private revalueHolding(scope:Row,row:Row):Holding {
    const holding=JSON.parse(String(row.row_json)) as Holding,fx=(JSON.parse(String(scope.current_json)) as NativeDay).fx,currency=String(scope.report_currency);
    return {...holding,marketValue:revalueAmount(holding.marketValue,currency,fx),unrealized:revalueAmount(holding.unrealized,currency,fx)};
  }
  private orderedHoldings(scope:Row,request:HomeRequest,sort:HomeRequest['sort']) {
    return this.all('SELECT row_json FROM home_holding WHERE scope_version=? AND instr(search_text,?)>0',scope.scope_version,request.query.toLocaleLowerCase()).map(row=>this.revalueHolding(scope,row)).sort((a,b)=>compareRows(a,b,sort)*(request.direction==='asc'?1:-1));
  }
  readHome(request: HomeRequest, releaseId?: string): HomeResult { return this.readSnapshot(()=>this.readHomeValue(request,releaseId)); }
  private readHomeValue(request: HomeRequest, releaseId?: string): HomeResult {
    const { release, scope, stamp } = this.resolve(request, releaseId);
    const partial=this.partials(scope,request);
    const values = this.period(scope, request,partial), current = this.current(scope,request,partial), holdings = this.holdings(scope, request,partial);
    return { fxDate:Object.values((JSON.parse(String(scope.current_json)) as NativeDay).fx).map(f=>f.asOf).sort().at(-1)??null, dataRange:{from:nextDay(String(scope.first_business_date)),to:String(scope.business_date)}, stamp, snapshot: { marketCutoffs:JSON.parse(String(scope.metadata_json)).marketCutoffs??{},releaseId: stamp.version, scopeId: String(scope.scope_id), scopeVersion: String(scope.scope_version), sourceSequence: Number(release.source_sequence), computedAt: String(scope.computed_at), valuationCutoff: String(scope.valuation_cutoff), businessDate: String(scope.business_date) }, request: { ...request, page: holdings.page, sort: holdings.sortAvailable ? request.sort : 'name' }, metrics: { net: values.net, periodRealized: values.realized, unrealizedChange: values.unrealizedChange, currentMarketValue: current.marketValue }, currentUnrealized: current.unrealized, series: { version: stamp.version, boundary: { effectiveEnd: values.effectiveEnd, asOf: stamp.asOf }, points: values.points }, holdings, accounts: JSON.parse(String(release.catalog_json)), reasons: JSON.parse(String(scope.metadata_json)).reasons };
  }
  readPeriod(request: HomeRequest, releaseId: string) { return this.readSnapshot(()=>this.readPeriodValue(request,releaseId)); }
  private readPeriodValue(request: HomeRequest, releaseId: string) { const { scope, stamp } = this.resolve(request, releaseId); return { stamp, period: this.period(scope, request) }; }
  readHoldings(request: HomeRequest, releaseId: string) { return this.readSnapshot(()=>this.readHoldingsValue(request,releaseId)); }
  private readHoldingsValue(request: HomeRequest, releaseId: string) { const { scope, stamp } = this.resolve(request, releaseId); return { stamp, holdings: this.holdings(scope, request) }; }
  exportHoldings(request:HomeRequest,releaseId:string) {
    return this.readSnapshot(()=>{
      const {scope}=this.resolve(request,releaseId);
      const current=currentAmounts(JSON.parse(String(scope.current_json)),String(scope.report_currency));
      const sort=current.marketValue.value===null||current.unrealized.value===null?'name':request.sort;
      const rows=this.orderedHoldings(scope,request,sort);
      const cell=(value:string|null)=>'"'+(value===null?'未知':/^[=+@\-]/.test(value)?"'"+value:value).replaceAll('"','""')+'"';
      const notes=rows.some(h=>h.valuationNotes?.length||h.marketValue.valuationNotes?.length||h.unrealized.valuationNotes?.length);
      return ['名称,代码,账户,数量,原币成本,原币价格,原币,市值,未实现盈亏,报告币种'+(notes?',估值依据':''),...rows.map(h=>{
        return [h.name,h.code,h.accountId,h.quantity,h.cost,h.price,h.currency,h.marketValue.value,h.unrealized.value,h.marketValue.currency,...(notes?[[...new Set([...(h.valuationNotes??[]),...(h.marketValue.valuationNotes??[]),...(h.unrealized.valuationNotes??[])])].join('；')]:[])].map(cell).join(',');
      })].join('\n');
    });
  }
  private holding(stamp: Stamp, id: string): Row {
    let identity: [HomeRequest['market'], string, HomeRequest['period']];
    try { identity = JSON.parse(stamp.scope); } catch { throw new HomeReadError(400, '无效范围'); }
    const { scope, stamp: verified } = this.resolve({ market: identity[0], accountId: identity[1], period: identity[2], query: '', sort: 'name', direction: 'asc', page: 1 }, stamp.version);
    if (encode(verified) !== encode(stamp)) throw new HomeReadError(409, '结果版本或范围不一致');
    const row = this.get('SELECT * FROM home_holding WHERE scope_version=? AND holding_id=?', scope.scope_version, id);
    if (!row) throw new HomeReadError(404, '该范围下持仓不存在');
    return {...row,row_json:encode(this.revalueHolding(scope,row))};
  }
  readHolding(stamp: Stamp, id: string): HoldingDetail { return this.readSnapshot(()=>this.readHoldingValue(stamp,id)); }
  private readHoldingValue(stamp: Stamp, id: string): HoldingDetail { const row = this.holding(stamp, id); return { stamp, holding: JSON.parse(String(row.row_json)), description: JSON.parse(String(row.detail_json)).description }; }
  readTrades(stamp: Stamp, id: string, cursor = 0): TradeCollection & { nextCursor: number | null; tradeSetId: string } { return this.readSnapshot(()=>this.readTradesValue(stamp,id,cursor)); }
  private readTradesValue(stamp: Stamp, id: string, cursor = 0): TradeCollection & { nextCursor: number | null; tradeSetId: string } {
    if (!Number.isSafeInteger(cursor) || cursor < 0) throw new HomeReadError(400, '无效成交游标');
    const row = this.holding(stamp, id), trades = this.all('SELECT trade_json,ordinal FROM home_holding_trade WHERE trade_set_id=? AND ordinal>? ORDER BY ordinal LIMIT 51', row.trade_set_id, cursor);
    return { stamp, holdingId: id, name: JSON.parse(String(row.row_json)).name, trades: trades.slice(0, 50).map(t => JSON.parse(String(t.trade_json))), nextCursor: trades.length > 50 ? Number(trades[49].ordinal) : null, tradeSetId: String(row.trade_set_id) };
  }
}
