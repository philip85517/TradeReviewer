import type { RecallDocument, RecallDocumentStatus, RecallDrawing } from "./types";

/** Homepage-only projection: never includes chart data, images or document bodies. */
export type RecallReviewSummary = {
  episodeId: string;
  status: RecallDocumentStatus;
  updatedAt: string;
  completedAt?: string;
  text: string;
  snapshotCount: number;
};

const EXCERPT_LENGTH = 160;

function lastText(drawings: readonly RecallDrawing[]): string {
  for (let index = drawings.length - 1; index >= 0; index--) {
    const drawing = drawings[index];
    if (drawing.tool !== "text" || typeof drawing.text !== "string") continue;
    const text = drawing.text.replace(/\s+/gu, " ").trim();
    if (text) return text;
  }
  return "";
}

/** Current saved work takes precedence; snapshots have their own update clocks. */
function recentText(document: RecallDocument): string {
  const working = document.working;
  const current = lastText(working.editingContext?.drawings ?? []) || lastText(working.drawings);
  if (current) return current;
  for (const draft of [...(working.decisionDrafts ?? [])].reverse()) {
    const text = lastText(draft.drawings);
    if (text) return text;
  }
  for (const snapshot of [...document.snapshots].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const text = lastText(snapshot.drawings);
    if (text) return text;
  }
  return "";
}

export function summarizeRecallDocument(document: RecallDocument): RecallReviewSummary {
  const text = recentText(document);
  const characters = Array.from(text);
  return {
    episodeId: document.episodeId,
    status: document.status,
    updatedAt: document.updatedAt,
    ...(document.completedAt === undefined ? {} : { completedAt: document.completedAt }),
    text: characters.length > EXCERPT_LENGTH
      ? `${characters.slice(0, EXCERPT_LENGTH - 1).join("")}…`
      : text,
    snapshotCount: document.snapshots.length,
  };
}
