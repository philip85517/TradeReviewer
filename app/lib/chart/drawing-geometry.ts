export type ProjectedPoint = { x: number; y: number };

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
