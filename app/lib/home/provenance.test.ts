import {expect,it} from 'vitest';
import type {TradeExecution} from '../trades/types';
import {resolvedTradeNatureOf} from '../trades/nature-resolution';
import {collectFees,feeBoundary} from './fees';
const common={accountId:'a',market:'HK',symbol:'00001',currency:'HKD',source:[]};
const events=[
 {...common,id:'app',date:'2026-01-08',kind:'ipo' as const,amount:'-220',description:'IPO application'},
 {...common,id:'fee',date:'2026-01-08',kind:'fee' as const,amount:'-2',description:'IPO application fee'},
 {...common,id:'allot',date:'2026-01-10',kind:'ipo' as const,quantity:'2',description:'IPO allotment 123456',displayTimePolicy:'session-open' as const},
 {...common,id:'refund',date:'2026-01-10',kind:'ipo' as const,amount:'20',description:'IPO refund'},
];
const trade=():TradeExecution=>({id:'e',accountId:'a',accountLabel:'A',instrument:{id:'HK:00001',market:'HK',symbol:'00001',name:'Stock',currency:'HKD'},side:'buy',quantity:'2',price:'100',fee:'2',executedAt:'2026-01-10T02:00:00Z',source:{platform:'futu',row:1,inputKind:'statement',formatRuleId:'manual/verified-ipo-allotment@1',fileFingerprint:'a'.repeat(64),sourceTradeId:'123456',positionEffect:'open-long',displayTimePolicy:'session-open',timePrecision:'date-only',positionEvents:structuredClone(events),settlement:{currency:'HKD',quantity:'2',grossAmount:'200',netAmount:'-202',fees:{commission:'2'}}}});
it('recognizes only the evidenced historical IPO import contract',()=>{
 expect(resolvedTradeNatureOf(trade())).toBe('live');
 const mutations=[(e:TradeExecution)=>{e.source.tradeNature='unknown';},(e:TradeExecution)=>{e.source.simulationRunId='sim';},(e:TradeExecution)=>{e.source.fileFingerprint='abc';},(e:TradeExecution)=>{e.source.positionEvents=[];},(e:TradeExecution)=>{e.quantity='2.001';},(e:TradeExecution)=>{e.accountId='other';},(e:TradeExecution)=>{e.executedAt='2026-01-11T02:00:00Z';}];
 for(const mutate of mutations){const e=trade();mutate(e);expect(resolvedTradeNatureOf(e)).toBe('unknown');}
});
it('counts evidenced IPO fees once on their incurred day, preserving unrelated fees',()=>{
 const e=trade(),fees=collectFees({executions:[e],monthly:[{documentId:'s',templateIds:[],reviewRequired:false,positions:[],events:[...events,{...common,id:'other',kind:'fee',date:'2026-02-20',amount:'-3',description:'custody'}]}]});
 expect(feeBoundary(fees,'2026-01-09T15:59:59.999Z').HKD).toEqual({known:'2',missing:0});
 expect(feeBoundary(fees,'2026-02-21T15:59:59.999Z').HKD).toEqual({known:'5',missing:0});
});
it('does not substitute an amount match or invalid date for IPO source identity',()=>{
 const noReference=trade();delete noReference.source.sourceTradeId;
 noReference.source.positionEvents!.find(e=>e.id==='allot')!.amount='200';
 expect(resolvedTradeNatureOf(noReference)).toBe('unknown');
 const badDate=trade();badDate.source.marketCalendarDate='not-a-date';badDate.source.positionEvents!.find(e=>e.id==='allot')!.date='not-a-date';
 expect(resolvedTradeNatureOf(badDate)).toBe('unknown');
});
it('retains a later independent IPO expense and does not suppress invalid execution fees',()=>{
 const e=trade(),later={...common,id:'later',kind:'fee' as const,date:'2026-11-01',amount:'-3',description:'IPO application handling fee'};
 expect(collectFees({executions:[e],monthly:[{documentId:'s',templateIds:[],reviewRequired:false,positions:[],events:[...events,later]}]}).find(f=>f.id.includes('later'))?.amount).toBe('3');
 e.source.settlement!.netAmount='-999';
 expect(collectFees({executions:[e],monthly:[]}).find(f=>f.id==='execution:e')?.amount).toBeNull();
});
it('keeps CNY settlement fees and rejects inconsistent fee totals',()=>{
 const e=trade();e.source.positionEvents=[];e.source.formatRuleId='china-merchants/pdf/monthly-v1';e.source.settlement!.currency='CNY';
 expect(collectFees({executions:[e],monthly:[]})[0]).toMatchObject({currency:'CNY',amount:'2'});
 e.source.settlement!.fees.commission='3';expect(collectFees({executions:[e],monthly:[]})[0].amount).toBeNull();
});
