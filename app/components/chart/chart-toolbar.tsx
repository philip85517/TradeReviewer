"use client";

/* eslint-disable jsx-a11y/role-supports-aria-props -- aria-description carries the unavailable-control reason required by the toolbar contract. */

import {
  ChevronDown,
  CloudOff,
  Layers3,
  Maximize2,
  Search,
  Settings,
} from "lucide-react";
import { useRef, useState } from "react";

import type { TimeframeAvailability } from "../../lib/market/availability";
import type { Timeframe } from "../../lib/market/types";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import { ChartSettingsPopover } from "./chart-settings-popover";
import {
  InstrumentSearchPopover,
  type SearchableInstrument,
} from "./instrument-search-popover";
import { MarketDataPopover, type MarketDataDetails } from "./market-data-popover";
import type { useFullscreen } from "./use-fullscreen";

const timeframes: Array<{ value: Timeframe; label: string }> = [
  { value: "15m", label: "15m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
];

type Props = {
  timeframe: Timeframe;
  timeframeAvailability: TimeframeAvailability;
  onTimeframeChange: (timeframe: Timeframe) => void;
  instruments: SearchableInstrument[];
  onSelectInstrument: (instrumentId: string) => void;
  dataDetails: MarketDataDetails[];
  onRefreshMarketData: (() => void) | undefined;
  refreshDisabledReason: string | undefined;
  layersOpen: boolean;
  layersDisabledReason: string | undefined;
  onToggleLayers: () => void;
  fullscreen: ReturnType<typeof useFullscreen>;
  settings: ChartSettings;
  onSettingsChange: (settings: ChartSettings) => void;
  symbol: string;
  instrumentName: string;
  market: string;
};

export function ChartToolbar({
  timeframe,
  timeframeAvailability,
  onTimeframeChange,
  instruments,
  onSelectInstrument,
  dataDetails,
  onRefreshMarketData,
  refreshDisabledReason,
  layersOpen,
  layersDisabledReason,
  onToggleLayers,
  fullscreen,
  settings,
  onSettingsChange,
  symbol,
  instrumentName,
  market,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const dataTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const availability = timeframeAvailability;
  const fullscreenDisabledReason = fullscreen.supported
    ? undefined
    : "浏览器不支持全屏";
  const displayedFullscreenError = fullscreen.error ?? fullscreenError;

  return (
    <div className="chart-toolbar" aria-label="图表工具栏">
      <div className="symbol-control">
        <div className="symbol-avatar">{symbol.slice(0, 1)}</div>
        <div>
          <strong>{symbol}</strong>
          <span>{instrumentName} · {market}</span>
        </div>
        <ChevronDown size={14} />
      </div>
      <button
        className="icon-button"
        aria-label="搜索标的"
        aria-expanded={searchOpen}
        aria-haspopup="dialog"
        ref={searchTriggerRef}
        onClick={() => {
          setDataOpen(false);
          setSettingsOpen(false);
          setSearchOpen((open) => !open);
        }}
      >
        <Search size={17} />
      </button>
      <div className="toolbar-divider" />
      <div className="timeframe-group" aria-label="K 线周期">
        {timeframes.map((item) => {
          const currentAvailability = availability[item.value];
          const disabledReason = currentAvailability.reason;
          return (
            <button
              key={item.value}
              className={timeframe === item.value ? "active" : ""}
              aria-label={`切换到 ${item.value}`}
              aria-description={disabledReason}
              title={disabledReason}
              disabled={!currentAvailability.enabled}
              onClick={() => onTimeframeChange(item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="toolbar-spacer" />
      <button
        className="local-data-badge"
        aria-label="行情数据详情"
        aria-expanded={dataOpen}
        aria-haspopup="dialog"
        ref={dataTriggerRef}
        onClick={() => {
          setSearchOpen(false);
          setSettingsOpen(false);
          setDataOpen((open) => !open);
        }}
      >
        <CloudOff size={14} />
        本地数据
      </button>
      <button
        className={`icon-button${layersOpen ? " active" : ""}`}
        aria-label="图层"
        aria-expanded={layersOpen}
        aria-pressed={layersOpen}
        disabled={Boolean(layersDisabledReason)}
        title={layersDisabledReason}
        aria-description={layersDisabledReason}
        onClick={onToggleLayers}
      >
        <Layers3 size={17} />
      </button>
      <button
        className={`icon-button${fullscreen.isFullscreen ? " active" : ""}`}
        aria-label="全屏"
        aria-pressed={fullscreen.isFullscreen}
        disabled={!fullscreen.supported}
        title={fullscreenDisabledReason}
        aria-description={fullscreenDisabledReason}
        onClick={() => {
          setFullscreenError(null);
          void fullscreen.toggleFullscreen().catch(() => {
            setFullscreenError("无法切换全屏");
          });
        }}
      >
        <Maximize2 size={17} />
      </button>
      {displayedFullscreenError ? <span className="toolbar-status" role="status">{displayedFullscreenError}</span> : null}
      <button
        className="icon-button"
        aria-label="图表设置"
        aria-expanded={settingsOpen}
        aria-haspopup="dialog"
        ref={settingsTriggerRef}
        onClick={() => {
          setSearchOpen(false);
          setDataOpen(false);
          setSettingsOpen((open) => !open);
        }}
      >
        <Settings size={17} />
      </button>
      <InstrumentSearchPopover
        open={searchOpen}
        instruments={instruments}
        onClose={() => setSearchOpen(false)}
        onSelectInstrument={onSelectInstrument}
        triggerRef={searchTriggerRef}
      />
      <MarketDataPopover
        open={dataOpen}
        details={dataDetails}
        onClose={() => setDataOpen(false)}
        onRefresh={onRefreshMarketData}
        refreshDisabledReason={refreshDisabledReason}
        triggerRef={dataTriggerRef}
      />
      <ChartSettingsPopover
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSettingsChange={onSettingsChange}
        triggerRef={settingsTriggerRef}
      />
    </div>
  );
}
