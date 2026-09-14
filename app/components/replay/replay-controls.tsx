"use client";

import {
  ChevronLeft,
  Pause,
  Play,
  SkipForward,
  StepForward,
} from "lucide-react";

type Props = {
  playing: boolean;
  speed: number;
  canGoBack: boolean;
  canGoForward: boolean;
  canGoToNextExecution: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onNextExecution: () => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
};

export function ReplayControls({
  playing,
  speed,
  canGoBack,
  canGoForward,
  canGoToNextExecution,
  onPrevious,
  onNext,
  onNextExecution,
  onTogglePlay,
  onSpeedChange,
}: Props) {
  return (
    <div className="replay-controls" aria-label="逐根回放控制">
      <button
        className="control-button"
        onClick={onPrevious}
        disabled={!canGoBack}
        title={canGoBack ? "上一根 K 线" : "已在回放起点"}
        aria-label="上一根 K 线"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        className="play-button"
        onClick={onTogglePlay}
        disabled={!canGoForward}
        title={!canGoForward ? "当前没有可继续回放的 K 线" : undefined}
        aria-label={playing ? "暂停回放" : "开始回放"}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
        <span>{playing ? "暂停回放" : canGoBack ? "继续回放" : "开始回放"}</span>
      </button>
      <button
        className="control-button"
        onClick={onNext}
        disabled={!canGoForward}
        title={canGoForward ? "下一根 K 线" : "已到可用行情终点"}
        aria-label="下一根 K 线"
      >
        <StepForward size={18} />
      </button>
      <button
        className="next-trade-button"
        onClick={onNextExecution}
        disabled={!canGoToNextExecution}
        title={canGoToNextExecution ? "跳至下一笔成交" : "没有尚未揭示的成交"}
        aria-label="跳至下一笔成交"
      >
        <SkipForward size={17} />
        下一成交
      </button>
      <span className="replay-phase" aria-live="polite">{playing ? "回放中" : !canGoForward ? "已到可用行情终点" : canGoBack ? "已暂停" : "准备回放"}</span>
      <div className="replay-divider" />
      <label className="speed-select">
        <span>速度</span>
        <select
          value={speed}
          onChange={(event) => onSpeedChange(Number(event.target.value))}
        >
          <option value={1200}>0.5×</option>
          <option value={700}>1×</option>
          <option value={350}>2×</option>
          <option value={160}>4×</option>
        </select>
      </label>
    </div>
  );
}
