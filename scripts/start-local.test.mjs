import { describe, expect, test } from "vitest";

import {
  buildStartEnvironment,
  buildVinextArguments,
  isMainModule,
  resolveExtraCaCertificates,
} from "./start-local.mjs";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

describe("local server TLS environment", () => {
  test("defaults to managed derived recovery without opting into source network writes", () => {
    expect(buildStartEnvironment({env:{TRADEREVIEW_DB_PATH:'/tmp/private-start.sqlite'},exists:()=>false})).toMatchObject({TRADEREVIEW_HOME_WORKER:'1',HOME_SOURCE_SYNC:'0'});
    expect(buildStartEnvironment({env:{TRADEREVIEW_DB_PATH:'/tmp/private-start.sqlite',TRADEREVIEW_HOME_WORKER:'0',HOME_SOURCE_SYNC:'1'},exists:()=>false})).toMatchObject({TRADEREVIEW_HOME_WORKER:'0',HOME_SOURCE_SYNC:'1'});
    for(const name of ['TRADEREVIEW_HOME_WORKER','HOME_SOURCE_SYNC'])expect(()=>buildStartEnvironment({env:{TRADEREVIEW_DB_PATH:'/tmp/private-start.sqlite',[name]:'yes'},exists:()=>false})).toThrow(/0.*1/);
    expect(()=>buildStartEnvironment({env:{TRADEREVIEW_DB_PATH:'/tmp/../unsafe.sqlite'},exists:()=>false})).toThrow(/unsafe/);
    expect(()=>buildVinextArguments(['--port','not-a-port'])).toThrow(/port/i);
  });
  test("starts the development server through the same TLS-aware launcher", () => {
    expect(buildVinextArguments(["--dev", "--host", "127.0.0.1"])).toEqual([
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3022",
    ]);
  });

  test("keeps an explicitly configured CA bundle", () => {
    expect(
      resolveExtraCaCertificates({
        env: { NODE_EXTRA_CA_CERTS: "/custom/ca.pem" },
        exists: () => false,
      }),
    ).toBe("/custom/ca.pem");
  });

  test("selects the first existing system CA bundle", () => {
    expect(
      resolveExtraCaCertificates({
        env: {},
        exists: (path) => path === "/etc/ssl/cert.pem",
      }),
    ).toBe("/etc/ssl/cert.pem");
  });

  test("does not disable TLS when no system CA bundle is available", () => {
    expect(
      buildStartEnvironment({
        env: { PATH: "/usr/bin" },
        exists: () => false,
        cwd: "/workspace/tradereview",
      }),
    ).toEqual({
      PATH: "/usr/bin",
      TRADEREVIEW_DB_PATH: "/workspace/tradereview/.data/tradereview.sqlite",
      TRADEREVIEW_HOME_WORKER: "1",
      HOME_SOURCE_SYNC: "0",
    });
  });

  test("keeps an explicitly configured database path", () => {
    expect(
      buildStartEnvironment({
        env: {
          PATH: "/usr/bin",
          TRADEREVIEW_DB_PATH: "/var/lib/tradereview/tradereview.sqlite",
        },
        exists: () => false,
        cwd: "/workspace/tradereview",
      }),
    ).toEqual({
      PATH: "/usr/bin",
      TRADEREVIEW_DB_PATH: "/var/lib/tradereview/tradereview.sqlite",
      TRADEREVIEW_HOME_WORKER: "1",
      HOME_SOURCE_SYNC: "0",
    });
  });

  test("uses the shared runtime config for database and fixed port defaults", () => {
    const directory = mkdtempSync(join(tmpdir(), "trade-review-runtime-"));
    const databasePath = join(directory, "tradereview.sqlite");
    const configPath = join(directory, "runtime.json");
    writeFileSync(configPath, JSON.stringify({ databasePath, port: 3123, hostname: "127.0.0.1" }));
    writeFileSync(databasePath, "");

    expect(buildStartEnvironment({
      env: { NODE_ENV: "development", TRADEREVIEW_RUNTIME_CONFIG: configPath },
      exists: (path) => path === configPath || path === databasePath,
      cwd: "/workspace/tradereview",
    })).toMatchObject({ TRADEREVIEW_DB_PATH: databasePath });
    expect(buildVinextArguments([], {
      env: { NODE_ENV: "development", TRADEREVIEW_RUNTIME_CONFIG: configPath },
      exists: () => false,
      cwd: "/workspace/tradereview",
    })).toEqual(["start", "--hostname", "127.0.0.1", "--port", "3123"]);
  });

  test("keeps an explicit port supplied by the caller", () => {
    expect(buildVinextArguments(["--dev", "--port", "3025"], {
      env: { NODE_ENV: "test" },
      exists: () => false,
      cwd: "/workspace/tradereview",
    })).toEqual(["dev", "--port", "3025", "--hostname", "127.0.0.1"]);
  });

  test("rejects a repeated semantic option before its last value can hide an invalid value", () => {
    expect(()=>buildVinextArguments(['--dev','--port','invalid','-p','3333'])).toThrow(/duplicate/i);
    expect(()=>buildVinextArguments(['--dev','--host','bad','--hostname=127.0.0.1'])).toThrow(/duplicate/i);
    expect(()=>buildVinextArguments(['--'])).toThrow(/terminator/i);
  });

  test("forwards canonical arguments that both actual consumers interpret consistently", async () => {
    const {parseArgs:parseVinext}=await import(new URL('../cli-args.js',import.meta.resolve('vinext/server/prod-server')).href);
    for(const args of [['-p3333','-H127.0.0.1'],['-p','3333','-H','127.0.0.1'],['--port=3333','--host=127.0.0.1']]){
      const forwarded=buildVinextArguments(['--dev',...args]).slice(1);
      expect(forwarded).toEqual(['--port','3333','--hostname','127.0.0.1']);
      expect(parseVinext(forwarded)).toMatchObject({port:3333,hostname:'127.0.0.1'});
      expect(parseArgs({args:forwarded,options:{port:{type:'string',short:'p'},hostname:{type:'string',short:'H'},host:{type:'string'},help:{type:'boolean',short:'h'}}}).values).toMatchObject({port:'3333',hostname:'127.0.0.1'});
    }
    expect(buildVinextArguments(['--dev','-hp3333'])).toEqual(['dev','--help','--port','3333','--hostname','127.0.0.1']);
  });

  test("fails clearly for malformed explicit runtime config", () => {
    expect(() => buildStartEnvironment({
      env: { TRADEREVIEW_RUNTIME_CONFIG: "/tmp/malformed-runtime.json" },
      readFile: () => "{",
      exists: () => true,
    })).toThrow(/runtime config/i);
  });

  test("refuses to launch with a missing configured main database", () => {
    expect(() => buildStartEnvironment({
      env: { NODE_ENV: "development", TRADEREVIEW_RUNTIME_CONFIG: "/tmp/runtime.json" },
      readFile: () => JSON.stringify({ databasePath: "/tmp/missing-tradereview.sqlite" }),
      exists: (path) => path === "/tmp/runtime.json",
    })).toThrow(/does not exist/i);
  });

  test("keeps unsafe database paths rejected before normalization", () => {
    for (const databasePath of ["/", "/tmp/../unsafe.sqlite", "/tmp/tradereview.sqlite/"]) {
      expect(() => buildStartEnvironment({
        env: { TRADEREVIEW_RUNTIME_CONFIG: "/tmp/runtime.json" },
        readFile: () => JSON.stringify({ databasePath }),
        exists: () => true,
      })).toThrow(/unsafe/i);
    }
  });

  test("recognizes a Unicode launcher path as the main module", () => {
    const directory = mkdtempSync(join(tmpdir(), "tradereview-启动-"));
    const launcherPath = join(directory, "start-local.mjs");
    try {
      expect(isMainModule(`file://${launcherPath}`, launcherPath)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

// Run the unchanged launcher in its own process; only its slow Web/worker
// programs are controlled fixtures. The worker owns a real live descendant.
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function managedFixture(workerMode='running',extraEnv={},args=[]){
  const directory=realpathSync(mkdtempSync(join(tmpdir(),'managed-home-start-')));
  for(const name of ['start-local.mjs','runtime-config.mjs'])copyFileSync(fileURLToPath(new URL(name,import.meta.url)),join(directory,name));
  writeFileSync(join(directory,'start-production.mjs'),`import {writeFileSync} from 'node:fs';import {spawn} from 'node:child_process';if(process.env.FIXTURE_WEB_DESCENDANT==='1'){const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});process.stdout.write('ready');setInterval(()=>{},1000)"],{stdio:['ignore','pipe','ignore']});child.stdout.once('data',()=>writeFileSync(process.env.FIXTURE_DIR+'/descendant.pid',String(child.pid)));}writeFileSync(process.env.FIXTURE_DIR+'/web.pid',String(process.pid));if(process.argv.includes('--help'))setTimeout(()=>process.exit(0),200);process.on('SIGTERM',()=>setTimeout(()=>process.exit(0),Number(process.env.FIXTURE_WEB_STOP_DELAY??0)));setInterval(()=>{},1000);`);
  writeFileSync(join(directory,'home-worker.mjs'),`import {writeFileSync} from 'node:fs';import {spawn} from 'node:child_process';writeFileSync(process.env.FIXTURE_DIR+'/worker.pid',String(process.pid));if(process.env.FIXTURE_WORKER==='fail')process.exit(17);const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});writeFileSync(process.env.FIXTURE_DIR+'/descendant.pid',String(child.pid));setInterval(()=>{},1000);`);
  // The native EPERM was captured once but fresh empty-group probes returned
  // ESRCH. Inject that OS result in the actual launcher, retaining real groups
  // and real ps membership rather than simulating the shutdown algorithm.
  if(extraEnv.FIXTURE_PROBE)writeFileSync(join(directory,'probe.mjs'),`
    import cp from 'node:child_process';
    import {syncBuiltinESMExports} from 'node:module';
    import {writeFileSync} from 'node:fs';
    const kill=process.kill.bind(process);
    process.kill=(pid,signal)=>{
      if(pid<0&&signal===0){
        writeFileSync(process.env.FIXTURE_DIR+'/probe.pid',String(-pid));
        if(['live','ps-failure'].includes(process.env.FIXTURE_PROBE))throw Object.assign(new Error('injected kill EPERM'),{code:'EPERM'});
        try{return kill(pid,signal);}catch(error){if(error.code==='ESRCH')throw Object.assign(new Error('injected kill EPERM'),{code:'EPERM'});throw error;}
      }
      return kill(pid,signal);
    };
    if(process.env.FIXTURE_PROBE==='ps-failure'){
      cp.execFileSync=()=>{throw new Error('injected membership read failure');};
      syncBuiltinESMExports();
    }
  `);
  const child=spawn(process.execPath,[...(extraEnv.FIXTURE_PROBE?['--import',join(directory,'probe.mjs')]:[]),join(directory,'start-local.mjs'),...args],{env:{...process.env,NODE_ENV:'test',TRADEREVIEW_DB_PATH:join(directory,'private.sqlite'),FIXTURE_DIR:directory,FIXTURE_WORKER:workerMode,...extraEnv},stdio:['ignore','pipe','pipe']});
  let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  const exited=once(child,'exit');
  const pid=name=>Number(readFileSync(join(directory,name+'.pid'),'utf8'));
  const wait=async predicate=>{const until=Date.now()+5000;while(!predicate()){if(Date.now()>until)throw new Error('managed fixture timeout: '+log);await pause(20);}};
  const gone=id=>{try{process.kill(id,0);return false;}catch(error){if(error.code==='ESRCH')return true;throw error;}};
  return {child,exited,pid,wait,gone,log:()=>log,exists:name=>existsSync(join(directory,name+'.pid')),async cleanup(){
    child.kill('SIGTERM');await Promise.race([exited,pause(1500)]);
    for(const name of ['worker','web','descendant'])if(existsSync(join(directory,name+'.pid'))){const id=pid(name);try{process.kill(-id,'SIGKILL');}catch{}try{process.kill(id,'SIGKILL');}catch{}}
    if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await exited;rmSync(directory,{recursive:true,force:true});
  }};
}
test('managed startup rejects invalid launch specifications before either program can run',async()=>{
  const f=await managedFixture('running',{},['--port','invalid']);try{await f.wait(()=>f.child.exitCode!==null);expect(f.child.exitCode,f.log()).not.toBe(0);expect(f.exists('worker')).toBe(false);expect(f.exists('web')).toBe(false);}finally{await f.cleanup();}
},10000);
test('managed startup handles help without running a worker',async()=>{
  const f=await managedFixture('fail',{},['-h']);try{await f.wait(()=>f.child.exitCode!==null);expect(f.child.exitCode,f.log()).toBe(0);expect(f.exists('web')).toBe(true);expect(f.exists('worker')).toBe(false);}finally{await f.cleanup();}
},10000);
test('managed startup preserves worker failure and cleans a SIGKILLed worker descendant',async()=>{
  const f=await managedFixture();try{await f.wait(()=>f.exists('worker')&&f.exists('web')&&f.exists('descendant'));const worker=f.pid('worker'),descendant=f.pid('descendant'),web=f.pid('web');process.kill(worker,'SIGKILL');
    await f.wait(()=>f.child.exitCode!==null);expect(f.child.exitCode,f.log()).not.toBe(0);await f.wait(()=>f.gone(descendant)&&f.gone(web));
  }finally{await f.cleanup();}
},12000);
test('managed startup fails closed when its worker cannot initialize',async()=>{
  const f=await managedFixture('fail', {TRADEREVIEW_HOME_WORKER:'1'});try{await f.wait(()=>f.child.exitCode!==null);expect(f.child.exitCode,f.log()).toBe(17);if(f.exists('web'))await f.wait(()=>f.gone(f.pid('web')));}finally{await f.cleanup();}
},12000);
test.each(['1','0'])('managed startup stops normally with explicit worker=%s',async enabled=>{
  const f=await managedFixture('running',{TRADEREVIEW_HOME_WORKER:enabled});try{await f.wait(()=>f.exists('web')&&(enabled==='0'||f.exists('descendant')));f.child.kill('SIGTERM');const [code]=await f.exited;expect(code,f.log()).toBe(0);expect(f.exists('worker')).toBe(enabled==='1');await f.wait(()=>f.gone(f.pid('web')));if(enabled==='1')await f.wait(()=>f.gone(f.pid('descendant')));
  }finally{await f.cleanup();}
},12000);

test('managed startup verifies empty owned groups after signal-0 EPERM',async()=>{
  const f=await managedFixture('running',{TRADEREVIEW_HOME_WORKER:'0',FIXTURE_PROBE:'empty'});
  try{
    await f.wait(()=>f.exists('web'));f.child.kill('SIGTERM');
    const [code]=await f.exited;
    expect(f.exists('probe')).toBe(true);expect(code,f.log()).toBe(0);
    expect(f.gone(f.pid('web'))).toBe(true);
  }finally{await f.cleanup();}
},10000);
test.each(['live','ps-failure'])('managed startup cannot mistake %s membership evidence for a gone group',async mode=>{
  const f=await managedFixture('running',{TRADEREVIEW_HOME_WORKER:'0',FIXTURE_PROBE:mode,FIXTURE_WEB_STOP_DELAY:'10000',FIXTURE_WEB_DESCENDANT:mode==='ps-failure'?'1':'0'});
  try{
    await f.wait(()=>f.exists('web')&&(mode!=='ps-failure'||f.exists('descendant')));f.child.kill('SIGTERM');
    await f.wait(()=>f.exists('probe'));
    if(mode==='live'){
      expect(f.gone(f.pid('web'))).toBe(false);
      expect(f.child.exitCode,f.log()).toBe(null);
      await f.wait(()=>f.child.exitCode!==null);
      const [code]=await f.exited;expect(code,f.log()).toBe(0);
    }else{
      await f.wait(()=>f.child.exitCode!==null);
      const [code]=await f.exited;expect(code,f.log()).not.toBe(0);
      expect(f.gone(f.pid('web')),f.log()).toBe(true);
      expect(f.gone(f.pid('descendant')),f.log()).toBe(true);
      expect(f.log().match(/injected membership read failure/g)).toHaveLength(1);
    }
    expect(f.gone(f.pid('web'))).toBe(true);
  }finally{await f.cleanup();}
},10000);
