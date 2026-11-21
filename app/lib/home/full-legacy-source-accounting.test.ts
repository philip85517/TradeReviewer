import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect,it} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {BusinessPairingStore} from './business-pairing-store';
import {readSourceSnapshot} from './source';
import {buildOnce} from '../../../scripts/home-build-entry';
import {validateFull} from './full-persistence';
import {tradeNatureOf} from '../trades/types';
import {resolvedTradeNatureOf} from '../trades/nature-resolution';

it('publishes confirmed IREN source-rule live fills after reopening without declaring their missing raw nature live',()=>{
 const directory=mkdtempSync(join(tmpdir(),'iren-source-accounting-')),path=join(directory,'private.sqlite'),previous=process.env.TRADEREVIEW_DB_PATH;
 process.env.TRADEREVIEW_DB_PATH=path;let db=new DatabaseSync(path);
 try{
  initializeSqlite(db);
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:IREN','IREN','IREN','US','USD')");
  // Actual IREN source values: no declared trade nature; the established
  // tiger/pdf/monthly-v1 provenance rule establishes live business nature.
  const buy='tiger:fb0819594496a972:7:30',sell='tiger:fb0819594496a972:7:31';
  for(const [id,side,at,price,row,gross] of [[buy,'buy','2026-01-15T16:21:49.000Z','52.42',683,'1310.5'],[sell,'sell','2026-01-22T16:36:02.000Z','52.865',726,'-1321.62']] as const){
   const source={platform:'tiger',formatRuleId:'tiger/pdf/monthly-v1',fileName:'2026-01.pdf',fileFingerprint:'fb0819594496a972',page:7,row,timePrecision:'second',sourceTimeKind:'execution',timeEvidence:'row',sourceTimezone:'US/Eastern',templateId:'tiger-nz',statementMonth:'2026-01',marketCalendarDate:at.slice(0,10),grossAmount:gross,feeStatus:'reported',...(side==='sell'?{positionEffect:'close-long'}:{})};
   db.prepare('INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,fee,trade_nature,evidence_json)VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,'US:IREN','tiger:5793572',side,at,'25',price,'2.09',null,JSON.stringify({source,accountLabel:'Tiger 账户'}));
  }
  const source=readSourceSnapshot(db,'2026-01-23T03:00:00Z');
  expect(source.executions.map(tradeNatureOf)).toEqual(['unknown','unknown']);expect(source.executions.map(resolvedTradeNatureOf)).toEqual(['live','live']);
  expect(resolvedTradeNatureOf({...source.executions[0],source:{...source.executions[0].source,tradeNature:'unknown'}})).toBe('unknown');
  const pairing=new BusinessPairingStore(db),scope={accountId:'tiger:5793572',instrumentId:'US:IREN'},observed=pairing.inspectScope(scope);
  pairing.save({scope,expectedRevision:observed.revision,expectedFingerprint:observed.fingerprint,confirmedBy:'isolated-user',basis:'checked actual two source rows',rounds:[{id:'iren-close',closingExecutionIds:[sell],pairings:[{openingExecutionId:buy,closingExecutionId:sell,quantity:'25'}]}]});
  db.close();db=new DatabaseSync(path);
  const financial=new BusinessPairingStore(db).readAll(readSourceSnapshot(db,'2026-01-23T03:00:00Z'))[0];
  expect(financial).toMatchObject({status:'current',accountingPnl:{reasons:[],rounds:[{gross:{value:'11.125'},net:{value:'6.945'},fees:[{value:'4.18'}]}]}});
  const built=buildOnce(path,'2026-01-23T03:00:00Z'),published=validateFull(db,built.release)!;
  expect(published.modules.closeRounds).toHaveLength(1);
  expect(published.modules.closeRounds[0]).toMatchObject({gross:{value:'11.13',reasons:[]},net:{value:'6.95',reasons:[]},fees:[{value:'4.18'}]});
  expect(readSourceSnapshot(db).executions.map(tradeNatureOf)).toEqual(['unknown','unknown']);
 }finally{db.close();rmSync(directory,{recursive:true,force:true});if(previous===undefined)delete process.env.TRADEREVIEW_DB_PATH;else process.env.TRADEREVIEW_DB_PATH=previous;}
});
