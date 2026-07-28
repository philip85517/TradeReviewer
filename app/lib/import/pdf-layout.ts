import type { PdfTextItem } from "./pdf-text";

export type PdfTextRow = {
  /** Canvas-space baseline; smaller values are visually nearer the page top. */
  y: number;
  items: PdfTextItem[];
};

function visualLineTolerance(items: readonly PdfTextItem[]): number {
  const positiveHeights = items
    .map((item) => item.height)
    .filter((height) => Number.isFinite(height) && height > 0);
  const smallestHeight =
    positiveHeights.length > 0 ? Math.min(...positiveHeights) : 4;

  return Math.max(0.5, smallestHeight / 4);
}

function itemsInVisualOrder(items: readonly PdfTextItem[]): PdfTextItem[] {
  const tolerance = visualLineTolerance(items);
  const lines: Array<{
    y: number;
    yTotal: number;
    items: PdfTextItem[];
  }> = [];

  for (const item of [...items].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  )) {
    const line = lines.find(
      (candidate) => Math.abs(candidate.y - item.y) <= tolerance,
    );

    if (line) {
      line.items.push(item);
      line.yTotal += item.y;
      line.y = line.yTotal / line.items.length;
    } else {
      lines.push({ y: item.y, yTotal: item.y, items: [item] });
    }
  }

  return lines.flatMap((line) =>
    line.items.sort((left, right) => left.x - right.x),
  );
}

export function groupItemsIntoRows(
  items: readonly PdfTextItem[],
  tolerance: number,
): PdfTextRow[] {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new RangeError("Row tolerance must be a non-negative number.");
  }

  const rows: Array<PdfTextRow & { yTotal: number }> = [];
  const orderedItems = [...items].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  );

  for (const item of orderedItems) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);

    if (row) {
      row.items.push(item);
      row.yTotal += item.y;
      row.y = row.yTotal / row.items.length;
    } else {
      rows.push({ y: item.y, yTotal: item.y, items: [item] });
    }
  }

  return rows.map(({ y, items: rowItems }) => ({
    y,
    items: itemsInVisualOrder(rowItems),
  }));
}

export function cellsForColumns(
  row: PdfTextRow,
  boundaries: readonly number[],
): string[] {
  if (
    boundaries.length < 2 ||
    boundaries.some(
      (boundary, index) =>
        !Number.isFinite(boundary) ||
        (index > 0 && boundary <= boundaries[index - 1]),
    )
  ) {
    throw new RangeError("Column boundaries must be finite and increasing.");
  }

  const cells = Array.from({ length: boundaries.length - 1 }, () => [] as string[]);

  for (const item of itemsInVisualOrder(row.items)) {
    const columnIndex = boundaries.findIndex(
      (boundary, index) =>
        index < boundaries.length - 1 &&
        item.x >= boundary &&
        item.x < boundaries[index + 1],
    );

    if (columnIndex >= 0) {
      const text = item.text.trim();
      if (text) {
        cells[columnIndex].push(text);
      }
    }
  }

  return cells.map((parts) => parts.join(" "));
}
