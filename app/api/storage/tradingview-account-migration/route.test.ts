import { afterEach, describe, expect, it, vi } from "vitest";

const { database, store } = vi.hoisted(() => ({
  database: { prepare: vi.fn() },
  store: {
    preview: vi.fn(),
    commit: vi.fn(),
    rollbackPreview: vi.fn(),
    rollback: vi.fn(),
    getCommittedAliases: vi.fn(),
  },
}));

vi.mock("../../../../db/sqlite", () => ({
  openSqliteDatabase: vi.fn(() => database),
}));
vi.mock("../../../lib/storage/tradingview-account-migration-store", () => ({
  TradingViewAccountMigrationStore: vi.fn(function () { return store; }),
}));

import { POST as preview } from "./preview/route";
import { POST as commit } from "./commit/route";
import { POST as rollbackPreview } from "./rollback-preview/route";
import { GET as aliases } from "./aliases/route";
import { GET as provisional } from "./provisional/route";
import { TradingViewMigrationTransactionError } from "../../../lib/storage/tradingview-account-migration-contracts";

const operationId = "11111111-1111-4111-8111-111111111111";

const previewResult = {
  operationId,
  status: "ready",
  canonicalAccountId: "tradingview:simulation:default",
  canonicalAccountLabel: "TradingView · 模拟盘",
  snapshotDigest: "sha256:snapshot",
  baseSnapshotDigest: "sha256:base",
  planDigest: "sha256:plan",
  counts: {
    executions: 0,
    oldAccounts: 0,
    sourceRuns: 0,
    instruments: 0,
    reviews: 0,
    recallRows: 0,
    settingsRows: 0,
    quantity: "0",
    fee: "0",
  },
  executionPlan: [],
  episodeMap: [],
  referencePlan: [],
  browserStatePlan: [],
  provisionalPrincipal: {
    action: "create-if-absent",
    accountId: "tradingview:simulation:default",
    currency: "CNY",
    amount: "100000",
    asOf: null,
    status: "provisional",
    source: "user-default",
  },
  conservation: {
    executionIdsBefore: [],
    executionIdsAfter: [],
    executionIdsPreserved: true,
    sourceRunsBefore: [],
    sourceRunsAfter: [],
    sourceRunsPreserved: true,
    quantityBefore: "0",
    quantityAfter: "0",
    feeBefore: "0",
    feeAfter: "0",
  },
  blockers: [],
  adapterBlockers: [],
};

function request(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("TradingView account migration HTTP API", () => {
  it("accepts only the preview whitelist and returns a no-store read-only plan", async () => {
    store.preview.mockReturnValue(previewResult);

    const response = await preview(request("/api/storage/tradingview-account-migration/preview", {
      operationId,
      sourceAccountIds: [],
      canonicalAccountId: "tradingview:simulation:default",
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(previewResult);
    expect(store.preview).toHaveBeenCalledWith({ operationId });

    const invalid = await preview(request("/api/storage/tradingview-account-migration/preview", {
      operationId,
      sql: "select * from executions",
    }));
    expect(invalid.status).toBe(400);
    expect(store.preview).toHaveBeenCalledTimes(1);
  });

  it("maps transaction conflicts to 409 without exposing storage details", async () => {
    store.commit.mockImplementation(() => {
      throw new TradingViewMigrationTransactionError("migration-stale", "SQLITE_BUSY at /private/database.sqlite");
    });

    const response = await commit(request("/api/storage/tradingview-account-migration/commit", {
      operationId,
      idempotencyKey: "commit-key",
      planDigest: "sha256:plan",
      baseSnapshotDigest: "sha256:base",
      expectedAffectedRows: [],
      provisionalPrincipalAction: "create-if-absent",
    }));

    expect(response.status).toBe(409);
    const text = await response.text();
    expect(text).not.toContain("SQLITE_BUSY");
    expect(text).not.toContain("database.sqlite");
  });

  it("returns 404 for missing rollback operations and keeps the response public", async () => {
    store.rollbackPreview.mockReturnValue({
      operationId,
      status: "blocked",
      expectedAfterSnapshotDigest: "sha256:after",
      affectedRows: 0,
      aliases: [],
      blockers: [{ code: "migration-operation-not-found", message: "The migration operation is not available." }],
    });

    const response = await rollbackPreview(request("/api/storage/tradingview-account-migration/rollback-preview", {
      operationId,
      expectedAfterSnapshotDigest: "sha256:after",
    }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not-found", message: "Migration operation not found" },
    });
  });

  it("lists only active aliases through the store", async () => {
    store.getCommittedAliases.mockReturnValue([
      { operationId, kind: "account", oldId: "old", newId: "tradingview:simulation:default" },
    ]);

    const response = await aliases(new Request(`http://localhost/api/storage/tradingview-account-migration/aliases?operationId=${operationId}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ aliases: [
      { operationId, kind: "account", oldId: "old", newId: "tradingview:simulation:default" },
    ] });
    expect(store.getCommittedAliases).toHaveBeenCalledWith(operationId);
  });

  it("reads one provisional principal without exposing SQL or accepting arbitrary query keys", async () => {
    database.prepare.mockReturnValue({
      get: vi.fn(() => ({
        account_id: "tradingview:simulation:default",
        currency: "CNY",
        amount: "100000",
        as_of: null,
        status: "provisional",
        source: "user-default",
        revision: 0,
        updated_at: "2026-09-29T00:00:00.000Z",
      })),
    });

    const response = await provisional(new Request("http://localhost/api/storage/tradingview-account-migration/provisional"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accountId: "tradingview:simulation:default",
      currency: "CNY",
      amount: "100000",
      asOf: null,
      status: "provisional",
      source: "user-default",
      revision: 0,
      updatedAt: "2026-09-29T00:00:00.000Z",
    });
    expect((await provisional(new Request("http://localhost/api/storage/tradingview-account-migration/provisional?sql=select%20*"))).status).toBe(400);
  });
});
