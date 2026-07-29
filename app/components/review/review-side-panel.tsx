"use client";

import { PanelRightOpen, X } from "lucide-react";

import type { PositionPathMetrics } from "../../lib/replay/position-path-metrics";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";
import { useModalFocus } from "../import/use-modal-focus";
import { EpisodeNotesPanel } from "./episode-notes-panel";
import { PositionStatsPanel } from "./position-stats-panel";

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
  return <><div className="review-side-panel-tabs" role="tablist" aria-label="复盘面板"><button role="tab" id={`${statsId}-tab`} aria-selected={props.activeTab === "stats"} aria-controls={statsId} onClick={() => props.onActiveTabChange("stats")}>路径统计</button><button role="tab" id={`${notesId}-tab`} aria-selected={props.activeTab === "notes"} aria-controls={notesId} onClick={() => props.onActiveTabChange("notes")}>复盘笔记</button></div><div role="tabpanel" id={props.activeTab === "stats" ? statsId : notesId} aria-labelledby={`${props.activeTab === "stats" ? statsId : notesId}-tab`}>{props.activeTab === "stats" ? <PositionStatsPanel instrumentLabel={props.instrumentLabel} currency={props.currency} metrics={props.metrics} plannedRiskAmount={props.review?.plan.plannedRiskAmount} /> : <EpisodeNotesPanel episodeId={props.episodeId} instrumentId={props.instrumentId} record={props.review} onSave={props.onSaveReview} />}</div></>;
}

function Drawer({ props }: { props: Props }) {
  const dialogRef = useModalFocus(() => props.onDrawerOpenChange(false));
  return <div className="modal-backdrop review-side-panel-backdrop"><aside ref={dialogRef} className="review-side-panel review-side-panel-drawer" role="dialog" aria-modal="true" aria-label="复盘面板"><header><h2>复盘面板</h2><button type="button" aria-label="关闭复盘面板" onClick={() => props.onDrawerOpenChange(false)}><X size={18} /></button></header><PanelContent {...props} /></aside></div>;
}

export function ReviewSidePanel(props: Props) {
  return <>{props.drawerOpen ? <Drawer props={props} /> : <aside className="review-side-panel review-side-panel-desktop"><PanelContent {...props} /></aside>}<button className="review-side-panel-trigger" type="button" aria-label="打开复盘面板" onClick={() => props.onDrawerOpenChange(true)}><PanelRightOpen size={18} /></button></>;
}
