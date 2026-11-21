import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {afterEach, describe, expect, it} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {SQLITE_MIGRATIONS} from '../../../db/sqlite-schema';
import {readReviewFacts} from './review-facts';

const opened: DatabaseSync[] = [];
afterEach(() => opened.splice(0).forEach(db => db.close()));
function setup(upgrade = true) {
  const db = new DatabaseSync(':memory:');
  opened.push(db);
  if (upgrade) initializeSqlite(db);
  return db;
}
function instruments(db: DatabaseSync) {
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','Fixture X','US','USD'),('HK:Y','Y','Fixture Y','HK','HKD')");
}
function sequence(db: DatabaseSync) {
  return Number(db.prepare('SELECT coalesce(max(seq),0) n FROM home_source_change').get()!.n);
}
function latest(db: DatabaseSync) {
  const row = db.prepare('SELECT * FROM home_source_change ORDER BY seq DESC LIMIT 1').get()!;
  return {...row, change_json:String(row.change_json), event: JSON.parse(String(row.change_json))};
}
function execution(db: DatabaseSync, at = '2026-01-02T23:30:00-05:00', evidence: string | null = null) {
  db.prepare("INSERT INTO executions(id,instrument_id,account,side,executed_at,quantity,price,evidence_json)VALUES('exec','US:X','A','buy',?,'1','2',?)").run(at,evidence);
}
function legacy(db: DatabaseSync, value: unknown) {
  db.prepare("UPDATE reviews SET review_json=? WHERE episode_id='row-episode'").run(value === undefined ? null : JSON.stringify(value));
}
function recall(db: DatabaseSync, column: 'draft_json' | 'finalized_json', value: unknown) {
  db.prepare(`UPDATE recall_documents SET ${column}=? WHERE episode_id='recall-row'`).run(value === undefined ? null : JSON.stringify(value));
}

type ReviewTextTarget = {
  name: string;
  table: 'reviews' | 'recall_documents';
  column: 'review_json' | 'draft_json' | 'finalized_json';
  field: string;
  part?: 'formal' | 'draft';
};
const reviewTextTargets: ReviewTextTarget[] = [
  {name:'legacy.episodeId',table:'reviews',column:'review_json',field:'episodeId'},
  {name:'legacy.instrumentId',table:'reviews',column:'review_json',field:'instrumentId'},
  {name:'formal.episodeId',table:'recall_documents',column:'finalized_json',field:'episodeId',part:'formal'},
  {name:'formal.status',table:'recall_documents',column:'finalized_json',field:'status',part:'formal'},
  {name:'formal.completedAt',table:'recall_documents',column:'finalized_json',field:'completedAt',part:'formal'},
  {name:'formal.updatedAt',table:'recall_documents',column:'finalized_json',field:'updatedAt',part:'formal'},
  {name:'draft.episodeId',table:'recall_documents',column:'draft_json',field:'episodeId',part:'draft'},
  {name:'draft.status',table:'recall_documents',column:'draft_json',field:'status',part:'draft'},
];
function textTarget(target: ReviewTextTarget) {
  const db=setup();
  if (target.table==='reviews') db.exec("INSERT INTO reviews(episode_id,review_json,updated_at)VALUES('text-review','{}','fixture')");
  else db.exec("INSERT INTO recall_documents(episode_id,draft_json,finalized_json,updated_at)VALUES('text-recall','{}','{}','fixture')");
  const update=db.prepare(`UPDATE ${target.table} SET ${target.column}=?`);
  const readFact = () => {
    const facts=readReviewFacts(db);
    const {factVersion,...projection}=target.table==='reviews' ? facts.legacy[0] : facts.recall[0];
    return {factVersion,projection};
  };
  // Each boundary mutation also verifies independent reader/hash consistency.
  // Literal value and sequence assertions below still catch a shared mistake.
  const setJson = (value: string) => {
    const before=readFact(), start=sequence(db);
    update.run(value);
    const after=readFact(), delta=sequence(db)-start;
    expect(delta).toBe(before.factVersion===after.factVersion ? 0 : 1);
    if (delta===1) {
      expect(latest(db).event.before.reviewFact).toEqual(before.projection);
      expect(latest(db).event.after.reviewFact).toEqual(after.projection);
    } else expect(after).toEqual(before);
  };
  return {
    db,
    set: (value: string) => setJson(JSON.stringify({[target.field]:value})),
    setJson,
    // JSON.parse occurs in latest(): assertions check the actual persisted event
    // crossing the native SQLite/JS boundary, including OLD and NEW values.
    value: (side: 'before' | 'after') => {
      const fact=latest(db).event[side].reviewFact;
      return (target.part ? fact[target.part] : fact)[target.field];
    },
  };
}

describe('home source v2 durable events', () => {
  it('upgrades an actual v19 database without changing published migration SQL or historical events', () => {
    const baseline = [
      {
        "version": 1,
        "name": "unified-storage-schema",
        "checksum": "bf5e2a51726b8284b3e5abf4b5639db602a4792e2d6af678559aa953396eea40"
      },
      {
        "version": 2,
        "name": "preserve-repository-provenance",
        "checksum": "401b915358bb32042c4d79eed35edd18662a1cec58193b08f498d245a33938fa"
      },
      {
        "version": 3,
        "name": "preserve-api-coverage-details",
        "checksum": "1ed38012c97a6e534ffd44da7489a94a88399115f074f9807f8e6dc474806feb"
      },
      {
        "version": 4,
        "name": "audited-trade-revisions",
        "checksum": "7545b452834b42b1bb56d0b947126942749e42e72975fa4b88c7701aac32887a"
      },
      {
        "version": 5,
        "name": "persist-trade-nature-and-simulation-scope",
        "checksum": "868fc720cea02b82444dcf7874fdaaa6fa71d36cc7a7583643ce752b94225d8d"
      },
      {
        "version": 6,
        "name": "persist-localized-instrument-names",
        "checksum": "64857cafe9e22606a02cd9f8d579f2095f2e425b3b6ace3d0affa1d5c2e436ee"
      },
      {
        "version": 7,
        "name": "persist-recall-workspace-drafts-and-finalized-versions",
        "checksum": "5b45b208853e1d914b0c74bb5c9acc2b9dbe14408817bd7260c44ea822aea698"
      },
      {
        "version": 8,
        "name": "project-recall-plans-and-retained-evidence",
        "checksum": "51b4ee7565671f5331e5b8f7defd278e9b8f4dc35df52688d9e7320a67223ee3"
      },
      {
        "version": 9,
        "name": "project-current-plan-associations-and-capture-context",
        "checksum": "3a171f5f5c651c76e69d0d056e1e4b958f5cbe054efc1f5d5fafbcd79b5e4900"
      },
      {
        "version": 10,
        "name": "project-plan-revisions-sizing-and-exit-evaluations",
        "checksum": "090afc7c2043eed3b0059d869533b4ef2c8e1b1fe1b6c66391fe9adcec581147"
      },
      {
        "version": 11,
        "name": "project-explicit-current-evaluation-selection",
        "checksum": "71ad249ec789586e19e37c7f68fb4358b9564a58426d78a35c024c305e3d8ef5"
      },
      {
        "version": 12,
        "name": "project-frozen-recall-actual-metrics",
        "checksum": "1efa87843cd5da1e1e31f9d4af72536bcde9f2562c7989299e15e71df6f4e260"
      },
      {
        "version": 13,
        "name": "project-frozen-recall-manual-evaluations",
        "checksum": "5182cc3c0c82f291e8a0adf4919f29af8669e498ff1d485f7f1e0b25595f7c95"
      },
      {
        "version": 14,
        "name": "tradingview-account-migration",
        "checksum": "b71c5f174924db11a58ee1a39896919e8a061eb343e101b13ac61bd4c09de699"
      },
      {
        "version": 15,
        "name": "durable-home-read-model",
        "checksum": "96eec8dfc8474b3325b423ea76fa6fa37ae4dfaed9444abcfd4d08ba7a7197c6"
      },
      {
        "version": 16,
        "name": "invalidate-removed-home-quotes",
        "checksum": "45cb2bcb7fed7a2e60b169e58e205f74214aec75ae52f1b03774bceb7cac4d89"
      },
      {
        "version": 17,
        "name": "home-source-completion-and-fx-direction",
        "checksum": "a0f0e89617e7d6c7f46a2ca9ef4de70a371de61fb184baca31c74ecb73140494"
      },
      {
        "version": 18,
        "name": "home-object-confirmed-subtotals",
        "checksum": "2f2cea0c0b7c34b8b3865dda8a241473bad24fcdab285b7ce93cb46b468bb262"
      },
      {
        "version": 19,
        "name": "cover-home-native-closing-prices",
        "checksum": "03066fd65c7fe843a7bda7fbda2dd80725c4d7b2f56a16cab6f05823513b0834"
      }
    ];
    const published = SQLITE_MIGRATIONS.filter(m => m.version <= 19);
    expect(published.map(({version,name,checksum}) => ({version,name,checksum}))).toEqual(baseline);
    for (const m of published) expect(createHash('sha256').update(m.sql).digest('hex')).toBe(m.checksum);
    const db = setup(false);
    db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,checksum TEXT NOT NULL,applied_at TEXT DEFAULT CURRENT_TIMESTAMP)');
    for (const m of published) {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations(version,name,checksum)VALUES(?,?,?)').run(m.version,m.name,m.checksum);
    }
    db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','Fixture','US','USD')");
    db.exec("INSERT INTO home_source_change(entity_kind,entity_key,effective_from,committed_at,change_json)VALUES('clock','fixture','2026-01-01','fixture','{}')");
    const history = db.prepare('SELECT * FROM home_source_change').all();
    initializeSqlite(db);
    expect(db.prepare('SELECT max(version) n FROM schema_migrations').get()!.n).toBe(SQLITE_MIGRATIONS[SQLITE_MIGRATIONS.length - 1].version);
    expect(db.prepare('SELECT * FROM home_source_change').all()).toEqual(history);
    db.exec("UPDATE instruments SET metadata_json='{\"assetType\":\"unknown\"}'");
    expect(sequence(db)).toBe(history.length + 1);
    expect(latest(db).event).toMatchObject({schemaVersion:2, action:'UPDATE', dependencyKinds:['catalog']});
    initializeSqlite(db);
    expect(sequence(db)).toBe(history.length + 1);
  });

  it('keeps both execution identities and raw time evidence on correction, deletion and rollback', () => {
    const db = setup(); instruments(db);
    execution(db,'2026-01-02',JSON.stringify({source:{timePrecision:'date-only',sourceTimezone:'Asia/Shanghai'}}));
    expect(latest(db).event).toMatchObject({schemaVersion:2,action:'INSERT',before:null,after:{sourceTable:'executions',sourceKey:'exec',accountId:'A',instrumentId:'US:X',episodeId:null,effectiveAt:'2026-01-02',timePrecision:'date-only',sourceTimezone:'Asia/Shanghai'},tombstone:false});
    const start=sequence(db);
    db.exec("UPDATE executions SET id='corrected',account='B',instrument_id='HK:Y',executed_at='2026-01-01T23:30:00-05:00',evidence_json='{\"source\":{\"timePrecision\":\"timestamp\"}}'");
    expect(sequence(db)).toBe(start+1);
    expect(latest(db)).toMatchObject({effective_from:'0001-01-01',event:{action:'UPDATE',before:{sourceKey:'exec',accountId:'A',instrumentId:'US:X',effectiveAt:'2026-01-02',timePrecision:'date-only'},after:{sourceKey:'corrected',accountId:'B',instrumentId:'HK:Y',effectiveAt:'2026-01-01T23:30:00-05:00',timePrecision:'timestamp',sourceTimezone:null},boundary:{kind:'conservative-full'}}});
    db.exec("BEGIN; UPDATE executions SET executed_at='2026-01-10'; DELETE FROM executions; ROLLBACK"); expect(sequence(db)).toBe(start+1);
    db.exec("UPDATE executions SET executed_at='2026-01-10'"); expect(sequence(db)).toBe(start+2);
    expect(latest(db).event.before.effectiveAt).toBe('2026-01-01T23:30:00-05:00');
    db.exec('DELETE FROM executions');
    expect(sequence(db)).toBe(start+3);
    expect(latest(db).event).toMatchObject({action:'DELETE',before:{sourceKey:'corrected',accountId:'B',instrumentId:'HK:Y',effectiveAt:'2026-01-10'},after:null,tombstone:true});
  });

  it.each(['2026-01-02','2026-01-02T23:30:00-05:00','2026-01-03T00:30:00+14:00'])('never invents a business day from unknown execution timezone: %s', at => {
    const db = setup(); instruments(db); execution(db,at);
    expect(latest(db)).toMatchObject({effective_from:'0001-01-01',event:{boundary:{kind:'conservative-full'},after:{effectiveAt:at,timePrecision:null,sourceTimezone:null}}});
  });

  it.each(reviewTextTargets)('preserves leading/embedded NUL and suffix corrections for $name', target => {
    const {db,set,value}=textTarget(target);
    const start=sequence(db);
    set('\u0000lead'); expect(sequence(db)).toBe(start+1);
    expect(value('before')).toBeNull(); expect(value('after')).toBe('\u0000lead');
    set('mid\u0000tail'); expect(sequence(db)).toBe(start+2);
    expect(value('before')).toBe('\u0000lead'); expect(value('after')).toBe('mid\u0000tail');
    set('mid\u0000changed'); expect(sequence(db)).toBe(start+3);
    expect(value('before')).toBe('mid\u0000tail'); expect(value('after')).toBe('mid\u0000changed');
    set('mid\u0000changed'); expect(sequence(db)).toBe(start+3);
  });

  it.each(reviewTextTargets)('preserves distinct lone surrogate JSON scalars for $name', target => {
    const {db,set,value}=textTarget(target);
    const start=sequence(db);
    set('\ud800'); expect(sequence(db)).toBe(start+1);
    expect(value('before')).toBeNull(); expect(value('after')).toBe('\ud800');
    set('\ud801'); expect(sequence(db)).toBe(start+2);
    expect(value('before')).toBe('\ud800'); expect(value('after')).toBe('\ud801');
    set('\ud801'); expect(sequence(db)).toBe(start+2);
  });

  it.each(reviewTextTargets)('compares decoded JSON text instead of escape spelling for $name', target => {
    const {db,set,setJson,value}=textTarget(target);
    const start=sequence(db);
    set('a'); expect(sequence(db)).toBe(start+1);
    setJson(`{"${target.field}":"\\u0061"}`); expect(sequence(db)).toBe(start+1);
    set('a'); expect(sequence(db)).toBe(start+1);
    setJson(`{"${target.field}":"\\u0062"}`); expect(sequence(db)).toBe(start+2);
    expect(value('before')).toBe('a'); expect(value('after')).toBe('b');
  });

  it('captures metadata-only catalog changes without invalidating for an unchanged row', () => {
    const db = setup(); instruments(db); const start = sequence(db);
    db.exec("UPDATE instruments SET metadata_json='{\"assetType\":\"unknown\"}' WHERE id='US:X'");
    expect(sequence(db)).toBe(start+1);
    expect(latest(db).event).toMatchObject({before:{sourceTable:'instruments',sourceKey:'US:X',instrumentId:'US:X'},after:{sourceKey:'US:X'},boundary:{kind:'conservative-full'},tombstone:false});
    db.exec("UPDATE instruments SET metadata_json=metadata_json,updated_at='later' WHERE id='US:X'");
    expect(sequence(db)).toBe(start+1);
    db.exec("UPDATE instruments SET currency='CNY' WHERE id='US:X'");
    expect(latest(db).event.dependencyKinds).toEqual(['catalog','material','valuation']);
  });

  it('compares strict normalized legacy fields and retains storage and JSON identities', () => {
    const db = setup(); instruments(db);
    db.exec("INSERT INTO reviews(episode_id,instrument_id,updated_at)VALUES('row-episode','US:X','fixture')");
    const start=sequence(db);
    db.exec("UPDATE reviews SET cursor_json='{}',plan_json='{}',updated_at='later'");
    expect(sequence(db)).toBe(start);
    const fact = (completed: unknown) => ({episodeId:'json-episode',instrumentId:'HK:Y',review:{completed},text:'PRIVATE_BODY'});
    legacy(db,fact(true));
    expect(sequence(db)).toBe(start+1);
    expect(latest(db).event.after).toMatchObject({episodeId:'row-episode',instrumentId:'US:X',reviewFact:{storageIdentity:{episodeId:'row-episode',instrumentId:'US:X'},episodeId:'json-episode',instrumentId:'HK:Y',completed:true}});
    let prev=sequence(db);
    for (const [value, delta] of [[1,1],[2,0],['true',0],[null,0],[false,1],[0,1],[true,1]] as const) {
      legacy(db,fact(value)); expect(sequence(db)).toBe(prev+delta); prev=sequence(db);
    }
    legacy(db,{...fact(true),text:'OTHER_PRIVATE_BODY'}); expect(sequence(db)).toBe(prev);
    expect(String(latest(db).change_json)).not.toContain('PRIVATE_BODY');
    db.exec("UPDATE reviews SET episode_id='corrected-row',instrument_id='HK:Y'");
    expect(latest(db).event).toMatchObject({before:{episodeId:'row-episode',instrumentId:'US:X'},after:{episodeId:'corrected-row',instrumentId:'HK:Y'}});
    db.exec("DELETE FROM reviews");
    expect(latest(db).event).toMatchObject({action:'DELETE',before:{episodeId:'corrected-row'},after:null,tombstone:true});
  });

  it('distinguishes legacy SQL NULL absence from JSON null and suppresses equivalent unknown identities', () => {
    const db=setup();
    db.exec("INSERT INTO reviews(episode_id,updated_at)VALUES('row-episode','fixture')");
    const start=sequence(db);
    legacy(db,null); expect(sequence(db)).toBe(start+1);
    for (const value of [7,[],{}, {episodeId:'',instrumentId:7,review:{completed:1}}]) {
      legacy(db,value); expect(sequence(db)).toBe(start+1);
    }
    legacy(db,{episodeId:' ',instrumentId:' ',review:{completed:null}}); expect(sequence(db)).toBe(start+2);
    legacy(db,undefined); expect(sequence(db)).toBe(start+3);
    db.exec("DELETE FROM reviews"); expect(sequence(db)).toBe(start+3);
  });

  it('compares every Recall projected field while formal completion survives draft autosave', () => {
    const db=setup();
    db.exec("INSERT INTO recall_documents(episode_id,draft_json,updated_at)VALUES('recall-row','{}','fixture')");
    let prev=sequence(db);
    recall(db,'finalized_json',null); expect(sequence(db)).toBe(++prev);
    expect(latest(db).event.after.reviewFact.formal).toEqual({episodeId:null,status:null,completedAt:null,updatedAt:null});
    for (const value of [7,[],{}, {episodeId:7,status:'',completedAt:false,updatedAt:[]}]) {
      recall(db,'finalized_json',value); expect(sequence(db)).toBe(prev);
    }
    const formal={episodeId:'json-formal',status:'completed',completedAt:'2026-01-02',updatedAt:'formal-v1'};
    recall(db,'finalized_json',formal); expect(sequence(db)).toBe(++prev);
    for (const key of ['episodeId','status','completedAt','updatedAt'] as const) {
      recall(db,'finalized_json',{...formal,[key]:`${formal[key]}-changed`}); expect(sequence(db)).toBe(++prev);
      recall(db,'finalized_json',formal); expect(sequence(db)).toBe(++prev);
    }
    recall(db,'draft_json',{episodeId:'json-draft',status:'in-progress',body:'PRIVATE_RECALL'}); expect(sequence(db)).toBe(++prev);
    expect(latest(db).event.after).toMatchObject({episodeId:'recall-row',reviewFact:{formal,draft:{episodeId:'json-draft',status:'in-progress'}}});
    recall(db,'draft_json',{episodeId:'json-draft',status:'in-progress',body:'OTHER_PRIVATE_RECALL',updatedAt:'later'});
    db.exec("UPDATE recall_documents SET revision=revision+1,updated_at='later'"); expect(sequence(db)).toBe(prev);
    recall(db,'draft_json',{episodeId:'other-draft',status:'in-progress'}); expect(sequence(db)).toBe(++prev);
    recall(db,'draft_json',{episodeId:'other-draft',status:'completed'}); expect(sequence(db)).toBe(++prev);
    expect(String(latest(db).change_json)).not.toContain('PRIVATE_RECALL');
    recall(db,'finalized_json',undefined); expect(sequence(db)).toBe(++prev);
    expect(latest(db).event.after.reviewFact.formal).toBeNull();
    db.exec("UPDATE recall_documents SET episode_id='corrected-recall'"); expect(sequence(db)).toBe(++prev);
    expect(latest(db).event).toMatchObject({before:{episodeId:'recall-row'},after:{episodeId:'corrected-recall'}});
  });

  it('logs actual month-end reconciliation and revision request writes with conservative boundaries', () => {
    const db=setup(); instruments(db);
    db.exec("INSERT INTO import_batches(id,imported_at)VALUES('batch','2026-01-02'); INSERT INTO trade_revisions(id,instrument_id,account_id,request_json,revision_json,recorded_at)VALUES('batch','US:X','A','{}','{}','2026-01-03')");
    const start=sequence(db);
    db.exec("UPDATE import_batches SET reconciliation_json='{\"coverage\":true}'"); expect(sequence(db)).toBe(start+1);
    expect(latest(db)).toMatchObject({effective_from:'0001-01-01',event:{dependencyKinds:['material'],after:{sourceKey:'batch',effectiveAt:null,importedAt:'2026-01-02'}}});
    db.exec("UPDATE trade_revisions SET request_json='{\"replace\":true}',instrument_id='HK:Y',account_id='B'"); expect(sequence(db)).toBe(start+2);
    expect(latest(db).event).toMatchObject({before:{instrumentId:'US:X',accountId:'A'},after:{instrumentId:'HK:Y',accountId:'B',effectiveAt:null,recordedAt:'2026-01-03'},boundary:{kind:'conservative-full'}});
    db.exec('BEGIN; UPDATE import_batches SET reconciliation_json=NULL; DELETE FROM trade_revisions; ROLLBACK'); expect(sequence(db)).toBe(start+2);
    db.exec('DELETE FROM trade_revisions; DELETE FROM import_batches');
    expect(sequence(db)).toBe(start+4); expect(latest(db).event).toMatchObject({action:'DELETE',after:null,tombstone:true});
  });

  it('preserves raw quote dual-end guards and old instrument/date evidence', () => {
    const db=setup(); instruments(db);
    db.exec("INSERT INTO daily_candles(instrument_id,date,open,high,low,close)VALUES('US:X','2026-01-05','1','1','1','1')");
    db.exec("UPDATE daily_candles SET instrument_id='HK:Y',date='2026-01-02',adjustment_mode='forward'");
    expect(latest(db)).toMatchObject({effective_from:'2026-01-02',event:{before:{instrumentId:'US:X',effectiveAt:'2026-01-05',timePrecision:'date-only'},after:{instrumentId:'HK:Y',effectiveAt:'2026-01-02'},boundary:{kind:'business-day',businessDay:'2026-01-02'}}});
    const start=sequence(db);
    db.exec("UPDATE daily_candles SET close='2'; DELETE FROM daily_candles"); expect(sequence(db)).toBe(start);
    db.exec("INSERT INTO daily_candles(instrument_id,date,open,high,low,close,adjustment_mode)VALUES('US:X','2026-01-05','1','1','1','1','forward'); UPDATE daily_candles SET adjustment_mode='raw'; DELETE FROM daily_candles");
    expect(sequence(db)).toBe(start+2); expect(latest(db).event).toMatchObject({before:{instrumentId:'US:X'},after:null,tombstone:true});
  });

  it('keeps FX settings and dated history coverage, including key and date corrections', () => {
    const db=setup();
    db.exec("INSERT INTO app_settings(key,value_json)VALUES('unrelated','{}')"); expect(sequence(db)).toBe(0);
    db.exec("UPDATE app_settings SET key='fx.rates.snapshot.v1'"); expect(sequence(db)).toBe(1);
    db.exec("UPDATE app_settings SET key='unrelated'"); expect(sequence(db)).toBe(2);
    expect(latest(db).event).toMatchObject({dependencyKinds:['fx'],before:{sourceKey:'fx.rates.snapshot.v1'},after:{sourceKey:'unrelated'}});
    db.exec("INSERT INTO home_fx_history(observation_id,business_date,known_at,rates_json)VALUES('fx-old','2026-01-05','2026-01-06T00:00:00Z','{}'); UPDATE home_fx_history SET observation_id='fx-new',business_date='2026-01-02'; DELETE FROM home_fx_history");
    expect(sequence(db)).toBe(5);
    expect(latest(db).event).toMatchObject({before:{sourceKey:'fx-new',effectiveAt:'2026-01-02'},after:null,tombstone:true});
  });

  it('preserves an empty instrument storage identity separately from normalized JSON identity', () => {
    const db=setup();
    db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('','','Fixture empty storage key','US','USD'); INSERT INTO reviews(episode_id,instrument_id,review_json,updated_at)VALUES('empty-instrument','','{\"instrumentId\":\"\"}','fixture')");
    expect(latest(db).event.after).toMatchObject({instrumentId:'',reviewFact:{storageIdentity:{episodeId:'empty-instrument',instrumentId:''},instrumentId:null}});
    const start=sequence(db);
    db.exec("DELETE FROM instruments WHERE id=''");
    expect(sequence(db)).toBe(start+2);
    const row=db.prepare("SELECT change_json FROM home_source_change WHERE entity_kind='reviews' ORDER BY seq DESC LIMIT 1").get()!;
    expect(JSON.parse(String(row.change_json))).toMatchObject({before:{instrumentId:'',reviewFact:{storageIdentity:{instrumentId:''}}},after:{instrumentId:null,reviewFact:{storageIdentity:{instrumentId:null}}}});
  });

  it('retains review OLD identity when an instrument FK sets it to NULL', () => {
    const db=setup(); instruments(db);
    db.exec("INSERT INTO reviews(episode_id,instrument_id,review_json,updated_at)VALUES('review-fk','US:X','{}','fixture')");
    const start=sequence(db);
    db.exec("DELETE FROM instruments WHERE id='US:X'");
    expect(sequence(db)).toBe(start+2);
    const row=db.prepare("SELECT change_json FROM home_source_change WHERE entity_kind='reviews' ORDER BY seq DESC LIMIT 1").get()!;
    expect(JSON.parse(String(row.change_json))).toMatchObject({action:'UPDATE',before:{instrumentId:'US:X',reviewFact:{storageIdentity:{instrumentId:'US:X'}}},after:{instrumentId:null,reviewFact:{storageIdentity:{instrumentId:null}}}});
  });

  it('keeps each original generic source write notification and suppresses unrelated columns', () => {
    const db=setup(); instruments(db);
    execution(db);
    db.exec("INSERT INTO import_batches(id,imported_at)VALUES('generic-batch','fixture'); INSERT INTO app_settings(key,value_json)VALUES('fx.rates.snapshot.v1','{}'); INSERT INTO home_fx_history(observation_id,business_date,known_at,rates_json)VALUES('generic-fx','2026-01-02','fixture','{}')");
    for (const [table,assignment] of [
      ['executions',"fee='2',trade_nature='live'"],
      ['import_batches',"evidence_json='{}',source_type='fixture'"],
      ['app_settings',"value_json='{\"USD\":7}'"],
      ['home_fx_history',"rates_json='{\"USD\":7}',convention='cny-per-unit-v1'"],
    ]) {
      const start=sequence(db);
      db.exec(`UPDATE ${table} SET ${assignment}`); expect(sequence(db)).toBe(start+1);
      expect(latest(db).event).toMatchObject({schemaVersion:2,action:'UPDATE',before:{sourceTable:table},after:{sourceTable:table}});
      db.exec(`UPDATE ${table} SET ${assignment}`); expect(sequence(db)).toBe(start+1);
      db.exec(`DELETE FROM ${table}`); expect(sequence(db)).toBe(start+2);
      expect(latest(db).event).toMatchObject({schemaVersion:2,action:'DELETE',before:{sourceTable:table},after:null,tombstone:true});
    }
  });

  it('uses conservative boundaries for malformed source business days', () => {
    const db=setup(); instruments(db);
    db.exec("INSERT INTO daily_candles(instrument_id,date,open,high,low,close)VALUES('US:X','2026-02-30','1','1','1','1')");
    expect(latest(db)).toMatchObject({effective_from:'0001-01-01',event:{boundary:{kind:'conservative-full'},after:{effectiveAt:'2026-02-30'}}});
    db.exec("UPDATE daily_candles SET date='2026-02-01'");
    expect(latest(db).event.boundary).toEqual({kind:'conservative-full'});
  });

  it('rolls back source and events on an aborted statement, explicit rollback and savepoint rollback', () => {
    const db=setup(); instruments(db); const start=sequence(db);
    db.exec("CREATE TRIGGER reject_second BEFORE INSERT ON executions WHEN NEW.id='bad' BEGIN SELECT RAISE(ABORT,'fixture rejection'); END");
    expect(() => db.exec("INSERT INTO executions(id,instrument_id,side,executed_at,quantity,price)VALUES('good','US:X','buy','2026-01-02','1','2'),('bad','US:X','buy','2026-01-02','1','2')")).toThrow('fixture rejection');
    expect(sequence(db)).toBe(start);
    db.exec("BEGIN; INSERT INTO recall_documents(episode_id,draft_json,updated_at)VALUES('rolled-back','{}','fixture'); UPDATE instruments SET metadata_json='{}'; ROLLBACK"); expect(sequence(db)).toBe(start);
    db.exec("BEGIN; SAVEPOINT attempt; DELETE FROM instruments; ROLLBACK TO attempt; RELEASE attempt; COMMIT"); expect(sequence(db)).toBe(start);
    expect(db.prepare('SELECT count(*) n FROM instruments').get()!.n).toBe(2);
  });
});
