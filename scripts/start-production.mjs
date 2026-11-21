import {statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';

/** Resolve lazy SSR and API modules before accepting connections. No result is
 * synthesized here. An existing publication is checked on the serving
 * connection; an empty database can immediately serve recovery status. */
export async function initializeHomeRuntime(handler,origin='http://localhost') {
  for(const path of ['/home','/api/home/status?reader=full-home-v1&verify=publication']) {
    const response=await handler.fetch(new Request(new URL(path,origin)),undefined,{waitUntil(promise){Promise.resolve(promise).catch(()=>{});},passThroughOnException(){}});
    if(!response.ok)throw new Error(`Production initialization ${path}: HTTP ${response.status}`);
    // SSR imports can occur while the response body is being streamed.
    await response.arrayBuffer();
  }
}

export async function loadProductionEnvironment(root=process.cwd(),processEnv=process.env) {
  // Use the pinned vinext loader itself: its Next-compatible priority differs
  // from Vite's, and runtime database/environment choices must not change.
  const {loadDotenv}=await import(new URL('../config/dotenv.js',import.meta.resolve('vinext/server/prod-server')).href);
  loadDotenv({root,mode:'production',processEnv});
}

export async function startProduction(args=process.argv.slice(2)) {
  const {values}=parseArgs({args,options:{port:{type:'string',short:'p'},hostname:{type:'string',short:'H'},host:{type:'string'},help:{type:'boolean',short:'h'}}});
  if(values.help){console.log('start-production [--hostname 127.0.0.1] [--port 3333]');return;}
  await loadProductionEnvironment();
  const port=Number(values.port??process.env.PORT??3000),host=values.hostname??values.host??'0.0.0.0';
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid production port');
  const entry=resolve('dist/server/index.js');
  // Match vinext's import URL so the initialized handler is the one it serves.
  const handler=(await import(`${pathToFileURL(entry).href}?t=${statSync(entry).mtimeMs}`)).default;
  await initializeHomeRuntime(handler);
  const {startProdServer}=await import('vinext/server/prod-server');
  return startProdServer({port,host,outDir:resolve('dist')});
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  startProduction().catch(error=>{console.error(error);process.exitCode=1;});
}
