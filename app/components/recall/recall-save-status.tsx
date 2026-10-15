import { CircleAlert, CircleCheck, Save, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const CONFLICT_COPY = "复盘版本已更新；当前草稿已保留。";

export type RecallSaveStatusProps = {
  conflict: boolean;
  dirty: boolean;
  error: string | null;
  saveRetryable: boolean;
  saving: boolean;
  onReload: () => void | Promise<void>;
  onRetrySave: () => void | Promise<void>;
};

type RecallSaveState = "conflict" | "error" | "saving" | "dirty" | "saved";

function stateLabel(state: RecallSaveState) {
  switch (state) {
    case "conflict": return "复盘版本冲突";
    case "error": return "复盘操作错误";
    case "saving": return "保存中";
    case "dirty": return "有未保存修改";
    default: return "已保存";
  }
}

function iconFor(state: RecallSaveState) {
  if (state === "conflict" || state === "error") return <CircleAlert size={18} aria-hidden="true" />;
  if (state === "saved") return <CircleCheck size={18} aria-hidden="true" />;
  return <Save size={18} aria-hidden="true" />;
}

export function RecallSaveStatus({
  conflict,
  dirty,
  error,
  saveRetryable,
  saving,
  onReload,
  onRetrySave,
}: RecallSaveStatusProps) {
  const state: RecallSaveState = conflict ? "conflict" : error ? "error" : saving ? "saving" : dirty ? "dirty" : "saved";
  const hasRecoveryDetails = state === "conflict" || state === "error";
  const detailMessage = conflict ? CONFLICT_COPY : error;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const pendingExplicitFocusRef = useRef(false);
  const previousRecoveryRef = useRef(false);
  const detailsId = `recall-save-status-details-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const wasRecovery = previousRecoveryRef.current;
    if (hasRecoveryDetails && !wasRecovery) setOpen(true);
    if (!hasRecoveryDetails) setOpen(false);
    previousRecoveryRef.current = hasRecoveryDetails;
  }, [hasRecoveryDetails]);

  useEffect(() => {
    if (!open || !pendingExplicitFocusRef.current) return;
    pendingExplicitFocusRef.current = false;
    firstActionRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      event.stopPropagation();
    };
    // Capture outside presses before chart/text controls can stop bubbling;
    // the target's native action and focus behavior remain untouched.
    document.addEventListener("pointerdown", handlePointerDown, true);
    // Capture outside Escape before the workspace/chart key handlers can
    // interpret it as their own cancel action. Focus inside the flyout is
    // handled by the panel and remains on the recovery surface.
    document.addEventListener("keydown", handleDocumentKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleDocumentKeyDown, true);
    };
  }, [open]);

  const stopPointerPropagation = (event: PointerEvent) => event.stopPropagation();
  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    triggerRef.current?.focus();
  };

  const announcement = hasRecoveryDetails ? detailMessage ?? "复盘操作未完成" : "";

  return (
    <div ref={rootRef} className="recall-save-status" data-status={state}>
      <button
        ref={triggerRef}
        type="button"
        className="recall-save-status__trigger"
        data-status={state}
        aria-label={stateLabel(state)}
        title={stateLabel(state)}
        aria-haspopup={hasRecoveryDetails ? "dialog" : undefined}
        aria-expanded={hasRecoveryDetails ? open : false}
        aria-controls={hasRecoveryDetails ? detailsId : undefined}
        onPointerDown={stopPointerPropagation}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open || !hasRecoveryDetails) return;
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (!hasRecoveryDetails) return;
          const nextOpen = !open;
          pendingExplicitFocusRef.current = nextOpen;
          setOpen(nextOpen);
        }}
      >
        {iconFor(state)}
      </button>
      <span className="recall-save-status__live" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
      {open && hasRecoveryDetails && (
        <div
          id={detailsId}
          className="recall-save-status__flyout"
          role="dialog"
          aria-label={conflict ? "复盘版本冲突详情" : "复盘错误详情"}
          onKeyDown={handlePanelKeyDown}
          onPointerDown={stopPointerPropagation}
        >
          <div className="recall-save-status__flyout-heading">
            <strong>{conflict ? "复盘版本冲突" : "复盘操作未完成"}</strong>
            <button type="button" aria-label="关闭错误详情" title="关闭" onPointerDown={stopPointerPropagation} onClick={(event) => { event.stopPropagation(); setOpen(false); }}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <p>{detailMessage ?? "复盘操作未完成"}</p>
          <div className="recall-save-status__actions">
            {saveRetryable && !conflict && (
              <button ref={firstActionRef} type="button" disabled={saving} onPointerDown={stopPointerPropagation} onClick={(event) => { event.stopPropagation(); void onRetrySave(); }}>重试保存</button>
            )}
            <button ref={!saveRetryable || conflict ? firstActionRef : undefined} type="button" onPointerDown={stopPointerPropagation} onClick={(event) => { event.stopPropagation(); void onReload(); }}>重新载入</button>
          </div>
        </div>
      )}
    </div>
  );
}
