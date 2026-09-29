import { describe, expect, it } from "vitest";

import {
  buildTradingViewAccountMigrationPlan,
  type TradingViewAccountMigrationSnapshot,
  type TradingViewEpisodeSnapshot,
} from "./tradingview-account-migration-plan";
import {
  TRADINGVIEW_CANONICAL_ACCOUNT_ID,
} from "../trades/tradingview-account-identity";
import type { TradeExecution } from "../trades/types";

type SourceOverrides = Partial<TradeExecution["source"]>;

const instruments = [
  ["CN-SH:600330", "600330"],
  ["CN-SH:600869", "600869"],
  ["CN-SH:600737", "600737"],
  ["CN-SZ:300857", "300857"],
] as const;
const runIds = ["run-330", "run-869", "run-737", "run-857"] as const;
const accountIds = [
  "tradingview:source-330:CN-SH:600330",
  "tradingview:source-869:CN-SH:600869",
  "tradingview:source-737:CN-SH:600737",
  "tradingview:source-857:CN-SZ:300857",
] as const;
const rowCounts = [34, 24, 12, 12] as const;
const quantities = [6000, 10000, 3000, 2500] as const;
const finalQuantities = [12000, 10000, 3000, 2500] as const;
const fees = ["0", "0.4", "0", "0"] as const;

function execution(
  group: number,
  index: number,
  overrides: SourceOverrides = {},
): TradeExecution {
  const [instrumentId, symbol] = instruments[group];
  const quantity = index === rowCounts[group] - 1 ? finalQuantities[group] : quantities[group];
  return {
    id: `fill-${group}-${String(index).padStart(2, "0")}`,
    source: {
      platform: "tradingview",
      tradeNature: "simulation",
      simulationRunId: `tradingview:${runIds[group]}`,
      simulationTradeId: `tv-${group}-${index}`,
      simulationRole: index === 0 ? "entry" : "exit",
      fileFingerprint: `file-${group}`,
      row: index + 1,
      sourceTradeId: `source-trade-${group}-${index}`,
      ...overrides,
    },
    accountId: accountIds[group],
    accountLabel: `TradingView · 模拟盘 · ${symbol}`,
    instrument: {
      id: instrumentId,
      symbol,
      name: `标的-${symbol}`,
      market: instrumentId.startsWith("CN-SZ") ? "CN-SZ" : "CN-SH",
      currency: "CNY",
    },
    side: index === 0 ? "buy" : "sell",
    executedAt: `2026-01-0${group + 1}T${String(index % 24).padStart(2, "0")}:00:00Z`,
    quantity: String(quantity),
    price: "1.89",
    fee: fees[group],
  };
}

function episode(
  group: number,
  id: string,
  executions: readonly TradeExecution[],
  accountId: string = accountIds[group],
): TradingViewEpisodeSnapshot {
  return {
    id,
    accountId,
    instrumentId: instruments[group][0],
    direction: "long",
    tradeNature: "simulation",
    simulationRunId: `tradingview:${runIds[group]}`,
    executionIds: executions.map((item) => item.id),
    executionRoles: Object.fromEntries(executions.map((item) => [item.id, item.source.simulationRole ?? "entry"])),
    executionOrder: executions.map((item) => item.id),
  };
}

function baselineSnapshot(): TradingViewAccountMigrationSnapshot {
  const groups = rowCounts.map((count, group) => Array.from({ length: count }, (_, index) => execution(group, index)));
  return {
    executions: groups.flat(),
    oldEpisodes: groups.map((items, group) => episode(group, `old-episode-${group}`, items)),
    newEpisodes: groups.map((items, group) => episode(group, `new-episode-${group}`, items, TRADINGVIEW_CANONICAL_ACCOUNT_ID)),
    references: [
      ...groups.map((items, group) => ({
        table: "reviews",
        primaryKey: `review-${group}`,
        owner: "reviews-owner",
        fields: {
          episodeId: `old-episode-${group}`,
          accountId: accountIds[group],
          source: { accountId: accountIds[group], episodeId: `old-episode-${group}` },
        },
      })),
      {
        table: "app_settings",
        primaryKey: "scope",
        owner: "settings-owner",
        fields: { episode_id: encodeURIComponent(encodeURIComponent("old-episode-0")) },
      },
    ],
  };
}

describe("TradingView account migration preview", () => {
  it("builds a ready 82-execution plan with Decimal conservation and source provenance", () => {
    const snapshot = baselineSnapshot();
    const plan = buildTradingViewAccountMigrationPlan(snapshot);

    expect(plan.status).toBe("ready");
    expect(plan.blockers).toEqual([]);
    expect(plan.counts).toMatchObject({
      executions: 82,
      oldAccounts: 4,
      sourceRuns: 4,
      instruments: 4,
      reviews: 4,
      settingsRows: 1,
      quantity: "516000",
      fee: "9.6",
    });
    expect(plan.conservation).toMatchObject({
      executionIdsPreserved: true,
      sourceRunsPreserved: true,
      quantityBefore: "516000",
      quantityAfter: "516000",
      feeBefore: "9.6",
      feeAfter: "9.6",
    });
    expect(plan.provisionalPrincipal).toMatchObject({
      action: "create-if-absent",
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      currency: "CNY",
      amount: "100000",
      asOf: null,
      status: "provisional",
      source: "user-default",
    });
    expect(plan.episodeMap).toHaveLength(4);
    expect(plan.executionPlan[0]).toMatchObject({
      executionId: "fill-0-00",
      beforeAccountId: accountIds[0],
      afterAccountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      sourceRunId: "tradingview:run-330",
      originalSourceRow: 1,
    });
    expect(plan.referencePlan.find((row) => row.primaryKey === "review-0")).toMatchObject({ status: "mapped" });
    expect(plan.referencePlan.find((row) => row.primaryKey === "review-0")?.after).toMatchObject({
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      episodeId: "new-episode-0",
    });
    expect(plan.referencePlan.find((row) => row.primaryKey === "review-0")?.after.source).toEqual({
      accountId: accountIds[0],
      episodeId: "old-episode-0",
    });
  });

  it("blocks live, unknown, platform-mismatched, and missing-run rows instead of filtering them into the plan", () => {
    const snapshot = baselineSnapshot();
    snapshot.executions = [
      ...snapshot.executions,
      { ...execution(0, 0, { tradingNature: "live", tradeNature: undefined }), id: "mixed-live" },
      { ...execution(0, 1, { platform: "futu", tradeNature: undefined, tradingNature: undefined }), id: "mixed-unknown" },
      { ...execution(0, 2, { simulationRunId: "" }), id: "mixed-missing-run" },
    ];

    const plan = buildTradingViewAccountMigrationPlan(snapshot);

    expect(plan.status).toBe("blocked");
    expect(plan.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      "live-execution",
      "unknown-nature",
      "missing-source-run",
    ]));
    expect(plan.executionPlan).toHaveLength(82);
  });

  it("blocks a canonical account already occupied by a different source or trade nature", () => {
    const snapshot = baselineSnapshot();
    snapshot.canonicalAccountOccupancy = [{
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      platform: "futu",
      tradeNature: "live",
      executionIds: ["live-fill"],
    }];

    const plan = buildTradingViewAccountMigrationPlan(snapshot);

    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "canonical-account-conflict" }),
    ]));
  });

  it("blocks an old episode whose account does not match its executions", () => {
    const snapshot = baselineSnapshot();
    snapshot.oldEpisodes = snapshot.oldEpisodes.map((episode, index) => index === 0
      ? { ...episode, accountId: "unrelated-account" }
      : episode);

    const plan = buildTradingViewAccountMigrationPlan(snapshot);

    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ambiguous-episode", oldEpisodeId: "old-episode-0" }),
    ]));
  });

  it("blocks canonical occupancy whose execution set is not covered by the snapshot", () => {
    const snapshot = baselineSnapshot();
    snapshot.canonicalAccountOccupancy = [{
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      platform: "tradingview",
      tradeNature: "simulation",
      executionIds: ["missing-existing-fill"],
    }];

    const plan = buildTradingViewAccountMigrationPlan(snapshot);

    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "canonical-account-conflict", executionId: "missing-existing-fill" }),
    ]));
  });

  it("rejects zero and many-to-one episode mappings", () => {
    const zero = baselineSnapshot();
    zero.newEpisodes = zero.newEpisodes.slice(1);
    expect(buildTradingViewAccountMigrationPlan(zero).blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ambiguous-episode", oldEpisodeId: "old-episode-0" }),
    ]));

    const many = baselineSnapshot();
    many.oldEpisodes = [
      ...many.oldEpisodes,
      { ...many.oldEpisodes[0], id: "old-episode-duplicate" },
    ];
    expect(buildTradingViewAccountMigrationPlan(many).blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ambiguous-episode", newEpisodeId: "new-episode-0" }),
    ]));
  });

  it("maps known URL encodings but blocks unknown nested references with an owner", () => {
    const snapshot = baselineSnapshot();
    snapshot.references = [{
      table: "recall_documents",
      primaryKey: "doc-1",
      owner: "recall-owner",
      fields: {
        episode_id: encodeURIComponent(encodeURIComponent("old-episode-0")),
        metadata: { mystery: encodeURIComponent("old-episode-0") },
      },
    }];

    const plan = buildTradingViewAccountMigrationPlan(snapshot);
    const row = plan.referencePlan[0];

    expect(plan.status).toBe("blocked");
    expect(row.status).toBe("blocked");
    expect(row.after.episode_id).toBe(encodeURIComponent(encodeURIComponent("new-episode-0")));
    expect(row.after.metadata).toEqual({ mystery: encodeURIComponent("old-episode-0") });
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unknown-reference", owner: "recall-owner", table: "recall_documents" }),
    ]));
  });

  it("blocks an old identity in an unknown URL field with lowercase percent escapes", () => {
    const snapshot = baselineSnapshot();
    snapshot.references = [{
      table: "app_settings",
      primaryKey: "r",
      fields: { url: "https://example.invalid/?account=tradingview%3asource-330%3aCN-SH%3a600330" },
    }];

    const plan = buildTradingViewAccountMigrationPlan(snapshot);

    expect(plan.status).toBe("blocked");
    expect(plan.referencePlan[0].after.url).toBe(snapshot.references[0].fields.url);
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unknown-reference", table: "app_settings", primaryKey: "r" }),
    ]));
  });

  it("keeps the input immutable and produces the same digest after input reordering and numeric formatting", () => {
    const snapshot = baselineSnapshot();
    const inputBefore = structuredClone(snapshot);
    const plan = buildTradingViewAccountMigrationPlan(snapshot);
    const reordered: TradingViewAccountMigrationSnapshot = {
      ...snapshot,
      executions: [...snapshot.executions].reverse().map((item) => item.id === "fill-0-00" ? { ...item, quantity: "6000.00" } : item),
      oldEpisodes: [...snapshot.oldEpisodes].reverse(),
      newEpisodes: [...snapshot.newEpisodes].reverse(),
      references: [...(snapshot.references ?? [])].reverse(),
    };
    const reorderedPlan = buildTradingViewAccountMigrationPlan(reordered);

    expect(snapshot).toEqual(inputBefore);
    expect(reorderedPlan.planDigest).toBe(plan.planDigest);
    expect(reorderedPlan.baseSnapshotDigest).not.toBe("");
  });

  it("keeps the snapshot digest stable when occupancy execution IDs are reordered", () => {
    const first = baselineSnapshot();
    first.canonicalAccountOccupancy = [{
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      platform: "tradingview",
      tradeNature: "simulation",
      executionIds: ["x", "y"],
    }];
    const second = structuredClone(first);
    second.canonicalAccountOccupancy![0].executionIds = ["y", "x"];

    expect(buildTradingViewAccountMigrationPlan(first).baseSnapshotDigest)
      .toBe(buildTradingViewAccountMigrationPlan(second).baseSnapshotDigest);
  });

  it("does not invent a dated principal and blocks a differing existing principal", () => {
    const snapshot = baselineSnapshot();
    snapshot.existingProvisionals = [{
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      currency: "CNY",
      amount: "90000",
      asOf: "2026-01-01",
      status: "confirmed",
      source: "imported",
      revision: 4,
    }];

    const plan = buildTradingViewAccountMigrationPlan(snapshot);

    expect(plan.status).toBe("blocked");
    expect(plan.provisionalPrincipal).toMatchObject({ action: "conflict", asOf: null });
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "principal-conflict" }),
    ]));
  });

  it("treats a semantically equal existing principal as a no-op", () => {
    const snapshot = baselineSnapshot();
    snapshot.existingProvisionals = [{
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      currency: "cny",
      amount: "100000.00",
      asOf: null,
      status: "provisional",
      source: "user-default",
      revision: 2,
    }];

    const plan = buildTradingViewAccountMigrationPlan(snapshot);

    expect(plan.status).toBe("ready");
    expect(plan.provisionalPrincipal).toMatchObject({ action: "no-op", amount: "100000", asOf: null, revision: 2 });
  });
});
