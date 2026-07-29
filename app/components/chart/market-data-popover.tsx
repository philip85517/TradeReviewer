"use client";

import { useEffect, useId, useRef, type RefObject } from "react";

import type { NativeMarketInterval } from "../../lib/market/contracts";
import type { Timeframe } from "../../lib/market/types";
import {
  marketDataStatusLabel,
  type MarketDataSyncStatus,
} from "../../lib/market/sync-status";

export type MarketDataDetails = {
  providerLabel: string | null;
  nativeInterval: NativeMarketInterval;
  coverageStart?: string;
  coverageEnd?: string;
  fetchedAt?: string;
  status: MarketDataSyncStatus;
  limitationReason?: string;
  availableTimeframes: Timeframe[];
};

type Props = {
  open: boolean;
  details: MarketDataDetails[];
  onClose: () => void;
  onRefresh?: () => void;
  refreshDisabledReason: string | undefined;
  triggerRef?: RefObject<HTMLElement | null>;
};

function coverageLabel(detail: MarketDataDetails) {
  if (detail.coverageStart && detail.coverageEnd) {
    return `${detail.coverageStart} 至 ${detail.coverageEnd}`;
  }
  if (detail.status === "not-requested") return "尚未请求行情，暂无实际覆盖区间";
  if (detail.status === "syncing") return "正在请求行情，暂无实际覆盖区间";
  if (detail.status === "complete" || detail.status === "ready") {
    return "请求已完成，但没有可用的行情数据";
  }
  if (detail.status === "partial" || detail.status === "stale") {
    return "请求已完成，但没有可用的实际覆盖区间";
  }
  return "行情请求未能完成，暂无实际覆盖区间";
}

export function MarketDataPopover({
  open,
  details,
  onClose,
  onRefresh,
  refreshDisabledReason,
  triggerRef,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const refreshReasonId = useId();
  const close = () => {
    onClose();
    triggerRef?.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popoverRef.current?.contains(target) && !triggerRef?.current?.contains(target)) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  });

  if (!open) return null;
  const visibleDetails: MarketDataDetails[] = details.length > 0
    ? details
    : [{
        providerLabel: null,
        nativeInterval: "1D",
        status: "not-requested",
        availableTimeframes: [],
      }];

  return (
    <div className="chart-popover market-data-popover" ref={popoverRef} role="dialog" aria-label="行情数据详情">
      <div className="popover-heading">
        <strong>行情数据详情</strong>
        {onRefresh ? (
          <button
            type="button"
            disabled={Boolean(refreshDisabledReason)}
            title={refreshDisabledReason}
            aria-describedby={
              refreshDisabledReason ? refreshReasonId : undefined
            }
            onClick={onRefresh}
          >
            刷新行情数据
          </button>
        ) : null}
        {refreshDisabledReason ? (
          <span id={refreshReasonId} className="toolbar-status">
            {refreshDisabledReason}
          </span>
        ) : null}
      </div>
      {visibleDetails.map((detail) => {
        const coverage = coverageLabel(detail);
        return (
          <section className="market-data-detail" key={detail.nativeInterval} aria-label={`${detail.nativeInterval} 行情详情`}>
            <strong>{detail.nativeInterval}</strong>
            <dl>
              <div><dt>来源</dt><dd>{detail.providerLabel ?? "未连接行情源"}</dd></div>
              <div><dt>实际覆盖</dt><dd>{coverage}</dd></div>
              <div><dt>获取时间</dt><dd>{detail.fetchedAt ?? "尚未获取"}</dd></div>
              <div><dt>状态</dt><dd>{marketDataStatusLabel(detail.status)}</dd></div>
              <div><dt>可用周期</dt><dd>{detail.availableTimeframes.length > 0 ? detail.availableTimeframes.join("、") : "暂无"}</dd></div>
              {detail.limitationReason ? <div><dt>周期限制</dt><dd>{detail.limitationReason}</dd></div> : null}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
