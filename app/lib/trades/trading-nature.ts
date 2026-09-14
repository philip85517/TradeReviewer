import { tradeNatureOf, type TradeExecution, type TradeNature } from './types';

export type TradingNature = 'simulated' | 'live' | 'unknown';

export function tradingNature(execution: TradeExecution): TradingNature {
  if (execution.source.tradeNature || execution.source.tradingNature) {
    const nature = tradeNatureOf(execution);
    return nature === 'simulation' ? 'simulated' : nature;
  }
  if (execution.source.platform === 'tradingview') return 'simulated';
  return ['futu', 'tiger', 'china-merchants'].includes(execution.source.platform) ? 'live' : 'unknown';
}

export function tradingNatureLabel(execution: TradeExecution): string {
  const nature = displayTradeNature(execution);
  return nature === 'simulation' ? 'TradingView · 模拟盘' : nature === 'live' ? '实盘' : '交易性质未知';
}

/** Canonical nature for filters and labels; scope identity remains tradeNatureOf. */
export function displayTradeNature(execution: TradeExecution): TradeNature {
  const nature = tradingNature(execution);
  return nature === 'simulated' ? 'simulation' : nature;
}

/** Empty for existing records so historical reconciliation/episode IDs stay stable. */
export function simulationScope(execution: TradeExecution): string {
  return tradingNature(execution) === 'simulated'
    ? `simulation:${execution.source.simulationRunId ?? execution.id}`
    : '';
}
