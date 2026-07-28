import { describe, expect, it } from "vitest";

import { cellsForColumns, groupItemsIntoRows } from "./pdf-layout";

describe("PDF table layout helpers", () => {
  it("groups text items by y and sorts cells from left to right", () => {
    const rows = groupItemsIntoRows(
      [
        { text: "买入", x: 300, y: 500, width: 20, height: 10 },
        { text: "00700", x: 100, y: 500.4, width: 30, height: 10 },
        { text: "100", x: 400, y: 500.2, width: 20, height: 10 },
      ],
      1,
    );

    expect(rows[0].items.map((item) => item.text)).toEqual([
      "00700",
      "买入",
      "100",
    ]);
  });

  it("assigns wrapped items to stable table columns", () => {
    const [row] = groupItemsIntoRows(
      [
        { text: "小米集团-W", x: 20, y: 500, width: 80, height: 10 },
        { text: "01810", x: 20, y: 490, width: 35, height: 10 },
        { text: "开仓做空", x: 220, y: 500, width: 60, height: 10 },
        { text: "-800", x: 380, y: 500, width: 30, height: 10 },
      ],
      12,
    );

    expect(cellsForColumns(row, [0, 200, 350, 500])).toEqual([
      "小米集团-W 01810",
      "开仓做空",
      "-800",
    ]);
  });
});
