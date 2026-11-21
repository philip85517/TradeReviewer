import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,expect,it,vi} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {SQLITE_MIGRATIONS} from '../../../db/sqlite-schema';
const cleanups:(()=>void)[]=[];
afterEach(()=>{while(cleanups.length)cleanups.pop()!();});
it('upgrades a real version20 database to immutable pairing storage',()=>{
 const directory=mkdtempSync(join(tmpdir(),'pairing-'));const path=join(directory,'test.sqlite');
 const previous=process.env.TRADEREVIEW_DB_PATH;
 process.env.TRADEREVIEW_DB_PATH=path;vi.stubEnv('NODE_ENV','test');
 const db=new DatabaseSync(path);cleanups.push(()=>{db.close();rmSync(directory,{recursive:true,force:true});if(previous===undefined)delete process.env.TRADEREVIEW_DB_PATH;else process.env.TRADEREVIEW_DB_PATH=previous;vi.unstubAllEnvs();});
 db.exec('CREATE TABLE schema_migrations(version integer primary key,name text,checksum text)');
 for(const migration of SQLITE_MIGRATIONS.filter(m=>m.version<=20)){
  db.exec(migration.sql);db.prepare('INSERT INTO schema_migrations VALUES(?,?,?)').run(migration.version,migration.name,migration.checksum);
 }
 initializeSqlite(db);
 expect(db.prepare('SELECT max(version) version FROM schema_migrations').get()!.version).toBe(21);
 expect(db.prepare("SELECT name FROM sqlite_master WHERE name='home_business_pairing_revision'").get()).toBeTruthy();
});

import {BusinessPairingStore,type PairingRound,type SavePairingCommand} from './business-pairing-store';
import {readSourceSnapshot} from './source';
import {buildInterleavedRoundFinancialDiagnostic} from './interleaved-round-financial';
import {buildOnce} from '../../../scripts/home-build-entry';
const scope={accountId:'A',instrumentId:'US:X'};
const rounds:PairingRound[]=[
 {id:'first',closingExecutionIds:['s80'],pairings:[{openingExecutionId:'b50',closingExecutionId:'s80',quantity:'50'},{openingExecutionId:'b100',closingExecutionId:'s80',quantity:'30'}]},
 {id:'second',closingExecutionIds:['s70'],pairings:[{openingExecutionId:'b100',closingExecutionId:'s70',quantity:'70'}]},
];
function fixture(){
 const directory=mkdtempSync(join(tmpdir(),'pairing-')),path=join(directory,'test.sqlite');
 const previous=process.env.TRADEREVIEW_DB_PATH;
 process.env.TRADEREVIEW_DB_PATH=path;vi.stubEnv('NODE_ENV','test');
 const db=new DatabaseSync(path);initializeSqlite(db);
 cleanups.push(()=>{db.close();rmSync(directory,{recursive:true,force:true});if(previous===undefined)delete process.env.TRADEREVIEW_DB_PATH;else process.env.TRADEREVIEW_DB_PATH=previous;vi.unstubAllEnvs();});
 db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','X','US','USD')");
 const add=(id:string,side:string,quantity:string,day:number,source:Record<string,unknown>={})=>db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?)').run(id,'US:X','A',side,`2026-01-${String(day).padStart(2,'0')}T15:00:00Z`,quantity,'1','live',JSON.stringify({source:{platform:'fixture',row:day,...source},accountLabel:'A'}));
 add('b100','buy','100',2);add('b50','buy','50',3);add('s80','sell','80',4);add('s70','sell','70',5);
 const store=new BusinessPairingStore(db);
 const command=(rs=rounds):SavePairingCommand=>{const view=store.inspectScope(scope);return {scope,expectedRevision:view.revision,expectedFingerprint:view.fingerprint,confirmedBy:'trusted-test-caller',basis:'explicit two active closes',rounds:structuredClone(rs)};};
 return {db,path,store,command,add};
}
it('persists the approved two rounds, exact refs and provenance across a reopened connection',()=>{
 const {db,path,store,command}=fixture();const saved=store.save(command());
 expect(saved.status).toBe('current');expect(saved.fact!.rounds).toEqual(rounds);
 expect(saved.fact!.refs).toHaveLength(4);expect(saved.fact!.commitSequence).toBe(saved.fact!.consumedSourceSequence+1);
 const other=new DatabaseSync(path);try{initializeSqlite(other);expect(new BusinessPairingStore(other).inspectScope(scope).fact).toEqual(saved.fact);}finally{other.close();}
 expect(()=>db.exec('UPDATE home_business_pairing_revision SET revision=2')).toThrow('immutable');
 expect(()=>db.exec('DELETE FROM home_business_pairing_revision')).toThrow('immutable');
});
it('rejects stale CAS and forged fingerprint without writing any event or revision',()=>{
 const {db,store,command}=fixture();const old=command();store.save(old);const seq=readSourceSnapshot(db).sequence;
 expect(()=>store.save(old)).toThrowError(expect.objectContaining({code:'revision-conflict'}));
 expect(()=>store.save({...command(),expectedFingerprint:'fake'})).toThrowError(expect.objectContaining({code:'source-conflict'}));
 expect(readSourceSnapshot(db).sequence).toBe(seq);expect(store.readRevision(scope,2)).toBeNull();
});
it.each([
 ['LIFO',()=>{const r=structuredClone(rounds);r[0].pairings=[{openingExecutionId:'b100',closingExecutionId:'s80',quantity:'80'}];return r;}],
 ['cross-round consumption',()=>{const r=structuredClone(rounds);r[1].pairings[0].quantity='100';return r;}],
 ['foreign source',()=>{const r=structuredClone(rounds);r[0].pairings[0].openingExecutionId='foreign';return r;}],
 ['duplicate close',()=>[rounds[0],{...rounds[0],id:'duplicate'}]],
 ['duplicate pair',()=>{const r=structuredClone(rounds);r[0].pairings.push(r[0].pairings[0]);return r;}],
] as const)('rejects %s without partial persistence',(_name,change)=>{
 const {db,store,command}=fixture(),seq=readSourceSnapshot(db).sequence;
 expect(()=>store.save(command(change()))).toThrow();
 expect(store.inspectScope(scope).revision).toBe(0);expect(readSourceSnapshot(db).sequence).toBe(seq);
});
it('counts every pending sell against inventory and permits a multi-fill active close',()=>{
 const {db,store,command,add}=fixture();
 db.exec("DELETE FROM executions WHERE id IN ('s80','s70')");add('pending','sell','110',4);add('a','sell','20',5);add('b','sell','20',6);
 const split:PairingRound[]=[{id:'split',closingExecutionIds:['a','b'],pairings:[{openingExecutionId:'b100',closingExecutionId:'a',quantity:'20'},{openingExecutionId:'b100',closingExecutionId:'b',quantity:'20'}]}];
 expect(store.save(command(split)).fact!.rounds).toHaveLength(1);
 const bad=structuredClone(split);bad[0].pairings[0].openingExecutionId='b50';expect(()=>store.save(command(bad))).toThrowError(expect.objectContaining({code:'invalid-pairing'}));
});
it.each(['edit','delete','add','unknown'] as const)('derives stale after source %s while preserving old revisions and Recall',mode=>{
 const {db,store,command,add}=fixture();db.exec("INSERT INTO recall_documents(episode_id,draft_json,updated_at)VALUES('recall','{}','fixture')");
 const saved=store.save(command()).fact;
 if(mode==='edit')db.exec("UPDATE executions SET price='2' WHERE id='b100'");
 if(mode==='delete')db.exec("DELETE FROM executions WHERE id='s70'");
 if(mode==='add')add('new','buy','1',6);
 if(mode==='unknown')add('unknown','buy','1',6,{tradeNature:'unknown'});
 expect(store.inspectScope(scope).status).toBe('stale');expect(store.readRevision(scope,1)).toEqual(saved);
 expect(db.prepare("SELECT draft_json FROM recall_documents WHERE episode_id='recall'").get()!.draft_json).toBe('{}');
 const withdrawn=store.save(command([]));expect(withdrawn.revision).toBe(2);expect(withdrawn.fact!.rounds).toEqual([]);
 expect(store.readRevision(scope,1)).toEqual(saved);
});
it.each([{timePrecision:'date-only'},{positionEffect:'open-short'},{tradingSession:'grey-market'},{historyIncomplete:['doc']},{openingPosition:{accountId:'A',market:'US',symbol:'X',phase:'opening',date:'2026-01-01',quantity:'10',source:[]}},{positionEvents:[{}]}])('rejects unsupported source %j but allows withdrawal',source=>{
 const {db,store,command}=fixture();db.prepare("UPDATE executions SET evidence_json=? WHERE id='b100'").run(JSON.stringify({source:{platform:'fixture',row:1,...source}}));
 expect(store.inspectScope(scope).status).toBe('unsupported');expect(()=>store.save(command())).toThrowError(expect.objectContaining({code:'unsupported'}));
 expect(store.save(command([])).fact!.rounds).toEqual([]);
});
it('rolls back event, revision and head when a persistence trigger fails',()=>{
 const {db,store,command}=fixture();const seq=readSourceSnapshot(db).sequence;
 db.exec("CREATE TRIGGER fail_head BEFORE INSERT ON home_business_pairing_head BEGIN SELECT RAISE(ABORT,'fixture rejection');END;");
 expect(()=>store.save(command())).toThrow('fixture rejection');expect(readSourceSnapshot(db).sequence).toBe(seq);
 expect(db.prepare('SELECT count(*) n FROM home_business_pairing_revision').get()!.n).toBe(0);expect(store.inspectScope(scope).revision).toBe(0);
});
it('rejects extra money fields and invalid confirmation metadata',()=>{
 const {store,command}=fixture();
 for(const c of [{...command(),basis:' '},{...command(),expectedRevision:-1},{...command(),grossAmount:'0'},{...command(),scope:{accountId:'all',instrumentId:'US:X'}}])expect(()=>store.save(c)).toThrowError(expect.objectContaining({code:'invalid-command'}));
});
it('reports snapshot-behind when a later confirmation is read with a source snapshot from W',()=>{
 const {db,store,command}=fixture(),source=readSourceSnapshot(db);store.save(command());
 expect(store.readAll(source)[0].status).toBe('snapshot-behind');expect(store.readAll(readSourceSnapshot(db))[0].status).toBe('current');
});
it('returns current and stale summaries from the real buildOnce consumer without rewriting facts',()=>{
 const {db,path,store,command}=fixture();store.save(command());
 expect(buildOnce(path).pairingDiagnostics[0].status).toBe('current');db.exec("UPDATE executions SET fee='1' WHERE id='b100'");
 expect(buildOnce(path).pairingDiagnostics[0]).toMatchObject({status:'stale',accountingFees:{status:'blocked',pool:null,rounds:[],sourceMoney:[]}});expect(store.inspectScope(scope).revision).toBe(1);
});
it('fences W against a real second-connection W+1 source write before BEGIN IMMEDIATE',()=>{
 const {db,path,store,command}=fixture(),c=command();const writer=new DatabaseSync(path);initializeSqlite(writer);
 const original=db.exec.bind(db);let injected=false;
 const spy=vi.spyOn(db,'exec').mockImplementation(sql=>{if(sql==='BEGIN IMMEDIATE'&&!injected){injected=true;writer.exec("UPDATE executions SET price='9' WHERE id='b100'");}return original(sql);});
 try{expect(()=>store.save(c)).toThrowError(expect.objectContaining({code:'source-conflict'}));expect(store.inspectScope(scope).revision).toBe(0);expect(db.prepare('SELECT count(*) n FROM home_business_pairing_revision').get()!.n).toBe(0);}finally{spy.mockRestore();writer.close();}
});
it('CAS rejects a real second-connection confirmation committed between snapshot and lock',()=>{
 const {db,path,store,command}=fixture(),c=command();const writer=new DatabaseSync(path);initializeSqlite(writer);
 const original=db.exec.bind(db);let injected=false;const spy=vi.spyOn(db,'exec').mockImplementation(sql=>{if(sql==='BEGIN IMMEDIATE'&&!injected){injected=true;new BusinessPairingStore(writer).save(c);}return original(sql);});
 try{expect(()=>store.save(c)).toThrowError(expect.objectContaining({code:'source-conflict'}));expect(store.inspectScope(scope).revision).toBe(1);}finally{spy.mockRestore();writer.close();}
});
it('invalidates an existing confirmation on evidence-only monthly inventory and rejects re-confirmation',()=>{
 const {db,store,command}=fixture();const first=store.save(command()).fact;
 const monthly={documentId:'month',templateIds:[],accountId:'A',positions:[{accountId:'A',market:'US',symbol:'X',phase:'opening',date:'2026-01-01',quantity:'10',source:[]}],events:[],reviewRequired:false};
 db.prepare("INSERT INTO import_batches(id,imported_at,reconciliation_json)VALUES('month','2026-01-06',?)").run(JSON.stringify({id:'month',monthly}));
 expect(store.inspectScope(scope).status).toBe('stale');expect(store.inspectScope(scope).reasons).toContain('monthly-inventory-or-event');
 expect(()=>store.save(command())).toThrowError(expect.objectContaining({code:'unsupported'}));expect(store.readRevision(scope,1)).toEqual(first);
 expect(store.save(command([])).status).toBe('unsupported');
});
it('rejects same-instant ambiguity, future opening and cross-zero sources',()=>{
 const {db,store,command}=fixture();
 db.exec("UPDATE executions SET executed_at='2026-01-02T15:00:00Z' WHERE id='b50'");expect(()=>store.save(command())).toThrowError(expect.objectContaining({code:'unsupported'}));
 db.exec("UPDATE executions SET executed_at='2026-01-06T15:00:00Z' WHERE id='b50'");expect(()=>store.save(command())).toThrowError(expect.objectContaining({code:'unsupported'}));
});
it('does not stale a confirmation for unrelated scopes or rewrite history on diagnostics',()=>{
 const {db,store,command}=fixture();store.save(command());db.exec("UPDATE instruments SET name='Display only' WHERE id='US:X'");
 const before=readSourceSnapshot(db);expect(store.readAll(before)[0].status).toBe('current');expect(readSourceSnapshot(db).sequence).toBe(before.sequence);
});
it('includes both raw and effective versions in full-scope source dependency diagnostics',()=>{
 const {db,store,command}=fixture();store.save(command());const source=readSourceSnapshot(db);
 for(const domain of ['rawVersion','effectiveVersion'] as const){
  const changed=structuredClone(source);changed.executionRefs![0][domain]='changed';
  expect(store.readAll(changed)[0].status).toBe('stale');
 }
 // An unreferenced pending buy is a member too, rather than only saved pair IDs.
 db.prepare("INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,trade_nature)VALUES('pending-buy','US:X','A','buy','2026-01-07T15:00:00Z','1','1','live')").run();
 expect(store.inspectScope(scope).status).toBe('stale');
});
it('keeps unknown quantity claims unsupported after explicit empty withdrawal',()=>{
 const {db,store,command,add}=fixture();add('unknown','buy','1',6,{tradeNature:'unknown'});
 expect(store.save(command([])).status).toBe('unsupported');db.exec("UPDATE executions SET quantity='2' WHERE id='unknown'");
 const state=store.inspectScope(scope);expect(state.status).toBe('unsupported');expect(state.reasons).toContain('unknown-source');expect(state.fact!.rounds).toEqual([]);
});
it('captures monthly events with uncertain instrument identity conservatively',()=>{
 const {db,store,command}=fixture();store.save(command());
 const monthly={documentId:'event',templateIds:[],positions:[],events:[{id:'ipo',accountId:'A',date:'2026-01-01',kind:'ipo',quantity:'10',description:'unknown allocation identity',source:[]}],reviewRequired:true};
 db.prepare("INSERT INTO import_batches(id,imported_at,reconciliation_json)VALUES('event','2026-01-06',?)").run(JSON.stringify({id:'event',monthly}));
 expect(store.inspectScope(scope).status).toBe('stale');expect(()=>store.save(command())).toThrowError(expect.objectContaining({code:'unsupported'}));
});

function aliasFixture(actualIds:string[]){
 const {db,store,path}=fixture();db.exec('DELETE FROM executions');
 for(const [i,id]of actualIds.entries()){
  db.prepare('INSERT INTO instruments(id,symbol,name,market,currency)VALUES(?,?,?,?,?)').run(id,'00999',id,'HK','HKD');
  for(const [suffix,side,day]of [['buy','buy','02'],['sell','sell','03']]as const)db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,trade_nature)VALUES(?,?,?,?,?,?,?,?)').run(`${i}-${suffix}`,id,'A',side,`2026-01-${day}T15:00:00Z`,'10','1','live');
 }
 const command=(id:string):SavePairingCommand=>{
  const scope={accountId:'A',instrumentId:id},view=store.inspectScope(scope),i=actualIds.indexOf(id);
  return {scope,expectedRevision:view.revision,expectedFingerprint:view.fingerprint,confirmedBy:'alias-test',basis:'explicit close',rounds:[{id:'close',closingExecutionIds:[`${i}-sell`],pairings:[{openingExecutionId:`${i}-buy`,closingExecutionId:`${i}-sell`,quantity:'10'}]}]};
 };
 const monthly=(evidenceInstrumentId:string,symbol='00999')=>{
  const monthly={documentId:'alias-month',templateIds:[],accountId:'A',evidenceScope:{accountId:'A',instrumentId:evidenceInstrumentId},positions:[{accountId:'A',market:'HK',symbol,phase:'opening',date:'2026-01-01',quantity:'1',source:[]}],events:[],reviewRequired:false};
  db.prepare("INSERT INTO import_batches(id,imported_at,reconciliation_json)VALUES('alias-month','2026-01-06',?)").run(JSON.stringify({id:'alias-month',monthly}));
 };
 return {db,store,path,command,monthly};
}
it.each([
 {actualIds:['HK:00999'],evidenceId:'HK:999',symbol:'00999'},
 {actualIds:['HK:999'],evidenceId:'HK:999',symbol:'00999'},
 {actualIds:['HK:00999','HK:999'],evidenceId:'HK:999',symbol:'999'},
])('invalidates every actual scope for canonical-equivalent monthly inventory $actualIds',({actualIds,evidenceId,symbol})=>{
 const {db,store,path,command,monthly}=aliasFixture(actualIds);
 const saved=actualIds.map(id=>store.save(command(id)).fact!);
 const oldCommands=actualIds.map(id=>command(id));
 monthly(evidenceId,symbol);
 expect(readSourceSnapshot(db).monthly).toHaveLength(1);
 for(const [i,id]of actualIds.entries()){
  const view=store.inspectScope({accountId:'A',instrumentId:id});
  expect(view.status).toBe('stale');expect(view.reasons).toContain('monthly-inventory-or-event');
  expect(view.fingerprint).not.toBe(saved[i].fingerprint);
  expect(()=>store.save(oldCommands[i])).toThrowError(expect.objectContaining({code:'source-conflict'}));
  expect(store.readRevision({accountId:'A',instrumentId:id},1)).toEqual(saved[i]);
 }
 expect(store.readAll(readSourceSnapshot(db)).every(d=>d.status==='stale')).toBe(true);
 expect(buildOnce(path).pairingDiagnostics.every(d=>d.status==='stale')).toBe(true);
});
it('does not attach canonical alias inventory to another security on the same account',()=>{
 const {db,store,command,monthly}=aliasFixture(['HK:00700']);
 // Actual instrument metadata, rather than ID parsing, establishes identity.
 db.exec("UPDATE instruments SET symbol='00700' WHERE id='HK:00700'");
 store.save(command('HK:00700'));monthly('HK:999');
 expect(store.inspectScope({accountId:'A',instrumentId:'HK:00700'}).status).toBe('current');
});
it('rejects an aggregated order whose later fills would supply future inventory',()=>{
 const {db,store,command}=fixture();
 const executionGroup={kind:'order',fillCount:2,quantity:'100',grossAmount:'100',fills:[
  {page:1,row:1,executedAt:'2026-01-02T15:00:00Z',quantity:'10',price:'1',grossAmount:'10'},
  {page:1,row:2,executedAt:'2026-01-06T15:00:00Z',quantity:'90',price:'1',grossAmount:'90'},
 ]};
 db.prepare("UPDATE executions SET evidence_json=? WHERE id='b100'").run(JSON.stringify({source:{platform:'futu',row:1,executionGroup}}));
 expect(store.inspectScope(scope).status).toBe('unsupported');
 expect(store.inspectScope(scope).reasons).toContain('aggregated-fill-time-unsupported');
 expect(()=>store.save(command())).toThrowError(expect.objectContaining({code:'unsupported'}));
 expect(store.save(command([])).status).toBe('unsupported');
});
it.each([
 {label:'missing fill time',fills:[{quantity:'100',price:'1',grossAmount:'100',page:1,row:1}]},
 {label:'inferred fill time',fills:[{quantity:'100',price:'1',grossAmount:'100',page:1,row:1,executedAt:'2026-01-02T15:00:00Z',timeEvidence:'inferred'}]},
 {label:'representative time mismatch',fills:[{quantity:'100',price:'1',grossAmount:'100',page:1,row:1,executedAt:'2026-01-02T16:00:00Z'}]},
 {label:'same instant single fill conservatively excluded',fills:[{quantity:'100',price:'1',grossAmount:'100',page:1,row:1,executedAt:'2026-01-02T15:00:00Z',timeEvidence:'row'}]},
])('keeps all aggregate source orders outside this slice: $label',({fills})=>{
 const {db,store,command}=fixture();const executionGroup={kind:'order',fillCount:fills.length,quantity:'100',grossAmount:'100',fills};
 db.prepare("UPDATE executions SET evidence_json=? WHERE id='b100'").run(JSON.stringify({source:{platform:'futu',row:1,executionGroup}}));
 expect(()=>store.save(command())).toThrowError(expect.objectContaining({code:'unsupported'}));
 expect(store.inspectScope(scope).reasons).toContain('aggregated-fill-time-unsupported');
});

it('accounting fees survive save, reopen and buildOnce without changing source money',()=>{
 const {db,path,store,command,add}=fixture();db.exec('DELETE FROM executions');
 add('buy','buy','100',2);add('sell','sell','40',3);
 db.exec("UPDATE executions SET fee=CASE side WHEN 'buy' THEN '1' ELSE '0.4' END");
 const original=db.prepare('SELECT * FROM executions ORDER BY id').all();
 const rs:PairingRound[]=[{id:'partial',closingExecutionIds:['sell'],pairings:[{openingExecutionId:'buy',closingExecutionId:'sell',quantity:'40'}]}];
 const saved=store.save(command(rs)).fact;
 const reopened=new DatabaseSync(path);
 try{initializeSqlite(reopened);expect(new BusinessPairingStore(reopened).readRevision(scope,1)).toEqual(saved);}finally{reopened.close();}
 expect(buildOnce(path).pairingDiagnostics[0]).toMatchObject({accountingFees:{status:'ready',universeComplete:false,rounds:[{roundId:'partial',fees:[{currency:'USD',value:'0.8'}],netPnl:null}],pool:{remaining:[{currency:'USD',value:'0.6'}]}}});
 expect(db.prepare('SELECT * FROM executions ORDER BY id').all()).toEqual(original);
});
it('accounting fees consume pending sells before attributing a later confirmed LIFO round',()=>{
 const {db,path,store,command,add}=fixture();db.exec('DELETE FROM executions');
 add('buy','buy','100',2);add('pending','sell','40',3);add('new','buy','40',4);add('confirmed','sell','50',5);
 for(const [id,fee] of [['buy','1'],['pending','0.4'],['new','2'],['confirmed','0.5']])db.prepare('UPDATE executions SET fee=? WHERE id=?').run(fee,id);
 const rs:PairingRound[]=[{id:'only-confirmed',closingExecutionIds:['confirmed'],pairings:[{openingExecutionId:'new',closingExecutionId:'confirmed',quantity:'40'},{openingExecutionId:'buy',closingExecutionId:'confirmed',quantity:'10'}]}];
 store.save(command(rs));const diagnostic=buildOnce(path).pairingDiagnostics[0].accountingFees;
 expect(diagnostic).toMatchObject({status:'ready',rounds:[{roundId:'only-confirmed',fees:[{currency:'USD',value:'1.8'}],netPnl:null}],pool:{remaining:[{currency:'USD',value:'1.3'}]}});
 expect(diagnostic.pool!.closes.find(c=>c.closingExecutionId==='pending')!.total[0].value).toBe('0.8');
 const snapshot=readSourceSnapshot(db),before=store.readAll(snapshot);
 db.exec("UPDATE executions SET fee='3' WHERE id='buy'");
 expect(store.readAll(snapshot)).toEqual(before); // No mutable source reread per scope.
 expect(buildOnce(path).pairingDiagnostics[0].accountingFees).toMatchObject({status:'blocked',pool:null,rounds:[]});
});
it('accounting fees use the moving-average pool rather than LIFO opening identities',()=>{
 const {db,path,store,command,add}=fixture();db.exec('DELETE FROM executions');
 add('b100','buy','100',2);add('b50','buy','50',3);add('s75a','sell','75',4);add('s75b','sell','75',5);
 for(const [id,fee] of [['b100','1'],['b50','2'],['s75a','0.75'],['s75b','0.75']])db.prepare('UPDATE executions SET fee=? WHERE id=?').run(fee,id);
 const rs:PairingRound[]=[{id:'first',closingExecutionIds:['s75a'],pairings:[{openingExecutionId:'b50',closingExecutionId:'s75a',quantity:'50'},{openingExecutionId:'b100',closingExecutionId:'s75a',quantity:'25'}]},{id:'second',closingExecutionIds:['s75b'],pairings:[{openingExecutionId:'b100',closingExecutionId:'s75b',quantity:'75'}]}];
 const saved=store.save(command(rs)).fact,diagnostic=buildOnce(path).pairingDiagnostics[0].accountingFees;
 expect(diagnostic.status).toBe('ready');expect(diagnostic.rounds.map(r=>r.fees)).toEqual([[{currency:'USD',value:'2.25',knownSubtotal:'2.25',reasons:[]}],[{currency:'USD',value:'2.25',knownSubtotal:'2.25',reasons:[]}]]);
 expect(diagnostic.pool!.remaining.every(a=>a.value==='0')).toBe(true);expect(store.readRevision(scope,1)).toEqual(saved);
});

it.each([false,true])('accepts proven groups through save reopen and buildOnce (multi=%s)',multi=>{
 const {db,path,store,command,add}=fixture();db.exec('DELETE FROM executions');
 add('buy','buy','100',2);add('sell','sell','40',3);
 for(const [id,quantity,price,gross,day,parts] of [
  ['buy','100','10.2','1020',2,[['40','9','360'],['60','11','660']]],
  ['sell','40','12','480',3,[['20','12','240'],['20','12','240']]],
 ] as const){
  const executedAt=`2026-01-0${day}T15:00:00Z`;
  const executionGroup={kind:'order',fillCount:2,quantity,grossAmount:gross,fills:parts.map(([quantity,price,grossAmount],i)=>({page:1,row:i+1,quantity,price,grossAmount,executedAt:multi&&i===1?executedAt.replace('15:00:00','15:00:01'):executedAt,timePrecision:'second',timeEvidence:'row'}))};
  db.prepare('UPDATE executions SET price=?,fee=?,evidence_json=? WHERE id=?').run(price,id==='buy'?'1':'0.4',JSON.stringify({source:{platform:'fixture',row:day,executionGroup}}),id);
 }
 const original=db.prepare('SELECT * FROM executions ORDER BY id').all();
 const rs:PairingRound[]=[{id:'atomic',closingExecutionIds:['sell'],pairings:[{openingExecutionId:'buy',closingExecutionId:'sell',quantity:'40'}]}];
 const saved=store.save(command(rs)).fact;
 const reopened=new DatabaseSync(path);try{expect(new BusinessPairingStore(reopened).readRevision(scope,1)).toEqual(saved);}finally{reopened.close();}
 const result=buildOnce(path).pairingDiagnostics[0];expect(result.status).toBe('current');
 expect(result.accountingFees.pool!.remaining[0].value).toBe('0.6');
 expect(result.accountingPnl.rounds).toHaveLength(1);expect(result.accountingPnl.rounds[0]).toMatchObject({gross:{value:'72'},net:{value:'71.2'},fees:[{value:'0.8'}]});
 expect(db.prepare('SELECT * FROM executions ORDER BY id').all()).toEqual(original);
 expect(saved!.dependencies).toHaveProperty(multi?'nonInterleavedExecutionGroupPolicy':'atomicExecutionGroupPolicy');
 expect(saved!.dependencies).not.toHaveProperty(multi?'atomicExecutionGroupPolicy':'nonInterleavedExecutionGroupPolicy');
 if(multi){
  add('pending','sell','1',2);
  db.exec("UPDATE executions SET executed_at='2026-01-02T15:00:00.500Z' WHERE id='pending'");
  expect(store.inspectScope(scope).status).toBe('stale');
  expect(store.inspectScope(scope).reasons).toContain('aggregated-fill-time-unsupported');
  expect(()=>store.save(command(rs))).toThrowError(expect.objectContaining({code:'unsupported'}));
  expect(store.readRevision(scope,1)).toEqual(saved);
  db.exec("DELETE FROM executions WHERE id='pending'");
 }
 for(const [id,quantity,grossAmount,netAmount,fee] of [['buy','100','900','-901','1'],['sell','40','400','399.6','0.4']]){
  const row=db.prepare('SELECT evidence_json FROM executions WHERE id=?').get(id)!;const evidence=JSON.parse(String(row.evidence_json));
  evidence.source.settlement={currency:'EUR',quantity,grossAmount,netAmount,fees:{commission:fee}};
  db.prepare('UPDATE executions SET evidence_json=? WHERE id=?').run(JSON.stringify(evidence),id);
 }
 store.save(command(rs));const cross=buildOnce(path).pairingDiagnostics[0];expect(cross.status).toBe('current');expect(cross.accountingFees.rounds[0].fees[0]).toMatchObject({currency:'EUR',value:'0.8'});expect(cross.accountingPnl.rounds[0].gross.value).toBeNull();
 const old=command(rs);const evidence=JSON.parse(String(original.find(row=>row.id==='buy')!.evidence_json));evidence.source.executionGroup.fills[0].timeEvidence='document';
 db.prepare("UPDATE executions SET evidence_json=? WHERE id='buy'").run(JSON.stringify(evidence));
 expect(buildOnce(path).pairingDiagnostics[0].status).toBe('stale');expect(()=>store.save(old)).toThrowError(expect.objectContaining({code:'source-conflict'}));
 const again=new DatabaseSync(path);try{expect(new BusinessPairingStore(again).readRevision(scope,1)).toEqual(saved);}finally{again.close();}
});


it('cross-zero diagnostics reach buildOnce without a head and track real source corrections',()=>{
 const {db,path,store,add}=fixture();db.exec('DELETE FROM executions');
 add('buy','buy','10',2);add('sell','sell','15',3);
 const original=db.prepare('SELECT * FROM executions ORDER BY id').all();
 const source=readSourceSnapshot(db),before=source.sequence;
 const firstResult=buildOnce(path).crossZeroDiagnostics;
 expect(firstResult).toHaveLength(1);const first=firstResult[0];
 expect(first).toMatchObject({policy:'source-cross-zero-quantity-v1',scope,status:'candidate',sourceSequence:before,startingInventory:'assumed-zero',financialAllocation:'not-implemented',universeComplete:false,crossing:{executionId:'sell',sourceQuantity:'15',closeLongQuantity:'10',openShortQuantity:'5',contentRef:source.executionRefs!.find(r=>r.executionId==='sell')}});
 expect(db.prepare('SELECT count(*) n FROM home_business_pairing_head').get()!.n).toBe(0);
 expect(db.prepare('SELECT * FROM executions ORDER BY id').all()).toEqual(original);
 db.exec("UPDATE executions SET quantity='12' WHERE id='sell'");
 const second=buildOnce(path).crossZeroDiagnostics[0];
 expect(second.crossing).toMatchObject({sourceQuantity:'12',closeLongQuantity:'10',openShortQuantity:'2'});
 expect(second.fingerprint).not.toBe(first.fingerprint);expect(second.crossing!.contentRef).not.toEqual(first.crossing!.contentRef);
 expect(store.readCrossZeroDiagnostics(source)[0]).toEqual(first);
});


import {executionContentVersion} from './execution-content-ref';
it('cross-zero diagnostics preserve strict refs and full fractional ordering without database reads',()=>{
 const {db,store,add}=fixture();db.exec('DELETE FROM executions');add('buy','buy','10',2);add('sell','sell','15',3);
 const snapshot=readSourceSnapshot(db);
 const refresh=(source:typeof snapshot)=>{for(const e of source.executions)source.executionRefs!.find(r=>r.executionId===e.id)!.effectiveVersion=executionContentVersion(e,'effective');return source;};
 const diagnose=(source:typeof snapshot)=>store.readCrossZeroDiagnostics(source)[0];
 const original=diagnose(snapshot);
 const reversed=structuredClone(snapshot);reversed.executions.reverse();reversed.executionRefs!.reverse();reversed.sequence++;
 expect(diagnose(reversed)).toMatchObject({status:'candidate',fingerprint:original.fingerprint,sourceSequence:reversed.sequence});
 const sub=structuredClone(snapshot);
 sub.executions.find(e=>e.id==='buy')!.executedAt='2026-01-02T15:00:00.0001Z';
 sub.executions.find(e=>e.id==='sell')!.executedAt='2026-01-02T10:00:00.0002-05:00';
 sub.executions.reverse();expect(diagnose(refresh(sub)).status).toBe('candidate');
 const same=structuredClone(sub);same.executions.find(e=>e.id==='sell')!.executedAt='2026-01-02T10:00:00.000100-05:00';
 expect(diagnose(refresh(same))).toMatchObject({status:'blocked',crossing:null,reasons:expect.arrayContaining(['source-ambiguous-time'])});
 const duplicate=structuredClone(snapshot);duplicate.executionRefs!.push({...duplicate.executionRefs![0]});
 expect(diagnose(duplicate)).toMatchObject({status:'blocked',crossing:null,reasons:expect.arrayContaining(['duplicate-content-ref'])});
 expect(diagnose(duplicate).fingerprint).not.toBe(original.fingerprint);
 for(const change of [
  (s:typeof snapshot)=>{s.executionRefs!.pop();},
  (s:typeof snapshot)=>{s.executionRefs![0].effectiveVersion='forged';},
  (s:typeof snapshot)=>{s.executionRefs![0].rawVersion='forged';},
  (s:typeof snapshot)=>{s.executions[0].accountId='other';},
  (s:typeof snapshot)=>{s.executions[0].accountId='all';},
  (s:typeof snapshot)=>{s.executions[1].source.positionEffect='close-long';refresh(s);},
  (s:typeof snapshot)=>{s.executions[0].source.executionGroup={kind:'order',fillCount:1,quantity:'10',grossAmount:'10',fills:[]};refresh(s);},
  (s:typeof snapshot)=>{s.executions[0].source.timeEvidence='inferred';refresh(s);},
  (s:typeof snapshot)=>{s.executions[0].executedAt='2026-02-30T15:00:00Z';refresh(s);},
  (s:typeof snapshot)=>{s.executions.push({...s.executions[0],id:'pending',executedAt:'2026-01-04T15:00:00Z'});s.executionRefs!.push({...s.executionRefs![0],executionId:'pending',effectiveVersion:executionContentVersion(s.executions[2],'effective')});},
 ]){const changed=structuredClone(snapshot);change(changed);expect(store.readCrossZeroDiagnostics(changed).some(d=>d.status==='candidate')).toBe(false);expect(store.readCrossZeroMoneyDiagnostics(changed).every(d=>d.status!=='allocated'&&d.crossing===null)).toBe(true);}
 const frozen=structuredClone(snapshot),spy=vi.spyOn(db,'prepare').mockImplementation(()=>{throw Error('unexpected database read');});
 try{expect(diagnose(snapshot)).toEqual(original);expect(snapshot).toEqual(frozen);}finally{spy.mockRestore();}
});
it('cross-zero diagnostics reuse monthly alias mapping and include monthly-only and unknown-only scopes',()=>{
 const {db,store,monthly}=aliasFixture(['HK:00999','HK:999']);monthly('HK:999');
 let source=readSourceSnapshot(db);
 expect(store.readCrossZeroDiagnostics(source)).toHaveLength(2);
 expect(store.readCrossZeroDiagnostics(source).every(d=>d.status==='blocked'&&d.reasons.includes('monthly-inventory-or-event'))).toBe(true);
 source.executions=[];source.executionRefs=[];
 source.unclassified=[{accountId:'B',accountLabel:'B',instrumentId:'US:Y',market:'US',knownAt:'2026-01-01T00:00:00Z'}];
 const diagnostics=store.readCrossZeroDiagnostics(source);
 expect(diagnostics.map(d=>d.scope)).toEqual([{accountId:'A',instrumentId:'HK:00999'},{accountId:'A',instrumentId:'HK:999'},{accountId:'B',instrumentId:'US:Y'}]);
 expect(diagnostics.every(d=>d.status==='blocked'&&d.crossing===null)).toBe(true);
 expect(store.readCrossZeroMoneyDiagnostics(source).map(d=>({scope:d.scope,status:d.status,crossing:d.crossing}))).toEqual(diagnostics.map(d=>({scope:d.scope,status:'blocked',crossing:null})));
 const changed=structuredClone(source);changed.monthly[0].positions[0].quantity='2';
 expect(store.readCrossZeroDiagnostics(changed)[0].fingerprint).not.toBe(diagnostics[0].fingerprint);
 source=readSourceSnapshot(db);source.monthly=[{documentId:'ambiguous',templateIds:[],positions:[],events:[],historyIncomplete:true,reviewRequired:true}];
 expect(store.readCrossZeroDiagnostics(source).every(d=>d.status==='blocked')).toBe(true);
});
it('cross-zero diagnostics leave ordinary eligibility, fingerprints and saved revisions unchanged',()=>{
 const {db,store,command}=fixture();const saved=store.save(command()).fact,source=readSourceSnapshot(db);
 const ordinary=store.readAll(source),before=store.inspectScope(scope),seq=source.sequence;
 expect(store.readCrossZeroDiagnostics(source)[0]).toMatchObject({status:'not-applicable',crossing:null});
 expect(store.readCrossZeroMoneyDiagnostics(source)[0]).toMatchObject({status:'not-applicable',crossing:null,costAllocation:'not-implemented'});
 expect(store.readAll(source)).toEqual(ordinary);expect(store.inspectScope(scope)).toEqual(before);expect(store.readRevision(scope,1)).toEqual(saved);
 expect(readSourceSnapshot(db).sequence).toBe(seq);
});

it('cross-zero money reaches buildOnce without a head and retains the supplied snapshot after a real correction',()=>{
 const {db,path,store,add}=fixture();db.exec('DELETE FROM executions');
 add('buy','buy','10',2);add('sell','sell','15',3,{settlement:{currency:'USD',quantity:'15',grossAmount:'180',fees:{commission:'3'},netAmount:'177'}});
 db.exec("UPDATE executions SET price='12',fee='3' WHERE id='sell'");
 const source=readSourceSnapshot(db),original=db.prepare('SELECT * FROM executions ORDER BY id').all();
 const built=buildOnce(path),first=built.crossZeroMoneyDiagnostics[0];
 expect(built.pairingDiagnostics).toEqual([]);
 expect(first).toMatchObject({policy:'source-cross-zero-money-v1',scope,status:'allocated',sourceSequence:source.sequence,quantityFingerprint:built.crossZeroDiagnostics[0].fingerprint,costAllocation:'not-implemented',startingInventory:'assumed-zero',universeComplete:false,crossing:{executionId:'sell',sourceQuantity:'15',closeLongQuantity:'10',openShortQuantity:'5'}});
 expect(first.crossing!.amounts).toEqual([
  {kind:'quote-gross',currency:'USD',sourceValue:'180',closeLongValue:'120',openShortValue:'60',status:'conserved',reasons:[]},
  {kind:'fee',currency:'USD',sourceValue:'3',closeLongValue:'2',openShortValue:'1',status:'conserved',reasons:[]},
  {kind:'settlement-gross',currency:'USD',sourceValue:'180',closeLongValue:'120',openShortValue:'60',status:'conserved',reasons:[]},
  {kind:'settlement-net',currency:'USD',sourceValue:'177',closeLongValue:'118',openShortValue:'59',status:'conserved',reasons:[]},
 ]);
 expect(db.prepare('SELECT count(*) n FROM home_business_pairing_head').get()!.n).toBe(0);
 expect(db.prepare('SELECT * FROM executions ORDER BY id').all()).toEqual(original);
 const frozen=structuredClone(source),savedFirst=structuredClone(first);
 const evidence=JSON.parse(String(original.find(row=>row.id==='sell')!.evidence_json));
 evidence.source.settlement.fees.commission='6';evidence.source.settlement.netAmount='174';
 db.prepare("UPDATE executions SET fee='6',evidence_json=? WHERE id='sell'").run(JSON.stringify(evidence));
 const corrected=readSourceSnapshot(db),before=corrected.sequence;
 const second=buildOnce(path).crossZeroMoneyDiagnostics[0];
 expect(second.crossing!.amounts[1]).toMatchObject({sourceValue:'6',closeLongValue:'4',openShortValue:'2'});
 expect(second.crossing!.amounts[3]).toMatchObject({sourceValue:'174',closeLongValue:'116',openShortValue:'58'});
 expect(second.fingerprint).not.toBe(first.fingerprint);expect(second.refs).not.toEqual(first.refs);
 expect(second.quantityFingerprint).not.toBe(first.quantityFingerprint);expect(first).toEqual(savedFirst);
 const prepare=vi.spyOn(db,'prepare').mockImplementation(()=>{throw Error('unexpected database read/write');});
 const exec=vi.spyOn(db,'exec').mockImplementation(()=>{throw Error('unexpected database exec');});
 try{expect(store.readCrossZeroMoneyDiagnostics(source)[0]).toEqual(first);expect(source).toEqual(frozen);}finally{prepare.mockRestore();exec.mockRestore();}
 expect(readSourceSnapshot(db).sequence).toBe(before);
});

it('exposes cost diagnostics from the captured snapshot without changing existing diagnostics',()=>{
 const {db,path,store,add}=fixture();db.exec('DELETE FROM executions');
 add('buy','buy','10',2);add('sell','sell','15',3);db.exec("UPDATE executions SET price='10',fee='1' WHERE id='buy'; UPDATE executions SET price='12',fee='3' WHERE id='sell'");
 const source=readSourceSnapshot(db), frozen=structuredClone(source);
 const ordinary=store.readAll(source),quantity=store.readCrossZeroDiagnostics(source),money=store.readCrossZeroMoneyDiagnostics(source);
 const built=buildOnce(path),first=built.crossZeroCostDiagnostics[0];
 expect(ordinary).toEqual([]);expect(built.pairingDiagnostics).toEqual(ordinary);
 expect(built.crossZeroDiagnostics).toEqual(quantity);expect(built.crossZeroMoneyDiagnostics).toEqual(money);
 expect(first).toMatchObject({scope,status:'ready',quantityFingerprint:quantity[0].fingerprint,moneyFingerprint:money[0].fingerprint,closeLong:{quantity:'10',cost:{value:'100'},gross:{value:'20'},net:{value:'17'}}});
 db.exec("UPDATE executions SET fee='6' WHERE id='sell'");
 const corrected=readSourceSnapshot(db),second=buildOnce(path).crossZeroCostDiagnostics[0];
 expect(second.fingerprint).not.toBe(first.fingerprint);expect(second.closeLong!.net.value).toBe('15');
 const prepare=vi.spyOn(db,'prepare').mockImplementation(()=>{throw Error('unexpected database read/write');});
 const exec=vi.spyOn(db,'exec').mockImplementation(()=>{throw Error('unexpected database exec');});
 try{expect(store.readCrossZeroCostDiagnostics(source)[0]).toEqual(first);expect(source).toEqual(frozen);expect(store.readCrossZeroCostDiagnostics(corrected)[0]).toEqual(second);}finally{prepare.mockRestore();exec.mockRestore();}
});

// Real SQLite parents enter through source exactly as production reads them.
function interleavedFixture(sample:'A'|'B'='A'){
 const f=fixture();f.db.exec('DELETE FROM executions');
 const time=(n:number)=>`2026-01-02T15:00:0${n}Z`;
 const rows=sample==='A'?[['b','buy','10','16','1',1],['s1','sell','2','15','0.2',2],['s2','sell','8','25','0.8',4]] as const:[['b','buy','10','10','1',1],['s','sell','10','21','1',2],['b2','buy','6','20','0.6',3]] as const;
 for(const [id,side,q,price,fee,n] of rows){f.add(id,side,q,2,{timePrecision:'second',timeEvidence:'row'});f.db.prepare('UPDATE executions SET executed_at=?,price=?,fee=? WHERE id=?').run(time(n),price,fee,id);}
 const id=sample==='A'?'b':'s',parts=sample==='A'?[['4','10','40',1],['6','20','120',3]] as const:[['4','15','60',2],['6','25','150',4]] as const;
 const executionGroup={kind:'order',fillCount:2,quantity:'10',grossAmount:sample==='A'?'160':'210',fills:parts.map(([quantity,price,grossAmount,n],i)=>({page:1,row:10+i,quantity,price,grossAmount,executedAt:time(n),timePrecision:'second',timeEvidence:'row'}))};
 f.db.prepare('UPDATE executions SET evidence_json=? WHERE id=?').run(JSON.stringify({source:{platform:'fixture',row:2,timePrecision:'second',timeEvidence:'row',executionGroup}}),id);
 return f;
}
it.each(['A','B'] as const)('interleaved accounting reads complete SQLite sample %s without a saved head or source writes',sample=>{
 const {db,store}=interleavedFixture(sample),source=readSourceSnapshot(db),sourceBefore=JSON.stringify(source),rows=db.prepare('SELECT * FROM executions ORDER BY id').all();
 const old={pairing:store.readAll(source),quantity:store.readCrossZeroDiagnostics(source),money:store.readCrossZeroMoneyDiagnostics(source),cost:store.readCrossZeroCostDiagnostics(source)};
 const result=store.readInterleavedAccountingDiagnostics(source);
 expect(result).toHaveLength(1);expect(result[0].reasons).toEqual([]);expect(result[0]).toMatchObject({scope,status:'ready',sourceSequence:source.sequence,universeComplete:false,startingInventory:'assumed-zero'});
 expect(result[0].closes.map(c=>({id:c.executionId,q:c.quantity,cost:c.cost.value,gross:c.gross.value,net:c.net.value,entry:c.entryFees[0].value,exit:c.exitFees[0].value}))).toEqual(sample==='A'?[{id:'s1',q:'2',cost:'20',gross:'10',net:'9.6',entry:'0.2',exit:'0.2'},{id:'s2',q:'8',cost:'140',gross:'60',net:'58.4',entry:'0.8',exit:'0.8'}]:[{id:'s',q:'10',cost:'130',gross:'80',net:'78',entry:'1',exit:'1'}]);
 expect(result[0].remainingFees[0].value).toBe(sample==='A'?'0':'0.6');
 expect(result[0].refs).toEqual(expect.arrayContaining(source.executionRefs!));
 expect(db.prepare('SELECT count(*) n FROM home_business_pairing_head').get()!.n).toBe(0);
 expect(db.prepare('SELECT * FROM executions ORDER BY id').all()).toEqual(rows);expect(JSON.stringify(source)).toBe(sourceBefore);
 expect({pairing:store.readAll(source),quantity:store.readCrossZeroDiagnostics(source),money:store.readCrossZeroMoneyDiagnostics(source),cost:store.readCrossZeroCostDiagnostics(source)}).toEqual(old);
});
it('interleaved accounting binds corrected parent content and never rereads its supplied snapshot',()=>{
 const {db,store}=interleavedFixture(),source=readSourceSnapshot(db),first=store.readInterleavedAccountingDiagnostics(source)[0],before=JSON.stringify(first);
 const evidence=JSON.parse(String(db.prepare("SELECT evidence_json FROM executions WHERE id='b'").get()!.evidence_json));
 evidence.source.executionGroup.fills[1].price='25';evidence.source.executionGroup.fills[1].grossAmount='150';evidence.source.executionGroup.grossAmount='190';
 db.prepare("UPDATE executions SET price='19',evidence_json=? WHERE id='b'").run(JSON.stringify(evidence));
 const fresh=readSourceSnapshot(db),second=store.readInterleavedAccountingDiagnostics(fresh)[0];
 expect(second.reasons).toEqual([]);expect(second.status).toBe('ready');expect(second.closes[1].gross.value).toBe('30');expect(second.fingerprint).not.toBe(first.fingerprint);
 expect(store.readInterleavedAccountingDiagnostics({...fresh,executionRefs:source.executionRefs})[0].status).toBe('blocked');
 expect(store.readInterleavedAccountingDiagnostics(source)[0]).toEqual(first);expect(JSON.stringify(first)).toBe(before);
 expect(store.readInterleavedAccountingDiagnostics({...source,sequence:source.sequence+100})[0]).toEqual({...first,sourceSequence:source.sequence+100});
});
it('interleaved accounting retains missing and duplicate refs and blocks IDs duplicated across scopes',()=>{
 const {db,store}=interleavedFixture(),source=readSourceSnapshot(db);
 for(const refs of [source.executionRefs!.slice(1),[...source.executionRefs!,source.executionRefs![0]]])expect(store.readInterleavedAccountingDiagnostics({...source,executionRefs:refs})[0].status).toBe('blocked');
 const other=structuredClone(source.executions.find(e=>e.id==='b')!);other.accountId='B';
 const results=store.readInterleavedAccountingDiagnostics({...source,executions:[...source.executions,other]});
 expect(results).toHaveLength(2);for(const r of results){expect(r.status).toBe('blocked');expect(r.reasons).toContain('duplicate-execution-id');expect(r.closes).toEqual([]);}
 const duplicate=store.readInterleavedAccountingDiagnostics({...source,executions:[...source.executions,source.executions[0]]})[0];expect(duplicate.reasons).toContain('duplicate-execution-id');
});
it('interleaved accounting hashes unknown source content even when the blocking reason is unchanged',()=>{
 const {db,store,add}=interleavedFixture();add('unknown','buy','1',6,{tradeNature:'unknown'});
 const source=readSourceSnapshot(db),first=store.readInterleavedAccountingDiagnostics(source)[0];expect(first.reasons).toContain('unknown-source');
 db.exec("UPDATE executions SET executed_at='2026-01-07T15:00:00Z' WHERE id='unknown'");
 const next=store.readInterleavedAccountingDiagnostics(readSourceSnapshot(db))[0];expect(next.reasons).toEqual(first.reasons);expect(next.sourceDependencyFingerprint).not.toBe(first.sourceDependencyFingerprint);expect(next.fingerprint).not.toBe(first.fingerprint);
 expect(store.readInterleavedAccountingDiagnostics(source)[0]).toEqual(first);
});
it('interleaved accounting hashes matching and ambiguous monthly contents with stable dependency order',()=>{
 const {db,store}=interleavedFixture(),base=readSourceSnapshot(db);
 const matching={documentId:'matched',templateIds:[],accountId:'A',positions:[{accountId:'A',market:'US',symbol:'X',phase:'opening' as const,date:'2026-01-01',quantity:'10',source:[]}],events:[],reviewRequired:false};
 const ambiguous={documentId:'ambiguous',templateIds:[],accountId:'A',positions:[],events:[{id:'event',accountId:'A',date:'2026-01-01',kind:'other' as const,description:'original',source:[]}],reviewRequired:false};
 const global={documentId:'global',templateIds:[],positions:[],events:[],reviewRequired:true,historyIncomplete:true};
 const unknown=[{accountId:'A',accountLabel:'A',instrumentId:'US:X',market:'US',knownAt:'2026-01-01T00:00:00Z'},{accountId:'A',accountLabel:'A',instrumentId:'US:X',market:'US',knownAt:'2026-01-02T00:00:00Z'}];
 const source={...base,monthly:[matching,ambiguous,global],unclassified:unknown},first=store.readInterleavedAccountingDiagnostics(source)[0];
 expect(first.reasons).toEqual(expect.arrayContaining(['unknown-source','monthly-inventory-or-event']));
 expect(store.readInterleavedAccountingDiagnostics({...source,executions:[...source.executions].reverse(),executionRefs:[...source.executionRefs!].reverse(),monthly:[...source.monthly].reverse(),unclassified:[...unknown].reverse()})[0]).toEqual(first);
 for(const index of [0,1,2]){const monthly=structuredClone(source.monthly);if(index===1)monthly[index].events[0].description='corrected';else monthly[index].reviewRequired=!monthly[index].reviewRequired;const corrected=store.readInterleavedAccountingDiagnostics({...source,monthly})[0];expect(corrected.reasons).toEqual(first.reasons);expect(corrected.sourceDependencyFingerprint).not.toBe(first.sourceDependencyFingerprint);expect(corrected.fingerprint).not.toBe(first.fingerprint);}
 const unrelated={...ambiguous,accountId:'other',events:ambiguous.events.map(e=>({...e,accountId:'other'}))};expect(store.readInterleavedAccountingDiagnostics({...base,monthly:[unrelated]})[0].status).toBe('ready');
});

it('interleaved accounting requires an exact SQLite account scope while preserving the ordinary fallback',()=>{
 const {db,store}=interleavedFixture();
 for(const accountId of ['A','','all']){
  db.prepare('UPDATE executions SET account=?').run(accountId);
  const source=readSourceSnapshot(db);expect(source.executions.every(e=>e.accountId===accountId)).toBe(true);
  const result=store.readInterleavedAccountingDiagnostics(source);expect(result).toHaveLength(1);
  if(accountId==='A'){
   expect(result[0].status).toBe('ready');expect(result[0].closes.map(c=>c.gross.value)).toEqual(['10','60']);
  }else{
   expect(result[0].status).toBe('blocked');expect(result[0].reasons).toContain('invalid-scope');expect(result[0].closes).toEqual([]);
  }
 }
 const evidence=JSON.parse(String(db.prepare("SELECT evidence_json FROM executions WHERE id='b'").get()!.evidence_json));delete evidence.source.executionGroup;
 db.prepare("UPDATE executions SET evidence_json=? WHERE id='b'").run(JSON.stringify(evidence));
 expect(store.readInterleavedAccountingDiagnostics(readSourceSnapshot(db))[0].status).toBe('not-applicable');
});

function fillPairingFixture(){
 const f=interleavedFixture('B');
 const group=readSourceSnapshot(f.db).executions.find(e=>e.id==='s')!.source.executionGroup!;
 const rs:PairingRound[]=[{id:'one-active-close',closingExecutionIds:['s'],pairings:[{openingExecutionId:'b',closingExecutionId:'s',quantity:'4'},{openingExecutionId:'b2',closingExecutionId:'s',quantity:'6'}]}];
 return {...f,rs,group};
}
it('saves fill LIFO B through SQLite, reopening and buildOnce with financial attribution',()=>{
 const {db,path,store,command,rs}=fillPairingFixture();const saved=store.save(command(rs));
 expect(saved.status).toBe('current');expect(saved.fact!.policy).toBe('ordinary-live-long-fill-lifo-v1');expect(saved.fact!.rounds).toEqual(rs);
 expect(saved.refs.map(r=>r.executionId).sort()).toEqual(['b','b2','s']);
 const reopened=new DatabaseSync(path);try{const next=new BusinessPairingStore(reopened);expect(next.inspectScope(scope).fact).toEqual(saved.fact);expect(next.readAll(readSourceSnapshot(reopened))[0]).toMatchObject({status:'current',accountingPnl:{status:'ready',rounds:[{net:{value:'78'}}]}});}finally{reopened.close();}
 const summary=buildOnce(path).pairingDiagnostics[0];expect(summary.roundCount).toBe(1);
 expect(summary.accountingFees).toMatchObject({status:'ready',rounds:[{roundId:'one-active-close',fees:[{currency:'USD',value:'2'}]}]});
 expect(summary.accountingPnl).toMatchObject({status:'ready',rounds:[{roundId:'one-active-close',gross:{value:'80'},net:{value:'78'}}]});
 expect(db.prepare('SELECT count(*) n FROM executions').get()!.n).toBe(3);
});
it('atomically rejects parent-time B allocation and retains history/Recall after a fill correction',()=>{
 const {db,store,command,rs,group}=fillPairingFixture(),seq=readSourceSnapshot(db).sequence;
 const wrong=structuredClone(rs);wrong[0].pairings=[{openingExecutionId:'b',closingExecutionId:'s',quantity:'10'}];
 expect(()=>store.save(command(wrong))).toThrowError(expect.objectContaining({code:'invalid-pairing'}));expect(readSourceSnapshot(db).sequence).toBe(seq);expect(store.inspectScope(scope).revision).toBe(0);
 db.exec("INSERT INTO recall_documents(episode_id,draft_json,updated_at)VALUES('interleaved','{}','fixture')");
 const saved=store.save(command(rs)).fact!,old=command(rs);
 group.fills[1].executedAt='2026-01-06T15:00:00Z';
 db.prepare("UPDATE executions SET evidence_json=? WHERE id='s'").run(JSON.stringify({source:{platform:'fixture',row:3,timePrecision:'second',timeEvidence:'row',executionGroup:group},accountLabel:'A'}));
 expect(store.inspectScope(scope).status).toBe('stale');expect(()=>store.save(old)).toThrowError(expect.objectContaining({code:'source-conflict'}));
 expect(store.readRevision(scope,1)).toEqual(saved);expect(store.readRevision(scope,2)).toBeNull();expect(db.prepare("SELECT draft_json FROM recall_documents WHERE episode_id='interleaved'").get()!.draft_json).toBe('{}');
 const withdrawn=store.save(command([]));expect(withdrawn.status).toBe('empty');expect(withdrawn.fact!.policy).toBe('ordinary-live-long-fill-lifo-v1');expect(store.inspectScope(scope).status).toBe('empty');
 expect(()=>store.save({...old,expectedFingerprint:withdrawn.fingerprint})).toThrowError(expect.objectContaining({code:'revision-conflict'}));
});
it('confirms A with pending consumption through SQLite and rejects inventory before its fill',()=>{
 const {db,store,command}=interleavedFixture('A');
 const rs:PairingRound[]=[{id:'last-only',closingExecutionIds:['s2'],pairings:[{openingExecutionId:'b',closingExecutionId:'s2',quantity:'8'}]}];
 const saved=store.save(command(rs)).fact!;expect(saved.policy).toBe('ordinary-live-long-fill-lifo-v1');expect(saved.rounds).toEqual(rs);
 db.exec("UPDATE executions SET quantity='5' WHERE id='s1'");const seq=readSourceSnapshot(db).sequence;
 expect(store.inspectScope(scope).reasons).toContain('negative-inventory');expect(()=>store.save(command(rs))).toThrowError(expect.objectContaining({code:'unsupported'}));
 expect(readSourceSnapshot(db).sequence).toBe(seq);expect(store.readRevision(scope,1)).toEqual(saved);expect(store.readRevision(scope,2)).toBeNull();
 expect(store.save(command([])).status).toBe('unsupported');
});
it('uses the original ref multiset and global ID counts on the saved fill policy',()=>{
 const {db,store,command,rs}=fillPairingFixture();const fact=store.save(command(rs)).fact!,source=readSourceSnapshot(db);
 const missing={...source,executionRefs:source.executionRefs!.slice(1)};
 const duplicate={...source,executionRefs:[...source.executionRefs!,source.executionRefs![0]]};
 const other=structuredClone(source.executions[0]);other.accountId='foreign';
 for(const changed of [missing,duplicate,{...source,executions:[...source.executions,other]}]){
  const row=store.readAll(changed)[0];expect(row.status).toBe('stale');expect(row.reasons).toContain('aggregated-fill-time-unsupported');expect(row.accountingFees.rounds).toEqual([]);
 }
 expect(store.readAll({...source,executions:[...source.executions,other]})[0].reasons).toContain('duplicate-execution-id');
 expect(store.readAll({...source,unclassified:[{accountId:'A',accountLabel:'A',instrumentId:'US:X',market:'US',knownAt:'2026-01-01T00:00:00Z'}]})[0].reasons).toContain('unknown-source');
 const monthly={documentId:'block',templateIds:[],accountId:'A',positions:[{accountId:'A',market:'US',symbol:'X',phase:'opening' as const,date:'2026-01-01',quantity:'1',source:[]}],events:[],reviewRequired:false};
 expect(store.readAll({...source,monthly:[monthly]})[0].reasons).toContain('monthly-inventory-or-event');
 expect(store.readAll({...source,monthly:[{...monthly,accountId:'other',positions:monthly.positions.map(p=>({...p,accountId:'other'}))}]})[0].status).toBe('current');
 expect(store.readRevision(scope,1)).toEqual(fact);
});

it('binds A round finances to immutable versions through correction, reconfirmation and withdrawal',()=>{
 const {db,path,store,command,add}=interleavedFixture('A');
 const rs:PairingRound[]=[{id:'last-only',closingExecutionIds:['s2'],pairings:[{openingExecutionId:'b',closingExecutionId:'s2',quantity:'8'}]}];
 const saved=store.save(command(rs)),oldSource=readSourceSnapshot(db),sourceBefore=JSON.stringify(oldSource);
 const independent=store.readInterleavedAccountingDiagnostics(oldSource)[0];
 const oldInput={scope,sourceSequence:oldSource.sequence,refs:oldSource.executionRefs!,sourceIssues:[],sourceDependencyFingerprint:independent.sourceDependencyFingerprint};
 const original=store.readAll(oldSource)[0];
 expect(original).toMatchObject({status:'current',accountingFees:{status:'ready',rounds:[{fees:[{value:'1.6'}],entryFees:[{value:'0.8'}],exitFees:[{value:'0.8'}]}]},accountingPnl:{status:'ready',rounds:[{gross:{value:'60'},net:{value:'58.4'}}]}});
 expect(buildOnce(path).pairingDiagnostics[0]).toEqual(original);
 db.exec("INSERT INTO recall_documents(episode_id,draft_json,updated_at)VALUES('round-financial','{\"note\":\"keep\"}','fixture')");
 // A new scope advances the source watermark without changing this scope proof.
 add('unrelated','buy','1',8,{timePrecision:'second',timeEvidence:'row'});
 db.exec("UPDATE executions SET account='unrelated' WHERE id='unrelated'");
 expect(store.readAll(readSourceSnapshot(db))[0]).toMatchObject({status:'current',accountingPnl:{status:'ready',rounds:[{net:{value:'58.4'}}]}});
 const evidence=JSON.parse(String(db.prepare("SELECT evidence_json FROM executions WHERE id='b'").get()!.evidence_json));
 evidence.source.executionGroup.fills[1].price='25';evidence.source.executionGroup.fills[1].grossAmount='150';evidence.source.executionGroup.grossAmount='190';
 db.prepare("UPDATE executions SET price='19',evidence_json=? WHERE id='b'").run(JSON.stringify(evidence));
 expect(store.readAll(readSourceSnapshot(db))[0]).toMatchObject({status:'stale',accountingPnl:{status:'blocked',rounds:[]}});
 expect(store.readAll(oldSource)[0]).toEqual(original);
 expect(buildInterleavedRoundFinancialDiagnostic(saved,oldSource.executions,oldInput).accountingPnl.rounds[0].net.value).toBe('58.4');
 store.save(command(rs));
 expect(buildOnce(path).pairingDiagnostics[0]).toMatchObject({revision:2,status:'current',accountingPnl:{status:'ready',rounds:[{net:{value:'28.4'}}]}});
 expect(store.readAll(oldSource)[0]).toMatchObject({status:'snapshot-behind',accountingFees:{status:'blocked',rounds:[]},accountingPnl:{status:'blocked',rounds:[]}});
 expect(store.readRevision(scope,1)).toEqual(saved.fact);
 expect(JSON.stringify(oldSource)).toBe(sourceBefore);
 expect(db.prepare("SELECT draft_json FROM recall_documents WHERE episode_id='round-financial'").get()!.draft_json).toBe('{"note":"keep"}');
 const withdrawn=store.save(command([]));expect(withdrawn.status).toBe('empty');
 expect(store.readAll(readSourceSnapshot(db))[0]).toMatchObject({status:'empty',accountingFees:{status:'blocked',rounds:[]},accountingPnl:{status:'blocked',rounds:[]}});
 expect(()=>db.exec('DELETE FROM home_business_pairing_revision')).toThrow('immutable');
});
