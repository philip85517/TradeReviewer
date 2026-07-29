import type { NormalizedDrawing } from "./drawings";
import type { Timeframe } from "../market/types";

export type DrawingHistory = {
  past: NormalizedDrawing[][];
  present: NormalizedDrawing[];
  future: NormalizedDrawing[][];
};

export type DrawingCommand =
  | { type: "add"; drawing: NormalizedDrawing }
  | { type: "replace"; drawing: NormalizedDrawing }
  | { type: "rename"; id: string; name: string }
  | { type: "toggle-hidden"; id: string }
  | { type: "toggle-locked"; id: string }
  | { type: "set-locked"; ids: string[]; locked: boolean }
  | { type: "move"; id: string; direction: "up" | "down" }
  | { type: "delete"; id: string }
  | { type: "clear-unlocked" };

function cloneDrawing(drawing: NormalizedDrawing): NormalizedDrawing {
  return {
    ...drawing,
    anchors: drawing.anchors.map((anchor) => ({ ...anchor })),
    style: { ...drawing.style },
    visibleOn:
      drawing.visibleOn === "all" ? "all" : [...drawing.visibleOn],
  };
}

function cloneDrawings(drawings: NormalizedDrawing[]) {
  return drawings.map(cloneDrawing);
}

function withZIndices(drawings: NormalizedDrawing[]) {
  return drawings.map((drawing, index) => ({ ...drawing, zIndex: index }));
}

function commit(history: DrawingHistory, next: NormalizedDrawing[]) {
  return {
    past: [...history.past.map(cloneDrawings), cloneDrawings(history.present)],
    present: cloneDrawings(withZIndices(next)),
    future: [],
  };
}

export function createDrawingHistory(
  drawings: NormalizedDrawing[] = [],
): DrawingHistory {
  return { past: [], present: cloneDrawings(withZIndices(drawings)), future: [] };
}

export function applyDrawingCommand(
  history: DrawingHistory,
  command: DrawingCommand,
): DrawingHistory {
  const present = history.present;
  if (command.type === "add") {
    return commit(history, [...present, command.drawing]);
  }

  if (command.type === "clear-unlocked") {
    const next = present.filter((drawing) => drawing.locked);
    return next.length === present.length ? history : commit(history, next);
  }

  if (command.type === "set-locked") {
    const ids = new Set(command.ids);
    const next = present.map((drawing) =>
      ids.has(drawing.id) && drawing.locked !== command.locked
        ? { ...drawing, locked: command.locked }
        : drawing,
    );
    return next.some((drawing, index) => drawing !== present[index])
      ? commit(history, next)
      : history;
  }

  const commandId =
    command.type === "replace" ? command.drawing.id : command.id;
  const index = present.findIndex((drawing) => drawing.id === commandId);
  if (index === -1) return history;
  const current = present[index];

  if (command.type === "replace") {
    if (current.locked) return history;
    const next = [...present];
    next[index] = { ...cloneDrawing(command.drawing), zIndex: current.zIndex };
    return commit(history, next);
  }
  if (command.type === "rename") {
    const next = [...present];
    next[index] = { ...current, name: command.name };
    return commit(history, next);
  }
  if (command.type === "toggle-hidden") {
    const next = [...present];
    next[index] = { ...current, hidden: !current.hidden };
    return commit(history, next);
  }
  if (command.type === "toggle-locked") {
    const next = [...present];
    next[index] = { ...current, locked: !current.locked };
    return commit(history, next);
  }
  if (command.type === "delete") {
    return current.locked ? history : commit(history, present.filter((drawing) => drawing.id !== command.id));
  }

  const target = command.direction === "up" ? index + 1 : index - 1;
  if (target < 0 || target >= present.length) return history;
  const next = [...present];
  [next[index], next[target]] = [next[target], next[index]];
  return commit(history, next);
}

export function undoDrawingCommand(history: DrawingHistory): DrawingHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1).map(cloneDrawings),
    present: cloneDrawings(previous),
    future: [cloneDrawings(history.present), ...history.future.map(cloneDrawings)],
  };
}

export function redoDrawingCommand(history: DrawingHistory): DrawingHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past.map(cloneDrawings), cloneDrawings(history.present)],
    present: cloneDrawings(next),
    future: history.future.slice(1).map(cloneDrawings),
  };
}

function knowledgeVisibleDrawings(
  drawings: NormalizedDrawing[],
  cursor: string,
  timeframe: Timeframe,
) {
  return drawings.filter(
    (drawing) =>
      drawing.createdAtCursor <= cursor &&
      (drawing.visibleOn === "all" ||
        drawing.visibleOn.includes(timeframe)),
  );
}

function sameKnowledgeSnapshot(
  left: NormalizedDrawing[],
  right: NormalizedDrawing[],
  cursor: string,
  timeframe: Timeframe,
) {
  return (
    JSON.stringify(
      knowledgeVisibleDrawings(left, cursor, timeframe),
    ) ===
    JSON.stringify(
      knowledgeVisibleDrawings(right, cursor, timeframe),
    )
  );
}

export function canUndoDrawingAtCursor(
  history: DrawingHistory,
  cursor: string,
  timeframe: Timeframe,
) {
  const previous = history.past.at(-1);
  return Boolean(
    previous &&
      !sameKnowledgeSnapshot(
        previous,
        history.present,
        cursor,
        timeframe,
      ),
  );
}

export function canRedoDrawingAtCursor(
  history: DrawingHistory,
  cursor: string,
  timeframe: Timeframe,
) {
  const next = history.future[0];
  return Boolean(
    next &&
      !sameKnowledgeSnapshot(
        next,
        history.present,
        cursor,
        timeframe,
      ),
  );
}

export function undoDrawingAtCursor(
  history: DrawingHistory,
  cursor: string,
  timeframe: Timeframe,
) {
  return canUndoDrawingAtCursor(history, cursor, timeframe)
    ? undoDrawingCommand(history)
    : history;
}

export function redoDrawingAtCursor(
  history: DrawingHistory,
  cursor: string,
  timeframe: Timeframe,
) {
  return canRedoDrawingAtCursor(history, cursor, timeframe)
    ? redoDrawingCommand(history)
    : history;
}

export function setAllDrawingsLockedAtCursor(
  history: DrawingHistory,
  cursor: string,
  timeframe: Timeframe,
) {
  const drawings = knowledgeVisibleDrawings(
    history.present,
    cursor,
    timeframe,
  );
  if (drawings.length === 0) return history;
  const locked = !drawings.every((drawing) => drawing.locked);
  return applyDrawingCommand(history, {
    type: "set-locked",
    ids: drawings.map((drawing) => drawing.id),
    locked,
  });
}
