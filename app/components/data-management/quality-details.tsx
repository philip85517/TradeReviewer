"use client";

import { useState } from "react";

import type { TradingRoomQualityModel } from "../../lib/reviews/trading-room-quality";
import styles from "./quality-details.module.css";

type QualityDimensionId = "transaction" | "holdings" | "historical" | "fx";

export type QualityDetailsProps = {
  model: TradingRoomQualityModel;
  onOpenDataManagement?: (model: TradingRoomQualityModel) => void;
  onRetryDataQuality?: (dimension: QualityDimensionId, ids: readonly string[]) => void | Promise<void>;
  onOpenDataCheck?: (
    dimension: QualityDimensionId,
    ids: readonly string[],
    episodeId?: string,
  ) => void;
};

const statusLabel = {
  available: "可用",
  limited: "部分可用",
  "needs-check": "需检查",
} as const;

function formatAsOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function idsForIssue(dimension: QualityDetailsProps["model"]["dimensions"][number], issue: QualityDetailsProps["model"]["dimensions"][number]["issues"][number]): string[] {
  if (issue.instrumentId) return [issue.instrumentId];
  if (issue.episodeId) return [issue.episodeId];
  return [...dimension.affectedInstrumentIds];
}

function issueActionName(
  dimension: QualityDetailsProps["model"]["dimensions"][number],
  issue: QualityDetailsProps["model"]["dimensions"][number]["issues"][number],
): string {
  if (issue.action === "retry") return `重试${dimension.label}`;
  if (issue.action === "source-unsupported") return "查看数据源";
  if (issue.action === "supplement") return dimension.id === "transaction" ? "补充交易数据" : `补充${dimension.label}`;
  if (issue.action === "open-data-management") return "打开数据管理";
  const target = issue.instrumentId ?? issue.label;
  return `查看数据 ${target}`;
}

function hasIssueAction(
  dimension: QualityDetailsProps["model"]["dimensions"][number],
  action: string,
): boolean {
  return dimension.issues.some(issue => issue.action === action);
}

function denominatorUnit(dimension: QualityDetailsProps["model"]["dimensions"][number]): string {
  return dimension.id === "historical" ? "标的" : "回合";
}

type RetryState = "running" | "failed";

function retryStatusMessage(state: RetryState): string {
  return state === "running" ? "重试进行中…" : "重试失败，请稍后再试";
}

export function QualityDetails({
  model,
  onOpenDataManagement,
  onRetryDataQuality,
  onOpenDataCheck,
}: QualityDetailsProps) {
  const [retryStates, setRetryStates] = useState<Record<string, RetryState>>({});

  const runRetry = async (key: string, dimension: QualityDimensionId, ids: readonly string[]) => {
    if (retryStates[key] === "running") return;
    setRetryStates(current => ({ ...current, [key]: "running" }));
    try {
      await onRetryDataQuality?.(dimension, ids);
      setRetryStates(current => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } catch {
      setRetryStates(current => ({ ...current, [key]: "failed" }));
    }
  };

  return (
    <section className={styles.panel} aria-label="数据质量明细">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Quality details</span>
          <h2>数据质量明细</h2>
          <p>按当前交易室范围说明统计与复盘受到的影响。</p>
        </div>
        <span className={`${styles.status} ${styles[`status-${model.status}`]}`}>
          {model.summary}
        </span>
      </header>

      <div className={styles.dimensions}>
        {model.dimensions.map(dimension => {
          const status = statusLabel[dimension.status];
          const dimensionAction = dimension.action;
          const renderDimensionAction = dimensionAction !== "none" && !hasIssueAction(dimension, dimensionAction);
          return (
            <article className={styles.dimension} key={dimension.id} aria-label={dimension.label}>
              <div className={styles.dimensionHeading}>
                <div>
                  <h3>{dimension.label}</h3>
                  <span className={`${styles.status} ${styles[`status-${dimension.status}`]}`}>{status}</span>
                </div>
                <strong>已用 {dimension.availableCount} / {dimension.totalCount} 个{denominatorUnit(dimension)}；受影响 {dimension.affectedCount} 个</strong>
              </div>
              <p className={styles.impact}>{dimension.impact}</p>
              <dl className={styles.meta}>
                <div><dt>原因</dt><dd>{dimension.reason}</dd></div>
                {dimension.asOf && <div><dt>更新时间</dt><dd>{formatAsOf(dimension.asOf) ?? dimension.asOf}</dd></div>}
              </dl>

              {renderDimensionAction && dimensionAction === "retry" && (
                <div className={styles.retryControl}>
                  {(() => {
                    const retryState = retryStates[`dimension:${dimension.id}`];
                    return (
                      <>
                        <button
                          type="button"
                          className={styles.action}
                          disabled={retryState === "running"}
                          onClick={() => { void runRetry(`dimension:${dimension.id}`, dimension.id as QualityDimensionId, dimension.retryableInstrumentIds); }}
                        >
                          {retryState === "running" ? `重试${dimension.label}（进行中）` : `重试${dimension.label}`}
                        </button>
                        {retryState && <span className={styles.retryFeedback} role={retryState === "failed" ? "alert" : "status"}>{retryStatusMessage(retryState)}</span>}
                      </>
                    );
                  })()}
                </div>
              )}
              {renderDimensionAction && (dimensionAction === "open-data-management" || dimensionAction === "supplement" || dimensionAction === "source-unsupported") && (
                <button type="button" className={styles.action} onClick={() => onOpenDataManagement?.(model)}>
                  {dimensionAction === "open-data-management" ? "打开数据管理" : dimensionAction === "supplement" ? dimension.id === "transaction" ? "补充交易数据" : `补充${dimension.label}` : "查看数据源"}
                </button>
              )}
              {renderDimensionAction && dimensionAction === "open-data-check" && (
                <button type="button" className={styles.action} onClick={() => onOpenDataCheck?.(dimension.id as QualityDimensionId, dimension.affectedInstrumentIds)}>
                  查看数据
                </button>
              )}

              {dimension.issues.length > 0 && (
                <ul className={styles.issues}>
                  {dimension.issues.map(issue => {
                    const issueIds = idsForIssue(dimension, issue);
                    return (
                      <li key={issue.id}>
                        <div>
                          <strong>{issue.label}</strong>
                          {issue.accountSuffix && <span>账户尾号 {issue.accountSuffix}</span>}
                          <small>{issue.reason}{issue.at ? ` · ${formatAsOf(issue.at) ?? issue.at}` : ""}</small>
                        </div>
                        {issue.action === "retry" && (
                          <div className={styles.retryControl}>
                            {(() => {
                              const retryState = retryStates[`issue:${issue.id}`];
                              const actionName = issueActionName(dimension, issue);
                              return (
                                <>
                                  <button
                                    type="button"
                                    className={styles.issueAction}
                                    disabled={retryState === "running"}
                                    onClick={() => { void runRetry(`issue:${issue.id}`, dimension.id as QualityDimensionId, issueIds); }}
                                  >
                                    {retryState === "running" ? `${actionName}（进行中）` : actionName}
                                  </button>
                                  {retryState && <span className={styles.retryFeedback} role={retryState === "failed" ? "alert" : "status"}>{retryStatusMessage(retryState)}</span>}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {(issue.action === "source-unsupported" || issue.action === "open-data-management" || issue.action === "supplement") && (
                          <button type="button" className={styles.issueAction} onClick={() => {
                            if (issue.instrumentId && onOpenDataCheck) onOpenDataCheck(dimension.id as QualityDimensionId, issueIds, issue.episodeId);
                            else onOpenDataManagement?.(model);
                          }}>
                            {issueActionName(dimension, issue)}
                          </button>
                        )}
                        {issue.action === "open-data-check" && (
                          <button type="button" className={styles.issueAction} onClick={() => onOpenDataCheck?.(dimension.id as QualityDimensionId, issueIds, issue.episodeId)}>
                            {issueActionName(dimension, issue)}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
