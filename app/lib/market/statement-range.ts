import { Temporal } from "@js-temporal/polyfill";
import { buildTradeEpisodes } from "../trades/episodes";
import type { InstrumentTradeSummary } from "../trades/instruments";

/** Coverage follows inventory evidence too, without relabelling it as a trade. */
export function statementReplayBounds(summary: InstrumentTradeSummary) {
  const dates = [summary.firstTradeAt, summary.lastTradeAt];
  for (const execution of summary.executions) {
    for (const evidence of [...(execution.source.statementPositions ?? []), ...(execution.source.positionEvents ?? []), ...(execution.source.openingPosition ? [execution.source.openingPosition] : [])]) {
      if (evidence.date.length === 7) {
        const month = Temporal.PlainYearMonth.from(evidence.date);
        dates.push(month.toPlainDate({ day: 1 }).toString(), month.toPlainDate({ day: month.daysInMonth }).toString());
      } else dates.push(evidence.date);
    }
  }
  dates.sort();
  return { firstAt: dates[0], lastAt: dates.at(-1)!, open: buildTradeEpisodes(summary.executions).some(episode => episode.status === "open") };
}
