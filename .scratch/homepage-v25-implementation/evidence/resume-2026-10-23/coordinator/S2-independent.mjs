import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as s from '../../../../../app/lib/reviews/homepage-v25-state.ts';
const all={live:true,market:'all',accounts:['*'],rangeMode:'all'};
const custom={live:true,market:'a',accounts:['acct'],rangeMode:'custom',from:'2026-01-01',to:'2026-03-31'};
const date={live:true,market:'hk',accounts:['other'],rangeMode:'date',date:'2026-04-06'};
const checks=[];
function check(name,run){try{run();checks.push({name,pass:true});}catch(e){checks.push({name,pass:false,error:e.stack});}}
function finish(st,domain='global',ok=true){const t=st.requests[domain];assert.ok(t);return s.completeHomepageRequest(st,{domain,generation:t.generation,scopeKey:t.scopeKey,ok,...(domain==='global'?{applied:t.target}:domain==='period'?{period:t.target}:{historyRange:t.target})});}
function withAttachments(scope=custom){let st=s.createHomepageState(scope);st=s.beginHomepageApply(st,{...st.draft,attachments:{categories:['stock'],openOnly:true,pendingReview:[false]}});return finish(st).state;}
check('fresh native date and explicit All have one period authority',()=>{
 const d=s.createHomepageState(date);assert.deepEqual(d.snapshot.period,{preset:'custom',from:date.date,to:date.date});assert.deepEqual(s.homepageNavigationScope(d.snapshot),date);
 const a=s.createHomepageState(all);assert.deepEqual(a.snapshot.period,{preset:'all',from:null,to:null});assert.deepEqual(s.homepageNavigationScope(a.snapshot),all);
});
for(const choice of [[],[false],[true],[true,false,true]])check(`pending-review set ${JSON.stringify(choice)} roundtrip`,()=>{
 let st=s.createHomepageState(all);st=s.beginHomepageApply(st,{...st.draft,attachments:{categories:[],openOnly:false,pendingReview:choice}});st=finish(st).state;
 const decoded=s.decodeHomepageSnapshot(s.encodeHomepageSnapshot(st.snapshot));assert.deepEqual(decoded.attachments.pendingReview,[false,true].filter(v=>choice.includes(v)));assert.equal(decoded.version,3);
});
for(const value of [false,true])check(`complete v2 migration ${value} and nested rejection`,()=>{
 const legacy=structuredClone(withAttachments().snapshot);legacy.version=2;legacy.attachments.pendingReview=value;
 const migrated=s.decodeHomepageSnapshot(JSON.stringify(legacy));assert.ok(migrated);assert.deepEqual(migrated.attachments.pendingReview,value?[true]:[]);
 legacy.holdings.rows=[{price:'secret'}];assert.equal(s.decodeHomepageSnapshot(JSON.stringify(legacy)),null);
});
check('v3 strips business serialization and rejects inconsistent period',()=>{
 const snap=structuredClone(withAttachments().snapshot);snap.search.rows=[{fee:'secret'}];assert.ok(!s.encodeHomepageSnapshot(snap).includes('secret'));assert.equal(s.decodeHomepageSnapshot(JSON.stringify(snap)),null);
 delete snap.search.rows;snap.period={preset:'all',from:null,to:null};assert.equal(s.decodeHomepageSnapshot(JSON.stringify(snap)),null);
});
check('navigation success commits URL date and clears attachments atomically',()=>{
 const old=withAttachments();const pending=s.beginHomepageRead(old,{purpose:'navigation',scope:date},1);
 assert.deepEqual(pending.snapshot,old.snapshot);const out=finish(pending);assert.equal(out.accepted,true);assert.deepEqual(out.state.snapshot.scope,date);
 assert.deepEqual(out.state.snapshot.period,{preset:'custom',from:date.date,to:date.date});assert.deepEqual(out.state.snapshot.attachments,{categories:[],openOnly:false,pendingReview:[]});
});
check('navigation failure/retry retains old committed state and explicit target',()=>{
 const old=withAttachments();let pending=s.beginHomepageRead(old,{purpose:'navigation',scope:date},1);const prior=pending.request;pending=finish(pending,'global',false).state;
 assert.deepEqual(pending.snapshot,old.snapshot);pending=s.retryHomepageRequest(pending,'global',2);assert.equal(pending.request.purpose,'navigation');assert.equal(pending.request.target.date,date.date);
 assert.equal(s.completeHomepageRequest(pending,{generation:prior.generation,scopeKey:prior.scopeKey,ok:true,applied:prior.target}).accepted,false);
 const done=finish(pending);assert.equal(done.accepted,true);assert.deepEqual(done.state.snapshot.scope,date);
});
check('navigation to explicit All clears old native dates',()=>{
 const old=withAttachments();const done=finish(s.beginHomepageRead(old,{purpose:'navigation',scope:all},1));assert.equal(done.accepted,true);assert.deepEqual(done.state.snapshot.scope,all);assert.deepEqual(done.state.snapshot.period,{preset:'all',from:null,to:null});
});
check('identity preserves committed period while clearing attachments',()=>{
 const old=withAttachments();const target={...date,accounts:['acct']};const st=s.beginHomepageRead(old,{purpose:'identity',scope:target},1);assert.deepEqual(st.snapshot,old.snapshot);assert.equal(st.request.target.rangeMode,'custom');assert.equal(st.request.target.from,custom.from);
 const done=finish(st);assert.equal(done.accepted,true);assert.deepEqual(done.state.snapshot.period,old.snapshot.period);assert.deepEqual(done.state.snapshot.attachments,{categories:[],openOnly:false,pendingReview:[]});
});
check('refresh reads committed and preserves independently edited draft on retry',()=>{
 let st=withAttachments();st=s.editHomepageDraft(st,{...st.draft,attachments:{categories:['etf'],openOnly:false,pendingReview:[true]}});const draft=st.draft;const committed=st.applied;
 st=s.beginHomepageRead(st,{purpose:'refresh'},1);assert.deepEqual(st.request.target,committed);st=finish(st,'global',false).state;st=s.retryHomepageRequest(st,'global',2);assert.equal(st.request.purpose,'refresh');assert.deepEqual(st.request.target,committed);
 const done=finish(st);assert.equal(done.accepted,true);assert.deepEqual(done.state.draft,draft);assert.deepEqual(done.state.applied,committed);
});
for(const order of [['period','history'],['history','period']])check(`period/history commute ${order.join(' then ')}`,()=>{
 let st=withAttachments();st=s.beginHomepagePeriodApply(st,{preset:'custom',from:'2026-02-01',to:'2026-02-28'},1);st=s.beginHomepageHistoryApply(st,{mode:'years',fromYear:2020,toYear:2025},2);
 for(const d of order){const done=finish(st,d);assert.equal(done.accepted,true);st=done.state;}
 assert.equal(st.snapshot.period.from,'2026-02-01');assert.deepEqual(st.snapshot.history.range,{mode:'years',fromYear:2020,toYear:2025});assert.equal(st.snapshot.scope.from,'2026-02-01');assert.equal(st.draft.from,'2026-02-01');assert.equal(st.requests.global,null);
});
check('restoration increments generation and contains no requests or business',()=>{
 const old=withAttachments();const pending=s.beginHomepageRead(old,{purpose:'refresh'},1);const bytes=s.encodeHomepageSnapshot(pending.snapshot);assert.ok(!bytes.includes('requests'));
 const restored=s.restoreHomepageState(bytes,pending);assert.equal(restored.ok,true);assert.equal(restored.state.request,null);const next=s.beginHomepageRead(restored.state,{purpose:'refresh'},2);assert.ok(next.request.generation>pending.request.generation);assert.equal(s.completeHomepageRequest(next,{generation:pending.request.generation,scopeKey:pending.request.scopeKey,ok:true,applied:pending.request.target}).accepted,false);
});
const path=new URL('../../../../../app/lib/reviews/homepage-v25-state.ts',import.meta.url);
console.log(JSON.stringify({sourceSha:createHash('sha256').update(readFileSync(path)).digest('hex'),passed:checks.filter(c=>c.pass).length,total:checks.length,checks},null,2));
process.exitCode=checks.every(c=>c.pass)?0:1;
