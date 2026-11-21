/** Durable projections only; initialized by the application migration, never by a GET. */
export const HOME_SCHEMA = `
CREATE TABLE IF NOT EXISTS home_release (
  release_id TEXT PRIMARY KEY,
  source_sequence INTEGER NOT NULL CHECK (source_sequence >= 0),
  policy_version TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  valuation_cutoff TEXT NOT NULL,
  business_date TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('staging', 'validated')),
  catalog_json TEXT NOT NULL CHECK (json_valid(catalog_json)),
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json))
) STRICT;

CREATE TABLE IF NOT EXISTS home_head (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  release_id TEXT NOT NULL REFERENCES home_release(release_id)
) STRICT;

CREATE TABLE IF NOT EXISTS home_scope_result (
  scope_version TEXT PRIMARY KEY,
  scope_id TEXT NOT NULL,
  report_currency TEXT NOT NULL,
  built_from_sequence INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  valuation_cutoff TEXT NOT NULL,
  business_date TEXT NOT NULL,
  first_business_date TEXT NOT NULL,
  last_business_date TEXT NOT NULL,
  current_json TEXT NOT NULL CHECK (json_valid(current_json)),
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json)),
  holding_count INTEGER NOT NULL CHECK (holding_count >= 0),
  UNIQUE (scope_version, scope_id)
) STRICT;

CREATE TABLE IF NOT EXISTS home_release_scope (
  release_id TEXT NOT NULL REFERENCES home_release(release_id),
  scope_id TEXT NOT NULL,
  scope_version TEXT NOT NULL,
  evaluated_through_sequence INTEGER NOT NULL,
  PRIMARY KEY (release_id, scope_id),
  FOREIGN KEY (scope_version, scope_id)
    REFERENCES home_scope_result(scope_version, scope_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS home_release_scope_versions ON home_release_scope(scope_version);

CREATE TABLE IF NOT EXISTS home_daily (
  scope_version TEXT NOT NULL REFERENCES home_scope_result(scope_version),
  business_date TEXT NOT NULL,
  native_by_currency_json TEXT NOT NULL CHECK (json_valid(native_by_currency_json)),
  -- Required per currency: marketValue, unrealized, realizedKnownPrefix,
  -- realizedMissingPrefix, feesKnownPrefix, feesMissingPrefix, lifetimeCoverage.
  -- Decimal values are strings or explicit unknown; missing counters are integers.
  -- Compute native differences first, then convert using the ENDPOINT's FX.
  -- Never subtract report-currency prefix values converted at different FX dates.
  money_context_json TEXT NOT NULL CHECK (json_valid(money_context_json)),
  -- Context holds per-field unknowns, coverage, quote/endpoint FX references.
  -- JSON shapes, decimal grammar and missing-counter monotonicity are publication gates.
  PRIMARY KEY (scope_version, business_date)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS home_trade_set (
  trade_set_id TEXT PRIMARY KEY,
  position_key TEXT NOT NULL,             -- complete account/instrument/position identity
  source_sequence INTEGER NOT NULL,
  trade_count INTEGER NOT NULL CHECK (trade_count >= 0),
  policy_version TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS home_holding (
  scope_version TEXT NOT NULL REFERENCES home_scope_result(scope_version),
  holding_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  position_key TEXT NOT NULL,
  trade_set_id TEXT NOT NULL REFERENCES home_trade_set(trade_set_id),
  search_text TEXT NOT NULL,             -- same normalization as current name/code/exchange search
  row_json TEXT NOT NULL CHECK (json_valid(row_json)),
  detail_json TEXT NOT NULL CHECK (json_valid(detail_json)),
  PRIMARY KEY (scope_version, holding_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS home_holding_trade_set ON home_holding(trade_set_id);

CREATE TABLE IF NOT EXISTS home_holding_order (
  scope_version TEXT NOT NULL,
  sort_key TEXT NOT NULL CHECK (sort_key IN ('name', 'marketValue', 'unrealized')),
  direction TEXT NOT NULL CHECK (direction IN ('asc', 'desc')),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 1),
  holding_id TEXT NOT NULL,
  PRIMARY KEY (scope_version, sort_key, direction, ordinal),
  UNIQUE (scope_version, sort_key, direction, holding_id),
  FOREIGN KEY (scope_version, holding_id) REFERENCES home_holding(scope_version, holding_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS home_holding_trade (
  trade_set_id TEXT NOT NULL REFERENCES home_trade_set(trade_set_id),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 1),
  execution_id TEXT NOT NULL,
  trade_json TEXT NOT NULL CHECK (json_valid(trade_json)),
  PRIMARY KEY (trade_set_id, ordinal),
  UNIQUE (trade_set_id, execution_id)
) STRICT, WITHOUT ROWID;

-- Background state: examples of the required durability fields, not integration code.
-- Every source writer must append its event in the SAME transaction as the facts.
CREATE TABLE IF NOT EXISTS home_source_change (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_kind TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  committed_at TEXT NOT NULL,
  change_json TEXT NOT NULL CHECK (json_valid(change_json))
) STRICT;

CREATE TABLE IF NOT EXISTS home_dirty (
  account_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  earliest_business_date TEXT NOT NULL,
  target_sequence INTEGER NOT NULL,
  completed_sequence INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL CHECK (state IN ('pending', 'running', 'failed')),
  lease_owner TEXT,
  lease_until TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  PRIMARY KEY (account_id, instrument_id, policy_version)
) STRICT, WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS home_dirty_pending ON home_dirty(state, target_sequence);

CREATE TABLE IF NOT EXISTS home_ledger_checkpoint (
  account_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  business_date TEXT NOT NULL,
  source_sequence INTEGER NOT NULL,
  state_json TEXT NOT NULL CHECK (json_valid(state_json)),
  -- state includes open lots/cost basis/fees/auxiliary evidence and unknowns.
  -- Must be invalidated for edits on or before its date; not just selected by latest timestamp.
  PRIMARY KEY (account_id, instrument_id, policy_version, business_date)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS home_object_projection (
 position_key TEXT PRIMARY KEY,
 fingerprint TEXT NOT NULL,
 payload BLOB NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS home_fx_history (
  observation_id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL,
  known_at TEXT NOT NULL,
  rates_json TEXT NOT NULL CHECK(json_valid(rates_json))
) STRICT;
CREATE INDEX IF NOT EXISTS home_fx_history_date ON home_fx_history(business_date,known_at);

-- No UPDATE-in-place of published projections. No application GET may build these tables.
-- Before moving home_head: validate all scope/object links, counts, policy, watermarks,
-- domain identities and numerical invariants. A manifest is not proof by mere presence.
`;

/** Column comparisons suppress redundant invalidations; triggers share the writer's transaction. */
function sourceTriggers(table:string,key:string,date:string,columns:string[],guard='1') {
 return (['INSERT','UPDATE','DELETE'] as const).map(action=>{
  const ref=action==='DELETE'?'OLD':'NEW';
  const at=(sql:string)=>sql.replaceAll('$',ref);
  const changed=action==='UPDATE'?columns.map(c=>`OLD.${c} IS NOT NEW.${c}`).join(' OR '):'1';
  return `CREATE TRIGGER IF NOT EXISTS home_${table}_${action.toLowerCase()} AFTER ${action} ON ${table}
  WHEN (${at(guard)}) AND (${changed}) BEGIN
   INSERT INTO home_source_change(entity_kind,entity_key,effective_from,committed_at,change_json)
   VALUES('${table}',${at(key)},${at(date)},strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('action','${action}'));
  END;`;
 }).join('\n');
}
export const HOME_REFRESH_SCHEMA = `
CREATE TABLE IF NOT EXISTS home_publication(
 release_id TEXT PRIMARY KEY REFERENCES home_release(release_id), published_at INTEGER NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS home_refresh(
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), lease_owner TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 started_at TEXT, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, retry_after INTEGER NOT NULL DEFAULT 0
) STRICT;
INSERT OR IGNORE INTO home_refresh(singleton)VALUES(1);
INSERT OR IGNORE INTO home_publication SELECT release_id,unixepoch()*1000 FROM home_head;
CREATE INDEX IF NOT EXISTS home_source_change_clock ON home_source_change(entity_kind,entity_key);
`;
export const HOME_SOURCE_TRIGGERS = [
 sourceTriggers('executions','$.id',"substr($.executed_at,1,10)",['instrument_id','account','side','executed_at','quantity','price','fee','currency','evidence_json','trade_nature','simulation_run_id','import_batch_id']),
 sourceTriggers('import_batches','$.id',"'0001-01-01'",['evidence_json','source_fingerprint','source_type','imported_at']),
 sourceTriggers('instruments','$.id',"'0001-01-01'",['symbol','name','market','currency','localized_name_json']),
 sourceTriggers('daily_candles',"$.instrument_id||'/'||$.date",'$.date',['close','currency','provider','adjustment_mode'],"$.adjustment_mode='raw'"),
 sourceTriggers('app_settings','$.key',"'0001-01-01'",['value_json'],"$.key='fx.rates.snapshot.v1'"),
 sourceTriggers('home_fx_history','$.observation_id','$.business_date',['rates_json','business_date','known_at']),
].join('\n');

// Keep migration 15 immutable: databases already used in validation upgrade here.
export const HOME_QUOTE_TRIGGER_FIX = `
DROP TRIGGER IF EXISTS home_daily_candles_update;
CREATE TRIGGER home_daily_candles_update AFTER UPDATE ON daily_candles
WHEN (OLD.adjustment_mode='raw' OR NEW.adjustment_mode='raw') AND
 (OLD.instrument_id IS NOT NEW.instrument_id OR OLD.date IS NOT NEW.date OR
  OLD.close IS NOT NEW.close OR OLD.currency IS NOT NEW.currency OR
  OLD.provider IS NOT NEW.provider OR OLD.adjustment_mode IS NOT NEW.adjustment_mode)
BEGIN
 INSERT INTO home_source_change(entity_kind,entity_key,effective_from,committed_at,change_json)
 VALUES('daily_candles',NEW.instrument_id||'/'||NEW.date,min(OLD.date,NEW.date),
  strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('action','UPDATE','oldInstrumentId',OLD.instrument_id));
END;
`;

export const HOME_SOURCE_JOBS_SCHEMA = `
CREATE TABLE home_source_job (
 job_key TEXT PRIMARY KEY, kind TEXT NOT NULL, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 priority INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN('pending','running','done','failed')),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 lease_owner TEXT, lease_until INTEGER NOT NULL DEFAULT 0, retry_after INTEGER NOT NULL DEFAULT 0, error TEXT
) STRICT;
CREATE INDEX home_source_job_queue ON home_source_job(state,priority,retry_after);
-- Original observations remain auditable. Old unversioned rates have an ambiguous
-- (previously inverted) direction and must not be silently treated as corrected.
ALTER TABLE home_fx_history ADD COLUMN convention TEXT NOT NULL DEFAULT 'legacy-unknown';
`;

/** Immutable per-object endpoints. Kept separate from the mutable build cache. */
export const HOME_METRIC_OBJECT_SCHEMA = `
CREATE TABLE home_metric_object (
 object_version TEXT PRIMARY KEY, position_key TEXT NOT NULL,
 first_day TEXT NOT NULL, last_day TEXT NOT NULL, current_json TEXT NOT NULL,
 metadata_json TEXT NOT NULL, boundary_count INTEGER NOT NULL, complete INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE home_metric_boundary (
 object_version TEXT NOT NULL REFERENCES home_metric_object(object_version),
 business_date TEXT NOT NULL, native_json TEXT NOT NULL,
 PRIMARY KEY(object_version,business_date)
) WITHOUT ROWID;
CREATE TABLE home_metric_member (
 scope_version TEXT NOT NULL REFERENCES home_scope_result(scope_version),
 position_key TEXT NOT NULL, object_version TEXT NOT NULL REFERENCES home_metric_object(object_version),
 PRIMARY KEY(scope_version,position_key)
) WITHOUT ROWID;
CREATE INDEX home_metric_member_object ON home_metric_member(object_version);
`;

/**
 * Migration 20 replaces source notifications without changing migrations 15/16.
 * Selectors retain evidence, not an inferred ledger scope. Consumers must still
 * accept historical v1/clock events and read complete facts at the source watermark.
 */
type SourceTextMode = 'comparison' | 'payload';
function sourceJsonText(column: string, path: string, mode: SourceTextMode = 'comparison'): string {
 const nonempty = `json_type(${column},'${path}')='text' AND json_extract(${column},'${path}')<>''`;
 // SQLite length(TEXT) stops at NUL. Compare to '' within SQLite instead.
 // Keep decoded SQL text for canonical comparisons, so equivalent escapes do
 // not notify. Payloads embed the original JSON scalar: decoding and quoting
 // lone surrogates would create invalid UTF-8 at the native SQLite/JS boundary.
 return mode==='payload'
  ? `json(CASE WHEN ${nonempty} THEN ${column} -> '${path}' ELSE 'null' END)`
  : `CASE WHEN ${nonempty} THEN json_extract(${column},'${path}') ELSE NULL END`;
}
function legacySourceFact(ref: string, mode: SourceTextMode = 'comparison'): string {
 const body = `${ref}.review_json`;
 return `CASE WHEN ${body} IS NULL THEN NULL ELSE json_object(
  'storageIdentity',json_object('episodeId',${ref}.episode_id,'instrumentId',${ref}.instrument_id),
  'episodeId',${sourceJsonText(body,'$.episodeId',mode)},'instrumentId',${sourceJsonText(body,'$.instrumentId',mode)},
  'completed',json(CASE json_type(${body},'$.review.completed') WHEN 'true' THEN 'true' WHEN 'false' THEN 'false' ELSE 'null' END)) END`;
}
function recallSourceFact(ref: string, mode: SourceTextMode = 'comparison'): string {
 const formal = `${ref}.finalized_json`, draft = `${ref}.draft_json`;
 return `json_object('episodeId',${ref}.episode_id,
  'formal',json(CASE WHEN ${formal} IS NULL THEN NULL ELSE json_object(
   'episodeId',${sourceJsonText(formal,'$.episodeId',mode)},'status',${sourceJsonText(formal,'$.status',mode)},
   'completedAt',${sourceJsonText(formal,'$.completedAt',mode)},'updatedAt',${sourceJsonText(formal,'$.updatedAt',mode)}) END),
  'draft',json_object('episodeId',${sourceJsonText(draft,'$.episodeId',mode)},'status',${sourceJsonText(draft,'$.status',mode)}))`;
}

type SourceEventDefinition = {
 table: string;
 key: string;
 columns?: string[];
 fact?: (ref: string, mode?: SourceTextMode) => string;
 guard?: string;
 account?: string;
 instrument?: string;
 episode?: string;
 effectiveAt?: string;
 importedAt?: string;
 recordedAt?: string;
 timePrecision?: string;
 sourceTimezone?: string;
 businessDay?: string;
 dependencies: (action: 'INSERT' | 'UPDATE' | 'DELETE') => string;
};

function sourceEventTriggers(definition: SourceEventDefinition): string {
 const at = (sql: string, ref: string) => sql.replaceAll('$',ref);
 // JSON paths are generated inside fact()/sourceJsonText(), never passed to at().
 const selector = (ref: string) => `json_object(
  'sourceTable','${definition.table}','sourceKey',${at(definition.key,ref)},
  'accountId',${at(definition.account ?? 'NULL',ref)},'instrumentId',${at(definition.instrument ?? 'NULL',ref)},
  'episodeId',${at(definition.episode ?? 'NULL',ref)},'effectiveAt',${at(definition.effectiveAt ?? 'NULL',ref)},
  'timePrecision',${definition.table==='executions' ? sourceJsonText(`${ref}.evidence_json`,'$.source.timePrecision','payload') : at(definition.timePrecision ?? 'NULL',ref)},
  'sourceTimezone',${definition.table==='executions' ? sourceJsonText(`${ref}.evidence_json`,'$.source.sourceTimezone','payload') : at(definition.sourceTimezone ?? 'NULL',ref)}
  ${definition.importedAt ? `,'importedAt',${at(definition.importedAt,ref)}` : ''}
  ${definition.recordedAt ? `,'recordedAt',${at(definition.recordedAt,ref)}` : ''}
  ${definition.fact ? `,'reviewFact',json(${definition.fact(ref,'payload')})` : ''})`;
 return (['INSERT','UPDATE','DELETE'] as const).map(action => {
  const ref = action==='DELETE' ? 'OLD' : 'NEW';
  const guard = definition.guard ?? '1';
  const allowed = action==='UPDATE' ? `(${at(guard,'OLD')}) OR (${at(guard,'NEW')})` : at(guard,ref);
  const changed = action==='UPDATE'
   ? definition.fact ? `${definition.fact('OLD')} IS NOT ${definition.fact('NEW')}`
    : definition.columns!.map(column=>`OLD.${column} IS NOT NEW.${column}`).join(' OR ')
   : '1';
  // Only schema-defined business-day columns are used. Execution strings and
  // import evidence need a timezone-aware domain resolver; keep them conservative.
  const day = definition.businessDay;
  const relevantDays = day ? (action==='UPDATE' ? [at(day,'OLD'),at(day,'NEW')] : [at(day,ref)]) : [];
  const validDay = (value: string) => `(${value} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND ${value}>='0001-01-01' AND ${value}<='9999-12-31' AND date(${value},'+0 days') IS ${value})`;
  const proven = relevantDays.length ? relevantDays.map(validDay).join(' AND ') : '0';
  const earliest = relevantDays.length===2 ? `min(${relevantDays.join(',')})` : relevantDays[0] ?? 'NULL';
  const effective = `CASE WHEN ${proven} THEN ${earliest} ELSE '0001-01-01' END`;
  const boundary = `CASE WHEN ${proven} THEN json_object('kind','business-day','businessDay',${earliest}) ELSE json_object('kind','conservative-full') END`;
  return `DROP TRIGGER IF EXISTS home_${definition.table}_${action.toLowerCase()};
CREATE TRIGGER home_${definition.table}_${action.toLowerCase()} AFTER ${action} ON ${definition.table}
WHEN (${allowed}) AND (${changed}) BEGIN
 INSERT INTO home_source_change(entity_kind,entity_key,effective_from,committed_at,change_json)
 VALUES('${definition.table}',${at(definition.key,ref)},${effective},strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  json_object('schemaVersion',2,'action','${action}',
   'before',${action==='INSERT' ? 'NULL' : selector('OLD')},'after',${action==='DELETE' ? 'NULL' : selector('NEW')},
   'dependencyKinds',json(${definition.dependencies(action)}),'boundary',json(${boundary}),
   'tombstone',json('${action==='DELETE' ? 'true' : 'false'}')));
END;`;
 }).join('\n');
}

const sourceDependency = (...kinds: string[]) => () => `json_array(${kinds.map(kind=>`'${kind}'`).join(',')})`;

/** Append-only upgrade: all prior generic source coverage plus catalog/review facts. */
export const HOME_SOURCE_CHANGE_V2 = [
 sourceEventTriggers({table:'executions',key:'$.id',account:'$.account',instrument:'$.instrument_id',effectiveAt:'$.executed_at',
  columns:['id','instrument_id','account','side','executed_at','quantity','price','fee','currency','evidence_json','trade_nature','simulation_run_id','import_batch_id'],
  dependencies:sourceDependency('execution','material')}),
 sourceEventTriggers({table:'import_batches',key:'$.id',importedAt:'$.imported_at',
  columns:['id','evidence_json','reconciliation_json','source_fingerprint','source_type','imported_at','trade_nature','simulation_run_id'],
  dependencies:sourceDependency('material')}),
 sourceEventTriggers({table:'trade_revisions',key:'$.id',account:'$.account_id',instrument:'$.instrument_id',recordedAt:'$.recorded_at',
  columns:['id','instrument_id','account_id','request_json','revision_json','recorded_at'],dependencies:sourceDependency('material')}),
 sourceEventTriggers({table:'instruments',key:'$.id',instrument:'$.id',
  columns:['id','symbol','name','market','currency','localized_name_json','metadata_json'],
  dependencies:action=>action==='UPDATE' ? `CASE WHEN OLD.id IS NOT NEW.id OR OLD.symbol IS NOT NEW.symbol OR OLD.market IS NOT NEW.market OR OLD.currency IS NOT NEW.currency THEN json_array('catalog','material','valuation') ELSE json_array('catalog') END` : "json_array('catalog','material','valuation')"}),
 sourceEventTriggers({table:'reviews',key:'$.episode_id',instrument:'$.instrument_id',episode:'$.episode_id',
  fact:legacySourceFact,guard:'$.review_json IS NOT NULL',dependencies:sourceDependency('review')}),
 sourceEventTriggers({table:'recall_documents',key:'$.episode_id',episode:'$.episode_id',fact:recallSourceFact,dependencies:sourceDependency('review')}),
 sourceEventTriggers({table:'daily_candles',key:"$.instrument_id||'/'||$.date",instrument:'$.instrument_id',effectiveAt:'$.date',timePrecision:"'date-only'",businessDay:'$.date',
  columns:['instrument_id','date','close','currency','provider','adjustment_mode'],guard:"$.adjustment_mode='raw'",dependencies:sourceDependency('valuation')}),
 sourceEventTriggers({table:'app_settings',key:'$.key',columns:['key','value_json'],guard:"$.key='fx.rates.snapshot.v1'",dependencies:sourceDependency('fx')}),
 sourceEventTriggers({table:'home_fx_history',key:'$.observation_id',effectiveAt:'$.business_date',timePrecision:"'date-only'",businessDay:'$.business_date',
  columns:['observation_id','rates_json','business_date','known_at','convention'],dependencies:sourceDependency('fx')}),
].join('\n');
