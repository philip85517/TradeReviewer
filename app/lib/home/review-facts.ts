import {createHash} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';

export type LegacyFact = {
  storageIdentity: {episodeId:string;instrumentId:string|null};
  episodeId:string|null;
  instrumentId:string|null;
  completed:boolean|null;
  factVersion:string;
};
export type RecallFact = {
  episodeId:string;
  formal:null|{episodeId:string|null;status:string|null;completedAt:string|null;updatedAt:string|null};
  draft:{episodeId:string|null;status:string|null};
  factVersion:string;
};
export type ReviewFacts = {schemaVersion:1;legacy:LegacyFact[];recall:RecallFact[]};

// These expressions mirror the frozen source-change contract. SQLite must
// distinguish JSON booleans from numbers and SQL NULL from a JSON null document.
// Only selected JSON scalars cross into JS; bodies remain inside SQLite. Keep
// their JSON escapes: native TEXT output truncates NUL, and decoding then
// re-quoting inside SQLite loses lone UTF-16 surrogates from source JSON.
function jsonStringScalar(column:string,path:string):string {
  const scalar=`(${column} -> '${path}')`;
  return `CASE WHEN json_type(${column},'${path}')='text' AND ${scalar}<>'""' THEN ${scalar} ELSE 'null' END`;
}
function storedEpisodeScalar(column:string):string {
  // Guard before json_quote so invalid BLOB keys reach our explicit validation.
  return `CASE WHEN typeof(${column})='text' THEN json_quote(${column}) ELSE 'null' END`;
}
function parseStringScalar(value:string):string|null {
  return JSON.parse(value) as string|null;
}
function storedEpisodeId(value:unknown,table:string):string {
  if(typeof value!=='string'||value.length===0)throw new Error(`Invalid ${table} stored episode id`);
  return value;
}
function factVersion(kind:'legacy'|'recall',fields:unknown[]):string {
  // Schema and kind domain-separate fixed-position tuples. Every projected
  // field occurs exactly once, including explicit null and formal presence.
  return createHash('sha256').update(JSON.stringify([1,kind,...fields])).digest('hex');
}

/** Called inside readSourceSnapshot's existing watermark read transaction. */
export function readReviewFacts(db:DatabaseSync):ReviewFacts {
  const legacyRows=db.prepare(`SELECT ${storedEpisodeScalar('episode_id')} AS storage_episode_json,json_quote(instrument_id) AS storage_instrument_json,
    ${jsonStringScalar('review_json','$.episodeId')} AS episode_json,
    ${jsonStringScalar('review_json','$.instrumentId')} AS instrument_json,
    CASE json_type(review_json,'$.review.completed') WHEN 'true' THEN 1 WHEN 'false' THEN 0 ELSE NULL END AS completed
    FROM reviews WHERE review_json IS NOT NULL ORDER BY reviews.episode_id`).all() as {
      storage_episode_json:string;storage_instrument_json:string;episode_json:string;instrument_json:string;completed:0|1|null;
    }[];
  const legacy:LegacyFact[]=legacyRows.map(row=>{
    const storageIdentity={episodeId:storedEpisodeId(parseStringScalar(row.storage_episode_json),'reviews'),instrumentId:parseStringScalar(row.storage_instrument_json)};
    const episodeId=parseStringScalar(row.episode_json),instrumentId=parseStringScalar(row.instrument_json);
    const completed=row.completed===null?null:row.completed===1;
    return {storageIdentity,episodeId,instrumentId,completed,
      factVersion:factVersion('legacy',[storageIdentity.episodeId,storageIdentity.instrumentId,episodeId,instrumentId,completed])};
  });
  const recallRows=db.prepare(`SELECT ${storedEpisodeScalar('episode_id')} AS storage_episode_json,finalized_json IS NOT NULL AS has_formal,
    ${jsonStringScalar('finalized_json','$.episodeId')} AS formal_episode_json,
    ${jsonStringScalar('finalized_json','$.status')} AS formal_status_json,
    ${jsonStringScalar('finalized_json','$.completedAt')} AS completed_at_json,
    ${jsonStringScalar('finalized_json','$.updatedAt')} AS formal_updated_at_json,
    ${jsonStringScalar('draft_json','$.episodeId')} AS draft_episode_json,
    ${jsonStringScalar('draft_json','$.status')} AS draft_status_json
    FROM recall_documents ORDER BY recall_documents.episode_id`).all() as {
      storage_episode_json:string;has_formal:0|1;formal_episode_json:string;formal_status_json:string;completed_at_json:string;formal_updated_at_json:string;draft_episode_json:string;draft_status_json:string;
    }[];
  const recall:RecallFact[]=recallRows.map(row=>{
    const episodeId=storedEpisodeId(parseStringScalar(row.storage_episode_json),'recall_documents');
    const formal=row.has_formal===1?{episodeId:parseStringScalar(row.formal_episode_json),status:parseStringScalar(row.formal_status_json),completedAt:parseStringScalar(row.completed_at_json),updatedAt:parseStringScalar(row.formal_updated_at_json)}:null;
    const draft={episodeId:parseStringScalar(row.draft_episode_json),status:parseStringScalar(row.draft_status_json)};
    return {episodeId,formal,draft,
      factVersion:factVersion('recall',[episodeId,formal===null?null:[formal.episodeId,formal.status,formal.completedAt,formal.updatedAt],[draft.episodeId,draft.status]])};
  });
  return {schemaVersion:1,legacy,recall};
}
