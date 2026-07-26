import {
  canonicalInstrumentId,
  canonicalInstrumentSymbol,
  instrumentDisplayName,
} from "../instruments/display-name";
import type { Instrument, TradeExecution } from "./types";

export type InstrumentTradeSummary = {
  instrument: Instrument;
  executions: TradeExecution[];
  tradeCount: number;
  firstTradeAt: string;
  lastTradeAt: string;
};

export function buildInstrumentTradeSummaries(
  executions: TradeExecution[],
): InstrumentTradeSummary[] {
  const grouped = new Map<string, TradeExecution[]>();
  for (const execution of executions) {
    const key = canonicalInstrumentId(
      execution.instrument.symbol,
      execution.instrument.market,
    );
    const current = grouped.get(key) ?? [];
    current.push(execution);
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((records) => {
      const sorted = [...records].sort((a, b) =>
        a.executedAt.localeCompare(b.executedAt),
      );
      const sourceInstrument = sorted[0].instrument;
      const symbol = canonicalInstrumentSymbol(
        sourceInstrument.symbol,
        sourceInstrument.market,
      );
      return {
        instrument: {
          ...sourceInstrument,
          id: canonicalInstrumentId(symbol, sourceInstrument.market),
          symbol,
          name: instrumentDisplayName(
            symbol,
            sourceInstrument.market,
            sourceInstrument.name,
          ),
        },
        executions: sorted,
        tradeCount: sorted.length,
        firstTradeAt: sorted[0].executedAt,
        lastTradeAt: sorted.at(-1)?.executedAt ?? sorted[0].executedAt,
      };
    })
    .sort((a, b) =>
      a.instrument.symbol.localeCompare(b.instrument.symbol),
    );
}
