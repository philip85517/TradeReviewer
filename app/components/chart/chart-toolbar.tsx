"use client";

import {
  ChevronDown,
  CloudOff,
  Layers3,
  Maximize2,
  Search,
  Settings,
} from "lucide-react";

import type { Timeframe } from "../../lib/market/types";

const timeframes: Array<{ value: Timeframe; label: string }> = [
  { value: "15m", label: "15m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
];

type Props = {
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
};

export function ChartToolbar({ timeframe, onTimeframeChange }: Props) {
  return (
    <div className="chart-toolbar" aria-label="图表工具栏">
      <div className="symbol-control">
        <div className="symbol-avatar">X</div>
        <div>
          <strong>XPEV</strong>
          <span>小鹏汽车 · NYSE</span>
        </div>
        <ChevronDown size={14} />
      </div>
      <button className="icon-button" aria-label="搜索标的">
        <Search size={17} />
      </button>
      <div className="toolbar-divider" />
      <div className="timeframe-group" aria-label="K 线周期">
        {timeframes.map((item) => (
          <button
            key={item.value}
            className={timeframe === item.value ? "active" : ""}
            aria-label={`切换到 ${item.value}`}
            onClick={() => onTimeframeChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="toolbar-spacer" />
      <span className="local-data-badge">
        <CloudOff size={14} />
        本地数据
      </span>
      <button className="icon-button" aria-label="图层">
        <Layers3 size={17} />
      </button>
      <button className="icon-button" aria-label="全屏">
        <Maximize2 size={17} />
      </button>
      <button className="icon-button" aria-label="图表设置">
        <Settings size={17} />
      </button>
    </div>
  );
}
