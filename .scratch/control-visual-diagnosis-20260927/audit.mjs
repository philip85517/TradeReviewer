import { chromium } from '/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('./',import.meta.url).pathname;
const browser=await chromium.launch({headless:true,executablePath:'/Users/zhoulin/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-x64/chrome-headless-shell'});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:3044');
await page.getByRole('heading',{name:'我的交易室',exact:true}).waitFor({timeout:60000});
await page.getByRole('combobox',{name:'报告计价',exact:true}).selectOption('CNY');
await page.getByRole('tab',{name:'今年至今',exact:true}).click();
await page.getByRole('img',{name:'累计盈亏趋势图',exact:true}).waitFor();
const stats=()=>page.evaluate(()=>{
 const style=e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,22),width:b.width,height:b.height,font:s.fontSize,lineHeight:s.lineHeight,padding:s.padding,radius:s.borderRadius,color:s.color,background:s.backgroundColor}};
 return {viewport:innerWidth,dpr:devicePixelRatio,svgs:[...document.querySelectorAll('svg[role="img"]')].map(e=>{const m=e.getScreenCTM();return {...style(e),viewBox:e.getAttribute('viewBox'),sx:m.a,sy:m.d,ratio:m.a/m.d,texts:e.querySelectorAll('text').length}}),controls:[...document.querySelectorAll('[aria-label="交易室共享范围"] button,[aria-label="交易室共享范围"] select,[aria-label="持仓历史期间"] button,[aria-label="持仓曲线指标"] button,[aria-label="持仓曲线粒度"] button,[aria-label="资产分布维度"] button,[aria-label="交易室期间"] button')].map(style),rows:[...document.querySelectorAll('section[aria-label="当前持仓"] tbody tr')].slice(0,5).map(style)};
});
const results={};
results.baseline=await stats();
await page.getByRole('heading',{name:'我的交易室',exact:true}).scrollIntoViewIfNeeded();
await page.screenshot({path:out+'room-1440.png'});
results.periodRules=await page.getByRole('tab',{name:'持仓历史：今年至今',exact:true}).evaluate(e=>{
 const all=[];function walk(rules,href){for(const r of rules){if(r.selectorText){try{if(e.matches(r.selectorText)&&/padding|font-size|min-height/.test(r.style.cssText))all.push({href,selector:r.selectorText,style:r.style.cssText})}catch{}}else if(r.cssRules && (!r.conditionText||matchMedia(r.conditionText).matches))walk(r.cssRules,href)}}
 for(const ss of document.styleSheets){try{walk(ss.cssRules,ss.href)}catch{}}return all;
});
const rangeButton=page.getByRole('tab',{name:'持仓历史：今年至今',exact:true});
await rangeButton.evaluate(e=>e.style.padding='2px 5px');
results.periodPaddingOnly=await rangeButton.evaluate(e=>({height:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize,padding:getComputedStyle(e).padding}));
await rangeButton.evaluate(e=>e.removeAttribute('style'));
await page.getByRole('tablist',{name:'持仓历史期间',exact:true}).locator('button').evaluateAll(es=>es.forEach(e=>e.style.padding='2px 5px'));
results.periodGroupPaddingOnly=await rangeButton.evaluate(e=>({height:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize,padding:getComputedStyle(e).padding}));
await page.getByRole('tablist',{name:'持仓历史期间',exact:true}).locator('button').evaluateAll(es=>es.forEach(e=>e.removeAttribute('style')));
const account=page.getByRole('combobox',{name:'账户范围',exact:true});
await account.selectOption({label:'B2完整样例'});
await page.getByTestId('allocation-donut').waitFor();
results.completeAllocation=await page.getByTestId('allocation-donut').evaluate(e=>{const m=e.getScreenCTM();return {ratio:m.a/m.d,box:e.getBoundingClientRect().toJSON()}});
await page.locator('section[aria-label="当前持仓资产分布"]').screenshot({path:out+'allocation-complete.png'});
await account.selectOption({label:'全部账户'});
await page.getByLabel('CNY 多空净市值小计',{exact:true}).waitFor();
results.partialAllocation=await page.locator('section[aria-label="当前持仓资产分布"]').innerText();

// Minimal reproduction: two rendered SVGs with their actual viewport dimensions,
// no app, database, controls, grid or ancestors. Preserve only one representative glyph.
const minimal=await page.locator('svg[role="img"]').evaluateAll(es=>es.filter(e=>['日级持仓总市值曲线','累计盈亏趋势图'].includes(e.getAttribute('aria-label'))).map(e=>{const b=e.getBoundingClientRect();return {label:e.getAttribute('aria-label'),vb:e.getAttribute('viewBox'),width:b.width,height:b.height}}));
const mini=await browser.newPage();
await mini.setContent(minimal.map(x=>`<svg aria-label="${x.label}" viewBox="${x.vb}" width="${x.width}" height="${x.height}" preserveAspectRatio="none"><circle cx="80" cy="50" r="20"/><text x="120" y="50">示例</text></svg>`).join(''));
const mm=()=>mini.locator('svg').evaluateAll(es=>es.map(e=>{const m=e.getScreenCTM();return {label:e.getAttribute('aria-label'),ratio:m.a/m.d}}));
results.minimalRed=await mm();
await mini.locator('svg').evaluateAll(es=>es.forEach(e=>e.setAttribute('preserveAspectRatio','xMidYMid meet')));
results.minimalMeet=await mm();
await mini.close();
// Single-variable experiments on the real chart DOM; do not persist product changes.
results.experiments=[];
for(const label of ['日级持仓总市值曲线','累计盈亏趋势图']) {
 const svg=page.getByRole('img',{name:label,exact:true});
 const before=await svg.evaluate(e=>({style:e.getAttribute('style'),preserve:e.getAttribute('preserveAspectRatio')}));
 await svg.evaluate(e=>{const b=e.getBoundingClientRect(),v=e.viewBox.baseVal;e.style.height=`${b.width*v.height/v.width}px`;});
 results.experiments.push({label,change:'only CSS height matched to viewBox aspect',data:(await stats()).svgs.filter(e=>e.label===label)});
 await svg.evaluate((e,prev)=>{if(prev.style===null)e.removeAttribute('style');else e.setAttribute('style',prev.style);},before);
 await svg.evaluate(e=>e.setAttribute('preserveAspectRatio','xMidYMid meet'));
 results.experiments.push({label,change:'only preserveAspectRatio=meet',data:(await stats()).svgs.filter(e=>e.label===label)});
 await svg.evaluate((e,prev)=>e.setAttribute('preserveAspectRatio',prev.preserve),before);
}
for(const width of [1055,1920,390]){
 await page.setViewportSize({width,height:1000});
 await page.waitForTimeout(200);
 results[width]=await stats();
 if(width!==390){
 await page.locator('section[aria-label="历史持仓估值"]').screenshot({path:out+`holding-chart-${width}.png`});
 await page.getByRole('img',{name:'累计盈亏趋势图',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:out+`history-${width}.png`});
 }
}
await page.setViewportSize({width:1440,height:1000});
await page.locator('section[aria-label="当前持仓"] button').filter({hasText:'详情'}).first().count();
// Verify the disclosed evidence can expand without fixed-height clipping.
const detail=page.locator('section[aria-label="当前持仓"] tbody details').filter({has:page.locator('summary')}).first();
await detail.locator('summary').click();
results.expandedHolding=await stats();
await page.locator('section[aria-label="当前持仓"]').screenshot({path:out+'holding-expanded.png'});
await page.getByRole('button',{name:'交易库',exact:true}).click();
await page.getByRole('heading',{name:'交易库',exact:true}).waitFor();
results.library=await page.locator('.library-scope-controls input,.library-scope-controls select,.library-shared-browse-controls input,.library-shared-browse-controls select').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return {tag:e.tagName,type:e.type,label:e.getAttribute('aria-label'),height:b.height,font:s.fontSize,radius:s.borderRadius,color:s.color,background:s.backgroundColor}}));
await page.getByRole('heading',{name:'交易库',exact:true}).scrollIntoViewIfNeeded();
await page.screenshot({path:out+'library-1440.png'});
await fs.writeFile(out+'audit-results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({minimalRed:results.minimalRed,minimalMeet:results.minimalMeet,experiments:results.experiments.map(x=>({label:x.label,change:x.change,ratio:x.data[0].ratio})),rows:results.baseline.rows.map(x=>x.height),expandedRows:results.expandedHolding.rows.map(x=>x.height),library:results.library},null,2));
assert(results.minimalRed.every(x=>Math.abs(x.ratio-1)>.05));
assert(results.minimalMeet.every(x=>Math.abs(x.ratio-1)<.001));
assert(results.experiments.every(x=>Math.abs(x.data[0].ratio-1)<.001));
assert.equal(results.completeAllocation.ratio,1);
assert(results.expandedHolding.rows[0].height>results.baseline.rows[0].height);
console.log('PASS causal probes, allocation state comparison and holding expansion');
console.log('periodGroupPaddingOnly',JSON.stringify(results.periodGroupPaddingOnly));
await browser.close();
