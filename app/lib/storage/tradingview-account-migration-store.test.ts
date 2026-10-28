import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { initializeSqlite } from "../../../db/sqlite";
import { SQLITE_MIGRATIONS } from "../../../db/sqlite-schema";
import { TRADINGVIEW_ACCOUNT_MIGRATION_SCHEMA } from "../../../db/tradingview-account-migration-schema";
import {
  buildTradingViewAccountMigrationPlan,
  canonicalMigrationPlanDigest,
  type TradingViewAccountMigrationSnapshot,
} from "./tradingview-account-migration-plan";
import {
  type TradingViewAccountMigrationTransactionOptions,
  type TradingViewMigrationCommitRequest,
  type TradingViewMigrationCommitResult,
  type TradingViewMigrationPreview,
} from "./tradingview-account-migration-contracts";
import { TradingViewAccountMigrationStore } from "./tradingview-account-migration-store";
import { readBookVersion } from "./trade-book-version";
import { createTradeChanges } from "./sqlite-store";
import type { TradingViewMaintenanceRequest } from "./sqlite-contracts";
import { copySourceMaterialRows, materializeSourceMaterialContext, projectEvidence } from "./source-materials";
import type { TradeExecution } from "../trades/types";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../trades/tradingview-account-identity";

const databases: DatabaseSync[] = [];
const temporaryDirectories: string[] = [];
const oldAccount = "tradingview:old:fixture";
const run = "fixture-run";
const oldEpisodeId = "episode-old";
const newEpisodeId = "episode-new";

describe("TradingView unified engine ownership", () => {
  it("persists the original plan and consumes it through one write transaction after a Store restart", () => {
    const database = openFixture();
    const preview = previewStore(database).preview({ operationId: "engine-persisted" });
    expect(database.prepare("select count(*) as n from trade_change_plans").get()?.n).toBe(1);
    const calls: string[] = [];
    const exec = database.exec.bind(database);
    database.exec = (sql: string) => { calls.push(sql.toLowerCase()); return exec(sql); };
    const result = previewStore(database).commit(commitRequest(preview));
    expect(calls.filter(sql => sql === "begin immediate")).toHaveLength(1);
    expect(calls.filter(sql => sql === "begin")).toHaveLength(0);
    expect(result.status).toBe("committed");
    expect(database.prepare("select count(*) as n from trade_change_receipts").get()?.n).toBe(1);
    expect(database.prepare("select receipt_id from trade_change_plans").get()?.receipt_id).toBeTruthy();
  });

  it.each(["trade_change_receipts", "trade_change_requests"])("rejects late %s trigger pollution and restores all data", (table) => {
    const database = openFixture();
    const store = previewStore(database);
    const preview = store.preview({ operationId: `late-${table}` });
    const version = readBookVersion(database);
    database.exec(`create trigger late_engine_pollution after insert on ${table} begin
      insert into app_settings(key,value_json,updated_at) values ('late-link','{"executionId":"fill-entry"}','late'); end`);
    expect(() => store.commit(commitRequest(preview))).toThrow();
    expect(database.prepare("select account from executions where id='fill-entry'").get()?.account).toBe(oldAccount);
    expect(database.prepare("select count(*) as n from tradingview_account_migration_operations").get()?.n).toBe(0);
    expect(database.prepare("select count(*) as n from trade_change_receipts").get()?.n).toBe(0);
    expect(database.prepare("select count(*) as n from trade_change_requests").get()?.n).toBe(0);
    expect(database.prepare("select count(*) as n from app_settings").get()?.n).toBe(0);
    expect(readBookVersion(database)).toEqual(version);
  });

  it("accepts only a fixed maintenance scope through the real unified engine", () => {
    const database = openFixture();
    database.exec("delete from reviews; delete from recall_documents");
    const changes = createTradeChanges(database);
    const review = changes.prepare({ kind: "tradingview-account-migration", operationId: "direct-fixed-intent" });
    expect(review.kind).toBe("tradingview-account-migration");
    expect(review.tradingView?.status).toBe("ready");
    const preview = review.tradingView as TradingViewMigrationPreview;
    const receipt = changes.commit({requestId:"direct-fixed-request",planId:review.planId,choices:{},maintenanceRequest:commitRequest(preview)});
    expect(receipt.result.tradingView).toMatchObject({operationId:"direct-fixed-intent",status:"committed"});
    expect(() => changes.prepare({kind:"tradingview-account-migration",operationId:"inject",sql:"delete from executions"} as never)).toThrow();
  });

  it("rejects caller maintenance fields and preserves normalized affected-row retry semantics", () => {
    const database = openFixture(), store = previewStore(database);
    const preview = store.preview({ operationId: "complete-request" }), request = commitRequest(preview);
    expect(() => store.commit({...request, sql:"delete from executions"} as never)).toThrow();
    expect(database.prepare("select count(*) as n from tradingview_account_migration_operations").get()?.n).toBe(0);
    const result = store.commit(request);
    expect(store.commit({...request,expectedAffectedRows:[...request.expectedAffectedRows!].reverse()})).toEqual({...result,idempotent:true});
    expect(database.prepare("select count(*) as n from trade_change_receipts").get()?.n).toBe(1);
    expect(() => store.commit({...request,provisionalPrincipalAction:"no-op"})).toThrowError(expect.objectContaining({code:"migration-idempotency-conflict"}));
  });

  it.each(["trade_change_receipts", "trade_change_requests"])("rejects a late %s source graph mutation on forward and inverse writes", (table) => {
    const database = openDefaultFixture();
    material(database,"late-source");
    const store = new TradingViewAccountMigrationStore(database), preview = store.preview({operationId:`source-${table}`});
    const before=copySourceMaterialRows(database), version=readBookVersion(database);
    const createTrigger=()=>database.exec(`create trigger late_source_pollution after insert on ${table} begin
      insert into source_observations values ('late-observation','late-source:v1','late','located','{}','{}','${oldAccount}'); end`);
    createTrigger();
    expect(()=>store.commit(commitRequest(preview))).toThrow();
    expect(copySourceMaterialRows(database)).toEqual(before);
    expect(readBookVersion(database)).toEqual(version);
    expect(database.prepare("select count(*) as n from tradingview_account_migration_operations").get()?.n).toBe(0);
    database.exec("drop trigger late_source_pollution");
    const committed=store.commit(commitRequest(preview)), after=copySourceMaterialRows(database), afterVersion=readBookVersion(database);
    const operation=database.prepare("select * from tradingview_account_migration_operations").all();
    createTrigger();
    expect(()=>store.rollback({operationId:committed.operationId,rollbackOperationId:`inverse-${table}`,expectedAfterSnapshotDigest:committed.afterSnapshotDigest})).toThrow();
    expect(copySourceMaterialRows(database)).toEqual(after);
    expect(readBookVersion(database)).toEqual(afterVersion);
    expect(database.prepare("select * from tradingview_account_migration_operations").all()).toEqual(operation);
    expect(database.prepare("select count(*) as n from trade_change_receipts").get()?.n).toBe(1);
  });

  it.each(["forward", "rollback"] as const)("checks late source mutations when a consumed %s plan gains a request alias", (stage) => {
    const database=openDefaultFixture();
    material(database,"replay-source");
    const changes=createTradeChanges(database);
    let review=changes.prepare({kind:"tradingview-account-migration",operationId:"alias-replay"});
    let maintenanceRequest:TradingViewMaintenanceRequest=commitRequest(review.tradingView as TradingViewMigrationPreview);
    let originalRequestId="alias-first";
    let first=changes.commit({requestId:originalRequestId,planId:review.planId,choices:{},maintenanceRequest});
    if(stage==="rollback") {
      const result=first.result.tradingView!;
      review=changes.prepare({kind:"tradingview-account-migration-rollback",operationId:result.operationId,
        rollbackOperationId:"source-replay-inverse",expectedAfterSnapshotDigest:result.afterSnapshotDigest});
      maintenanceRequest={operationId:result.operationId,rollbackOperationId:"source-replay-inverse",expectedAfterSnapshotDigest:result.afterSnapshotDigest};
      originalRequestId="alias-first-inverse";
      first=changes.commit({requestId:originalRequestId,planId:review.planId,choices:{},maintenanceRequest});
    }
    const before=copySourceMaterialRows(database),version=readBookVersion(database);
    const aliasCount=database.prepare("select count(*) as n from trade_change_requests").get()!.n;
    database.exec(`create trigger late_alias_source after insert on trade_change_requests begin
      insert into source_observations values ('replay-observation','replay-source:v1','late','located','{}','{}','${oldAccount}'); end`);
    expect(()=>changes.commit({requestId:"alias-second",planId:review.planId,choices:{},maintenanceRequest}))
      .toThrowError(expect.objectContaining({code:"migration-stale",message:"A request alias changed the current maintenance domain"}));
    expect(copySourceMaterialRows(database)).toEqual(before);
    expect(readBookVersion(database)).toEqual(version);
    expect(database.prepare("select count(*) as n from trade_change_requests").get()?.n).toBe(aliasCount);
    expect(changes.getCommit("alias-second")).toBeNull();
    expect(changes.getCommit(originalRequestId)).toEqual(first);
  });

  it.each([
    ["forward", "trade_change_receipts"],
    ["rollback", "trade_change_receipts"],
    ["forward", "trade_change_requests"],
    ["rollback", "trade_change_requests"],
    ["forward-replay", "trade_change_requests"],
    ["rollback-replay", "trade_change_requests"],
  ] as const)("rejects an extra request alias from a late %s %s trigger", (stage, table) => {
    const database = openDefaultFixture();
    material(database, "alias-proof");
    const changes = createTradeChanges(database);
    let review = changes.prepare({ kind: "tradingview-account-migration", operationId: "exact-alias-forward" });
    let maintenanceRequest: TradingViewMaintenanceRequest = commitRequest(review.tradingView as TradingViewMigrationPreview);
    if (stage !== "forward") {
      const forward = changes.commit({ requestId: "original-forward", planId: review.planId, choices: {}, maintenanceRequest });
      if (stage.startsWith("rollback")) {
        const result = forward.result.tradingView!;
        review = changes.prepare({ kind: "tradingview-account-migration-rollback", operationId: result.operationId,
          rollbackOperationId: "exact-alias-inverse", expectedAfterSnapshotDigest: result.afterSnapshotDigest });
        maintenanceRequest = { operationId: result.operationId, rollbackOperationId: "exact-alias-inverse",
          expectedAfterSnapshotDigest: result.afterSnapshotDigest };
        if (stage === "rollback-replay") {
          changes.commit({ requestId: "original-inverse", planId: review.planId, choices: {}, maintenanceRequest });
        }
      }
    }
    const input = { requestId: "only-expected-alias", planId: review.planId, choices: {}, maintenanceRequest };
    const tables = database.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name").all();
    const copyAllRows = () => Object.fromEntries(tables.map(row => [String(row.name),
      database.prepare(`select * from "${String(row.name)}"`).all().map(value => JSON.stringify(value)).sort()]));
    const before = copyAllRows(), version = readBookVersion(database);
    const aliasesBefore = database.prepare("select * from trade_change_requests order by request_id").all();
    database.exec(`create trigger extra_request_alias after insert on ${table}
      ${table === "trade_change_requests" ? "when new.request_id='only-expected-alias'" : ""} begin
      insert into trade_change_requests(request_id,request_digest,receipt_id)
      values ('unplanned-alias','unplanned-digest',new.${table === "trade_change_receipts" ? "id" : "receipt_id"}); end`);

    let failure: unknown;
    try { changes.commit(input); } catch (error) { failure = error; }
    expect(copyAllRows()).toEqual(before);
    expect(readBookVersion(database)).toEqual(version);
    expect(changes.getCommit("unplanned-alias")).toBeNull();
    expect(changes.getCommit(input.requestId)).toBeNull();
    expect(failure).toEqual(expect.objectContaining({ code: "COMMIT_ALIAS_CHANGED" }));

    database.exec("drop trigger extra_request_alias");
    const receipt = changes.commit(input);
    expect(receipt.result.tradingView?.status).toBe(stage.startsWith("rollback") ? "rolled-back" : "committed");
    expect(database.prepare("select * from trade_change_requests order by request_id").all()).toEqual([
      ...aliasesBefore,
      { request_id: input.requestId, request_digest: expect.stringMatching(/^[a-f0-9]{64}$/), receipt_id: receipt.receiptId },
    ].sort((left, right) => String(left.request_id).localeCompare(String(right.request_id))));
    expect(changes.getCommit(input.requestId)).toEqual(receipt);
  });

  it.each(["forward", "rollback"] as const)("adds only the requested alias when replaying a consumed %s plan", (stage) => {
    const database = openDefaultFixture();
    material(database, "legal-replay");
    const changes = createTradeChanges(database);
    let review = changes.prepare({ kind: "tradingview-account-migration", operationId: "legal-forward" });
    let maintenanceRequest: TradingViewMaintenanceRequest = commitRequest(review.tradingView as TradingViewMigrationPreview);
    let receipt = changes.commit({ requestId: "legal-original-forward", planId: review.planId, choices: {}, maintenanceRequest });
    if (stage === "rollback") {
      const result = receipt.result.tradingView!;
      review = changes.prepare({ kind: "tradingview-account-migration-rollback", operationId: result.operationId,
        rollbackOperationId: "legal-inverse", expectedAfterSnapshotDigest: result.afterSnapshotDigest });
      maintenanceRequest = { operationId: result.operationId, rollbackOperationId: "legal-inverse",
        expectedAfterSnapshotDigest: result.afterSnapshotDigest };
      receipt = changes.commit({ requestId: "legal-original-inverse", planId: review.planId, choices: {}, maintenanceRequest });
    }
    const sourceBefore = copySourceMaterialRows(database), version = readBookVersion(database);
    const aliasCount = database.prepare("select count(*) as n from trade_change_requests").get()!.n;
    const input = { requestId: "legal-replay-alias", planId: review.planId, choices: {}, maintenanceRequest };
    expect(changes.commit(input)).toEqual(receipt);
    expect(changes.getCommit(input.requestId)).toEqual(receipt);
    expect(changes.commit(input)).toEqual(receipt);
    expect(copySourceMaterialRows(database)).toEqual(sourceBefore);
    expect(readBookVersion(database)).toEqual(version);
    expect(database.prepare("select count(*) as n from trade_change_requests").get()!.n).toBe(Number(aliasCount) + 1);
  });

  it.each([
    ["forward", "update"], ["forward", "delete"],
    ["rollback", "update"], ["rollback", "delete"],
  ] as const)("rejects a late alias %s replay trigger that performs %s on an existing binding", (stage, mutation) => {
    const database = openDefaultFixture();
    const changes = createTradeChanges(database);
    let review = changes.prepare({ kind: "tradingview-account-migration", operationId: "binding-forward" });
    let maintenanceRequest: TradingViewMaintenanceRequest = commitRequest(review.tradingView as TradingViewMigrationPreview);
    const forward = changes.commit({ requestId: "binding-original-forward", planId: review.planId, choices: {}, maintenanceRequest });
    if (stage === "rollback") {
      const result = forward.result.tradingView!;
      review = changes.prepare({ kind: "tradingview-account-migration-rollback", operationId: result.operationId,
        rollbackOperationId: "binding-inverse", expectedAfterSnapshotDigest: result.afterSnapshotDigest });
      maintenanceRequest = { operationId: result.operationId, rollbackOperationId: "binding-inverse",
        expectedAfterSnapshotDigest: result.afterSnapshotDigest };
      changes.commit({ requestId: "binding-original-inverse", planId: review.planId, choices: {}, maintenanceRequest });
    }
    const aliasesBefore = database.prepare("select * from trade_change_requests order by request_id").all();
    const version = readBookVersion(database);
    // Inject beyond the schema's fail-fast guard to exercise the engine's
    // independent exact-table proof. Production immutability stays enabled.
    database.exec(`drop trigger trade_change_request_immutable_${mutation}`);
    const mutationSql = mutation === "update"
      ? "update trade_change_requests set request_digest='changed' where request_id='binding-original-forward'"
      : "delete from trade_change_requests where request_id='binding-original-forward'";
    database.exec(`create trigger mutate_request_alias after insert on trade_change_requests
      when new.request_id='binding-replay' begin ${mutationSql}; end`);
    expect(() => changes.commit({ requestId: "binding-replay", planId: review.planId, choices: {}, maintenanceRequest }))
      .toThrowError(expect.objectContaining({ code: "COMMIT_ALIAS_CHANGED" }));
    expect(database.prepare("select * from trade_change_requests order by request_id").all()).toEqual(aliasesBefore);
    expect(readBookVersion(database)).toEqual(version);
    expect(changes.getCommit("binding-replay")).toBeNull();
    expect(changes.getCommit("binding-original-forward")).toEqual(forward);
  });

  it.each(["request", "ledger", "historical-ledger"])("proves the original %s before allowing rollback", (corrupt) => {
    const database=openDefaultFixture();
    if(corrupt!=="historical-ledger") material(database,"proof-source");
    const store=new TradingViewAccountMigrationStore(database), committed=store.commit(commitRequest(store.preview({operationId:`proof-${corrupt}`})));
    if(corrupt==="request") {
      const row=database.prepare("select request_json from tradingview_account_migration_operations where operation_id=?").get(committed.operationId)!;
      const request=JSON.parse(String(row.request_json));request.idempotencyKey="invented";
      database.prepare("update tradingview_account_migration_operations set request_json=? where operation_id=?").run(JSON.stringify(request),committed.operationId);
    } else {
      if(corrupt==="historical-ledger") markHistorical(database,committed.operationId);
      const row=database.prepare("select before_json from tradingview_account_migration_rows where operation_id=? and table_name='executions' and primary_key='fill-entry'").get(committed.operationId)!;
      const before=JSON.parse(String(row.before_json));before.price="12345";
      database.prepare("update tradingview_account_migration_rows set before_json=?,before_digest=? where operation_id=? and table_name='executions' and primary_key='fill-entry'").run(JSON.stringify(before),canonicalMigrationPlanDigest(before),committed.operationId);
    }
    const facts=database.prepare("select * from executions").all(),source=copySourceMaterialRows(database),version=readBookVersion(database);
    expect(store.rollbackPreview({operationId:committed.operationId})).toMatchObject({status:"blocked",blockers:expect.arrayContaining([expect.objectContaining({code:"migration-rollback-stale"})])});
    expect(()=>store.rollback({operationId:committed.operationId,rollbackOperationId:`rejected-${corrupt}`,expectedAfterSnapshotDigest:committed.afterSnapshotDigest})).toThrow();
    expect(database.prepare("select * from executions").all()).toEqual(facts);
    expect(copySourceMaterialRows(database)).toEqual(source);
    expect(readBookVersion(database)).toEqual(version);
  });

  it("rejects a commit retry after its original operation was rolled back", () => {
    const database=openDefaultFixture(),store=new TradingViewAccountMigrationStore(database);
    const request=commitRequest(store.preview({operationId:"completed-inverse"}));
    const committed=store.commit(request);
    store.rollback({operationId:committed.operationId,rollbackOperationId:"completed-inverse-rollback",expectedAfterSnapshotDigest:committed.afterSnapshotDigest});
    const version=readBookVersion(database),receipts=database.prepare("select * from trade_change_receipts").all();
    expect(()=>store.commit(request)).toThrowError(expect.objectContaining({code:"migration-idempotency-conflict"}));
    expect(database.prepare("select * from trade_change_receipts").all()).toEqual(receipts);
    expect(readBookVersion(database)).toEqual(version);
    expect(database.prepare("select account from executions where id='fill-entry'").get()?.account).toBe(oldAccount);
  });
});

function openFixture(path = ":memory:") {
  const database = new DatabaseSync(path);
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

afterEach(() => {
  databases.splice(0).forEach((database) => database.close());
  temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

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

    expect(() => store.commit(commitRequest(preview))).toThrowError(expect.objectContaining({
      code: "UNEXPECTED_FAILURE", category: "unexpected", cause: expect.objectContaining({ message: "fixture failure", code: "ERR_SQLITE_ERROR" }),
    }));
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
      expect.objectContaining({ code: "migration-stale", details: { engineCode: "BOOK_VERSION_CHANGED" } }),
    );
    database.prepare("update executions set price='10.25' where id='fill-entry'").run();
    expect(() => store.commit(commitRequest(preview))).toThrowError(expect.objectContaining({ code: "migration-stale", details: { engineCode: "BOOK_VERSION_CHANGED" } }));
    const committed = store.commit(commitRequest(store.preview({ operationId: "stale-fixture-refreshed" })));
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


function openDefaultFixture() {
  const database = openFixture();
  database.exec("delete from reviews");
  database.exec("delete from recall_documents");
  return database;
}

function principal(database: DatabaseSync, amount = "100000", revision = 7) {
  database.prepare("insert into account_principal_provisionals values (?, 'CNY', ?, null, 'provisional', 'user-default', ?, '2026-01-03T00:00:00Z')")
    .run(TRADINGVIEW_CANONICAL_ACCOUNT_ID, amount, revision);
}

function material(database: DatabaseSync, id: string, ids = ["fill-entry", "fill-exit"], accountId = oldAccount) {
  const version = `${id}:v1`;
  database.prepare("insert into source_materials(id,created_at) values (?, '2026-01-03T00:00:00Z')").run(id);
  const scope = { accounts: { values: [accountId], unknown: false }, markets: { values: ["CN-SH"], unknown: false }, instruments: { values: ["CN-SH:600330"], unknown: false }, periods: { values: [], unknown: true } };
  database.prepare(`insert into source_material_versions
    (id,material_id,parser_version,source_kind,locator_json,file_fingerprint,scope_json,diagnostics_json,content_json,recorded_at)
    values (?,?,'fixture','tradingview','{}','fixture',?,'[]','{}','2026-01-03T00:00:00Z')`).run(version, id, JSON.stringify(scope));
  for (const executionId of ids) {
    const observation = `${id}:${executionId}`;
    database.prepare("insert into source_observations values (?,?,?,'located','{}',?,?)")
      .run(observation, version, executionId, JSON.stringify({ executionId, accountId, original: true }), accountId);
    database.prepare("insert into source_execution_links values (?,?,'fixture','2026-01-03T00:00:00Z')").run(observation, executionId);
  }
  database.prepare("update source_materials set current_version_id=? where id=?").run(version, id);
}

function setting(database: DatabaseSync, key: string, value: unknown) {
  database.prepare("insert into app_settings(key,value_json) values (?,?)").run(key, JSON.stringify(value));
}

function markHistorical(database: DatabaseSync, operationId: string) {
  // Reproduce an old operation which predates the complete-dependency policy.
  database.prepare("delete from tradingview_account_migration_dependencies where operation_id=? and (table_name not in ('reviews','recall_documents','app_settings') or row_key like '@%')").run(operationId);
  for (const row of database.prepare("select table_name,row_key from tradingview_account_migration_dependencies where operation_id=?").all(operationId)) {
    const oldKey = canonicalMigrationPlanDigest({ table: row.table_name, primaryKey: JSON.parse(String(row.row_key)) });
    database.prepare("update tradingview_account_migration_dependencies set row_key=? where operation_id=? and table_name=? and row_key=?")
      .run(oldKey, operationId, row.table_name, row.row_key);
  }
}

function factStateAudit(database: DatabaseSync, id: string, accountId: string | null = oldAccount) {
  const raw = database.prepare("select * from executions where id='fill-entry'").get()!;
  const before = { id: "fill-entry", instrumentId: raw.instrument_id, accountId, side: raw.side,
    executedAt: raw.executed_at, quantity: raw.quantity, price: raw.price, fee: raw.fee,
    currency: raw.currency, tradeNature: raw.trade_nature, simulationRunId: raw.simulation_run_id,
    importBatchId: raw.import_batch_id, rawEvidenceJson: raw.evidence_json,
    evidence: JSON.parse(String(raw.evidence_json)), instrument: execution("fill-entry").instrument };
  const recordedAt = "2026-01-04T00:00:00Z";
  const encoded = JSON.stringify({ kind: "fact-state-audit-v1", id, executionId: "fill-entry", instrumentId: raw.instrument_id,
    accountId, action: "activate", reason: "fixture activation", recordedAt, before, changes: [{ before, after: before }] });
  // A retained audit may precede a later account correction. Insert it against
  // its real original account so the schema's raw-fact proof remains active.
  database.prepare("update executions set account=? where id='fill-entry'").run(accountId);
  database.prepare("insert into trade_revisions(id,instrument_id,account_id,request_json,revision_json,recorded_at,scope_account_unknown) values (?,?,?,?,?,?,?)")
    .run(id, raw.instrument_id, accountId ?? "", encoded, encoded, recordedAt, accountId === null ? 1 : 0);
  database.prepare("update executions set account=? where id='fill-entry'").run(raw.account);
  database.prepare("insert into execution_fact_states values ('fill-entry','active',?,'fixture activation',?) on conflict(execution_id) do update set revision_id=excluded.revision_id,recorded_at=excluded.recorded_at")
    .run(id, recordedAt);
}

describe("TradingView complete independent dependencies and material mappings", () => {
  it.each([oldAccount, null])("preserves immutable fact-state audit history with account %s through a real default migration", (accountId) => {
    const database = openDefaultFixture();
    factStateAudit(database, "activation-audit", accountId);
    const before = database.prepare("select * from trade_revisions").all();
    const state = database.prepare("select * from execution_fact_states").all();
    const store = new TradingViewAccountMigrationStore(database);
    const preview = store.preview();
    expect(preview.status).toBe("ready");
    const committed = store.commit(commitRequest(preview));
    expect(database.prepare("select * from trade_revisions").all()).toEqual(before);
    expect(database.prepare("select * from execution_fact_states").all()).toEqual(state);
    expect(store.rollbackPreview({ operationId: committed.operationId }).status).toBe("ready");
    store.rollback({ operationId: committed.operationId, rollbackOperationId: "preserved-audit-rollback", expectedAfterSnapshotDigest: committed.afterSnapshotDigest });
    expect(database.prepare("select * from trade_revisions").all()).toEqual(before);
  });

  it("blocks rollback after a new immutable fact-state audit is associated with the migrated execution", () => {
    const database = openDefaultFixture();
    const store = new TradingViewAccountMigrationStore(database);
    const committed = store.commit(commitRequest(store.preview()));
    factStateAudit(database, "later-activation-audit", TRADINGVIEW_CANONICAL_ACCOUNT_ID);
    expect(store.rollbackPreview({ operationId: committed.operationId }).blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "trade_revisions", primaryKey: '["later-activation-audit"]' }),
    ]));
    expect(() => store.rollback({ operationId: committed.operationId, rollbackOperationId: "later-audit-rollback", expectedAfterSnapshotDigest: committed.afterSnapshotDigest }))
      .toThrowError(expect.objectContaining({ code: "migration-rollback-stale" }));
  });

  it("reads an existing default principal in the real default snapshot", () => {
    const database = openDefaultFixture();
    principal(database);
    const preview = new TradingViewAccountMigrationStore(database).preview();
    expect(preview.status).toBe("ready");
    expect(preview.provisionalPrincipal).toMatchObject({ action: "no-op", revision: 7 });
  });

  it("blocks a conflicting principal during real preview", () => {
    const database = openDefaultFixture();
    principal(database, "999");
    const preview = new TradingViewAccountMigrationStore(database).preview();
    expect(preview.status).toBe("blocked");
    expect(preview.blockers).toContainEqual(expect.objectContaining({ code: "principal-conflict" }));
  });

  it.each(["updated_at", "revision", "amount"])("checks the full no-op principal %s before rollback", (column) => {
    const database = openDefaultFixture();
    principal(database);
    const store = new TradingViewAccountMigrationStore(database);
    const committed = store.commit(commitRequest(store.preview()));
    database.prepare(`update account_principal_provisionals set ${column}=?`).run(column === "revision" ? 8 : column === "amount" ? "999" : "2026-02-01T00:00:00Z");
    expect(store.rollbackPreview({ operationId: committed.operationId })).toMatchObject({
      status: "blocked", blockers: expect.arrayContaining([expect.objectContaining({ table: "account_principal_provisionals" })]),
    });
  });

  it.each(["delete", "move"])("blocks rollback when an unchanged relevant reference is %s", (change) => {
    const database = openFixture();
    setting(database, "existing-canonical", { accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID });
    const store = previewStore(database);
    const committed = store.commit(commitRequest(store.preview()));
    if (change === "delete") database.exec("delete from app_settings where key='existing-canonical'");
    else database.exec("update app_settings set value_json='{}' where key='existing-canonical'");
    expect(store.rollbackPreview({ operationId: committed.operationId })).toMatchObject({ status: "blocked" });
  });

  it("blocks a new execution-only reference after commit", () => {
    const database = openFixture();
    const store = previewStore(database);
    const committed = store.commit(commitRequest(store.preview()));
    setting(database, "new-execution-ref", { nested: { executionIds: ["fill-entry"] } });
    expect(store.rollbackPreview({ operationId: committed.operationId })).toMatchObject({ status: "blocked", blockers: expect.arrayContaining([expect.objectContaining({ table: "app_settings" })]) });
  });

  it("binds full relevant rows and collection membership to preview even when the planner does not rewrite them", () => {
    const database = openDefaultFixture();
    const store = new TradingViewAccountMigrationStore(database);
    const preview = store.preview();
    const beforeVersion = readBookVersion(database);
    setting(database, "canonical-ref", { accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID });
    expect(readBookVersion(database)).toEqual(beforeVersion);
    expect(() => store.commit(commitRequest(preview))).toThrowError(expect.objectContaining({ code: "migration-stale" }));
    expect(database.prepare("select account from executions where id='fill-entry'").get()).toEqual({ account: oldAccount });
  });

  it("updates every linked material projection while preserving immutable evidence and advances the version on rollback", () => {
    const database = openDefaultFixture();
    material(database, "M1");
    material(database, "M2", ["fill-entry"]);
    const before = copySourceMaterialRows(database);
    const beforeVersion = readBookVersion(database);
    const store = new TradingViewAccountMigrationStore(database);
    const committed = store.commit(commitRequest(store.preview()));
    const after = copySourceMaterialRows(database);
    expect(after.mappings).toHaveLength(2);
    expect(after.mappings).toEqual(expect.arrayContaining([expect.objectContaining({ material_id: "M1", original_account_id: oldAccount, canonical_account_id: TRADINGVIEW_CANONICAL_ACCOUNT_ID, audit_reference: committed.operationId })]));
    expect(after.versions).toEqual(before.versions);
    expect(after.observations).toEqual(before.observations);
    expect(after.links).toEqual(before.links);
    expect(projectEvidence(materializeSourceMaterialContext(after), { accounts: [TRADINGVIEW_CANONICAL_ACCOUNT_ID] }).materials.map(row => row.id).sort()).toEqual(["M1", "M2"]);
    const committedVersion = readBookVersion(database);
    expect(committedVersion.sequence).toBeGreaterThan(beforeVersion.sequence);
    store.rollback({ operationId: committed.operationId, rollbackOperationId: "mapped-rollback", expectedAfterSnapshotDigest: committed.afterSnapshotDigest });
    expect(copySourceMaterialRows(database)).toEqual(before);
    expect(readBookVersion(database).sequence).toBeGreaterThan(committedVersion.sequence);
  });

  it("restores an existing material mapping byte-for-byte rather than deleting it", () => {
    const database = openDefaultFixture();
    material(database, "M1", undefined, "original-account");
    database.prepare("insert into source_material_account_mappings values (?,?,?,?,?,?)").run("M1", "original-account", oldAccount, "original-reason", "original-audit", "2026-01-02");
    const before = copySourceMaterialRows(database);
    const store = new TradingViewAccountMigrationStore(database);
    const committed = store.commit(commitRequest(store.preview()));
    expect(copySourceMaterialRows(database).mappings[0]).toMatchObject({ canonical_account_id: TRADINGVIEW_CANONICAL_ACCOUNT_ID });
    store.rollback({ operationId: committed.operationId, rollbackOperationId: "prior-mapping-rollback", expectedAfterSnapshotDigest: committed.afterSnapshotDigest });
    expect(copySourceMaterialRows(database)).toEqual(before);
  });

  it("rejects a material-wide mapping which would change an execution outside the migration scope", () => {
    const database = openDefaultFixture();
    database.exec("insert into executions(id,instrument_id,account,side,executed_at,quantity,price,fee,currency,evidence_json) values('live-other','CN-SH:600330','futu:live','buy','2026-01-05','1','1','0','CNY','{}')");
    material(database, "mixed", ["fill-entry", "live-other"]);
    const before = copySourceMaterialRows(database);
    const store = new TradingViewAccountMigrationStore(database);
    expect(() => store.commit(commitRequest(store.preview()))).toThrowError(expect.objectContaining({ code: "migration-blocked" }));
    expect(copySourceMaterialRows(database)).toEqual(before);
    expect(database.prepare("select account from executions where id='fill-entry'").get()).toEqual({ account: oldAccount });
  });

  it("blocks rollback after a new material association is attached to a migrated execution", () => {
    const database = openDefaultFixture();
    material(database, "initial");
    const store = new TradingViewAccountMigrationStore(database);
    const committed = store.commit(commitRequest(store.preview()));
    material(database, "later", ["fill-entry"]);
    expect(store.rollbackPreview({ operationId: committed.operationId })).toMatchObject({ status: "blocked", blockers: expect.arrayContaining([expect.objectContaining({ table: "source_execution_links" })]) });
  });

  it("keeps a provable historical operation without source associations rollbackable", () => {
    const database = openFixture();
    const store = previewStore(database);
    const committed = store.commit(commitRequest(store.preview()));
    markHistorical(database, committed.operationId);
    expect(store.rollbackPreview({ operationId: committed.operationId }).status).toBe("ready");
    store.rollback({ operationId: committed.operationId, rollbackOperationId: "historical-rollback", expectedAfterSnapshotDigest: committed.afterSnapshotDigest });
    expect(database.prepare("select account from executions where id='fill-entry'").get()).toEqual({ account: oldAccount });
  });

  it("reports the specific unproven source link for a historical operation", () => {
    const database = openFixture();
    const store = previewStore(database);
    const committed = store.commit(commitRequest(store.preview()));
    markHistorical(database, committed.operationId);
    material(database, "unproven", ["fill-entry"]);
    expect(store.rollbackPreview({ operationId: committed.operationId })).toMatchObject({ status: "blocked", blockers: expect.arrayContaining([expect.objectContaining({ table: "source_execution_links", primaryKey: expect.any(String) })]) });
  });
});


function legacyBackfill(database: DatabaseSync, rawAccountCorrectionOperation?: string, corrupt?: "locator" | "scope" | "content") {
  const batch = database.prepare("select * from import_batches where id='legacy-batch'").get()!;
  database.prepare("insert into source_materials(id,created_at) values ('legacy:material:legacy-batch',?)").run(batch.imported_at);
  const scope = Object.fromEntries(["accounts", "markets", "instruments", "periods"].map(key => [key, { values: [], unknown: true }]));
  if (corrupt === "scope") scope.accounts = { values: [], unknown: false };
  database.prepare(`insert into source_material_versions(id,material_id,parser_version,source_kind,locator_json,file_fingerprint,scope_json,diagnostics_json,content_json,legacy_batch_id,legacy_batch_json,raw_reconciliation_json,raw_evidence_json,recorded_at)
    values ('legacy:version:legacy-batch','legacy:material:legacy-batch','legacy-unrecorded','tradingview','{"legacyBatchId":"legacy-batch"}','fixture',?,'[]',?,'legacy-batch',?,?,?,?)`)
    .run(JSON.stringify(scope), JSON.stringify(corrupt === "content" ? { invented: true } : {}), JSON.stringify(batch), batch.reconciliation_json, batch.evidence_json, batch.imported_at);
  for (const execution of database.prepare("select * from executions").all()) {
    const raw = JSON.parse(String(execution.evidence_json));
    if (rawAccountCorrectionOperation) raw.accountCorrection.operationId = rawAccountCorrectionOperation;
    const observationId = `legacy:observation:12:legacy-batch:${execution.id}`;
    const locator = { fileFingerprint: raw.source.fileFingerprint, page: null, sheet: null, row: corrupt === "locator" ? 999 : raw.source.row };
    database.prepare("insert into source_observations values (?,'legacy:version:legacy-batch',?,'located',?,?,?)")
      .run(observationId, JSON.stringify(["fixture", null, null, raw.source.row]), JSON.stringify(locator), JSON.stringify(raw), oldAccount);
    database.prepare("insert into source_execution_links values (?,?,'legacy-batch-reference',?)").run(observationId, execution.id, execution.created_at);
  }
  database.exec("update source_materials set current_version_id='legacy:version:legacy-batch'");
}

function historicalBatchFixture() {
  const database = openFixture();
  database.exec("insert into import_batches(id,source_fingerprint,source_name,source_type,imported_at,record_count,trade_nature,simulation_run_id) values ('legacy-batch','fixture','fixture.csv','tradingview','2026-01-03T00:00:00Z',2,'simulation','fixture-run')");
  database.exec("update executions set import_batch_id='legacy-batch'");
  const store = previewStore(database);
  const committed = store.commit(commitRequest(store.preview()));
  markHistorical(database, committed.operationId);
  return { database, store, committed };
}

describe("TradingView historical proof and transaction failures", () => {
  it.each([false, true])("verifies the exact ordinary revision audited before schema17 (later edit: %s)", (laterEdit) => {
    const fixture = JSON.parse(readFileSync(join(process.cwd(), "app/lib/storage/fixtures/tradingview-schema16-operation.json"), "utf8")) as {
      schemaVersion: number; provenance: {columns: Record<string,string[]>;writerSha256:string};
      before: Record<string,string|null>; committed: TradingViewMigrationCommitResult;
      rows: Record<string,Record<string,string|number|null>[]>;
    };
    const database = new DatabaseSync(":memory:");
    databases.push(database);
    database.exec("pragma foreign_keys=on");
    database.exec("create table schema_migrations(version integer primary key,name text not null,checksum text not null,applied_at text not null default current_timestamp)");
    for (const migration of SQLITE_MIGRATIONS.filter((item) => item.version <= fixture.schemaVersion)) {
      database.exec(migration.sql);
      database.prepare("insert into schema_migrations(version,name,checksum) values (?,?,?)").run(migration.version, migration.name, migration.checksum);
    }
    expect(fixture.provenance.columns.trade_revisions).toEqual(["id","instrument_id","account_id","request_json","revision_json","recorded_at"]);
    expect(fixture.provenance.writerSha256).toMatch(/^[a-f0-9]{64}$/);
    for (const [table, rows] of Object.entries(fixture.rows)) {
      expect(database.prepare(`pragma table_info(${table})`).all().map(row=>row.name)).toEqual(fixture.provenance.columns[table]);
      for (const row of rows) {
        const columns = Object.keys(row);
        database.prepare(`insert into ${table} (${columns.join(",")}) values (${columns.map(() => "?").join(",")})`).run(...Object.values(row));
      }
    }
    const {committed,before}=fixture;
    // Migration17 must preserve every old byte, including request/result and both ledger JSON strings.
    const oldBytes=JSON.stringify(Object.fromEntries(Object.keys(fixture.rows).map(table=>[table,database.prepare(`select * from ${table} order by rowid`).all()])));
    initializeSqlite(database);
    const upgraded=Object.fromEntries(Object.keys(fixture.rows).map(table=>[table,database.prepare(`select * from ${table} order by rowid`).all().map(row=>table==="trade_revisions"?Object.fromEntries(Object.entries(row).filter(([column])=>column!=="scope_account_unknown")):row)]));
    expect(JSON.stringify(upgraded)).toBe(oldBytes);
    expect(database.prepare("select scope_account_unknown from trade_revisions").get()).toEqual({scope_account_unknown:0});
    const store = previewStore(database);
    if (laterEdit) {
      database.prepare("update trade_revisions set recorded_at='2026-01-05' where id='ordinary-revision'").run();
      expect(store.rollbackPreview({ operationId: committed.operationId })).toMatchObject({ status: "blocked", blockers: expect.arrayContaining([
        expect.objectContaining({ table: "trade_revisions", primaryKey: "ordinary-revision" }),
      ]) });
      return;
    }
    expect(store.rollbackPreview({ operationId: committed.operationId })).toMatchObject({ status: "ready", blockers: [] });
    store.rollback({ operationId: committed.operationId, rollbackOperationId: "ordinary-revision-upgrade-rollback", expectedAfterSnapshotDigest: committed.afterSnapshotDigest });
    expect(database.prepare("select * from trade_revisions").get()).toEqual({ ...before, scope_account_unknown: 0 });
    const inverse = database.prepare("select before_json,after_json from tradingview_account_migration_rows where operation_id='ordinary-revision-upgrade-rollback' and table_name='trade_revisions'").get()!;
    expect(JSON.parse(String(inverse.before_json))).toMatchObject({ scope_account_unknown: 0 });
    expect(JSON.parse(String(inverse.after_json))).toEqual({ ...before, scope_account_unknown: 0 });
  });

  it("preserves a provable historical rollback through the real schema15 to schema17 upgrade", () => {
    const { database: original, committed } = historicalBatchFixture();
    const database = new DatabaseSync(":memory:");
    databases.push(database);
    database.exec("pragma foreign_keys=on");
    database.exec("create table schema_migrations(version integer primary key,name text not null,checksum text not null,applied_at text not null default current_timestamp)");
    for (const migration of SQLITE_MIGRATIONS.filter((item) => item.version <= 15)) {
      database.exec(migration.sql);
      database.prepare("insert into schema_migrations(version,name,checksum) values (?,?,?)").run(migration.version, migration.name, migration.checksum);
    }
    for (const table of ["import_batches", "instruments", "executions", "reviews", "recall_documents", "account_principal_provisionals", "tradingview_account_migration_operations", "tradingview_account_migration_rows", "tradingview_account_migration_dependencies", "tradingview_account_migration_aliases"]) {
      for (const row of original.prepare(`select * from ${table}`).all()) {
        const columns = Object.keys(row);
        database.prepare(`insert into ${table} (${columns.join(",")}) values (${columns.map(() => "?").join(",")})`).run(...Object.values(row));
      }
    }
    initializeSqlite(database);
    expect(database.prepare("select max(version) as version from schema_migrations").get()).toEqual({ version: 17 });
    const before = copySourceMaterialRows(database);
    const store = previewStore(database);
    expect(store.rollbackPreview({ operationId: committed.operationId })).toMatchObject({ status: "ready", blockers: [] });
    const version = readBookVersion(database);
    store.rollback({ operationId: committed.operationId, rollbackOperationId: "actual-upgrade-rollback", expectedAfterSnapshotDigest: committed.afterSnapshotDigest });
    expect(copySourceMaterialRows(database)).toEqual(before);
    expect(database.prepare("select distinct account from executions").all()).toEqual([{ account: oldAccount }]);
    expect(readBookVersion(database)).not.toEqual(version);
  });

  it.each(["locator", "scope", "content"] as const)("requires exact schema16-derived %s instead of trusting legacy-shaped IDs", (corrupt) => {
    const { database, store, committed } = historicalBatchFixture();
    legacyBackfill(database, undefined, corrupt);
    expect(store.rollbackPreview({ operationId: committed.operationId })).toMatchObject({ status: "blocked", blockers: expect.arrayContaining([
      expect.objectContaining({ table: "source_execution_links", primaryKey: expect.stringContaining("fill-entry") }),
    ]) });
  });
  it("proves a historical schema16 backfill from the exact operation ledger, correction, batch and deterministic links", () => {
    const { database, store, committed } = historicalBatchFixture();
    legacyBackfill(database);
    const source = copySourceMaterialRows(database);
    expect(store.rollbackPreview({ operationId: committed.operationId })).toMatchObject({ status: "ready", blockers: [] });
    store.rollback({ operationId: committed.operationId, rollbackOperationId: "legacy-proven-rollback", expectedAfterSnapshotDigest: committed.afterSnapshotDigest });
    expect(copySourceMaterialRows(database)).toEqual(source);
    expect(database.prepare("select distinct account from executions").all()).toEqual([{ account: oldAccount }]);
  });

  it("names an unprovable legacy link when its correction operation does not match", () => {
    const { database, store, committed } = historicalBatchFixture();
    legacyBackfill(database, "different-operation");
    expect(store.rollbackPreview({ operationId: committed.operationId })).toMatchObject({ status: "blocked", blockers: expect.arrayContaining([expect.objectContaining({ table: "source_execution_links", primaryKey: expect.stringContaining("fill-entry") })]) });
  });

  it.each(["commit", "rollback"])("uses the final transaction check after a second connection changes an independent dependency before %s", (phase) => {
    const directory = mkdtempSync(join(tmpdir(), "tradereview-task6-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "isolated.sqlite");
    const database = openFixture(path);
    const other = new DatabaseSync(path);
    databases.push(other);
    const store = previewStore(database);
    const preview = store.preview();
    const committed = phase === "rollback" ? store.commit(commitRequest(preview)) : undefined;
    if (committed) expect(store.rollbackPreview({ operationId: committed.operationId }).status).toBe("ready");
    setting(other, "second-connection", { executionId: "fill-entry" });
    if (committed) {
      expect(() => store.rollback({ operationId: committed.operationId, rollbackOperationId: "second-connection-rollback", expectedAfterSnapshotDigest: committed.afterSnapshotDigest })).toThrowError(expect.objectContaining({ code: "migration-rollback-stale" }));
      expect(database.prepare("select status from tradingview_account_migration_operations where operation_id=?").get(committed.operationId)).toEqual({ status: "committed" });
    } else {
      expect(() => store.commit(commitRequest(preview))).toThrowError(expect.objectContaining({ code: "migration-stale" }));
      expect(database.prepare("select count(*) as count from tradingview_account_migration_operations").get()).toEqual({ count: 0 });
    }
  });

  it("rolls back facts, references, principal, mappings, aliases and version after a late audit failure", () => {
    const database = openFixture();
    material(database, "late-failure");
    const beforeSource = copySourceMaterialRows(database);
    const beforeExecutions = database.prepare("select * from executions order by id").all();
    const beforeVersion = readBookVersion(database);
    database.exec("create trigger fail_late before insert on tradingview_account_migration_dependencies begin select raise(abort,'late-failure'); end");
    const store = previewStore(database);
    expect(() => store.commit(commitRequest(store.preview()))).toThrowError(expect.objectContaining({
      code: "UNEXPECTED_FAILURE", category: "unexpected", cause: expect.objectContaining({ message: "late-failure", code: "ERR_SQLITE_ERROR" }),
    }));
    expect(copySourceMaterialRows(database)).toEqual(beforeSource);
    expect(database.prepare("select * from executions order by id").all()).toEqual(beforeExecutions);
    expect(database.prepare("select episode_id from reviews").all()).toEqual([{ episode_id: oldEpisodeId }]);
    expect(database.prepare("select count(*) as count from account_principal_provisionals").get()).toEqual({ count: 0 });
    expect(database.prepare("select count(*) as count from tradingview_account_migration_aliases").get()).toEqual({ count: 0 });
    expect(database.prepare("select count(*) as count from tradingview_account_migration_operations").get()).toEqual({ count: 0 });
    expect(readBookVersion(database)).toEqual(beforeVersion);
  });

  it("rolls back a failed inverse mapping restoration together with every prior inverse write", () => {
    const database = openFixture();
    material(database, "inverse-failure");
    const store = previewStore(database);
    const committed = store.commit(commitRequest(store.preview()));
    const beforeSource = copySourceMaterialRows(database);
    const beforeExecutions = database.prepare("select * from executions order by id").all();
    const beforeVersion = readBookVersion(database);
    database.exec("create trigger fail_inverse before delete on source_material_account_mappings begin select raise(abort,'inverse-failure'); end");
    expect(() => store.rollback({ operationId: committed.operationId, rollbackOperationId: "failed-inverse", expectedAfterSnapshotDigest: committed.afterSnapshotDigest })).toThrowError(expect.objectContaining({
      code: "UNEXPECTED_FAILURE", category: "unexpected", cause: expect.objectContaining({ message: "inverse-failure", code: "ERR_SQLITE_ERROR" }),
    }));
    expect(copySourceMaterialRows(database)).toEqual(beforeSource);
    expect(database.prepare("select * from executions order by id").all()).toEqual(beforeExecutions);
    expect(database.prepare("select status from tradingview_account_migration_operations where operation_id=?").get(committed.operationId)).toEqual({ status: "committed" });
    expect(readBookVersion(database)).toEqual(beforeVersion);
  });
});

describe("TradingView material-wide mapping boundaries", () => {
  it("rejects a later mapping trigger that corrupts an earlier mapping after its initial readback", () => {
    const database = openDefaultFixture();
    material(database, "a-first");
    material(database, "z-last");
    const before = copySourceMaterialRows(database);
    const version = readBookVersion(database);
    database.exec("create trigger corrupt_prior_mapping after insert on source_material_account_mappings when new.material_id='z-last' begin update source_material_account_mappings set audit_reference='corrupted' where material_id='a-first'; end");
    const store = new TradingViewAccountMigrationStore(database);
    expect(() => store.commit(commitRequest(store.preview()))).toThrowError(expect.objectContaining({ code: "migration-stale" }));
    expect(copySourceMaterialRows(database)).toEqual(before);
    expect(readBookVersion(database)).toEqual(version);
    expect(database.prepare("select count(*) as count from tradingview_account_migration_operations").get()).toEqual({ count: 0 });
  });

  it("rejects a mapping trigger which adds an unplanned mapping in the same material", () => {
    const database = openDefaultFixture();
    material(database, "unplanned-mapping");
    database.exec("create trigger extra_mapping after insert on source_material_account_mappings when new.original_account_id<>'outside' begin insert into source_material_account_mappings values (new.material_id,'outside','other-account','unplanned','unplanned','2026-01-01T00:00:00Z'); end");
    const store = new TradingViewAccountMigrationStore(database);
    expect(() => store.commit(commitRequest(store.preview()))).toThrowError(expect.objectContaining({ code: "migration-stale" }));
    expect(database.prepare("select count(*) as count from source_material_account_mappings").get()).toEqual({ count: 0 });
  });

  it("rejects a shared original-account observation whose formal association cannot be proven", () => {
    const database = openDefaultFixture();
    material(database, "partly-associated");
    database.prepare("insert into source_observations values ('unlinked','partly-associated:v1','unlinked','located','{}','{}',?)").run(oldAccount);
    const store = new TradingViewAccountMigrationStore(database);
    const before = copySourceMaterialRows(database);
    expect(() => store.commit(commitRequest(store.preview()))).toThrowError(expect.objectContaining({ code: "migration-blocked" }));
    expect(copySourceMaterialRows(database)).toEqual(before);
    expect(database.prepare("select account from executions where id='fill-entry'").get()).toEqual({ account: oldAccount });
  });

  it.each(["mapping", "version", "link"] as const)("blocks rollback after a later material %s changes the original mapping scope", (change) => {
    const database = openDefaultFixture();
    material(database, "scope-change");
    const store = new TradingViewAccountMigrationStore(database);
    const committed = store.commit(commitRequest(store.preview()));
    if (change === "mapping") database.exec("update source_material_account_mappings set reason='later correction',audit_reference='later operation' where material_id='scope-change'");
    if (change === "version") {
      database.exec(`insert into source_material_versions(id,material_id,supersedes_version_id,parser_version,source_kind,locator_json,scope_json,diagnostics_json,content_json,recorded_at)
        select 'scope-change:v2',material_id,id,parser_version,source_kind,locator_json,scope_json,diagnostics_json,content_json,'2026-02-01T00:00:00Z'
        from source_material_versions where id='scope-change:v1'`);
      database.exec("update source_materials set current_version_id='scope-change:v2' where id='scope-change'");
    }
    if (change === "link") {
      database.prepare("insert into source_observations values ('later-observation','scope-change:v1','later','located','{}','{}',?)").run(oldAccount);
      database.exec("insert into source_execution_links values ('later-observation','fill-entry','later association','2026-02-01T00:00:00Z')");
    }
    const after = copySourceMaterialRows(database);
    const version = readBookVersion(database);
    expect(store.rollbackPreview({ operationId: committed.operationId }).status).toBe("blocked");
    expect(() => store.rollback({ operationId: committed.operationId, rollbackOperationId: `scope-${change}-rollback`, expectedAfterSnapshotDigest: committed.afterSnapshotDigest }))
      .toThrowError(expect.objectContaining({ code: "migration-rollback-stale" }));
    expect(copySourceMaterialRows(database)).toEqual(after);
    expect(readBookVersion(database)).toEqual(version);
  });
});

describe("TradingView independent-domain concurrency", () => {
  for (const phase of ["commit", "rollback"] as const) {
    it.each(["principal-no-op", "recall-document", "recall-membership"] as const)("rejects %s from a second connection before " + phase, (domain) => {
      const directory = mkdtempSync(join(tmpdir(), "tradereview-task6-domain-"));
      temporaryDirectories.push(directory);
      const path = join(directory, "isolated.sqlite");
      const database = openFixture(path);
      database.exec("delete from reviews; delete from recall_documents");
      const other = new DatabaseSync(path);
      databases.push(other);
      const store = new TradingViewAccountMigrationStore(database);
      const episodeId = store.preview().episodeMap[0].newEpisodeId;
      if (domain === "principal-no-op") principal(database);
      if (domain === "recall-document") database.prepare("insert into recall_documents values (?, ?, ?, 7, '2026-01-01T00:00:00Z')")
        .run(episodeId, JSON.stringify({ episodeId }), JSON.stringify({ episodeId, retained: true }));
      const preview = store.preview();
      expect(preview.status).toBe("ready");
      const committed = phase === "rollback" ? store.commit(commitRequest(preview)) : undefined;
      if (committed) expect(store.rollbackPreview({ operationId: committed.operationId }).status).toBe("ready");
      const version = readBookVersion(database);
      if (domain === "principal-no-op") other.exec("update account_principal_provisionals set revision=revision+1, updated_at='2026-02-01T00:00:00Z'");
      if (domain === "recall-document") other.prepare("update recall_documents set revision=revision+1,finalized_json=?,updated_at='2026-02-01T00:00:00Z' where episode_id=?")
        .run(JSON.stringify({ episodeId, retained: true, later: true }), episodeId);
      if (domain === "recall-membership") other.prepare("insert into recall_plan_associations values (?, 'formal', 8, 'new-plan', 'new-decision', 'linked')").run(episodeId);
      expect(readBookVersion(database)).toEqual(version);
      if (committed) expect(() => store.rollback({ operationId: committed.operationId, rollbackOperationId: `${domain}-rollback`, expectedAfterSnapshotDigest: committed.afterSnapshotDigest }))
        .toThrowError(expect.objectContaining({ code: "migration-rollback-stale" }));
      else expect(() => store.commit(commitRequest(preview))).toThrowError(expect.objectContaining({ code: "migration-stale" }));
      expect(readBookVersion(database)).toEqual(version);
      expect(database.prepare("select account from executions where id='fill-entry'").get()).toEqual({ account: committed ? TRADINGVIEW_CANONICAL_ACCOUNT_ID : oldAccount });
    });
  }

  it("rejects a same-valued principal concurrently created after an absence preview", () => {
    const directory = mkdtempSync(join(tmpdir(), "tradereview-task6-absence-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "isolated.sqlite");
    const database = openFixture(path);
    database.exec("delete from reviews; delete from recall_documents");
    const other = new DatabaseSync(path);
    databases.push(other);
    const store = new TradingViewAccountMigrationStore(database);
    const preview = store.preview();
    expect(preview.provisionalPrincipal.action).toBe("create-if-absent");
    principal(other, "100000", 1);
    const version = readBookVersion(database);
    expect(() => store.commit(commitRequest(preview))).toThrowError(expect.objectContaining({ code: "migration-stale" }));
    expect(database.prepare("select revision from account_principal_provisionals").get()).toEqual({ revision: 1 });
    expect(database.prepare("select count(*) as count from tradingview_account_migration_operations").get()).toEqual({ count: 0 });
    expect(readBookVersion(database)).toEqual(version);
  });
});
