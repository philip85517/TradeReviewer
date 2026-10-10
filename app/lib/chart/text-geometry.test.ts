import { describe, expect, it } from "vitest";

import {
  canvasTextFont,
  textCardGeometry,
  textCardLayout,
  textLayout,
} from "./text-geometry";

describe("text card geometry", () => {
  it("uses a canvas-valid font family while keeping the documented default size", () => {
    const font = canvasTextFont(14);

    expect(font).toContain("14px");
    expect(font).not.toContain("var(");
    expect(font).toContain("sans-serif");
  });

  it("collapses long text without changing the stored full layout", () => {
    const collapsed = textCardLayout("第一行\n第二行\n第三行\n第四行", 180, 14, 640);
    const expanded = textCardLayout("第一行\n第二行\n第三行\n第四行", 180, 14, 640, true);

    expect(collapsed.canExpand).toBe(true);
    expect(collapsed.lines).toHaveLength(2);
    expect(collapsed.fullLines).toHaveLength(4);
    expect(collapsed.height).toBeLessThan(collapsed.fullHeight);
    expect(expanded.lines).toHaveLength(4);
    expect(expanded.height).toBe(expanded.fullHeight);
  });

  it("clamps a card to the plot while keeping its connector endpoint on the original anchor", () => {
    const geometry = textCardGeometry(
      { x: 620, y: 240 },
      { x: 700, y: 260 },
      { width: 180, height: 44 },
      640,
      360,
    );

    expect(geometry.x + geometry.width).toBeLessThanOrEqual(640);
    expect(geometry.y + geometry.height).toBeLessThanOrEqual(360);
    expect(geometry.anchor).toEqual({ x: 620, y: 240 });
    expect(geometry.connectorEnd).toEqual({ x: 620, y: 240 });
    expect(geometry.connectorStart).not.toEqual(geometry.connectorEnd);
  });

  it("keeps CJK glyphs inside the card and bounds expanded content to the plot", () => {
    const cjk = textLayout("一二三四五六七八九十百千", 172, 14, 640);
    const expanded = textCardLayout(
      "第一行\n第二行\n第三行\n第四行\n第五行\n第六行\n第七行",
      172,
      14,
      640,
      true,
      60,
      18,
      18,
    );
    const geometry = textCardGeometry(
      { x: 12, y: 12 },
      { x: 0, y: 0 },
      expanded,
      172,
      60,
    );

    expect(cjk.lines[0].length).toBeLessThan(12);
    expect(expanded.truncated).toBe(true);
    expect(expanded.fullLines.length).toBeGreaterThan(expanded.lines.length);
    expect(geometry.x + geometry.width).toBeLessThanOrEqual(172);
    expect(geometry.y + geometry.height).toBeLessThanOrEqual(60);
  });

  it("keeps closing CJK punctuation with a neighboring glyph when wrapping", () => {
    const layout = textLayout("一二三四五六七八九。下一句", 140, 14, 140);

    expect(layout.lines.some((line) => line.startsWith("。"))).toBe(false);
    expect(layout.lines.join("")).toBe("一二三四五六七八九。下一句");
  });
});
