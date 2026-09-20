"use client";

import {
  useMemo,
  useState,
  type DragEvent,
  type ReactElement,
} from "react";

import {
  canUseRecallDirectoryExport,
  chooseRecallDirectory,
  createRecallExportManifest,
  createRecallZipBlob,
  writeRecallExportDirectory,
  type RecallDirectoryExportResult,
  type RecallExportManifest,
  type RecallExportOrder,
  type RecallExportSource,
} from "../../lib/recall-export";
import type { RecallDocument } from "../../lib/recall/types";
import type { TradeEpisode } from "../../lib/trades/types";

export type RecallExportDialogProps = {
  document: RecallDocument;
  episode: TradeEpisode;
  onClose: () => void;
  /** The source is supplied so draft ordering cannot overwrite formal history. */
  onOrderChange?: (order: RecallExportOrder, source: RecallExportSource) => void;
  onExported?: (
    result: RecallDirectoryExportResult | { status: "zip"; fileName: string },
  ) => void;
  initialSource?: RecallExportSource;
  generatedAt?: string;
};

function moveItem<T>(items: readonly T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function statusLabel(status: RecallDocument["status"]) {
  if (status === "completed") return "已完成";
  if (status === "needs-confirmation") return "待重新确认";
  return "进行中";
}

function initialSourceFor(document: RecallDocument, requested: RecallExportSource | undefined) {
  return requested === "completed" && document.lastCompleted ? "completed" : "draft";
}

export function RecallExportDialog({
  document,
  episode,
  onClose,
  onOrderChange,
  onExported,
  initialSource,
  generatedAt,
}: RecallExportDialogProps): ReactElement {
  const [source, setSource] = useState<RecallExportSource>(() => initialSourceFor(document, initialSource));
  const [order, setOrder] = useState<RecallExportOrder | undefined>();
  const [draggingSnapshotId, setDraggingSnapshotId] = useState<string | null>(null);
  const [draggingText, setDraggingText] = useState<{ snapshotId: string; key: string } | null>(null);
  const [directoryResult, setDirectoryResult] = useState<RecallDirectoryExportResult | null>(null);
  const [zipDownloaded, setZipDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manifestState = useMemo<{ manifest: RecallExportManifest | null; error: string | null }>(() => {
    try {
      return { manifest: createRecallExportManifest(document, episode, {
        source,
        order,
        ...(generatedAt ? { generatedAt } : {}),
      }), error: null };
    } catch (reason) {
      return { manifest: null, error: reason instanceof Error ? reason.message : "导出清单无效" };
    }
  }, [document, episode, generatedAt, order, source]);
  const manifest = manifestState.manifest;

  const commitOrder = (next: RecallExportOrder) => {
    setOrder(next);
    onOrderChange?.(next, source);
  };

  const changeSource = (next: RecallExportSource) => {
    setSource(next);
    setOrder(undefined);
    setDirectoryResult(null);
    setZipDownloaded(false);
  };

  const orderForManifest = (nextSnapshots: RecallExportManifest["snapshots"]): RecallExportOrder => ({
    snapshotIds: nextSnapshots.map((snapshot) => snapshot.id),
    textIdsBySnapshot: Object.fromEntries(
      nextSnapshots.map((snapshot) => [snapshot.id, [...snapshot.textIds]]),
    ),
  });

  const onSnapshotDrop = (event: DragEvent<HTMLLIElement>, targetId: string) => {
    event.preventDefault();
    if (!manifest || !draggingSnapshotId || draggingSnapshotId === targetId) return;
    const from = manifest.snapshots.findIndex((snapshot) => snapshot.id === draggingSnapshotId);
    const to = manifest.snapshots.findIndex((snapshot) => snapshot.id === targetId);
    if (from < 0 || to < 0) return;
    commitOrder(orderForManifest(moveItem(manifest.snapshots, from, to)));
    setDraggingSnapshotId(null);
  };

  const onTextDrop = (event: DragEvent<HTMLLIElement>, targetSnapshotId: string, targetKey: string) => {
    event.preventDefault();
    if (!manifest || !draggingText || draggingText.snapshotId !== targetSnapshotId || draggingText.key === targetKey) return;
    const snapshot = manifest.snapshots.find((candidate) => candidate.id === targetSnapshotId);
    if (!snapshot) return;
    const from = snapshot.textIds.indexOf(draggingText.key);
    const to = snapshot.textIds.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    const nextSnapshots = manifest.snapshots.map((candidate) =>
      candidate.id === targetSnapshotId
        ? { ...candidate, textIds: moveItem(candidate.textIds, from, to) }
        : candidate,
    );
    commitOrder(orderForManifest(nextSnapshots));
    setDraggingText(null);
  };

  const downloadZip = () => {
    if (!manifest || typeof window === "undefined") return;
    try {
      const blob = createRecallZipBlob(manifest);
      const href = window.URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = href;
      anchor.download = `${manifest.folderName}.zip`;
      anchor.click();
      window.setTimeout(() => window.URL.revokeObjectURL(href), 0);
      setZipDownloaded(true);
      onExported?.({ status: "zip", fileName: anchor.download });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ZIP 生成失败");
    }
  };

  const exportDirectory = () => {
    if (!manifest) return;
    // Keep picker invocation in this click handler: browsers require a user
    // gesture before showDirectoryPicker can request authorization.
    const picker = chooseRecallDirectory();
    void picker.then((root) => {
      if (!root) {
        const cancelled: RecallDirectoryExportResult = {
          status: "cancelled",
          writtenFiles: 0,
          totalFiles: manifest.files.length,
        };
        setDirectoryResult(cancelled);
        onExported?.(cancelled);
        return;
      }
      return writeRecallExportDirectory(manifest, root).then((result) => {
        setDirectoryResult(result);
        onExported?.(result);
      });
    }).catch((reason) => {
      const partial: RecallDirectoryExportResult = {
        status: "partial",
        writtenFiles: 0,
        totalFiles: manifest.files.length,
        error: reason,
      };
      setDirectoryResult(partial);
      onExported?.(partial);
    });
  };

  return (
    <section className="recall-export-dialog" role="dialog" aria-modal="true" aria-label="导出复盘">
      <header>
        <div>
          <h2>导出复盘</h2>
          <p>{manifest?.folderName ?? "无法生成导出清单"}</p>
        </div>
        <button type="button" aria-label="关闭导出" onClick={onClose}>×</button>
      </header>

      <div className="recall-export-source" role="group" aria-label="导出版本">
        <button type="button" className={source === "draft" ? "active" : ""} onClick={() => changeSource("draft")}>
          最新已留存草稿 · {statusLabel(document.status)}
        </button>
        {document.lastCompleted && (
          <button type="button" className={source === "completed" ? "active" : ""} onClick={() => changeSource("completed")}>
            上次完成版本
          </button>
        )}
      </div>

      {(error ?? manifestState.error) && <p role="alert">{error ?? manifestState.error}</p>}
      {manifest && (
        <>
          <p>预览只包含已留存快照；拖动快照或文字可调整导出顺序。</p>
          {manifest.warnings.length > 0 && (
            <ul className="recall-export-warnings" aria-label="导出提示">
              {manifest.warnings.map((warning) => <li key={`${warning.code}-${warning.decisionId ?? ""}`}>{warning.message}</li>)}
            </ul>
          )}
          <ol className="recall-export-snapshots" aria-label="快照顺序">
            {manifest.snapshots.map((snapshot, index) => {
              const textByKey = new Map(manifest.textEntries.map((entry) => [entry.key, entry]));
              return (
                <li
                  key={snapshot.id}
                  draggable
                  onDragStart={() => setDraggingSnapshotId(snapshot.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onSnapshotDrop(event, snapshot.id)}
                >
                  <strong>{snapshot.decisionId === "global" ? "全局总结" : `快照 ${index + 1}`}</strong>
                  <span>{snapshot.timeframe} · {snapshot.imagePath}</span>
                  {snapshot.textIds.length > 0 && (
                    <ol className="recall-export-texts" aria-label={`${snapshot.id}文字顺序`}>
                      {snapshot.textIds.map((key) => {
                        const entry = textByKey.get(key);
                        if (!entry) return null;
                        return (
                          <li
                            key={key}
                            draggable
                            onDragStart={(event) => {
                              event.stopPropagation();
                              setDraggingText({ snapshotId: snapshot.id, key });
                            }}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => onTextDrop(event, snapshot.id, key)}
                          >
                            <span aria-hidden="true">⋮⋮</span> <pre>{entry.text}</pre>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
          <footer>
            <button type="button" onClick={downloadZip} disabled={!manifest}>下载 ZIP</button>
            <button type="button" onClick={exportDirectory} disabled={!canUseRecallDirectoryExport()}>
              导出到本地目录
            </button>
            {!canUseRecallDirectoryExport() && <small>当前浏览器不支持安全目录写入，请下载 ZIP。</small>}
            {zipDownloaded && <span role="status">ZIP 已开始下载</span>}
            {directoryResult?.status === "success" && <span role="status">已写入 {directoryResult.displayPath}</span>}
            {directoryResult?.status === "partial" && <span role="alert">目录导出未完成：{directoryResult.displayPath ?? "路径未知"}（{directoryResult.writtenFiles}/{directoryResult.totalFiles}）</span>}
            {directoryResult?.status === "cancelled" && <span role="status">已取消目录选择</span>}
          </footer>
        </>
      )}
    </section>
  );
}

export default RecallExportDialog;
