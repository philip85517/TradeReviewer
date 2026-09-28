import {chromium} from '/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const out=new URL('./evidence/',import.meta.url).pathname;
const b=await chromium.launch({headless:true,executablePath:'/Users/zhoulin/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-x64/chrome-headless-shell'});
const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1});const p=await c.newPage();p.setDefaultTimeout(20000);
const r={input:'Playwright emulated touch, NOT physical touchscreen',checks:[],errors:[]};p.on('pageerror',e=>r.errors.push(e.message));
try{await p.goto('http://127.0.0.1:3044');await p.getByRole('heading',{name:'我的交易室',exact:true}).waitFor({timeout:90000});
r.coarse=await p.evaluate(()=>matchMedia('(pointer:coarse)').matches);assert(r.coarse);
await p.getByRole('combobox',{name:'报告计价',exact:true}).selectOption('CNY');
await p.getByRole('tab',{name:'持仓历史：全部',exact:true}).tap();
const hist=p.locator('section[aria-label="历史持仓估值"]');await hist.locator('svg path[data-history-series]').first().waitFor();
await hist.locator('svg').tap({position:{x:150,y:80}});const tip=hist.getByRole('tooltip');await tip.waitFor();assert.equal(await tip.getAttribute('data-selection-source'),'touch');
const dims=await tip.boundingBox(),svg=await hist.locator('svg').boundingBox();assert(dims.y>=svg.y+svg.height-1,'Mobile tooltip must flow below plot');await hist.screenshot({path:out+'touch-holdings.png'});
const close=hist.getByRole('button',{name:'关闭持仓详情'});const cb=await close.boundingBox();assert(cb.height>=42&&cb.width>=42,JSON.stringify(cb));await close.tap();assert.equal(await tip.count(),0);r.checks.push('tap real chart opens aligned detail, tap close clears');
r.targets=await p.locator('[aria-label="持仓曲线指标"] button,[aria-label="持仓曲线粒度"] button,[aria-label="持仓历史期间"] button,[aria-label="交易室共享范围"] button,[aria-label="交易室共享范围"] select').evaluateAll(es=>es.map(e=>({label:e.getAttribute('aria-label')||e.textContent,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
assert(r.targets.every(x=>x.height>=42),JSON.stringify(r.targets));r.checks.push('coarse-pointer controls at least 42px high');
assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);assert.deepEqual(r.errors,[]);r.status='PASS';
}catch(e){r.status='FAIL';r.error=e.stack;process.exitCode=1;}finally{await fs.writeFile(out+'touch-real.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r,null,2));await b.close();}
