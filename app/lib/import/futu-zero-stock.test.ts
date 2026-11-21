import { describe, expect, it } from 'vitest';
import { readFutuZeroStockEvidence } from './futu-zero-stock';
import { isMonthlyStatement } from './monthly-statement';
const rows = [
 '保證金綜合帳戶(9088) - 證券月結單','資產組合摘要',
 '期初金額(HKD) 期末金額(HKD) 變動(HKD)',
 '現金結餘 0.02 0.02 0.00','資產淨值 0.02 0.02 0.00',
 '期初概覽','期初資產淨值總覽 合計(HKD) 港幣資產 美元資產 人民幣資產 日元資產 新加坡元資產',
 '現金結餘 0.02 0.00 0.00 0.00 0.00 0.00','資產淨值 0.02 0.00 0.00 0.00 0.00 0.00',
 '期末資產淨值總覽 合計(HKD) 港幣資產 美元資產 人民幣資產 日元資產 新加坡元資產',
 '現金結餘 0.02 0.00 0.00 0.00 0.00 0.00','資產淨值 0.02 0.00 0.00 0.00 0.00 0.00',
 '重要提示',
].map((text,i)=>({text,page:i<9?1:2,row:i+1}));
describe('complete cash-only evidence',()=>{
 it('retains dated opening and closing account/market provenance',()=>{
  const result=readFutuZeroStockEvidence(rows,'futu:9088','2025-12');
  expect(result.map(e=>[e.date,e.phase])).toEqual([['2025-12-01','opening'],['2025-12-31','closing']]);
  expect(result[1].source.some(s=>s.page===2)).toBe(true);
 });
 it('never infers universal flatness from a zero net stock category',()=>{
  const modified=[...rows];modified.splice(3,0,{text:'股票和股票期權 0.00 0.00 0.00',page:1,row:4});
  expect(readFutuZeroStockEvidence(modified,'futu:9088','2025-12')).toEqual([]);
 });
 it('requires all currency columns and rejects incomplete extraction',()=>{
  expect(readFutuZeroStockEvidence(rows.filter((_,i)=>i!==7),'futu:9088','2025-12').map(e=>e.phase)).toEqual(['closing']);
  expect(readFutuZeroStockEvidence([],'futu:9088','2025-12')).toEqual([]);
 });
 it('rejects unequal, missing, or extra summary columns',()=>{
  for (const text of ['現金結餘 1.02 0.02 0.00','現金結餘 0.02 0.02','現金結餘 0.02 0.02 0.00 0.00']) {
   const modified=rows.map((r,i)=>i===3?{...r,text}:r);
   expect(readFutuZeroStockEvidence(modified,'futu:9088','2025-12')).toEqual([]);
  }
 });
 it('rejects zero-mark security details after the NAV',()=>{
  for(const text of ['股票持倉','US XYZ 100 0.00 0.00']) {
   const modified=[...rows];modified.splice(12,0,{text,page:2,row:13});
   expect(readFutuZeroStockEvidence(modified,'futu:9088','2025-12')).toEqual([]);
  }
 });
 it('rejects only the endpoint whose overview total differs from the summary',()=>{
  for (const [index,remaining] of [[7,'closing'],[10,'opening']] as const) {
   const modified=rows.map((r,i)=>i===index||i===index+1?{...r,text:r.text.replace('0.02','1.02')}:r);
   expect(readFutuZeroStockEvidence(modified,'futu:9088','2025-12').map(e=>e.phase)).toEqual([remaining]);
  }
 });
 it('requires valid same-month first/last dates when persisting evidence',()=>{
  const evidence=readFutuZeroStockEvidence(rows,'futu:9088','2025-12');
  const base={documentId:'x',month:'2025-12',accountId:'futu:9088',templateIds:[],positions:[],events:[],reviewRequired:false};
  expect(isMonthlyStatement({...base,zeroStockEvidence:evidence})).toBe(true);
  for(const date of ['2025-11-30','2025-12-30','2025-12-32','2025-02-29']) {
   expect(isMonthlyStatement({...base,zeroStockEvidence:[{...evidence[1],date}]})).toBe(false);
  }
  expect(isMonthlyStatement({...base,month:undefined,zeroStockEvidence:evidence})).toBe(false);
 });
 it('rejects forged persisted scopes',()=>{
  const statement={documentId:'x',accountId:'futu:9088',templateIds:[],positions:[],events:[],reviewRequired:false,zeroStockEvidence:readFutuZeroStockEvidence(rows,'other','2025-12')};
  expect(isMonthlyStatement(statement)).toBe(false);
 });
});
