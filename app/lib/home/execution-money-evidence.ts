import {executionFeeCurrency,type TradeExecution} from '../trades/types';

export type ExecutionMoneyAmountEvidence={
 currency:string;value:string|null;status:'known'|'unknown'|'invalid';reasons:string[];
};
export type ExecutionMoneyEvidence={
 fee:ExecutionMoneyAmountEvidence;settlementGross:ExecutionMoneyAmountEvidence;signedCashNet:ExecutionMoneyAmountEvidence;
};
// Validation uses exact rationals only; source strings remain the evidence.
type Rational={n:bigint;d:bigint};
const ZERO=BigInt(0),ONE=BigInt(1),TEN=BigInt(10),MAX=1024;
function rational(n:bigint,d=ONE):Rational{
 let a=n<ZERO?-n:n,b=d;while(b!==ZERO)[a,b]=[b,a%b];return {n:n/a,d:d/a};
}
function parse(value:unknown):Rational|null{
 if(typeof value!=='string'||value.length>MAX||! /^-?\d+(?:\.\d+)?(?![\s\S])/.test(value))return null;
 const [whole,fraction='']=value.split('.');return rational(BigInt(whole+fraction),TEN**BigInt(fraction.length));
}
const add=(a:Rational,b:Rational)=>rational(a.n*b.d+b.n*a.d,a.d*b.d);
const equal=(a:Rational,b:Rational)=>a.n*b.d===b.n*a.d;
const nonnegative=(v:Rational|null):v is Rational=>v!==null&&v.n>=ZERO;
const positive=(v:Rational|null):v is Rational=>v!==null&&v.n>ZERO;
const currencyValid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Z]{3}(?![\s\S])/.test(v)&&v!=='XXX';
function evidence(currency:string,value:string|undefined,issues:string[],unknownReasons:string[]=[]):ExecutionMoneyAmountEvidence{
 const reasons=issues.length?issues:unknownReasons;
 return {currency,value:reasons.length?null:value??null,status:issues.length?'invalid':unknownReasons.length?'unknown':'known',reasons:[...reasons]};
}

/** Read original fee/settlement facts without allocating amounts or deriving cost.
 * expectedQuoteGross is only for the legacy crossing-sell comparison. Prefix
 * callers omit it so original settlement gross remains authoritative. */
export function readExecutionMoneyEvidence(execution:TradeExecution,options:{expectedQuoteGross?:string}={}):ExecutionMoneyEvidence {
 const e=execution,settlement=e.source.settlement;
 // Persisted JSON can violate static currency types. Validate the actual fee
 // currency source before normalization; invalid values cannot fall back.
 const settlementCurrency=typeof settlement?.currency==='string'?settlement.currency:'';
 const sourceCurrency=settlement?settlementCurrency:e.instrument.currency;
 const fee=parse(e.fee),feeUnknown=e.source.feeStatus==='unknown',feeCurrency=!currencyValid(sourceCurrency)?(typeof sourceCurrency==='string'?sourceCurrency:''):executionFeeCurrency(e);
 const feeIssues=[...(!nonnegative(fee)?['invalid-fee']:[]),...(!currencyValid(feeCurrency)?['invalid-fee-currency']:[])];
 const feeEvidence=evidence(feeCurrency,e.fee,feeIssues,feeUnknown?['fee-explicitly-unknown']:[]);
 if(!settlement)return {fee:feeEvidence,settlementGross:evidence(feeCurrency,undefined,[],['missing-settlement']),signedCashNet:evidence(feeCurrency,undefined,[],['missing-settlement'])};
 const source=parse(e.quantity),gross=parse(settlement.grossAmount),net=parse(settlement.netAmount),sq=parse(settlement.quantity),grossIssues:string[]=[],netIssues:string[]=[];
 if(!positive(sq)||!source||!equal(sq,source))grossIssues.push('settlement-quantity-mismatch');
 if(!currencyValid(settlement.currency))grossIssues.push('invalid-settlement-currency');
 if(!nonnegative(gross))grossIssues.push('invalid-settlement-gross');
 else if(options.expectedQuoteGross!==undefined&&settlement.currency===e.instrument.currency){
  const quote=parse(options.expectedQuoteGross);
  if(!quote||!equal(gross,quote))grossIssues.push('settlement-quote-gross-mismatch');
 }
 let components=rational(ZERO);const parts=settlement.fees;
 if(!parts||typeof parts!=='object'||Array.isArray(parts))netIssues.push('invalid-settlement-components');
 else for(const value of Object.values(parts)){const part=parse(value);if(!nonnegative(part)){netIssues.push('invalid-settlement-components');break;}components=add(components,part);}
 const sameCurrency=feeCurrency===settlement.currency;
 if(!feeUnknown&&sameCurrency&&nonnegative(fee)&&!netIssues.length&&!equal(components,fee))netIssues.push('settlement-fee-mismatch');
 if(settlement.netAmount!==undefined){
  if(!net)netIssues.push('invalid-settlement-net');
  else if(!feeUnknown&&sameCurrency&&nonnegative(fee)&&gross){
   const signedGross=e.side==='buy'?{n:-gross.n,d:gross.d}:gross;
   if(!equal(add(signedGross,{n:-fee.n,d:fee.d}),net))netIssues.push('settlement-net-mismatch');
  }
 }
 netIssues.push(...grossIssues,...feeIssues);
 const unknownReasons=[...(feeUnknown?['fee-explicitly-unknown']:[]),...(!sameCurrency?['cross-currency-net-unverified']:[]),...(settlement.netAmount===undefined?['missing-settlement-net']:[])];
 return {fee:feeEvidence,settlementGross:evidence(settlementCurrency,settlement.grossAmount,grossIssues),signedCashNet:evidence(settlementCurrency,settlement.netAmount,netIssues,unknownReasons)};
}
