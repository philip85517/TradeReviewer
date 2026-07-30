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

  it("orders canvas-coordinate rows from visual top to bottom", () => {
    const rows = groupItemsIntoRows(
      [
        { text: "页脚", x: 20, y: 700, width: 30, height: 10 },
        { text: "表头", x: 20, y: 100, width: 30, height: 10 },
      ],
      1,
    );

    expect(rows.map((row) => row.items[0].text)).toEqual(["表头", "页脚"]);
  });

  it("assigns wrapped items to stable table columns", () => {
    const [row] = groupItemsIntoRows(
      [
        { text: "小米", x: 20, y: 490, width: 45, height: 10 },
        { text: "集团-W", x: 80, y: 490, width: 55, height: 10 },
        { text: "01810", x: 20, y: 500, width: 35, height: 10 },
        { text: "开仓", x: 220, y: 490, width: 30, height: 10 },
        { text: "做空", x: 260, y: 490, width: 30, height: 10 },
        { text: "-800", x: 380, y: 490, width: 30, height: 10 },
      ],
      12,
    );

    expect(cellsForColumns(row, [0, 200, 350, 500])).toEqual([
      "小米 集团-W 01810",
      "开仓 做空",
      "-800",
    ]);
  });
});
