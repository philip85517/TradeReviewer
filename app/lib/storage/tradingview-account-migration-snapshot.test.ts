import { describe, expect, it } from "vitest";

import {
  buildTradingViewAccountMigrationSnapshot,
  type ReadonlySqliteRows,
} from "./tradingview-account-migration-snapshot";
import { buildTradingViewAccountMigrationPlan } from "./tradingview-account-migration-plan";
import { buildTradeEpisodes } from "../trades/episodes";
import type { TradeExecution } from "../trades/types";

type SqliteRow = Record<string, unknown>;

function executionRow(
  id: string,
  account: string,
  run: string,
  role: "entry" | "exit",
  side: "buy" | "sell",
  row: number,
): SqliteRow {
  return {
    id,
    import_batch_id: null,
    instrument_id: "CN-SH:600330",
    account,
    side,
    executed_at: `2026-01-0${role === "entry" ? "1" : "2"}T07:00:00.000Z`,
    quantity: "1000",
    price: role === "entry" ? "10.25" : "10.75",
    fee: role === "exit" ? "0.4" : "0",
    currency: "CNY",
    trade_nature: "simulation",
    simulation_run_id: run,
    evidence_json: JSON.stringify({
      source: {
        platform: "tradingview",
        inputKind: "tradingview",
        tradingNature: "simulated",
        simulationRunId: run,
        simulationTradeId: role === "entry" ? "1" : "1",
        simulationRole: role,
        fileFingerprint: "fixture-file",
        fileName: "fixture.csv",
        row,
        sourceTradeId: `source-${role}`,
        grossAmount: role === "entry" ? "10250" : "10750",
        cashChange: role === "entry" ? "-10250" : "10750",
      },
      accountLabel: `TradingView · 模拟盘 · ${run}`,
    }),
    symbol: "600330",
    name: "测试标的",
    market: "CN-SH",
  };
}

function nonTargetExecutionRow(): SqliteRow {
  return {
    ...executionRow("live-fill", "futu:live", "", "entry", "buy", 9),
    trade_nature: null,
    simulation_run_id: null,
    evidence_json: JSON.stringify({
      source: { platform: "futu", inputKind: "statement", row: 9 },
      accountLabel: "富途",
    }),
  };
}

function fixtureRows(): { reader: ReadonlySqliteRows; expectedOldEpisodeId: string } {
  const account = "tradingview:old:CN-SH:600330";
  const run = "old-run:CN-SH:600330";
  const executions = [
    executionRow("fill-entry", account, run, "entry", "buy", 3),
    executionRow("fill-exit", account, run, "exit", "sell", 4),
    nonTargetExecutionRow(),
  ];
  const asExecution = (row: SqliteRow): TradeExecution => {
    const evidence = JSON.parse(String(row.evidence_json)) as { source: TradeExecution["source"] };
    return {
      id: String(row.id),
      source: {
        ...evidence.source,
        tradeNature: row.trade_nature as TradeExecution["source"]["tradeNature"],
        simulationRunId: row.simulation_run_id as string,
      },
      accountId: String(row.account),
      accountLabel: "TradingView · 模拟盘 · old-run:CN-SH:600330",
      instrument: {
        id: String(row.instrument_id),
        symbol: String(row.symbol),
        name: String(row.name),
        market: String(row.market),
        currency: String(row.currency),
      },
      side: row.side as TradeExecution["side"],
      executedAt: String(row.executed_at),
      quantity: String(row.quantity),
      price: String(row.price),
      fee: String(row.fee),
    };
  };
  const oldEpisode = buildTradeEpisodes(executions.slice(0, 2).map(asExecution))[0];
  const references: Record<string, readonly SqliteRow[]> = {
    reviews: [{
      episode_id: oldEpisode.id,
      instrument_id: "CN-SH:600330",
      cursor_json: JSON.stringify({ replayCursor: "2026-01-01T07:00:00.000Z" }),
      plan_json: JSON.stringify({ episodeId: oldEpisode.id, source: { accountId: account } }),
      review_json: null,
      drawings_json: null,
      revisions_json: null,
      confirmed_tags_json: null,
    }],
    import_batches: [],
    tag_suggestions: [],
    app_settings: [{
      key: "unknown-business-url",
      value_json: JSON.stringify({
        url: `https://example.invalid/?account=${encodeURIComponent(account).replaceAll("%3A", "%3a")}`,
      }),
    }],
    trade_revisions: [],
    recall_documents: [],
  };

  const rowsByTable: Record<string, readonly SqliteRow[]> = {
    executions,
    ...references,
  };
  const reader: ReadonlySqliteRows = {
    all<T extends SqliteRow>(sql: string): readonly T[] {
      const table = Object.keys(rowsByTable).find((candidate) =>
        new RegExp(`\\bfrom\\s+${candidate}\\b`, "i").test(sql),
      );
      if (!table) return [];
      return rowsByTable[table] as readonly T[];
    },
  };
  return { reader, expectedOldEpisodeId: oldEpisode.id };
}

describe("TradingView migration SQLite snapshot adapter", () => {
  it("reconstructs eligible executions and builds canonical episodes through the domain builder", () => {
    const { reader, expectedOldEpisodeId } = fixtureRows();

    const result = buildTradingViewAccountMigrationSnapshot(reader);

    expect(result.snapshot.executions).toHaveLength(2);
    expect(result.snapshot.executions[0]).toMatchObject({
      id: "fill-entry",
      accountId: "tradingview:old:CN-SH:600330",
      quantity: "1000",
      price: "10.25",
      fee: "0",
      source: {
        fileFingerprint: "fixture-file",
        row: 3,
        sourceTradeId: "source-entry",
        simulationRunId: "old-run:CN-SH:600330",
      },
    });
    expect(result.snapshot.oldEpisodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expectedOldEpisodeId, accountId: "tradingview:old:CN-SH:600330" }),
    ]));
    expect(result.snapshot.newEpisodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        accountId: "tradingview:simulation:default",
        instrumentId: "CN-SH:600330",
        executionIds: ["fill-entry", "fill-exit"],
      }),
    ]));
    expect(result.blockers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "domain-run-grouping" }),
    ]));
  });

  it("passes typed and unknown JSON references to the frozen planner without replacing raw values", () => {
    const { reader } = fixtureRows();

    const result = buildTradingViewAccountMigrationSnapshot(reader);
    const plan = buildTradingViewAccountMigrationPlan(result.snapshot);

    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unknown-reference", table: "app_settings" }),
    ]));
    const setting = plan.referencePlan.find((row) => row.table === "app_settings");
    expect(setting?.after).toEqual(setting?.before);
    const review = plan.referencePlan.find((row) => row.table === "reviews");
    expect(review?.after).toMatchObject({
      episode_id: expect.any(String),
    });
    expect(review?.after).toMatchObject({
      plan: {
        episodeId: result.snapshot.newEpisodes[0]?.id,
        source: { accountId: "tradingview:old:CN-SH:600330" },
      },
    });
  });

  it("builds canonical episodes without changing legacy source executions", () => {
    const first = fixtureRows();
    const secondRow = executionRow(
      "other-entry",
      "tradingview:old-other:CN-SH:600330",
      "other-run:CN-SH:600330",
      "entry",
      "buy",
      12,
    );
    const rows = first.reader.all("select * from executions");
    const reader: ReadonlySqliteRows = {
      all<T extends SqliteRow>(sql: string): readonly T[] {
        if (/\bfrom\s+executions\b/i.test(sql)) return [...rows, secondRow] as readonly T[];
        return first.reader.all<T>(sql);
      },
    };

    const result = buildTradingViewAccountMigrationSnapshot(reader);

    expect(result.blockers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "domain-run-grouping" }),
    ]));
    expect(result.snapshot.newEpisodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        accountId: "tradingview:simulation:default",
        executionIds: expect.arrayContaining(["fill-entry", "fill-exit"]),
      }),
    ]));
    expect(result.snapshot.executions.find((item) => item.id === "fill-entry")?.accountId).toBe("tradingview:old:CN-SH:600330");
    const plan = buildTradingViewAccountMigrationPlan(result.snapshot);
    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ambiguous-episode" }),
    ]));
  });

  it("parses JSON reference columns before identity scanning and preserves the unknown row", () => {
    const { reader } = fixtureRows();
    const account = "tradingview:old:CN-SH:600330";
    const wrapped: ReadonlySqliteRows = {
      all<T extends SqliteRow>(sql: string): readonly T[] {
        if (/from app_settings/i.test(sql)) {
          const rows: SqliteRow[] = [{
            key: "escaped-ref",
            value_json: JSON.stringify({ unknownTarget: account })
              .replaceAll(":", "\\u003a")
              .replace('"unknownTarget"\\u003a', '"unknownTarget":'),
          }];
          return rows as readonly T[];
        }
        return reader.all<T>(sql);
      },
    };

    const result = buildTradingViewAccountMigrationSnapshot(wrapped);
    const plan = buildTradingViewAccountMigrationPlan(result.snapshot);
    const setting = plan.referencePlan.find((row) => row.table === "app_settings");

    expect(result.snapshot.references).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "app_settings", primaryKey: "escaped-ref" }),
    ]));
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unknown-reference", table: "app_settings", primaryKey: "escaped-ref" }),
    ]));
    expect(setting?.after).toEqual(setting?.before);
  });

  it.each(["trade_nature", "simulation_run_id"])(
    "blocks a SQL %s disagreement with the preserved evidence source",
    (field) => {
      const { reader } = fixtureRows();
      const wrapped: ReadonlySqliteRows = {
        all<T extends SqliteRow>(sql: string): readonly T[] {
          const rows = reader.all<T>(sql);
          if (!/from executions/i.test(sql)) return rows;
          return rows.map((row) => {
            if (row.id !== "fill-entry") return row;
            const evidence = JSON.parse(String(row.evidence_json)) as { source: Record<string, unknown> };
            evidence.source.tradeNature = "simulation";
            return {
              ...row,
              evidence_json: JSON.stringify(evidence),
              [field]: field === "trade_nature" ? "live" : "contradictory-run",
            };
          }) as readonly T[];
        },
      };

      const result = buildTradingViewAccountMigrationSnapshot(wrapped);

      expect(result.blockers).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "invalid-execution-row", executionId: "fill-entry" }),
      ]));
      const execution = result.snapshot.executions.find((candidate) => candidate.id === "fill-entry");
      expect(execution?.source).toMatchObject({ tradeNature: "simulation", simulationRunId: "old-run:CN-SH:600330" });
    },
  );
});
