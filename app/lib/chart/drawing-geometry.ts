export type ProjectedPoint = { x: number; y: number };

export const DEFAULT_FIBONACCI_LEVELS = [
  0,
  0.236,
  0.382,
  0.5,
  0.618,
  0.786,
  1,
] as const;

export type ParallelChannelGeometry = {
  base: [ProjectedPoint, ProjectedPoint];
  parallel: [ProjectedPoint, ProjectedPoint];
};

/**
 * Returns the two finite lines represented by a three point channel. The
 * first two points are the base line and the third point supplies the
 * translated parallel line. Keeping this calculation in projected space
 * makes it work for both time/price anchors and blank canvas space.
 */
export function parallelChannelGeometry(
  first: ProjectedPoint,
  second: ProjectedPoint,
  offset: ProjectedPoint,
): ParallelChannelGeometry {
  const delta = { x: offset.x - first.x, y: offset.y - first.y };
  return {
    base: [first, second],
    parallel: [
      { x: first.x + delta.x, y: first.y + delta.y },
      { x: second.x + delta.x, y: second.y + delta.y },
    ],
  };
}

/** Alias retained for callers that prefer a line-oriented name. */
export const parallelChannelLines = parallelChannelGeometry;

export type FibonacciLevel = {
  ratio: number;
  y: number;
};

/** Interpolates the standard retracement levels between two projected points. */
export function fibonacciLevels(
  first: ProjectedPoint,
  second: ProjectedPoint,
  levels: readonly number[] = DEFAULT_FIBONACCI_LEVELS,
): FibonacciLevel[] {
  return levels.map((ratio) => ({
    ratio,
    y: first.y + (second.y - first.y) * ratio,
  }));
}

/** Explicit alias for consumers that want the values rather than geometry. */
export const fibonacciLevelValues = fibonacciLevels;

const DEFAULT_TOLERANCE = 6;

function squaredDistance(a: ProjectedPoint, b: ProjectedPoint) {
  const x = a.x - b.x;
  const y = a.y - b.y;
  return x * x + y * y;
}

export function isPointNearSegment(
  point: ProjectedPoint,
  start: ProjectedPoint,
  end: ProjectedPoint,
  tolerance = DEFAULT_TOLERANCE,
) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (segmentLengthSquared === 0) {
    return squaredDistance(point, start) <= tolerance * tolerance;
  }
  const progress = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
        segmentLengthSquared,
    ),
  );
  return (
    squaredDistance(point, {
      x: start.x + progress * segmentX,
      y: start.y + progress * segmentY,
    }) <=
    tolerance * tolerance
  );
}

export function isPointNearRectangleEdge(
  point: ProjectedPoint,
  first: ProjectedPoint,
  second: ProjectedPoint,
  tolerance = DEFAULT_TOLERANCE,
) {
  const left = Math.min(first.x, second.x);
  const right = Math.max(first.x, second.x);
  const top = Math.min(first.y, second.y);
  const bottom = Math.max(first.y, second.y);
  return [
    [{ x: left, y: top }, { x: right, y: top }],
    [{ x: right, y: top }, { x: right, y: bottom }],
    [{ x: right, y: bottom }, { x: left, y: bottom }],
    [{ x: left, y: bottom }, { x: left, y: top }],
  ].some(([start, end]) => isPointNearSegment(point, start, end, tolerance));
}

export function isPointNearAnchorHandle(
  point: ProjectedPoint,
  anchor: ProjectedPoint,
  tolerance = DEFAULT_TOLERANCE,
) {
  return squaredDistance(point, anchor) <= tolerance * tolerance;
}
