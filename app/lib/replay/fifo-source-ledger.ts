/**
 * A source-level FIFO view of one already-proven native long episode.
 *
 * This module deliberately knows nothing about broker fees or display money
 * rounding.  The native ledger remains the authority for those values; this
 * seam only proves which acquisition cash cost a closing consumed.
 */
export type SourceFifoCategory = "ipo" | "long";

export type SourceFifoAcquisition = {
  sourceKey: string;
  category: SourceFifoCategory;
  quantity: string;
  cashCost: string;
  at: string;
};

export type SourceFifoClosing = {
  closingId: string;
  quantity: string;
  proceeds: string;
  at: string;
};

export type SourceFifoConsumption = {
  closingId: string;
  openingSourceKey: string;
  category: SourceFifoCategory;
  quantity: string;
  cashCost: string;
};

export type SourceFifoFacts = {
  version: 1;
  activated: boolean;
  remaining: Array<{ sourceKey: string; category: SourceFifoCategory; quantity: string; cashCost: string }>;
  consumptions: SourceFifoConsumption[];
  realizedByCategory: Record<SourceFifoCategory, string>;
  closedFeesByCategory?: Record<SourceFifoCategory, string>;
  feesByCategory?: Record<SourceFifoCategory, string>;
  openFeesByCategory?: Record<SourceFifoCategory, string>;
  remainingCashCostByCategory?: Record<SourceFifoCategory, string>;
  remainingByCategory: Record<SourceFifoCategory, string>;
};
