"use client";

import { useCallback, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { Candle } from "../../lib/market/types";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import type { Instrument, TradeEpisode } from "../../lib/trades/types";
import { RecallWorkspace } from "../recall/recall-workspace";
import type { SearchableInstrument } from "../chart/instrument-search-popover";
import "./review-design-preview.css";

const settings: ChartSettings = { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" };
const availability = { "15m": { enabled: false, reason: "样板使用日线行情" }, "1h": { enabled: false, reason: "样板使用日线行情" }, "4h": { enabled: false, reason: "样板使用日线行情" }, "1D": { enabled: true }, "1W": { enabled: false, reason: "样板使用日线行情" } } as const;
const REVIEW_INDEX_HREF = "/design/review?index=1";

/** Keep full-page navigation behind a narrow seam so the async guard is testable. */
export const reviewDesignPreviewNavigation = {
  assign(href: string) {
    window.location.assign(href);
  },
};

export function ReviewDesignIndex({ revision, fixtureId }: { revision: number; fixtureId: string }) {
  return <main className="review-design-preview review-design-preview-index"><section><p className="review-design-preview-eyebrow">复盘设计样板</p><h1>样板索引</h1><p>隔离数据库中的真实 RecallWorkspace 样板。</p><div className="review-design-preview-index-row"><div><strong>合成回合 · {fixtureId}</strong><small>已加载草稿修订 {revision}</small></div><a href="/design/review">进入复盘</a></div></section></main>;
}

type Props = { variant: "baseline" | "recommended"; episode: TradeEpisode; candles: Candle[]; instrument: Instrument };

export function ReviewDesignPreview({ variant, episode, candles, instrument }: Props) {
  const [chartSettings, setChartSettings] = useState<ChartSettings>(settings);
  const [leaveGuard, setLeaveGuard] = useState<(() => Promise<boolean>) | null>(null);
  const navigationPendingRef = useRef(false);
  const searchable: SearchableInstrument = { id: instrument.id, name: instrument.name, symbol: instrument.symbol, market: instrument.market };
  const registerLeaveGuard = useCallback((guard: (() => Promise<boolean>) | null) => {
    setLeaveGuard(() => guard);
  }, []);
  const handleIndexClick = useCallback(async (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (navigationPendingRef.current) return;
    navigationPendingRef.current = true;
    try {
      const allowed = leaveGuard ? await leaveGuard() : true;
      if (allowed) reviewDesignPreviewNavigation.assign(REVIEW_INDEX_HREF);
    } finally {
      navigationPendingRef.current = false;
    }
  }, [leaveGuard]);
  const headerActions: ReactNode = <div className="review-design-preview-context"><span>合成样本</span><a href={REVIEW_INDEX_HREF} onClick={handleIndexClick}>样板索引</a></div>;
  const noOp = () => undefined;
  return <main className={`review-design-preview review-design-preview--${variant}`} data-variant={variant}>
    <RecallWorkspace episode={episode} episodes={[episode]} instrument={instrument} instruments={[searchable]} timeframeAvailability={availability} importedTimelineCandles={candles} candlesByTimeframe={{ "1D": candles }} settings={chartSettings} onEpisodeChange={noOp} onInstrumentChange={noOp} onSettingsChange={setChartSettings} onLeaveGuardChange={registerLeaveGuard} headerActions={headerActions} compactControls={variant === "recommended"} />
  </main>;
}
