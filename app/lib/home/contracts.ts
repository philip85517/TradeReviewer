import type { Holding, HomeRequest, HomeView, TradeCollection } from '../../components/homepage-preview/display-contract';

export const HOME_POLICY = 'native-object-subtotals-v17-provisional-split-ledger';
export const HOME_METRIC_ORDERING = 'native-first-appearance-v1';
export type NativeOrdering = {version:1;currencies:{code:string;date:string;index:number;reasons:{reason:string;date:string;index:number}[]}[]};
export const HOME_PREPARED_SUBTOTAL_VERSION = 2;
export const HOME_FINANCIAL_PARTITION_VERSION = 1;
/** R/F keep known prefixes plus counts, so old unrelated gaps do not poison new periods. */
export type NativeBucket = {
  market: string | null; unrealized: string | null;
  realized: string; realizedMissing: number; fees: string; feesMissing: number;
  /** Position-level close prefixes. Older releases and scope totals omit these fields. */
  closedFees?: string; closedFeesMissing?: number; closedTransactions?: number;
  count: number; marketKnown: number; unrealizedKnown: number;
  lifetimeComplete: boolean; reasons: string[]; realizedValuationNotes?: string[]; realizedValuationCount?:number;
};
/** Rate is CNY per currency unit. Historical observations must already pass knowledge cutoffs. */
export type FxRates = Record<string, { rate: string; source: string; asOf: string }>;
export type FeeFact = { id:string; accountId:string; market:string|null; currency:string; from:string; to:string; knownAt:string; amount:string|null };
export type NativeDay = { activity?:number; date: string; buckets: Record<string, NativeBucket>; fx: FxRates; reasons: string[]; feeWindows?: FeeFact[] };
export type ProjectedHolding = { row: Holding; instrumentId: string; positionKey: string; tradeSetId: string; description: string };
export type ProjectedTrades = { accountId?:string; market?:HomeRequest['market']; id: string; positionKey: string; trades: TradeCollection['trades'] };
export type MetricObject = { version:string; positionKey:string; accountId:string; code:string; name:string; firstDay:string; lastDay:string; current:NativeDay; boundaries:NativeDay[]; ordering?:NativeOrdering };
export type ScopeProjection = {
  metricObjects?:MetricObject[];
  contentHash?: string;
  marketCutoffs?: Record<string,string|null>;
  id: string; version: string; market: HomeRequest['market']; accountId: string; currency: string;
  sourceSequence: number; computedAt: string; valuationCutoff: string; businessDate: string;
  days: NativeDay[]; current: NativeDay; holdings: ProjectedHolding[]; reasons: string[];
};
export type ReleaseInput = {
  full?: import('./full-projection').FullBuild;
  fx?: FxRates;
  nextRefreshAt?: string;
  id: string; sourceSequence: number; computedAt: string; businessDate: string;
  accounts: HomeView['accounts']; scopes: ScopeProjection[];
  reuse?: { id: string; version: string }[]; trades: ProjectedTrades[];
};
export type HomeSnapshot = {
  marketCutoffs?: Record<string,string|null>;
  releaseId: string; scopeId: string; scopeVersion: string; sourceSequence: number;
  computedAt: string; valuationCutoff: string; businessDate: string;
};
export type HomeResult = HomeView & { snapshot: HomeSnapshot };
export function scopeId(market: HomeRequest['market'], accountId: string) { return JSON.stringify([market, accountId]); }
