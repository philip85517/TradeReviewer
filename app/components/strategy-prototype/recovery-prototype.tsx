"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import type { PortfolioId } from "./running-model";
import "./recovery-prototype.css";

export type RecoveryBulkState = {
  phase: "idle" | "confirming" | "expanding";
  fromDate: string;
  endDate: string;
  completedDays: number;
  totalDays: number;
  canExpand: boolean;
  disabledReason?: string;
};

export type RecoveryIncidentState = {
  portfolioId: PortfolioId;
  portfolioName: string;
  failedDate: string;
  lastCompleteDate: string;
  reason: string;
  excluded: boolean;
};

export type RecoveryLaggingState = {
  portfolioId: PortfolioId;
  portfolioName: string;
  viewDate: string;
  lastCompleteDate: string;
};

export type RecoveryCheckpointState = {
  state: "empty" | "saved" | "saveFailed";
  savedDate: string | null;
  localDate: string;
  error?: string;
};

export type RecoveryFaultMode = "none" | "data-interruption" | "execution-failure";
export type RecoveryExecutionOutcome = "filled" | "partial" | "unfilled";

export type RecoveryDemoState = {
  faultMode: RecoveryFaultMode;
  faultPortfolioName?: string;
  faultDate?: string;
  selectedPortfolioName: string;
  nextOutcome: RecoveryExecutionOutcome;
  nextExecutionDate: string | null;
  outcomeArm: { kind: "partial" | "unfilled"; portfolioName: string; date: string } | null;
};

export type RecoveryPrototypeProps = {
  instanceId: string;
  bulk: RecoveryBulkState;
  incident: RecoveryIncidentState | null;
  lagging: RecoveryLaggingState | null;
  checkpoint: RecoveryCheckpointState;
  demo: RecoveryDemoState;
  onRequestBulk: () => void;
  onConfirmBulk: () => void;
  onCancelBulk: () => void;
  onStopBulk: () => void;
  onRetry: () => void;
  onExclude: () => void;
  onViewLastComplete: () => void;
  onReturnToList: () => void;
  onFaultModeChange: (mode: RecoveryFaultMode) => void;
  onNextOutcomeChange: (outcome: RecoveryExecutionOutcome) => void;
  onCreateCheckpoint: () => void;
  onSimulateSaveFailure: () => void;
  onRetryCheckpoint: () => void;
  onReloadCheckpoint: () => void;
};

function daysLabel(completed: number, total: number): string {
  const safeCompleted = Math.max(0, Math.floor(completed));
  const safeTotal = Math.max(0, Math.floor(total));
  return `${Math.min(safeCompleted, safeTotal)} / ${safeTotal} 个交易日`;
}

export function RecoveryPrototype({
  instanceId,
  bulk,
  incident,
  lagging,
  checkpoint,
  demo,
  onRequestBulk,
  onConfirmBulk,
  onCancelBulk,
  onStopBulk,
  onRetry,
  onExclude,
  onViewLastComplete,
  onReturnToList,
  onFaultModeChange,
  onNextOutcomeChange,
  onCreateCheckpoint,
  onSimulateSaveFailure,
  onRetryCheckpoint,
  onReloadCheckpoint,
}: RecoveryPrototypeProps) {
  const localId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const dialogId = `recovery-confirm-${localId}`;
  const faultSelectId = `recovery-fault-${localId}`;
  const outcomeSelectId = `recovery-outcome-${localId}`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const requestButtonRef = useRef<HTMLButtonElement>(null);
  const previousPhaseRef = useRef<RecoveryBulkState["phase"]>("idle");

  const cancelBulk = useCallback(() => {
    onCancelBulk();
    requestAnimationFrame(() => requestButtonRef.current?.focus());
  }, [onCancelBulk]);

  useEffect(() => {
    const previous = previousPhaseRef.current;
    if (bulk.phase === "confirming" && previous !== "confirming") {
      requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLButtonElement>("[data-recovery-cancel]")?.focus());
    }
    previousPhaseRef.current = bulk.phase;
  }, [bulk.phase]);

  useEffect(() => {
    if (bulk.phase !== "confirming") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelBulk();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [bulk.phase, cancelBulk]);

  const percentage = bulk.totalDays > 0
    ? Math.max(0, Math.min(100, bulk.completedDays / bulk.totalDays * 100))
    : 0;
  const faultArmed = demo.faultMode !== "none";
  const mergedExcludedLagging = Boolean(
    incident?.excluded && lagging && incident.portfolioId === lagging.portfolioId,
  );

  return (
    <section className="recovery-prototype" data-instance={instanceId} aria-label="展开与恢复控制">
      <div className="recovery-controls-row">
        <div className="recovery-bulk-row">
          <span className="recovery-label">进度恢复</span>
          <button
            ref={requestButtonRef}
            type="button"
            className="recovery-secondary"
            aria-controls={bulk.phase === "confirming" ? dialogId : undefined}
            aria-expanded={bulk.phase === "confirming"}
            disabled={bulk.phase !== "idle" || !bulk.canExpand}
            onClick={onRequestBulk}
          >
            展开剩余行情
          </button>
          {bulk.phase === "idle" && !bulk.canExpand && bulk.disabledReason && (
            <span className="recovery-muted">{bulk.disabledReason}</span>
          )}
          {bulk.phase === "expanding" && (
            <div className="recovery-progress" role="status" aria-live="polite">
              <span>剩余行情 {daysLabel(bulk.completedDays, bulk.totalDays)}</span>
              <div className="recovery-progress-track" role="progressbar" aria-label="已完成交易日" aria-valuemin={0} aria-valuemax={bulk.totalDays} aria-valuenow={Math.min(bulk.completedDays, bulk.totalDays)}>
                <span style={{ width: `${percentage}%` }} />
              </div>
              <button type="button" className="recovery-secondary" onClick={onStopBulk}>停止于最后完整日</button>
            </div>
          )}
        </div>

        <details className="recovery-demo-tools">
          <summary>原型演示工具 <span>仅合成数据 · 内存状态，不是真实保存或撮合</span></summary>
          <div className="recovery-demo-grid">
            <section className="recovery-demo-block" aria-label="合成故障场景">
              <h2>一次性故障场景</h2>
              <label htmlFor={faultSelectId}>故障注入</label>
              <select id={faultSelectId} value={demo.faultMode} onChange={event => onFaultModeChange(event.currentTarget.value as RecoveryFaultMode)}>
                <option value="none">关闭</option>
                <option value="data-interruption">数据中断</option>
                <option value="execution-failure">执行失败</option>
              </select>
              {faultArmed && (
                <p className="recovery-armed-note">已武装 {demo.faultMode === "data-interruption" ? "数据中断" : "执行失败"}：{demo.faultPortfolioName || "未指定组合"} · {demo.faultDate || "未指定日期"}。切换当前组合不会更改此故障归属。</p>
              )}
            </section>
            <section className="recovery-demo-block" aria-label="合成成交结果">
              <h2>下一次计划执行 · {demo.selectedPortfolioName}</h2>
              <p className="recovery-demo-date">{demo.nextExecutionDate ? `计划日期 ${demo.nextExecutionDate}` : "当前没有下一次计划执行日期"}</p>
              <label htmlFor={outcomeSelectId}>执行演示结果</label>
              <select id={outcomeSelectId} value={demo.nextOutcome} disabled={!demo.nextExecutionDate} onChange={event => onNextOutcomeChange(event.currentTarget.value as RecoveryExecutionOutcome)}>
                <option value="filled">正常成交</option>
                <option value="partial">部分成交（每笔计划差量 50%）</option>
                <option value="unfilled">未成交（计划保留，实际成交为 0）</option>
              </select>
              {demo.outcomeArm && (
                <p className="recovery-armed-note">已锁定 {demo.outcomeArm.kind === "partial" ? "部分成交" : "未成交"}：{demo.outcomeArm.portfolioName} · {demo.outcomeArm.date}。切换组合不会更改此执行归属。</p>
              )}
              {!demo.nextExecutionDate && <p className="recovery-muted">无下一次计划执行；部分成交和未成交选项不可用。</p>}
            </section>
            <section className="recovery-demo-block recovery-checkpoint-block" aria-label="内存检查点演示">
              <h2>内存检查点 · 仅本次页面状态</h2>
              <p>当前完整日 {checkpoint.localDate} · 最近检查点 {checkpoint.savedDate || "尚未创建"}</p>
              {checkpoint.state === "saveFailed" && <p className="recovery-checkpoint-error" role="alert">模拟保存失败：{checkpoint.error || "最近检查点保持不变；当前本地进度仍在内存中。"}</p>}
              {checkpoint.state === "saved" && <p className="recovery-muted" role="status">检查点已在内存中更新；刷新浏览器仍会重置原型。</p>}
              <div className="recovery-demo-actions">
                <button type="button" className="recovery-secondary" onClick={onCreateCheckpoint}>创建内存检查点</button>
                <button type="button" className="recovery-secondary" onClick={onSimulateSaveFailure}>模拟保存失败</button>
                {checkpoint.state === "saveFailed" && <button type="button" className="recovery-secondary" onClick={onRetryCheckpoint}>重试保存</button>}
                <button type="button" className="recovery-secondary" disabled={!checkpoint.savedDate} onClick={onReloadCheckpoint}>重载最近检查点</button>
              </div>
              <small>重载只恢复明确创建的内存检查点，不清除最远已看日期与来源；不代表真实数据库持久化。</small>
            </section>
          </div>
        </details>
      </div>

      {bulk.phase === "confirming" && (
        <div ref={dialogRef} className="recovery-confirm" id={dialogId} role="dialog" aria-labelledby={`${dialogId}-title`}>
          <div className="recovery-confirm-copy">
            <span className="recovery-kicker">批量展开</span>
            <h2 id={`${dialogId}-title`}>展开剩余行情并查看组合结果？</h2>
            <p>将展示 {bulk.fromDate} 至计划结束 {bulk.endDate} 的剩余行情，并在完成后打开组合结果。当前已完成 {daysLabel(bulk.completedDays, bulk.totalDays)}。</p>
            <p>展开中可以停止，停止后保留最后一个完整交易日；之后返回过程回看时仍会保留已看后续标记。</p>
          </div>
          <div className="recovery-confirm-actions">
            <button type="button" className="recovery-primary" onClick={onConfirmBulk}>展开并查看结果</button>
            <button type="button" className="recovery-secondary" data-recovery-cancel onClick={cancelBulk}>取消</button>
          </div>
        </div>
      )}

      {incident && (
        <section className={`recovery-feedback ${incident.excluded ? "excluded" : "incident"}`} role={incident.excluded ? "status" : "alert"} aria-label={incident.excluded ? "已排除的运行中断" : "运行中断"}>
          <div className="recovery-feedback-copy">
            <div className="recovery-feedback-title">
              <span className="recovery-kicker">{incident.excluded ? mergedExcludedLagging ? "组合已排除 · 当前日期不可用" : "组合已排除" : "未完成日未提交"}</span>
              <h2>{incident.portfolioName}</h2>
            </div>
            {mergedExcludedLagging && lagging ? (
              <p>
                {incident.failedDate === lagging.viewDate ? `失败日及当前查看日 ${incident.failedDate}` : `失败日 ${incident.failedDate} · 当前查看日 ${lagging.viewDate}`}
                {` · 最后完整日 ${lagging.lastCompleteDate}；图表和账本止于此日。`}
              </p>
            ) : (
              <p>失败日 {incident.failedDate} · 最后完整日 {incident.lastCompleteDate}</p>
            )}
            {incident.excluded ? (
              <details className="recovery-reason-details">
                <summary>查看失败原因</summary>
                <p>{incident.reason}</p>
              </details>
            ) : (
              <p className="recovery-incident-reason">{incident.reason}</p>
            )}
          </div>
          <div className="recovery-feedback-actions">
            {!incident.excluded && <button type="button" className="recovery-primary" onClick={onRetry}>从最后完整日重试</button>}
            {!incident.excluded && <button type="button" className="recovery-secondary" onClick={onExclude}>明确排除此组合</button>}
            {mergedExcludedLagging && lagging && <button type="button" className="recovery-primary" onClick={onViewLastComplete}>查看最后完整日 {lagging.lastCompleteDate}</button>}
            <button type="button" className="recovery-secondary" onClick={onReturnToList}>返回组合列表</button>
          </div>
        </section>
      )}

      {lagging && !mergedExcludedLagging && (
        <section className="recovery-feedback lagging" role="status" aria-label="组合数据边界">
          <div className="recovery-feedback-copy">
            <div className="recovery-feedback-title">
              <span className="recovery-kicker">当前日期不可用</span>
              <h2>{lagging.portfolioName}</h2>
            </div>
            <p>查看日期 {lagging.viewDate} 晚于该组合最后完整日 {lagging.lastCompleteDate}，此组合在该日不可用；图表和账本止于最后完整日。</p>
          </div>
          <div className="recovery-feedback-actions">
            <button type="button" className="recovery-primary" onClick={onViewLastComplete}>查看最后完整日 {lagging.lastCompleteDate}</button>
            <button type="button" className="recovery-secondary" onClick={onReturnToList}>返回组合列表</button>
          </div>
        </section>
      )}

    </section>
  );
}
