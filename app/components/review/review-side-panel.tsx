"use client";

import { PanelRightOpen, X } from "lucide-react";
import { useEffect, useRef } from "react";

import type { PositionPathMetrics } from "../../lib/replay/position-path-metrics";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";
import { useModalFocus } from "../import/use-modal-focus";
import { EpisodeNotesPanel } from "./episode-notes-panel";
import { PositionStatsPanel } from "./position-stats-panel";

const desktopReviewPanelQuery = "(min-width: 1260px)";

type Props = {
  instrumentLabel: string;
  currency: string;
  metrics: PositionPathMetrics;
  review?: EpisodeReviewRecord;
  episodeId: string;
  instrumentId: string;
  activeTab: "stats" | "notes";
  onActiveTabChange: (tab: "stats" | "notes") => void;
  onSaveReview: (record: EpisodeReviewRecord) => Promise<void>;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
};

function PanelContent(props: Props) {
  const statsId = `${props.episodeId}-stats`;
  const notesId = `${props.episodeId}-notes`;
  return <>
    <div className="review-side-panel-tabs" role="tablist" aria-label="复盘面板">
      <button role="tab" id={`${statsId}-tab`} aria-selected={props.activeTab === "stats"} aria-controls={statsId} onClick={() => props.onActiveTabChange("stats")}>路径统计</button>
      <button role="tab" id={`${notesId}-tab`} aria-selected={props.activeTab === "notes"} aria-controls={notesId} onClick={() => props.onActiveTabChange("notes")}>复盘笔记</button>
    </div>
    <div role="tabpanel" id={statsId} aria-labelledby={`${statsId}-tab`} hidden={props.activeTab !== "stats"}>
      <PositionStatsPanel instrumentLabel={props.instrumentLabel} currency={props.currency} metrics={props.metrics} plan={props.review?.plan} />
    </div>
    <div role="tabpanel" id={notesId} aria-labelledby={`${notesId}-tab`} hidden={props.activeTab !== "notes"}>
      <EpisodeNotesPanel episodeId={props.episodeId} instrumentId={props.instrumentId} record={props.review} onSave={props.onSaveReview} />
    </div>
  </>;
}

export function ReviewSidePanel(props: Props) {
  const { drawerOpen, onDrawerOpenChange } = props;
  const focusDesktopPanelRef = useRef(false);
  const dialogRef = useModalFocus(
    () => onDrawerOpenChange(false),
    drawerOpen,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const desktop = window.matchMedia(desktopReviewPanelQuery);
    const closeDrawerOnDesktop = (
      event: Pick<MediaQueryListEvent, "matches">,
    ) => {
      if (!event.matches || !drawerOpen) return;
      focusDesktopPanelRef.current = true;
      onDrawerOpenChange(false);
    };

    closeDrawerOnDesktop(desktop);
    desktop.addEventListener("change", closeDrawerOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeDrawerOnDesktop);
    };
  }, [drawerOpen, onDrawerOpenChange]);

  useEffect(() => {
    if (drawerOpen || !focusDesktopPanelRef.current) return;
    focusDesktopPanelRef.current = false;
    dialogRef.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.focus();
  }, [dialogRef, drawerOpen]);

  return <>
    <div className={props.drawerOpen ? "modal-backdrop review-side-panel-backdrop" : "review-side-panel-shell"}>
      <aside ref={dialogRef} className={`review-side-panel ${props.drawerOpen ? "review-side-panel-drawer" : "review-side-panel-desktop"}`} role={props.drawerOpen ? "dialog" : undefined} aria-modal={props.drawerOpen || undefined} aria-label={props.drawerOpen ? "复盘面板" : undefined}>
        <header hidden={!props.drawerOpen}><h2>复盘面板</h2><button type="button" aria-label="关闭复盘面板" onClick={() => props.onDrawerOpenChange(false)}><X size={18} /></button></header>
        <PanelContent {...props} />
      </aside>
    </div>
    <button className="review-side-panel-trigger" type="button" aria-label="打开复盘面板" onClick={() => props.onDrawerOpenChange(true)}><PanelRightOpen size={18} /></button>
  </>;
}
