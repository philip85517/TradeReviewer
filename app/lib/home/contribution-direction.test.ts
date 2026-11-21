import {expect,it} from 'vitest';
import type {TradeExecution} from '../trades/types';
import type {MonthlyStatement} from '../import/monthly-statement';
import {classifyContributionDirection} from './contribution-direction';
const fill=(id:string,side:'buy'|'sell',effect?:TradeExecution['source']['positionEffect'],market='US'):TradeExecution=>({id,accountId:'A',accountLabel:'A',instrument:{id:market+':X',symbol:'X',name:'X',market,currency:market==='US'?'USD':'CNY'},side,quantity:'10',price:'10',fee:'0',executedAt:`2026-01-${side==='buy'?'02':'03'}T15:00:00Z`,source:{platform:'statement',row:1,positionEffect:effect}});
it('uses direction evidence independently of business confirmation and timestamp precision',()=>{
 const buy=fill('b','buy','open-long'),sell=fill('s','sell','close-long');sell.source.timePrecision='date-only';
 expect(classifyContributionDirection([buy,sell],[],false).category).toBe('long');
 expect(classifyContributionDirection([fill('b','buy',undefined,'CN-SH'),fill('s','sell',undefined,'CN-SH')],[],false).category).toBe('long');
});
it('recognizes pure short but keeps mixed and contradictory directions unallocated',()=>{
 expect(classifyContributionDirection([fill('s','sell','open-short'),fill('b','buy','close-short')],[],false).category).toBe('short');
 expect(classifyContributionDirection([fill('s','sell','open-short'),fill('b','buy','open-long')],[],false).category).toBeNull();
 expect(classifyContributionDirection([fill('b','buy','close-long')],[],false).category).toBeNull();
 expect(classifyContributionDirection([fill('s','sell','open-short','CN-SH')],[],false).category).toBeNull();
});
it('does not call IPO or incomplete foreign inventory ordinary long',()=>{
 const monthly:MonthlyStatement={documentId:'ipo',templateIds:[],reviewRequired:false,positions:[],events:[{id:'alloc',accountId:'A',market:'US',symbol:'X',date:'2026-01-01',kind:'ipo',quantity:'10',description:'allotment',source:[]}]};
 expect(classifyContributionDirection([fill('s','sell','close-long')],[monthly],false).category).toBeNull();
 expect(classifyContributionDirection([fill('b','buy')],[],false).category).toBeNull();
 // An already verified ordinary source chain retains its existing classification.
 expect(classifyContributionDirection([fill('b','buy')],[],true).category).toBe('long');
});

it('classifies the pure verified 06049 allotment scope as IPO while refusing mixed or unbacked quantities',()=>{
 const event:MonthlyStatement['events'][number]={documentId:'futu:e2ec4b711458a760',id:'futu:e2ec4b711458a760:evidence:1:37',accountId:'futu:1001100100280855',market:'HK',symbol:'06049',date:'2019-12-18',kind:'ipo',quantity:'200',displayTimePolicy:'session-open',description:'存入股票 2019/12/18 06049 保利物業 +200 5653048 Dep - IPO Allotment',source:[{page:1,row:37,role:'stock'}]};
 const instrument={id:'HK:6049',symbol:'6049',name:'保利物业',market:'HK',currency:'HKD'},account={accountId:event.accountId,accountLabel:'Futu'};
 const buy:TradeExecution={id:'verified-ipo:futu:1001100100280855:6049:5653048',...account,instrument,side:'buy',quantity:'200',price:'35.4537',fee:'50',executedAt:'2019-12-18T00:00:00.000Z',source:{platform:'futu',inputKind:'statement',fileFingerprint:'a'.repeat(64),formatRuleId:'manual/verified-ipo-allotment@1',sourceTradeId:'5653048',positionEffect:'open-long',displayTimePolicy:'session-open',timePrecision:'date-only',marketCalendarDate:'2019-12-18',positionEvents:[event],row:0}};
 const sell:TradeExecution={id:'futu:e2ec4b711458a760:1:19',...account,instrument,side:'sell',quantity:'200',price:'40',fee:'29.12',executedAt:'2019-12-18T09:23:23Z',source:{platform:'futu',formatRuleId:'futu/pdf/f1-execution@1',fileFingerprint:'e2ec4b711458a760',marketCalendarDate:'2019-12-18',positionEvents:[event],row:19}};
 const monthly:MonthlyStatement={documentId:event.documentId!,templateIds:[],reviewRequired:false,positions:[],events:[event,{...event,id:'cash-application',quantity:undefined,amount:'-14181.48',description:'IPO App 400 Shares',source:[{page:1,row:30,role:'cash'}]}]};
 expect(classifyContributionDirection([buy,sell],[monthly],false)).toEqual({category:'ipo',reasons:[]});
 const variants:[TradeExecution[],MonthlyStatement[]][]=[
  [[buy,sell,{...buy,id:'ordinary-buy',source:{platform:'futu',positionEffect:'open-long',row:2}}],[monthly]],
  [[buy,{...sell,quantity:'201'}],[monthly]],
  [[buy,{...sell,executedAt:'2019-12-17T09:23:23Z',source:{...sell.source,marketCalendarDate:'2019-12-17'}}],[monthly]],
  [[buy,{...sell,source:{...sell.source,positionEffect:'open-short'}}],[monthly]],
  [[buy,sell],[{...monthly,events:[...monthly.events,{...event,id:'transfer',kind:'transfer-in'}]}]],
  [[buy,sell],[{...monthly,events:[...monthly.events,{...event,id:'unbacked-allotment',quantity:'100'}]}]],
  [[buy,sell],[{...monthly,events:[{...event,quantity:'201'}]}]],
  [[buy,sell],[{...monthly,positions:[{accountId:event.accountId,market:'HK',symbol:'06049',date:'2019-12-01',phase:'opening',quantity:'200',source:[]}]}]],
 ];
 for(const [executions,statements] of variants)expect(classifyContributionDirection(executions,statements,true).category).toBeNull();
});
