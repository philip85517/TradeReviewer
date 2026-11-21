import {expect,it} from 'vitest';
import type {TradeExecution} from '../trades/types';
import {readExecutionMoneyEvidence} from './execution-money-evidence';

function fixture(side:'buy'|'sell'='buy'):TradeExecution {
 return {id:'e',side,quantity:'10',price:'10',fee:'1',executedAt:'2026-01-01T00:00:00Z',accountId:'a',accountLabel:'A',instrument:{id:'i',symbol:'I',name:'I',market:'US',currency:'USD'},source:{platform:'test',row:1,settlement:{currency:'USD',quantity:'10.0',grossAmount:'101',fees:{commission:'0.6',tax:'0.4'},netAmount:side==='buy'?'-102':'100'}}};
}

it('certifies authoritative buy settlement and the signed cash formula without changing the source',()=>{
 const e=fixture(),before=structuredClone(e);
 expect(readExecutionMoneyEvidence(e)).toEqual({
  fee:{currency:'USD',value:'1',status:'known',reasons:[]},
  settlementGross:{currency:'USD',value:'101',status:'known',reasons:[]},
  signedCashNet:{currency:'USD',value:'-102',status:'known',reasons:[]},
 });
 e.source.settlement!.netAmount='100';
 expect(readExecutionMoneyEvidence(e).signedCashNet).toMatchObject({status:'invalid',value:null,reasons:['settlement-net-mismatch']});
 e.source.settlement!.netAmount='-102';expect(e).toEqual(before);
 expect(readExecutionMoneyEvidence(e,{expectedQuoteGross:'100'}).settlementGross).toMatchObject({status:'invalid',value:null,reasons:['settlement-quote-gross-mismatch']});
 const sell=fixture('sell');expect(readExecutionMoneyEvidence(sell).signedCashNet).toMatchObject({value:'100',status:'known'});
});

it('keeps unknown fees and cash unknown without comparing the placeholder to components or net',()=>{
 const e=fixture();e.fee='0';e.source.feeStatus='unknown';
 const result=readExecutionMoneyEvidence(e);
 expect(result.fee).toMatchObject({value:null,status:'unknown',reasons:['fee-explicitly-unknown']});
 expect(result.settlementGross).toMatchObject({value:'101',status:'known'});
 expect(result.signedCashNet).toMatchObject({value:null,status:'unknown',reasons:['fee-explicitly-unknown']});
 e.source.settlement!.netAmount='1e2';
 expect(readExecutionMoneyEvidence(e).signedCashNet).toMatchObject({status:'invalid',reasons:['invalid-settlement-net']});
 e.source.settlement!.netAmount='-102';e.source.settlement!.fees={commission:'-1'};
 expect(readExecutionMoneyEvidence(e).signedCashNet).toMatchObject({status:'invalid',reasons:['invalid-settlement-components']});
 e.fee='-1';expect(readExecutionMoneyEvidence(e).fee).toMatchObject({status:'invalid',reasons:['invalid-fee']});
});

it('checks each independent dimension and preserves the legacy reason order',()=>{
 const e=fixture('sell');e.fee='-1';
 e.source.settlement={currency:'XXX',quantity:'9',grossAmount:'-2',fees:{commission:'-1'},netAmount:'bad'};
 expect(readExecutionMoneyEvidence(e)).toEqual({
  fee:{currency:'XXX',value:null,status:'invalid',reasons:['invalid-fee','invalid-fee-currency']},
  settlementGross:{currency:'XXX',value:null,status:'invalid',reasons:['settlement-quantity-mismatch','invalid-settlement-currency','invalid-settlement-gross']},
  signedCashNet:{currency:'XXX',value:null,status:'invalid',reasons:['invalid-settlement-components','invalid-settlement-net','settlement-quantity-mismatch','invalid-settlement-currency','invalid-settlement-gross','invalid-fee','invalid-fee-currency']},
 });
 const numeric=fixture();numeric.source.settlement=JSON.parse('{"currency":42,"quantity":"10","grossAmount":"101","fees":{"commission":"1"},"netAmount":"-102"}');
 expect(readExecutionMoneyEvidence(numeric).fee).toEqual({currency:'',value:null,status:'invalid',reasons:['invalid-fee-currency']});
 expect(readExecutionMoneyEvidence(numeric).settlementGross).toEqual({currency:'',value:null,status:'invalid',reasons:['invalid-settlement-currency']});
});

it('preserves gross and fee evidence when settlement or signed net is absent',()=>{
 const e=fixture();Reflect.deleteProperty(e.source.settlement!,'netAmount');
 expect(readExecutionMoneyEvidence(e).signedCashNet).toEqual({currency:'USD',value:null,status:'unknown',reasons:['missing-settlement-net']});
 expect(readExecutionMoneyEvidence(e).settlementGross.value).toBe('101');
 delete e.source.settlement;
 expect(readExecutionMoneyEvidence(e)).toEqual({
  fee:{currency:'USD',value:'1',status:'known',reasons:[]},
  settlementGross:{currency:'USD',value:null,status:'unknown',reasons:['missing-settlement']},
  signedCashNet:{currency:'USD',value:null,status:'unknown',reasons:['missing-settlement']},
 });
});

it('rejects malformed or overlong decimals and compares exact sums beyond floating point precision',()=>{
 const e=fixture('sell');e.fee='9007199254740993';e.source.settlement={currency:'USD',quantity:'10',grossAmount:'9007199254740994',fees:{commission:'9007199254740992',tax:'1'},netAmount:'1'};
 expect(readExecutionMoneyEvidence(e).signedCashNet).toMatchObject({status:'known',value:'1'});
 e.source.settlement.fees.tax='0';expect(readExecutionMoneyEvidence(e).signedCashNet.reasons).toEqual(['settlement-fee-mismatch']);
 for(const fee of ['1e2','NaN','1\n','9'.repeat(1025)]){e.fee=fee;expect(readExecutionMoneyEvidence(e).fee.status).toBe('invalid');}
 e.fee='0';e.source.settlement={currency:'USD',quantity:'10',grossAmount:'0',fees:{commission:'0'},netAmount:'0'};
 expect(readExecutionMoneyEvidence(e).signedCashNet).toMatchObject({status:'known',value:'0'});
});

it('rejects a persisted numeric quote currency without settlement instead of throwing or certifying a fallback',()=>{
 const e=fixture();delete e.source.settlement;
 e.instrument=JSON.parse('{"id":"i","symbol":"I","name":"I","market":"US","currency":42}');
 expect(readExecutionMoneyEvidence(e)).toEqual({
  fee:{currency:'',value:null,status:'invalid',reasons:['invalid-fee-currency']},
  settlementGross:{currency:'',value:null,status:'unknown',reasons:['missing-settlement']},
  signedCashNet:{currency:'',value:null,status:'unknown',reasons:['missing-settlement']},
 });
});
