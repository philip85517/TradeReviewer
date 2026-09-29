import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StorageHttpError } from "../../lib/storage/sqlite-http-client";
import type {
  TradingViewMigrationCommitResult,
  TradingViewAccountMigrationClient,
  TradingViewMigrationRollbackPreview,
} from "../../lib/storage/tradingview-account-migration-client";
import type { TradingViewMigrationPreview } from "../../lib/storage/tradingview-account-migration-contracts";
import { TradingViewAccountMigrationPanel } from "./tradingview-account-migration-panel";

afterEach(cleanup);

const operationId = "11111111-1111-4111-8111-111111111111";

function previewFixture(overrides: Partial<TradingViewMigrationPreview> = {}): TradingViewMigrationPreview {
  const executionRow = {
    executionId: "execution-1",
    beforeAccountId: "tradingview:source-1:CN-SH:600330",
    afterAccountId: "tradingview:simulation:default" as const,
    beforeAccountLabel: "TradingView · 模拟盘 · 旧来源",
    afterAccountLabel: "TradingView · 模拟盘" as const,
    sourceRunId: "tradingview:run-1",
    originalSourceFingerprint: "source-fingerprint-1",
    originalSourceRow: 12,
    originalSourceTradeId: "source-trade-1",
    executedAt: "2026-01-01T09:30:00.000Z",
    side: "buy" as const,
    instrumentId: "CN-SH:600330",
    quantity: "1000",
    price: "10",
    fee: "0",
    originalQuantity: "1000",
    originalPrice: "10",
    originalFee: "0",
    originalGrossAmount: "10000",
    beforeDigest: "sha256:before-execution-1",
    afterDigest: "sha256:after-execution-1",
    before: {
      accountId: "tradingview:source-1:CN-SH:600330",
      accountLabel: "TradingView · 模拟盘 · 旧来源",
      sourceRunId: "tradingview:run-1",
      sourceFingerprint: "source-fingerprint-1",
      sourceRow: 12,
    },
    after: {
      accountId: "tradingview:simulation:default" as const,
      accountLabel: "TradingView · 模拟盘" as const,
      sourceRunId: "tradingview:run-1",
      sourceFingerprint: "source-fingerprint-1",
      sourceRow: 12,
    },
  };
  return {
    operationId,
    status: "ready",
    canonicalAccountId: "tradingview:simulation:default",
    canonicalAccountLabel: "TradingView · 模拟盘",
    snapshotDigest: "sha256:snapshot",
    baseSnapshotDigest: "sha256:base",
    planDigest: "sha256:plan",
    counts: {
      executions: 82,
      oldAccounts: 4,
      sourceRuns: 4,
      instruments: 4,
      reviews: 4,
      recallRows: 0,
      settingsRows: 0,
      quantity: "516000",
      fee: "9.6",
    },
    executionPlan: [executionRow],
    episodeMap: Array.from({ length: 32 }, (_, index) => ({
      oldEpisodeId: `episode-old-${index + 1}`,
      newEpisodeId: `episode-new-${index + 1}`,
      accountId: "tradingview:simulation:default" as const,
      instrumentId: index % 2 === 0 ? "CN-SH:600330" : "CN-SH:600869",
      direction: index % 2 === 0 ? "long" as const : "short" as const,
      executionIds: [`execution-${index + 1}`],
      sourceRunId: `tradingview:run-${(index % 4) + 1}`,
      beforeDigest: `sha256:before-episode-${index + 1}`,
      afterDigest: `sha256:after-episode-${index + 1}`,
    })),
    referencePlan: [
      {
        table: "reviews",
        primaryKey: "review-1",
        owner: "review-owner",
        status: "mapped",
        before: { episodeId: "episode-old-1", accountId: "tradingview:source-1:CN-SH:600330" },
        after: { episodeId: "episode-new-1", accountId: "tradingview:simulation:default" },
        beforeDigest: "sha256:before-reference-1",
        afterDigest: "sha256:after-reference-1",
      },
    ],
    browserStatePlan: [
      {
        table: "browser-review-state",
        primaryKey: "episode-old-1",
        status: "preserved",
        before: { episodeId: "episode-old-1" },
        after: { episodeId: "episode-new-1" },
        beforeDigest: "sha256:before-browser-1",
        afterDigest: "sha256:after-browser-1",
      },
    ],
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
      executionIdsBefore: ["execution-1", "execution-2"],
      executionIdsAfter: ["execution-1", "execution-2"],
      executionIdsPreserved: true,
      sourceRunsBefore: ["tradingview:run-1", "tradingview:run-2"],
      sourceRunsAfter: ["tradingview:run-1", "tradingview:run-2"],
      sourceRunsPreserved: true,
      quantityBefore: "516000",
      quantityAfter: "516000",
      feeBefore: "9.6",
      feeAfter: "9.6",
    },
    blockers: [],
    adapterBlockers: [],
    ...overrides,
  };
}

function blockedPreview(): TradingViewMigrationPreview {
  return previewFixture({
    status: "blocked",
    blockers: [{
      code: "ambiguous-episode",
      message: "旧回合无法唯一映射到目标回合",
      oldEpisodeId: "episode-old-1",
      newEpisodeId: "episode-new-1",
    }],
  });
}

function invalidDecimalPreview(): TradingViewMigrationPreview {
  const base = previewFixture();
  return {
    ...base,
    status: "blocked",
    counts: { ...base.counts, quantity: "0", fee: "0" },
    conservation: {
      ...base.conservation,
      quantityBefore: "0",
      quantityAfter: "0",
      feeBefore: "0",
      feeAfter: "0",
    },
    blockers: [{
      code: "invalid-decimal",
      message: "Execution quantity, price, or fee is not a finite decimal string.",
      executionId: "execution-1",
    }],
  };
}

const commitResult: TradingViewMigrationCommitResult = {
  operationId,
  status: "committed",
  idempotent: false,
  afterSnapshotDigest: "sha256:after",
  affectedRows: 91,
  executionCount: 82,
  quantity: "516000",
  fee: "9.6",
  episodeMap: previewFixture().episodeMap,
  provisionalPrincipalRevision: 0,
};

const rollbackPreviewResult: TradingViewMigrationRollbackPreview = {
  operationId,
  status: "ready",
  expectedAfterSnapshotDigest: commitResult.afterSnapshotDigest,
  affectedRows: commitResult.affectedRows,
  aliases: [{
    operationId,
    kind: "account",
    oldId: "tradingview:source-1:CN-SH:600330",
    newId: "tradingview:simulation:default",
  }],
  blockers: [],
};

function client(overrides: Partial<TradingViewAccountMigrationClient> = {}): TradingViewAccountMigrationClient {
  return {
    preview: vi.fn(),
    retryPreview: vi.fn(),
    commit: vi.fn(),
    retryCommit: vi.fn(),
    rollbackPreview: vi.fn(),
    retryRollbackPreview: vi.fn(),
    rollback: vi.fn(),
    retryRollback: vi.fn(),
    getAliases: vi.fn(),
    getActiveAliases: vi.fn(),
    getProvisional: vi.fn(),
    getProvisionalPrincipal: vi.fn(),
    ...overrides,
  };
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof TradingViewAccountMigrationPanel>> = {}) {
  const migrationClient = client();
  const result = render(
    <TradingViewAccountMigrationPanel
      client={migrationClient}
      createOperationId={() => operationId}
      {...overrides}
    />,
  );
  return { ...result, migrationClient };
}

describe("TradingViewAccountMigrationPanel", () => {
  it("generates an operation id before the first read-only preview and renders conservation semantics", async () => {
    const user = userEvent.setup();
    let resolvePreview!: (preview: TradingViewMigrationPreview) => void;
    const pending = new Promise<TradingViewMigrationPreview>((resolve) => {
      resolvePreview = resolve;
    });
    const migrationClient = client({ preview: vi.fn().mockReturnValue(pending) });
    renderPanel({ client: migrationClient });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));

    expect(migrationClient.preview).toHaveBeenCalledWith({ operationId });
    expect(screen.getByRole("status")).toHaveTextContent("正在读取迁移预览");

    resolvePreview(previewFixture());
    await waitFor(() => expect(screen.getByText("82 条成交")).toBeVisible());
    expect(screen.getByText("4 个来源账户")).toBeVisible();
    expect(screen.getByText("4 个来源报告/批次")).toBeVisible();
    expect(screen.queryByText("4 个来源回合")).not.toBeInTheDocument();
    expect(screen.getByText("4 个标的")).toBeVisible();
    expect(screen.getByText("32 个回合映射")).toBeVisible();
    expect(screen.getByText("4 条复盘引用")).toBeVisible();
    expect(screen.getByText("数量守恒：516000 → 516000")).toBeVisible();
    expect(screen.getByText("费用守恒：9.6 → 9.6")).toBeVisible();
    expect(screen.getByText("暂定本金")).toBeVisible();
    expect(screen.getByText("CNY 100000")).toBeVisible();
    expect(screen.getByText("日期未提供")).toBeVisible();
    expect(screen.getByText("现金基准缺失，尚未完成对账")).toBeVisible();
    expect(screen.getByText("只读预览不会修改账户或交易数据")).toBeVisible();
    expect(screen.getByRole("heading", { name: "4 个来源账户归并到 TradingView · 模拟盘" })).toBeVisible();
    expect(screen.getByText("本次预览涵盖 4 个来源账户、82 条成交和 4 条复盘引用；成交、来源报告/批次与复盘引用会保留。确认提交后才写入账户与交易数据。")).toBeVisible();
  });

  it("retains the same operation id for a stable retry after a failed preview", async () => {
    const user = userEvent.setup();
    const migrationClient = client({
      preview: vi.fn().mockRejectedValue(new Error("网络暂时不可用")),
      retryPreview: vi.fn().mockResolvedValue(previewFixture()),
    });
    renderPanel({ client: migrationClient });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("网络暂时不可用");
    await user.click(screen.getByRole("button", { name: "重试预览" }));

    expect(migrationClient.retryPreview).toHaveBeenCalledWith(operationId);
    expect(await screen.findByText("82 条成交")).toBeVisible();
  });

  it("gives malformed responses a readable retry state", async () => {
    const user = userEvent.setup();
    const migrationClient = client({
      preview: vi.fn().mockRejectedValue(new StorageHttpError(200, "invalid-response", "Migration response was invalid")),
    });
    renderPanel({ client: migrationClient });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("预览响应无效");
    expect(screen.getByRole("button", { name: "重试预览" })).toBeEnabled();
  });

  it("keeps blocker reasons visible and exposes no mutation controls", async () => {
    const user = userEvent.setup();
    const migrationClient = client({ preview: vi.fn().mockResolvedValue(blockedPreview()) });
    renderPanel({ client: migrationClient });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("旧回合无法唯一映射到目标回合");
    expect(screen.getByText("存在阻塞项，当前只能查看预览")).toBeVisible();
    expect(screen.queryByRole("button", { name: /提交迁移|回退/ })).not.toBeInTheDocument();
    expect(migrationClient.commit).not.toHaveBeenCalled();
    expect(migrationClient.rollback).not.toHaveBeenCalled();
  });

  it("keeps the commit guard hidden while adapter blockers remain", async () => {
    const user = userEvent.setup();
    const migrationClient = client({
      preview: vi.fn().mockResolvedValue(previewFixture({
        adapterBlockers: [{ code: "invalid-json", message: "浏览器状态不是有效 JSON" }],
      })),
    });
    renderPanel({ client: migrationClient });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid-json");
    expect(screen.queryByRole("button", { name: "查看提交守卫" })).not.toBeInTheDocument();
    expect(migrationClient.commit).not.toHaveBeenCalled();
  });

  it("does not present invalid-decimal placeholder totals as conserved zero", async () => {
    const user = userEvent.setup();
    const migrationClient = client({ preview: vi.fn().mockResolvedValue(invalidDecimalPreview()) });
    renderPanel({ client: migrationClient });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid-decimal");
    expect(screen.getAllByText("不可核对")).toHaveLength(2);
    expect(screen.getByText("数量暂不可核对：检测到无效数字，未将占位 0 视为守恒。")).toBeVisible();
    expect(screen.getByText("费用暂不可核对：检测到无效数字，未将占位 0 视为守恒。")).toBeVisible();
    expect(screen.getByText("原因：Execution quantity, price, or fee is not a finite decimal string.")).toBeVisible();
    expect(screen.queryByText("0（守恒）")).not.toBeInTheDocument();
    expect(screen.queryByText("数量守恒：0 → 0")).not.toBeInTheDocument();
    expect(screen.queryByText("费用守恒：0 → 0")).not.toBeInTheDocument();
  });

  it("lets users expand account, episode, and reference mappings", async () => {
    const user = userEvent.setup();
    const migrationClient = client({ preview: vi.fn().mockResolvedValue(previewFixture()) });
    renderPanel({ client: migrationClient });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));
    await screen.findByText("82 条成交");

    const accountDetails = screen.getByText("来源账户 → 目标账户").closest("details");
    const episodeDetails = screen.getByText("旧回合 → 新回合").closest("details");
    const referenceDetails = screen.getByText("复盘与来源引用").closest("details");
    expect(accountDetails).not.toBeNull();
    expect(episodeDetails).not.toBeNull();
    expect(referenceDetails).not.toBeNull();

    await user.click(screen.getByText("来源账户 → 目标账户"));
    await user.click(screen.getByText("旧回合 → 新回合"));
    await user.click(screen.getByText("复盘与来源引用"));

    expect(accountDetails).toHaveAttribute("open");
    expect(episodeDetails).toHaveAttribute("open");
    expect(referenceDetails).toHaveAttribute("open");
    expect(screen.getByText("tradingview:source-1:CN-SH:600330")).toBeVisible();
    expect(within(episodeDetails as HTMLElement).getByText(/^episode-old-1$/)).toBeVisible();
    expect(screen.getByText("review-1")).toBeVisible();
  });

  it("submits one fixed guarded request and retries the same operation after a network failure", async () => {
    const user = userEvent.setup();
    const migrationClient = client({
      preview: vi.fn().mockResolvedValue(previewFixture()),
      commit: vi.fn().mockRejectedValueOnce(new Error("网络暂时不可用")),
      retryCommit: vi.fn().mockResolvedValue(commitResult),
    });
    const onCommitted = vi.fn().mockResolvedValue(undefined);
    renderPanel({ client: migrationClient, onCommitted });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));
    await screen.findByText("82 条成交");
    await user.click(screen.getByRole("button", { name: "查看提交守卫" }));
    expect(screen.getByText("确认本次账户与成交归并")).toBeVisible();
    expect(screen.getByText("本次预览将 4 个来源账户的 82 条成交归并到 TradingView · 模拟盘；4 条复盘引用与来源信息会保留。网络重试会复用同一提交请求。")).toBeVisible();
    expect(screen.queryByText(/operationId、plan digest 和 base snapshot digest/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认提交归并" }));

    expect(migrationClient.commit).toHaveBeenCalledWith({
      operationId,
      idempotencyKey: `${operationId}:commit`,
      planDigest: "sha256:plan",
      baseSnapshotDigest: "sha256:base",
      provisionalPrincipalAction: "create-if-absent",
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("网络暂时不可用");
    await user.click(screen.getByRole("button", { name: "重试提交" }));

    expect(migrationClient.retryCommit).toHaveBeenCalledWith(operationId);
    expect(await screen.findByText(/归并已提交/)).toBeVisible();
    expect(screen.getByText("提交数量：516000")).toBeVisible();
    expect(screen.getByText("提交费用：9.6")).toBeVisible();
    expect(screen.getByText("提交影响 91 行")).toBeVisible();
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });

  it("requires a fresh preview after a stale commit and never retries the stale request", async () => {
    const user = userEvent.setup();
    const nextOperationId = "22222222-2222-4222-8222-222222222222";
    const createId = vi.fn()
      .mockReturnValueOnce(operationId)
      .mockReturnValueOnce(nextOperationId);
    const migrationClient = client({
      preview: vi.fn().mockResolvedValueOnce(previewFixture()).mockResolvedValueOnce(previewFixture({ operationId: nextOperationId })),
      commit: vi.fn().mockRejectedValue(new StorageHttpError(409, "migration-stale", "stale")),
      retryCommit: vi.fn(),
    });
    renderPanel({ client: migrationClient, createOperationId: createId });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));
    await screen.findByText("82 条成交");
    await user.click(screen.getByRole("button", { name: "查看提交守卫" }));
    await user.click(screen.getByRole("button", { name: "确认提交归并" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("预览已过期");
    expect(screen.queryByRole("button", { name: "重试提交" })).not.toBeInTheDocument();
    expect(migrationClient.retryCommit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "重新读取预览" }));
    await waitFor(() => expect(migrationClient.preview).toHaveBeenLastCalledWith({ operationId: nextOperationId }));
    await user.click(await screen.findByRole("button", { name: "查看提交守卫" }));
    expect(screen.getAllByText(nextOperationId)).not.toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "确认提交归并" }));
    await waitFor(() => expect(migrationClient.commit).toHaveBeenCalledTimes(2));
    expect(migrationClient.commit).toHaveBeenLastCalledWith({
      operationId: nextOperationId,
      idempotencyKey: `${nextOperationId}:commit`,
      planDigest: "sha256:plan",
      baseSnapshotDigest: "sha256:base",
      provisionalPrincipalAction: "create-if-absent",
    });
  });

  it("keeps the committed receipt separate when workspace refresh fails and retries only the refresh", async () => {
    const user = userEvent.setup();
    const onCommitted = vi.fn()
      .mockRejectedValueOnce(new Error("页面重读失败"))
      .mockResolvedValueOnce(undefined);
    const migrationClient = client({
      preview: vi.fn().mockResolvedValue(previewFixture()),
      commit: vi.fn().mockResolvedValue(commitResult),
    });
    renderPanel({ client: migrationClient, onCommitted });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));
    await screen.findByText("82 条成交");
    await user.click(screen.getByRole("button", { name: "查看提交守卫" }));
    await user.click(screen.getByRole("button", { name: "确认提交归并" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("归并已提交，页面数据尚未刷新");
    expect(screen.getByText("页面重读失败")).toBeVisible();
    expect(screen.getByRole("button", { name: "重读页面数据" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "重新读取预览" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "开始新的预览" })).toBeDisabled();
    expect(migrationClient.commit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "重读页面数据" }));
    await waitFor(() => expect(screen.getByText(/页面数据已重新读取/)).toBeVisible());
    expect(onCommitted).toHaveBeenCalledTimes(2);
    expect(migrationClient.commit).toHaveBeenCalledTimes(1);
  });

  it("keeps the receipt while refresh is pending and starts a new preview explicitly after recovery", async () => {
    const user = userEvent.setup();
    let resolveRefresh!: () => void;
    const onCommitted = vi.fn(() => new Promise<void>((resolve) => { resolveRefresh = resolve; }));
    const nextOperationId = "22222222-2222-4222-8222-222222222222";
    const migrationClient = client({
      preview: vi.fn()
        .mockResolvedValueOnce(previewFixture())
        .mockResolvedValueOnce(previewFixture({ operationId: nextOperationId })),
      commit: vi.fn().mockResolvedValue(commitResult),
    });
    const createOperationId = vi.fn()
      .mockReturnValueOnce(operationId)
      .mockReturnValueOnce(nextOperationId);
    renderPanel({ client: migrationClient, createOperationId, onCommitted });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));
    await screen.findByText("82 条成交");
    await user.click(screen.getByRole("button", { name: "查看提交守卫" }));
    await user.click(screen.getByRole("button", { name: "确认提交归并" }));

    await screen.findByText("正在重读页面数据…");
    expect(screen.getByRole("region", { name: "迁移提交回执" })).toBeVisible();
    expect(screen.getByRole("button", { name: "重新读取预览" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "开始新的预览" })).toBeDisabled();

    resolveRefresh();
    await screen.findByText(/页面数据已重新读取/);
    await user.click(screen.getByRole("button", { name: "开始新的预览" }));
    await waitFor(() => expect(migrationClient.preview).toHaveBeenLastCalledWith({ operationId: nextOperationId }));
    expect(screen.getByRole("button", { name: "重新读取预览" })).toBeEnabled();
  });

  it("keeps commit single-flight on a double click", async () => {
    const user = userEvent.setup();
    let resolveCommit!: (result: TradingViewMigrationCommitResult) => void;
    const pendingCommit = new Promise<TradingViewMigrationCommitResult>((resolve) => { resolveCommit = resolve; });
    const migrationClient = client({
      preview: vi.fn().mockResolvedValue(previewFixture()),
      commit: vi.fn().mockReturnValue(pendingCommit),
    });
    renderPanel({ client: migrationClient, onCommitted: vi.fn().mockResolvedValue(undefined) });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));
    await screen.findByText("82 条成交");
    await user.click(screen.getByRole("button", { name: "查看提交守卫" }));
    const confirm = screen.getByRole("button", { name: "确认提交归并" });
    await Promise.all([user.click(confirm), user.click(confirm)]);

    expect(migrationClient.commit).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    resolveCommit(commitResult);
    await screen.findByText(/归并已提交/);
  });

  it("only calls rollback preview and never executes rollback", async () => {
    const user = userEvent.setup();
    const migrationClient = client({
      preview: vi.fn().mockResolvedValue(previewFixture()),
      commit: vi.fn().mockResolvedValue(commitResult),
      rollbackPreview: vi.fn().mockResolvedValue(rollbackPreviewResult),
      rollback: vi.fn(),
    });
    renderPanel({ client: migrationClient, onCommitted: vi.fn().mockResolvedValue(undefined) });

    await user.click(screen.getByRole("button", { name: "读取只读预览" }));
    await screen.findByText("82 条成交");
    await user.click(screen.getByRole("button", { name: "查看提交守卫" }));
    await user.click(screen.getByRole("button", { name: "确认提交归并" }));
    await screen.findByText(/归并已提交/);
    await user.click(screen.getByRole("button", { name: "预检只读回退" }));

    expect(migrationClient.rollbackPreview).toHaveBeenCalledWith({
      operationId,
      expectedAfterSnapshotDigest: "sha256:after",
    });
    expect(migrationClient.rollback).not.toHaveBeenCalled();
    expect(await screen.findByText("只读回退预检可用")).toBeVisible();
  });

  it("recovers an active committed operation through aliases after reload", async () => {
    const user = userEvent.setup();
    const migrationClient = client({
      getActiveAliases: vi.fn().mockResolvedValue({ aliases: rollbackPreviewResult.aliases }),
      rollbackPreview: vi.fn().mockResolvedValue(rollbackPreviewResult),
    });
    renderPanel({ client: migrationClient });

    await user.click(await screen.findByRole("button", { name: "恢复只读回退预检" }));
    expect(migrationClient.rollbackPreview).toHaveBeenCalledWith({ operationId });
    expect(migrationClient.commit).not.toHaveBeenCalled();
    expect(migrationClient.rollback).not.toHaveBeenCalled();
    expect(await screen.findByText("只读回退预检可用")).toBeVisible();
  });

});
