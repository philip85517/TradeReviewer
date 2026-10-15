import { describe, expect, it } from "vitest";

import {
  canvasTextFont,
  chooseAvailableControlPlacement,
  chooseAvailableControlRect,
  chooseJointControlPlacements,
  textCardControlObstacles,
  textCardGeometry,
  textCardLayout,
  textLayout,
  resolveTextCardGeometries,
} from "./text-geometry";

describe("text card geometry", () => {
  it("uses a canvas-valid font family while keeping the documented default size", () => {
    const font = canvasTextFont(14);

    expect(font).toContain("14px");
    expect(font).not.toContain("var(");
    expect(font).toContain("sans-serif");
  });

  it("supports the regular body weight without changing legacy label defaults", () => {
    expect(canvasTextFont(14, 400)).toContain("400 14px");
    expect(canvasTextFont(11)).toContain("600 11px");
  });

  it("collapses long text without changing the stored full layout", () => {
    const collapsed = textCardLayout("第一行\n第二行\n第三行\n第四行", 180, 14, 640, false, Number.POSITIVE_INFINITY, 0, 0, true);
    const expanded = textCardLayout("第一行\n第二行\n第三行\n第四行", 180, 14, 640, true, Number.POSITIVE_INFINITY, 0, 0, true);

    expect(collapsed.canExpand).toBe(true);
    expect(collapsed.lines).toHaveLength(2);
    expect(collapsed.fullLines).toHaveLength(4);
    expect(collapsed.height).toBeLessThan(collapsed.fullHeight);
    expect(expanded.lines).toHaveLength(4);
    expect(expanded.height).toBe(expanded.fullHeight);
  });

  it("preserves the legacy long-card collapse when fold is not explicitly enabled", () => {
    const collapsed = textCardLayout("第一行\n第二行\n第三行\n第四行", 180, 14, 640, false);
    const expanded = textCardLayout("第一行\n第二行\n第三行\n第四行", 180, 14, 640, true);

    expect(collapsed.canExpand).toBe(true);
    expect(collapsed.collapsed).toBe(true);
    expect(collapsed.lines).toHaveLength(2);
    expect(collapsed.fullLines).toHaveLength(4);
    expect(expanded.lines).toHaveLength(4);
  });

  it("supports an explicit compact fold for a complete two-line card", () => {
    const collapsed = textCardLayout("第一行\n第二行", 180, 14, 640, false, Number.POSITIVE_INFINITY, 0, 0, true);
    const expanded = textCardLayout("第一行\n第二行", 180, 14, 640, true, Number.POSITIVE_INFINITY, 0, 0, true);

    expect(collapsed.canExpand).toBe(true);
    expect(collapsed.collapsed).toBe(true);
    expect(collapsed.lines).toEqual(["第一行…"]);
    expect(collapsed.height).toBeLessThan(expanded.height);
    expect(collapsed.fullLines).toEqual(["第一行", "第二行"]);
    expect(expanded.lines).toEqual(expanded.fullLines);
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

  it("attaches an inside anchor to the nearest card edge", () => {
    const geometry = textCardGeometry(
      { x: 10, y: 20 },
      { x: 10, y: 10 },
      { width: 92, height: 60 },
      100,
      100,
    );

    expect(geometry.connectorEnd).toEqual({ x: 10, y: 20 });
    expect(geometry.connectorStart).toEqual({ x: 4, y: 20 });
  });

  it("keeps an outside anchor on the nearest card boundary", () => {
    const geometry = textCardGeometry(
      { x: 2, y: 20 },
      { x: 20, y: 20 },
      { width: 40, height: 30 },
      100,
      100,
    );

    expect(geometry.connectorStart).toEqual({ x: 20, y: 20 });
    expect(geometry.connectorEnd).toEqual({ x: 2, y: 20 });
  });

  it("nudges a boundary corner attachment along the card edge", () => {
    const geometry = textCardGeometry(
      { x: 4, y: 4 },
      { x: 4, y: 4 },
      { width: 40, height: 30 },
      100,
      100,
    );

    expect(geometry.connectorEnd).toEqual({ x: 4, y: 4 });
    expect(geometry.connectorStart).toEqual({ x: 8, y: 4 });
  });

  it("keeps a degenerate tiny plot bounded when no edge nudge fits", () => {
    const geometry = textCardGeometry(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { width: 1, height: 1 },
      1,
      1,
    );

    expect(geometry).toMatchObject({ x: 0, y: 0, width: 1, height: 1 });
    expect(geometry.connectorStart).toEqual(geometry.connectorEnd);
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

  it("keeps the full body width separate from the bottom operation reserve", () => {
    const layout = textCardLayout(
      "回撤后观察承接，站回 56 再考虑做多。\n跌破 52 则结构失效。",
      300,
      14,
      300,
      true,
      240,
      44,
      44,
    );

    expect(layout.fullLines[0]).toBe("回撤后观察承接，站回 56 再考虑做多。");
    expect(layout.fullLines).not.toContain("多。");
    expect(layout.height - 8 - 44).toBe(layout.lines.length * layout.lineHeight);
    expect(layout.fullHeight).toBe(layout.fullLines.length * layout.lineHeight + 8 + 44);

    const coarse = textCardLayout(
      "回撤后观察承接，站回 56 再考虑做多。\n跌破 52 则结构失效。",
      300,
      14,
      300,
      true,
      240,
      36,
      44,
    );
    expect(coarse.fullLines).toEqual(layout.fullLines);
    expect(coarse.fullHeight).toBe(layout.fullHeight);
  });

  it("chooses the first control candidate clear of a measured chart obstacle", () => {
    const result = chooseAvailableControlRect(
      [
        { left: 398, top: 378, right: 422, bottom: 402 },
        { left: 398, top: 326, right: 422, bottom: 350 },
      ],
      [{ id: "compact-toolbar", left: 390, top: 360, right: 430, bottom: 410 }],
    );

    expect(result).toEqual({
      rect: { left: 398, top: 326, right: 422, bottom: 350 },
      available: true,
    });
  });

  it("packs same-card controls jointly instead of letting a later control cover an earlier one", () => {
    const candidates = [
      { left: 100, top: 100, right: 124, bottom: 124 },
      { left: 132, top: 100, right: 156, bottom: 124 },
    ];

    const placements = chooseJointControlPlacements([
      { id: "edit", candidates },
      { id: "expand", candidates },
    ]);

    expect(placements.get("edit")).toMatchObject({ index: 0, available: true });
    expect(placements.get("expand")).toMatchObject({ index: 1, available: true });
  });

  it("chooses a move candidate clear of both the sibling halo and the selected card body", () => {
    const siblingHalo = { left: -14, top: 25.140625, right: 258, bottom: 155.140625, id: "text-controls-first" };
    const selectedBody = { left: 4, top: 93.25, right: 240, bottom: 187.25, id: "text-body-current" };
    const placement = chooseAvailableControlPlacement(
      [
        { left: 0, top: 163.25, right: 24, bottom: 187.25 },
        { left: 258, top: 93.25, right: 282, bottom: 117.25 },
      ],
      [siblingHalo, selectedBody],
    );

    expect(placement).toEqual({
      index: 1,
      rect: { left: 258, top: 93.25, right: 282, bottom: 117.25 },
      available: true,
    });
  });

  it("adds transient sibling body and localized control bands without changing the card rect", () => {
    const body = { left: 4, top: 93, right: 240, bottom: 187 };
    const obstacles = textCardControlObstacles(
      [{ id: "sibling", body }],
      "current",
      24,
    );

    expect(obstacles).toEqual([
      { ...body, id: "text-body-sibling" },
      { left: 210, top: 87, right: 246, bottom: 123, id: "text-controls-top-sibling" },
      { left: 210, top: 157, right: 246, bottom: 193, id: "text-controls-bottom-sibling" },
    ]);
    expect(body).toEqual({ left: 4, top: 93, right: 240, bottom: 187 });
  });

  it("reports the true 244x242 capacity failure when HUD and toolbar share the plot", () => {
    const entries = [
      {
        id: "first",
        geometry: textCardGeometry({ x: 32, y: 32 }, { x: 4, y: 38 }, { width: 236, height: 112 }, 244, 242),
      },
      {
        id: "second",
        geometry: textCardGeometry({ x: 48, y: 72 }, { x: 4, y: 76 }, { width: 236, height: 94 }, 244, 242),
      },
    ];
    const result = resolveTextCardGeometries(entries, [
      { id: "chart-ohlc", left: 10, top: 8, right: 220, bottom: 32 },
      { id: "compact-toolbar", left: 84, top: 197, right: 160, bottom: 235 },
    ], 244, 242);

    expect(result.unresolvedIds).toEqual(["second"]);
  });

  it("packs complete bodies below measured HUD obstacles without changing width or anchors", () => {
    const entries = [
      {
        id: "first",
        geometry: textCardGeometry({ x: 32, y: 32 }, { x: 4, y: 38 }, { width: 236, height: 112 }, 244, 372),
      },
      {
        id: "second",
        geometry: textCardGeometry({ x: 48, y: 72 }, { x: 4, y: 76 }, { width: 236, height: 94 }, 244, 372),
      },
    ];
    const result = resolveTextCardGeometries(entries, [
      { id: "chart-ohlc", left: 10, top: 8, right: 220, bottom: 32 },
      { id: "compact-toolbar", left: 84, top: 327, right: 160, bottom: 365 },
    ], 244, 372);
    const first = result.placements.get("first")!;
    const second = result.placements.get("second")!;

    expect(result.unresolvedIds).toEqual([]);
    expect(first.width).toBe(236);
    expect(second.width).toBe(236);
    expect(first.anchor).toEqual(entries[0].geometry.anchor);
    expect(second.anchor).toEqual(entries[1].geometry.anchor);
    expect(first.y + first.height).toBeLessThanOrEqual(second.y);
    expect(second.y + second.height).toBeLessThanOrEqual(372);
  });

  it("moves a body clear of fixed anchor handles before transient controls are packed", () => {
    const entries = [
      {
        id: "first",
        geometry: textCardGeometry({ x: 32, y: 198 }, { x: 4, y: 64 }, { width: 236, height: 115 }, 244, 472),
      },
      {
        id: "second",
        geometry: textCardGeometry({ x: 48, y: 192 }, { x: 4, y: 187 }, { width: 236, height: 94 }, 244, 472),
      },
    ];
    const result = resolveTextCardGeometries(entries, [
      { id: "chart-ohlc", left: 10, top: 8, right: 258, bottom: 46 },
      { id: "text-anchor-first", left: 20, top: 186, right: 44, bottom: 210 },
      { id: "text-anchor-second", left: 36, top: 180, right: 60, bottom: 204 },
    ], 244, 472);
    const first = result.placements.get("first")!;
    const second = result.placements.get("second")!;

    expect(result.unresolvedIds).toEqual([]);
    expect(first.width).toBe(236);
    expect(second.width).toBe(236);
    expect(first.anchor).toEqual(entries[0].geometry.anchor);
    expect(second.anchor).toEqual(entries[1].geometry.anchor);
    expect(first.y + first.height).toBeLessThanOrEqual(second.y);
    expect(second.y).toBeGreaterThanOrEqual(212);
  });

  it("fits a fine or coarse selected operation row without overlapping its sibling expand", () => {
    const fine = chooseJointControlPlacements([
      { id: "edit", candidates: [{ left: 4, top: 328, right: 40, bottom: 364 }] },
      { id: "expand", candidates: [{ left: 44, top: 328, right: 68, bottom: 352 }] },
      { id: "width", candidates: [{ left: 72, top: 328, right: 96, bottom: 352 }] },
      { id: "move", candidates: [{ left: 100, top: 328, right: 124, bottom: 352 }] },
      { id: "sibling-expand", candidates: [{ left: 128, top: 328, right: 152, bottom: 352 }] },
    ]);
    const coarse = chooseJointControlPlacements([
      { id: "edit", candidates: [{ left: 4, top: 374, right: 48, bottom: 418 }] },
      { id: "expand", candidates: [{ left: 52, top: 374, right: 96, bottom: 418 }] },
      { id: "width", candidates: [{ left: 100, top: 374, right: 144, bottom: 418 }] },
      { id: "move", candidates: [{ left: 148, top: 374, right: 192, bottom: 418 }] },
      { id: "sibling-expand", candidates: [{ left: 196, top: 374, right: 240, bottom: 418 }] },
    ]);

    expect([...fine.values()].every((placement) => placement.available)).toBe(true);
    expect([...coarse.values()].every((placement) => placement.available)).toBe(true);
  });

  it("keeps a fine/coarse control size and reports a keyboard fallback when every candidate is blocked", () => {
    const fine = chooseAvailableControlRect(
      [{ left: 100, top: 100, right: 124, bottom: 124 }],
      [{ id: "compact-toolbar", left: 90, top: 90, right: 130, bottom: 130 }],
    );
    const coarse = chooseAvailableControlRect(
      [{ left: 100, top: 100, right: 144, bottom: 144 }],
      [{ id: "compact-toolbar", left: 90, top: 90, right: 150, bottom: 150 }],
    );

    expect(fine).toEqual({
      rect: { left: 100, top: 100, right: 124, bottom: 124 },
      available: false,
    });
    expect(coarse).toEqual({
      rect: { left: 100, top: 100, right: 144, bottom: 144 },
      available: false,
    });
  });

  it("does not treat edge touching as an overlap", () => {
    expect(chooseAvailableControlRect(
      [{ left: 130, top: 90, right: 150, bottom: 110 }],
      [{ id: "compact-toolbar", left: 90, top: 90, right: 130, bottom: 110 }],
    )).toEqual({
      rect: { left: 130, top: 90, right: 150, bottom: 110 },
      available: true,
    });
  });
});
