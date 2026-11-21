import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it,vi} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {readSourceSnapshot} from './source';
import {SqliteStore} from '../storage/sqlite-store';
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

const asOf='2026-01-08T03:00:00Z';
function insertLegacy(db:DatabaseSync,key:string|null,review:unknown,instrumentId:string|null=null){
 db.prepare('INSERT INTO reviews(episode_id,instrument_id,review_json,updated_at) VALUES(?,?,?,?)').run(key,instrumentId,JSON.stringify(review),asOf);
}
function insertRecall(db:DatabaseSync,key:string|null,draft:unknown,formal?:unknown){
 db.prepare('INSERT INTO recall_documents(episode_id,draft_json,finalized_json,updated_at) VALUES(?,?,?,?)').run(key,JSON.stringify(draft),formal===undefined?null:JSON.stringify(formal),asOf);
}

it('always returns the required empty review facts and omits cursor-only legacy rows',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  db.prepare('INSERT INTO reviews(episode_id,cursor_json,updated_at) VALUES(?,?,?)').run('cursor-only','{"bar":10}',asOf);
  expect(readSourceSnapshot(db,asOf).reviewFacts).toEqual({schemaVersion:1,legacy:[],recall:[]});
 }finally{db.close();}
});

it('preserves separate legacy identities and accepts only nested JSON booleans',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency) VALUES('HK:X','X','X','HK','HKD')");
  const cases=[
   {key:'a',json:{episodeId:'json-other',instrumentId:'json-instrument',review:{completed:true}},want:{episodeId:'json-other',instrumentId:'json-instrument',completed:true}},
   {key:'b',json:{episodeId:'  ',instrumentId:' I ',review:{completed:false}},want:{episodeId:'  ',instrumentId:' I ',completed:false}},
   {key:'c',json:{episodeId:'',instrumentId:1,completed:true,review:{completed:1}},want:{episodeId:null,instrumentId:null,completed:null}},
   {key:'d',json:{episodeId:false,instrumentId:null,review:{completed:'true'}},want:{episodeId:null,instrumentId:null,completed:null}},
   {key:'e',json:null,want:{episodeId:null,instrumentId:null,completed:null}},
   {key:'f',json:[],want:{episodeId:null,instrumentId:null,completed:null}},
   {key:'g',json:{completed:true},want:{episodeId:null,instrumentId:null,completed:null}},
  ];
  for(const c of cases)insertLegacy(db,c.key,c.json,'HK:X');
  const facts=readSourceSnapshot(db,asOf).reviewFacts.legacy;
  expect(facts).toHaveLength(cases.length);
  for(const [i,c]of cases.entries())expect(facts[i]).toEqual({storageIdentity:{episodeId:c.key,instrumentId:'HK:X'},...c.want,factVersion:expect.stringMatching(/^[a-f0-9]{64}$/)});
  expect(facts[0].factVersion).toBe('074fdc3b42bc83246fe46ea1de76015d6e0222f8c53d70595e606703701e149c');
 }finally{db.close();}
});

it('distinguishes absent formal SQL NULL from JSON null and retains formal facts after draft edits',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  insertRecall(db,'a',{episodeId:'draft-other',status:'pending'},{episodeId:'formal-other',status:'completed',completedAt:'2026-01-06T01:00:00Z',updatedAt:'2026-01-07T01:00:00Z'});
  insertRecall(db,'b',{status:'completed',completedAt:'present-without-formal'});
  insertRecall(db,'c',null,null);
  insertRecall(db,'d',[],false);
  insertRecall(db,'e',{episodeId:42,status:true},{episodeId:[],status:1,completedAt:false,updatedAt:{}});
  insertRecall(db,'f',{episodeId:' ',status:' '},{episodeId:' ',status:' ',completedAt:' ',updatedAt:' '});
  const before=readSourceSnapshot(db,asOf).reviewFacts.recall;
  expect(before.map(({factVersion,...fact})=>fact)).toEqual([
   {episodeId:'a',formal:{episodeId:'formal-other',status:'completed',completedAt:'2026-01-06T01:00:00Z',updatedAt:'2026-01-07T01:00:00Z'},draft:{episodeId:'draft-other',status:'pending'}},
   {episodeId:'b',formal:null,draft:{episodeId:null,status:'completed'}},
   ...['c','d','e'].map(episodeId=>({episodeId,formal:{episodeId:null,status:null,completedAt:null,updatedAt:null},draft:{episodeId:null,status:null}})),
   {episodeId:'f',formal:{episodeId:' ',status:' ',completedAt:' ',updatedAt:' '},draft:{episodeId:' ',status:' '}},
  ]);
  expect(before[2].factVersion).toBe('82011513e541943764a9859c210581023e522a5ab1cd510af4b5d6e13b61c9e9');
  db.exec("UPDATE recall_documents SET finalized_json=NULL WHERE episode_id='c'");
  expect(readSourceSnapshot(db,asOf).reviewFacts.recall[2].factVersion).toBe('4cbd6816c52c44c9fc95e33e260f55a5568a4b426e2ee2467db7abb3ac3934c6');
  db.prepare('UPDATE recall_documents SET draft_json=?,revision=revision+1,updated_at=? WHERE episode_id=?').run('{"episodeId":"draft-other","status":"editing"}','2026-01-08T02:00:00Z','a');
  const after=readSourceSnapshot(db,asOf).reviewFacts.recall[0];
  expect(after.formal).toEqual(before[0].formal);
  expect(after.draft.status).toBe('editing');
  expect(after.factVersion).not.toBe(before[0].factVersion);
 }finally{db.close();}
});

it('preserves an empty stored instrument FK independently of nullable JSON identities and advances its watermark',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency) VALUES('','X','X','HK','HKD')");
  insertLegacy(db,'legacy',{episodeId:'e',instrumentId:''},'');
  const before=readSourceSnapshot(db,asOf);
  expect(before.reviewFacts.legacy[0]).toMatchObject({storageIdentity:{episodeId:'legacy',instrumentId:''},instrumentId:null});
  db.exec('UPDATE reviews SET instrument_id=NULL');
  const after=readSourceSnapshot(db,asOf);
  expect(after.reviewFacts.legacy[0].storageIdentity.instrumentId).toBeNull();
  expect(after.reviewFacts.legacy[0].factVersion).not.toBe(before.reviewFacts.legacy[0].factVersion);
  expect(after.sequence).toBeGreaterThan(before.sequence);
 }finally{db.close();}
});

it('normalizes each JSON identity, status and completion field by its JSON type without trimming strings',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  const cases:[string,unknown,string|null,boolean|null][]=[
   ['text','value','value',null],['empty','',null,null],['space',' ',' ',null],
   ['zero',0,null,null],['one',1,null,null],['two',2,null,null],['fraction',1.5,null,null],
   ['true',true,null,true],['false',false,null,false],['null',null,null,null],
   ['array',[],null,null],['object',{},null,null],['string-array',['value'],null,null],
  ];
  for(const [key,value]of cases){
   insertLegacy(db,key,{episodeId:value,instrumentId:value,review:{completed:value}});
   insertRecall(db,key,{episodeId:value,status:value},{episodeId:value,status:value,completedAt:value,updatedAt:value});
  }
  const facts=readSourceSnapshot(db,asOf).reviewFacts;
  for(const [key,,text,completed]of cases){
   expect(facts.legacy.find(f=>f.storageIdentity.episodeId===key)).toMatchObject({episodeId:text,instrumentId:text,completed});
   expect(facts.recall.find(f=>f.episodeId===key)).toMatchObject({formal:{episodeId:text,status:text,completedAt:text,updatedAt:text},draft:{episodeId:text,status:text}});
  }
 }finally{db.close();}
});

it.each([
 {label:'embedded NUL',before:'same\u0000one',after:'same\u0000two'},
 {label:'leading NUL',before:'\u0000one',after:'\u0000two'},
])('preserves $label in stored episode/instrument identities and their hashes',({before:key,after:nextKey})=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  const instrument=db.prepare('INSERT INTO instruments(id,symbol,name,market,currency) VALUES(?,?,?,?,?)');
  instrument.run(key,'X','X','HK','HKD');instrument.run(nextKey,'Y','Y','HK','HKD');
  insertLegacy(db,key,{},key);insertRecall(db,key,{},{});
  const before=readSourceSnapshot(db,asOf).reviewFacts;
  expect(before.legacy[0].storageIdentity).toEqual({episodeId:key,instrumentId:key});
  expect(before.recall[0].episodeId).toBe(key);
  db.prepare('UPDATE reviews SET instrument_id=?').run(nextKey);
  const instrumentChanged=readSourceSnapshot(db,asOf).reviewFacts.legacy[0];
  expect(instrumentChanged.storageIdentity).toEqual({episodeId:key,instrumentId:nextKey});
  expect(instrumentChanged.factVersion).not.toBe(before.legacy[0].factVersion);
  db.prepare('UPDATE reviews SET episode_id=?').run(nextKey);
  db.prepare('UPDATE recall_documents SET episode_id=?').run(nextKey);
  const keysChanged=readSourceSnapshot(db,asOf).reviewFacts;
  expect(keysChanged.legacy[0].storageIdentity.episodeId).toBe(nextKey);
  expect(keysChanged.legacy[0].factVersion).not.toBe(instrumentChanged.factVersion);
  expect(keysChanged.recall[0].episodeId).toBe(nextKey);
  expect(keysChanged.recall[0].factVersion).not.toBe(before.recall[0].factVersion);
 }finally{db.close();}
});

const jsonTextFields=[
 ['reviews','review_json','episodeId'],['reviews','review_json','instrumentId'],
 ['recall_documents','finalized_json','episodeId'],['recall_documents','finalized_json','status'],
 ['recall_documents','finalized_json','completedAt'],['recall_documents','finalized_json','updatedAt'],
 ['recall_documents','draft_json','episodeId'],['recall_documents','draft_json','status'],
] as const;

it.each([
 {label:'embedded NUL',before:'same\u0000one',after:'same\u0000two'},
 {label:'leading NUL',before:'\u0000one',after:'\u0000two'},
 {label:'lone high surrogate',before:'\ud800',after:'\ud801'},
 {label:'lone low surrogate',before:'\udc00',after:'\udc01'},
])('preserves $label in every selected JSON string and distinguishes changed content hashes',({before:value,after:nextValue})=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  insertLegacy(db,'legacy',{});insertRecall(db,'recall',{},{});
  for(const [table,column,field]of jsonTextFields){
   const update=db.prepare(`UPDATE ${table} SET ${column}=?`);
   update.run(JSON.stringify({[field]:value}));
   const before=readSourceSnapshot(db,asOf).reviewFacts;
   const beforeFact=table==='reviews'?before.legacy[0]:before.recall[0];
   expect(beforeFact).toMatchObject(table==='reviews'?{[field]:value}:{[column==='draft_json'?'draft':'formal']:{[field]:value}});
   update.run(JSON.stringify({[field]:nextValue}));
   const after=readSourceSnapshot(db,asOf).reviewFacts;
   const afterFact=table==='reviews'?after.legacy[0]:after.recall[0];
   expect(afterFact).toMatchObject(table==='reviews'?{[field]:nextValue}:{[column==='draft_json'?'draft':'formal']:{[field]:nextValue}});
   expect(afterFact.factVersion).not.toBe(beforeFact.factVersion);
  }
 }finally{db.close();}
});

it('gives equivalent JSON string escapes the same selected facts and hashes',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  insertLegacy(db,'legacy',{});insertRecall(db,'recall',{},{});
  for(const [table,column,field]of jsonTextFields){
   const update=db.prepare(`UPDATE ${table} SET ${column}=?`);
   update.run(`{"${field}":"a"}`);
   const before=readSourceSnapshot(db,asOf).reviewFacts;
   update.run(`{"${field}":"\\u0061"}`);
   expect(readSourceSnapshot(db,asOf).reviewFacts).toEqual(before);
  }
 }finally{db.close();}
});

it('hashes every projected legacy field but ignores body, cursor, row time and JSON property order',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency) VALUES('HK:X','X','X','HK','HKD')");
  insertLegacy(db,'stored',{episodeId:'json',instrumentId:'I',review:{completed:true,riskManagement:'private-body'}},'HK:X');
  const original=readSourceSnapshot(db,asOf).reviewFacts.legacy[0];
  db.prepare('UPDATE reviews SET review_json=?,cursor_json=?,plan_json=?,updated_at=?').run('{"review":{"riskManagement":"other-body","completed":true},"instrumentId":"I","episodeId":"json"}','{"bar":90}','{"thesis":"plan-body"}','later');
  expect(readSourceSnapshot(db,asOf).reviewFacts.legacy[0]).toEqual(original);
  for(const sql of [
   "UPDATE reviews SET episode_id='stored-new'",
   'UPDATE reviews SET instrument_id=NULL',
   "UPDATE reviews SET review_json=json_set(review_json,'$.episodeId','changed')",
   "UPDATE reviews SET review_json=json_set(review_json,'$.instrumentId','changed')",
   "UPDATE reviews SET review_json=json_set(review_json,'$.review.completed',1)",
  ]){
   const before=readSourceSnapshot(db,asOf).reviewFacts.legacy[0];db.exec(sql);
   expect(readSourceSnapshot(db,asOf).reviewFacts.legacy[0].factVersion).not.toBe(before.factVersion);
  }
  const unknown=readSourceSnapshot(db,asOf).reviewFacts.legacy[0];
  db.exec("UPDATE reviews SET review_json=json_set(review_json,'$.review.completed',2)");
  expect(readSourceSnapshot(db,asOf).reviewFacts.legacy[0]).toEqual(unknown);
 }finally{db.close();}
});

it('hashes every projected recall field and formal presence but excludes draft body, updatedAt and revision',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  insertRecall(db,'stored',{episodeId:'draft',status:'pending'},{episodeId:'formal',status:'completed',completedAt:'done',updatedAt:'formal-time'});
  const original=readSourceSnapshot(db,asOf).reviewFacts.recall[0];
  db.exec("UPDATE recall_documents SET draft_json=json_set(draft_json,'$.updatedAt','ignored','$.working','private-body'),finalized_json=json_set(finalized_json,'$.working','formal-body'),revision=99,updated_at='later'");
  expect(readSourceSnapshot(db,asOf).reviewFacts.recall[0]).toEqual(original);
  for(const sql of [
   "UPDATE recall_documents SET episode_id='stored-new'",
   "UPDATE recall_documents SET finalized_json=json_set(finalized_json,'$.episodeId','changed')",
   "UPDATE recall_documents SET finalized_json=json_set(finalized_json,'$.status','changed')",
   "UPDATE recall_documents SET finalized_json=json_set(finalized_json,'$.completedAt','changed')",
   "UPDATE recall_documents SET finalized_json=json_set(finalized_json,'$.updatedAt','changed')",
   "UPDATE recall_documents SET draft_json=json_set(draft_json,'$.episodeId','changed')",
   "UPDATE recall_documents SET draft_json=json_set(draft_json,'$.status','changed')",
   "UPDATE recall_documents SET finalized_json='null'",
   'UPDATE recall_documents SET finalized_json=NULL',
  ]){
   const before=readSourceSnapshot(db,asOf).reviewFacts.recall[0];db.exec(sql);
   expect(readSourceSnapshot(db,asOf).reviewFacts.recall[0].factVersion).not.toBe(before.factVersion);
  }
 }finally{db.close();}
});

it.each(['reviews','recall_documents'] as const)('rejects invalid stored episode keys in %s and rolls the read transaction back',table=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  // Simulate invalid rows in an older database. Normal migrated writes already
  // reject NULL keys through the transactional event's NOT NULL constraint.
  for(const row of db.prepare("SELECT name FROM sqlite_schema WHERE type='trigger' AND tbl_name=?").all(table))db.exec(`DROP TRIGGER "${String(row.name).replaceAll('"','""')}"`);
  if(table==='reviews')insertLegacy(db,'',{review:{completed:true}});else insertRecall(db,'',{});
  expect(()=>readSourceSnapshot(db,asOf)).toThrow(/episode/i);
  db.exec('BEGIN');db.exec('ROLLBACK');
  db.exec(`DELETE FROM ${table}`);
  if(table==='reviews')insertLegacy(db,null,{});else insertRecall(db,null,{});
  expect(()=>readSourceSnapshot(db,asOf)).toThrow(/episode/i);
  db.exec(`DELETE FROM ${table}`);
  if(table==='reviews')db.exec("INSERT INTO reviews(episode_id,review_json,updated_at) VALUES(x'0102','{}','fixture')");
  else db.exec("INSERT INTO recall_documents(episode_id,draft_json,updated_at) VALUES(x'0102','{}','fixture')");
  expect(()=>readSourceSnapshot(db,asOf)).toThrow(/episode/i);
 }finally{db.close();}
});

it('projects compact review rows without transferring image, plan, cursor or working bodies or calling getReviews',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 const getReviews=vi.spyOn(SqliteStore.prototype,'getReviews').mockImplementation(()=>{throw new Error('full review rebuild forbidden');});
 try{
  const secret='image-and-text-body-'.repeat(500);
  insertLegacy(db,'legacy',{episodeId:'e',instrumentId:'i',review:{completed:true,riskManagement:secret},plan:secret,images:[secret]});
  insertRecall(db,'recall',{episodeId:'e',status:'pending',working:secret,plan:secret,images:[secret]},{episodeId:'e',status:'completed',completedAt:'done',working:secret});
  const prepare=db.prepare.bind(db),transferred:unknown[]=[];
  db.prepare=(sql:string)=>{
   const statement=prepare(sql);
   if(/\bfrom\s+(reviews|recall_documents)\b/i.test(sql)){
    const all=statement.all.bind(statement);
    statement.all=()=>{const rows=all();transferred.push(...rows);return rows;};
   }
   return statement;
  };
  const snapshot=readSourceSnapshot(db,asOf);
  expect(snapshot.reviewFacts.legacy).toHaveLength(1);expect(snapshot.reviewFacts.recall).toHaveLength(1);
  expect(transferred).toHaveLength(2);
  expect(JSON.stringify(transferred)).not.toContain('image-and-text-body-');
  expect(JSON.stringify(snapshot)).not.toContain('image-and-text-body-');
  for(const key of ['review_json','draft_json','finalized_json','cursor_json','plan_json'])expect(transferred.flatMap(row=>Object.keys(row as object))).not.toContain(key);
 }finally{getReviews.mockRestore();db.close();}
});

it('keeps metadata and review facts at watermark W while a second WAL connection commits W+1',()=>{
 const dir=mkdtempSync(join(tmpdir(),'home-source-snapshot-')),path=join(dir,'source.sqlite');
 const reader=new DatabaseSync(path);initializeSqlite(reader);const writer=new DatabaseSync(path);
 try{
  writer.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
  writer.exec("INSERT INTO instruments(id,symbol,name,market,currency,metadata_json) VALUES('HK:X','X','before','HK','HKD','{\"assetType\":\"unrecognized\"}')");
  insertLegacy(writer,'legacy',{episodeId:'json-e',review:{completed:false}});
  insertRecall(writer,'recall',{status:'pending'},{status:'completed',completedAt:'done'});
  const before=readSourceSnapshot(reader,asOf),prepare=reader.prepare.bind(reader);let committed=false;
  reader.prepare=(sql:string)=>{
   const statement=prepare(sql);
   if(sql.includes('max(seq)')){
    const get=statement.get.bind(statement);
    statement.get=()=>{
     const result=get();
     if(!committed){
      writer.exec('BEGIN IMMEDIATE');
      writer.exec("UPDATE instruments SET metadata_json='{\"assetType\":\"ETF\"}'; UPDATE reviews SET review_json='{\"episodeId\":\"json-e\",\"review\":{\"completed\":true}}'; UPDATE recall_documents SET draft_json='{\"status\":\"editing\"}'");
      writer.exec('COMMIT');committed=true;
     }
     return result;
    };
   }
   return statement;
  };
  const old=readSourceSnapshot(reader,asOf),fresh=readSourceSnapshot(reader,asOf);
  expect(committed).toBe(true);expect(old.sequence).toBe(before.sequence);
  expect(old.instruments).toEqual(before.instruments);expect(old.reviewFacts).toEqual(before.reviewFacts);
  expect(old.instruments[0]).toMatchObject({metadata:{assetType:'unrecognized'}});
  expect(fresh.sequence).toBe(old.sequence+3);
  expect(writer.prepare('SELECT entity_kind FROM home_source_change WHERE seq>? ORDER BY seq').all(old.sequence).map(row=>row.entity_kind)).toEqual(['instruments','reviews','recall_documents']);
  expect(fresh.instruments[0]).toMatchObject({metadata:{assetType:'ETF'}});
  expect(fresh.reviewFacts.legacy[0].completed).toBe(true);
  expect(fresh.reviewFacts.recall[0].draft.status).toBe('editing');
  expect(fresh.reviewFacts.recall[0].formal).toEqual(before.reviewFacts.recall[0].formal);
 }finally{writer.close();reader.close();rmSync(dir,{recursive:true,force:true});}
});
