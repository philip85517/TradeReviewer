"use client";

import type { EpisodeReviewRecord } from "../../lib/reviews/types";
import { EpisodeNotesPanel, type EpisodeNotesProps } from "./episode-notes-panel";

type Props = Omit<EpisodeNotesProps, "onSave"> & {
  netPnl: string | null;
  onSave: (record: EpisodeReviewRecord) => void | Promise<void>;
};

/** Library and replay use one editing/saving contract. */
export function EpisodeReviewEditor({netPnl, onSave, ...props}: Props) {
  return <section className="episode-review-editor">
    <EpisodeNotesPanel {...props} netPnl={netPnl} onSave={async record => { await onSave(record); }} />
  </section>;
}
