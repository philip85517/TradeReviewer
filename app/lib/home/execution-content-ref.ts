import { createHash } from 'node:crypto';
import type { TradeExecution } from '../trades/types';

export type ExecutionContentRef = { schemaVersion: 1; executionId: string; rawVersion: string; effectiveVersion: string };
export function executionContentVersion(execution: TradeExecution, domain: 'raw' | 'effective'): string {
  const { id, accountId, instrument, side, executedAt, quantity, price, fee, source } = execution;
  const projection = { id, accountId, instrument: { id: instrument.id, symbol: instrument.symbol, market: instrument.market, currency: instrument.currency }, side, executedAt, quantity, price, fee, source };
  const active = new Set<object>();
  function normalize(value: unknown): string {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
    if (typeof value !== 'object') throw new TypeError('Non-JSON value');
    if (active.has(value)) throw new TypeError('Circular value');
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError('Non-JSON object');
    active.add(value);
    let result: string;
    if (Array.isArray(value)) result = '[' + Array.from(value, item => item === undefined ? 'null' : normalize(item)).join(',') + ']';
    else result = '{' + Object.keys(value).sort().filter(key => (value as Record<string, unknown>)[key] !== undefined).map(key => JSON.stringify(key) + ':' + normalize((value as Record<string, unknown>)[key])).join(',') + '}';
    active.delete(value);
    return result;
  }
  return createHash('sha256').update(normalize([`home-execution-${domain}-v1`, projection])).digest('hex');
}
