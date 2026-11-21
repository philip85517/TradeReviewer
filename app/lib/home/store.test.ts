import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HOME_SCHEMA, HOME_REFRESH_SCHEMA } from '../../../db/home-schema';
import { HomeStore } from './store';
import { decimal } from './period';
import type { ReleaseInput, ScopeProjection } from './contracts';
import type { HomeRequest, Holding } from '../../components/homepage-preview/display-contract';

import {request,release} from './test-fixtures';
const paths: string[] = [], databases: DatabaseSync[] = [];
afterEach(() => { for (const db of databases.splice(0)) if (db.isOpen) db.close(); for (const path of paths.splice(0)) rmSync(path, { recursive: true, force: true }); });
function setup() { const dir = mkdtempSync(join(tmpdir(), 'home-read-')); paths.push(dir); const path = join(dir, 'test.sqlite'); const db = new DatabaseSync(path); databases.push(db); db.exec(HOME_SCHEMA+HOME_REFRESH_SCHEMA); return { db, path, store: new HomeStore(db) }; }

describe('durable published homepage', () => {
  it('keeps staging invisible and survives a cold database reopen with exact ranking', () => {
    const { store, db, path } = setup(); store.stage(release());
    expect(() => store.readHome(request)).toThrow(/未就绪/);
    store.publish('r1', null); db.close();
    const reopened = new DatabaseSync(path); databases.push(reopened);
    const home = new HomeStore(reopened).readHome(request);
    expect(home.metrics.net.value).toBe('10');
    expect(home.holdings.rows.map(r => r.price)).toEqual(['9007199254740993.12345678', '10', '7', '6', '5', '4', '3', '2']);
    expect(home.holdings.total).toBe(9); expect(home.snapshot.releaseId).toBe('r1');
  });
  it('serves old details after a new release, rejects a cross-scope identity, and detects expired releases', () => {
    const { store } = setup(); store.stage(release()); store.publish('r1', null);
    const home = store.readHome(request), id = home.holdings.rows[0].id;
    store.stage(release('r2', 2)); store.publish('r2', 'r1');
    expect(store.readHolding(home.stamp, id).stamp.version).toBe('r1');
    expect(store.readTrades(home.stamp, id, 0).trades[0].id).toBe(`${id}:t`);
    const other = store.readHome({ ...request, market: 'US' });
    expect(() => store.readHolding(other.stamp, id)).toThrow(/不存在/);
    expect(() => store.readHolding({ ...home.stamp, version: 'expired' }, id)).toThrow(/过期/);
  });
  it('changes only page rows on search, clamps pages, and leaves current totals independent of the period', () => {
    const { store } = setup(); store.stage(release()); store.publish('r1', null);
    const home = store.readHome({ ...request, query: '证券0', page: 99 });
    expect(home.holdings.total).toBe(1); expect(home.holdings.page).toBe(1);
    expect(home.holdings.marketValue.value).toBe('9007199254741031.12345678');
    const historical = store.readHome({ ...request, period: { preset: 'custom', from: '2026-01-01', to: '2026-01-01' } });
    expect(historical.metrics.currentMarketValue.value).toBe('9007199254741031.12345678');
    expect(historical.metrics.net.value).toBeNull();
  });
  it('refuses incomplete scope publication and cannot let an older worker overwrite the head', () => {
    const { store } = setup(); const invalid = release(); invalid.scopes.pop();
    expect(() => store.stage(invalid)).toThrow(/scope/);
    store.stage(release()); store.publish('r1', null);
    store.stage(release('r2', 2)); store.stage(release('r3', 3)); store.publish('r3', 'r1');
    expect(() => store.publish('r2', 'r1')).toThrow(/changed/);
    expect(store.readHome(request).stamp.version).toBe('r3');
  });
  it('rejects inconsistent summaries and immutable trade ID collisions', () => {
    const { store } = setup(); const inconsistent = release();
    inconsistent.scopes[0].current.buckets.CNY.market = '1';
    expect(() => store.stage(inconsistent)).toThrow(/summary/);
    store.stage(release()); store.publish('r1', null);
    const collision = release('r2', 2); collision.trades[0].trades[0].price = '99';
    expect(() => store.stage(collision)).toThrow(/collision/);
    expect(store.head()).toBe('r1');
  });
  it('resumes an interrupted trade-set batch without mutating an already published set',()=>{
    const {db,store}=setup();const input=release();const set=input.trades[0];
    db.prepare('INSERT INTO home_trade_set VALUES(?,?,?,?,?)').run(set.id,set.positionKey,1,set.trades.length,'native-daily-v2');
    expect(()=>store.stage(input)).not.toThrow();store.publish('r1',null);
    expect(store.readTrades(store.readHome(request).stamp,'a:CN:0').trades).toHaveLength(1);
  });
  it('rejects malformed decimals and a missing trade reference before publication', () => {
    const { store } = setup(); const bad = release(); bad.scopes[0].days[0].buckets.CNY.realized = 'NaN';
    expect(() => store.stage(bad)).toThrow(/decimal/);
    const orphan = release(); orphan.trades = [];
    expect(() => store.stage(orphan)).toThrow(/trade/);
  });
});
