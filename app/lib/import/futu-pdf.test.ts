import { describe, expect, it } from 'vitest';
import { detectFutuPdfStatement, parseFutuPdfPages } from './futu-pdf';
import { resolveFutuTemplate } from './futu-template-profile';
import { f4, legacy, page } from './__fixtures__/futu-pdf-layouts';
import { contracts } from './__fixtures__/futu-pdf-contracts';
const options = {fileName:'synthetic.pdf',fileFingerprint:'synthetic'};
describe('Futu PDF evidence parsing',()=>{
  it.each([
    ['交易合約明細', undefined, 'F0', 'supported'],
    ['訂單合計 買賣方向 價格', '買賣方向 訂單日期 價格', 'F4a', 'unsupported'],
    ['交易明細', '買賣方向 價格 成交金額', 'F4', 'supported'],
    ['交易明細', '方向 價格 成交金額', 'F1', 'supported'],
  ])('resolves verified template %s / %s', (documentText, headerText, id, status) => {
    expect(resolveFutuTemplate({ documentText, headerText })).toMatchObject({ id, status });
  });

  it('does not classify an unknown transaction header as a supported template', () => {
    expect(resolveFutuTemplate({ documentText: '交易明細', headerText: '成交方向 成交价' })).toMatchObject({
      id: 'unknown',
      status: 'unsupported',
    });
  });

  it('blocks an unknown transaction header instead of falling back to F1', () => {
    const pages = legacy('F1');
    for (const item of pages[0].items) {
      if (item.text === '方向') item.text = '成交方向';
      if (item.text === '價格') item.text = '成交价';
      if (item.text === '成交金額') item.text = '成交金额';
    }
    const result = parseFutuPdfPages(pages, { ...options, sourceTimezone: 'Asia/Hong_Kong' });
    expect(result.blocked).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'unsupported-futu-template')).toBe(true);
  });

  it.each([
    ['沽空','sell','open-short'], ['賣空','sell','open-short'], ['卖空','sell','open-short'],
    ['賣出開倉','sell','open-short'], ['卖出开仓','sell','open-short'],
    ['補回','buy','close-short'], ['补回','buy','close-short'],
    ['買入平倉','buy','close-short'], ['买入平仓','buy','close-short'],
    ['賣出','sell',undefined], ['買入','buy',undefined],
  ])('retains explicit position effect for %s without inferring generic direction', (direction,side,effect)=>{
    const pages=legacy('F3');pages[0].items.find(i=>i.text==='補回')!.text=direction!;
    const r=parseFutuPdfPages(pages,{...options,sourceTimezone:'Asia/Hong_Kong'});
    expect(r.blocked).toBe(false);expect(r.records).toHaveLength(2);
    for(const record of r.records){expect(record.side).toBe(side);expect(record.source.positionEffect).toBe(effect);}
  });
  it('detects content rather than a filename and accepts summary months',()=>{
    expect(detectFutuPdfStatement(pageOnly('富途 美股現金賬戶月結單 2020年01月')).matched).toBe(true);
    expect(detectFutuPdfStatement(pageOnly('Tiger 月結單')).matched).toBe(false);
  });
  it('preserves cross-page children and assigns each reported net fee exactly once',()=>{
    const r=parseFutuPdfPages(f4(),options);
    expect(r.blocked).toBe(false);
    expect(r.records.map(x=>[x.quantity,x.fee,x.side])).toEqual([['100','1','sell'],['200','2','sell']]);
    expect(r.records[0].source.fragments?.map(x=>x.page)).toContain(1);
    expect(r.records[0].source.sourceTimezone).toBe('Asia/Hong_Kong');
    expect(r.monthly?.month).toBe('2025-06');
  });
  it('infers a market timezone for an early execution and records its confidence',()=>{
    const r=parseFutuPdfPages(legacy('F1'),options);
    expect(r.blocked).toBe(false);
    expect(r.records[0]).toMatchObject({
      quantity:'140',price:'10',fee:'2',side:'buy',executedAt:'2020-01-27T16:30:42Z',
      source:{sourceTimezone:'America/New_York',timeEvidence:'inferred',timeConfidence:0.93},
    });
    expect(r.records[0].source).toMatchObject({
      timeRuleId: 'futu/time/market-session@1',
      timeCandidates: [{ timezone: 'America/New_York', score: 0.93 }],
    });
    expect(r.records[0].source.timeInferenceReason).toContain('市场');
  });
  it('retains order dates without claiming execution seconds',()=>{
    const r=parseFutuPdfPages(legacy('F2'),options);
    expect(r.records[0]).toMatchObject({executedAt:'2020-01-27',source:{sourceTimeKind:'order',timePrecision:'date-only'}});
  });
  it('does not import order totals and conserves allocated fees',()=>{
    const r=parseFutuPdfPages(legacy('F3'),{...options,sourceTimezone:'America/New_York'});
    expect(r.records.map(x=>x.quantity)).toEqual(['100','40']);
    expect(r.records.map(x=>x.fee)).toEqual(['1.42857143','0.57142857']);
    expect(new Set(r.records.map(x=>x.id)).size).toBe(2);
  });
  it('blocks broken group quantities instead of silently accepting a partial month',()=>{
    const pages=f4(); pages[1].items.find(i=>i.text==='200')!.text='150';
    const r=parseFutuPdfPages(pages,options);
    expect(r.blocked).toBe(true);
    expect(r.diagnostics.some(d=>d.severity==='error')).toBe(true);
  });
  it('reads space-separated HK identities and never infers fees from grouped cash changes',()=>{
    const pages=legacy('F1');
    pages[0].items.find(i=>i.text.includes('美股'))!.text='富途 港股賬戶月結單 2020年01月';
    pages[0].items.find(i=>i.text==='DEMO(Synthetic')!.text='01234 合成證券';
    pages[0].items.find(i=>i.text==='Company)')!.text='名稱';
    pages[0].items.find(i=>i.text==='-1402.00')!.text='0.00';
    const r=parseFutuPdfPages(pages,{...options,sourceTimezone:'Asia/Hong_Kong'});
    expect(r.records[0]).toMatchObject({instrument:{symbol:'01234',market:'HK'},fee:'2',source:{feeStatus:'reported'}});
  });
  it('keeps identical executions as distinct source rows',()=>{
    const pages=legacy('F3');
    const items=pages[0].items;
    items.find(i=>i.text==='140')!.text='200';items.find(i=>i.text==='1400.00')!.text='2000.00';
    const second=items.find(i=>i.text==='40')!;second.text='100';second.x-=4;second.width+=4;
    const amount=items.find(i=>i.text==='400.00')!;amount.text='1000.00';amount.x-=4;amount.width+=4;
    const r=parseFutuPdfPages(pages,{...options,sourceTimezone:'America/New_York'});
    expect(r.records.map(x=>x.quantity)).toEqual(['100','100']);
    expect(new Set(r.records.map(x=>x.id)).size).toBe(2);
  });
  it('marks missing fees unknown instead of claiming a reported zero',()=>{
    const pages=legacy('F1');pages[0].items=pages[0].items.filter(i=>!/佣金|交收費|小計/.test(i.text));
    const r=parseFutuPdfPages(pages,{...options,sourceTimezone:'America/New_York'});
    expect(r.records[0].source.feeStatus).toBe('unknown');
    expect(r.monthly?.reviewRequired).toBe(true);
  });
  it('excludes fund sections and option contracts from stock replay',()=>{
    const pages=f4();pages[0].items.find(i=>i.text==='01234(合成股票)')!.text='DEMO250620C00100000(合成期權)';
    const r=parseFutuPdfPages(pages,options);
    expect(r.records).toHaveLength(0);expect(r.exclusions[0].category).toBe('unknown-asset');
    const funds=f4();funds[0].items.find(i=>i.text==='交易-股票和股票期權')!.text='交易-基金';
    expect(parseFutuPdfPages(funds,options).records).toHaveLength(0);
  });
  it('recovers a date above and clock below an order row',()=>{
    const pages=legacy('F2'),items=pages[0].items;
    const stamp=items.find(i=>i.text==='2020/01/27 11:30:42')!;
    items.push({...stamp,text:'11:30:42',y:stamp.y+6});stamp.text='2020/01/27';stamp.y-=6;
    const r=parseFutuPdfPages(pages,options);
    expect(r.records[0]).toMatchObject({executedAt:'2020-01-27',source:{sourceTimestampText:'2020/01/27 11:30:42'}});
  });
  it('reads fee numbers below their labels without counting the subtotal twice',()=>{
    const pages=legacy('F1'),items=pages[0].items;
    for(const [label,value] of [['佣金：','1.00'],['交收費：','1.00'],['小計：','2.00']]){
      const item=items.find(i=>i.text.startsWith(label))!;
      items.push({...item,text:value,y:item.y+6});item.text=label;
    }
    const r=parseFutuPdfPages(pages,{...options,sourceTimezone:'Asia/Hong_Kong'});
    expect(r.blocked).toBe(false);expect(r.records[0].fee).toBe('2');
  });
  it('resolves a market-local legend per transaction when rows need different source zones',()=>{
    const pages=f4();
    for(const p of pages)for(const i of p.items){
      if(i.text==='01234(合成股票)')i.text='DEMO(Synthetic)';
      if(i.text==='HKD')i.text='USD';
      if(i.text.includes('按照香港'))i.text='本結單所展示的時間按照當地證券及期貨市場時間顯示';
    }
    const venues=pages[1].items.filter(i=>i.text==='SEHK');
    venues[0].text='OCEA';
    venues[1].text='EDGX';
    const clocks=pages[1].items.filter(i=>i.text==='09:30:00');
    clocks[0].text='12:10:38';
    clocks[1].text='22:03:16';
    const r=parseFutuPdfPages(pages,options);
    expect(r.blocked).toBe(false);
    expect(r.diagnostics.some(d=>d.code==='futu-time-evidence-conflict')).toBe(false);
    expect(r.records).toHaveLength(2);
    expect(r.records[0]).toMatchObject({
      executedAt:'2025-06-25T16:10:38Z',
      source:{sourceTimezone:'America/New_York',timeEvidence:'inferred',timeConfidence:0.93},
    });
    expect(r.records[1]).toMatchObject({
      executedAt:'2025-06-25T14:03:16Z',
      source:{sourceTimezone:'Asia/Hong_Kong',timeEvidence:'inferred',timeConfidence:0.78},
    });
  });
  it('blocks contradictory document legends until an explicit reviewed override',()=>{
    const pages=f4();pages[1].items.push({x:20,y:800,text:'本結單所展示的時間按照當地證券市場時間顯示',width:300,height:8});
    expect(parseFutuPdfPages(pages,options).blocked).toBe(true);
    expect(parseFutuPdfPages(pages,{...options,sourceTimezone:'Asia/Hong_Kong'}).blocked).toBe(true);
    const resolved=parseFutuPdfPages(pages,{...options,sourceTimezone:'America/New_York',overrideDocumentTimezone:true});
    expect(resolved.blocked).toBe(false);
    expect(resolved.records[0].source.sourceTimezone).toBe('America/New_York');
    expect(resolved.records[0].source.timeEvidence).toBe('user');
  });
  it('does not turn a child with a missing clock into a fabricated execution',()=>{
    const pages=f4();pages[1].items=pages[1].items.filter(i=>i.text!=='09:30:00');
    const r=parseFutuPdfPages(pages,options);
    expect(r.blocked).toBe(true);
  });
  it('does not transfer an unresolved child fee to the remaining valid child',()=>{
    const pages=legacy('F3'),items=pages[0].items;
    items.find(i=>i.text==='2020/01/27')!.text='2024/03/10';
    const clocks=items.filter(i=>i.text==='11:30:42');clocks[0].text='02:30:00';clocks[1].text='03:30:00';
    const r=parseFutuPdfPages(pages,{...options,sourceTimezone:'America/New_York'});
    expect(r.records).toHaveLength(1);expect(r.records[0].fee).toBe('0.57142857');
  });
  it('blocks inconsistent consolidated cash instead of hiding it through allocation',()=>{
    const pages=f4();pages[1].items.find(i=>i.text==='999')!.text='990';
    expect(parseFutuPdfPages(pages,options).blocked).toBe(true);
  });
  it('reads date-only contracts, fee grids and cash totals without importing ledger duplicates',()=>{
    const r=parseFutuPdfPages(contracts(),options);
    expect(r.blocked).toBe(false);
    expect(r.records.map(x=>[x.executedAt,x.side,x.quantity,x.price,x.fee])).toEqual([
      ['2016-01-04','buy','100','10.25','8'],['2016-01-05','sell','100','11','8.04'],
    ]);
    expect(r.records[0].source).toMatchObject({sourceTimeKind:'date',timePrecision:'date-only',settlementDate:'2016-01-07',grossAmount:'1025',cashChange:'-1033'});
    expect(r.records[0].source.sourceTimezone).toBe('');
    expect(r.monthly).toMatchObject({month:'2016-01',templateIds:['F0'],reviewRequired:true});
  });
  it('accepts a positively identified empty contract table without inventing trades',()=>{
    const r=parseFutuPdfPages(contracts(true),options);
    expect(r.blocked).toBe(false);expect(r.records).toHaveLength(0);expect(r.monthly?.templateIds).toEqual(['F0']);
  });
  it('blocks broken contract gross, fees and statement cash totals',()=>{
    for(const [before,after] of [['1025.00','999.00'],['58.96','59.96'],['3.00','BAD']]){
      const pages=contracts();pages[0].items.find(i=>i.text===before)!.text=after;
      expect(parseFutuPdfPages(pages,options).blocked).toBe(true);
    }
  });
  it('does not steal a numeric name suffix from the prior security',()=>{
    const pages=legacy('F1'),items=pages[0].items;
    items.find(i=>i.text==='Company)')!.text='2017(Post Spt)';
    const anchor=items.find(i=>i.text==='補回')!;
    items.find(i=>i.text==='期末總覽')!.y+=200;
    const next=items.filter(i=>i.y===anchor.y).map(i=>({...i,y:i.y+100,text:i.text==='補回'?'賣出':i.text}));
    next.push({...anchor,x:139,y:anchor.y+100,text:'NEXT(Next Stock)'});
    items.push(...next);
    const r=parseFutuPdfPages(pages,{...options,sourceTimezone:'Asia/Hong_Kong'});
    expect(r.records.map(x=>x.instrument.symbol)).toEqual(['DEMO','NEXT']);
    expect(r.records[0].instrument.name).toContain('2017(PostSpt');
  });
  it('a timezone override cannot clear a structural or instrument block',()=>{
    const pages=legacy('F1');pages[0].items.find(i=>i.text==='DEMO(Synthetic')!.text='???(Unknown';
    const r=parseFutuPdfPages(pages,{...options,sourceTimezone:'Asia/Hong_Kong'});
    expect(r.blocked).toBe(true);
  });
  it('keeps contract fee evidence across a page break',()=>{
    const [first]=contracts();
    const splitY=first.items.find(i=>i.text==='1025.00')!.y;
    const second={...first,pageNumber:2,items:first.items.filter(i=>i.y>=splitY).map(i=>({...i,y:i.y-splitY+30}))};
    first.items=first.items.filter(i=>i.y<splitY);
    const r=parseFutuPdfPages([first,second],options);
    expect(r.blocked).toBe(false);expect(r.records.map(x=>x.fee)).toEqual(['8','8.04']);
    expect(r.records[0].source.fragments?.some(f=>f.page===2&&f.role==='gross-and-fees')).toBe(true);
  });
  it('does not append fee text aligned with the identity column to security names',()=>{
    const pages=legacy('F1');pages[0].items.find(i=>i.text==='交收費：1.00')!.x=139;
    const r=parseFutuPdfPages(pages,{...options,sourceTimezone:'Asia/Hong_Kong'});
    expect(r.records[0].instrument.name).not.toContain('費');
  });
});
function pageOnly(text:string){return [page([[[20,text]]])];}
