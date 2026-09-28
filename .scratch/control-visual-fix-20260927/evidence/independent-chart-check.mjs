import {chromium} from '/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'/Users/zhoulin/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-x64/chrome-headless-shell'});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(20000);
const result={time:new Date().toISOString(),url:'http://127.0.0.1:3044/',checks:[],errors:[],geometry:[]};page.on('pageerror',e=>result.errors.push(e.message));
const out=new URL('./',import.meta.url).pathname;
const check=async(name,fn)=>{try{result.checks.push({name,status:'PASS',detail:await fn()});console.log('PASS '+name)}catch(e){result.checks.push({name,status:'FAIL',error:e.message});console.log('FAIL '+name+' '+e.message.slice(0,250))}};
const shot=async(name,loc)=>loc.screenshot({path:out+'independent-chart-'+name+'.png'});
const history=page.locator('section[aria-label="历史持仓估值"]');const perf=page.locator('section[aria-label="业绩趋势与日历"]');
const measure=async()=>{await page.waitForTimeout(300);return page.locator('svg[role="img"]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),m=e.getScreenCTM();return {label:e.getAttribute('aria-label'),width:r.width,height:r.height,viewBox:e.getAttribute('viewBox'),ratio:m.a/m.d,paths:[...e.querySelectorAll('path')].map(p=>(p.getAttribute('d')||'').length)}}))};
try{
await page.goto(result.url);await page.getByRole('heading',{name:'我的交易室',exact:true}).waitFor({timeout:90000});
await page.getByRole('combobox',{name:'账户范围',exact:true}).selectOption('all');await page.getByRole('combobox',{name:'报告计价',exact:true}).selectOption('CNY');
await page.getByRole('tab',{name:'持仓历史：全部',exact:true}).click();await page.getByRole('tablist',{name:'交易室期间',exact:true}).getByRole('tab',{name:'全部',exact:true}).click();await page.waitForTimeout(1000);
await check('real holding curve, mouse tooltip and close',async()=>{
 assert(await history.locator('path[data-history-series]').evaluateAll(es=>es.some(e=>(e.getAttribute('d')||'').length>30)));
 const svg=history.getByRole('img');await svg.scrollIntoViewIfNeeded();const box=await svg.boundingBox();await page.mouse.move(box.x+box.width*.25,box.y+box.height*.4);
 const tip=history.getByRole('tooltip');await tip.waitFor();const text=await tip.innerText();assert(text.includes('总市值'));await shot('holding-mouse',history);await page.mouse.move(5,5);await tip.waitFor({state:'hidden'});return {text:text.slice(0,400)};
});
await check('holding keyboard date changes and Escape',async()=>{
 const interaction=page.getByRole('group',{name:'持仓曲线交互',exact:true});await interaction.focus();await interaction.press('Home');const first=await history.getByRole('tooltip').locator('time').innerText();await interaction.press('ArrowRight');const second=await history.getByRole('tooltip').locator('time').innerText();assert.notEqual(first,second);await shot('holding-keyboard',history);await interaction.press('End');const last=await history.getByRole('tooltip').locator('time').innerText();assert.notEqual(first,last);await interaction.press('Escape');assert.equal(await history.getByRole('tooltip').count(),0);return {first,second,last};
});
await check('holding granularity and metrics visible outcomes',async()=>{
 const rows=[];for(const name of ['周','月','日']){await page.getByRole('group',{name:'持仓曲线粒度',exact:true}).getByRole('button',{name,exact:true}).click();await page.waitForTimeout(150);const label=await history.getByRole('img').getAttribute('aria-label');assert(label.startsWith(name));rows.push({name,label,options:await page.getByRole('combobox',{name:'历史持仓日期',exact:true}).locator('option').count()})}
 assert(rows[0].options<rows[2].options);assert(rows[1].options<rows[0].options);
 for(const name of ['未实现盈亏','未实现收益率','总市值']){await page.getByRole('group',{name:'持仓曲线指标',exact:true}).getByRole('button',{name,exact:true}).click();assert((await history.getByRole('img').getAttribute('aria-label')).includes(name))}return rows;
});
await check('performance mouse point and keyboard detail',async()=>{
 const points=perf.locator('[data-chart-role="point-hit-area"]');const first=points.first();await first.scrollIntoViewIfNeeded();await first.hover();await first.click();const status=perf.getByRole('status',{name:'趋势点详情',exact:true});await status.waitFor();const a=await status.innerText();const last=points.last();await last.focus();await last.press('Enter');const b=await status.innerText();assert.notEqual(a,b);await shot('performance-selected',perf);return {first:a,last:b,pointCount:await points.count()};
});
await check('performance daily weekly monthly bins',async()=>{const rows=[];for(const name of ['日','周','月']){await perf.getByRole('group',{name:'趋势分桶',exact:true}).getByRole('button',{name,exact:true}).click();rows.push({name,points:await perf.locator('[data-chart-role="point-hit-area"]').count()})}assert(rows[0].points>rows[2].points);return rows});
await check('calendar levels and bottom cells',async()=>{const rows=[];for(const name of ['年','全部年份','月']){await perf.getByRole('group',{name:'日历层级',exact:true}).getByRole('button',{name,exact:true}).click();const region=perf.getByRole('region',{name:'盈亏日历',exact:true});await shot('calendar-'+name,region);rows.push({name,text:(await region.innerText()).slice(0,650)});}return rows});
for(const [width,height] of [[1440,1000],[1920,1080],[1055,900],[821,900],[820,900],[390,844]]){
 await page.setViewportSize({width,height});await check('chart geometry and selected state '+width,async()=>{const rows=await measure();assert(rows.every(r=>Math.abs(r.ratio-1)<.015));assert.equal(await page.getByRole('tab',{name:'持仓历史：全部',exact:true}).getAttribute('aria-selected'),'true');result.geometry.push({width,rows});await shot('holdings-'+width,history);await shot('performance-'+width,perf);return rows});
}
await check('no pageerrors or HMR overlay',async()=>{assert.deepEqual(result.errors,[]);assert.equal(await page.locator('vite-error-overlay').count(),0)});
}finally{await fs.writeFile(out+'independent-chart-results.json',JSON.stringify(result,null,2));await browser.close()}
