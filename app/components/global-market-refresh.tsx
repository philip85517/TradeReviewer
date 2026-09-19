"use client";

import {
  AlertTriangle,
  Check,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";

import {
  summarizeGlobalMarketRefresh,
  type GlobalMarketRefreshFailureDetail,
  type GlobalMarketRefreshUnfinishedDetail,
} from "../lib/market/refresh-summary";
import { formatBeijingDateTime } from "../lib/replay/format-time";
import styles from "./global-market-refresh.module.css";

export type GlobalMarketRefreshState = {
  running: boolean;
  total: number;
  /** Items whose refresh produced a usable result; partial results count. */
  completed: number;
  /** All queue items that have settled, including failures and cancellations. */
  processed?: number;
  partial: number;
  /** Items with no usable result, excluding partially usable instruments. */
  failed: number;
  /** Independent retryable item count; partial instruments may overlap it. */
  retryable?: number;
  /** Number of provider operations currently in flight. */
  active?: number;
  /** Number of items that were in the snapshot but did not start. */
  cancelled?: number;
  current?: string;
  /** New imports found while a snapshot was running. */
  newlyImported?: number;
  /** Per-instrument interval failures reconstructed from the durable jobs. */
  failureDetails?: GlobalMarketRefreshFailureDetail[];
  /** Inventory instruments whose saved job is missing or still unfinished. */
  unfinishedDetails?: GlobalMarketRefreshUnfinishedDetail[];
  unfinishedInstrumentIds?: string[];
  /** Indicates that the display was reconstructed from saved jobs after load. */
  restored?: boolean;
};

export const EMPTY_GLOBAL_MARKET_REFRESH: GlobalMarketRefreshState = {
  running: false,
  total: 0,
  completed: 0,
  processed: 0,
  partial: 0,
  failed: 0,
  active: 0,
  cancelled: 0,
  newlyImported: 0,
  failureDetails: [],
  unfinishedDetails: [],
  unfinishedInstrumentIds: [],
  restored: false,
};

export type GlobalMarketRefreshProps = {
  /** Count from the current inventory, while the state total is the snapshot. */
  instrumentCount: number;
  state?: GlobalMarketRefreshState;
  onRefresh: () => void;
  onCancel?: () => void;
  onRetryFailed?: () => void;
  onRecoverUnfinished?: () => void;
  disabled?: boolean;
};

function progressLabel(
  state: GlobalMarketRefreshState,
  summary: ReturnType<typeof summarizeGlobalMarketRefresh>,
) {
  const processed = summary.processed;
  if (state.running) {
    if (state.current) return `正在更新：${state.current}`;
    return `正在更新 ${processed}/${state.total}`;
  }
  if (state.cancelled && state.cancelled > 0) {
    if (state.restored) {
      return `本次更新已取消；已保存行情状态：已读取 ${processed}/${summary.total} 个标的`;
    }
    return `已取消，成功 ${state.completed}/${state.total}；已处理 ${processed}/${state.total}`;
  }
  if (state.restored) {
    return `已保存行情状态：已读取 ${processed}/${summary.total} 个标的`;
  }
  if (summary.total > 0 && summary.failed > 0) {
    return `已处理 ${processed}/${summary.total}，成功 ${summary.completed}/${summary.total}`;
  }
  if (summary.total > 0) {
    return `最近一次完成 ${summary.completed}/${summary.total}`;
  }
  return "尚未更新行情";
}

function intervalLabel(interval: GlobalMarketRefreshFailureDetail["intervals"][number]["interval"]) {
  if (interval === "overall") return "整体";
  if (interval === "1D") return "日线";
  if (interval === "1h") return "1 小时";
  return "15 分钟";
}

function requestedAtLabel(requestedAt: string) {
  if (!requestedAt || !Number.isFinite(Date.parse(requestedAt))) {
    return "时间未知";
  }
  return formatBeijingDateTime(requestedAt);
}

function coverageLabel(
  interval: GlobalMarketRefreshFailureDetail["intervals"][number],
) {
  if (!interval.coverageStart && !interval.coverageEnd) return undefined;
  return `${interval.coverageStart ?? "未知"} 至 ${interval.coverageEnd ?? "未知"}`;
}

function statusLabel(status: GlobalMarketRefreshFailureDetail["intervals"][number]["status"]) {
  if (status === "source-rate-limited") return "行情源访问受限";
  if (status === "source-forbidden") return "行情源拒绝访问";
  if (status === "source-unavailable") return "行情源暂不可用";
  if (status === "invalid-response") return "行情格式异常";
  if (status === "storage-error") return "本地存储失败";
  if (status === "needs-provider") return "行情源待连接";
  if (status === "error") return "行情更新失败";
  if (status === "syncing") return "更新未完成";
  if (status === "latest-available") return "仅有最新行情";
  if (status === "stale") return "行情已过期";
  return "行情部分可用";
}

function unfinishedStatusLabel(
  status: GlobalMarketRefreshUnfinishedDetail["status"],
) {
  return status === "syncing" ? "上次未结束，可重新尝试" : "尚未开始";
}

function unfinishedAttemptLabel(requestedAt: string) {
  return requestedAt ? `最近尝试：${requestedAtLabel(requestedAt)}` : "最近尝试：无记录";
}

function UnfinishedDetails({
  details,
}: {
  details: GlobalMarketRefreshUnfinishedDetail[];
}) {
  if (details.length === 0) return null;
  return (
    <details className={styles.unfinishedDetails} aria-label="未完成行情明细">
      <summary>查看未完成明细（{details.length} 个标的）</summary>
      <ul className={styles.unfinishedList}>
        {details.map((detail) => (
          <li key={detail.instrumentId} className={styles.unfinishedItem}>
            <span>
              <strong>{detail.symbol}</strong>
              {detail.market ? ` · ${detail.market}` : ""}
            </span>
            <span>{unfinishedStatusLabel(detail.status)}</span>
            <small>{unfinishedAttemptLabel(detail.requestedAt)}</small>
            <small>{detail.instrumentId}</small>
            <small>{detail.reason}</small>
          </li>
        ))}
      </ul>
    </details>
  );
}

function FailureDetails({
  details,
  retryable,
}: {
  details: GlobalMarketRefreshFailureDetail[];
  retryable: number;
}) {
  if (retryable <= 0) return null;
  return (
    <details className={styles.failureDetails}>
      <summary>查看失败明细（{retryable} 个标的）</summary>
      {details.length === 0 ? (
        <p className={styles.muted}>失败标的详情将在同步状态写入后显示。</p>
      ) : (
        <ul className={styles.failureList}>
          {details.map((detail) => (
            <li key={detail.instrumentId} className={styles.failureItem}>
              <div className={styles.failureInstrument}>
                <strong>{detail.symbol}</strong>
                <span>{detail.market}</span>
                <small>{detail.instrumentId}</small>
                <small className={styles.failureAttempt}>
                  最近尝试：{requestedAtLabel(detail.requestedAt)}
                </small>
              </div>
              <ul className={styles.failureIntervals}>
                {detail.intervals.map((interval) => (
                  <li key={`${detail.instrumentId}:${interval.interval}`}>
                    <span>{intervalLabel(interval.interval)}</span>
                    <span>
                      {coverageLabel(interval)
                        ? `${coverageLabel(interval)}；`
                        : ""}
                      {statusLabel(interval.status)}：{interval.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.retryHint}>
        待重试包含部分可用和失败标的，数量可能与“部分可用”重叠；历史周期或行情源不支持时，重试不保证补齐，限流或网络失败可稍后再试。
      </p>
    </details>
  );
}

/**
 * Header-level update control shared by the dashboard, library, and review
 * views. It stays compact when idle and reserves a fixed status area while a
 * batch runs so progress updates do not move surrounding navigation controls.
 */
export function GlobalMarketRefresh({
  instrumentCount,
  state = EMPTY_GLOBAL_MARKET_REFRESH,
  onRefresh,
  onCancel,
  onRetryFailed,
  onRecoverUnfinished,
  disabled = false,
}: GlobalMarketRefreshProps) {
  const canRefresh = instrumentCount > 0 && !disabled && !state.running;
  const summary = summarizeGlobalMarketRefresh(state);
  const canRetry = !state.running && summary.retryable > 0 && onRetryFailed;
  const canRecover =
    !state.running && summary.unfinished > 0 && onRecoverUnfinished;
  const progress = summary.total > 0
    ? Math.min(100, Math.round((summary.processed / summary.total) * 100))
    : 0;
  const hasResult =
    summary.total > 0 ||
    summary.partial > 0 ||
    summary.retryable > 0 ||
    (state.failureDetails?.length ?? 0) > 0;
  const failureDetails = state.failureDetails ?? [];

  return (
    <section className={styles.root} aria-label="全局行情更新">
      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={onRefresh}
          disabled={!canRefresh}
          aria-label={state.running ? "正在更新全部行情" : "更新全部数据"}
        >
          <RefreshCw size={14} aria-hidden="true" className={state.running ? styles.spin : undefined} />
          <span className={styles.buttonText}>{state.running ? "更新中…" : "更新全部数据"}</span>
        </button>
        <span className={styles.scope} title="更新范围按点击时已导入的股票快照确定">
          全部已导入 · {instrumentCount} 只
        </span>
        {state.running && onCancel && (
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            aria-label="取消全部行情更新"
          >
            <X size={13} aria-hidden="true" />
            取消
          </button>
        )}
      </div>

      <div
        className={`${styles.statusArea} ${!state.running ? styles.idleStatusArea : ""}`}
        aria-live="polite"
      >
        {(state.running || hasResult) && (
          <>
            <div className={styles.statusLine}>
              <span>{progressLabel(state, summary)}</span>
              {state.running && state.active ? <span>{state.active} 个进行中</span> : null}
              {!state.running && summary.retryable > 0 ? (
                <span className={styles.failure}>
                  <AlertTriangle size={12} aria-hidden="true" />
                  待重试 {summary.retryable} 个标的
                </span>
              ) : null}
            </div>
            {!state.running && summary.total > 0 && (
              <div
                className={styles.resultSummary}
                aria-label={state.restored ? "已保存行情状态汇总" : "行情更新结果"}
              >
                <span>更新完成 {summary.completed} 个标的</span>
                <span>部分可用 {summary.partial} 个标的</span>
                <span>更新失败 {summary.failed} 个标的</span>
                <span>未完成 {summary.unfinished} 个标的</span>
              </div>
            )}
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label="全部行情更新进度"
              aria-valuemin={0}
              aria-valuemax={state.total || 1}
              aria-valuenow={Math.min(summary.processed, state.total || 0)}
            >
              <span className={styles.progressValue} style={{ width: `${progress}%` }} />
            </div>
          </>
        )}
        {!state.running && (state.cancelled ?? 0) > 0 && (
          <span className={styles.muted}>剩余 {state.cancelled} 项未完成，可再次更新。</span>
        )}
        {!state.running && (state.newlyImported ?? 0) > 0 && (
          <span className={styles.muted}>
            <Check size={12} aria-hidden="true" />
            更新期间新增 {state.newlyImported} 只股票，下次更新时加入。
          </span>
        )}
        {!state.running && <UnfinishedDetails details={state.unfinishedDetails ?? []} />}
        {!state.running && (
          <FailureDetails details={failureDetails} retryable={summary.retryable} />
        )}
      </div>

      {canRetry && (
        <button
          type="button"
          className={styles.retryButton}
          onClick={onRetryFailed}
          aria-label="重试失败的行情更新"
        >
          <RotateCcw size={13} aria-hidden="true" />
          仅重试失败项 ({summary.retryable})
        </button>
      )}
      {canRecover && (
        <button
          type="button"
          className={styles.recoverButton}
          onClick={onRecoverUnfinished}
          aria-label="恢复未完成行情"
        >
          <RotateCcw size={13} aria-hidden="true" />
          恢复未完成 ({summary.unfinished})
        </button>
      )}
    </section>
  );
}

export { GlobalMarketRefresh as GlobalMarketRefreshControl };
