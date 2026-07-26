import { instrumentDisplayName } from "../instruments/display-name";
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
    const current = grouped.get(execution.instrument.id) ?? [];
    current.push(execution);
    grouped.set(execution.instrument.id, current);
  }

  return [...grouped.values()]
    .map((records) => {
      const sorted = [...records].sort((a, b) =>
        a.executedAt.localeCompare(b.executedAt),
      );
      const sourceInstrument = sorted[0].instrument;
      return {
        instrument: {
          ...sourceInstrument,
          name: instrumentDisplayName(
            sourceInstrument.symbol,
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
