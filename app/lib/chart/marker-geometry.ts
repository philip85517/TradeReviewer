/**
 * Map a real marker timestamp onto the chart's logical timeline.
 *
 * This is deliberately independent of OHLC data. A timestamp between two
 * known candles is interpolated within that known interval. A timestamp after
 * the last known point is only addressable when the caller registers that real
 * timestamp as a whitespace point on the same timeline.
 */
export function markerLogicalPosition(
  candleTimes: readonly number[],
  targetSeconds: number,
): number | null {
  const times = candleTimes.filter(Number.isFinite);
  if (!Number.isFinite(targetSeconds) || times.length === 0) return null;

  for (let index = 0; index < times.length; index += 1) {
    const current = times[index];
    if (targetSeconds === current) return index;
    if (targetSeconds < current) {
      if (index === 0) return null;
      const previous = times[index - 1];
      const span = current - previous;
      if (!(span > 0)) return null;
      return index - 1 + (targetSeconds - previous) / span;
    }
  }

  return null;
}

/** Build the shared real-time axis used by the live chart and canonical capture. */
export function markerTimelineTimes(
  candleTimes: readonly number[],
  whitespaceTimes: readonly number[],
): number[] {
  return [...new Set([...candleTimes, ...whitespaceTimes].filter(Number.isFinite))]
    .sort((left, right) => left - right);
}

export type MarkerDisplayGeometry = {
  x: number;
  y: number;
  radius: number;
};

/**
 * Price-axis labels are centered on the plot boundary and can extend into the
 * pane. Reserve half of the measured axis width for marker text without
 * moving the marker's time/price anchor.
 */
export function markerRightLabelBoundary(plotWidth: number, priceScaleWidth?: number) {
  if (!Number.isFinite(plotWidth)) return undefined;
  if (!Number.isFinite(priceScaleWidth) || (priceScaleWidth as number) <= 0) return plotWidth;
  return Math.max(0, plotWidth - (priceScaleWidth as number) / 2);
}

/**
 * Resolve one marker's media-space geometry after its per-fill lane offset.
 *
 * An anchor outside the pane is left untouched so off-screen facts do not
 * appear at an edge. An anchor inside the pane is clamped after applying its
 * lane offset, keeping the filled diamond wholly inside the plot. Live paint,
 * capture paint, and hit-testing must all use this same projection.
 */
export function markerDisplayGeometry(input: {
  anchorX: number;
  anchorY: number;
  position: "aboveBar" | "belowBar";
  offsetX?: number;
  offsetY?: number;
  maxX?: number;
  radius?: number;
}): MarkerDisplayGeometry {
  const radius = input.radius ?? 6;
  const translatedX = input.anchorX + (input.offsetX ?? 0);
  const canClampToPane = Number.isFinite(input.maxX) &&
    input.anchorX >= 0 &&
    input.anchorX <= (input.maxX as number);
  const x = canClampToPane
    ? Math.min(
        Math.max(radius, translatedX),
        Math.max(radius, (input.maxX as number) - radius),
      )
    : translatedX;
  const y = input.anchorY + (input.position === "aboveBar" ? -10 : 10) + (input.offsetY ?? 0);
  return { x, y, radius };
}
