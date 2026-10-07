import { copyFile, mkdir, readFile, readlink, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { acquireDeploymentLock } from '../../scripts/deploy.mjs';
import { beginNativeToolkitTransaction } from '../../scripts/deploy-native-toolkit.mjs';
import { assertNativeEnvironment } from '../../scripts/native-environment.mjs';

const targetDir='/Users/zhoulin/projects/交易空间/TradingReview';
const sourceDir=resolve('.');
const reports=join(sourceDir,'.scratch/native-debug-baseline/reports');
const files=['Makefile','DEPLOYMENT.md',...['deploy-native.mjs','deploy-source.mjs','deploy-native-runtime.mjs','deploy.mjs','deploy-native-toolkit.mjs','native-environment.mjs','native-environment.json','start-native.command'].map(name=>join('ops',name))];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const listener = () => execFileSync('lsof',['-nP','-iTCP:3022','-sTCP:LISTEN','-Fp'],{encoding:'utf8'});
assertNativeEnvironment();
const before={current:await readlink(join(targetDir,'app/current')),configHash:hash(await readFile(join(targetDir,'config/runtime.json'))),listener:listener()};
await mkdir(join(reports,'control-backups'),{recursive:true});
const manifest=[];
for (const name of files) {
  const file=join(targetDir,name);
  try {
    const data=await readFile(file);
    const info=await stat(file);
    const backup=join(reports,'control-backups',name);
    await mkdir(resolve(backup,'..'),{recursive:true});
    await copyFile(file,backup);
    manifest.push({name,existed:true,sha256:hash(data),mode:info.mode & 0o777});
  } catch(error) { if(error.code!=='ENOENT') throw error; manifest.push({name,existed:false}); }
}
await writeFile(join(reports,'control-backups/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const unlock=await acquireDeploymentLock(targetDir);
let transaction;
try {
  transaction=await beginNativeToolkitTransaction({targetDir,toolkitDir:sourceDir});
  const statusText=execFileSync('make',['-s','-C',targetDir,'deploy-status'],{encoding:'utf8',timeout:15000});
  await writeFile(join(reports,'installed-native-status.json'),statusText);
  const status=JSON.parse(statusText);
  if(!status.healthy || !status.consistent || !status.serviceRuntime) throw new Error('Installed status failed consistency acceptance');
  const dryRun=execFileSync('make',['-s','-C',targetDir,'deploy',`DEPLOY_SOURCE=${sourceDir}`,'REF=63690a494b8ad403081c7720985be54a95db60c7','DRY_RUN=1'],{encoding:'utf8',timeout:15000});
  await writeFile(join(reports,'installed-native-dry-run.json'),dryRun);
  const after={current:await readlink(join(targetDir,'app/current')),configHash:hash(await readFile(join(targetDir,'config/runtime.json'))),listener:listener()};
  if(JSON.stringify(before)!==JSON.stringify(after)) throw new Error('Production pointer/config/listener changed during toolkit installation');
  execFileSync('zsh',['-n',join(targetDir,'ops/start-native.command')]);
  await transaction.discard();
  await writeFile(join(reports,'installed-controls-acceptance.json'),JSON.stringify({before,after,status:{activeRelease:status.activeRelease,healthy:status.healthy,consistent:status.consistent,toolingRuntime:status.toolingRuntime,serviceRuntime:status.serviceRuntime},files},null,2)+'\n');
  console.log(JSON.stringify({installed:true,activeRelease:status.activeRelease,pid:status.observed.pid,healthy:status.healthy,consistent:status.consistent}));
} catch(error) { if(transaction) await transaction.restore(); throw error; }
finally { await unlock(); }
