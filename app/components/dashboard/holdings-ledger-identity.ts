import type { DashboardRow } from "../../lib/reviews/dashboard";
import { canonicalRecord } from "../../lib/storage/trade-revisions";

type HoldingsLedgerIdentityRow = {
  entry: {
    groupId?: string;
    scopeKey?: string;
    tradeNature?: DashboardRow["entry"]["tradeNature"];
    simulationRunId?: string;
    instrument: DashboardRow["entry"]["instrument"];
  };
  /** The selected episode is the raw position/trade/source boundary. */
  episode: DashboardRow["item"]["episode"];
};

function selectedRowIdentity(row: DashboardRow): HoldingsLedgerIdentityRow {
  return {
    entry: {
      groupId: row.entry.groupId,
      scopeKey: row.entry.scopeKey,
      tradeNature: row.entry.tradeNature,
      simulationRunId: row.entry.simulationRunId,
      instrument: row.entry.instrument,
    },
    episode: row.item.episode,
  };
}

/**
 * Stable financial-ledger identity for the selected holdings rows.
 *
 * Library metrics, reviews, r-multiple, entry aggregates, and quotes are
 * deliberately outside this projection. They are derived from the selected
 * raw episode and the separate market/computation inputs.
 */
export function holdingsLedgerIdentity(rows: readonly DashboardRow[]): string {
  const selected = rows.map(selectedRowIdentity).sort((left, right) =>
    left.entry.instrument.id.localeCompare(right.entry.instrument.id) ||
    (left.entry.scopeKey ?? "").localeCompare(right.entry.scopeKey ?? "") ||
    left.episode.id.localeCompare(right.episode.id) ||
    left.episode.accountId.localeCompare(right.episode.accountId),
  );
  return canonicalRecord(selected);
}
