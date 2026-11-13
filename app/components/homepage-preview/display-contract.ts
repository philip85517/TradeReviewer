/** Presentation results, not transaction/valuation inputs. No HTTP or storage policy. */
export type Market = 'all' | 'CN' | 'HK' | 'US';
export type Scenario = 'normal' | 'empty' | 'one' | 'five' | 'nine' | 'ten' | 'twenty' | 'fifty-pages' | 'extreme' | 'gaps' | 'unknown' | 'partial';
export type Period = { preset: 'all' | 'ytd' | 'month' | 'week' | 'custom'; from: string; to: string };
export type HomeRequest = { market: Market; accountId: string; period: Period; query: string; sort: 'name' | 'marketValue' | 'unrealized'; direction: 'asc' | 'desc'; page: number };
export type Amount = { value: string | null; currency: string; reasons: string[]; coverage: { available: number; total: number }; originals: Record<string, string>; fxSource: string };
export type Stamp = { scope: string; version: string; asOf: string; reportCurrency: string };
export type Holding = { id: string; name: string; code: string; exchange: string; market: Market; accountId: string; currency: string; quantity: string; cost: string | null; price: string | null; marketValue: Amount; unrealized: Amount };
export type Point = { key: string; businessDate: string; state: 'value' | 'source-missing' | 'future'; plottable: boolean; marketValue: Amount; unrealized: Amount; realized: Amount; net: Amount; periodNet: Amount; periodFees: Amount; reasons: string[] };
export type Series = { version: string; boundary: { effectiveEnd: string; asOf: string }; points: Point[] };
export type HomeView = { stamp: Stamp; request: HomeRequest; metrics: Record<'net' | 'periodRealized' | 'unrealizedChange' | 'currentMarketValue', Amount>; currentUnrealized: Amount; series: Series; holdings: { rows: Holding[]; total: number; page: number; pages: number; marketValue: Amount; unrealized: Amount; sortAvailable: boolean }; accounts: { id: string; name: string }[]; reasons: string[] };
export type HoldingDetail = { stamp: Stamp; holding: Holding; description: string };
export type TradeCollection = { stamp: Stamp; holdingId: string; name: string; trades: { id: string; date: string; side: string; quantity: string; price: string | null; currency: string }[] };
export interface HomepageSource {
  readHome(request: HomeRequest, signal: AbortSignal): Promise<HomeView>;
  readHolding(stamp: Stamp, holdingId: string, signal: AbortSignal): Promise<HoldingDetail>;
  readTrades(stamp: Stamp, holdingId: string, signal: AbortSignal): Promise<TradeCollection>;
  exportHoldings(request: HomeRequest, signal: AbortSignal): Promise<string>;
  repair(request: HomeRequest, signal: AbortSignal): Promise<{ remainingReasons: string[] }>;
}
