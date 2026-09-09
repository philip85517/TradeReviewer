import type { TradeExecution } from './types';

export type TradingNature = 'simulated' | 'live' | 'unknown';

export function tradingNature(execution: TradeExecution): TradingNature {
  if (execution.source.tradingNature) return execution.source.tradingNature;
  if (execution.source.platform === 'tradingview') return 'simulated';
  return ['futu', 'tiger', 'china-merchants'].includes(execution.source.platform) ? 'live' : 'unknown';
}

export function tradingNatureLabel(execution: TradeExecution): string {
  const nature = tradingNature(execution);
  return nature === 'simulated' ? 'TradingView · 模拟盘' : nature === 'live' ? '实盘' : '交易性质未知';
}

/** Empty for existing records so historical reconciliation/episode IDs stay stable. */
export function simulationScope(execution: TradeExecution): string {
  return tradingNature(execution) === 'simulated'
    ? `simulation:${execution.source.simulationRunId ?? execution.id}`
    : '';
}
