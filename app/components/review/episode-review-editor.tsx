"use client";

import { calculateRMultiple } from "../../lib/reviews/review-metrics";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";
import { EpisodeNotesPanel, type EpisodeNotesProps } from "./episode-notes-panel";

type Props = Omit<EpisodeNotesProps, "onSave"> & {
  netPnl: string | null;
  onSave: (record: EpisodeReviewRecord) => void | Promise<void>;
};

/** Library and replay use one editing/saving contract. */
export function EpisodeReviewEditor({netPnl, onSave, ...props}: Props) {
  const r = calculateRMultiple({netPnl}, props.record?.plan.plannedRiskAmount ?? "");
  return <section className="episode-review-editor">
    {r !== null && <span className="episode-r-preview">{r}R</span>}
    <EpisodeNotesPanel {...props} onSave={async record => { await onSave(record); }} />
  </section>;
}
