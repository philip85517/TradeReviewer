import type {TradeExecution} from '../trades/types';
import {resolvedTradeNatureOf} from '../trades/nature-resolution';

export type HomeFeeBasis = {
  kind:'market-default-estimate'; policy:'cn-stock-etf-fixed-v1'; amount:'5'; currency:'CNY';
  originalFee:string; originalFeeStatus:TradeExecution['source']['feeStatus'];
};
type EstimatedExecution = TradeExecution & {source:TradeExecution['source'] & {homeFeeBasis?:HomeFeeBasis}};
/** Calculation-only projection. Never write this execution back to the import store. */
export function overlayHomeExecutionFee(execution:TradeExecution,assetType?:string):EstimatedExecution {
  if((execution as EstimatedExecution).source.homeFeeBasis)return execution;
  const {market,symbol,currency}=execution.instrument;
  // Explicit missing status wins over the legacy zero placeholder. Restrict to
  // mainland stock/ETF symbol families; bonds, funds and other markets stay unknown.
  const recognizedPrefix=(market==='CN-SH'&&/^(?:60[013568]\d{3}|68[89]\d{3}|5[168]\d{4})$/.test(symbol))||
    (market==='CN-SZ'&&/^(?:00[0123]\d{3}|30[01]\d{3}|159\d{3})$/.test(symbol))||
    (market==='CN-BJ'&&/^(?:43|83|87|88|92)\d{4}$/.test(symbol));
  const mainland=['CN-SH','CN-SZ','CN-BJ'].includes(market);
  const stockOrEtf=mainland&&(assetType!==undefined?(assetType==='stock'||assetType==='etf'):recognizedPrefix);
  const settlementCurrency=execution.source.settlement?.currency?.trim().toUpperCase();
  if(settlementCurrency&&settlementCurrency!=='CNY')return execution;
  if(execution.source.feeStatus!=='unknown'||currency!=='CNY'||!stockOrEtf||resolvedTradeNatureOf(execution)!=='live')return execution;
  const homeFeeBasis:HomeFeeBasis={kind:'market-default-estimate',policy:'cn-stock-etf-fixed-v1',amount:'5',currency:'CNY',originalFee:execution.fee,originalFeeStatus:execution.source.feeStatus};
  return {...execution,fee:'5',source:{...execution.source,feeStatus:'allocated',homeFeeBasis}};
}

export function homeExecutionFeeBasis(execution:TradeExecution) {
 const projected=execution as EstimatedExecution,basis=projected.source.homeFeeBasis;
 return {kind:basis?'market-default-estimate' as const:'source' as const,amount:projected.source.feeStatus==='unknown'?null:projected.fee,currency:basis?.currency??projected.source.settlement?.currency??projected.instrument.currency,originalFee:basis?.originalFee??execution.fee,originalFeeStatus:basis?.originalFeeStatus??execution.source.feeStatus};
}
