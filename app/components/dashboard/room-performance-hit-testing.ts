export type TrendHitCandidate = {
  key: string;
  x: number;
  y: number;
};

export type TrendHitTestResult = {
  nearest: TrendHitCandidate | null;
  matches: TrendHitCandidate[];
  distance: number;
};

/** Resolve a pointer against chart points in CSS pixels, regardless of SVG scaling. */
export function nearestTrendHit(
  pointer: { clientX: number; clientY: number },
  bounds: { left: number; top: number; width: number; height: number },
  chart: { width: number; height: number },
  candidates: readonly TrendHitCandidate[],
  maxDistance = 22,
): TrendHitTestResult {
  if (bounds.width <= 0 || bounds.height <= 0 || chart.width <= 0 || chart.height <= 0) {
    return { nearest: null, matches: [], distance: Number.POSITIVE_INFINITY };
  }
  const scaleX = bounds.width / chart.width;
  const scaleY = bounds.height / chart.height;
  const distances = candidates.map(candidate => {
    const x = bounds.left + candidate.x * scaleX;
    const y = bounds.top + candidate.y * scaleY;
    return { candidate, distance: Math.hypot(pointer.clientX - x, pointer.clientY - y) };
  }).sort((a, b) => a.distance - b.distance);
  const nearest = distances[0];
  if (!nearest || nearest.distance > maxDistance) {
    return { nearest: null, matches: [], distance: nearest?.distance ?? Number.POSITIVE_INFINITY };
  }
  const epsilon = 0.5;
  const matches = distances.filter(item => item.distance <= nearest.distance + epsilon).map(item => item.candidate);
  return { nearest: nearest.candidate, matches, distance: nearest.distance };
}
