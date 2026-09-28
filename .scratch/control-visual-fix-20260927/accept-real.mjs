import {chromium} from '/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('./evidence/',import.meta.url).pathname;
const browser=await chromium.launch({headless:true,executablePath:'/Users/zhoulin/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-x64/chrome-headless-shell'});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const page=await context.newPage();page.setDefaultTimeout(20000);
const result={time:new Date().toISOString(),url:'http://127.0.0.1:3044/',database:'conf/runtime.json actual deployment instance',checks:[],errors:[],screens:[],geometry:[]};
page.on('pageerror',e=>result.errors.push(e.message));
const check=async(name,fn)=>{try{const detail=await fn();result.checks.push({name,status:'PASS',detail});console.log('PASS',name);}catch(e){result.checks.push({name,status:'FAIL',error:e.message});console.log('FAIL',name,e.message.slice(0,250));}};
const shot=async(name,locator)=>{const path=out+name+'.png';if(locator)await locator.screenshot({path});else await page.screenshot({path});result.screens.push(name+'.png');};
const measure=()=>page.locator('svg[role="img"]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),m=e.getScreenCTM();return {label:e.getAttribute('aria-label'),width:r.width,height:r.height,viewBox:e.getAttribute('viewBox'),sx:m.a,sy:m.d,ratio:m.a/m.d,path:e.querySelector('path')?.getAttribute('d')?.length||0,lastLabel:e.querySelector('text:last-child')?.getAttribute('x')}}));
const sameRatio=async()=>{
 // ResizeObserver may settle over multiple frames; poll the actual rendered outcome.
 let rows;for(let i=0;i<30;i++){rows=await measure();if(rows.length&&rows.every(r=>Math.abs(r.ratio-1)<.015))return rows;await page.waitForTimeout(100);}
 assert(rows?.every(r=>Math.abs(r.ratio-1)<.015),JSON.stringify(rows));return rows;
};
try{
await page.goto(result.url);await page.getByRole('heading',{name:'我的交易室',exact:true}).waitFor({timeout:90000});
const scope=page.locator('[aria-label="交易室共享范围"]');
const holdings=page.locator('section[aria-label="当前持仓"]');
const history=page.locator('section[aria-label="历史持仓估值"]');
await check('actual account and currency controls',async()=>{
 const account=page.getByRole('combobox',{name:'账户范围',exact:true});const values=await account.locator('option').evaluateAll(es=>es.map(x=>x.value));assert(values.length>1);
 await account.selectOption(values[1]);assert.equal(await account.inputValue(),values[1]);await account.selectOption('all');
 const cur=page.getByRole('combobox',{name:'报告计价',exact:true});await cur.selectOption('HKD');assert.equal(await cur.inputValue(),'HKD');await cur.selectOption('CNY');return {accountCount:values.length-1};
});
await page.getByRole('tablist',{name:'交易室期间',exact:true}).getByRole('tab',{name:'全部',exact:true}).click();
await page.getByRole('img',{name:'累计盈亏趋势图',exact:true}).waitFor();
await check('first real chart geometry',async()=>{const r=await sameRatio();result.geometry.push({width:1440,rows:r});return r;});
await check('holding metrics, granularity and keyboard readout',async()=>{
 const metric=page.getByRole('group',{name:'持仓曲线指标',exact:true});
 for(const name of ['未实现盈亏','未实现收益率','总市值']){const x=metric.getByRole('button',{name,exact:true});await x.click();assert.equal(await x.getAttribute('aria-pressed'),'true');}
 const gran=page.getByRole('group',{name:'持仓曲线粒度',exact:true});
 for(const name of ['周','月','日']){await gran.getByRole('button',{name,exact:true}).click();assert.equal(await gran.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');}
 await page.getByRole('tab',{name:'持仓历史：近3个自然月',exact:true}).click();
 await page.getByRole('tab',{name:'持仓历史：全部',exact:true}).click();
 await history.locator('svg path').first().waitFor();
 assert((await history.locator('svg path').first().getAttribute('d')).length>10);
 const svg=history.locator('svg[role=img]');await svg.hover({position:{x:150,y:80}});await history.getByRole('tooltip').waitFor();await shot('holding-mouse',history);
 const interaction=page.getByRole('group',{name:'持仓曲线交互',exact:true});await interaction.focus();await interaction.press('End');
 await history.getByRole('tooltip').waitFor();const text=await history.getByRole('tooltip').innerText();assert(text.length>15);await shot('holding-keyboard',history);
 await interaction.press('Escape');assert.equal(await history.getByRole('tooltip').count(),0);
 await page.getByRole('tab',{name:'持仓历史：今年至今',exact:true}).click();return {tooltipShown:true};
});
await check('custom observation dates preserve applied state before apply',async()=>{
 const tab=page.getByRole('tab',{name:'持仓历史：今年至今',exact:true});
 await history.locator('summary').filter({hasText:'自定义观察日期'}).click();
 await page.getByLabel('持仓历史起始日期',{exact:true}).fill('2026-09-01');
 assert.equal(await tab.getAttribute('aria-selected'),'true');
 await history.locator('summary').filter({hasText:'自定义观察日期'}).click();
});
await check('performance actual point selection and resize preserve period',async()=>{
 const point=page.locator('[data-chart-role="point-hit-area"]').last();await point.scrollIntoViewIfNeeded();await point.focus();await point.press('Enter');
 await page.getByRole('status',{name:'趋势点详情',exact:true}).waitFor();
 await shot('performance-point');
 await page.setViewportSize({width:1920,height:1080});await sameRatio();
 assert.equal(await page.getByRole('tablist',{name:'交易室期间',exact:true}).getByRole('tab',{name:'全部',exact:true}).getAttribute('aria-selected'),'true');
 await page.setViewportSize({width:1440,height:1000});
});
await check('allocation dimensions and long explanation disclosure',async()=>{
 const alloc=page.locator('section[aria-label="当前持仓资产分布"]');
 await alloc.getByRole('button',{name:'按资产类型',exact:true}).click();assert.equal(await alloc.getByRole('button',{name:'按资产类型',exact:true}).getAttribute('aria-pressed'),'true');
 await alloc.getByRole('button',{name:'按市场',exact:true}).click();
 const dims=await alloc.boundingBox();assert(dims.height<900,'Default allocation excessively tall: '+dims.height);
 await shot('allocation-real',alloc);const disclosures=alloc.locator('details');const count=await disclosures.count();assert(count>0,'Real incomplete data must retain complete explanations');for(let i=0;i<count;i++){const d=disclosures.nth(i);await d.locator('summary').click();assert(await d.evaluate(e=>e.open));const detailBody=d.locator(':scope > :not(summary)').first();assert(await detailBody.isVisible());assert((await detailBody.innerText()).trim().length>0);await d.locator('summary').click();}return {height:dims.height,details:count};
});
await check('holdings expanded details, search and paging',async()=>{
 const row=holdings.locator('tbody tr').first();await row.waitFor();const before=(await row.boundingBox()).height;
 await row.locator('summary').first().click();const after=(await row.boundingBox()).height;assert(after>before);await shot('holdings-expanded',holdings);await row.locator('summary').first().click();
 const search=page.getByRole('searchbox',{name:'搜索持仓',exact:true});await search.fill('NO_MATCH_DIAGNOSIS');assert.equal(await holdings.locator('tbody tr').count(),0);await search.fill('');
 const next=page.getByRole('button',{name:'下一页持仓',exact:true});if(await next.isEnabled()){const first=await row.innerText();await next.click();assert.notEqual(await row.innerText(),first);await page.getByRole('button',{name:'上一页持仓',exact:true}).click();}
 return {before,after,columns:await holdings.locator('thead th').count()};
});
await page.getByRole('tab',{name:'持仓历史：全部',exact:true}).click();
for(const [width,height] of [[1440,1000],[1920,1080],[1055,900],[821,900],[820,900],[390,844]]){
 await page.setViewportSize({width,height});
 await check('geometry and page overflow '+width,async()=>{
  const g=await sameRatio();result.geometry.push({width,rows:g});
  const holdingSvg=history.locator('svg[role=img]');const axis=await holdingSvg.evaluate(e=>({width:e.viewBox.baseVal.width,last:Number(e.querySelector(':scope > text:last-child')?.getAttribute('x'))}));assert(Math.abs(axis.last-(axis.width-14))<1,'Holding end date must use resized geometry: '+JSON.stringify(axis));
  const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));if(overflow.scroll>overflow.client+1)await shot('overflow-during-acceptance-'+width);assert(overflow.scroll<=overflow.client+1,JSON.stringify(overflow));
  await page.getByRole('heading',{name:'我的交易室',exact:true}).scrollIntoViewIfNeeded();await shot('room-'+width);
  await history.scrollIntoViewIfNeeded();await shot('holding-chart-'+width,history);
  await page.getByRole('img',{name:'累计盈亏趋势图',exact:true}).scrollIntoViewIfNeeded();await shot('history-'+width);return {overflow};
 });
}
await page.setViewportSize({width:1440,height:1000});
await check('library filter navigation and shared visual sizes',async()=>{
 await page.getByRole('button',{name:'交易库',exact:true}).click();await page.getByRole('heading',{name:'交易库',exact:true}).waitFor();
 const account=page.getByRole('combobox',{name:'共享账户',exact:true});await account.selectOption('all');
 const market=page.getByRole('combobox',{name:'按市场筛选',exact:true});const values=await market.locator('option').evaluateAll(es=>es.map(e=>e.value));if(values.length>1){await market.selectOption(values[1]);assert.equal(await market.inputValue(),values[1]);await market.selectOption(values[0]);}
 const search=page.getByRole('searchbox',{name:'搜索股票',exact:true});await search.fill('NO_MATCH_DIAGNOSIS');await search.fill('');
 assert(await page.getByRole('radio',{name:'来源未知',exact:true}).count());
 await page.getByRole('heading',{name:'交易库',exact:true}).scrollIntoViewIfNeeded();await shot('library-1440');
 return await account.evaluate(e=>({height:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize}));
});
await check('return navigation and reload',async()=>{
 await page.getByRole('button',{name:'我的交易室',exact:true}).click();await page.getByRole('heading',{name:'我的交易室',exact:true}).waitFor();
 const before=await page.getByRole('combobox',{name:'报告计价',exact:true}).inputValue();await page.reload();await page.getByRole('heading',{name:'我的交易室',exact:true}).waitFor({timeout:90000});
 assert.equal(await page.getByRole('combobox',{name:'报告计价',exact:true}).inputValue(),before);
 await shot('final-preview');return {currency:before};
});
await check('no new page errors',()=>assert.deepEqual(result.errors,[]));
} catch(e){result.checks.push({name:'setup/unhandled',status:'FAIL',error:e.stack});console.log('FATAL',e.message);}
finally{await fs.writeFile(out+'accept-real.json',JSON.stringify(result,null,2));await browser.close();}
process.exitCode=result.checks.some(c=>c.status==='FAIL')?1:0;
