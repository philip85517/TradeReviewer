"use client";

import {
  ChartNoAxesCombined,
  ArrowDownUp,
  ArrowUpRight,
  BoxSelect,
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

import type { DrawingTool } from "../../lib/chart/drawings";

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
  { value: "price-label", label: "价格标注", icon: Tag },
  { value: "text", label: "文字标注", icon: Type },
  { value: "measure", label: "区间测量", icon: Ruler },
  { value: "long-risk-reward", label: "做多盈亏比", icon: ChartNoAxesCombined },
  { value: "short-risk-reward", label: "做空盈亏比", icon: ArrowDownUp },
];

type Props = {
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
  return (
    <div className="drawing-toolbar" aria-label="绘图工具">
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.value}
            className={activeTool === tool.value ? "active" : ""}
            aria-label={tool.label}
            aria-pressed={activeTool === tool.value}
            title={tool.label}
            onClick={() => onToolChange(tool.value)}
          >
            <Icon size={19} />
          </button>
        );
      })}
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
        disabled={!canUndo}
        onClick={onUndo}
      >
        <Undo2 size={18} />
      </button>
      <button
        aria-label="重做绘图"
        title="重做"
        disabled={!canRedo}
        onClick={onRedo}
      >
        <Redo2 size={18} />
      </button>
      <button aria-label="清空绘图" title="清空绘图" onClick={onClear}>
        <Trash2 size={18} />
      </button>
    </div>
  );
}
