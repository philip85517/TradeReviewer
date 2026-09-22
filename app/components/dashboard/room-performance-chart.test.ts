import { describe, expect, it } from "vitest";

import {
  chartLinePath,
  chartAxisLabels,
  chartPointCoordinates,
  createChartGeometry,
  valueDomain,
} from "./room-performance-chart";

describe("room performance chart geometry", () => {
  it("preserves null gaps instead of drawing a segment through missing values", () => {
    const geometry = createChartGeometry();
    const domain = valueDomain(["-10", null, "20"]);

    expect(chartLinePath([{ value: "-10" }, { value: null }, { value: "20" }], geometry, domain)).toContain("M");
    expect(chartLinePath([{ value: "-10" }, { value: null }, { value: "20" }], geometry, domain)).toMatch(/M[^M]+M/);
  });

  it("keeps point coordinates indexed so null values cannot shift details", () => {
    const geometry = createChartGeometry();
    const coordinates = chartPointCoordinates([{ value: null }, { value: "10" }], geometry, valueDomain([null, "10"]));

    expect(coordinates).toEqual([{ index: 1, x: expect.any(Number), y: expect.any(Number), value: "10" }]);
    expect(coordinates[0].x).toBeGreaterThan(geometry.padding.left);
    expect(coordinates[0].x).toBeLessThanOrEqual(geometry.width - geometry.padding.right);
  });

  it("can sample fewer axis labels for narrow chart widths", () => {
    const geometry = createChartGeometry({ width: 164, height: 190 });
    const points = [
      { key: "a", label: "2026年9月（覆盖09-01至09-07）" },
      { key: "b", label: "2026年9月（覆盖09-08至09-14）" },
      { key: "c", label: "2026年9月（覆盖09-15至09-21）" },
    ];

    expect(chartAxisLabels(points, geometry, 2)).toHaveLength(2);
  });
});
