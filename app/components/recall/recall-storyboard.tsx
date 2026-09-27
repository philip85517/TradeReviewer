"use client";

/* Retained data-URL captures must be displayed verbatim, without image optimization. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { getRecallStoryboard, selectRecallStageSnapshot, STORYBOARD_PHASE_LABELS, STORYBOARD_REASON_LABELS } from "../../lib/recall/storyboard";
import type { RecallDocument } from "../../lib/recall/types";
import "./recall-storyboard.css";

export type RecallStoryboardProps = {
  document: RecallDocument;
  /** Pass the existing optimistic/autosave document updater. No separate persistence channel. */
  onChangeDocument: (document: RecallDocument) => void;
  disabled?: boolean;
};

function snapshotDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date) : "留存时间未知";
}

export function RecallStoryboard({ document, onChangeDocument, disabled = false }: RecallStoryboardProps) {
  const [source, setSource] = useState<"draft" | "formal">("draft");
  const formal = source === "formal" && !!document.lastCompleted;
  const previewDocument = formal ? document.lastCompleted! : document;
  const stages = getRecallStoryboard(previewDocument);
  const legacyCount = previewDocument.snapshots.filter((snapshot) => !snapshot.phase).length;

  return <section className="recall-storyboard" aria-label="三阶段导出画板">
    <header className="recall-storyboard-heading">
      <div><h2>三阶段导出画板</h2><p>选择已留存原图，按判断、持仓、复盘讲述这次交易。</p></div>
      <div className="recall-storyboard-source" role="group" aria-label="画板版本来源">
        <button type="button" aria-pressed={!formal} onClick={() => setSource("draft")}>当前草稿</button>
        <button type="button" disabled={!document.lastCompleted} aria-pressed={formal} onClick={() => setSource("formal")}>正式版本</button>
      </div>
    </header>
    <p className="recall-storyboard-notice">导出不含当前未留存编辑</p>
    <p className="recall-storyboard-meta">{formal ? "正式留存版本 · 只读预览" : "草稿画板 · 选择随复盘保存，不会自动完成回合"}。保留原构图，不按后续行情重算早期价格轴。</p>
    {legacyCount > 0 && <p className="recall-storyboard-notice">{legacyCount} 张旧快照未记录阶段，未自动归入入场前判断。</p>}
    <div className="recall-storyboard-grid">
      {stages.map((stage, index) => {
        const label = STORYBOARD_PHASE_LABELS[stage.phase];
        const candidates = previewDocument.snapshots.filter((snapshot) => snapshot.phase === stage.phase);
        const explicit = previewDocument.storyboard?.[stage.phase]?.snapshotId;
        const invalid = explicit && !candidates.some((snapshot) => snapshot.id === explicit);
        return <article className="recall-storyboard-card" key={stage.phase}>
          <h3><span>{String(index + 1).padStart(2, "0")}</span>{label}</h3>
          <label className="recall-storyboard-label">代表快照
            <select aria-label={`${label}代表快照`} value={explicit ?? ""} disabled={disabled || formal} onChange={(event) => onChangeDocument(selectRecallStageSnapshot(document, stage.phase, event.target.value || null))}>
              <option value="">自动推荐（仅已知阶段）</option>
              {invalid && <option value={explicit}>原选择已失效</option>}
              {candidates.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.decisionId === "global" ? "全局" : snapshot.decisionId === "unassigned" ? "归属待确认" : previewDocument.decisions.some((decision) => decision.id === snapshot.decisionId) ? `决策 ${previewDocument.decisions.findIndex((decision) => decision.id === snapshot.decisionId) + 1}` : "归属待确认"} · {snapshot.timeframe} · {snapshotDate(snapshot.createdAt)}</option>)}
            </select>
          </label>
          <div className="recall-storyboard-frame">
            {stage.snapshot ? <img src={stage.snapshot.imageDataUrl} alt={`${label}已留存原图`} /> : <p>暂无可预览的阶段图</p>}
          </div>
          {stage.snapshot && <p className="recall-storyboard-meta">{stage.selection === "default" ? "自动推荐" : "已选代表图"} · {stage.snapshot.timeframe}<br />观察截止 {snapshotDate(stage.snapshot.cursor)}{stage.snapshot.hasSeenFuture && <><br />已看过后续行情 · 复盘补记</>}</p>}
          {stage.reasons.length > 0 && <ul className="recall-storyboard-reasons">{stage.reasons.map((reason) => <li key={reason}>{STORYBOARD_REASON_LABELS[reason]}</li>)}</ul>}
        </article>;
      })}
    </div>
    <p className="recall-storyboard-meta">此处预览三张代表图。全部决策与附加快照仍保留，可继续在复盘中查看。</p>
  </section>;
}
