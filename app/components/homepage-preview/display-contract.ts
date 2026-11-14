/** Presentation results, not transaction/valuation inputs. No HTTP or storage policy. */
export type Market = 'all' | 'CN' | 'HK' | 'US';
export type Scenario = 'normal' | 'empty' | 'one' | 'five' | 'nine' | 'ten' | 'twenty' | 'fifty-pages' | 'extreme' | 'gaps' | 'unknown' | 'partial';
export type Period = { preset: 'all' | 'ytd' | 'month' | 'week' | 'custom'; from: string; to: string };
export type HomeFilters = { assetTypes: string[]; openOnly: boolean; review: 'all' | 'pending' | 'done' };
export type HomeRequest = { filters?: HomeFilters; market: Market; accountId: string; period: Period; query: string; sort: 'name' | 'marketValue' | 'unrealized'; direction: 'asc' | 'desc'; page: number };
export type ConfirmedSubtotal = { value:string|null; currency:string; originals:Record<string,string>; fxSource:string; coverage:{available:number;total:number;unit:'account-security';scope:'imported'}; missing:{accountId:string;code:string;name:string;reasons:string[]}[] };
export type Amount = { partial?:ConfirmedSubtotal; value: string | null; currency: string; reasons: string[]; coverage: { available: number; total: number }; originals: Record<string, string>; fxSource: string };
export type Stamp = { scope: string; version: string; asOf: string; reportCurrency: string };
/** cost/price are native unit prices in Holding.currency; amount fields carry their own report currency. */
export type Holding = { assetType?: string; priceAsOf?: string | null; id: string; name: string; code: string; exchange: string; market: Market; accountId: string; currency: string; holdingDays: number | null; quantity: string | null; cost: string | null; price: string | null; marketValue: Amount; unrealized: Amount };
export type Point = { key: string; businessDate: string; state: 'value' | 'source-missing' | 'future'; plottable: boolean; marketValue: Amount; unrealized: Amount; realized: Amount; net: Amount; periodNet: Amount; periodFees: Amount; reasons: string[] };
export type Series = { version: string; boundary: { effectiveEnd: string; asOf: string }; points: Point[] };
export type RefreshStatus = {state:'ready'|'updating'|'delayed'|'failed'|'recovering';releaseId:string|null;publishedSequence:number;pendingSequence:number;asOf:string|null;pendingSince:string|null;error:string|null;canRetry:boolean};
export type HomeView = { fxDate?:string|null; dataRange?: {from:string;to:string}; stamp: Stamp; request: HomeRequest; metrics: Record<'net' | 'periodRealized' | 'unrealizedChange' | 'currentMarketValue', Amount>; currentUnrealized: Amount; series: Series; holdings: { rows: Holding[]; total: number; page: number; pages: number; marketValue: Amount; unrealized: Amount; sortAvailable: boolean }; accounts: { id: string; name: string }[]; reasons: string[] };
export type HoldingDetail = { stamp: Stamp; holding: Holding; description: string };
export type TradeCollection = { stamp: Stamp; holdingId: string; name: string; nextCursor?:number|null; tradeSetId?:string; trades: { id: string; date: string; side: string; quantity: string; price: string | null; currency: string }[] };
export interface HomepageSource {
  kind?: 'http';
  initialRequest?: HomeRequest;
  readStatus?(signal:AbortSignal):Promise<RefreshStatus>;
  readChange?(current:HomeView,request:HomeRequest,signal:AbortSignal):Promise<HomeView>;
  readHome(request: HomeRequest, signal: AbortSignal, version?: string): Promise<HomeView>;
  readHolding(stamp: Stamp, holdingId: string, signal: AbortSignal): Promise<HoldingDetail>;
  readTrades(stamp: Stamp, holdingId: string, signal: AbortSignal, cursor?:number): Promise<TradeCollection>;
  exportHoldings(request: HomeRequest, signal: AbortSignal, version?:string): Promise<string>;
  repair(request: HomeRequest, signal: AbortSignal): Promise<{ remainingReasons: string[] }>;
}
