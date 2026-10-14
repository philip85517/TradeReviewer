import { describe, expect, it } from "vitest";

import type { DashboardRow } from "../../lib/reviews/dashboard";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import type { Instrument, TradeEpisode, TradeExecution } from "../../lib/trades/types";
import { holdingsLedgerIdentity } from "./holdings-ledger-identity";

function makeRow(): DashboardRow {
  const instrument: Instrument = {
    id: "US:IDENTITY",
    symbol: "IDENTITY",
    name: "Identity",
    market: "US",
    currency: "USD",
  };
  const execution: TradeExecution = {
    id: "identity:buy",
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    side: "buy",
    executedAt: "2026-10-01T14:00:00.000Z",
    quantity: "2",
    price: "10",
    fee: "0",
    source: { platform: "identity-fixture", row: 1 },
  };
  const episode = {
    id: "episode:identity",
    accountId: execution.accountId,
    accountLabel: execution.accountLabel,
    instrument,
    tradeNature: "live" as const,
    direction: "long" as const,
    status: "open" as const,
    startedAt: execution.executedAt,
    openingQuantity: "2",
    remainingQuantity: "2",
    executions: [execution],
  };
  const item = {
    episode,
    metrics: {
      buyCount: 1,
      sellCount: 0,
      boughtQuantity: "2",
      soldQuantity: "0",
      grossExposure: "20",
      fees: "0",
      realizedPnl: "0",
      unrealizedPnl: "10",
      netPnl: "10",
      returnPercent: "50",
      holdingMilliseconds: null,
    },
    reviewStatus: "pending" as const,
    confirmedTagIds: [],
    tagDictionaryVersion: 1,
    rMultiple: null,
  };
  const entry: TradeLibraryEntry = {
    groupId: "US:IDENTITY|live:account-1",
    scopeKey: "live",
    tradeNature: "live",
    instrument,
    executions: [execution],
    episodes: [item],
    accountCount: 1,
    tradeCount: 1,
    episodeCount: 1,
    firstTradeAt: execution.executedAt,
    lastTradeAt: execution.executedAt,
    status: "open",
    netPnl: "10",
    returnPercent: "50",
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
  return { entry, item };
}

function withEpisode(row: DashboardRow, patch: Partial<TradeEpisode>): DashboardRow {
  const item = {
    ...row.item,
    episode: { ...row.item.episode, ...patch },
  };
  return {
    entry: {
      ...row.entry,
      episodes: row.entry.episodes.map(candidate => candidate === row.item ? item : candidate),
    },
    item,
  };
}

function withExecution(row: DashboardRow, patch: Partial<TradeExecution>): DashboardRow {
  return withEpisode(row, {
    executions: row.item.episode.executions.map((execution, index) => index === 0
      ? { ...execution, ...patch }
      : execution),
  });
}

function withInstrument(row: DashboardRow, patch: Partial<Instrument>): DashboardRow {
  const instrument = { ...row.entry.instrument, ...patch };
  const episode = {
    ...row.item.episode,
    instrument,
    executions: row.item.episode.executions.map(execution => ({ ...execution, instrument })),
  };
  const item = { ...row.item, episode };
  return {
    entry: {
      ...row.entry,
      instrument,
      executions: row.entry.executions.map(execution => ({ ...execution, instrument })),
      episodes: row.entry.episodes.map(candidate => candidate === row.item ? item : candidate),
    },
    item,
  };
}

function withDerivedMetrics(row: DashboardRow): DashboardRow {
  return {
    ...row,
    entry: {
      ...row.entry,
      netPnl: "999",
      returnPercent: "999",
      cumulativeR: "17",
      episodes: row.entry.episodes.map(item => ({
        ...item,
        metrics: { ...item.metrics, unrealizedPnl: "999", netPnl: "999", returnPercent: "999" },
        rMultiple: "4.5",
      })),
    },
    item: {
      ...row.item,
      metrics: { ...row.item.metrics, unrealizedPnl: "999", netPnl: "999", returnPercent: "999" },
      rMultiple: "4.5",
    },
  };
}

const rawIdentityMutations: Array<{ label: string; mutate: (row: DashboardRow) => DashboardRow }> = [
  {
    label: "selected execution quantity",
    mutate: row => withExecution(row, { quantity: "3" }),
  },
  {
    label: "selected execution fee",
    mutate: row => withExecution(row, { fee: "0.25" }),
  },
  {
    label: "selected execution timestamp",
    mutate: row => withExecution(row, { executedAt: "2026-10-01T14:01:00.000Z" }),
  },
  {
    label: "selected account",
    mutate: row => withEpisode(row, {
      accountId: "account-2",
      accountLabel: "备用账户",
      executions: row.item.episode.executions.map(execution => ({
        ...execution,
        accountId: "account-2",
        accountLabel: "备用账户",
      })),
    }),
  },
  {
    label: "selected episode live to simulation run",
    mutate: row => withEpisode(row, { tradeNature: "simulation", simulationRunId: "run-1" }),
  },
  {
    label: "entry scope live to simulation run",
    mutate: row => ({
      ...row,
      entry: { ...row.entry, tradeNature: "simulation", simulationRunId: "run-1" },
    }),
  },
  {
    label: "instrument id",
    mutate: row => withInstrument(row, { id: "US:OTHER", symbol: "OTHER", name: "Other" }),
  },
  {
    label: "instrument market",
    mutate: row => withInstrument(row, { market: "HK" }),
  },
  {
    label: "instrument currency",
    mutate: row => withInstrument(row, { currency: "HKD" }),
  },
  {
    // R1 keeps the complete raw Instrument object; metadata hydration is a
    // follow-up observation rather than a new identity contract in this round.
    label: "instrument display name under conservative raw identity",
    mutate: row => withInstrument(row, { name: "Identity (renamed)" }),
  },
  {
    label: "selected episode id",
    mutate: row => withEpisode(row, { id: "episode:identity:v2" }),
  },
  {
    label: "selected episode status",
    mutate: row => withEpisode(row, { status: "closed" }),
  },
  {
    label: "selected episode direction",
    mutate: row => withEpisode(row, { direction: "short" }),
  },
  {
    label: "selected episode position evidence",
    mutate: row => withEpisode(row, {
      positionEvents: [{
        id: "position:identity",
        accountId: "account-1",
        market: "US",
        symbol: "IDENTITY",
        date: "2026-10-02",
        kind: "corporate-action",
        quantity: "1",
        description: "position evidence",
        source: [],
      }],
    }),
  },
  {
    label: "selected execution source evidence",
    mutate: row => withExecution(row, {
      source: {
        ...row.item.episode.executions[0].source,
        statementRowFingerprint: "statement:identity:1:2",
      },
    }),
  },
];

describe("holdingsLedgerIdentity", () => {
  it("ignores library metrics and entry financial aggregates", () => {
    const row = makeRow();
    const derivedOnly = {
      ...row,
      entry: {
        ...row.entry,
        netPnl: "999",
        returnPercent: "999",
        cumulativeR: "17",
        episodes: row.entry.episodes.map(item => ({
          ...item,
          metrics: { ...item.metrics, unrealizedPnl: "999", netPnl: "999", returnPercent: "999" },
          rMultiple: "4.5",
        })),
      },
      item: {
        ...row.item,
        metrics: { ...row.item.metrics, unrealizedPnl: "999", netPnl: "999", returnPercent: "999" },
        rMultiple: "4.5",
      },
    };

    expect(holdingsLedgerIdentity([derivedOnly])).toBe(holdingsLedgerIdentity([row]));
  });

  it("changes when selected raw execution evidence changes", () => {
    const row = makeRow();
    const changedExecution = {
      ...row,
      item: {
        ...row.item,
        episode: {
          ...row.item.episode,
          executions: [{ ...row.item.episode.executions[0], price: "11" }],
        },
      },
    };

    expect(holdingsLedgerIdentity([changedExecution])).not.toBe(holdingsLedgerIdentity([row]));
  });

  it("does not include unselected entry episodes", () => {
    const row = makeRow();
    const unselectedEpisode = {
      ...row.item,
      episode: { ...row.item.episode, id: "episode:unselected", accountId: "account-2" },
    };
    const withUnselected = {
      ...row,
      entry: { ...row.entry, episodes: [row.item, unselectedEpisode] },
    };
    const changedUnselected = {
      ...withUnselected,
      entry: {
        ...withUnselected.entry,
        episodes: [row.item, {
          ...unselectedEpisode,
          episode: { ...unselectedEpisode.episode, executions: [] },
        }],
      },
    };

    expect(holdingsLedgerIdentity([changedUnselected])).toBe(holdingsLedgerIdentity([withUnselected]));
  });

  it.each(rawIdentityMutations)("changes for $label while ignoring derived metrics", ({ mutate }) => {
    const baseline = holdingsLedgerIdentity([makeRow()]);
    const changed = mutate(makeRow());
    const changedIdentity = holdingsLedgerIdentity([changed]);

    expect(changedIdentity).not.toBe(baseline);
    expect(holdingsLedgerIdentity([withDerivedMetrics(changed)])).toBe(changedIdentity);
  });

  it("changes when selected episode membership changes", () => {
    const selected = makeRow();
    const added = withEpisode(makeRow(), { id: "episode:identity:second" });

    expect(holdingsLedgerIdentity([selected, added])).not.toBe(holdingsLedgerIdentity([selected]));
  });

  it("is stable when selected rows arrive in a different order", () => {
    const first = makeRow();
    const second = withEpisode(withInstrument(makeRow(), { id: "US:OTHER", symbol: "OTHER", name: "Other" }), { id: "episode:other" });

    expect(holdingsLedgerIdentity([first, second])).toBe(holdingsLedgerIdentity([second, first]));
  });
});
