import type { PdfTextItem } from "./pdf-text";
import type { PdfTextRow } from "./pdf-layout";

export type PdfColumn = {
  key: string;
  labels: readonly string[];
  kind: "text" | "number";
  joinWith?: string;
};
export type PdfTableLayout = Array<PdfColumn & { x: number; right: number }>;

function fragments(item: PdfTextItem): PdfTextItem[] {
  return [...item.text.matchAll(/\S+/g)].map((match) => ({
    ...item,
    text: match[0],
    x: item.x + (item.width * match.index) / item.text.length,
    width: (item.width * match[0].length) / item.text.length,
  }));
}

/** Locate semantic headers even when a label is split across PDF text items. */
export function locatePdfColumns(
  row: PdfTextRow,
  schema: readonly PdfColumn[],
): PdfTableLayout | null {
  const characters = row.items.flatMap((item) =>
    [...item.text].flatMap((text, index) =>
      /\s/.test(text)
        ? []
        : [
            {
              text,
              x: item.x + (item.width * index) / item.text.length,
              right: item.x + (item.width * (index + 1)) / item.text.length,
            },
          ],
    ),
  );
  const text = characters.map((item) => item.text).join("");
  const columns: PdfTableLayout = [];
  for (const column of schema) {
    const label = column.labels.find((label) => text.includes(label));
    if (!label) return null;
    const start = text.indexOf(label);
    columns.push({
      ...column,
      x: characters[start].x,
      right: characters[start + label.length - 1].right,
    });
  }
  return columns.sort((a, b) => a.x - b.x);
}

function coalesceFragments(
  items: readonly PdfTextItem[],
  canJoin: (left: PdfTextItem, right: PdfTextItem) => boolean = () => true,
): PdfTextItem[] {
  const merged: PdfTextItem[] = [];
  for (const item of items.flatMap(fragments)) {
    const previous = merged.at(-1);
    const gap = previous ? item.x - previous.x - previous.width : Infinity;
    const tolerance =
      Math.min(previous?.height ?? item.height, item.height) / 4;
    if (previous && Math.abs(gap) <= tolerance && canJoin(previous, item)) {
      previous.text += item.text;
      previous.width = item.x + item.width - previous.x;
    } else merged.push({ ...item });
  }
  return merged;
}

/** Use header-derived alignment anchors, never page coordinates or column offsets. */
export function readPdfCells(
  row: PdfTextRow,
  layout: PdfTableLayout,
): Record<string, string> {
  const cells = Object.fromEntries(
    layout.map((column) => [column.key, [] as PdfTextItem[]]),
  );
  // Reassemble numeric runs before measuring their right edge: a long negative
  // amount can start left of the midpoint separating it from the previous fee.
  // Text header starts remain barriers (e.g. adjacent date and market columns).
  const tokens = coalesceFragments(
    row.items,
    (left, right) =>
      /^[+\-\d,.]+$/.test(left.text) &&
      /^[+\-\d,.]+$/.test(right.text) &&
      !layout.some(
        (column) =>
          column.kind === "text" && column.x > left.x && column.x <= right.x,
      ),
  );
  for (const item of tokens) {
    // Text columns are left aligned, number columns right aligned. Restrict a
    // token to the spatial neighbourhood first so an account number remains text.
    const candidates = layout.filter((column, index) => {
      const previous = layout[index - 1];
      const next = layout[index + 1];
      const tolerance = item.height / 4;
      const left = !previous
        ? -Infinity
        : column.kind === "text"
          ? column.x - tolerance
          : (previous.right + column.x) / 2;
      const right = !next
        ? Infinity
        : column.kind === "text"
          ? next.x - tolerance
          : (column.right + next.x) / 2;
      const anchor = column.kind === "number" ? item.x + item.width : item.x;
      return anchor >= left && anchor < right;
    });
    const column = candidates.sort((a, b) => {
      const distance = (column: PdfTableLayout[number]) =>
        Math.abs(
          column.kind === "number"
            ? item.x + item.width - column.right
            : item.x - column.x,
        );
      return distance(a) - distance(b);
    })[0];
    if (column) cells[column.key].push(item);
  }
  return Object.fromEntries(
    layout.map((column) => [
      column.key,
      coalesceFragments(cells[column.key])
        .map((item) => item.text)
        .join(column.joinWith ?? (column.kind === "number" ? "" : " ")),
    ]),
  );
}
