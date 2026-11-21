import {ProjectionCache} from './projection-cache';
import {expect,it} from 'vitest';
import {buildRelease} from './builder';
import type {SourceSnapshot} from './source';
const source=():SourceSnapshot=>({sequence:1,asOf:'2026-01-07T15:59:59Z',businessDate:'2026-01-07',executions:[],monthly:[],instruments:[],candles:[],currentFx:{},historicalFx:[],classification:{live:0,simulation:0,unknown:0},reviewFacts:{schemaVersion:1,legacy:[],recall:[]}});
it('rejects dangling and malformed provided refs rather than silently discarding them',()=>{
 const s=source();s.executionRefs=[{schemaVersion:1,executionId:'missing',rawVersion:'a'.repeat(64),effectiveVersion:'b'.repeat(64)}];
 expect(()=>buildRelease(s,'bad')).toThrow();
});
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initializeSqlite} from '../../../db/sqlite';
import {SqliteStore} from '../storage/sqlite-store';
import {buildOnce} from '../../../scripts/home-build-entry';
import {HomeStore} from './store';
import {readSourceSnapshot} from './source';
import {request} from './test-fixtures';
it('publishes immutable refs through fresh connections, invalidates legacy scopes, and reuses unchanged refreshes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'source-ref-')),path=join(dir,'test.sqlite'),priorPath=process.env.TRADEREVIEW_DB_PATH;process.env.TRADEREVIEW_DB_PATH=path;
 const db=new DatabaseSync(path);initializeSqlite(db);
 try{
 const e={id:'e',accountId:'a',accountLabel:'A',instrument:{id:'HK:X',symbol:'X',name:'X',market:'HK',currency:'HKD'},side:'buy' as const,executedAt:'2026-01-05T02:00:00Z',quantity:'2',price:'10',fee:'0',source:{platform:'futu',row:1,tradeNature:'live' as const}};
 new SqliteStore(db).mergeExecutions([e]);
 const complete=readSourceSnapshot(db,'2026-01-07T15:59:59Z');const ref=complete.executionRefs![0];
 for(const refs of [[],[ref,ref],[{...ref,rawVersion:'invalid'}],[{...ref,schemaVersion:2}]])expect(()=>buildRelease({...complete,executionRefs:refs as typeof complete.executionRefs},'invalid')).toThrow();
 const asOf='2026-01-07T15:59:59Z',store=new HomeStore(db),s=readSourceSnapshot(db,asOf);delete s.executionRefs;
 const legacy=buildRelease(s,'legacy',{cache:new ProjectionCache(db),reusePublished:true});store.stage(legacy);store.publish(legacy.id,null);
 const first=buildOnce(path,asOf);expect(first.rebuiltScopes).toBe(legacy.scopes.length);expect(first.objects.built).toBe(1);
 const conn=new DatabaseSync(path),reader=new HomeStore(conn);
 try{
 const page=reader.readHome({...request,period:{preset:'custom',from:'2026-01-05',to:'2026-01-07'}},first.release);const id=page.holdings.rows[0].id;
 const old=reader.readTrades(page.stamp,id);expect(old.trades[0].sourceRef).toEqual(readSourceSnapshot(db,asOf).executionRefs![0]);
 expect(buildOnce(path,asOf).reusedScopes).toBeGreaterThan(0);expect(buildOnce(path,asOf).reusedScopes).toBeGreaterThan(0);
 const beforeDisplay=readSourceSnapshot(db,asOf).executionRefs;db.exec("UPDATE instruments SET name='Renamed' WHERE id='HK:X'");expect(readSourceSnapshot(db,asOf).executionRefs).toEqual(beforeDisplay);
 const seq=()=>Number(db.prepare('SELECT max(seq) n FROM home_source_change').get()!.n),before=seq();
 db.exec("BEGIN; UPDATE executions SET price='11' WHERE id='e'; ROLLBACK");expect(seq()).toBe(before);expect(readSourceSnapshot(db,asOf).executionRefs![0]).toEqual(old.trades[0].sourceRef);
 db.exec("UPDATE executions SET price='12' WHERE id='e'");expect(seq()).toBeGreaterThan(before);
 const changed=buildOnce(path,asOf),now=reader.readHome({...request,period:{preset:'custom',from:'2026-01-05',to:'2026-01-07'}},changed.release);
 expect(reader.readTrades(now.stamp,id).trades[0].sourceRef!.rawVersion).not.toBe(old.trades[0].sourceRef!.rawVersion);
 expect(reader.readTrades(page.stamp,id)).toEqual(old);
 const rawBefore=readSourceSnapshot(db,asOf).executionRefs![0];
 const monthly={documentId:'m',templateIds:[],reviewRequired:false,positions:[],events:[{id:'fee',accountId:'a',market:'HK',symbol:'X',currency:'HKD',date:'2026-01-06',kind:'fee',amount:'-1',description:'custody',source:[]}]};
 const history={id:'m',fileName:'m.pdf',sourceLabel:'futu',importedAt:asOf,tradeCount:0,instrumentCount:1,excludedInstrumentCount:0,excludedRecordCount:0,duplicateTradeCount:0,unresolvedInstrumentCount:0,monthly};
 const priorSeq=Number(db.prepare('SELECT max(seq) n FROM home_source_change').get()!.n);
 db.prepare('INSERT INTO import_batches(id,imported_at,reconciliation_json) VALUES(?,?,?)').run('m',asOf,JSON.stringify(history));
 expect(Number(db.prepare('SELECT max(seq) n FROM home_source_change').get()!.n)).toBeGreaterThan(priorSeq);
 const overlay=readSourceSnapshot(db,asOf).executionRefs![0];expect(overlay.rawVersion).toBe(rawBefore.rawVersion);expect(overlay.effectiveVersion).not.toBe(rawBefore.effectiveVersion);
 history.monthly.events[0].amount='-2';const beforeCorrection=Number(db.prepare('SELECT max(seq) n FROM home_source_change').get()!.n);
 db.prepare('UPDATE import_batches SET reconciliation_json=? WHERE id=?').run(JSON.stringify(history),'m');expect(Number(db.prepare('SELECT max(seq) n FROM home_source_change').get()!.n)).toBeGreaterThan(beforeCorrection);
 expect(readSourceSnapshot(db,asOf).executionRefs![0].effectiveVersion).not.toBe(overlay.effectiveVersion);
 conn.exec('BEGIN');const fixed=readSourceSnapshot(db,asOf).executionRefs![0];conn.prepare('SELECT max(seq) FROM home_source_change').get();
 db.exec("UPDATE executions SET price='13' WHERE id='e'");
 expect(new SqliteStore(conn).getExecutions()[0].price).toBe('12');conn.exec('COMMIT');expect(readSourceSnapshot(conn,asOf).executionRefs![0].rawVersion).not.toBe(fixed.rawVersion);
 db.exec("DELETE FROM executions WHERE id='e'");buildOnce(path,asOf);expect(readSourceSnapshot(db,asOf).executionRefs).toEqual([]);expect(reader.readTrades(page.stamp,id)).toEqual(old);
 }finally{conn.close();}
 }finally{db.close();rmSync(dir,{recursive:true,force:true});if(priorPath===undefined)delete process.env.TRADEREVIEW_DB_PATH;else process.env.TRADEREVIEW_DB_PATH=priorPath;}
});

import {vi} from 'vitest';
const acceptanceAsOf = '2026-01-07T15:59:59Z';
function withDatabase(check: (db: DatabaseSync, path: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'source-ref-case-'));
  const path = join(dir, 'test.sqlite');
  const previous = process.env.TRADEREVIEW_DB_PATH;
  process.env.TRADEREVIEW_DB_PATH = path;
  const db = new DatabaseSync(path);
  initializeSqlite(db);
  try {
    new SqliteStore(db).mergeExecutions([{
      id: 'e', accountId: 'a', accountLabel: 'A',
      instrument: {id: 'HK:X', symbol: 'X', name: 'X', market: 'HK', currency: 'HKD'},
      side: 'buy', executedAt: '2026-01-05T02:00:00Z', quantity: '2', price: '10', fee: '0',
      source: {platform: 'futu', row: 1, tradeNature: 'live'},
    }]);
    check(db, path);
  } finally {
    vi.restoreAllMocks();
    db.close();
    rmSync(dir, {recursive: true, force: true});
    if (previous === undefined) delete process.env.TRADEREVIEW_DB_PATH;
    else process.env.TRADEREVIEW_DB_PATH = previous;
  }
}
function published(path: string, releaseId: string) {
  const db = new DatabaseSync(path);
  try {
    const store = new HomeStore(db);
    const page = store.readHome({...request, period: {preset: 'custom', from: '2026-01-05', to: '2026-01-07'}}, releaseId);
    return store.readTrades(page.stamp, page.holdings.rows[0].id);
  } finally { db.close(); }
}
function writeMonthly(db: DatabaseSync, accountId: string, symbol: string, amount: string) {
  const history = {
    id: 'monthly', fileName: 'monthly.pdf', sourceLabel: 'futu', importedAt: acceptanceAsOf,
    tradeCount: 0, instrumentCount: 1, excludedInstrumentCount: 0, excludedRecordCount: 0,
    duplicateTradeCount: 0, unresolvedInstrumentCount: 0,
    monthly: {documentId: 'monthly', templateIds: [], reviewRequired: false, positions: [], events: [{
      id: 'fee', accountId, market: 'HK', symbol, currency: 'HKD', date: '2026-01-06',
      kind: 'fee', amount, description: 'custody', source: [],
    }]},
  };
  db.prepare(`INSERT INTO import_batches(id,imported_at,reconciliation_json) VALUES('monthly',?,?)
    ON CONFLICT(id) DO UPDATE SET reconciliation_json=excluded.reconciliation_json`)
    .run(acceptanceAsOf, JSON.stringify(history));
}
it('publishes monthly insert and correction refs while preserving every prior stamped detail', () => {
  withDatabase((db, path) => {
    const first = buildOnce(path, acceptanceAsOf);
    const old = published(path, first.release);
    let watermark = readSourceSnapshot(db, acceptanceAsOf).sequence;
    for (const amount of ['-1', '-2']) {
      writeMonthly(db, 'a', 'X', amount);
      const snapshot = readSourceSnapshot(db, acceptanceAsOf);
      expect(snapshot.sequence).toBeGreaterThan(watermark);
      watermark = snapshot.sequence;
      const next = buildOnce(path, acceptanceAsOf);
      const detail = published(path, next.release);
      expect(detail.trades[0].sourceRef).toEqual(snapshot.executionRefs![0]);
      expect(detail.trades[0].sourceRef!.rawVersion).toBe(old.trades[0].sourceRef!.rawVersion);
      expect(detail.trades[0].sourceRef!.effectiveVersion).not.toBe(old.trades[0].sourceRef!.effectiveVersion);
      expect(published(path, first.release)).toEqual(old);
    }
  });
});
it('keeps unrelated monthly accounts and instruments outside the execution reference and trade set', () => {
  withDatabase((db, path) => {
    const first = buildOnce(path, acceptanceAsOf);
    const old = published(path, first.release);
    for (const [account, symbol] of [['other', 'X'], ['a', 'OTHER']]) {
      writeMonthly(db, account, symbol, '-5');
      const next = buildOnce(path, acceptanceAsOf);
      const detail = published(path, next.release);
      expect(detail.trades).toEqual(old.trades);
      expect(detail.tradeSetId).toBe(old.tradeSetId);
    }
  });
});
it('preserves references across persisted account label and evidence key order changes', () => {
  withDatabase((db) => {
    const old = readSourceSnapshot(db, acceptanceAsOf).executionRefs;
    const row = db.prepare("SELECT evidence_json FROM executions WHERE id='e'").get()!;
    const evidence = JSON.parse(String(row.evidence_json));
    evidence.accountLabel = 'Renamed';
    evidence.source = Object.fromEntries(Object.entries(evidence.source).reverse());
    const reordered = Object.fromEntries(Object.entries(evidence).reverse());
    db.prepare("UPDATE executions SET evidence_json=? WHERE id='e'").run(JSON.stringify(reordered));
    expect(readSourceSnapshot(db, acceptanceAsOf).executionRefs).toEqual(old);
  });
});
it('keeps legacy published details without invented refs after a production upgrade', () => {
  withDatabase((db, path) => {
    const source = readSourceSnapshot(db, acceptanceAsOf);
    delete source.executionRefs;
    const legacy = buildRelease(source, 'legacy-case');
    const store = new HomeStore(db);
    store.stage(legacy); store.publish(legacy.id, null);
    const before = published(path, legacy.id);
    expect(before.trades[0]).not.toHaveProperty('sourceRef');
    buildOnce(path, acceptanceAsOf);
    expect(published(path, legacy.id)).toEqual(before);
  });
});
it('pins production snapshot watermark and refs when a WAL writer commits immediately after watermark read', () => {
  withDatabase((db, path) => {
    const before = readSourceSnapshot(db, acceptanceAsOf);
    const writer = new DatabaseSync(path);
    const prepare = db.prepare.bind(db);
    let injected = false;
    const spy = vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const statement = prepare(sql);
      if (sql === 'SELECT coalesce(max(seq),0) n FROM home_source_change') {
        const get = statement.get.bind(statement);
        vi.spyOn(statement, 'get').mockImplementation(() => {
          const value = get();
          writer.exec("UPDATE executions SET price='99' WHERE id='e'");
          injected = true;
          return value;
        });
      }
      return statement;
    });
    try {
      const pinned = readSourceSnapshot(db, acceptanceAsOf);
      spy.mockRestore();
      expect(injected).toBe(true);
      expect(pinned.sequence).toBe(before.sequence);
      expect(pinned.executions[0].price).toBe('10');
      expect(pinned.executionRefs).toEqual(before.executionRefs);
      const after = readSourceSnapshot(db, acceptanceAsOf);
      expect(after.sequence).toBeGreaterThan(pinned.sequence);
      expect(after.executions[0].price).toBe('99');
      expect(after.executionRefs![0].rawVersion).not.toBe(pinned.executionRefs![0].rawVersion);
    } finally { spy.mockRestore(); writer.close(); }
  });
});
