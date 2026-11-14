import {DatabaseSync} from 'node:sqlite';
import {expect,it} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {readSourceSnapshot} from './source';
import {fetchLatestFxSnapshot} from '../fx/provider';
import {replaceFxSnapshot} from '../fx/storage';
import {convertNative} from './period';
it('preserves provider CNY-per-unit direction through persistence and homepage conversion',async()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  const snapshot=await fetchLatestFxSnapshot({now:()=>new Date('2026-01-08T02:00:00Z'),fetcher:async()=>new Response(JSON.stringify([
   {base:'CNY',quote:'HKD',rate:1.25,date:'2026-01-07'},
   {base:'CNY',quote:'USD',rate:0.125,date:'2026-01-07'},
  ]))});
  replaceFxSnapshot(db,snapshot);
  const source=readSourceSnapshot(db,'2026-01-08T03:00:00Z');
  expect(convertNative({USD:'10',HKD:'100'},'CNY',source.currentFx).value).toBe('160');
  expect(convertNative({USD:'10',HKD:'100'},'CNY',source.historicalFx[0].rates).value).toBe('160');
 }finally{db.close();}
});
it('reads ordered raw closes with exact decimal strings and honest missing provenance',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('HK:X','X','X','HK','HKD')");
  const insert=db.prepare('INSERT INTO daily_candles(instrument_id,date,adjustment_mode,open,high,low,close,currency,provider)VALUES(?,?,?,?,?,?,?,?,?)');
  insert.run('HK:X','2026-01-07','raw','1','1','1','0.123456789012345678901','HKD','yahoo');
  insert.run('HK:X','2026-01-06','raw','1','1','1','0',null,null);
  insert.run('HK:X','2026-01-07','forward','1','1','1','999','HKD','yahoo');
  expect(readSourceSnapshot(db,'2026-01-08T01:00:00Z').candles).toEqual([
   {instrumentId:'HK:X',tradingDate:'2026-01-06',close:'0',currency:'UNKNOWN',provider:'',adjustmentMode:'raw'},
   {instrumentId:'HK:X',tradingDate:'2026-01-07',close:'0.123456789012345678901',currency:'HKD',provider:'yahoo',adjustmentMode:'raw'},
  ]);
 }finally{db.close();}
});

it('covers the background raw-price read without visiting full candle rows',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  const plan=db.prepare("EXPLAIN QUERY PLAN SELECT instrument_id,json_group_array(json_array(date,close,currency,provider) ORDER BY date) FROM daily_candles WHERE adjustment_mode='raw' GROUP BY instrument_id ORDER BY instrument_id").all();
  expect(plan.some(row=>String(row.detail).includes('USING COVERING INDEX daily_candles_home_raw'))).toBe(true);
 }finally{db.close();}
});
