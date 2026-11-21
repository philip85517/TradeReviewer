import type {DatabaseSync} from 'node:sqlite';
import {HomeSourceJobs} from './source-jobs';
import {HOME_FINANCIAL_PARTITION_VERSION,HOME_POLICY,HOME_PREPARED_SUBTOTAL_VERSION} from './contracts';

export type RefreshStatus = {
 sourcePending?:number;sourceFailed?:number;
 fullReady?:boolean;fullReleaseId?:string|null;
 state:'ready'|'updating'|'delayed'|'failed'|'recovering';
 releaseId:string|null; publishedSequence:number; pendingSequence:number;
 asOf:string|null; pendingSince:string|null; error:string|null; canRetry:boolean;
};
/** Persistent scheduler state. HTTP status reads do not enqueue or compute anything. */
export class HomeRefresh {
 constructor(private readonly db:DatabaseSync,private readonly requireFull=false){}
 status(now=Date.now()):RefreshStatus {
  const computed=this.computeStatus(now),source=new HomeSourceJobs(this.db).summary(now);
  computed.sourcePending=source.remaining;computed.sourceFailed=source.terminalFailed;
  const full=computed.releaseId&&this.db.prepare("SELECT 1 FROM sqlite_master WHERE name='home_full_release'").get()?this.db.prepare('SELECT manifest_json FROM home_full_release WHERE release_id=?').get(computed.releaseId):null;
  computed.fullReady=!!full;computed.fullReleaseId=full?computed.releaseId:null;
  if(!computed.releaseId||computed.state==='failed')return computed;
  if(source.failed)return {...computed,state:'failed',error:`行情或汇率补齐失败：${source.error}`,canRetry:true};
  if(source.pending&&computed.state==='ready')return {...computed,state:source.delayed?'delayed':'updating',pendingSince:source.since,canRetry:source.delayed};
  return computed;
 }
 private computeStatus(now=Date.now()):RefreshStatus {
  const head=this.db.prepare(`SELECT r.*,json_type(r.manifest_json,'$.preparedSubtotals') prepared_type,
   json_extract(r.manifest_json,'$.preparedSubtotalVersion') prepared_version,
   json_extract(r.manifest_json,'$.financialPartitionVersion') financial_version
   FROM home_head h JOIN home_release r USING(release_id) WHERE singleton=1`).get();
  const sequence=Number(head?.source_sequence??0);
  const pending=this.db.prepare('SELECT max(seq) seq,min(committed_at) since FROM home_source_change WHERE seq>?').get(sequence)!;
  const job=this.db.prepare('SELECT * FROM home_refresh WHERE singleton=1').get()!;
  // Upgrade the persisted entry result without invalidating reusable native
  // projections. The previous publication stays readable during the rebuild.
  const fullMissing=this.requireFull&&!!head&&!!this.db.prepare("SELECT 1 FROM sqlite_master WHERE name='home_full_release'").get()&&!this.db.prepare('SELECT 1 FROM home_full_release WHERE release_id=?').get(String(head.release_id));
  const upgradeFinance=this.requireFull&&!!head&&head.financial_version!==HOME_FINANCIAL_PARTITION_VERSION;
  const stale=!!head&&(fullMissing||upgradeFinance||head.policy_version!==HOME_POLICY||head.prepared_type!=='object'||head.prepared_version!==HOME_PREPARED_SUBTOTAL_VERSION);
  const pendingSequence=Math.max(sequence,Number(pending.seq??0));
  const needs=!head||pendingSequence>sequence||stale;
  const since=pending.since?String(pending.since):job.started_at?String(job.started_at):null;
  const error=needs&&job.last_error?String(job.last_error):null;
  return {state:!head?(error?'failed':'recovering'):!needs?'ready':error?'failed':since&&now-Date.parse(since)>30000?'delayed':'updating',releaseId:head?String(head.release_id):null,publishedSequence:sequence,pendingSequence,asOf:head?String(head.valuation_cutoff):null,pendingSince:since,error,canRetry:needs&&(!!error||!job.lease_owner||Number(job.lease_until)<=now)};
 }
 claim(owner:string,now=Date.now(),ttl=120000,force=false) {
  this.db.exec('BEGIN IMMEDIATE');
  try {
   const needs=force||this.computeStatus(now).state!=='ready';
   const result=needs?this.db.prepare(`UPDATE home_refresh SET lease_owner=?,lease_until=?,started_at=?,attempts=attempts+1,last_error=NULL WHERE singleton=1 AND (lease_owner IS NULL OR lease_until<=?) AND retry_after<=?`).run(owner,now+ttl,new Date(now).toISOString(),now,now):null;
   this.db.exec('COMMIT');return !!result?.changes;
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 heartbeat(owner:string,now=Date.now(),ttl=120000){return !!this.db.prepare('UPDATE home_refresh SET lease_until=? WHERE singleton=1 AND lease_owner=? AND lease_until>?').run(now+ttl,owner,now).changes;}
 finish(owner:string){this.db.prepare('UPDATE home_refresh SET lease_owner=NULL,lease_until=0,last_error=NULL,retry_after=0 WHERE singleton=1 AND lease_owner=?').run(owner);}
 fail(owner:string,error:string,now=Date.now()){
  this.db.prepare('UPDATE home_refresh SET lease_owner=NULL,lease_until=0,last_error=?,retry_after=? WHERE singleton=1 AND lease_owner=?').run(error.slice(0,500),now+30000,owner);
 }
 retry(keys?:string[]){new HomeSourceJobs(this.db).retry(keys);this.db.prepare('UPDATE home_refresh SET retry_after=0,last_error=NULL WHERE singleton=1 AND lease_owner IS NULL').run();}
 /** Time-only knowledge transitions are scheduled by the builder, never by GET. */
 tick(day:string,now=Date.now()){
  const head=this.db.prepare("SELECT r.business_date,json_extract(r.manifest_json,'$.nextRefreshAt') next_at FROM home_head h JOIN home_release r USING(release_id)").get();
  if(!head)return;
  const boundary=head.next_at&&Date.parse(String(head.next_at))<=now?String(head.next_at):head.business_date!==day?day:null;
  if(!boundary)return;
  this.db.prepare("INSERT INTO home_source_change(entity_kind,entity_key,effective_from,committed_at,change_json) SELECT 'clock',?,?,?,'{}' WHERE NOT EXISTS(SELECT 1 FROM home_source_change WHERE entity_kind='clock' AND entity_key=?)").run(boundary,day,new Date(now).toISOString(),boundary);
 }
}
