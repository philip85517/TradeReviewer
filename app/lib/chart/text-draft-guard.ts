/**
 * Reasons a parent action may need to leave the text editor.  Keeping this
 * union in the chart layer gives ReplayChart and Recall a stable seam while
 * the editor continues to own the actual buffer and geometry.
 */
export type TextDraftIntentReason =
  | "escape"
  | "outside-click"
  | "tool-change"
  | "undo"
  | "redo"
  | "clear"
  | "lock"
  | "selection"
  | "phase-change"
  | "decision-change"
  | "timeframe-change"
  | "history-change"
  | "save"
  | "leave"
  | "capture";

export type TextDraftDecision = "complete" | "continue" | "discard";

/** Public handle consumed by chart actions before they change surrounding state. */
export type TextDraftPrepareHandle = {
  prepareTextDraft: (reason: TextDraftIntentReason) => Promise<boolean>;
};
