"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CopyCheck,
  GitCompareArrows,
  Trash2,
} from "lucide-react";

import type { ExecutionConflict } from "../../lib/import/execution-reconciliation";
import type {
  ScreenshotField,
  ScreenshotTradeDraft,
} from "../../lib/import/screenshot/contracts";

export type ScreenshotSelectedField = {
  draftId: string;
  field: ScreenshotField;
};

type ScreenshotTradeTableProps = {
  drafts: ScreenshotTradeDraft[];
  pendingDraftIds: ReadonlySet<string>;
  pendingFieldKeys: ReadonlySet<string>;
  duplicateDraftIds: ReadonlySet<string>;
  conflictByDraftId: ReadonlyMap<string, ExecutionConflict>;
  imageNames: ReadonlyMap<string, string>;
  onSelectField(selection: ScreenshotSelectedField): void;
  onSelectConflict(conflict: ExecutionConflict): void;
  onDeleteDraft(draftId: string): void;
};

const FIELD_LABELS: Record<ScreenshotField, string> = {
  market: "市场",
  symbol: "股票",
  side: "方向",
  quantity: "数量",
  price: "价格",
  executedAt: "成交时间",
};

function fieldValue(
  draft: ScreenshotTradeDraft,
  field: ScreenshotField,
) {
  if (field === "executedAt") return draft.sourceTimestampText ?? "";
  if (field === "side") {
    return draft.side === "buy"
      ? "买入"
      : draft.side === "sell"
        ? "卖出"
        : "";
  }
  return draft[field] ?? "";
}

function interactiveFieldCell(
  draft: ScreenshotTradeDraft,
  field: ScreenshotField,
  pending: boolean,
  onSelectField: (selection: ScreenshotSelectedField) => void,
) {
  const value = fieldValue(draft, field) || "未填写";
  const symbol = draft.symbol || "未命名成交";
  const label = `${symbol} ${FIELD_LABELS[field]} ${value}${
    pending ? "，待确认" : ""
  }`;
  const select = () => onSelectField({ draftId: draft.id, field });

  return (
    <td
      key={field}
      className={`screenshot-field-cell${pending ? " pending" : ""}`}
      aria-label={label}
      tabIndex={0}
      onClick={select}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
      }}
    >
      <span>{value}</span>
      {pending && <small>待确认</small>}
    </td>
  );
}

export function ScreenshotTradeTable({
  drafts,
  pendingDraftIds,
  pendingFieldKeys,
  duplicateDraftIds,
  conflictByDraftId,
  imageNames,
  onSelectField,
  onSelectConflict,
  onDeleteDraft,
}: ScreenshotTradeTableProps) {
  const [sortDirection, setSortDirection] = useState<"ascending" | "descending">(
    "descending",
  );
  const sortedDrafts = useMemo(
    () =>
      [...drafts].sort((left, right) => {
        const comparison = (left.sourceTimestampText ?? "").localeCompare(
          right.sourceTimestampText ?? "",
        );
        return sortDirection === "ascending" ? comparison : -comparison;
      }),
    [drafts, sortDirection],
  );

  return (
    <table className="screenshot-trade-table" aria-label="截图成交总表">
      <thead>
        <tr>
          <th scope="col">状态</th>
          <th scope="col">市场</th>
          <th scope="col">股票</th>
          <th scope="col">方向</th>
          <th scope="col">数量</th>
          <th scope="col">价格</th>
          <th scope="col" aria-sort={sortDirection}>
            <button
              className="screenshot-sort-button"
              type="button"
              onClick={() =>
                setSortDirection((current) =>
                  current === "ascending" ? "descending" : "ascending",
                )
              }
              aria-label={`按成交时间${
                sortDirection === "ascending" ? "降序" : "升序"
              }排列`}
            >
              成交时间
              <span aria-hidden="true">
                {sortDirection === "ascending" ? " ↑" : " ↓"}
              </span>
            </button>
          </th>
          <th scope="col">来源图片</th>
          <th scope="col">重复 / 冲突</th>
          <th scope="col">操作</th>
        </tr>
      </thead>
      <tbody>
        {sortedDrafts.map((draft) => {
          const pending = pendingDraftIds.has(draft.id);
          const duplicate = duplicateDraftIds.has(draft.id);
          const conflict = conflictByDraftId.get(draft.id);
          const symbol = draft.symbol || "未命名成交";

          return (
            <tr
              key={draft.id}
              className={[
                pending ? "is-pending" : "",
                conflict ? "is-conflict" : "",
                duplicate ? "is-duplicate" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <td className="screenshot-status-cell">
                {pending ? (
                  <span className="status-label pending">
                    <AlertTriangle size={14} aria-hidden="true" />
                    待确认
                  </span>
                ) : (
                  <span className="status-label complete">
                    <CheckCircle2 size={14} aria-hidden="true" />
                    已确认
                  </span>
                )}
              </td>
              {(["market", "symbol", "side", "quantity", "price"] as const).map(
                (field) =>
                  interactiveFieldCell(
                    draft,
                    field,
                    pendingFieldKeys.has(`${draft.id}:${field}`),
                    onSelectField,
                  ),
              )}
              {interactiveFieldCell(
                draft,
                "executedAt",
                pendingFieldKeys.has(`${draft.id}:executedAt`),
                onSelectField,
              )}
              <td>{imageNames.get(draft.imageId) ?? draft.imageId}</td>
              <td className="screenshot-reconciliation-cell">
                {conflict && (
                  <button
                    className="status-action conflict"
                    type="button"
                    aria-label={`处理 ${symbol} 冲突`}
                    onClick={() => onSelectConflict(conflict)}
                  >
                    <GitCompareArrows size={14} aria-hidden="true" />
                    冲突
                  </button>
                )}
                {duplicate && (
                  <span className="status-label duplicate">
                    <CopyCheck size={14} aria-hidden="true" />
                    自动重复
                  </span>
                )}
                {!conflict && !duplicate && <span className="muted-dash">—</span>}
              </td>
              <td>
                <button
                  className="screenshot-delete-button"
                  type="button"
                  aria-label={`删除 ${symbol} 成交`}
                  onClick={() => onDeleteDraft(draft.id)}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
