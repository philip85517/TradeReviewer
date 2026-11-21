import { existsSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { resolveRuntimeConfig } from "./runtime-config.mjs";

const SYSTEM_CA_CANDIDATES = [
  "/etc/ssl/cert.pem",
  "/etc/ssl/certs/ca-certificates.crt",
  "/etc/pki/tls/certs/ca-bundle.crt",
];

export function resolveExtraCaCertificates({
  env = process.env,
  exists = existsSync,
} = {}) {
  const configured = env.NODE_EXTRA_CA_CERTS?.trim();
  if (configured) return configured;
  return SYSTEM_CA_CANDIDATES.find((path) => exists(path));
}

export function buildStartEnvironment(options = {}) {
  const env = { ...(options.env ?? process.env) };
  const caPath = resolveExtraCaCertificates(options);
  if (caPath) env.NODE_EXTRA_CA_CERTS = caPath;
  const runtime = resolveRuntimeConfig(options);
  if (runtime.databasePathSource === "config" && !(options.exists ?? existsSync)(runtime.databasePath)) {
    throw new Error(`Configured SQLite database does not exist: ${runtime.databasePath}`);
  }
  env.TRADEREVIEW_DB_PATH = runtime.databasePath;
  for (const [name, fallback] of [["TRADEREVIEW_HOME_WORKER", "1"], ["HOME_SOURCE_SYNC", "0"]]) {
    env[name] ??= fallback;
    if (env[name] !== "0" && env[name] !== "1") throw new Error(`${name} must be 0 or 1`);
  }
  return env;
}

export function buildVinextArguments(args = [], options = {}) {
  const runtime = resolveRuntimeConfig(options);
  const input = args[0] === "--dev" ? args.slice(1) : args;
  const {values,tokens} = parseArgs({args:input,tokens:true,options:{
    port:{type:'string',short:'p'}, hostname:{type:'string',short:'H'}, host:{type:'string'}, help:{type:'boolean',short:'h'},
    ...(args[0] === '--dev' ? {verbose:{type:'boolean'},turbopack:{type:'boolean'},'experimental-https':{type:'boolean'},'prerender-all':{type:'boolean'},precompress:{type:'boolean'},'prerender-concurrency':{type:'string'}} : {}),
  }});
  // Both Web entries receive only canonical, unique options. In particular,
  // vinext ignores compact shorts/--host and validates repeated values in order.
  const forwarded = [], seen = new Set();
  for(const token of tokens){
    if(token.kind !== 'option')throw new Error('Argument terminators are not supported');
    const name=token.name === 'host' ? 'hostname' : token.name;
    if(seen.has(name))throw new Error(`Duplicate option: --${name}`);
    seen.add(name);forwarded.push(`--${name}`);
    if(token.value !== undefined)forwarded.push(token.value);
  }
  if(values.port !== undefined && (!values.port.trim() || !Number.isInteger(Number(values.port)) || Number(values.port)<1 || Number(values.port)>65535)) throw new Error('Invalid port');
  for(const name of ['host','hostname'])if(values[name] !== undefined && (!values[name].trim() || values[name].includes('\0') || values[name].startsWith('-'))) throw new Error('Invalid hostname');
  const concurrency=values['prerender-concurrency'];
  if(concurrency !== undefined && (!Number.isInteger(Number(concurrency)) || Number(concurrency)<1)) throw new Error('Invalid prerender concurrency');
  const hasPort = values.port !== undefined;
  const hasHostname = values.host !== undefined || values.hostname !== undefined;
  return [
    args[0] === "--dev" ? "dev" : "start",
    ...forwarded,
    ...(hasHostname ? [] : ["--hostname", runtime.hostname]),
    ...(hasPort ? [] : ["--port", String(runtime.port)]),
  ];
}

export function startLocalServer(args = process.argv.slice(2)) {
  const command = process.platform === "win32" ? "vinext.cmd" : "vinext";
  const environment = buildStartEnvironment();
  // Complete all configuration and argument validation before either spawn.
  const launchArguments = buildVinextArguments(args);
  const development = launchArguments[0] === 'dev';
  const grouped = process.platform !== 'win32', owned = [];
  let stopping = false, failure = null;
  const signalGroup = (child, signal) => {
    if (!child.pid) return;
    try { if(grouped) process.kill(-child.pid,signal); else child.kill(signal); }
    catch(error) { if(error.code !== 'ESRCH') throw error; }
  };
  const alive = child => {
    if(!child.pid)return false;
    if(!grouped)return child.exitCode === null && child.signalCode === null;
    try {process.kill(-child.pid,0);return true;} catch(error) {
      if(error.code === 'ESRCH')return false;
      if(error.code !== 'EPERM')throw error;
      // A denied signal probe does not establish whether the owned group is
      // empty. Only a successful independent membership read can do that.
      const output=execFileSync('/bin/ps',['-axo','pgid='],{encoding:'utf8',timeout:1000});
      const groups=output.trim().split(/\s+/);
      if(!groups.every(group=>/^\d+$/.test(group)))throw new Error('Cannot read process-group membership');
      return groups.some(group=>Number(group)===child.pid);
    }
  };
  const handlers = new Map();
  const stop = (code, signal='SIGTERM') => {
    if(code && failure === null) failure=code;
    if(stopping)return;
    stopping=true;
    for(const child of owned)signalGroup(child,signal);
    const started=Date.now();
    let probeFailureReported=false;
    const timer=setInterval(()=>{
      // Group ownership survives a worker SIGKILL: its build/source/GC children
      // still belong to this group even when its own stop handler cannot run.
      if(Date.now()-started>=2000)for(const child of owned)signalGroup(child,'SIGKILL');
      let groupsGone=false;
      try {groupsGone=owned.every(child=>!alive(child));} catch(error) {
        // Unknown membership must not skip the remaining cleanup/escalation.
        failure ??= 1;
        if(!probeFailureReported){console.error(`无法检查本地服务进程组：${error.message}`);probeFailureReported=true;}
      }
      if(groupsGone || Date.now()-started>=3000){
        clearInterval(timer);
        for(const [name,handler]of handlers)process.off(name,handler);
        process.exitCode=failure ?? 0;
      }
    },25);
  };
  for(const signal of ['SIGINT','SIGTERM']){
    const handler=()=>stop(0,signal);handlers.set(signal,handler);process.on(signal,handler);
  }
  const launch = (program, parameters, worker=false) => {
    const child=spawn(program,parameters,{env:environment,stdio:'inherit',detached:grouped});
    owned.push(child);
    child.on('error',error=>{console.error(`无法启动${worker?'首页后台进程':'本地服务'}：${error.message}`);stop(1);});
    child.on('close',(code,signal)=>{if(!stopping)stop(worker ? (code || 1) : (signal ? 1 : code ?? 1));});
    return child;
  };
  if(environment.TRADEREVIEW_HOME_WORKER === '1' && !launchArguments.includes('--help'))launch(process.execPath,[fileURLToPath(new URL('./home-worker.mjs',import.meta.url))],true);
  launch(development ? command : process.execPath,development ? launchArguments : [fileURLToPath(new URL('./start-production.mjs',import.meta.url)),...launchArguments.slice(1)]);
}

export function isMainModule(moduleUrl = import.meta.url, argvPath = process.argv[1]) {
  return Boolean(argvPath && fileURLToPath(moduleUrl) === resolve(argvPath));
}

if (isMainModule()) {
  startLocalServer();
}
