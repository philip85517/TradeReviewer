import type { PdfTextItem } from "./pdf-text";

export type PdfTextRow = {
  y: number;
  items: PdfTextItem[];
};

export function groupItemsIntoRows(
  items: readonly PdfTextItem[],
  tolerance: number,
): PdfTextRow[] {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new RangeError("Row tolerance must be a non-negative number.");
  }

  const rows: Array<PdfTextRow & { yTotal: number }> = [];
  const orderedItems = [...items].sort(
    (left, right) => right.y - left.y || left.x - right.x,
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
    items: rowItems.sort(
      (left, right) => left.x - right.x || right.y - left.y,
    ),
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

  for (const item of row.items) {
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
