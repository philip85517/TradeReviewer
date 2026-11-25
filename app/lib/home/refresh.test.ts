import {DatabaseSync} from 'node:sqlite';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {HomeRefresh} from './refresh';
import {HomeStore} from './store';
import {request,release} from './test-fixtures';
import {HOME_FINANCIAL_PARTITION_VERSION} from './contracts';
const opened:DatabaseSync[]=[];
afterEach(()=>opened.splice(0).forEach(db=>db.close()));
function setup(){const db=new DatabaseSync(':memory:');opened.push(db);initializeSqlite(db);return{db,refresh:new HomeRefresh(db),store:new HomeStore(db)};}
const now=Date.parse('2026-01-02T16:00:00Z');
function change(db:DatabaseSync,key='x'){db.prepare("INSERT INTO home_source_change(entity_kind,entity_key,effective_from,committed_at,change_json)VALUES('test',?,'2026-01-01','2026-01-02T16:00:00.000Z','{}')").run(key);}
describe('durable refresh coordination',()=>{
 it('asynchronously upgrades an old full financial partition version while keeping the old publication readable',()=>{
  const {db,store}=setup(),refresh=new HomeRefresh(db,true);store.stage(release('old-finance',0));store.publish('old-finance',null);
  db.prepare("UPDATE home_release SET manifest_json=json_set(manifest_json,'$.financialPartitionVersion',?) WHERE release_id='old-finance'").run(HOME_FINANCIAL_PARTITION_VERSION-1);
  db.prepare('INSERT INTO home_full_release VALUES(?,?,?)').run('old-finance','{}',now);
  expect(refresh.status(now).state).toBe('updating');
  expect(store.readHome(request).stamp.version).toBe('old-finance');
  expect(db.prepare('SELECT release_id FROM home_head').get()?.release_id).toBe('old-finance');
 });
 it('upgrades the year-only format while its previous publication remains readable',()=>{
  const {db,refresh,store}=setup();store.stage(release('year-only',0));store.publish('year-only',null);
  db.exec("UPDATE home_release SET manifest_json=json_remove(manifest_json,'$.preparedSubtotalVersion') WHERE release_id='year-only'");
  expect(refresh.status(now).state).toBe('updating');expect(store.readHome(request).stamp.version).toBe('year-only');
  expect(refresh.claim('upgrade',now)).toBe(true);store.stage(release('shortcuts',0));
  store.publish('shortcuts','year-only',{owner:'upgrade',now:now+1});refresh.finish('upgrade');
  expect(refresh.status(now+2).state).toBe('ready');expect(refresh.claim('again',now+3)).toBe(false);
 });
 it('upgrades a legacy publication once without requiring a fact mutation',()=>{
  const {db,refresh,store}=setup();store.stage(release('legacy',0));store.publish('legacy',null);
  db.exec("UPDATE home_release SET manifest_json=json_remove(manifest_json,'$.preparedSubtotals') WHERE release_id='legacy'");
  expect(refresh.status(now)).toMatchObject({state:'updating',publishedSequence:0,pendingSequence:0});
  expect(store.readHome(request).stamp.version).toBe('legacy');
  expect(refresh.claim('upgrade',now)).toBe(true);
  store.stage(release('prepared',0));
  expect(store.readHome(request).stamp.version).toBe('legacy');
  store.publish('prepared','legacy',{owner:'upgrade',now:now+1});refresh.finish('upgrade');
  expect(refresh.status(now+2).state).toBe('ready');
  expect(refresh.claim('again',now+3)).toBe(false);
 });
 it('does not collect staging dependencies while a builder holds the lease',()=>{
  const {db,refresh,store}=setup();
  for(let n=1;n<=3;n++){store.stage(release(`r${n}`,0));store.publish(`r${n}`,n===1?null:`r${n-1}`,undefined,now+n*1000);}
  change(db);expect(refresh.claim('builder',now+31*60000)).toBe(true);
  store.collect(now+32*60000);
  expect(db.prepare("SELECT count(*) n FROM home_publication").get()!.n).toBe(3);
  expect(store.readHome(request,'r1').stamp.version).toBe('r1');
  refresh.finish('builder');store.collect(now+32*60000);
  expect(db.prepare("SELECT count(*) n FROM home_publication").get()!.n).toBe(2);
 });
 it('rechecks the lease between cleanup transactions',()=>{
  const {db,store}=setup();
  for(let n=1;n<=3;n++){store.stage(release(`r${n}`,0));store.publish(`r${n}`,n===1?null:`r${n-1}`,undefined,now+n*1000);}
  const before=db.prepare("SELECT count(*) n FROM home_daily WHERE scope_version='r1/all/all'").get()!.n;
  db.exec("CREATE TRIGGER claim_after_unlink AFTER DELETE ON home_release WHEN OLD.release_id='r1' BEGIN UPDATE home_refresh SET lease_owner='builder',lease_until=9999999999999 WHERE singleton=1; END");
  store.collect(now+32*60000);
  expect(db.prepare("SELECT count(*) n FROM home_daily WHERE scope_version='r1/all/all'").get()!.n).toBe(before);
 });
 it('does not claim writer locks for closed trade sets retained by the full catalog',()=>{
  const {db,store}=setup();store.stage(release('r1',0));store.publish('r1',null);
  db.exec("INSERT INTO home_full_module VALUES('r1','catalog','[{\"tradeSetId\":\"closed-set\"}]')");
  db.exec("INSERT INTO home_trade_set(trade_set_id,position_key,source_sequence,trade_count,policy_version)VALUES('closed-set','closed',0,0,'fixture')");
  const exec=vi.spyOn(db,'exec');store.collect(now);
  expect(exec.mock.calls.filter(([sql])=>sql==='BEGIN IMMEDIATE')).toHaveLength(0);
  expect(db.prepare("SELECT 1 FROM home_trade_set WHERE trade_set_id='closed-set'").get()).toBeTruthy();
 });
 it('rechecks newly acquired catalog references under the deletion writer lock',()=>{
  const {db,store}=setup();store.stage(release('r1',0));store.publish('r1',null);
  db.exec("INSERT INTO home_trade_set(trade_set_id,position_key,source_sequence,trade_count,policy_version)VALUES('late-set','closed',0,0,'fixture')");
  const exec=db.exec.bind(db);let attached=false;
  vi.spyOn(db,'exec').mockImplementation(sql=>{
   if(sql==='BEGIN IMMEDIATE'&&!attached){
    attached=true;exec("INSERT INTO home_full_module VALUES('r1','catalog','[{\"tradeSetId\":\"late-set\"}]')");
   }
   return exec(sql);
  });
  store.collect(now);
  expect(attached).toBe(true);
  expect(db.prepare("SELECT 1 FROM home_trade_set WHERE trade_set_id='late-set'").get()).toBeTruthy();
  expect(store.readHome(request).stamp.version).toBe('r1');
 });
 it('wakes once at a persisted intraday knowledge boundary without a fact write',()=>{
  const {db,refresh,store}=setup();const input=release('r1',0);
  Object.assign(input,{nextRefreshAt:'2026-01-02T15:59:59.999Z'});
  store.stage(input);store.publish('r1',null);
  refresh.tick('2026-01-02',Date.parse('2026-01-02T15:59:59.998Z'));
  expect(refresh.status().state).toBe('ready');
  refresh.tick('2026-01-02',Date.parse('2026-01-02T16:00:00Z'));
  refresh.tick('2026-01-02',Date.parse('2026-01-02T16:00:01Z'));
  expect(db.prepare("SELECT count(*) n FROM home_source_change WHERE entity_kind='clock'").get()?.n).toBe(1);
  expect(refresh.status(Date.parse('2026-01-02T16:00:02Z')).state).toBe('updating');
 });
 it('rolls back a whole scope if garbage collection loses its right to delete it',()=>{
  const {db,store}=setup();
  for(let n=1;n<=3;n++){store.stage(release(`r${n}`,n));store.publish(`r${n}`,n===1?null:`r${n-1}`,undefined,now+n*1000);}
  const count=()=>db.prepare("SELECT count(*) n FROM home_daily WHERE scope_version='r1/all/all'").get()?.n;
  const before=count();
  db.exec("CREATE TRIGGER reject_gc BEFORE DELETE ON home_scope_result WHEN OLD.scope_version='r1/all/all' BEGIN SELECT RAISE(ABORT,'scope became referenced'); END");
  expect(()=>store.collect(now+31*60000)).toThrow(/scope became referenced/);
  expect(count()).toBe(before);
 });
 it('captures every fact mutation in the source transaction, including rollback; reviews do not invalidate',()=>{
  const {db}=setup();
  db.exec("BEGIN; INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','X','US','USD'); ROLLBACK");
  expect(db.prepare('SELECT count(*) n FROM home_source_change').get()?.n).toBe(0);
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','X','US','USD')");
  expect(db.prepare('SELECT count(*) n FROM home_source_change').get()?.n).toBe(1);
  db.exec("UPDATE instruments SET name='changed' WHERE id='US:X'; INSERT INTO reviews(episode_id,updated_at)VALUES('review','now')");
  expect(db.prepare('SELECT count(*) n FROM home_source_change').get()?.n).toBe(2);
  db.exec("UPDATE instruments SET name='changed' WHERE id='US:X'");
  expect(db.prepare('SELECT count(*) n FROM home_source_change').get()?.n).toBe(2);
 });
 it('invalidates when a usable quote becomes adjusted or its identity changes',()=>{
  const {db}=setup();
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','X','US','USD'); INSERT INTO daily_candles(instrument_id,date,adjustment_mode,open,high,low,close,currency,provider)VALUES('US:X','2026-01-01','raw','1','1','1','1','USD','test')");
  const count=()=>Number(db.prepare('SELECT count(*) n FROM home_source_change').get()?.n);
  const before=count();
  db.exec("UPDATE daily_candles SET adjustment_mode='forward'");expect(count()).toBe(before+1);
  db.exec("UPDATE daily_candles SET adjustment_mode='raw'");expect(count()).toBe(before+2);
  db.exec("UPDATE daily_candles SET date='2026-01-02'");expect(count()).toBe(before+3);
 });
 it('recovers an expired lease and fences the crashed writer even when its expected head still matches',()=>{
  const {refresh,store}=setup();
  expect(refresh.claim('a',now,1000)).toBe(true);
  expect(refresh.claim('b',now+500,1000)).toBe(false);
  store.stage(release('r1',0));
  expect(refresh.claim('b',now+1001,1000)).toBe(true);
  expect(()=>store.publish('r1',null,{owner:'a',now:now+1002})).toThrow(/lease/);
  store.publish('r1',null,{owner:'b',now:now+1002});
  expect(store.head()).toBe('r1');
 });
 it('keeps W+1 pending after publishing W; expiry, failure, retry retain the old complete result',()=>{
  const {db,refresh,store}=setup();change(db);
  expect(refresh.claim('a',now)).toBe(true);
  store.stage(release('r1',1)); change(db,'y');
  store.publish('r1',null,{owner:'a',now:now+1000});refresh.finish('a');
  expect(refresh.status(now+31000)).toMatchObject({state:'delayed',releaseId:'r1',pendingSequence:2,publishedSequence:1});
  expect(refresh.claim('b',now+31001)).toBe(true);refresh.fail('b','broken',now+31002);
  expect(refresh.status(now+31003)).toMatchObject({state:'failed',releaseId:'r1',canRetry:true});
  expect(store.readHome(request).stamp.version).toBe('r1');
  refresh.retry();refresh.retry();
  expect(refresh.claim('c',now+31004)).toBe(true);
  store.stage(release('r2',2));store.publish('r2','r1',{owner:'c',now:now+31005});refresh.finish('c');
  expect(refresh.status(now+31006)).toMatchObject({state:'ready',releaseId:'r2'});
  expect(refresh.claim('d',now+31007)).toBe(false);
 });
 it('reports recovery separately without a head, and retains old versions for at least 30 minutes and two publications',()=>{
  const {refresh,store}=setup();expect(refresh.status(now).state).toBe('recovering');
  for(let n=1;n<=3;n++){store.stage(release(`r${n}`,n));store.publish(`r${n}`,n===1?null:`r${n-1}`,undefined,now+n*1000);}
  const stamp=store.readHome(request,'r1').stamp;
  store.collect(now+10000);expect(store.readHolding(stamp,'a:CN:0').stamp.version).toBe('r1');
  store.collect(now+31*60000);
  expect(()=>store.readHome(request,'r1')).toThrow(/过期/);
  expect(store.readHome(request,'r2').stamp.version).toBe('r2');
 });
});
