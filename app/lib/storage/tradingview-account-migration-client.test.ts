import { describe, expect, it, vi } from "vitest";

import { StorageHttpError } from "./sqlite-http-client";
import {
  createTradingViewAccountMigrationClient,
  type TradingViewMigrationCommitRequest,
} from "./tradingview-account-migration-client";

const operationId = "11111111-1111-4111-8111-111111111111";
const commitRequest: TradingViewMigrationCommitRequest = {
  operationId,
  idempotencyKey: "commit-key",
  planDigest: "sha256:plan",
  baseSnapshotDigest: "sha256:base",
  expectedAffectedRows: [],
  provisionalPrincipalAction: "create-if-absent",
};

const commitResult = {
  operationId,
  status: "committed",
  idempotent: false,
  afterSnapshotDigest: "sha256:after",
  affectedRows: 0,
  executionCount: 0,
  quantity: "0",
  fee: "0",
  episodeMap: [],
};

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("TradingView account migration HTTP client", () => {
  it("rejects a successful response that is malformed or carries an error state", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ status: "committed" }))
      .mockResolvedValueOnce(json({ error: { code: "storage-unavailable", message: "outage" } }));
    const client = createTradingViewAccountMigrationClient(fetcher);

    await expect(client.commit(commitRequest)).rejects.toMatchObject({ code: "invalid-response" });
    await expect(client.commit(commitRequest)).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("retains the exact operation request for an idempotent retry", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(commitResult))
      .mockResolvedValueOnce(json({ ...commitResult, idempotent: true }));
    const client = createTradingViewAccountMigrationClient(fetcher);

    await expect(client.commit(commitRequest)).resolves.toEqual(commitResult);
    await expect(client.retryCommit(operationId)).resolves.toMatchObject({ idempotent: true });

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/storage/tradingview-account-migration/commit", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(commitRequest),
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/storage/tradingview-account-migration/commit", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(commitRequest),
    });
  });

  it("rejects malformed nested preview and commit records", async () => {
    const invalidPreview = [
      { ...previewResult, counts: { ...previewResult.counts, executions: -1 } },
      { ...previewResult, provisionalPrincipal: { action: "create-if-absent" } },
      { ...previewResult, episodeMap: [null] },
      { ...previewResult, blockers: [null] },
    ];
    for (const body of invalidPreview) {
      const client = createTradingViewAccountMigrationClient(vi.fn<typeof fetch>().mockResolvedValue(json(body)));
      await expect(client.preview({ operationId })).rejects.toMatchObject({ code: "invalid-response" });
    }

    const client = createTradingViewAccountMigrationClient(
      vi.fn<typeof fetch>().mockResolvedValue(json({ ...commitResult, episodeMap: [null] })),
    );
    await expect(client.commit(commitRequest)).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("binds successful responses to the operation requested by each action", async () => {
    const previewClient = createTradingViewAccountMigrationClient(
      vi.fn<typeof fetch>().mockResolvedValue(json({ ...previewResult, operationId: "other-operation" })),
    );
    await expect(previewClient.preview({ operationId })).rejects.toMatchObject({ code: "invalid-response" });

    const commitClient = createTradingViewAccountMigrationClient(
      vi.fn<typeof fetch>().mockResolvedValue(json({ ...commitResult, operationId: "other-operation" })),
    );
    await expect(commitClient.commit(commitRequest)).rejects.toMatchObject({ code: "invalid-response" });

    const rollbackRequest = {
      operationId,
      rollbackOperationId: "22222222-2222-4222-8222-222222222222",
      expectedAfterSnapshotDigest: "sha256:after",
    } as const;
    const rollbackClient = createTradingViewAccountMigrationClient(
      vi.fn<typeof fetch>().mockResolvedValue(json({
        operationId: "other-operation",
        rollbackOperationId: rollbackRequest.rollbackOperationId,
        status: "rolled-back",
        idempotent: false,
        afterSnapshotDigest: "sha256:after-rollback",
        affectedRows: 0,
      })),
    );
    await expect(rollbackClient.rollback(rollbackRequest)).rejects.toMatchObject({ code: "invalid-response" });

    const rollbackPreviewClient = createTradingViewAccountMigrationClient(
      vi.fn<typeof fetch>().mockResolvedValue(json({
        operationId,
        status: "ready",
        expectedAfterSnapshotDigest: "sha256:after",
        affectedRows: 0,
        aliases: [{ operationId: "other-operation", kind: "account", oldId: "old", newId: "new" }],
        blockers: [],
      })),
    );
    await expect(rollbackPreviewClient.rollbackPreview({ operationId })).rejects.toMatchObject({ code: "invalid-response" });

    const getClient = createTradingViewAccountMigrationClient(
      vi.fn<typeof fetch>()
        .mockResolvedValueOnce(json({ aliases: [{ operationId: "other-operation", kind: "account", oldId: "old", newId: "new" }] }))
        .mockResolvedValueOnce(json({
          accountId: "other-account",
          currency: "CNY",
          amount: "100000",
          asOf: null,
          status: "provisional",
          source: "user-default",
          revision: 0,
          updatedAt: "2026-09-29T00:00:00.000Z",
        })),
    );
    await expect(getClient.getAliases(operationId)).rejects.toMatchObject({ code: "invalid-response" });
    await expect(getClient.getProvisional("requested-account")).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("retains an explicit preview request when the first send fails", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("network lost"))
      .mockResolvedValueOnce(json(previewResult));
    const client = createTradingViewAccountMigrationClient(fetcher);

    await expect(client.preview({ operationId })).rejects.toThrow("network lost");
    await expect(client.retryPreview(operationId)).resolves.toMatchObject({ operationId });
    expect(fetcher.mock.calls[1]?.[1]?.body).toBe(fetcher.mock.calls[0]?.[1]?.body);
  });

  it("exposes structured conflicts and malformed error responses as HTTP errors", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ error: { code: "migration-stale", message: "stale" } }, 409))
      .mockResolvedValueOnce(new Response("not json", { status: 503 }));
    const client = createTradingViewAccountMigrationClient(fetcher);

    await expect(client.commit(commitRequest)).rejects.toEqual(
      new StorageHttpError(409, "migration-stale", "stale"),
    );
    await expect(client.commit(commitRequest)).rejects.toMatchObject({
      status: 503,
      code: "storage-request-failed",
    });
  });

  it("reads active aliases and one account provisional through no-store GETs", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ aliases: [] }))
      .mockResolvedValueOnce(json({
        accountId: "tradingview:simulation:default",
        currency: "CNY",
        amount: "100000",
        asOf: null,
        status: "provisional",
        source: "user-default",
        revision: 0,
        updatedAt: "2026-09-29T00:00:00.000Z",
      }));
    const client = createTradingViewAccountMigrationClient(fetcher);

    await expect(client.getAliases(operationId)).resolves.toEqual({ aliases: [] });
    await expect(client.getProvisional()).resolves.toMatchObject({ amount: "100000" });
    expect(fetcher).toHaveBeenNthCalledWith(1, `/api/storage/tradingview-account-migration/aliases?operationId=${operationId}`, { cache: "no-store" });
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/storage/tradingview-account-migration/provisional", { cache: "no-store" });
  });

  it("accepts only a structured not-found response for absent provisional state", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ error: { code: "not-found", message: "Account provisional not found" } }, 404))
      .mockResolvedValueOnce(json({ error: { code: "route-missing", message: "wrong service" } }, 404));
    const client = createTradingViewAccountMigrationClient(fetcher);

    await expect(client.getProvisional()).resolves.toBeUndefined();
    await expect(client.getProvisional()).rejects.toMatchObject({ code: "invalid-response" });
  });
});
