import { canonicalInstrumentSymbol } from "./display-name";

const FB_ETF_INCEPTION = "2025-06-24T00:00:00.000Z";

export type HistoricalInstrumentContext = {
  market: string;
  symbol: string;
  name?: string;
  executedAt: ReadonlyArray<string>;
};

export type HistoricalInstrumentIdentity = {
  displayName: string;
  marketDataSymbol: string;
};

function hasPreInceptionTrade(executedAt: ReadonlyArray<string>) {
  return executedAt.some((value) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) &&
      timestamp < Date.parse(FB_ETF_INCEPTION);
  });
}

export function resolveHistoricalInstrumentIdentity(
  input: HistoricalInstrumentContext,
): HistoricalInstrumentIdentity | undefined {
  const market = input.market.toUpperCase();
  const symbol = canonicalInstrumentSymbol(input.symbol, market);
  if (
    market !== "US" ||
    symbol !== "FB" ||
    !hasPreInceptionTrade(input.executedAt)
  ) {
    return undefined;
  }

  return {
    displayName: "Meta Platforms, Inc. (historical FB)",
    marketDataSymbol: "META",
  };
}
