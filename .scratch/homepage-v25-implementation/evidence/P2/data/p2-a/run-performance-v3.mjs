import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const base=".scratch/homepage-v25-implementation/evidence/P2/data/p2-a/";
const sample=process.argv[2]??"1",shape=process.argv[3]??"rounds";
const child=spawn(process.execPath,["node_modules/vitest/vitest.mjs","run","--config",`${base}performance-v3.config.ts`],{env:{...process.env,P2_SAMPLE:sample,P2_SHAPE:shape},stdio:["ignore","pipe","pipe"],detached:true});
let output="";child.stdout.on("data",chunk=>output+=chunk);child.stderr.on("data",chunk=>output+=chunk);
let timeout=false;const timer=setTimeout(()=>{timeout=true;process.kill(-child.pid,"SIGTERM");},20000);
child.on("exit",(code,signal)=>{clearTimeout(timer);writeFileSync(`${base}benchmark-v3-${shape}-${sample}.log`,output);writeFileSync(`${base}benchmark-v3-${shape}-${sample}-exit.json`,JSON.stringify({code,signal,timeout,runtime:process.version},null,2));console.log(JSON.stringify({sample,shape,code,signal,timeout}));process.exitCode=code??124;});
