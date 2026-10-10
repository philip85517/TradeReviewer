import { describe, expect, it } from "vitest";
import { createRiskRewardAnchors, hitRiskRewardHandle } from "./risk-selection";

const anchor = (price: number, time = "t") => ({ price, time });

describe("risk selection geometry", () => {
  it("creates a 1:1 long risk reward in the price domain", () => {
    expect(createRiskRewardAnchors(anchor(56), anchor(52), "long")?.map((item) => item.price)).toEqual([56, 52, 60]);
  });

  it("creates a 1:1 short risk reward in the price domain", () => {
    expect(createRiskRewardAnchors(anchor(56), anchor(60), "short")?.map((item) => item.price)).toEqual([56, 60, 52]);
  });

  it.each([
    ["long", 56, 60],
    ["short", 56, 52],
  ] as const)("rejects wrong-side %s stop", (direction, entry, stop) => {
    expect(createRiskRewardAnchors(anchor(entry), anchor(stop), direction)).toBeNull();
  });

  it("rejects a rounded target that crosses the entry or becomes non-finite", () => {
    expect(createRiskRewardAnchors(anchor(56.004), anchor(56.003), "long")).toBeNull();
    expect(createRiskRewardAnchors(anchor(Number.MAX_VALUE), anchor(-Number.MAX_VALUE), "long")).toBeNull();
  });

  it("rejects zero risk", () => {
    expect(createRiskRewardAnchors(anchor(56), anchor(56), "long")).toBeNull();
  });

  it("hits the nearest price handle at desktop and coarse pointer sizes", () => {
    const points = [{ x: 20, y: 60 }, { x: 20, y: 62 }, { x: 20, y: 64 }];
    expect(hitRiskRewardHandle({ x: 20, y: 63 }, points)).toEqual({ kind: "price", anchorIndex: 1 });
    expect(hitRiskRewardHandle({ x: 20, y: 84 }, points, true)).toEqual({ kind: "price", anchorIndex: 2 });
  });

  it("limits width hit to a 16px or 44px target around its actual grip", () => {
    const points = [{ x: 20, y: 0 }, { x: 20, y: 100 }, { x: 20, y: 200 }];
    expect(hitRiskRewardHandle({ x: 130, y: 150 }, points)).toBeNull();
    expect(hitRiskRewardHandle({ x: 137, y: 107 }, points)?.kind).toBe("width");
    expect(hitRiskRewardHandle({ x: 150, y: 120 }, points, true)?.kind).toBe("width");
    expect(hitRiskRewardHandle({ x: 153, y: 123 }, points, true)).toBeNull();
  });

  it("returns every tied rightmost anchor for the width handle", () => {
    expect(hitRiskRewardHandle({ x: 130, y: 50 }, [{ x: 20, y: 20 }, { x: 130, y: 40 }, { x: 130, y: 80 }])).toEqual({ kind: "width", anchorIndexes: [1, 2] });
  });

  it("keeps entry out of the width group when all anchors share one pixel", () => {
    expect(hitRiskRewardHandle({ x: 130, y: 50 }, [{ x: 20, y: 20 }, { x: 20, y: 40 }, { x: 20, y: 80 }])).toEqual({ kind: "width", anchorIndexes: [1, 2] });
  });
});
