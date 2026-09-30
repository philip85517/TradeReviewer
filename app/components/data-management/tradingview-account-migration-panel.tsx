"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  createTradingViewAccountMigrationClient,
  type TradingViewAccountMigrationClient,
  type TradingViewMigrationCommitRequest,
  type TradingViewMigrationCommitResult,
  type TradingViewMigrationRollbackPreview,
} from "../../lib/storage/tradingview-account-migration-client";
import { StorageHttpError } from "../../lib/storage/sqlite-http-client";
import type {
  TradingViewMigrationBlocker,
  TradingViewReferenceMigrationPlanRow,
} from "../../lib/storage/tradingview-account-migration-plan";
import type { TradingViewMigrationPreview } from "../../lib/storage/tradingview-account-migration-contracts";
import styles from "./tradingview-account-migration-panel.module.css";

type MigrationClient = Pick<
  TradingViewAccountMigrationClient,
  | "preview"
  | "retryPreview"
  | "commit"
  | "retryCommit"
  | "rollbackPreview"
  | "retryRollbackPreview"
  | "getActiveAliases"
>;

export type TradingViewAccountMigrationPanelProps = {
  /** Dependency injection keeps the UI at the accepted migration client seam. */
  client?: MigrationClient;
  /** Tests may provide a stable UUID; production uses crypto.randomUUID. */
  createOperationId?: () => string;
  /** Workspace reloads SQLite data and browser aliases after a committed migration. */
  onCommitted?: () => Promise<void>;
};

type PreviewState = "idle" | "loading" | "ready" | "error";
type CommitState = "idle" | "guard" | "loading" | "error" | "stale" | "committed" | "refreshing" | "refresh-error" | "refreshed";
type RollbackState = "idle" | "loading" | "ready" | "error";

function operationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tradingview-preview-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof StorageHttpError && error.code === "invalid-response") {
    return "预览响应无效，请稍后重试。";
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "无法读取迁移预览，请稍后重试。";
}

function commitErrorMessage(error: unknown): { message: string; stale: boolean } {
  if (error instanceof StorageHttpError && error.status === 409) {
    if (error.code === "migration-stale") return { message: "预览已过期，请重新读取预览后再提交。", stale: true };
    if (error.code === "migration-idempotency-conflict") return { message: "提交请求与已有操作不一致，请重新读取预览。", stale: true };
    return { message: "当前数据已变化，请重新读取预览后再提交。", stale: true };
  }
  return { message: errorMessage(error), stale: false };
}

function commitRequestFor(preview: TradingViewMigrationPreview): TradingViewMigrationCommitRequest {
  return {
    operationId: preview.operationId,
    idempotencyKey: `${preview.operationId}:commit`,
    planDigest: preview.planDigest,
    baseSnapshotDigest: preview.baseSnapshotDigest,
    provisionalPrincipalAction: preview.provisionalPrincipal.action === "no-op" ? "no-op" : "create-if-absent",
  };
}

function sourceAccounts(preview: TradingViewMigrationPreview) {
  const accounts = new Map<string, { label: string; runs: Set<string>; instruments: Set<string>; executions: number }>();
  for (const row of preview.executionPlan) {
    const current = accounts.get(row.beforeAccountId) ?? {
      label: row.beforeAccountLabel,
      runs: new Set<string>(),
      instruments: new Set<string>(),
      executions: 0,
    };
    current.runs.add(row.sourceRunId);
    current.instruments.add(row.instrumentId);
    current.executions += 1;
    accounts.set(row.beforeAccountId, current);
  }
  return [...accounts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function referenceRows(preview: TradingViewMigrationPreview): TradingViewReferenceMigrationPlanRow[] {
  return [...preview.referencePlan, ...preview.browserStatePlan];
}

function referenceIdentity(fields: Readonly<Record<string, unknown>>): string {
  const account = fields.accountId ?? fields.account_id;
  const episode = fields.episodeId ?? fields.episode_id;
  const scope = fields.scopeId ?? fields.scope_id;
  const parts = [
    typeof account === "string" ? `账户：${account}` : null,
    typeof episode === "string" ? `回合：${episode}` : null,
    typeof scope === "string" ? `范围：${scope}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : "未发现账户/回合范围字段";
}

function blockerLabel(blocker: TradingViewMigrationBlocker | { code: string; message: string }): string {
  return `${blocker.code}：${blocker.message}`;
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.summaryValue}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function AccountMapping({ preview }: { preview: TradingViewMigrationPreview }) {
  const accounts = sourceAccounts(preview);
  return (
    <details className={styles.mappingDetails}>
      <summary>来源账户 → 目标账户</summary>
      <div className={styles.mappingBody}>
        <div className={styles.targetAccount}>
          <span>目标账户</span>
          <strong>{preview.canonicalAccountLabel}</strong>
          <code>{preview.canonicalAccountId}</code>
        </div>
        <ul className={styles.mappingList}>
          {accounts.length === 0 ? (
            <li>预览没有可展示的来源账户。</li>
          ) : accounts.map(([accountId, account]) => (
            <li key={accountId}>
              <strong>{account.label}</strong>
              <code>{accountId}</code>
              <span>{account.executions} 条成交 · {account.runs.size} 个来源报告/批次 · {account.instruments.size} 个标的</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function EpisodeMapping({ preview }: { preview: TradingViewMigrationPreview }) {
  return (
    <details className={styles.mappingDetails}>
      <summary>旧回合 → 新回合</summary>
      <div className={styles.mappingBody}>
        {preview.episodeMap.length === 0 ? (
          <p className={styles.empty}>预览没有回合映射。</p>
        ) : (
          <ul className={styles.mappingList}>
            {preview.episodeMap.map((row) => (
              <li key={`${row.oldEpisodeId}:${row.newEpisodeId}`}>
                <div className={styles.mappingPair}>
                  <code>{row.oldEpisodeId}</code>
                  <span aria-hidden="true">→</span>
                  <code>{row.newEpisodeId}</code>
                </div>
                <span>{row.instrumentId} · {row.direction === "long" ? "多头" : "空头"} · {row.executionIds.length} 条成交</span>
                {row.sourceRunId && <small>来源报告/批次：{row.sourceRunId}</small>}
                <small>映射摘要：{row.beforeDigest} → {row.afterDigest}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function ReferenceMapping({ preview }: { preview: TradingViewMigrationPreview }) {
  const rows = referenceRows(preview);
  return (
    <details className={styles.mappingDetails}>
      <summary>复盘与来源引用</summary>
      <div className={styles.mappingBody}>
        {rows.length === 0 ? (
          <p className={styles.empty}>没有发现需要重写的复盘或浏览器引用。</p>
        ) : (
          <ul className={styles.mappingList}>
            {rows.map((row, index) => (
              <li key={`${row.table}:${row.primaryKey}:${index}`}>
                <div className={styles.mappingPair}>
                  <strong>{row.table}</strong>
                  <code>{row.primaryKey}</code>
                  <span className={row.status === "blocked" ? styles.blockedText : styles.mappedText}>
                    {row.status === "mapped" ? "映射" : row.status === "preserved" ? "保留" : "阻塞"}
                  </span>
                </div>
                <span>迁移前：{referenceIdentity(row.before)}</span>
                <span>迁移后：{referenceIdentity(row.after)}</span>
                <small>来源摘要保留；摘要：{row.beforeDigest} → {row.afterDigest}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function PreviewResult({ preview }: { preview: TradingViewMigrationPreview }) {
  const blockers = [...preview.blockers, ...preview.adapterBlockers];
  const invalidDecimalBlockers = blockers.filter((blocker) => blocker.code === "invalid-decimal");
  const financialTotalsUnavailable = invalidDecimalBlockers.length > 0;
  const invalidDecimalReason = invalidDecimalBlockers.map((blocker) => blocker.message).join("；");
  const { counts, conservation, provisionalPrincipal } = preview;
  return (
    <div className={styles.result}>
      <div className={styles.resultNotice} role="status" aria-live="polite">
        <strong>{preview.status === "blocked" ? "存在阻塞项，当前只能查看预览" : "已生成只读迁移预览"}</strong>
        <span>只读预览不会修改账户或交易数据</span>
      </div>

      {blockers.length > 0 && (
        <div className={styles.blockers} role="alert" aria-label="迁移预览阻塞项">
          <strong>需要先处理以下问题</strong>
          <ul>
            {blockers.map((blocker, index) => <li key={`${blocker.code}:${index}`}>{blockerLabel(blocker)}</li>)}
          </ul>
        </div>
      )}

      <dl className={styles.summaryGrid} aria-label="迁移预览摘要">
        <SummaryValue label="成交" value={`${counts.executions} 条成交`} />
        <SummaryValue label="来源账户" value={`${counts.oldAccounts} 个来源账户`} />
        <SummaryValue label="来源报告/批次" value={`${counts.sourceRuns} 个来源报告/批次`} />
        <SummaryValue label="标的" value={`${counts.instruments} 个标的`} />
        <SummaryValue label="回合映射" value={`${preview.episodeMap.length} 个回合映射`} />
        <SummaryValue label="复盘引用" value={`${counts.reviews} 条复盘引用`} />
        <SummaryValue label="数量" value={financialTotalsUnavailable ? "不可核对" : `${counts.quantity}（守恒）`} />
        <SummaryValue label="费用" value={financialTotalsUnavailable ? "不可核对" : `${counts.fee}（守恒）`} />
      </dl>

      <section className={styles.accountSummary} aria-label="账户迁移方向">
        <div>
          <span>来源账户</span>
          <strong>{counts.oldAccounts} 个 TradingView 来源账户</strong>
        </div>
        <span className={styles.arrow} aria-hidden="true">→</span>
        <div>
          <span>目标账户</span>
          <strong>{preview.canonicalAccountLabel}</strong>
          <code>{preview.canonicalAccountId}</code>
        </div>
      </section>

      <section className={styles.conservation} aria-label="守恒核对">
        <h3>守恒核对</h3>
        {financialTotalsUnavailable ? (
          <>
            <p className={styles.unavailable}>数量暂不可核对：检测到无效数字，未将占位 0 视为守恒。</p>
            <p className={styles.unavailable}>费用暂不可核对：检测到无效数字，未将占位 0 视为守恒。</p>
            <p className={styles.unavailableReason}>原因：{invalidDecimalReason}</p>
          </>
        ) : (
          <>
            <p>数量守恒：{conservation.quantityBefore} → {conservation.quantityAfter}</p>
            <p>费用守恒：{conservation.feeBefore} → {conservation.feeAfter}</p>
          </>
        )}
        <p>{conservation.executionIdsPreserved ? "成交 ID 已保留" : "成交 ID 守恒未通过"} · {conservation.sourceRunsPreserved ? "来源报告/批次已保留" : "来源报告/批次守恒未通过"}</p>
      </section>

      <section className={styles.principal} aria-label="暂定本金与现金基准">
        <div>
          <span>暂定本金</span>
          <strong>{provisionalPrincipal.currency} {provisionalPrincipal.amount}</strong>
          <small>{provisionalPrincipal.status === "provisional" ? "暂定，来源：用户默认" : "已确认"}</small>
        </div>
        <div>
          <span>日期</span>
          <strong>{provisionalPrincipal.asOf ?? "日期未提供"}</strong>
        </div>
        <div className={styles.cashMissing}>
          <span>现金基准</span>
          <strong>现金基准缺失，尚未完成对账</strong>
          <small>不会从暂定本金推算现金余额或账户净值。</small>
        </div>
      </section>

      <div className={styles.mappingStack}>
        <AccountMapping preview={preview} />
        <EpisodeMapping preview={preview} />
        <ReferenceMapping preview={preview} />
      </div>

    </div>
  );
}

function CommitGuard({
  preview,
  request,
  busy,
  onConfirm,
  onCancel,
}: {
  preview: TradingViewMigrationPreview;
  request: TradingViewMigrationCommitRequest;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <section className={styles.commitGuard} aria-label="提交守卫">
      <h3>确认本次账户与成交归并</h3>
      <p>本次预览将 {preview.counts.oldAccounts} 个来源账户的 {preview.counts.executions} 条成交归并到 {preview.canonicalAccountLabel}；{preview.counts.reviews} 条复盘引用与来源信息会保留。网络重试会复用同一提交请求。</p>
      <details className={styles.digestDetails}>
        <summary>查看提交请求摘要</summary>
        <dl className={styles.digestList}>
          <div><dt>操作 ID</dt><dd><code>{request.operationId}</code></dd></div>
          <div><dt>幂等键</dt><dd><code>{request.idempotencyKey}</code></dd></div>
          <div><dt>计划摘要</dt><dd><code>{request.planDigest}</code></dd></div>
          <div><dt>前态摘要</dt><dd><code>{request.baseSnapshotDigest}</code></dd></div>
          <div><dt>暂定本金动作</dt><dd>{preview.provisionalPrincipal.action === "no-op" ? "保持已有记录" : "不存在时创建一份"}</dd></div>
        </dl>
      </details>
      <div className={styles.guardActions}>
        <button type="button" className={styles.commitButton} onClick={onConfirm} disabled={busy}>
          {busy ? "正在提交归并…" : "确认提交归并"}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={busy}>返回预览</button>
      </div>
    </section>
  );
}

function CommitReceipt({
  result,
  state,
  error,
  onRefresh,
  onRollbackPreview,
  onNewPreview,
}: {
  result: TradingViewMigrationCommitResult;
  state: CommitState;
  error: string | null;
  onRefresh: () => void;
  onRollbackPreview: () => void;
  onNewPreview: () => void;
}) {
  const refreshFailed = state === "refresh-error";
  const refreshPending = state === "refreshing";
  return (
    <section className={styles.commitReceipt} aria-label="迁移提交回执">
      <div className={refreshFailed ? styles.refreshFailure : styles.receiptNotice} role={refreshFailed ? "alert" : "status"} aria-live="polite">
        <strong>{refreshFailed ? "归并已提交，页面数据尚未刷新" : state === "refreshed" ? "归并已提交，页面数据已重新读取" : "归并已提交"}</strong>
        {refreshFailed && error && <span>{error}</span>}
        {state === "committed" && <span>请让工作区重读 canonical account 与活动 aliases。</span>}
        {state === "refreshing" && <span>正在重读页面数据…</span>}
      </div>
      <dl className={styles.receiptGrid}>
        <div><dt>提交影响</dt><dd>提交影响 {result.affectedRows} 行</dd></div>
        <div><dt>成交</dt><dd>提交成交：{result.executionCount} 条</dd></div>
        <div><dt>数量</dt><dd>提交数量：{result.quantity}</dd></div>
        <div><dt>费用</dt><dd>提交费用：{result.fee}</dd></div>
        <div><dt>复盘映射</dt><dd>{result.episodeMap.length} 个回合映射</dd></div>
        <div><dt>幂等</dt><dd>{result.idempotent ? "本次请求为幂等重试" : "首次提交"}</dd></div>
      </dl>
      <p className={styles.operationId}>已提交操作 ID：<code>{result.operationId}</code></p>
      <div className={styles.receiptActions}>
        {refreshFailed && <button type="button" className={styles.secondaryButton} onClick={onRefresh}>重读页面数据</button>}
        <button type="button" className={styles.secondaryButton} onClick={onRollbackPreview}>预检只读回退</button>
        <button type="button" className={styles.secondaryButton} onClick={onNewPreview} disabled={refreshPending || refreshFailed}>开始新的预览</button>
      </div>
    </section>
  );
}

function RollbackPreviewResult({
  preview,
  error,
  onRetry,
}: {
  preview: TradingViewMigrationRollbackPreview | null;
  error: string | null;
  onRetry: (() => void) | null;
}) {
  if (!preview) {
    return error ? (
      <div className={styles.error} role="alert">
        <span>{error}</span>
        {onRetry && <button type="button" className={styles.secondaryButton} onClick={onRetry}>重试回退预检</button>}
      </div>
    ) : null;
  }
  const blocked = preview.status === "blocked" || preview.blockers.length > 0;
  return (
    <section className={styles.rollbackPreview} aria-label="只读回退预检">
      <div className={blocked ? styles.refreshFailure : styles.receiptNotice} role={blocked ? "alert" : "status"} aria-live="polite">
        <strong>{blocked ? "只读回退预检被阻塞" : "只读回退预检可用"}</strong>
        <span>这里只读核对后态和活动 aliases，不会执行回退。</span>
      </div>
      <p>预期后态摘要：<code>{preview.expectedAfterSnapshotDigest}</code></p>
      <p>可回退影响：{preview.affectedRows} 行 · {preview.aliases.length} 条活动 aliases</p>
      {preview.blockers.length > 0 && (
        <ul className={styles.blockerList}>
          {preview.blockers.map((blocker, index) => <li key={`${blocker.code}:${index}`}>{blocker.code}：{blocker.message}</li>)}
        </ul>
      )}
    </section>
  );
}

export function TradingViewAccountMigrationPanel({
  client,
  createOperationId = operationId,
  onCommitted,
}: TradingViewAccountMigrationPanelProps) {
  const clientRef = useRef<MigrationClient | null>(null);
  if (clientRef.current === null) {
    clientRef.current = client ?? createTradingViewAccountMigrationClient();
  }
  const migrationClient = clientRef.current;
  const [state, setState] = useState<PreviewState>("idle");
  const [preview, setPreview] = useState<TradingViewMigrationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [commitState, setCommitState] = useState<CommitState>("idle");
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<TradingViewMigrationCommitResult | null>(null);
  const [rollbackState, setRollbackState] = useState<RollbackState>("idle");
  const [rollbackPreview, setRollbackPreview] = useState<TradingViewMigrationRollbackPreview | null>(null);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [recoveredOperations, setRecoveredOperations] = useState<string[]>([]);
  const operationRef = useRef<string | null>(null);
  const rollbackOperationRef = useRef<string | null>(null);
  const commitRequestRef = useRef<TradingViewMigrationCommitRequest | null>(null);
  const commitFlightRef = useRef(false);
  const requestVersionRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    const aliasesRead = migrationClient?.getActiveAliases();
    void Promise.resolve(aliasesRead).then((result) => {
      if (!active || !mountedRef.current || !result || !Array.isArray(result.aliases)) return;
      const operationIds = [...new Set(result.aliases.map((alias) => alias.operationId).filter(Boolean))];
      if (operationIds.length > 0) setRecoveredOperations(operationIds);
    }).catch(() => {
      // Alias recovery is an optional resume affordance.  The current preview
      // path remains usable if the read is unavailable.
    });
    return () => {
      active = false;
      mountedRef.current = false;
      requestVersionRef.current += 1;
    };
  }, [migrationClient]);

  const actionLabel = useMemo(() => {
    if (state === "loading") return "正在读取预览…";
    if (state === "error") return "重试预览";
    if (state === "ready") return "重新读取预览";
    return "读取只读预览";
  }, [state]);

  function isCurrent(version: number, currentOperation: string): boolean {
    return mountedRef.current && requestVersionRef.current === version && operationRef.current === currentOperation;
  }

  function resetCommitAndRollback() {
    commitRequestRef.current = null;
    rollbackOperationRef.current = null;
    setCommitState("idle");
    setCommitError(null);
    setCommitResult(null);
    setRollbackState("idle");
    setRollbackPreview(null);
    setRollbackError(null);
  }

  async function readPreview() {
    if (state === "loading") return;
    const isRetry = state === "error" && operationRef.current !== null;
    const currentOperation = isRetry ? operationRef.current as string : createOperationId();
    const version = ++requestVersionRef.current;
    operationRef.current = currentOperation;
    setOperation(currentOperation);
    setState("loading");
    setError(null);
    setPreview(null);
    resetCommitAndRollback();
    try {
      const result = isRetry
        ? await migrationClient.retryPreview(currentOperation)
        : await migrationClient.preview({ operationId: currentOperation });
      if (!isCurrent(version, currentOperation)) return;
      setPreview(result);
      operationRef.current = result.operationId;
      setOperation(result.operationId);
      setState("ready");
    } catch (reason) {
      if (!isCurrent(version, currentOperation)) return;
      setState("error");
      setError(errorMessage(reason));
    }
  }

  function previewHasBlockers(value: TradingViewMigrationPreview): boolean {
    return value.status === "blocked" || value.blockers.length > 0 || value.adapterBlockers.length > 0;
  }

  function openCommitGuard() {
    if (!preview || previewHasBlockers(preview) || commitResult) return;
    commitRequestRef.current = commitRequestFor(preview);
    setCommitError(null);
    setCommitState("guard");
  }

  async function submitCommit(retry = false) {
    if (commitFlightRef.current || !preview || previewHasBlockers(preview) || commitState === "loading" || commitResult) return;
    const currentOperation = preview.operationId;
    const version = requestVersionRef.current;
    const request = commitRequestRef.current ?? commitRequestFor(preview);
    commitRequestRef.current = request;
    commitFlightRef.current = true;
    setCommitState("loading");
    setCommitError(null);
    try {
      const result = retry
        ? await migrationClient.retryCommit(currentOperation)
        : await migrationClient.commit(request);
      if (!isCurrent(version, currentOperation)) return;
      setCommitResult(result);
      setRollbackPreview(null);
      setRollbackError(null);
      setRollbackState("idle");
      if (!onCommitted) {
        setCommitState("committed");
        return;
      }
      setCommitState("refreshing");
      try {
        await onCommitted();
        if (!isCurrent(version, currentOperation)) return;
        setCommitState("refreshed");
      } catch (refreshReason) {
        if (!isCurrent(version, currentOperation)) return;
        setCommitState("refresh-error");
        setCommitError(errorMessage(refreshReason));
      }
    } catch (reason) {
      if (!isCurrent(version, currentOperation)) return;
      const failure = commitErrorMessage(reason);
      setCommitState(failure.stale ? "stale" : "error");
      setCommitError(failure.message);
    } finally {
      commitFlightRef.current = false;
    }
  }

  async function refreshAfterCommit() {
    if (!onCommitted || !commitResult || commitState === "refreshing") return;
    const currentOperation = commitResult.operationId;
    const version = requestVersionRef.current;
    setCommitState("refreshing");
    setCommitError(null);
    try {
      await onCommitted();
      if (!isCurrent(version, currentOperation)) return;
      setCommitState("refreshed");
    } catch (refreshReason) {
      if (!isCurrent(version, currentOperation)) return;
      setCommitState("refresh-error");
      setCommitError(errorMessage(refreshReason));
    }
  }

  function startNewPreview() {
    if (!commitResult || commitState === "refreshing" || commitState === "refresh-error") return;
    resetCommitAndRollback();
    void readPreview();
  }

  async function readRollbackPreview(currentOperation: string, expectedAfterSnapshotDigest?: string, retry = false) {
    if (rollbackState === "loading") return;
    const version = requestVersionRef.current;
    rollbackOperationRef.current = currentOperation;
    setRollbackState("loading");
    setRollbackPreview(null);
    setRollbackError(null);
    try {
      const result = retry
        ? await migrationClient.retryRollbackPreview(currentOperation)
        : await migrationClient.rollbackPreview({
          operationId: currentOperation,
          ...(expectedAfterSnapshotDigest ? { expectedAfterSnapshotDigest } : {}),
        });
      if (!mountedRef.current || requestVersionRef.current !== version) return;
      setRollbackPreview(result);
      setRollbackState("ready");
    } catch (reason) {
      if (!mountedRef.current || requestVersionRef.current !== version) return;
      setRollbackState("error");
      setRollbackError(errorMessage(reason));
    }
  }

  return (
    <section className={styles.panel} aria-label="TradingView 迁移预览与提交" aria-busy={state === "loading" || commitState === "loading" || commitState === "refreshing" || rollbackState === "loading"}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>TradingView · simulation</span>
          <h3>{preview ? `${preview.counts.oldAccounts} 个来源账户归并到 ${preview.canonicalAccountLabel}` : "单一模拟账户迁移"}</h3>
          <p>{preview
            ? `本次预览涵盖 ${preview.counts.oldAccounts} 个来源账户、${preview.counts.executions} 条成交和 ${preview.counts.reviews} 条复盘引用；成交、来源报告/批次与复盘引用会保留。确认提交后才写入账户与交易数据。`
            : "先读取只读预览，核对来源账户、成交和复盘影响；确认提交后才写入归并，回退入口仅提供只读预检。"}</p>
        </div>
        {operation && <span className={styles.operationBadge}>操作已编号</span>}
      </header>

          <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.previewButton}
          onClick={() => void readPreview()}
          disabled={state === "loading" || commitState === "loading" || commitState === "refreshing" || Boolean(commitResult)}
        >
          {actionLabel}
        </button>
        <span className={styles.actionHint}>
          {commitResult
            ? commitState === "refreshing"
              ? "提交已完成，正在重读页面数据；提交回执会保留。"
              : commitState === "refresh-error"
                ? "提交已完成，但页面重读失败；请先重读页面数据成功，再开始新的预览。"
              : "提交已完成；如需新的请求，请使用回执中的“开始新的预览”。"
            : "当前预览阶段不会写入；确认提交归并会写入账户与交易数据。"}
        </span>
      </div>

      {recoveredOperations.length > 0 && (
        <section className={styles.recovery} aria-label="已提交操作恢复">
          <strong>发现已提交的迁移操作</strong>
          {recoveredOperations.map((recoveredOperation) => (
            <div className={styles.recoveryRow} key={recoveredOperation}>
              <code>{recoveredOperation}</code>
              <button type="button" className={styles.secondaryButton} onClick={() => void readRollbackPreview(recoveredOperation)} disabled={rollbackState === "loading"}>
                恢复只读回退预检
              </button>
            </div>
          ))}
        </section>
      )}

      {state === "loading" && <p className={styles.loading} role="status" aria-live="polite">正在读取迁移预览…</p>}
      {state === "error" && (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          {operation && <small>操作 ID：{operation}；重试会复用相同操作。</small>}
        </div>
      )}
      {state === "ready" && preview && (
        <>
          <PreviewResult preview={preview} />
          {!previewHasBlockers(preview) && !commitResult && commitState === "idle" && (
            <div className={styles.commitActions}>
              <button type="button" className={styles.commitButton} onClick={openCommitGuard}>查看提交守卫</button>
              <span>阻塞项和 adapter blockers 清空后才可提交。</span>
            </div>
          )}
          {!previewHasBlockers(preview) && (commitState === "guard" || commitState === "loading") && commitRequestRef.current && (
            <CommitGuard
              preview={preview}
              request={commitRequestRef.current}
              busy={commitState === "loading"}
              onConfirm={() => void submitCommit()}
              onCancel={() => setCommitState("idle")}
            />
          )}
          {commitState === "loading" && <p className={styles.loading} role="status" aria-live="polite">正在提交归并…</p>}
          {(commitState === "error" || commitState === "stale") && commitError && (
            <div className={styles.error} role="alert">
              <span>{commitError}</span>
              {commitState === "error" && <button type="button" className={styles.secondaryButton} onClick={() => void submitCommit(true)}>重试提交</button>}
              {commitState === "stale" && <small>当前提交请求已失效；请重新读取预览，不能复用旧 commit key。</small>}
            </div>
          )}
          {commitResult && (
            <CommitReceipt
              result={commitResult}
              state={commitState}
              error={commitError}
              onRefresh={() => void refreshAfterCommit()}
              onRollbackPreview={() => void readRollbackPreview(commitResult.operationId, commitResult.afterSnapshotDigest)}
              onNewPreview={startNewPreview}
            />
          )}
        </>
      )}
      {rollbackState !== "idle" && (
        <RollbackPreviewResult
          preview={rollbackPreview}
          error={rollbackError}
          onRetry={rollbackState === "error" && rollbackOperationRef.current
            ? () => void readRollbackPreview(rollbackOperationRef.current as string, undefined, true)
            : null}
        />
      )}
    </section>
  );
}
