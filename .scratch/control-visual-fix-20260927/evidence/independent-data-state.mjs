import {chromium} from '/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'/Users/zhoulin/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-x64/chrome-headless-shell'});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const out={time:new Date().toISOString(),purpose:'read-only UI data-state exploration, not final implementation acceptance',url:'http://127.0.0.1:3044/',states:[],errors:[]};
page.on('pageerror',e=>out.errors.push(e.message));
try {
 await page.goto(out.url); await page.getByRole('heading',{name:'我的交易室',exact:true}).waitFor({timeout:90000});
 const account=page.getByRole('combobox',{name:'账户范围',exact:true});
 const options=await account.locator('option').evaluateAll(es=>es.map((e,index)=>({index,value:e.value,label:e.textContent})));
 out.accounts=options;
 await page.getByRole('combobox',{name:'报告计价',exact:true}).selectOption('CNY');
 const history=page.locator('section[aria-label="历史持仓估值"]');
 const tabs=await history.getByRole('tab').evaluateAll(es=>es.map(e=>({name:e.getAttribute('aria-label')||e.textContent,text:e.textContent})));
 out.periods=tabs;
 for (const opt of options) {
  await account.selectOption(opt.value); await page.waitForTimeout(500);
  for (const tab of tabs) {
   await history.getByRole('tab',{name:tab.name,exact:true}).click();await page.waitForTimeout(200);
   const paths=await history.locator('path[data-history-series]').evaluateAll(es=>es.map(e=>({currency:e.getAttribute('data-history-series'),path:e.getAttribute('d')})));
   const alloc=page.locator('section[aria-label="当前持仓资产分布"]');
   const row={accountIndex:opt.index,period:tab.name,paths:paths.map(p=>({currency:p.currency,length:p.path?.length||0,commands:(p.path?.match(/[ML]/g)||[]).length})),donut:await alloc.locator('[data-testid="allocation-donut"]').count(),historyText:(await history.innerText()).slice(0,450),allocationText:(await alloc.innerText()).slice(0,650)};
   out.states.push(row);
   if(row.paths.some(p=>p.commands>1)||row.donut){await history.screenshot({path:new URL(`./independent-data-state-account${opt.index}-${out.states.length}.png`,import.meta.url).pathname});}
  }
 }
 out.exploration='All options of initial real-account selector, CNY, all preset holding-observation tabs, default total-value/day. No custom date, alternate nature, original currency, or alternate metric exhaustive scan.';
 console.log(JSON.stringify({accounts:options.length,periods:tabs.length,states:out.states.length,withCurves:out.states.filter(s=>s.paths.some(p=>p.commands>1)).map(s=>({accountIndex:s.accountIndex,period:s.period})),withDonut:out.states.filter(s=>s.donut).map(s=>({accountIndex:s.accountIndex,period:s.period})),errors:out.errors}));
}finally{await fs.writeFile(new URL('./independent-data-state.json',import.meta.url),JSON.stringify(out,null,2));await browser.close();}
