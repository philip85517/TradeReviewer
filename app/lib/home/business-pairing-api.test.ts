import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,expect,it,vi} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {BusinessPairingStore,type PairingInspection} from './business-pairing-store';
import type {PairingCandidate,simplePairingFinancialPreviews} from './business-pairing-candidates';
import {readSourceSnapshot} from './source';
import {pairingHttp} from './business-pairing-api';
import {GET as pairingGetRoute} from '../../api/home/pairing/route';

const cleanups:(()=>void)[]=[];
afterEach(()=>{while(cleanups.length)cleanups.pop()!();});
const scope={accountId:'A',instrumentId:'US:X'};
type Reply={status:string;inspection:PairingInspection;candidates:PairingCandidate[];executions:{sourceRef:{effectiveVersion:string}}[];publication:string;financialPreviews:ReturnType<typeof simplePairingFinancialPreviews>};
const reply=async(response:Response)=>await response.json() as Reply;
function fixture(){
 const directory=mkdtempSync(join(tmpdir(),'pairing-api-')),path=join(directory,'private.sqlite');
 const previous=process.env.TRADEREVIEW_DB_PATH;
 process.env.TRADEREVIEW_DB_PATH=path;vi.stubEnv('NODE_ENV','test');
 const db=new DatabaseSync(path);initializeSqlite(db);
 cleanups.push(()=>{db.close();rmSync(directory,{recursive:true,force:true});if(previous===undefined)delete process.env.TRADEREVIEW_DB_PATH;else process.env.TRADEREVIEW_DB_PATH=previous;vi.unstubAllEnvs();});
 db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','X','US','USD')");
 for(const [id,side,quantity,day] of [['b100','buy','100',2],['b50','buy','50',3],['s80','sell','80',4],['s70','sell','70',5]])db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,'US:X','A',side,`2026-01-0${day}T15:00:00Z`,quantity,'1','0','live',JSON.stringify({source:{platform:'fixture',row:day},accountLabel:'A'}));
 const get=()=>pairingHttp(db,new Request('http://localhost/api/home/pairing?scope='+encodeURIComponent(JSON.stringify(scope))));
 const post=(body:unknown,origin='http://localhost')=>pairingHttp(db,new Request('http://localhost/api/home/pairing',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(body)}));
 return {db,path,get,post};
}
it('offers exact LIFO suggestions without declaring individual fills human actions or writing facts',async()=>{
 const {db,get}=fixture(),sequence=readSourceSnapshot(db).sequence;
 const response=await get();expect(response.status).toBe(200);const view=await reply(response);
 expect(view.status).toBe('pending');expect(view.inspection.revision).toBe(0);
 expect(view.candidates).toEqual([
  {id:'s80',closingExecutionIds:['s80'],manualConfirmationRequired:true,pairings:[{openingExecutionId:'b50',closingExecutionId:'s80',quantity:'50'},{openingExecutionId:'b100',closingExecutionId:'s80',quantity:'30'}]},
  {id:'s70',closingExecutionIds:['s70'],manualConfirmationRequired:true,pairings:[{openingExecutionId:'b100',closingExecutionId:'s70',quantity:'70'}]},
 ]);
 expect(view.executions).toHaveLength(4);expect(view.executions[0].sourceRef.effectiveVersion).toBeTruthy();
 expect(readSourceSnapshot(db).sequence).toBe(sequence);expect(new BusinessPairingStore(db).inspectScope(scope).fact).toBeNull();
});
it('requires explicit confirmation and preserves a human multi-fill action through save and reopen',async()=>{
 const {db,path,get,post}=fixture(),view=await reply(await get());
 const body={schema:'home-pairing-v1',scope,expectedRevision:view.inspection.revision,expectedFingerprint:view.inspection.fingerprint,confirmed:true,basis:'已核对原成交，这两笔卖出属于同一次主动平仓',rounds:[{id:'manual-close',closingExecutionIds:['s80','s70']}]};
 expect((await post({...body,confirmed:false})).status).toBe(400);
 expect((await post({...body,basis:' '})).status).toBe(400);
 expect((await post(null)).status).toBe(400);
 const response=await post(body);expect(response.status).toBe(200);const saved=await reply(response);
 expect(saved.publication).toBe('pending');expect(saved.inspection.fact!.rounds).toHaveLength(1);expect(saved.inspection.fact!.rounds[0].pairings).toHaveLength(3);
 const other=new DatabaseSync(path);try{expect(new BusinessPairingStore(other).inspectScope(scope).fact).toEqual(saved.inspection.fact);}finally{other.close();}
 const reopened=await reply(await get());expect(reopened.candidates).toEqual([]);expect(reopened.financialPreviews).toEqual([]);
 expect((await post(body)).status).toBe(409);expect(new BusinessPairingStore(db).inspectScope(scope).revision).toBe(1);
});
it('rejects an observed candidate after source correction without writing a confirmation',async()=>{
 const {db,get,post}=fixture(),view=await reply(await get());
 db.exec("UPDATE executions SET price='2' WHERE id='b100'");
 const response=await post({schema:'home-pairing-v1',scope,expectedRevision:0,expectedFingerprint:view.inspection.fingerprint,confirmed:true,basis:'checked',rounds:[{id:'first',closingExecutionIds:['s80']}]});
 expect(response.status).toBe(409);expect(new BusinessPairingStore(db).inspectScope(scope).revision).toBe(0);
});
it('keeps a source with initial inventory or short direction blocked instead of proposing invented openings',async()=>{
 const {db,get,post}=fixture();db.prepare("UPDATE executions SET evidence_json=? WHERE id='b100'").run(JSON.stringify({source:{platform:'fixture',row:2,positionEffect:'open-short'}}));
 const view=await reply(await get());expect(view.status).toBe('blocked');expect(view.candidates).toEqual([]);expect(view.inspection.reasons).toContain('unsupported-inventory-or-direction');
 const response=await post({schema:'home-pairing-v1',scope,expectedRevision:0,expectedFingerprint:view.inspection.fingerprint,confirmed:true,basis:'checked',rounds:[{id:'first',closingExecutionIds:['s80']}]});
 expect(response.status).toBe(422);expect(new BusinessPairingStore(db).inspectScope(scope).revision).toBe(0);
});
it('rejects foreign-origin confirmation, mixed-account scope and caller-supplied allocations',async()=>{
 const {db,get,post}=fixture(),view=await reply(await get());
 const body={schema:'home-pairing-v1',scope,expectedRevision:0,expectedFingerprint:view.inspection.fingerprint,confirmed:true,basis:'checked',rounds:[{id:'first',closingExecutionIds:['s80']}]};
 expect((await post(body,'https://foreign.example')).status).toBe(403);
 expect((await post({...body,scope:{...scope,accountId:'all'}})).status).toBe(400);
 expect((await post({...body,rounds:[{...body.rounds[0],pairings:[]}]})).status).toBe(400);
 expect(new BusinessPairingStore(db).inspectScope(scope).revision).toBe(0);
});
it('offers the IREN financial preview as unconfirmed and withholds it when fees are unknown',async()=>{
 const {db,get}=fixture();db.exec("DELETE FROM executions WHERE id IN ('b50','s70'); UPDATE executions SET quantity='25',price=CASE side WHEN 'buy' THEN '52.42' ELSE '52.865' END,fee='2.09'");
 let view=await reply(await get());expect(view.financialPreviews[0]).toMatchObject({previewOnly:true,net:{currency:'USD',value:'6.945'},fees:[{currency:'USD',value:'4.18'}]});
 expect(new BusinessPairingStore(db).inspectScope(scope).fact).toBeNull();
 db.prepare("UPDATE executions SET evidence_json=? WHERE id='s80'").run(JSON.stringify({source:{platform:'fixture',row:4,feeStatus:'unknown'}}));
 view=await reply(await get());expect(view.status).toBe('pending');expect(view.financialPreviews).toEqual([]);
});
it('retains exact decimal LIFO quantities and orders UTC offsets before suggesting sources',async()=>{
 const {db,get}=fixture();db.exec("DELETE FROM executions WHERE id='s70'; UPDATE executions SET quantity=CASE id WHEN 'b100' THEN '0.1' WHEN 'b50' THEN '0.2' ELSE '0.3' END; UPDATE executions SET executed_at='2026-01-03T00:00:00.000000001+01:00' WHERE id='b100'; UPDATE executions SET executed_at='2026-01-02T23:00:00.000000002Z' WHERE id='b50'");
 const view=await reply(await get());expect(view.status).toBe('pending');expect(view.candidates[0].pairings).toEqual([{openingExecutionId:'b50',closingExecutionId:'s80',quantity:'0.2'},{openingExecutionId:'b100',closingExecutionId:'s80',quantity:'0.1'}]);
});
it('requires new explicit confirmation after a saved source changes and keeps the prior revision immutable',async()=>{
 const {db,get,post}=fixture();let view=await reply(await get());
 const command={schema:'home-pairing-v1',scope,expectedRevision:0,expectedFingerprint:view.inspection.fingerprint,confirmed:true,basis:'checked before correction',rounds:[{id:'first',closingExecutionIds:['s80']}]};
 expect((await post(command)).status).toBe(200);const first=new BusinessPairingStore(db).readRevision(scope,1);
 db.exec("UPDATE executions SET fee='2' WHERE id='b100'");
 view=await reply(await get());expect(view.inspection.status).toBe('stale');expect(view.status).toBe('pending');expect(view.candidates).toHaveLength(2);
 expect((await post({...command,expectedRevision:1})).status).toBe(409);
 expect((await post({...command,expectedRevision:1,expectedFingerprint:view.inspection.fingerprint,basis:'explicitly rechecked corrected fee'})).status).toBe(200);
 expect(new BusinessPairingStore(db).readRevision(scope,1)).toEqual(first);expect(new BusinessPairingStore(db).inspectScope(scope).revision).toBe(2);
});
it('reads the actual GET route without schema initialization and exposes bounded original locations',async()=>{
 const {db}=fixture();
 db.prepare("UPDATE executions SET evidence_json=? WHERE id='b100'").run(JSON.stringify({source:{platform:'fixture',fileName:'/private/original/statement.pdf',sheet:'交易',page:4,row:3,statementMonth:'2026-01',unrelatedSecret:'not-for-response'}}));
 db.exec('DROP TABLE schema_migrations');
 const response=await pairingGetRoute(new Request('http://localhost/api/home/pairing?scope='+encodeURIComponent(JSON.stringify(scope))));
 expect(response.status).toBe(200);const value=await response.json() as {executions:{id:string;origin:unknown}[]};
 expect(value.executions.find(e=>e.id==='b100')!.origin).toEqual({platform:'fixture',fileName:'statement.pdf',sheet:'交易',page:4,row:3,statementMonth:'2026-01'});
 expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='schema_migrations'").get()).toBeUndefined();
});
