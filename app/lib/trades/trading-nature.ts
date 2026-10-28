import { tradeNatureOf, type TradeExecution, type TradeNature } from './types';
import { resolvedTradeNatureOf } from './nature-resolution';

export type TradingNature = 'simulated' | 'live' | 'unknown';

export function tradingNature(execution: TradeExecution): TradingNature {
  const nature = resolvedTradeNatureOf(execution);
  return nature === 'simulation' ? 'simulated' : nature;
}

// Frozen identity compatibility: this is also used by episode ordering and
// stable legacy simulation IDs, independently of business classification.
function identityTradingNature(execution: TradeExecution): TradingNature {
  if (execution.source.tradeNature || execution.source.tradingNature) {
    const nature = tradeNatureOf(execution);
    return nature === 'simulation' ? 'simulated' : nature;
  }
  if (execution.source.platform === 'tradingview') return 'simulated';
  return ['futu', 'tiger', 'china-merchants'].includes(execution.source.platform) ? 'live' : 'unknown';
}

export function tradingNatureLabel(execution: TradeExecution): string {
  return tradeNatureLabel(resolvedTradeNatureOf(execution));
}

export function tradeNatureLabel(nature: TradeNature): string {
  return nature === 'simulation' ? 'TradingView · 模拟盘' : nature === 'live' ? '实盘' : '交易性质未知';
}

/** Canonical nature for filters and labels; scope identity remains tradeNatureOf. */
export function displayTradeNature(execution: TradeExecution): TradeNature {
  return resolvedTradeNatureOf(execution);
}

/** Empty for existing records so historical reconciliation/episode IDs stay stable. */
export function simulationScope(execution: TradeExecution): string {
  return identityTradingNature(execution) === 'simulated'
    ? `simulation:${execution.source.simulationRunId ?? execution.id}`
    : '';
}
