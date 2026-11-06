import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.cwd();
const out=path.join(root,'.scratch/review-workspace-design-map/evidence/systematic-fixes-20261105/task-final-candidate45/independent-trade2-20261106');
const mp=path.join(root,'.scratch/review-workspace-design-map/evidence/systematic-fixes-20261105/candidate-20261105-45/manifest.json');
const manifest=JSON.parse(await readFile(mp,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
async function checkManifest(label) {
 const files=[];
 for(const f of manifest.files){const response=await fetch('http://127.0.0.1:3091/'+f.source.replace(/^docs\//,''),{cache:'no-store'});const [source,snapshot,http]=await Promise.all([readFile(path.join(root,f.source)),readFile(path.join(root,f.snapshot)),response.arrayBuffer()]);const hashes={source:sha(source),snapshot:sha(snapshot),http:sha(Buffer.from(http))};files.push({source:f.source,expected:f.sha256,status:response.status,hashes,pass:response.ok&&Object.values(hashes).every(v=>v===f.sha256)});}
 await writeFile(path.join(out,`manifest-${label}.json`),JSON.stringify({at:new Date().toISOString(),version:manifest.version,manifestSha256:sha(await readFile(mp)),files},null,2));
 if(files.some(f=>!f.pass)) throw Error('Manifest mismatch '+label);
}
await checkManifest('before');
const url='http://127.0.0.1:3091/design-system/baselines/2026-10-22-review-workspace-v1.0/prototypes/workspace-v0.1/index.html?variant=A&scene=entry';
const results=[];
for(const size of [{width:1440,height:900},{width:1280,height:800}]){
 const target=await(await fetch('http://127.0.0.1:9225/json/new?about:blank',{method:'PUT'})).json();
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});let id=0;const pending=new Map(),exceptions=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails?.text);if(m.id&&pending.has(m.id)){const q=pending.get(m.id);pending.delete(m.id);clearTimeout(q.timer);m.error?q.reject(Error(JSON.stringify(m.error))):q.resolve(m.result)}};
 const send=(method,params={})=>new Promise((r,j)=>{const k=++id,t=setTimeout(()=>{pending.delete(k);j(Error('timeout '+method))},9000);pending.set(k,{resolve:r,reject:j,timer:t});ws.send(JSON.stringify({id:k,method,params}))});
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const read=async expression=>{const v=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));return v.result.value};
 const point=sel=>read(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y);return{x,y,width:r.width,height:r.height,hit:e===h||e.contains(h),hitHtml:h?.outerHTML.slice(0,160)}})()`);
 const click=async(sel)=>{const p=await point(sel);if(!p?.hit)throw Error('not hittable '+sel+' '+JSON.stringify(p));await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});await wait(350);actions.push({type:'mouse',selector:sel,x:p.x,y:p.y});};
 const key=async(k,code,vk)=>{await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:k,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});await send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});await wait(15)};
 const input=async(sel,value)=>{await click(sel);await key('End','End',35);const n=await read(`document.querySelector(${JSON.stringify(sel)}).value.length`);for(let i=0;i<n;i++)await key('Backspace','Backspace',8);await send('Input.insertText',{text:value});await wait(350);actions.push({type:'keyboard',selector:sel,value});};
 const state=()=>read(`(()=>{const q=s=>document.querySelector(s);const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height),visible:!!(r.width&&r.height&&getComputedStyle(e).visibility!=='hidden')}};return{url:location.href,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},title:q('.instrument')?.innerText,selected:q('[data-trade].active')?.innerText,rounds:[...document.querySelectorAll('[data-trade]')].map(e=>e.innerText),stage:q('.stage-label')?.innerText,market:q('.market-info')?.innerText,note:q('.chart-note')?.innerText,date:q('[data-action=date]')?.innerText,workspace:q('.workspace')?.className,right:{className:q('.right-panel')?.className,body:q('.right-panel')?.innerText,rect:rect(q('.right-panel'))},left:rect(q('.left-panel')),chart:rect(q('#chart')),markers:[...document.querySelectorAll('[data-trade-marker]')].map(e=>({label:e.innerText,type:e.dataset.tradeMarker,rect:rect(e)})),fields:Object.fromEntries([...document.querySelectorAll('[data-plan]')].map(e=>[e.dataset.plan,e.value]))}})()`);
 const row={viewport:size,method:'Chrome headless CDP mouse events and synthetic keyboard; DOM read-only; no handler calls or programmatic state mutations',target:target.id,actions:[],steps:[],exceptions};const actions=row.actions;results.push(row);
 const record=async(name)=>{await wait(500);const s=await state();const img=await send('Page.captureScreenshot',{format:'png',fromSurface:true});const file=`${size.width}-${name}.png`;await writeFile(path.join(out,file),Buffer.from(img.data,'base64'));row.steps.push({name,screenshot:file,...s});await writeFile(path.join(out,'observations.json'),JSON.stringify(results,null,2));};
 const ensureLeft=async()=>{if(!await read('document.querySelector(".workspace").classList.contains("left-open")')) await click('[data-action=toggle-left]')};
 const ensureRight=async()=>{if(!await read('document.querySelector(".workspace").classList.contains("right-open")')) await click('[data-action=toggle-right]')};
 try{
  await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url});for(let i=0;i<80;i++){if(await read('document.readyState==="complete"&&!!document.querySelector(".workspace")&&!!document.querySelector("#chart canvas")'))break;await wait(100)}await wait(1000);
  await record('initial');await ensureLeft();await record('list-open');await click('[data-trade="600000-2"]');await ensureRight();await record('28-entry-before-edit');
  await input('[data-plan=entry]','57.25');await record('28-entry-draft');
  await click('[data-action=step]');await record('29-holding');await click('[data-action=next-node]');await record('33-holding');await click('[data-action=step]');await record('34-holding');await click('[data-action=next-node]');await record('41-holding');await click('[data-action=next-node]');await record('49-exit');
  await ensureLeft();await click('[data-trade="600000-3"]');await ensureRight();await record('trade3-before-edit');await input('[data-plan=entry]','58.25');await record('trade3-draft');await ensureLeft();await click('[data-trade="600000-2"]');await ensureRight();await record('trade2-restored');await ensureLeft();await click('[data-trade="600000-3"]');await ensureRight();await record('trade3-restored');
 }catch(e){row.error=e.stack;console.error(size.width,e.stack)}finally{await writeFile(path.join(out,'observations.json'),JSON.stringify(results,null,2));ws.close();await fetch(`http://127.0.0.1:9225/json/close/${target.id}`)}
}
await checkManifest('after');
console.log(JSON.stringify(results.map(r=>({viewport:r.viewport,error:r.error,exceptions:r.exceptions,steps:r.steps.map(s=>({name:s.name,selected:s.selected,stage:s.stage,market:s.market,note:s.note,date:s.date,markers:s.markers,entry:s.fields.entry,right:s.right.className,chart:s.chart}))})),null,2));
