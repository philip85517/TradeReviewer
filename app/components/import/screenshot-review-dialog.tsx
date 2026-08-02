"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ImageIcon,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import type {
  ExecutionConflict,
  ExecutionReconciliation,
  ReconciliationDecision,
} from "../../lib/import/execution-reconciliation";
import {
  resolvedReviewAccount,
  reviewBlockers,
  type ScreenshotReviewAction,
  type ScreenshotReviewState,
} from "../../lib/import/screenshot/review-state";
import type { TradeExecution } from "../../lib/trades/types";
import {
  ScreenshotEvidencePanel,
  type ScreenshotReviewImage,
} from "./screenshot-evidence-panel";
import {
  ScreenshotTradeTable,
  type ScreenshotSelectedField,
} from "./screenshot-trade-table";
import { useModalFocus } from "./use-modal-focus";

export type { ScreenshotReviewImage } from "./screenshot-evidence-panel";

export type ScreenshotReviewDialogProps = {
  state: ScreenshotReviewState;
  images: ScreenshotReviewImage[];
  reconciliation?: ExecutionReconciliation;
  decisions: ReadonlyMap<string, ReconciliationDecision>;
  onAction(action: ScreenshotReviewAction): void;
  onDecision(conflictId: string, decision: ReconciliationDecision): void;
  onRetryImage(imageId: string): void;
  onRemoveImage(imageId: string): void;
  onCancel(): void;
  onCompleteReview(): void;
};

type ReviewFilter = "all" | "pending" | "conflict" | "duplicate";

type DrawerSelection =
  | ({ kind: "field" } & ScreenshotSelectedField)
  | { kind: "conflict"; conflictId: string };

function draftIdForExecution(
  execution: TradeExecution,
  state: ScreenshotReviewState,
) {
  const source = execution.source;
  if (source.inputKind !== "screenshot") return undefined;

  let image: ScreenshotReviewState["images"][number] | undefined;
  if (
    source.batchId === state.batchId &&
    typeof source.captureIndex === "number" &&
    Number.isSafeInteger(source.captureIndex) &&
    source.captureIndex >= 0
  ) {
    image = state.images.find(
      ({ captureIndex }) => captureIndex === source.captureIndex,
    );
  }
  if (!image && source.fileFingerprint !== undefined) {
    image = state.images.find(
      ({ fingerprint }) => fingerprint === source.fileFingerprint,
    );
  }
  if (!image) return undefined;

  return state.drafts.find(
    (draft) =>
      draft.imageId === image.imageId &&
      draft.sourceRowIndex === source.row &&
      draft.broker === source.platform,
  )?.id;
}

function reconciliationRows(
  state: ScreenshotReviewState,
  reconciliation?: ExecutionReconciliation,
) {
  const duplicateDraftIds = new Set<string>();
  const conflictByDraftId = new Map<string, ExecutionConflict>();
  if (!reconciliation) {
    return { duplicateDraftIds, conflictByDraftId };
  }

  const currentBatchScreenshot = (execution: TradeExecution) =>
    execution.source.inputKind === "screenshot" &&
    execution.source.batchId === state.batchId;

  for (const duplicate of reconciliation.duplicates) {
    for (const execution of [duplicate.kept, duplicate.skipped].filter(
      currentBatchScreenshot,
    )) {
      const draftId = draftIdForExecution(execution, state);
      if (draftId) duplicateDraftIds.add(draftId);
    }
  }

  for (const conflict of reconciliation.conflicts) {
    for (const execution of conflict.incoming.filter(
      currentBatchScreenshot,
    )) {
      const draftId = draftIdForExecution(execution, state);
      if (draftId) conflictByDraftId.set(draftId, conflict);
    }
  }

  return { duplicateDraftIds, conflictByDraftId };
}

function imageStatusLabel(image: ScreenshotReviewImage) {
  if (image.state === "failed") {
    return `${image.fileName}，识别失败：${image.error || "未知错误"}`;
  }
  const stateLabel = {
    queued: "等待识别",
    recognizing: "识别中",
    complete: "识别完成",
    "needs-review": "需复核",
  }[image.state];
  return `${image.fileName}，${stateLabel}，${image.completedTiles}/${image.totalTiles} 个区域，${image.tradeCount} 笔成交，${image.issueCount} 个问题`;
}

function ImageStateIcon({ state }: { state: ScreenshotReviewImage["state"] }) {
  if (state === "failed" || state === "needs-review") {
    return <AlertTriangle size={14} aria-hidden="true" />;
  }
  if (state === "complete") {
    return <CheckCircle2 size={14} aria-hidden="true" />;
  }
  if (state === "recognizing") {
    return (
      <LoaderCircle
        size={14}
        className="screenshot-progress-spin"
        aria-hidden="true"
      />
    );
  }
  return <Clock3 size={14} aria-hidden="true" />;
}

function imageStateText(image: ScreenshotReviewImage) {
  if (image.state === "failed") return "识别失败";
  if (image.state === "needs-review") return `${image.issueCount} 个问题`;
  if (image.state === "complete") return `${image.tradeCount} 笔成交`;
  if (image.state === "recognizing") {
    return `${image.completedTiles}/${image.totalTiles} 个区域`;
  }
  return "等待识别";
}

export function ScreenshotReviewDialog({
  state,
  images,
  reconciliation,
  decisions,
  onAction,
  onDecision,
  onRetryImage,
  onRemoveImage,
  onCancel,
  onCompleteReview,
}: ScreenshotReviewDialogProps) {
  const dialogRef = useModalFocus(onCancel);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [selectedImageId, setSelectedImageId] = useState(
    () => images[0]?.id ?? "",
  );
  const [drawerSelection, setDrawerSelection] =
    useState<DrawerSelection | null>(null);
  const blockers = reviewBlockers(state);
  const reviewAccount = resolvedReviewAccount(state);
  const activeDrafts = state.drafts.filter(
    ({ id }) => !state.deletedDraftIds.has(id),
  );
  const pendingDraftIds = new Set(
    blockers
      .map(({ draftId }) => draftId)
      .filter((draftId): draftId is string => Boolean(draftId)),
  );
  const pendingFieldKeys = new Set(
    blockers
      .filter(
        (
          blocker,
        ): blocker is typeof blocker & {
          draftId: string;
          field: NonNullable<typeof blocker.field>;
        } => Boolean(blocker.draftId && blocker.field),
      )
      .map(({ draftId, field }) => `${draftId}:${field}`),
  );
  const { duplicateDraftIds, conflictByDraftId } = useMemo(
    () => reconciliationRows(state, reconciliation),
    [state, reconciliation],
  );
  const imageNames = new Map(images.map((image) => [image.id, image.fileName]));
  const imageDescriptors = new Map(
    images.map((image, index) => [
      image.id,
      `第 ${index + 1} 张 ${image.fileName}`,
    ]),
  );
  const effectiveSelectedImageId = images.some(
    ({ id }) => id === selectedImageId,
  )
    ? selectedImageId
    : (images[0]?.id ?? "");
  const selectedImage = images.find(
    ({ id }) => id === effectiveSelectedImageId,
  );
  const selectedImageMetadata = state.images.find(
    ({ imageId }) => imageId === effectiveSelectedImageId,
  );
  const filteredDrafts = activeDrafts.filter((draft) => {
    if (filter === "pending") return pendingDraftIds.has(draft.id);
    if (filter === "conflict") return conflictByDraftId.has(draft.id);
    if (filter === "duplicate") return duplicateDraftIds.has(draft.id);
    return true;
  });
  const conflicts = reconciliation?.conflicts ?? [];
  const unresolvedConflicts = conflicts.filter(
    ({ id }) => !decisions.has(id),
  );
  const unfinishedImage = images.some(({ state: imageState }) =>
    ["queued", "recognizing", "failed"].includes(imageState),
  );
  const completeDisabled =
    blockers.length > 0 ||
    unresolvedConflicts.length > 0 ||
    unfinishedImage;
  const totalTiles = images.reduce((sum, image) => sum + image.totalTiles, 0);
  const completedTiles = images.reduce(
    (sum, image) => sum + image.completedTiles,
    0,
  );

  const fieldSelection =
    drawerSelection?.kind === "field"
      ? {
          draft: activeDrafts.find(
            ({ id }) => id === drawerSelection.draftId,
          ),
          image: undefined as ScreenshotReviewImage | undefined,
        }
      : undefined;
  if (fieldSelection?.draft) {
    fieldSelection.image = images.find(
      ({ id }) => id === fieldSelection.draft?.imageId,
    );
  }
  const conflictSelection =
    drawerSelection?.kind === "conflict"
      ? conflicts.find(({ id }) => id === drawerSelection.conflictId)
      : undefined;
  const hasEvidence = Boolean(fieldSelection?.draft || conflictSelection);

  const filters: Array<{
    id: ReviewFilter;
    label: string;
    count: number;
  }> = [
    { id: "all", label: "全部", count: activeDrafts.length },
    { id: "pending", label: "待确认", count: pendingDraftIds.size },
    { id: "conflict", label: "冲突", count: conflicts.length },
    {
      id: "duplicate",
      label: "自动重复",
      count: reconciliation?.duplicates.length ?? 0,
    },
  ];

  return (
    <div className="modal-backdrop screenshot-review-backdrop">
      <section
        ref={dialogRef}
        className="screenshot-review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="screenshot-review-title"
      >
        <header className="modal-header screenshot-review-header">
          <div>
            <span className="eyebrow">本机 OCR · 原图不会保存</span>
            <h2 id="screenshot-review-title">从截图恢复交易</h2>
            <p>
              {completedTiles}/{totalTiles} 个识别区域已处理 ·{" "}
              {activeDrafts.length} 笔成交
            </p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭截图校对"
            onClick={onCancel}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="screenshot-review-context">
          <label>
            <span>截图成交时区</span>
            <select
              aria-label="截图成交时区"
              value={state.sourceTimezone ?? ""}
              onChange={(event) =>
                onAction({
                  type: "set-time-zone",
                  timeZone: event.target.value,
                })
              }
            >
              <option value="" disabled>
                选择时区
              </option>
              <option value="Asia/Shanghai">中国标准时间</option>
              <option value="America/New_York">美国东部时间</option>
              <option value="America/Chicago">美国中部时间</option>
              <option value="America/Los_Angeles">美国太平洋时间</option>
            </select>
          </label>
          <label>
            <span>交易账户</span>
            <input
              aria-label="交易账户"
              type="text"
              value={state.account?.label ?? reviewAccount?.label ?? ""}
              placeholder="输入账户名称"
              onChange={(event) => {
                const accountLabel = event.target.value;
                onAction({
                  type: "set-account",
                  accountId: accountLabel.trim()
                    ? `screenshot:manual:${accountLabel.trim().toLowerCase()}`
                    : "",
                  accountLabel,
                });
              }}
            />
          </label>
        </div>

        <div
          className={`screenshot-review-body${
            hasEvidence ? " has-evidence" : ""
          }`}
        >
          <aside className="screenshot-image-rail" aria-label="截图列表">
            <div className="image-rail-heading">
              <ImageIcon size={16} aria-hidden="true" />
              <strong>来源截图</strong>
              <span>{images.length}</span>
            </div>
            <ol>
              {images.map((image, index) => (
                <li
                  key={image.id}
                  className={[
                    image.id === effectiveSelectedImageId ? "selected" : "",
                    `state-${image.state}`,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    className="image-rail-select"
                    type="button"
                    aria-label={`选择 ${image.fileName}`}
                    aria-current={
                      image.id === effectiveSelectedImageId
                        ? "true"
                        : undefined
                    }
                    onClick={() => setSelectedImageId(image.id)}
                  >
                    {image.previewUrl.startsWith("blob:") ? (
                      // Object URLs stay in memory and are never converted.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image.previewUrl}
                        alt=""
                        draggable={false}
                      />
                    ) : (
                      <span className="image-rail-placeholder">
                        <ImageIcon size={20} aria-hidden="true" />
                      </span>
                    )}
                    <span>
                      <b>
                        {index + 1}. {image.fileName}
                      </b>
                      <small>
                        <ImageStateIcon state={image.state} />
                        {imageStateText(image)}
                      </small>
                    </span>
                  </button>
                  <div
                    className="sr-only"
                    role="status"
                    aria-label={imageStatusLabel(image)}
                  />
                  {image.state === "failed" && (
                    <div
                      className="failed-image-actions"
                      role="group"
                      aria-label={`恢复 ${image.fileName}`}
                    >
                      <p className="failed-image-guidance">
                        重试或移除此截图后才能继续
                      </p>
                      <button
                        type="button"
                        aria-label={`重试 ${image.fileName}`}
                        onClick={() => onRetryImage(image.id)}
                      >
                        <RefreshCw size={13} aria-hidden="true" />
                        重试
                      </button>
                      <button
                        type="button"
                        aria-label={`移除 ${image.fileName}`}
                        onClick={() => onRemoveImage(image.id)}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                        移除
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <button
              className="secondary-button screenshot-manual-add"
              type="button"
              disabled={!selectedImage || !selectedImageMetadata}
              onClick={() =>
                effectiveSelectedImageId &&
                onAction({
                  type: "add-draft",
                  imageId: effectiveSelectedImageId,
                })
              }
            >
              <Plus size={14} aria-hidden="true" />
              手工补录成交
            </button>
          </aside>

          <main className="screenshot-table-pane">
            <div className="screenshot-table-toolbar">
              <div
                className="screenshot-batch-summary"
                role="status"
                aria-label={`批次统计：总成交 ${activeDrafts.length}，待确认 ${pendingDraftIds.size}，自动重复 ${
                  reconciliation?.duplicates.length ?? 0
                }，冲突 ${conflicts.length}`}
              >
                <div>
                  <span>总成交</span>
                  <strong>{activeDrafts.length}</strong>
                </div>
                <div className={pendingDraftIds.size > 0 ? "warning" : ""}>
                  <span>待确认</span>
                  <strong>{pendingDraftIds.size}</strong>
                </div>
                <div>
                  <span>自动重复</span>
                  <strong>{reconciliation?.duplicates.length ?? 0}</strong>
                </div>
                <div className={conflicts.length > 0 ? "danger" : ""}>
                  <span>冲突</span>
                  <strong>{conflicts.length}</strong>
                </div>
              </div>
              <nav className="screenshot-filters" aria-label="成交筛选">
                {filters.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    aria-pressed={filter === item.id}
                    onClick={() => setFilter(item.id)}
                  >
                    {item.label}
                    <span aria-hidden="true">{item.count}</span>
                  </button>
                ))}
              </nav>
            </div>
            <div className="screenshot-table-scroll">
              <ScreenshotTradeTable
                drafts={filteredDrafts}
                pendingDraftIds={pendingDraftIds}
                pendingFieldKeys={pendingFieldKeys}
                duplicateDraftIds={duplicateDraftIds}
                conflictByDraftId={conflictByDraftId}
                imageNames={imageNames}
                imageDescriptors={imageDescriptors}
                onSelectField={(selection) =>
                  setDrawerSelection({ kind: "field", ...selection })
                }
                onSelectConflict={(conflict) =>
                  setDrawerSelection({
                    kind: "conflict",
                    conflictId: conflict.id,
                  })
                }
                onDeleteDraft={(draftId) =>
                  onAction({ type: "delete-draft", draftId })
                }
              />
            </div>
          </main>

          {fieldSelection?.draft && drawerSelection?.kind === "field" && (
            <ScreenshotEvidencePanel
              key={`${fieldSelection.draft.id}:${drawerSelection.field}`}
              selection={{
                kind: "field",
                draft: fieldSelection.draft,
                field: drawerSelection.field,
                image: fieldSelection.image,
              }}
              onAction={onAction}
              onDecision={onDecision}
              onClose={() => setDrawerSelection(null)}
            />
          )}
          {conflictSelection && (
            <ScreenshotEvidencePanel
              key={conflictSelection.id}
              selection={{ kind: "conflict", conflict: conflictSelection }}
              decision={decisions.get(conflictSelection.id)}
              onAction={onAction}
              onDecision={onDecision}
              onClose={() => setDrawerSelection(null)}
            />
          )}
        </div>

        <footer className="modal-footer screenshot-review-footer">
          <p>
            {blockers[0]?.message ??
              (unresolvedConflicts.length > 0
                ? `还有 ${unresolvedConflicts.length} 个冲突未处理`
                : unfinishedImage
                  ? "请先重试或移除未完成的截图"
                  : "所有必填字段和冲突均已处理")}
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={completeDisabled}
            onClick={onCompleteReview}
          >
            确认导入
          </button>
        </footer>
      </section>
    </div>
  );
}
