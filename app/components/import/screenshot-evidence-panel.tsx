"use client";

import { useState, type CSSProperties } from "react";
import { AlertTriangle, Check, X } from "lucide-react";

import type {
  ExecutionConflict,
  ReconciliationDecision,
} from "../../lib/import/execution-reconciliation";
import type {
  ScreenshotField,
  ScreenshotTradeDraft,
  SourceBounds,
} from "../../lib/import/screenshot/contracts";
import type { ScreenshotReviewAction } from "../../lib/import/screenshot/review-state";
import type { TradeExecution } from "../../lib/trades/types";

export type ScreenshotReviewImage = {
  id: string;
  fileName: string;
  previewUrl: string;
  width: number;
  height: number;
  state: "queued" | "recognizing" | "complete" | "needs-review" | "failed";
  completedTiles: number;
  totalTiles: number;
  tradeCount: number;
  issueCount: number;
  error?: string;
};

type FieldSelection = {
  kind: "field";
  draft: ScreenshotTradeDraft;
  field: ScreenshotField;
  image?: ScreenshotReviewImage;
};

type ConflictSelection = {
  kind: "conflict";
  conflict: ExecutionConflict;
};

type ScreenshotEvidencePanelProps = {
  selection: FieldSelection | ConflictSelection;
  decision?: ReconciliationDecision;
  onAction(action: ScreenshotReviewAction): void;
  onDecision(conflictId: string, decision: ReconciliationDecision): void;
  onClose(): void;
};

const FIELD_LABELS: Record<ScreenshotField, string> = {
  market: "市场",
  symbol: "股票",
  side: "方向",
  quantity: "数量",
  price: "价格",
  executedAt: "成交时间",
};

function draftFieldValue(
  draft: ScreenshotTradeDraft,
  field: ScreenshotField,
) {
  if (field === "executedAt") return draft.sourceTimestampText ?? "";
  return draft[field] ?? "";
}

function cropTransform(
  image: ScreenshotReviewImage,
  bounds: SourceBounds,
): CSSProperties | undefined {
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return undefined;
  }

  const paddedWidth = Math.min(image.width, bounds.width * 1.8);
  const paddedHeight = Math.min(image.height, bounds.height * 2.8);
  const scale = Math.max(280 / paddedWidth, 110 / paddedHeight);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: image.width,
    height: image.height,
    transformOrigin: "0 0",
    transform: `translate3d(${-centerX * scale}px, ${-centerY * scale}px, 0) scale(${scale})`,
  };
}

function percent(confidence: number) {
  return Number.isFinite(confidence)
    ? `${Math.round(confidence * 100)}%`
    : "不可用";
}

function executionLabel(execution: TradeExecution) {
  const side =
    execution.side === "buy"
      ? "买入"
      : execution.side === "sell"
        ? "卖出"
        : execution.side;
  return `${execution.instrument.symbol} · ${side} ${execution.quantity} @ ${execution.price}`;
}

function ConflictEvidence({
  conflict,
  decision,
  onDecision,
}: {
  conflict: ExecutionConflict;
  decision?: ReconciliationDecision;
  onDecision(conflictId: string, decision: ReconciliationDecision): void;
}) {
  const symbol =
    conflict.incoming[0]?.instrument.symbol ??
    conflict.existing[0]?.instrument.symbol ??
    "未知股票";

  return (
    <>
      <div className="evidence-heading">
        <span className="status-label conflict">
          <AlertTriangle size={14} aria-hidden="true" />
          成交冲突
        </span>
        <h3>{symbol} · 选择保留方式</h3>
        <p>同一股票和成交时间的核心字段不一致，系统不会自动删除。</p>
      </div>
      <div className="conflict-comparison">
        <section aria-label="已有记录">
          <strong>已有记录</strong>
          {conflict.existing.map((execution) => (
            <p key={execution.id}>{executionLabel(execution)}</p>
          ))}
        </section>
        <section aria-label="截图记录">
          <strong>截图记录</strong>
          {conflict.incoming.map((execution) => (
            <p key={execution.id}>{executionLabel(execution)}</p>
          ))}
        </section>
      </div>
      <fieldset className="conflict-decisions">
        <legend>冲突处理</legend>
        {(
          [
            ["保留已有记录", "keep-existing"],
            ["使用截图记录", "use-incoming"],
            ["全部保留", "keep-both"],
          ] as const
        ).map(([label, value]) => (
          <label key={value}>
            <input
              type="radio"
              name={`conflict:${conflict.id}`}
              value={value}
              checked={decision === value}
              onChange={() => onDecision(conflict.id, value)}
            />
            <span>
              {label}
              {decision === value && <Check size={14} aria-hidden="true" />}
            </span>
          </label>
        ))}
      </fieldset>
    </>
  );
}

function FieldEvidence({
  selection,
  onAction,
}: {
  selection: FieldSelection;
  onAction(action: ScreenshotReviewAction): void;
}) {
  const { draft, field, image } = selection;
  const evidence = draft.fieldEvidence[field];
  const [value, setValue] = useState(() => draftFieldValue(draft, field));
  const bounds = evidence?.sourceBounds ?? draft.sourceBounds;
  const transform =
    image && image.previewUrl.startsWith("blob:")
      ? cropTransform(image, bounds)
      : undefined;
  const symbol = draft.symbol || "未命名成交";
  const fieldLabel = FIELD_LABELS[field];

  return (
    <>
      <div className="evidence-heading">
        <span className="eyebrow">字段校对</span>
        <h3>
          {symbol} · {fieldLabel}
        </h3>
        <p>核对截图局部和 OCR 证据，确认识别值或保存修改。</p>
      </div>
      {image && transform ? (
        <figure className="screenshot-crop">
          <div className="screenshot-crop-frame">
            {/* Blob previews intentionally bypass image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.previewUrl}
              alt={`${symbol} ${fieldLabel}截图局部`}
              draggable={false}
              style={transform}
            />
          </div>
          <figcaption>{image.fileName} · 原图内存预览</figcaption>
        </figure>
      ) : (
        <p className="evidence-unavailable">
          此字段没有可定位的截图区域，请根据原始截图手工修改。
        </p>
      )}
      <dl className="ocr-evidence">
        <div>
          <dt>OCR 原文：</dt>
          <dd>{evidence?.rawText || "无"}</dd>
        </div>
        <div>
          <dt>识别置信度：</dt>
          <dd>{evidence ? percent(evidence.confidence) : "无"}</dd>
        </div>
        {evidence?.repaired && (
          <div>
            <dt>识别状态：</dt>
            <dd>已自动修复，仍需人工确认</dd>
          </div>
        )}
      </dl>
      <label className="evidence-editor">
        <span>修改{fieldLabel}</span>
        <input
          type="text"
          aria-label={`修改${fieldLabel}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <div className="evidence-actions">
        {evidence && (
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              onAction({
                type: "confirm-field",
                draftId: draft.id,
                field,
              })
            }
          >
            确认识别值
          </button>
        )}
        <button
          className="primary-button"
          type="button"
          onClick={() =>
            onAction({
              type: "edit-field",
              draftId: draft.id,
              field,
              value,
            })
          }
        >
          保存修改
        </button>
        <button
          className="secondary-button screenshot-abandon-button"
          type="button"
          onClick={() =>
            onAction({ type: "delete-draft", draftId: draft.id })
          }
        >
          放弃这条记录
        </button>
      </div>
    </>
  );
}

export function ScreenshotEvidencePanel({
  selection,
  decision,
  onAction,
  onDecision,
  onClose,
}: ScreenshotEvidencePanelProps) {
  return (
    <aside
      className="screenshot-evidence-panel"
      role="complementary"
      aria-label="截图识别依据"
    >
      <button
        className="icon-button evidence-close"
        type="button"
        aria-label="关闭截图识别依据"
        onClick={onClose}
      >
        <X size={17} aria-hidden="true" />
      </button>
      {selection.kind === "field" ? (
        <FieldEvidence selection={selection} onAction={onAction} />
      ) : (
        <ConflictEvidence
          conflict={selection.conflict}
          decision={decision}
          onDecision={onDecision}
        />
      )}
    </aside>
  );
}
