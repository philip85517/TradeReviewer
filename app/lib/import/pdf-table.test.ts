import { describe, it, expect } from "vitest";
import { locatePdfColumns, readPdfCells, type PdfColumn } from "./pdf-table";
import type { PdfTextItem } from "./pdf-text";
const item = (text: string, x: number, width: number): PdfTextItem => ({
  text,
  x,
  width,
  y: 10,
  height: 8,
});
const schema: PdfColumn[] = [
  { key: "symbol", labels: ["证券代码", "代码"], kind: "text" },
  { key: "amount", labels: ["金额"], kind: "number" },
  { key: "fee", labels: ["费用"], kind: "number" },
];
describe("semantic PDF columns", () => {
  it("uses reordered header aliases and leaves empty cells empty", () => {
    const header = {
      y: 10,
      items: [
        item("费用", 20, 20),
        item("代", 100, 10),
        item("码", 110, 10),
        item("金额", 200, 20),
      ],
    };
    const layout = locatePdfColumns(header, schema);
    expect(layout).not.toBeNull();
    expect(
      readPdfCells(
        { y: 20, items: [item("001234", 100, 30), item("1,230.50", 180, 40)] },
        layout!,
      ),
    ).toEqual({ symbol: "001234", amount: "1,230.50", fee: "" });
  });
  it("does not accept a table missing a required semantic header", () => {
    expect(
      locatePdfColumns(
        { y: 10, items: [item("证券代码", 20, 40), item("金额", 100, 20)] },
        schema,
      ),
    ).toBeNull();
  });
});
