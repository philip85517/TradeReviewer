import {build} from 'vite';
import {fork} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {isAbsolute,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readFileSync,realpathSync} from 'node:fs';
const path=process.env.TRADEREVIEW_DB_PATH;
if(!path||!isAbsolute(path))throw new Error('后台首页进程需要显式绝对数据库路径');
const business=JSON.parse(readFileSync(new URL('../conf/runtime.json',import.meta.url),'utf8')).databasePath;
if(realpathSync(path)===realpathSync(business))throw new Error('本轮开发的后台进程仅允许隔离数据库');
const bundle=resolve('.data/home-worker-runtime/home-build-entry.mjs');
if(process.argv[2]==='--sources'){
 const {coordinator,sourceCompletion}=await import(pathToFileURL(bundle).href);
 const {db,close}=coordinator(path),completion=sourceCompletion(db),controller=new AbortController();
 process.on('SIGTERM',()=>controller.abort());process.on('SIGINT',()=>controller.abort());
 try{while(!controller.signal.aborted){
  try{completion.plan();await completion.runOne(controller.signal);}catch(error){if(!controller.signal.aborted)console.error('数据补齐调度失败',error);}
  if(!controller.signal.aborted)await new Promise(resolve=>{const timer=setTimeout(done,1000);function done(){clearTimeout(timer);controller.signal.removeEventListener('abort',done);resolve();}controller.signal.addEventListener('abort',done,{once:true});});
 }}finally{close();}
}else if(process.argv[2]==='--collect'){
 const {coordinator}=await import(pathToFileURL(bundle).href);
 const {store,close}=coordinator(path);
 try{store.collect();}catch(error){console.error('首页旧结果清理失败，保留已发布结果:',error);process.exitCode=1;}finally{close();}
}else if(process.argv[2]==='--child'){
 const {buildOnce}=await import(pathToFileURL(bundle).href);
 try{const result=buildOnce(path,undefined,process.argv[3]);process.send?.({result});}
 catch(error){process.send?.({error:error instanceof Error?error.message:String(error)});process.exitCode=1;}
}else{
 await build({configFile:false,logLevel:'error',resolve:{alias:{'server-only':resolve('tests/server-only.ts')}},build:{ssr:'scripts/home-build-entry.ts',outDir:resolve('.data/home-worker-runtime'),emptyOutDir:true,minify:false,rollupOptions:{output:{entryFileNames:'home-build-entry.mjs'}}}});
 const {coordinator}=await import(pathToFileURL(bundle).href);
 const {refresh,close}=coordinator(path);let child=null,owner=null,stopped=false,collector=null,pendingResult=null;
 // Maintenance cannot hold the scheduler hostage or turn an accepted release
 // into a failed calculation. SQLite contention while settling a lease is
 // retried by the parent before it can claim any further calculation.
 const settle=()=>{
  if(!pendingResult)return true;
  const result=pendingResult;
  try{if(result.success)refresh.finish(result.owner);else refresh.fail(result.owner,result.error);}
  catch(error){console.error('首页任务状态暂未写入，将重试:',error);return false;}
  pendingResult=null;
  if(result.success&&!stopped&&!collector){
   collector=fork(fileURLToPath(import.meta.url),['--collect'],{stdio:['ignore','inherit','inherit','ipc']});
   collector.on('error',error=>console.error('首页清理进程未启动:',error));
   collector.on('exit',()=>{collector=null;});
  }
  return true;
 };
 let sources=null;
 const startSources=()=>{if(stopped)return;sources=fork(fileURLToPath(import.meta.url),['--sources'],{stdio:['ignore','inherit','inherit','ipc']});sources.on('exit',()=>{sources=null;if(!stopped)setTimeout(startSources,5000);});};
 if(process.env.HOME_SOURCE_SYNC!=='0')startSources();
 const run=()=>{
  if(stopped||child)return;
  if(!settle())return;
  const day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);refresh.tick(day);
  const candidate=randomUUID();if(!refresh.claim(candidate))return;
  owner=candidate;child=fork(fileURLToPath(import.meta.url),['--child',owner],{stdio:['ignore','inherit','inherit','ipc'],execArgv:['--max-old-space-size=8192']});
  let reported=false;
  child.on('message',message=>{
   if(message.error){reported=true;pendingResult={owner:candidate,success:false,error:message.error};settle();console.error('首页后台计算失败:',message.error);}
   if(message.result){reported=true;console.log('首页结果已发布:',JSON.stringify(message.result));pendingResult={owner:candidate,success:true};settle();}
  });
  child.on('error',error=>{reported=true;pendingResult={owner:candidate,success:false,error:error.message};settle();});
  child.on('exit',()=>{if(!reported){pendingResult={owner:candidate,success:false,error:'后台进程中断，等待重试'};settle();}child=null;owner=null;if(stopped)close();});
 };
 const timer=setInterval(()=>{try{if(child&&owner){if(!refresh.heartbeat(owner))child.kill('SIGTERM');}else run();}catch(error){console.error('首页调度失败',error);}},2000);
 const stop=()=>{stopped=true;clearInterval(timer);sources?.kill('SIGTERM');collector?.kill('SIGTERM');settle();if(child)child.kill('SIGTERM');else close();};
 process.on('SIGTERM',stop);process.on('SIGINT',stop);run();
}
