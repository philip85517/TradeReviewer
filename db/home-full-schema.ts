/** Additive immutable full-home objects. Core release/head remain the atomic publication authority. */
export const HOME_FULL_SCHEMA=`
CREATE TABLE IF NOT EXISTS home_full_release(release_id TEXT PRIMARY KEY,manifest_json TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS home_full_module(release_id TEXT NOT NULL,kind TEXT NOT NULL,payload_json TEXT NOT NULL,PRIMARY KEY(release_id,kind));
CREATE TABLE IF NOT EXISTS home_full_evidence(release_id TEXT NOT NULL,source_key TEXT NOT NULL,recipe_json TEXT NOT NULL,payload_hash TEXT NOT NULL,PRIMARY KEY(release_id,source_key));
CREATE TABLE IF NOT EXISTS home_full_financial(release_id TEXT NOT NULL,partition_key TEXT NOT NULL,algorithm TEXT NOT NULL,manifest_hash TEXT NOT NULL,payload_hash TEXT NOT NULL,payload_json TEXT NOT NULL,PRIMARY KEY(release_id,partition_key));
CREATE TABLE IF NOT EXISTS home_full_query(release_id TEXT NOT NULL,query_key TEXT NOT NULL,artifact_id TEXT NOT NULL,payload_json TEXT NOT NULL,PRIMARY KEY(release_id,query_key));
`;
