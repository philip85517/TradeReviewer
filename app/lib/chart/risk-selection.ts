import type { DrawingAnchor } from "./drawings";

export type RiskDirection = "long" | "short";
export type RiskHandle =
  | { kind: "price"; anchorIndex: 0 | 1 | 2 }
  | { kind: "width"; anchorIndexes: number[] }
  | null;

export type RiskPoint = { x: number; y: number };

export function createRiskRewardAnchors(
  entry: DrawingAnchor,
  stop: DrawingAnchor,
  direction: RiskDirection,
): [DrawingAnchor, DrawingAnchor, DrawingAnchor] | null {
  if (![entry.price, stop.price].every(Number.isFinite)) return null;
  const risk = entry.price - stop.price;
  if (risk === 0) return null;
  if ((direction === "long" && risk < 0) || (direction === "short" && risk > 0)) return null;
  const target = Number((entry.price + risk).toFixed(2));
  if (!Number.isFinite(target) || (direction === "long" ? target <= entry.price : target >= entry.price)) return null;
  return [entry, stop, { ...stop, price: target }];
}

export function riskRewardBounds(points: readonly RiskPoint[], minimumWidth = 110) {
  if (points.length < 3) return null;
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x), left + minimumWidth);
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  return { left, right, top, bottom, widthHandle: { x: right, y: (top + bottom) / 2 } };
}

export function hitRiskRewardHandle(
  point: RiskPoint,
  points: readonly RiskPoint[],
  coarse = false,
): RiskHandle {
  const bounds = riskRewardBounds(points);
  if (!bounds) return null;
  const radius = coarse ? 22 : 8;
  // Stable nearest selection prevents a tiny or overlapping risk from making
  // the first anchor permanently win every hit.
  const candidates = points
    .slice(0, 3)
    .map((candidate, anchorIndex) => ({
      anchorIndex: anchorIndex as 0 | 1 | 2,
      distance: Math.hypot(point.x - candidate.x, point.y - candidate.y),
    }))
    .filter((candidate) => Math.abs(point.x - points[candidate.anchorIndex].x) <= radius && Math.abs(point.y - points[candidate.anchorIndex].y) <= radius)
    .sort((left, right) => left.distance - right.distance || left.anchorIndex - right.anchorIndex);
  if (candidates[0]) return { kind: "price", anchorIndex: candidates[0].anchorIndex };
  if (
    Math.abs(point.x - bounds.right) <= radius &&
    Math.abs(point.y - bounds.widthHandle.y) <= radius
  ) {
    return riskRewardWidthHandle(points);
  }
  return null;
}

export function pointInRiskRewardArea(point: RiskPoint, points: readonly RiskPoint[]) {
  const bounds = riskRewardBounds(points);
  return Boolean(bounds && point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom);
}

export function riskRewardWidthHandle(points: readonly RiskPoint[]): Exclude<RiskHandle, null | { kind: "price"; anchorIndex: 0 | 1 | 2 }> {
  const rightmost = points.reduce((max, candidate, index) => {
    if (candidate.x > points[max].x + 0.01) return index;
    return max;
  }, 0);
  const allSameX = points.every((candidate) => Math.abs(candidate.x - points[0].x) <= 0.01);
  const anchorIndexes = points
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => Math.abs(candidate.x - points[rightmost].x) <= 0.01)
    .filter(({ index }) => !allSameX || index !== 0)
    .map(({ index }) => index);
  return { kind: "width", anchorIndexes };
}
