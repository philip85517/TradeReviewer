"use client";

import {
  ChartNoAxesCombined,
  Ellipsis,
  ArrowDownUp,
  ArrowUpRight,
  BoxSelect,
  ChartNoAxesColumnIncreasing,
  Lock,
  Minus,
  MousePointer2,
  MoveVertical,
  Ruler,
  Redo2,
  Tag,
  Trash2,
  TrendingUp,
  Type,
  Undo2,
} from "lucide-react";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { DrawingTool } from "../../lib/chart/drawings";
import styles from "./drawing-toolbar.module.css";

const tools: Array<{
  value: DrawingTool;
  label: string;
  icon: typeof MousePointer2;
}> = [
  { value: "cursor", label: "选择", icon: MousePointer2 },
  { value: "trend-line", label: "趋势线", icon: TrendingUp },
  { value: "horizontal-line", label: "水平线", icon: Minus },
  { value: "vertical-line", label: "垂直线", icon: MoveVertical },
  { value: "rectangle", label: "矩形区间", icon: BoxSelect },
  { value: "arrow", label: "箭头", icon: ArrowUpRight },
  { value: "parallel-channel", label: "平行通道", icon: ChartNoAxesColumnIncreasing },
  { value: "fibonacci", label: "斐波那契回撤", icon: ChartNoAxesCombined },
  { value: "price-label", label: "价格标注", icon: Tag },
  { value: "text", label: "文字标注", icon: Type },
  { value: "measure", label: "区间测量", icon: Ruler },
  { value: "long-risk-reward", label: "做多盈亏比", icon: ChartNoAxesCombined },
  { value: "short-risk-reward", label: "做空盈亏比", icon: ArrowDownUp },
];

const compactPrimary: DrawingTool[] = [
  "cursor",
  "text",
  "trend-line",
  "horizontal-line",
  "parallel-channel",
  "long-risk-reward",
];

type Props = {
  compact?: boolean;
  activeTool: DrawingTool;
  canUndo: boolean;
  canRedo: boolean;
  allLocked: boolean;
  onToolChange: (tool: DrawingTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onToggleLock: () => void;
};

export function DrawingToolbar({
  compact = false,
  activeTool,
  canUndo,
  canRedo,
  allLocked,
  onToolChange,
  onUndo,
  onRedo,
  onClear,
  onToggleLock,
}: Props) {
  const moreRef = useRef<HTMLDetailsElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const suppressedClickPointerRef = useRef<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTools = useMemo(
    () => compact ? tools.filter((tool) => !compactPrimary.includes(tool.value)) : tools.slice(3),
    [compact],
  );
  const selectedMoreTool = moreTools.find((tool) => tool.value === activeTool);
  const closeMore = useCallback((restoreFocus = false) => {
    setMoreOpen(false);
    if (moreRef.current) moreRef.current.open = false;
    if (restoreFocus) triggerRef.current?.focus();
  }, []);
  const focusMenuItem = useCallback(() => {
    const selectedIndex = moreTools.findIndex((tool) => tool.value === activeTool);
    menuItemRefs.current[selectedIndex >= 0 ? selectedIndex : 0]?.focus();
  }, [activeTool, moreTools]);
  const renderTool = (tool: (typeof tools)[number], inMoreMenu = false, menuIndex?: number) => {
    const Icon = tool.icon;
    return (
      <button
        key={tool.value}
        className={activeTool === tool.value ? "active" : undefined}
        aria-label={tool.label}
        aria-pressed={activeTool === tool.value}
        title={tool.label}
        role={inMoreMenu ? "menuitem" : undefined}
        ref={inMoreMenu && menuIndex !== undefined ? (element) => { menuItemRefs.current[menuIndex] = element; } : undefined}
        onClick={(event) => {
          event.stopPropagation();
          onToolChange(tool.value);
          if (inMoreMenu) closeMore(true);
        }}
      >
        <Icon size={19} />
        {inMoreMenu && <span className={styles.label}>{tool.label}</span>}
      </button>
    );
  };

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const margin = 8;
    const gap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxLeft = Math.max(margin, viewportWidth - menuRect.width - margin);
    const maxTop = Math.max(margin, viewportHeight - menuRect.height - margin);
    let left = triggerRect.right + gap;
    if (left + menuRect.width > viewportWidth - margin) left = triggerRect.left - menuRect.width - gap;
    let top = triggerRect.top;
    if (top + menuRect.height > viewportHeight - margin) top = triggerRect.bottom - menuRect.height;
    menu.style.left = `${Math.min(Math.max(left, margin), maxLeft)}px`;
    menu.style.top = `${Math.min(Math.max(top, margin), maxTop)}px`;
  }, []);

  useLayoutEffect(() => {
    if (!moreOpen) return;
    positionMenu();
    focusMenuItem();
  }, [focusMenuItem, moreOpen, positionMenu]);

  useEffect(() => {
    const handleSuppressedClick = (event: MouseEvent) => {
      if (suppressedClickPointerRef.current === null) return;
      event.preventDefault();
      event.stopPropagation();
      suppressedClickPointerRef.current = null;
    };
    const clearAfterPointerEnd = (event: PointerEvent) => {
      if (suppressedClickPointerRef.current !== event.pointerId) return;
      const pointerId = event.pointerId;
      window.setTimeout(() => {
        if (suppressedClickPointerRef.current === pointerId) suppressedClickPointerRef.current = null;
      }, 0);
    };
    const clearAfterPointerCancel = (event: PointerEvent) => {
      if (suppressedClickPointerRef.current === event.pointerId) suppressedClickPointerRef.current = null;
    };
    const clearAfterBlur = () => {
      suppressedClickPointerRef.current = null;
    };
    document.addEventListener("click", handleSuppressedClick, true);
    document.addEventListener("pointerup", clearAfterPointerEnd, true);
    document.addEventListener("pointercancel", clearAfterPointerCancel, true);
    window.addEventListener("blur", clearAfterBlur);
    return () => {
      document.removeEventListener("click", handleSuppressedClick, true);
      document.removeEventListener("pointerup", clearAfterPointerEnd, true);
      document.removeEventListener("pointercancel", clearAfterPointerCancel, true);
      window.removeEventListener("blur", clearAfterBlur);
    };
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const handleViewportChange = () => positionMenu();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (moreRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      if ((target as Element | null)?.closest("canvas, .chart-stage")) {
        event.preventDefault();
        event.stopPropagation();
        suppressedClickPointerRef.current = event.pointerId;
      }
      closeMore(true);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMore(true);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [closeMore, moreOpen, positionMenu]);

  const floatingMenu = moreOpen && typeof document !== "undefined" ? createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      role="menu"
      aria-label="更多绘图工具"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeMore(true);
          return;
        }
        const currentIndex = menuItemRefs.current.indexOf(event.target as HTMLButtonElement);
        const selectedIndex = moreTools.findIndex((tool) => tool.value === activeTool);
        const index = currentIndex >= 0 ? currentIndex : Math.max(selectedIndex, 0);
        let nextIndex: number | null = null;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = moreTools.length - 1;
        if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (index + 1) % moreTools.length;
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (index - 1 + moreTools.length) % moreTools.length;
        if (nextIndex !== null) {
          event.preventDefault();
          event.stopPropagation();
          menuItemRefs.current[nextIndex]?.focus();
          return;
        }
        if ((event.key === "Enter" || event.key === " ") && event.target instanceof HTMLButtonElement) {
          event.preventDefault();
          event.stopPropagation();
          event.target.click();
        }
      }}
    >
      {moreTools.map((tool, index) => renderTool(tool, true, index))}
    </div>,
    document.body,
  ) : null;
  const SelectedIcon = selectedMoreTool?.icon;

  return (
    <div className="drawing-toolbar" role="toolbar" aria-label="绘图工具">
      {(compact ? compactPrimary.map(value => tools.find(tool => tool.value === value)!) : tools.slice(0, 3)).map((tool) => renderTool(tool))}
      <details className="drawing-more" ref={moreRef} open={moreOpen}>
        <summary
          ref={triggerRef}
          className={selectedMoreTool ? styles.selectedTrigger : undefined}
          role="button"
          aria-haspopup="menu"
          aria-label="更多绘图工具"
          title={selectedMoreTool ? `更多绘图工具（当前：${selectedMoreTool.label}）` : "更多绘图工具"}
          aria-expanded={moreOpen}
          onClick={(event) => {
            event.preventDefault();
            setMoreOpen((open) => !open);
          }}
        >
          {SelectedIcon ? <SelectedIcon size={19} /> : <Ellipsis size={19} />}
          <span className="sr-only">更多绘图工具</span>
        </summary>
      </details>
      <div className="drawing-divider" />
      <button
        className={allLocked ? "active" : ""}
        aria-label={allLocked ? "解锁全部图形" : "锁定全部图形"}
        aria-pressed={allLocked}
        title={allLocked ? "解锁全部图形" : "锁定全部图形"}
        onClick={onToggleLock}
      >
        <Lock size={18} />
      </button>
      <button
        aria-label="撤销绘图"
        title="撤销"
        data-replay-control="true"
        disabled={!canUndo}
        onClick={onUndo}
      >
        <Undo2 size={18} />
      </button>
      <button
        aria-label="重做绘图"
        title="重做"
        data-replay-control="true"
        disabled={!canRedo}
        onClick={onRedo}
      >
        <Redo2 size={18} />
      </button>
      <button aria-label="清空绘图" title="清空绘图" onClick={onClear}>
        <Trash2 size={18} />
      </button>
      {floatingMenu}
    </div>
  );
}
