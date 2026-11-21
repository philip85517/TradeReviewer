import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect,it} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {buildOnce} from '../../../scripts/home-build-entry';
import {FullHomeStore} from './full-store';
import {defaultFullRequest} from './full-contracts';

it('preserves unknown-only source coverage through actual isolated publication and current contribution read',()=>{
 const directory=mkdtempSync(join(tmpdir(),'contribution-unknown-')),path=join(directory,'private.sqlite'),previous=process.env.TRADEREVIEW_DB_PATH;
 process.env.TRADEREVIEW_DB_PATH=path;const db=new DatabaseSync(path);
 try{
  initializeSqlite(db);
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','Unknown source','US','USD'); INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES('unknown-fill','US:X','A','buy','2026-01-07T15:00:00Z','1','10','0','unknown','{}')");
  const built=buildOnce(path,'2026-01-08T03:00:00Z'),request=defaultFullRequest('2026-01-08');
  const view=new FullHomeStore(db).read(request,built.release);
  expect(view.catalogCount).toBe(0);expect(view.contribution.rows).toEqual([]);
  expect(view.contribution.coverage.universeComplete).toBe(false);
  expect(view.contribution.coverage.reasons).toContain('unknown-trading-nature');
  expect(view.contribution.net.value).toBeNull();expect(view.contribution.coverage.eligibleCount).toBe(1);
  expect(view.history.coverage.confirmedClosedCount).toBe(0);expect(view.history.coverage.universeComplete).toBe(false);
  // A known live row creates catalog/metric membership for this same scope;
  // it must not erase the other source whose trading nature remains unknown.
  db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run('known-fill','US:X','A','buy','2026-01-07T16:00:00Z','1','10','0','live',JSON.stringify({source:{platform:'fixture',row:2,positionEffect:'open-long'}}));
  const second=buildOnce(path,'2026-01-08T03:00:00Z'),mixed=new FullHomeStore(db).read(request,second.release);
  expect(mixed.catalogCount).toBe(1);expect(mixed.contribution.coverage.universeComplete).toBe(false);
  expect(mixed.contribution.coverage.reasons).toContain('unknown-trading-nature');expect(mixed.contribution.coverage.eligibleCount).toBe(1);expect(mixed.contribution.coverage.classifiedCount).toBe(0);expect(mixed.contribution.rows).toEqual([]);expect(mixed.contribution.net.value).toBeNull();
 }finally{db.close();rmSync(directory,{recursive:true,force:true});if(previous===undefined)delete process.env.TRADEREVIEW_DB_PATH;else process.env.TRADEREVIEW_DB_PATH=previous;}
});
