import { describe, expect, it } from 'vitest';
import type { TradeExecution } from '../trades/types';
import type { MonthlyStatement } from '../import/monthly-statement';
import {applyMonthlyHistoryEvidence} from '../import/statement-evidence';
import { nativePosition } from './finance';
import { resolvedTradeNatureOf } from '../trades/nature-resolution';
const instrument = { id: 'HK:00001', symbol: '00001', name: '证券', market: 'HK', currency: 'HKD' };
function fill(id: string, side: 'buy' | 'sell', quantity: string, price: string, fee: string, day = '2026-01-05'): TradeExecution {
  return { id, accountId: 'a', accountLabel: 'A', instrument, side, quantity, price, fee, executedAt: `${day}T02:00:00Z`, source: { platform: 'futu', row: Number(id) || 1, tradeNature: 'live' } };
}
const run = (executions: TradeExecution[], price = '110', cursor = '2026-01-31T15:59:59.999Z', evidence: MonthlyStatement[] = []) => nativePosition({ executions, markPrice: price, cursor, inventoryIdentity: { accountId: 'a', symbol: '00001', market: 'HK' }, evidence });
describe('native finance projection', () => {
  it('preserves the explicit ordering of a verified session-open acquisition and later sale',()=>{
    const buy=fill('1','buy','500','9','0'),sell=fill('2','sell','500','20','0');
    buy.source={...buy.source,timePrecision:'date-only',displayTimePolicy:'session-open',positionEffect:'open-long'};
    expect(run([sell,buy],'20')).toMatchObject({quantity:'0',realized:'5500',unrealized:'0'});
    delete buy.source.positionEffect;
    expect(run([sell,buy],'20').realized).toBeNull();
    buy.source={...buy.source,timePrecision:'second',displayTimePolicy:'session-open',positionEffect:'open-long'};
    sell.source={...sell.source,timePrecision:'date-only'};
    expect(run([sell,buy],'20').realized).toBeNull();
  });
  it('does not certify costs or profit when exact and date-only fills conflict with source order',()=>{
    const opening=fill('prior','buy','10','10','0','2026-01-04');
    const buy=fill('buy','buy','10','20','0'),sell=fill('sell','sell','10','30','0');
    buy.source={...buy.source,fileFingerprint:'same',sourceOrder:1,timePrecision:'date-only'};
    sell.source={...sell.source,fileFingerprint:'same',sourceOrder:2};
    for(const rows of [[opening,buy,sell],[opening,sell,buy]]){
      const result=run(rows,'30');
      expect(result.averageCost).toBeNull();expect(result.realized).toBeNull();expect(result.unrealized).toBeNull();
      expect(result.reasons).toContain('ambiguous-execution-order');
      expect(run(rows,'30','2026-01-05T03:00:00Z').realized).toBeNull();
    }
  });
  it('lets an independent closing balance restore quantity but not profit after unordered fills',()=>{
    const trades=[fill('1','buy','10','10','0'),fill('2','sell','10','12','0')].map(e=>({...e,source:{...e.source,timePrecision:'date-only' as const}}));
    const evidence:MonthlyStatement[]=[{documentId:'independent',templateIds:[],reviewRequired:false,events:[],positions:[{accountId:'a',market:'HK',symbol:'00001',phase:'closing',date:'2026-01-05',quantity:'0',source:[]}]}];
    for(const rows of [trades,[...trades].reverse()]){
      const result=run(rows,'12',undefined,evidence);expect(result.quantity).toBe('0');expect(result.realized).toBeNull();
    }
  });
  it('orders a US month-end inventory after that market day including daylight saving',()=>{
    const trade={...fill('1','buy','70','93.17','2.98','2023-03-31'),instrument:{id:'US:TSM',symbol:'TSM',name:'TSM',market:'US',currency:'USD'},executedAt:'2023-03-31T17:11:15Z'};
    const evidence:MonthlyStatement[]=[{documentId:'s',templateIds:[],reviewRequired:false,positions:[{accountId:'a',market:'US',symbol:'TSM',phase:'closing',date:'2023-03-31',quantity:'70',source:[]}],events:[]}];
    const read=(cursor:string)=>nativePosition({executions:[trade],evidence,cursor,markPrice:'100'});
    expect(read('2023-03-31T16:00:00Z').quantity).toBe('0');
    expect(read('2023-04-01T04:00:00Z')).toMatchObject({quantity:'70',averageCost:'93.17',openFees:'2.98'});
    const closing={...trade,id:'2',side:'sell' as const,executedAt:'2023-04-05T17:00:00Z',price:'95'};
    expect(nativePosition({executions:[trade,closing],evidence,cursor:'2023-04-06T04:00:00Z',markPrice:'100'})).toMatchObject({quantity:'0',realized:'122.14'});
  });
  it('interleaves date-only fills with their own transaction balance using source order, retaining equal balances',()=>{
    const pos=(row:number,quantity:string)=>({documentId:'china-merchants:f',accountId:'a',market:'HK',symbol:'00001',phase:'closing' as const,date:'2026-01-05',quantity,source:[{page:1,row,role:'transaction-position'}]});
    const positions=[pos(1,'10'),pos(2,'6'),pos(3,'10')];
    const trades=[fill('1','buy','10','10','0'),fill('2','sell','4','12','0'),fill('3','buy','4','10','0')].map((e,i)=>({...e,source:{...e.source,platform:'china-merchants',fileFingerprint:'f',page:1,row:i+1,sourceOrder:i,timePrecision:'date-only' as const,statementPositions:positions}}));
    // Deliberately reverse array order: sourceOrder and row linkage supply sequence.
    expect(run([...trades].reverse(),'12')).toMatchObject({quantity:'10',averageCost:'10',realized:'8',unrealized:'20'});
    const closing:MonthlyStatement[]=[{documentId:'daily',templateIds:[],reviewRequired:false,events:[],positions:[{...pos(99,'10'),documentId:'daily',source:[]}]}];
    for(const rows of [trades,[...trades].reverse()])expect(run(rows,'12',undefined,closing)).toMatchObject({quantity:'10',averageCost:'10',realized:'8',unrealized:'20'});
    expect(run(trades,'12','2026-01-05T15:59:59.998Z').quantity).toBe('0');
  });
  it('expires an old incomplete-month flag at a later proven flat boundary after production overlay',()=>{
    const evidence:MonthlyStatement[]=[{documentId:'jan-gap',month:'2026-01',accountId:'a',historyIncomplete:true,templateIds:[],reviewRequired:true,events:[],positions:[]},{documentId:'feb-flat',month:'2026-02',accountId:'a',templateIds:[],reviewRequired:false,events:[],positions:[{accountId:'a',market:'HK',symbol:'00001',phase:'closing',date:'2026-02-28',quantity:'0',source:[]}]}];
    const trades=applyMonthlyHistoryEvidence([fill('new','buy','2','20','2','2026-03-03')],evidence);
    expect(run(trades,'25','2026-03-23T15:59:59.999Z',evidence)).toMatchObject({quantity:'2',averageCost:'20',unrealized:'8',realized:null,lifetimeComplete:false});
    expect(run(trades,'25','2026-01-30T15:59:59.999Z',evidence).quantity).toBe('0');
    expect(run(trades,'25','2026-01-31T15:59:59.999Z',evidence).quantity).toBeNull();
  });
  it('keeps HKD costs and CNY fee pools separate through partial close and reopen',()=>{
    const cross=(id:string,side:'buy'|'sell',quantity:string,price:string,fee:string,day:string)=>{
      const e=fill(id,side,quantity,price,fee,day);e.source.settlement={currency:'CNY',quantity,grossAmount:'900',netAmount:side==='buy'?'-909':'891',fees:{commission:fee}};return e;
    };
    const trades=[cross('1','buy','100','10','9','2026-01-05'),cross('2','sell','50','12','9','2026-01-06')];
    expect(run(trades,'13')).toMatchObject({quantity:'50',averageCost:'10',openFeesByCurrency:{CNY:'4.5'},realizedByCurrency:{HKD:'100',CNY:'-13.5'},closedFeesByCurrency:{HKD:'0',CNY:'13.5'},unrealized:null});
  });
  it('publishes the canonical source FIFO seam for a proven execution-backed IPO overlap',()=>{
    const ipoEvent: import('../import/monthly-statement').StatementEvent={documentId:'ipo-doc',id:'ipo-1',accountId:'a',market:'HK',symbol:'00001',date:'2026-01-07',kind:'ipo',quantity:'80',displayTimePolicy:'session-open',description:'IPO allotment 1',source:[{page:1,row:1,role:'stock'}]};
    const ipo=fill('ipo-buy','buy','80','165','0','2026-01-07');ipo.source={...ipo.source,positionEffect:'open-long',positionEvents:[ipoEvent],displayTimePolicy:'session-open',marketCalendarDate:'2026-01-07',sourceTradeId:'1'};
    const ordinary=fill('ordinary-buy','buy','100','233','0','2026-01-09');ordinary.source={...ordinary.source,positionEffect:'open-long'};
    const sell=fill('sell','sell','60','393','0','2026-01-13');sell.source={...sell.source,positionEffect:'close-long'};
    const facts=run([ipo,ordinary,sell],'393');
    expect(facts).toMatchObject({quantity:'120',averageCost:'221.666666666666666666666666666666666666666666667',realized:'13680',unrealized:'20560'});
    expect(facts.sourceFifo).toMatchObject({remainingByCategory:{ipo:'20',long:'100'}});
    expect(facts.sourceFifo?.consumptions).toEqual([{closingId:'sell',openingSourceKey:'execution:ipo-buy',category:'ipo',quantity:'60',cashCost:'9900'}]);
  });
  it('does not reapply an earlier FIFO episode to a later pure ordinary round',()=>{
    const ipo=fill('ipo-buy','buy','80','165','0','2026-01-07');
    const ordinary=fill('ordinary-buy','buy','100','233','0','2026-01-09');
    const firstClose=fill('first-close','sell','180','393','0','2026-01-13');
    for(const e of [ipo,ordinary])e.source={...e.source,positionEffect:'open-long'};
    firstClose.source={...firstClose.source,positionEffect:'close-long'};
    const laterBuy=fill('later-buy','buy','100','10','0','2026-01-20');
    const laterSell=fill('later-sell','sell','100','30','0','2026-01-21');
    laterBuy.source={...laterBuy.source,positionEffect:'open-long'};
    laterSell.source={...laterSell.source,positionEffect:'close-long'};
    const ipoEvent: import('../import/monthly-statement').StatementEvent={documentId:'ipo-doc',id:'ipo-1',accountId:'a',market:'HK',symbol:'00001',date:'2026-01-07',kind:'ipo',quantity:'80',displayTimePolicy:'session-open',description:'IPO allotment 1',source:[{page:1,row:1,role:'stock'}]};
    ipo.source={...ipo.source,positionEvents:[ipoEvent],displayTimePolicy:'session-open',marketCalendarDate:'2026-01-07',sourceTradeId:'1'};
    const facts=run([ipo,ordinary,firstClose,laterBuy,laterSell],'30');
    expect(facts).toMatchObject({quantity:'0',realized:'36240',unrealized:'0'});
    expect([...new Set(facts.sourceFifo?.consumptions.map(item=>item.closingId))]).toEqual(['first-close','later-sell']);
  });
  it('does not publish a non-canonical FIFO shadow over a pure MA episode',()=>{
    const first=fill('first','buy','100','10','0','2026-01-07');
    const second=fill('second','buy','100','20','0','2026-01-08');
    const close=fill('close','sell','100','30','0','2026-01-09');
    first.source={...first.source,positionEffect:'open-long'};
    second.source={...second.source,positionEffect:'open-long'};
    close.source={...close.source,positionEffect:'close-long'};
    const facts=run([first,second,close],'30');
    expect(facts).toMatchObject({quantity:'100',averageCost:'15',realized:'1500',unrealized:'1500'});
    expect(facts.sourceFifo).toBeUndefined();
  });
  it('recovers a valid new lot after malformed old prices without certifying old realization',()=>{
    const trades=[fill('1','buy','1','NaN','0'),fill('2','sell','1','120','0','2026-01-06'),fill('3','buy','1','20','1','2026-01-07')];
    expect(run(trades,'25')).toMatchObject({quantity:'1',averageCost:'20',unrealized:'4',realized:null,knownRealized:'0',realizedMissing:1});
  });
  it('recovers a new position after proven flat inventory without certifying old realization', () => {
    const evidence: MonthlyStatement[] = [{ documentId:'gap', templateIds:[], reviewRequired:false, events:[], positions:[
      {accountId:'a',market:'HK',symbol:'00001',phase:'closing',date:'2026-01-05',quantity:'10',source:[]},
      {accountId:'a',market:'HK',symbol:'00001',phase:'closing',date:'2026-01-06',quantity:'0',source:[]},
    ] }];
    const trades=[fill('1','sell','10','8','0','2026-01-02'),fill('2','sell','10','12','0','2026-01-06'),fill('3','buy','10','20','2','2026-01-07')];
    expect(run(trades,'21',undefined,evidence)).toMatchObject({quantity:'10',averageCost:'20',openFees:'2',unrealized:'8',realized:null});
    trades.push(fill('4','sell','5','24','1','2026-01-08'));
    expect(run(trades,'21',undefined,evidence)).toMatchObject({quantity:'5',averageCost:'20',openFees:'1',unrealized:'4',realized:null,knownRealized:'18'});
  });
  it('certifies a documented zero start but does not infer inception from a buy', () => {
    const trades=[fill('1','buy','2','100','0')];
    const evidence: MonthlyStatement[]=[{documentId:'start',templateIds:[],reviewRequired:false,events:[],positions:[{accountId:'a',market:'HK',symbol:'00001',phase:'opening',date:'2026-01-01',quantity:'0',source:[]}]}];
    expect(run(trades,'110',undefined,evidence)).toMatchObject({lifetimeComplete:true});
    expect(run(trades)).toMatchObject({lifetimeComplete:false});
  });
  it('does not certify zero realization when an opening is missing',()=>{
    const short=fill('1','buy','2','100','0');short.source.positionEffect='close-short';
    expect(run([short]).realized).toBeNull();
    expect(run([fill('1','sell','1','100','0')]).realized).toBeNull();
  });
  it('never turns an explicit close-short into a new long when its opening is missing',()=>{
    const trade=fill('1','buy','2','100','0');trade.source.positionEffect='close-short';
    expect(run([trade]).quantity).toBeNull();
  });
  it('recognizes month-only inventory at Shanghai month end even with a session-open display hint',()=>{
    const evidence:MonthlyStatement[]=[{documentId:'s',templateIds:[],reviewRequired:false,positions:[],events:[{id:'i',accountId:'a',market:'HK',symbol:'00001',currency:'HKD',date:'2026-01',kind:'ipo',quantity:'2',description:'IPO allotment',displayTimePolicy:'session-open',source:[]}]}];
    expect(run([],'110','2026-01-31T15:59:59.998Z',evidence).quantity).toBe('0');
    expect(run([],'110','2026-01-31T15:59:59.999Z',evidence).quantity).toBe('2');
  });
  it('does not make a date-only fill known before its Shanghai end-of-day boundary',()=>{
    const trade=fill('1','buy','2','100','0');trade.source.timePrecision='date-only';
    expect(run([trade],'110','2026-01-05T08:00:00Z').quantity).toBe('0');
    expect(run([trade],'110','2026-01-05T15:59:59.999Z').quantity).toBe('2');
  });
  it('keeps future execution-attached IPO evidence and only learns refund cost at its boundary', () => {
    const common={accountId:'a',market:'HK',symbol:'00001',currency:'HKD',source:[]};
    const events=[{...common,id:'app',date:'2026-01-08',kind:'ipo' as const,amount:'-220',description:'IPO application'},{...common,id:'fee',date:'2026-01-08',kind:'fee' as const,amount:'-2',description:'IPO fee'},{...common,id:'allot',date:'2026-01-10',kind:'ipo' as const,quantity:'2',description:'IPO allotment',displayTimePolicy:'session-open' as const},{...common,id:'refund',date:'2026-01-20',kind:'ipo' as const,amount:'20',description:'IPO refund'}];
    const a=fill('1','sell','1','120','1','2026-01-15'),b=fill('2','sell','1','130','1','2026-01-16');
    b.source.positionEvents=events;
    expect(run([a,b],'110','2026-01-14T15:59:59.999Z')).toMatchObject({quantity:'2',averageCost:null});
    expect(run([a,b],'110','2026-01-18T15:59:59.999Z')).toMatchObject({quantity:'0',realized:null});
    expect(run([a,b],'110','2026-01-22T15:59:59.999Z')).toMatchObject({quantity:'0',realized:'46'});
  });
  it('allocates opening fees on partial closes exactly once', () => {
    const result = run([fill('1', 'buy', '2', '100', '4'), fill('2', 'sell', '1', '120', '1', '2026-01-06')]);
    expect(result).toMatchObject({ quantity: '1', averageCost: '100', realized: '17', unrealized: '8', marketValue: '110', fees: '5', openFees: '2' });
  });
  it('uses weighted average and retains sub-eight-place amounts', () => {
    const result = run([fill('1', 'buy', '1', '100', '0'), fill('2', 'buy', '1', '200', '0'), fill('3', 'buy', '1', '300', '0'), fill('4', 'sell', '1', '400', '0')], '350');
    expect(result).toMatchObject({ realized: '200', unrealized: '300' });
    expect(run([fill('1', 'buy', '1', '0.000000000001', '0')], '0.000000000003').unrealized).toBe('0.000000000002');
  });
  it('handles a documented short reversal and refuses an unexplained oversell', () => {
    const trades = [fill('1', 'buy', '1', '100', '0'), { ...fill('2', 'sell', '2', '120', '2'), source: { platform: 'futu', row: 2, tradeNature: 'live' as const, positionEffect: 'open-short' as const } }];
    expect(run(trades)).toMatchObject({ realized: '19', unrealized: '9', quantity: '-1', marketValue: '-110' });
    expect(run([fill('1', 'sell', '1', '100', '0')]).quantity).toBeNull();
  });
  it('separates unknown fees from known inventory and does not certify invalid prices', () => {
    const unknown = fill('1', 'buy', '2', '100', '0'); unknown.source.feeStatus = 'unknown';
    expect(run([unknown])).toMatchObject({ quantity: '2', marketValue: '220', unrealized: null });
    expect(run([fill('1', 'buy', '2', 'NaN', '0')])).toMatchObject({ quantity: '2', marketValue: '220', unrealized: null });
  });
  it('keeps statement-only inventory without inventing a cost basis', () => {
    const evidence: MonthlyStatement[] = [{ documentId: 's', templateIds: [], reviewRequired: false, accountId: 'a', month: '2026-01', positions: [{ accountId: 'a', market: 'HK', symbol: '00001', phase: 'opening', date: '2026-01-01', quantity: '2', cost: '100', source: [] }], events: [] }];
    expect(run([], '110', undefined, evidence)).toMatchObject({ quantity: '2', marketValue: '220', unrealized: null, averageCost: null });
  });
  it('strictly resolves legacy NULL nature using source evidence, never broker name alone', () => {
    const old = fill('1', 'buy', '1', '100', '0'); delete old.source.tradeNature;
    expect(resolvedTradeNatureOf(old)).toBe('unknown');
    old.source.fileFingerprint = 'abc'; old.source.formatRuleId = 'futu/pdf/f1-execution@1';
    expect(resolvedTradeNatureOf(old)).toBe('live');
    old.source.simulationRunId = 'run'; expect(resolvedTradeNatureOf(old)).toBe('unknown');
  });
});
