import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { initializeSqlite } from "../../../db/sqlite";
import { TRADINGVIEW_ACCOUNT_MIGRATION_SCHEMA } from "../../../db/tradingview-account-migration-schema";
import {
  buildTradingViewAccountMigrationPlan,
  type TradingViewAccountMigrationSnapshot,
} from "./tradingview-account-migration-plan";
import {
  type TradingViewAccountMigrationTransactionOptions,
  type TradingViewMigrationCommitRequest,
  type TradingViewMigrationPreview,
} from "./tradingview-account-migration-contracts";
import { TradingViewAccountMigrationStore } from "./tradingview-account-migration-store";
import type { TradeExecution } from "../trades/types";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../trades/tradingview-account-identity";

const databases: DatabaseSync[] = [];
const oldAccount = "tradingview:old:fixture";
const run = "fixture-run";
const oldEpisodeId = "episode-old";
const newEpisodeId = "episode-new";

function openFixture() {
  const database = new DatabaseSync(":memory:");
  databases.push(database);
  initializeSqlite(database);
  database.exec(TRADINGVIEW_ACCOUNT_MIGRATION_SCHEMA);
  database.exec(`
    insert into instruments (id, symbol, name, market, currency) values ('CN-SH:600330', '600330', '测试标的', 'CN-SH', 'CNY');
    insert into executions (id, instrument_id, account, side, executed_at, quantity, price, fee, currency, evidence_json, trade_nature, simulation_run_id)
      values
      ('fill-entry', 'CN-SH:600330', '${oldAccount}', 'buy', '2026-01-01T07:00:00.000Z', '1000', '10.25', '0', 'CNY',
       '{"accountLabel":"旧账户","source":{"platform":"tradingview","tradeNature":"simulation","simulationRunId":"${run}","simulationRole":"entry","fileFingerprint":"fixture","row":3,"sourceTradeId":"entry"}}', 'simulation', '${run}'),
      ('fill-exit', 'CN-SH:600330', '${oldAccount}', 'sell', '2026-01-02T07:00:00.000Z', '1000', '10.75', '0.4', 'CNY',
       '{"accountLabel":"旧账户","source":{"platform":"tradingview","tradeNature":"simulation","simulationRunId":"${run}","simulationRole":"exit","fileFingerprint":"fixture","row":4,"sourceTradeId":"exit"}}', 'simulation', '${run}');
    insert into reviews (episode_id, instrument_id, cursor_json, plan_json, review_json, updated_at)
      values ('${oldEpisodeId}', 'CN-SH:600330', '{"episodeId":"${oldEpisodeId}","cursor":"2026-01-02T07:00:00.000Z"}', '{"episodeId":"${oldEpisodeId}","accountId":"${oldAccount}","source":{"accountId":"${oldAccount}","audit":"keep"}}', '{"decision":"保留","episodeId":"${oldEpisodeId}"}', '2026-01-03T00:00:00.000Z');
    insert into recall_documents (episode_id, draft_json, finalized_json, revision, updated_at)
      values ('${oldEpisodeId}', '{"episodeId":"${oldEpisodeId}","accountId":"${oldAccount}","source":{"accountId":"${oldAccount}","audit":"keep"}}', null, 1, '2026-01-03T00:00:00.000Z');
  `);
  return database;
}

function execution(id: string, accountId = oldAccount): TradeExecution {
  const isEntry = id === "fill-entry";
  return {
    id,
    source: {
      platform: "tradingview",
      row: isEntry ? 3 : 4,
      fileFingerprint: "fixture",
      sourceTradeId: isEntry ? "entry" : "exit",
      tradeNature: "simulation",
      simulationRunId: run,
      simulationRole: isEntry ? "entry" : "exit",
    },
    accountId,
    accountLabel: accountId === oldAccount ? "旧账户" : "TradingView · 模拟盘",
    instrument: {
      id: "CN-SH:600330",
      symbol: "600330",
      name: "测试标的",
      market: "CN-SH",
      currency: "CNY",
    },
    side: isEntry ? "buy" : "sell",
    executedAt: isEntry ? "2026-01-01T07:00:00.000Z" : "2026-01-02T07:00:00.000Z",
    quantity: "1000",
    price: isEntry ? "10.25" : "10.75",
    fee: isEntry ? "0" : "0.4",
  };
}

function fixtureSnapshot(): TradingViewAccountMigrationSnapshot {
  return {
    executions: [execution("fill-entry"), execution("fill-exit")],
    oldEpisodes: [{
      id: oldEpisodeId,
      accountId: oldAccount,
      instrumentId: "CN-SH:600330",
      direction: "long",
      executionIds: ["fill-entry", "fill-exit"],
      tradeNature: "simulation",
      simulationRunId: run,
      executionOrder: ["fill-entry", "fill-exit"],
    }],
    newEpisodes: [{
      id: newEpisodeId,
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      instrumentId: "CN-SH:600330",
      direction: "long",
      executionIds: ["fill-entry", "fill-exit"],
      tradeNature: "simulation",
      simulationRunId: run,
      executionOrder: ["fill-entry", "fill-exit"],
    }],
    references: [
      {
        table: "reviews",
        primaryKey: oldEpisodeId,
        owner: "review",
        fields: {
          episode_id: oldEpisodeId,
          instrument_id: "CN-SH:600330",
          cursor: { episodeId: oldEpisodeId, cursor: "2026-01-02T07:00:00.000Z" },
          plan: { episodeId: oldEpisodeId, accountId: oldAccount, source: { accountId: oldAccount, audit: "keep" } },
          review: { decision: "保留", episodeId: oldEpisodeId },
          drawings: null,
          revisions: null,
          confirmed_tags: null,
        },
      },
      {
        table: "recall_documents",
        primaryKey: oldEpisodeId,
        owner: "recall",
        fields: {
          episode_id: oldEpisodeId,
          draft: { episodeId: oldEpisodeId, accountId: oldAccount, source: { accountId: oldAccount, audit: "keep" } },
          finalized: null,
          revision: 1,
          updated_at: "2026-01-03T00:00:00.000Z",
        },
      },
    ],
    canonicalAccountOccupancy: [],
    existingProvisionals: [],
  };
}

function fixtureOptions(): TradingViewAccountMigrationTransactionOptions {
  return {
    snapshotBuilder: () => ({
      snapshot: structuredClone(fixtureSnapshot()),
      blockers: [],
      snapshotDigest: "sha256:fixture-snapshot",
      scans: [],
      domain: { oldEpisodes: 1, newEpisodes: 1, sourceRuns: [run], newEpisodeInterface: "required" },
    }),
    planBuilder: buildTradingViewAccountMigrationPlan,
    now: () => "2026-09-29T00:00:00.000Z",
  };
}

function affectedRows(preview: TradingViewMigrationPreview) {
  return [
    ...preview.executionPlan.map((row) => ({ table: "executions", key: row.executionId, beforeDigest: row.beforeDigest })),
    ...preview.referencePlan.map((row) => ({ table: row.table, key: row.primaryKey, beforeDigest: row.beforeDigest })),
  ];
}

function commitRequest(preview: TradingViewMigrationPreview, overrides: Partial<TradingViewMigrationCommitRequest> = {}): TradingViewMigrationCommitRequest {
  return {
    operationId: preview.operationId,
    idempotencyKey: `${preview.operationId}:commit`,
    baseSnapshotDigest: preview.baseSnapshotDigest,
    planDigest: preview.planDigest,
    expectedAffectedRows: affectedRows(preview),
    provisionalPrincipalAction: preview.provisionalPrincipal.action === "no-op" ? "no-op" : "create-if-absent",
    ...overrides,
  };
}

function previewStore(database: DatabaseSync) {
  return new TradingViewAccountMigrationStore(database, fixtureOptions());
}

afterEach(() => databases.splice(0).forEach((database) => database.close()));

describe("TradingView account migration transaction store", () => {
  it("keeps the default adapter blocked when existing references cannot map to generated canonical episodes", () => {
    const database = openFixture();
    const preview = new TradingViewAccountMigrationStore(database).preview({ operationId: "blocked-preview" });

    expect(preview.status).toBe("blocked");
    expect(preview.adapterBlockers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "domain-run-grouping" }),
    ]));
    expect(preview.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unknown-reference", table: "reviews" }),
    ]));
  });

  it("commits executions, typed review/recall keys and JSON references atomically with one provisional principal", () => {
    const database = openFixture();
    const store = previewStore(database);
    const preview = store.preview({ operationId: "commit-fixture" });
    expect(preview.status).toBe("ready");

    const result = store.commit(commitRequest(preview));

    expect(result).toMatchObject({ status: "committed", idempotent: false, executionCount: 2, quantity: "2000", fee: "0.4" });
    expect(database.prepare("select account, quantity, price, fee, simulation_run_id from executions order by id").all()).toEqual([
      expect.objectContaining({ account: TRADINGVIEW_CANONICAL_ACCOUNT_ID, quantity: "1000", price: "10.25", fee: "0", simulation_run_id: run }),
      expect.objectContaining({ account: TRADINGVIEW_CANONICAL_ACCOUNT_ID, quantity: "1000", price: "10.75", fee: "0.4", simulation_run_id: run }),
    ]);
    const entryEvidence = JSON.parse(String(database.prepare("select evidence_json from executions where id='fill-entry'").get()?.evidence_json));
    expect(entryEvidence.source).toMatchObject({ simulationRunId: run, fileFingerprint: "fixture", row: 3 });
    expect(entryEvidence.accountCorrection).toMatchObject({ originalAccountId: oldAccount, canonicalAccountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID });
    expect(database.prepare("select episode_id, plan_json from reviews").all()).toEqual([
      expect.objectContaining({ episode_id: newEpisodeId, plan_json: expect.stringContaining(newEpisodeId) }),
    ]);
    expect(database.prepare("select episode_id, draft_json from recall_documents").all()).toEqual([
      expect.objectContaining({ episode_id: newEpisodeId, draft_json: expect.stringContaining(newEpisodeId) }),
    ]);
    expect(database.prepare("select account_id, currency, amount, as_of, status, source from account_principal_provisionals").all()).toEqual([
      { account_id: TRADINGVIEW_CANONICAL_ACCOUNT_ID, currency: "CNY", amount: "100000", as_of: null, status: "provisional", source: "user-default" },
    ]);
    expect(store.getCommittedAliases("commit-fixture")).toEqual(expect.arrayContaining([
      { operationId: "commit-fixture", kind: "account", oldId: oldAccount, newId: TRADINGVIEW_CANONICAL_ACCOUNT_ID },
      { operationId: "commit-fixture", kind: "episode", oldId: oldEpisodeId, newId: newEpisodeId },
    ]));
  });

  it("makes an identical commit retry idempotent and rejects a changed plan for the same operation", () => {
    const database = openFixture();
    const store = previewStore(database);
    const preview = store.preview({ operationId: "idempotent-fixture" });
    const request = commitRequest(preview);

    const first = store.commit(request);
    const retry = store.commit(request);

    expect(retry).toMatchObject({ operationId: first.operationId, idempotent: true, status: "committed" });
    expect(() => store.commit({ ...request, planDigest: "sha256:changed" })).toThrowError(
      expect.objectContaining({ code: "migration-idempotency-conflict" }),
    );
  });

  it("rolls back every write when a later execution update fails", () => {
    const database = openFixture();
    const store = previewStore(database);
    const preview = store.preview({ operationId: "atomic-failure" });
    database.exec("create trigger fail_second_migration before update of account on executions when old.id='fill-exit' begin select raise(abort, 'fixture failure'); end");

    expect(() => store.commit(commitRequest(preview))).toThrow("fixture failure");
    expect(database.prepare("select id, account from executions order by id").all()).toEqual([
      { id: "fill-entry", account: oldAccount },
      { id: "fill-exit", account: oldAccount },
    ]);
    expect(database.prepare("select count(*) as count from tradingview_account_migration_operations").get()).toEqual({ count: 0 });
    expect(database.prepare("select count(*) as count from account_principal_provisionals").get()).toEqual({ count: 0 });
  });

  it("rejects a typed primary-key collision before changing executions", () => {
    const database = openFixture();
    database.exec("insert into reviews (episode_id, instrument_id, updated_at) values ('episode-new', 'CN-SH:600330', '2026-01-03T00:00:00.000Z')");
    const store = previewStore(database);
    const preview = store.preview({ operationId: "pk-collision" });

    expect(() => store.commit(commitRequest(preview))).toThrowError(
      expect.objectContaining({ code: "migration-primary-key-conflict" }),
    );
    expect(database.prepare("select distinct account from executions").all()).toEqual([{ account: oldAccount }]);
  });

  it("rejects stale before digests and refuses rollback after a target row changes", () => {
    const database = openFixture();
    const store = previewStore(database);
    const preview = store.preview({ operationId: "stale-fixture" });
    database.prepare("update executions set price='99' where id='fill-entry'").run();

    expect(() => store.commit(commitRequest(preview))).toThrowError(
      expect.objectContaining({ code: "migration-stale" }),
    );
    database.prepare("update executions set price='10.25' where id='fill-entry'").run();
    const committed = store.commit(commitRequest(preview));
    database.prepare("update executions set account='later-account' where id='fill-entry'").run();

    expect(() => store.rollback({
      operationId: committed.operationId,
      rollbackOperationId: "rollback-stale",
      expectedAfterSnapshotDigest: committed.afterSnapshotDigest,
    })).toThrowError(expect.objectContaining({ code: "migration-rollback-stale" }));
    expect(database.prepare("select account from executions where id='fill-entry'").get()).toEqual({ account: "later-account" });
  });

  it("restores the exact before images and makes rollback retries idempotent", () => {
    const database = openFixture();
    const store = previewStore(database);
    const preview = store.preview({ operationId: "rollback-fixture" });
    const committed = store.commit(commitRequest(preview));

    const rollback = store.rollback({
      operationId: committed.operationId,
      rollbackOperationId: "rollback-fixture-op",
      expectedAfterSnapshotDigest: committed.afterSnapshotDigest,
    });
    const retry = store.rollback({
      operationId: committed.operationId,
      rollbackOperationId: "rollback-fixture-op",
      expectedAfterSnapshotDigest: committed.afterSnapshotDigest,
    });

    expect(rollback).toMatchObject({ status: "rolled-back", idempotent: false });
    expect(retry).toMatchObject({ status: "rolled-back", idempotent: true });
    expect(database.prepare("select distinct account from executions").all()).toEqual([{ account: oldAccount }]);
    expect(database.prepare("select count(*) as count from account_principal_provisionals").get()).toEqual({ count: 0 });
    expect(database.prepare("select episode_id from reviews").all()).toEqual([{ episode_id: oldEpisodeId }]);
    expect(database.prepare("select status from tradingview_account_migration_operations where operation_id='rollback-fixture-op'").get()).toEqual({ status: "rolled-back" });
  });

  it("reports a newly added nested reference from rollback preview and leaves it untouched", () => {
    const database = openFixture();
    const store = previewStore(database);
    const committed = store.commit(commitRequest(store.preview({ operationId: "rollback-preview-reference" })));
    database.prepare("insert into app_settings(key, value_json) values(?, ?)")
      .run("later-session", JSON.stringify({ restore: { episodeId: newEpisodeId, accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID } }));

    const preview = store.rollbackPreview({
      operationId: committed.operationId,
      expectedAfterSnapshotDigest: committed.afterSnapshotDigest,
    });

    expect(preview.status).toBe("blocked");
    expect(preview.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "migration-rollback-stale", table: "app_settings" }),
    ]));
    expect(database.prepare("select value_json from app_settings where key='later-session'").get()).toEqual({
      value_json: JSON.stringify({ restore: { episodeId: newEpisodeId, accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID } }),
    });
  });

  it("rejects a newly added normalized recall dependency before deleting or restoring any row", () => {
    const database = openFixture();
    const store = previewStore(database);
    const committed = store.commit(commitRequest(store.preview({ operationId: "rollback-recall-reference" })));
    database.prepare("insert into recall_plan_associations(episode_id, version_kind, document_revision, plan_id, decision_id, status) values(?, 'draft', 1, 'later-plan', 'later-decision', 'linked')")
      .run(newEpisodeId);
    const executionRows = database.prepare("select id, account from executions order by id").all();

    expect(() => store.rollback({
      operationId: committed.operationId,
      rollbackOperationId: "rollback-recall-reference-op",
      expectedAfterSnapshotDigest: committed.afterSnapshotDigest,
    })).toThrowError(expect.objectContaining({ code: "migration-rollback-stale" }));
    expect(database.prepare("select id, account from executions order by id").all()).toEqual(executionRows);
    expect(database.prepare("select episode_id, plan_id from recall_plan_associations").all()).toEqual([{
      episode_id: newEpisodeId,
      plan_id: "later-plan",
    }]);
  });

  it("keeps rollback aliases as audit rows while hiding them from committed alias lookup", () => {
    const database = openFixture();
    const store = previewStore(database);
    const committed = store.commit(commitRequest(store.preview({ operationId: "inactive-aliases" })));

    store.rollback({
      operationId: committed.operationId,
      rollbackOperationId: "inactive-aliases-rollback",
      expectedAfterSnapshotDigest: committed.afterSnapshotDigest,
    });

    expect(database.prepare("select count(*) as count from tradingview_account_migration_aliases where operation_id='inactive-aliases'").get()).toEqual({ count: 2 });
    expect(store.getCommittedAliases()).toEqual([]);
    expect(store.getCommittedAliases("inactive-aliases")).toEqual([]);
  });

  it("rolls back when a post-write trigger changes an execution financial field", () => {
    const database = openFixture();
    const store = previewStore(database);
    const preview = store.preview({ operationId: "financial-after-guard" });
    const before = database.prepare("select * from executions order by id").all();
    database.exec("create trigger corrupt_fee after update of account on executions when new.id='fill-exit' begin update executions set fee='999' where id=new.id; end");

    expect(() => store.commit(commitRequest(preview))).toThrowError(expect.objectContaining({ code: "migration-stale" }));
    expect(database.prepare("select * from executions order by id").all()).toEqual(before);
    expect(database.prepare("select count(*) as count from tradingview_account_migration_operations").get()).toEqual({ count: 0 });
  });

  it("rejects rollback when a post-write trigger corrupts a restored row", () => {
    const database = openFixture();
    const store = previewStore(database);
    const committed = store.commit(commitRequest(store.preview({ operationId: "rollback-after-guard" })));
    const committedExecutions = database.prepare("select * from executions order by id").all();
    database.exec("create trigger corrupt_reverse after update of account on executions begin update executions set fee='999' where id=new.id; end");

    expect(() => store.rollback({
      operationId: committed.operationId,
      rollbackOperationId: "rollback-after-guard-op",
      expectedAfterSnapshotDigest: committed.afterSnapshotDigest,
    })).toThrowError(expect.objectContaining({ code: "migration-rollback-stale" }));
    expect(database.prepare("select * from executions order by id").all()).toEqual(committedExecutions);
    expect(database.prepare("select status from tradingview_account_migration_operations where operation_id=?").get(committed.operationId)).toEqual({ status: "committed" });
    expect(database.prepare("select count(*) as count from tradingview_account_migration_operations where operation_id=?").get("rollback-after-guard-op")).toEqual({ count: 0 });
  });

  it("rejects a complete request change even when the operation and plan are unchanged", () => {
    const database = openFixture();
    const store = previewStore(database);
    const request = commitRequest(store.preview({ operationId: "complete-idempotency" }));
    store.commit(request);

    expect(() => store.commit({ ...request, provisionalPrincipalAction: "no-op" })).toThrowError(
      expect.objectContaining({ code: "migration-idempotency-conflict" }),
    );
  });
});
