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
        aria-label="上一根 K 线"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        className="play-button"
        onClick={onTogglePlay}
        disabled={!canGoForward}
        aria-label={playing ? "暂停回放" : "开始回放"}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button
        className="control-button"
        onClick={onNext}
        disabled={!canGoForward}
        aria-label="下一根 K 线"
      >
        <StepForward size={18} />
      </button>
      <button
        className="next-trade-button"
        onClick={onNextExecution}
        disabled={!canGoForward}
        aria-label="跳至下一笔成交"
      >
        <SkipForward size={17} />
        下一成交
      </button>
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
