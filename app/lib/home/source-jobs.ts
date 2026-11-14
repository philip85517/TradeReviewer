import type {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
export type SourceJob = {key:string;kind:'quote'|'fx';payload:Record<string,string>;priority:number};
const activeJob="NOT (j.kind='fx' AND EXISTS(SELECT 1 FROM home_source_job newer WHERE newer.kind='fx' AND newer.state='done' AND newer.created_at>j.created_at))";
/** Durable, bounded source acquisition. Independent of the publication lease. */
export class HomeSourceJobs {
 constructor(private readonly db:DatabaseSync){}
 enqueue(job:SourceJob,now=Date.now()){
  this.db.prepare('INSERT OR IGNORE INTO home_source_job(job_key,kind,payload_json,priority,created_at,updated_at)VALUES(?,?,?,?,?,?)').run(job.key,job.kind,JSON.stringify(job.payload),job.priority,now,now);
 }
 summary(now=Date.now()){
  const row=this.db.prepare(`SELECT count(*) total,sum(state='done') done,sum(state='failed') failed,sum(state IN('pending','running')) pending,min(CASE WHEN state<>'done' THEN created_at END) since FROM home_source_job j WHERE ${activeJob}`).get()!;
  const failure=this.db.prepare(`SELECT error FROM home_source_job j WHERE state='failed' AND ${activeJob} ORDER BY updated_at DESC LIMIT 1`).get();
  return {total:Number(row.total),done:Number(row.done??0),failed:Number(row.failed??0),pending:Number(row.pending??0),since:row.since?new Date(Number(row.since)).toISOString():null,error:failure?.error?String(failure.error):null,delayed:row.since!==null&&now-Number(row.since)>30000};
 }
 retry(){this.db.prepare(`UPDATE home_source_job AS j SET state='pending',attempts=0,retry_after=0,error=NULL,updated_at=? WHERE state='failed' AND ${activeJob}`).run(Date.now());}
 async runOne(execute:(job:SourceJob,signal:AbortSignal)=>Promise<void>,signal:AbortSignal,options:{now?:()=>number;timeoutMs?:number}={}){
  if(signal.aborted)return false;
  const now=options.now??Date.now,owner=randomUUID(),started=now(),timeout=options.timeoutMs??25000;
  this.db.exec('BEGIN IMMEDIATE');
  let row:Record<string,unknown>|undefined;
  try{
   // A killed process is eligible after its lease; no network request runs in this transaction.
   row=this.db.prepare(`SELECT * FROM home_source_job j WHERE ${activeJob} AND ((state IN('pending','failed') AND attempts<3 AND retry_after<=?) OR (state='running' AND lease_until<=?)) ORDER BY priority,created_at,job_key LIMIT 1`).get(started,started);
   if(row)this.db.prepare("UPDATE home_source_job SET state='running',lease_owner=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE job_key=?").run(owner,started+timeout+5000,started,String(row.job_key));
   this.db.exec('COMMIT');
  }catch(error){this.db.exec('ROLLBACK');throw error;}
  if(!row)return false;
  const controller=new AbortController(),combined=AbortSignal.any([signal,controller.signal]);
  const timer=setTimeout(()=>controller.abort(new Error('行情或汇率源响应超时')),timeout);
  const key=String(row.job_key);
  try{
   combined.throwIfAborted();
   await execute({key,kind:row.kind as SourceJob['kind'],payload:JSON.parse(String(row.payload_json)),priority:Number(row.priority)},combined);
   combined.throwIfAborted();
   this.db.prepare("UPDATE home_source_job SET state='done',lease_owner=NULL,lease_until=0,error=NULL,updated_at=? WHERE job_key=? AND lease_owner=?").run(now(),key,owner);
  }catch(error){
   this.db.prepare("UPDATE home_source_job SET state=?,attempts=attempts-?,lease_owner=NULL,lease_until=0,retry_after=?,error=?,updated_at=? WHERE job_key=? AND lease_owner=?").run(signal.aborted?'pending':'failed',signal.aborted?1:0,signal.aborted?0:now()+30000,signal.aborted?null:(error instanceof Error?error.message:String(error)).slice(0,300),now(),key,owner);
  }finally{clearTimeout(timer);}
  return true;
 }
}
