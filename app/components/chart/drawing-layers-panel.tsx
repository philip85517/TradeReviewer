"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, Trash2, Unlock } from "lucide-react";

import type { DrawingCommand } from "../../lib/chart/drawing-commands";
import type { NormalizedDrawing } from "../../lib/chart/drawings";

type Props = {
  drawings: NormalizedDrawing[];
  onCommand: (command: DrawingCommand) => void;
  onSelectDrawing: (id: string | null) => void;
  selectedDrawingId: string | null;
};

const labels: Record<NormalizedDrawing["tool"], string> = {
  "trend-line": "趋势线", "horizontal-line": "水平线", "vertical-line": "垂直线", rectangle: "矩形区间", arrow: "箭头", "price-label": "价格标注", text: "文字标注", measure: "区间测量", "long-risk-reward": "做多盈亏比", "short-risk-reward": "做空盈亏比",
};

export function DrawingLayersPanel({ drawings, onCommand, onSelectDrawing, selectedDrawingId }: Props) {
  const sorted = [...drawings].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
  if (sorted.length === 0) return <p className="drawing-layers-empty">暂无绘图图层</p>;
  return (
    <div className="drawing-layers-panel" aria-label="绘图图层">
      {sorted.map((drawing, index) => {
        const name = drawing.name ?? labels[drawing.tool];
        const isTop = index === 0;
        const isBottom = index === sorted.length - 1;
        return <div className={`drawing-layer ${selectedDrawingId === drawing.id ? "selected" : ""}`} key={drawing.id}>
          <button className="drawing-layer-select" aria-label={`选择${name}`} aria-pressed={selectedDrawingId === drawing.id} onClick={() => onSelectDrawing(drawing.id)}>{labels[drawing.tool]}</button>
          <input aria-label={`重命名${name}`} defaultValue={name} onFocus={() => onSelectDrawing(drawing.id)} onKeyDown={(event) => { if (event.key === "Enter") { event.currentTarget.blur(); } }} onBlur={(event) => { const next = event.currentTarget.value.trim(); if (next && next !== name) onCommand({ type: "rename", id: drawing.id, name: next }); }} />
          <div className="drawing-layer-actions">
            <button aria-label={`${drawing.hidden ? "显示" : "隐藏"}${name}`} aria-pressed={!drawing.hidden} onClick={() => onCommand({ type: "toggle-hidden", id: drawing.id })}>{drawing.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            <button aria-label={`${drawing.locked ? "解锁" : "锁定"}${name}`} aria-pressed={drawing.locked} onClick={() => onCommand({ type: "toggle-locked", id: drawing.id })}>{drawing.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
            <button aria-label={`上移${name}`} title={isTop ? "已在最上层" : "上移图层"} disabled={isTop} onClick={() => onCommand({ type: "move", id: drawing.id, direction: "up" })}><ChevronUp size={14} /></button>
            <button aria-label={`下移${name}`} title={isBottom ? "已在最下层" : "下移图层"} disabled={isBottom} onClick={() => onCommand({ type: "move", id: drawing.id, direction: "down" })}><ChevronDown size={14} /></button>
            <button aria-label={`删除${name}`} disabled={drawing.locked} onClick={() => onCommand({ type: "delete", id: drawing.id })}><Trash2 size={14} /></button>
          </div>
        </div>;
      })}
    </div>
  );
}
